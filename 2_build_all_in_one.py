# inline_assets.py
import os
import sys
import re
from pathlib import Path
from urllib.parse import quote
import shutil

def read_text(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_text(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)

def is_local_href(src: str) -> bool:
    if not src:
        return False
    src = src.strip()
    return not (src.startswith("http://") or src.startswith("https://") or src.startswith("//") or src.startswith("data:"))

def inline_html(in_path: str, out_path: str) -> Path:
    html_path = Path(in_path)
    html = read_text(html_path)

    # ---------- Inline CSS: <link rel="stylesheet" href="..."> ----------
    def replace_link_styles(match: re.Match) -> str:
        tag = match.group(0)
        href = match.group("href").strip()
        if not is_local_href(href):
            return tag
        css_file = (html_path.parent / href).resolve()
        if not css_file.exists():
            print(f"[warn] CSS not found: {css_file}")
            return tag
        css = read_text(css_file)
        return f"<style>{css}</style>"

    link_css_re = re.compile(
        r'<link\s+[^>]*rel=["\']stylesheet["\'][^>]*href=["\'](?P<href>[^"\']+)["\'][^>]*>',
        re.IGNORECASE,
    )
    html = link_css_re.sub(replace_link_styles, html)

    # ---------- Inline JS: <script src="..."></script> ----------
    def replace_script_src(match: re.Match) -> str:
        tag = match.group(0)
        src = match.group("src").strip()
        if not is_local_href(src):
            return tag
        js_file = (html_path.parent / src).resolve()
        if not js_file.exists():
            print(f"[warn] JS not found: {js_file}")
            return tag
        js = read_text(js_file)
        # js = jsmin(js)
        return f"<script>{js}</script>"

    script_re = re.compile(
        r'<script\s+[^>]*src=["\'](?P<src>[^"\']+)["\'][^>]*>\s*</script>',
        re.IGNORECASE,
    )
    html = script_re.sub(replace_script_src, html)

    # ---------- Inline SVG favicon: <link rel="icon" ... href="*.svg"> ----------
    def replace_svg_icon_href(match: re.Match) -> str:
        tag = match.group(0)
        href = match.group("href").strip()
        if not is_local_href(href):
            return tag
        icon_file = (html_path.parent / href).resolve()
        if not icon_file.exists():
            print(f"[warn] Icon SVG not found: {icon_file}")
            return tag
        svg = read_text(icon_file)

        # URL-encode the SVG content (requested behavior)
        # Keep no characters unescaped to avoid parser issues.
        data_url = "data:image/svg+xml," + quote(svg, safe="")

        # Replace only the href attribute value, preserve the rest of the tag
        tag = re.sub(r'href=(["\'])(?:[^"\']+)\1', f'href="{data_url}"', tag)
        # Ensure type is set correctly (if missing)
        if re.search(r'type=["\']image/svg\+xml["\']', tag, flags=re.IGNORECASE) is None:
            # insert a type attribute (simple append before '>')
            tag = tag[:-1] + ' type="image/svg+xml">'
        return tag

    # Matches rel=icon / rel="shortcut icon", with optional type=, and .svg href
    icon_svg_re = re.compile(
        r'<link\s+[^>]*rel=["\'](?:icon|shortcut\s+icon)["\'][^>]*href=["\'](?P<href>[^"\']+?\.svg(?:\?[^\"]*)?)["\'][^>]*>',
        re.IGNORECASE,
    )
    html = icon_svg_re.sub(replace_svg_icon_href, html)

    # ---------- Light HTML whitespace collapse ----------
    # html = re.sub(r'>\s+<', '><', html)

    out_path = Path(out_path)
    write_text(out_path, html)
    return out_path


in_path = "min/dashboard.html"
# in_path = "dev/dashboard.html" # non minified all in one?
out_path = "dashboard.html"
if not os.path.isfile(in_path):
    print(f"Error: '{in_path}' is not a file")
    sys.exit(1)
out = inline_html(in_path, out_path)

print(f"✅ Wrote: {out_path}")

if os.path.isdir('min/'):
  shutil.rmtree('min/')


print(f"✅ Removed: min/")
