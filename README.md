# Quine Task Dashboard

A lightweight, self-contained dashboard for managing milestones, tasks, and team priorities — delivered as a single local HTML file.

> [!IMPORTANT]
> As of the commit introducing this README, a major rewrite is nearing completion and will be released as **v2.0.0**.  
> This documentation reflects the **v2 architecture and feature set**.

## What is a Quine?

A **quine** is a computer program that outputs its own source code without reading it from an external file.

The concept is named after philosopher **Willard Van Orman Quine**, and in this project it refers to the dashboard’s ability to **self‑persist** — saving its own data directly into the HTML file.

## Screenshots

> Coming Soon™  

## Features

### Milestone Management

- Add, edit, and remove milestones
- Support for dated and non-dated milestones  
  - Non-dated milestones are displayed as **`PERPETUAL`**
- Mark milestone dates as **tentative**
- Attach an external link

### Task Management

- Add, edit, and remove tasks
- Tasks can:
  - Have their own key date
  - Inherit dates from linked milestones
  - Exist without a date at all (**`PERPETUAL`**)
  - Have attached external links to:
    - JIRA
    - Confluence
    - SharePoint / Other documentation systems
  - Have an assigned category which allows:
    - Filtering by category
    - Visual colour coding
  - Be marked as **Complete**
    - Completed tasks remain viewable in a seperate section
    - Bulk deletion of completed tasks is supported via **Delete Before Date** function

### Resource Management

- Add, edit, or remove resources
- Resources are simply a name with a type (eg: engineer, team, laboratory)

### Category Management

- Add, edit, or remove categories
- Categories have a name, code (like an acronym) and a color for display use

### Task Allocation

- Allocate or unallocate tasks to resources via:
  - the Task edit dialog
  - Drag-and-dropping between resource lists
- Reorder tasks within a resource to:
  - Adjust priority
  - Separate **Active** vs **Backlog** tasks

### Graphical Timelines

- Visualise milestones with due dates
- Visualise tasks allocated to each resource

### Soon & Late Indicators

- Automatic colour highlighting for:
  - Upcoming tasks/milestones
  - Overdue tasks/milestones

### Filtering

Filter task shown on the dashboard by:

- Category
- Milestone
- Free-text search

### Save & Persist (Quine Functionality)

The dashboard can **save itself**:

- Download the current page state
- Replace the previous file
- Retain all data without external storage

### Export to Clipboard

- Copies a formatted HTML summary of dashboard data
- Ideal for Emails, Status reports and other Documentation

### Read-Only Mode

- Share the same web-based rich dashboard view
- Prevent editing or data modification

## Getting Started

A minimal dataset is included to help you get up and running quickly.

- Included by default in the built dashboard
- Location: `dev/data-minimal.js`
- Purpose: Provides a small example USERDATA structure

When I build the all‑in‑one file, I *try* to make sure this is the included data for the all-in-one HTML `/dashboard.html`.

You can replace this data with your own via the import/export functionality or using the normal UI features.

## Built Using

| Technology | Purpose |
|------------|---------|
| Basecoat UI | Component framework |
| Tailwind CSS | Styling & layout |
| jQuery | Core scripting |
| SortableJS | Drag & drop interactions |
| d3-milestones | Timeline visualisation |

## Upgrading (v2.0.0 Onward)

> [!WARNING]
> **Do NOT overwrite your old dashboard HTML file before exporting USERDATA.**  
> Doing so will permanently erase embedded data and it cannot be recovered.

Follow these steps to migrate user data:

```text
1. Export USERDATA to JSON from the old dashboard (≥ v2.0.0)
2. Open the new dashboard HTML file
3. Import USERDATA from JSON
4. Save the new dashboard file
```

## Modifying / Developing

Clone the repository locally:

```bash
git clone https://github.com/danricho/quine-task-dashboard.git
cd quine-task-dashboard
```

Development work should be performed inside the `dev/` directory.

### Build (All‑in‑One Dashboard)

The production dashboard is `/dashboard.html`, an all-in-one, **minified single HTML file**.

#### 1. Install Python

```bash
python3 --version
```

#### 2. (Optional) Create Virtual Environment

```bash
python3 -m venv venv
```

#### 3. Install Requirements

```bash
venv/bin/python -m pip install -r requirements.txt
```

#### 4. Minify Assets

```bash
venv/bin/python 1_minify_assets.py
```

This step:

- Creates a temporary `min/` directory
- Outputs minified JS and CSS

#### 5. Build Unified Dashboard

```bash
venv/bin/python 2_build_all_in_one.py
```

This process:

- Inlines external dependencies *(except Google Fonts)*
- Produces `/dashboard.html` in the repo root
- Removes the temporary `min/` directory

#### 6. (Optional) Version Bump Build

```bash
venv/bin/python 3_build_all_in_one.py
```

I use this when committing changes to git that require a version increment.

## License

Licensed under the **Apache License, Version 2.0**.

See `LICENSE` for the full license text.

