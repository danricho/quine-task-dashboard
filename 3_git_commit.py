#!/usr/bin/env python3
"""
commit_and_tag.py

1) Find latest reachable git tag that contains a semantic version x.x.x (optionally prefixed with "v")
2) Ask user for bump level (major/minor/patch)
3) Ask user for commit message
4) Run git commit, then tag the new commit with the bumped version

Usage:
  python commit_and_tag.py
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional, Tuple
from pathlib import Path

SEMVER_RE = re.compile(r"^(?P<prefix>v)?(?P<maj>0|[1-9]\d*)\.(?P<min>0|[1-9]\d*)\.(?P<pat>0|[1-9]\d*)$")
# VERSION_IN_FILE_RE = re.compile(r"\bv\d+\.\d+\.\d+\b")
VERSION_IN_FILE_RE = re.compile(r"<span\s+id=['\"]version['\"]>\s*(v\d+\.\d+\.\d+)\s*</span>")

def _extract_versions_from_file(path: Path) -> set[str]:
    """
    Return all distinct occurrences of vX.Y.Z found in the file.
    """
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return set()

    return {m.group(1) for m in VERSION_IN_FILE_RE.finditer(text)}


def ensure_version_in_files_matches(expected_version: str, rel_paths: list[str]) -> None:
    """
    Ensure each file contains exactly one distinct vX.Y.Z and that it matches
    expected_version. Exit with an error listing offending files otherwise.
    """
    repo_root = Path.cwd()
    problems: list[str] = []

    for rel_path in rel_paths:
        path = repo_root / rel_path

        if not path.exists():
            problems.append(f"- {rel_path}: file not found")
            continue

        versions = _extract_versions_from_file(path)

        if not versions:
            problems.append(f"- {rel_path}: no version like vX.Y.Z found")
            continue

        if len(versions) > 1:
            problems.append(
                f"- {rel_path}: multiple versions found: {', '.join(sorted(versions))}"
            )
            continue

        found = next(iter(versions))
        if found != expected_version:
            problems.append(
                f"- {rel_path}: found {found} (expected {expected_version})"
            )

    if problems:
        print("\nError: version mismatch in dashboard files.", file=sys.stderr)
        print(f"Expected version: {expected_version}", file=sys.stderr)
        print("Problems:", file=sys.stderr)
        for p in problems:
            print(p, file=sys.stderr)
        print("\nFix the file(s) above and retry.", file=sys.stderr)
        sys.exit(8)



@dataclass(frozen=True)
class Version:
    major: int
    minor: int
    patch: int
    prefix_v: bool = True  # whether to write tags as "vX.Y.Z"

    @classmethod
    def parse_tag(cls, tag: str) -> Optional["Version"]:
        m = SEMVER_RE.match(tag.strip())
        if not m:
            return None
        return cls(
            major=int(m.group("maj")),
            minor=int(m.group("min")),
            patch=int(m.group("pat")),
            prefix_v=bool(m.group("prefix")),
        )

    def bump(self, level: str) -> "Version":
        level = level.lower().strip()
        if level in ("major", "1"):
            return Version(self.major + 1, 0, 0, self.prefix_v)
        if level in ("minor", "2"):
            return Version(self.major, self.minor + 1, 0, self.prefix_v)
        if level in ("patch", "3"):
            return Version(self.major, self.minor, self.patch + 1, self.prefix_v)
        raise ValueError("Invalid bump level")

    def tag(self) -> str:
        base = f"{self.major}.{self.minor}.{self.patch}"
        return f"v{base}" if self.prefix_v else base

    def plain(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


def run_git(args: list[str], *, capture: bool = True, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        text=True,
        capture_output=capture,
        check=check,
    )


def ensure_git_repo() -> None:
    try:
        run_git(["rev-parse", "--is-inside-work-tree"])
    except subprocess.CalledProcessError:
        print("Error: not inside a git repository.", file=sys.stderr)
        sys.exit(2)


def get_latest_reachable_tag() -> Tuple[str, Version]:
    """
    Prefer the nearest tag reachable from HEAD:
      git describe --tags --abbrev=0

    If that tag doesn't match semver, we scan tags reachable from HEAD (most recent first)
    and pick the first that matches x.x.x or vX.Y.Z.
    """
    # 1) nearest reachable tag
    tag = None
    try:
        cp = run_git(["describe", "--tags", "--abbrev=0"], capture=True, check=True)
        tag = cp.stdout.strip()
    except subprocess.CalledProcessError:
        tag = None

    if tag:
        v = Version.parse_tag(tag)
        if v:
            return tag, v

    # 2) fallback: list reachable tags sorted by creator date descending
    # Note: for lightweight tags, creator date can be weird; still typically OK.
    try:
        cp = run_git(
            ["tag", "--merged", "HEAD", "--sort=-creatordate"],
            capture=True,
            check=True,
        )
        for t in [line.strip() for line in cp.stdout.splitlines() if line.strip()]:
            v = Version.parse_tag(t)
            if v:
                return t, v
    except subprocess.CalledProcessError:
        pass

    print(
        "Error: could not find any reachable tag matching x.x.x (or vX.Y.Z).\n"
        "Create one first, e.g. `git tag v0.1.0`.",
        file=sys.stderr,
    )
    sys.exit(3)


def prompt_bump_level() -> str:
    while True:
        print("Select bump level:")
        print("  1) major (X.0.0)")
        print("  2) minor (x.Y.0)")
        print("  3) patch (x.y.Z)")
        resp = input("Enter 1/2/3 or major/minor/patch: ").strip().lower()
        if resp in ("1", "2", "3", "major", "minor", "patch"):
            return resp
        print("Invalid selection. Try again.\n")


def prompt_commit_message() -> str:
    while True:
        msg = input("Commit message: ").strip()
        if msg:
            return msg
        print("Commit message cannot be empty.\n")


def working_tree_clean_or_confirm() -> None:
    cp = run_git(["status", "--porcelain"], capture=True, check=True)
    if cp.stdout.strip() == "":
        return

    print("Working tree has unstaged/uncommitted changes (expected if you're about to commit).")
    print("Proceeding will commit currently staged changes (or fail if nothing is staged).")
    ans = input("Continue? [y/N]: ").strip().lower()
    if ans not in ("y", "yes"):
        print("Aborted.")
        sys.exit(0)


def ensure_something_staged() -> None:
    # git diff --cached --quiet exits 1 if there are staged changes, 0 if none
    cp = subprocess.run(["git", "diff", "--cached", "--quiet"])
    if cp.returncode == 0:
        print("Error: no staged changes to commit. Stage files first (e.g. `git add -A`).", file=sys.stderr)
        sys.exit(4)
    if cp.returncode not in (0, 1):
        print("Error: failed to check staged changes.", file=sys.stderr)
        sys.exit(4)


def tag_exists(tag: str) -> bool:
    cp = subprocess.run(["git", "rev-parse", "-q", "--verify", f"refs/tags/{tag}"], capture_output=True, text=True)
    return cp.returncode == 0


def main() -> None:
    ensure_git_repo()

    latest_tag, latest_ver = get_latest_reachable_tag()
    print(f"Latest semver tag (reachable from HEAD): {latest_tag}  (version: {latest_ver.plain()})")

    bump_level = prompt_bump_level()
    next_ver = latest_ver.bump(bump_level)
    next_tag = next_ver.tag()

    print(f"Next version would be: {next_tag}")

    if tag_exists(next_tag):
        print(f"Error: tag {next_tag} already exists.", file=sys.stderr)
        sys.exit(5)

    commit_msg = prompt_commit_message()

    working_tree_clean_or_confirm()
    ensure_something_staged()

    # Ensure dashboard versions match the version being bumped to
    expected_file_version = f"v{next_ver.plain()}"

    ensure_version_in_files_matches(
        expected_file_version,
        [
            "dev/dashboard.html",
            "dashboard.html",
        ],
    )

    # Commit
    print("\nRunning: git commit -m <message>")
    try:
        # print("commit", "-m", commit_msg)
        run_git(["commit", "-m", commit_msg], capture=False, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error: git commit failed with exit code {e.returncode}.", file=sys.stderr)
        sys.exit(e.returncode or 6)

    # Tag the new commit (HEAD)
    print(f"\nTagging HEAD with: {next_tag}")
    try:
        # print("tag", next_tag)
        run_git(["tag", next_tag], capture=False, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error: git tag failed with exit code {e.returncode}.", file=sys.stderr)
        sys.exit(e.returncode or 7)

    print("\nDone.")
    print("You may want to push:")
    print(f"  git push && git push --tags")


if __name__ == "__main__":
    main()
