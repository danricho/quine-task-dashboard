# Quine Task Dashboard
This dashboard is a lightweight, interactive interface for managing team milestones, tasking and priorities - all in a single local html file.

> [!IMPORTANT]
> As of the commit which adds this README, a rewrite is nearing completion (will become v2.0). This readme is written with v2.0.0 in mind.

## What is a Quine?
A quine is a computer program that produces its own source code as output, without reading it from a file. It's named after philosopher Willard Van Orman Quine.

## Screenshots

Coming Soon™

## Features

 - **Milestone Management**: 
     - Add/Edit and Remove Milestones with or without (shown as *PERPETUAL*) a key date and indicate whether a date is tentative.
     - Add a link to the milestone. 
 - **Task Management**: 
     - Add/Edit and Remove Tasks with or without (shown as *PERPETUAL*) a key date or link to a milestone to inherite it's date. Indicate whether a task date (direct) is tentative.
     - Add JIRA/Confluence or other (Sharepoint?) links to a task. 
     - Set a category for the task to allow filtering (below) and color indications of shown tasks on the dashboard.
     - Mark tasks as complete (viewable in *Completed Tasks* until deleted... bulk deletion of completed tasks is possible using 'delete before date' feature). 
 - **Resource Managment**: Add/Edit or Remove (unused) Resources.
 - **Category Management**: Add/Edit or Remove (unused) Categories.
 - **Task Allocation**: 
    - Allocate or Unallocate tasks to different resources either by editing a task or by drag/dropping tasks between resource lists. 
    - Reordering inside a resource's list allows finer prioritisation and setting of active-vs-backlog status of tasks.
  - **Graphical Timelines**:
    - view milestones with a due date on a graphical timeline.
    - view a resource's allocated tasks on a graphical timeline.
  - **Task View-Filtering**: filter by Category, Milestone, and text search.
  - **Save & Persist**: this is the Quine functionality which allows downloading of the currently viewed page - whick enables saving over the old version.
  - **Export to Clipbard**: copies a HTML based text version of the data to the clipboard for emails/documents etc.
  - **Read-Only Save**: allows a rich viewing experience similar to the full view without the ability to edit data.

## Built Using

 - **Basecoat UI** & **Tailwind** for component functionality, styling and CSS
 - **jQuery**, **SortableJS** and **d3-milestones** for scripting, drag-drop features and timelines

## Modifying / Developing 

To make changes, clone the repo locally and make changes in the `dev/` area.

To build the minified and unified (single file) version do the following:

1. Install python
2. Optionally setup a python virtual environment: `python3 -m venv venv`
3. Install python modules in requirements.txt: `venv/bin/python -m pip install -r requirements.txt`
4. Minify javascript and css files: `venv/bin/python 1_minify_assets.py` 
   - This will create a directory `min/` used in the next step
5. Unify the external dependancies (other than the google font): `venv/bin/python 2_build_all_in_one.py` 
   - This will combine all referenced files into `dashboard.html` and place it in the root repo directory and remove the `min/` directory.
6. Optionally, if you want a version bump while commiting change to git, use: `venv/bin/python 3_build_all_in_one.py`
