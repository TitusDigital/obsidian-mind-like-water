# Mind Like Water

GTD-powered task management for [Obsidian](https://obsidian.md). Track tasks inline, organize by Areas of Focus, manage projects, and run weekly reviews — all without leaving your vault.

> *"In karate, there is an image that's used to define the position of perfect readiness: 'mind like water.' Imagine throwing a pebble into a still pond. How does the water respond? The answer is, totally appropriately to the force and mass of the input; then it returns to calm. It doesn't overreact. It doesn't underreact."*
> — David Allen, *Getting Things Done*

## Features

**Inline Task Tracking** — Add a `<!-- mlw:abc123 -->` comment to any checkbox to track it. Use `Ctrl+Shift+T` to track the current line, or `Ctrl+Shift+Q` for quick capture from anywhere.

**GTD Workflow** — Tasks flow through a natural lifecycle: Inbox → Next Action → Scheduled → Someday/Maybe → Completed. Scheduled tasks auto-transition to Next Actions when their start date arrives.

**Unified Sidebar View** — Seven tabs in a single panel:
- **Focus** — Starred tasks and items due today
- **Next Actions** — Active tasks grouped by Area of Focus, project, or context
- **Scheduled** — Future tasks bucketed by time horizon
- **Someday** — Low-priority items for later
- **Projects** — Project cards with outcomes and task counts
- **Completed** — Recently finished tasks
- **Review** — Weekly review checklist with actionable prompts

**Areas of Focus** — Color-coded life areas (Work, Health, Finance, etc.) with per-area filtering across all views.

**Projects** — Markdown-based projects with YAML frontmatter. Each project has a successful outcome, status, and associated tasks. Create projects directly from the metadata editor.

**Recurring Tasks** — Two recurrence models:
- **Fixed schedule** — tasks appear on calendar dates (e.g., "every Thursday")
- **Relative** — next instance spawns N days/weeks after completion
- Supports end conditions (count, until date), pause/resume, and recurrence history

**Metadata Editor** — Click any task chip in the editor (or `Ctrl+click` a task in the sidebar) to open a popover with all task fields: status, area, project, dates, energy, context, recurrence, and star.

**Calendar Date Picker** — Custom dropdown calendar for start and due dates with month navigation, today shortcut, and clear button.

**Task Reordering** — Drag-and-drop or keyboard (Alt+Arrow) reordering in Focus and Next Actions views. Order persists across sessions.

**Three-State Filters** — Filter chips cycle through off → include → exclude. Filter by energy, context, or area with AND/OR logic.

**Codeblock Embeds** — Embed task lists in any note:
- `` ```mlw-focus``` `` — Focus list
- `` ```mlw-completed``` `` — Completed tasks
- `` ```mlw-project-tasks``` `` — Tasks for the current project

**Nirvana Import** — One-click migration from Nirvana (JSON export) with project creation, area mapping, and context preservation.

## Installation

### From Community Plugins (recommended)
1. Open Settings → Community Plugins → Browse
2. Search for "Mind Like Water"
3. Click Install, then Enable

### Manual Installation
1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/TitusDigital/obsidian-mind-like-water/releases)
2. Create a folder at `.obsidian/plugins/mind-like-water/` in your vault
3. Copy the three files into that folder
4. Reload Obsidian and enable the plugin in Settings → Community Plugins

## Quick Start

1. **Track a task** — On any checkbox line (`- [ ] My task`), press `Ctrl+Shift+T`. A colored chip appears showing the task is tracked.
2. **Quick capture** — Press `Ctrl+Shift+Q` to capture a task from anywhere. It goes to your Inbox.
3. **Open the sidebar** — Click the water drop icon in the ribbon, or use the "Open Mind Like Water" command.
4. **Clarify** — Click a task chip to open the metadata editor. Set area of focus, project, dates, and status.
5. **Review** — Use the Review tab weekly to process your inbox, check stale tasks, and mark the review complete.

## Usage Guide

### Tracking Tasks

Any checkbox line in your vault can become a tracked task:

1. Place your cursor on a line like `- [ ] Buy groceries`
2. Press `Ctrl+Shift+T` — a colored chip appears next to the text
3. The task is now in your **Inbox**, waiting to be clarified

To capture a thought without navigating to a file, press `Ctrl+Shift+Q`. The quick capture modal lets you type a task name and hit Enter. It lands in your Inbox (either appended to your daily note or a dedicated inbox file, depending on settings).

### The Sidebar

Click the water drop icon in the left ribbon (or run the "Open Mind Like Water" command) to open the sidebar. Eight tabs organize your tasks by GTD stage:

**Inbox** — Unclarified tasks. Click a task to open the metadata editor and assign an area of focus, project, dates, and status. Once you set an area of focus, closing the editor automatically promotes the task to Next Action.

**Focus** — Your "do today" list. Shows starred tasks, overdue tasks, tasks due today, and tasks whose start date is today. Drag tasks to reorder your priorities.

**Next Actions** — All tasks ready to act on, grouped by Area of Focus (or by project/context when filtered). Use filter chips at the top to narrow by energy level, context, or area. Drag tasks to reorder within groups.

**Scheduled** — Tasks with a future start date, bucketed into time horizons: Overdue, Today, This Week, Next Week, This Month, and Later. When a task's start date arrives, the scheduler automatically moves it to Next Actions.

**Someday / Maybe** — Low-priority items you want to remember but not commit to yet. Review these periodically to see if anything should become active.

**Projects** — Project cards grouped by Area of Focus. Each card shows the project name, successful outcome, task count (completed / total), and a staleness indicator if untouched for 7+ days. Click a card to open the project file. Use the status dropdown to change a project's status (Active, Someday, On Hold, Completed, Dropped).

**Completed** — Tasks finished in the last 30 days, grouped by completion date.

**Review** — Weekly review dashboard (see [Weekly Review](#weekly-review) below).

### The Metadata Editor

Click any task chip in the editor — or `Ctrl+click` a task in the sidebar — to open the metadata editor popover. Fields include:

- **Status** — Inbox, Next Action, Scheduled, Someday, Completed, or Dropped
- **Area of Focus** — Select from your configured areas (or None)
- **Project** — Choose an existing project (filtered by area); click **+** to create a new one
- **Due Date** — Pick from a calendar dropdown with month navigation, a "Today" shortcut, and a clear button
- **Start Date** — Same calendar picker; determines when a Scheduled task becomes a Next Action
- **Energy** — Low, Medium, or High (used for filtering)
- **Context** — @home, @office, @errands, etc. (configured in settings)
- **Starred** — Toggle to pin the task to your Focus list
- **Repeats** — Enable recurrence (see [Recurring Tasks](#recurring-tasks) below)

Use `Tab` to move between fields, `Enter` to confirm, and `Escape` to close.

### Filter Chips

The Next Actions and Scheduled tabs show filter chips at the top. Each chip cycles through three states:

1. **Off** (default) — no filter applied
2. **Include** (highlighted) — show only tasks matching this value
3. **Exclude** (struck through) — hide tasks matching this value

Click a chip to toggle include. `Shift+click` to toggle exclude. `Ctrl+click` to force include when other chips in the same group are already active.

Filters use **AND logic** across dimensions (a task must satisfy all active filter groups) and **OR logic** within a dimension (a task can match any included value in a group).

### Recurring Tasks

Enable recurrence from the metadata editor by checking **Repeats**. Choose a frequency preset (daily, every weekday, weekly on a specific day, bi-weekly, monthly, yearly) or define a custom interval.

**Fixed schedule** — Tasks appear on calendar dates regardless of when you complete them. If you miss instances, they're automatically created when the plugin loads.

**Relative** ("after completion") — The next instance spawns a set number of days/weeks after you complete the current one.

**End conditions** — Recurrence can run forever, stop after N occurrences, or end on a specific date.

**Pause / Resume** — Pause recurrence on individual tasks or globally (via settings). Paused tasks show a pause indicator and won't spawn new instances until resumed.

### Projects

Create a project from the metadata editor: click the **+** next to the Project dropdown, enter a name and a successful outcome, and save. The plugin creates a markdown file in your project folder (default: `MLW/Projects`) with YAML frontmatter.

To see a project's tasks inside the project file, add an `mlw-project-tasks` codeblock:

````
```mlw-project-tasks
```
````

Active tasks appear first (sorted by your custom order), followed by completed tasks.

### Task Reordering

In the Focus and Next Actions tabs, reorder tasks by dragging the grip handle (the dots on the left of each row). Your custom order persists across sessions.

For keyboard reordering: click a grip handle to select it, then press `Alt+Up` or `Alt+Down` to move the task. Press `Escape` to deselect.

### Codeblock Embeds

Embed live task lists in any note using fenced codeblocks:

| Codeblock | Shows |
|---|---|
| `` ```mlw-focus``` `` | Today's focus items (starred + due/overdue + starting today) |
| `` ```mlw-completed``` `` | Tasks completed today |
| `` ```mlw-project-tasks``` `` | Tasks for the project file it's embedded in |

Embedded lists update in real time as you modify tasks.

### Weekly Review

The Review tab walks you through a GTD-style weekly review with seven collapsible sections:

1. **Inbox** — How many tasks are unclarified; click to jump to the Inbox tab
2. **Stalled Projects** — Projects with no activity in the past 7 days
3. **Overdue Tasks** — Tasks past their due date, with quick actions (complete, drop, reschedule, move to next)
4. **Stale Next Actions** — Next actions untouched for 14+ days
5. **Deleted Tasks** — Orphaned tasks whose source line was removed from a note
6. **Someday / Maybe** — All someday items for periodic reconsideration
7. **Completed Since Last Review** — Everything you finished since your last review

After working through each section, click **Mark Review Complete** to timestamp your review. The ribbon icon shows a reminder dot when it's been more than 7 days since your last review.

### Nirvana Import

If you're migrating from Nirvana, run the "Import from Nirvana" command. Select your Nirvana JSON export file, choose which items to import (active tasks, completed tasks, active projects, someday projects), and map Nirvana tags to Areas of Focus. The importer creates project files and preserves contexts.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+T` | Track the current checkbox line |
| `Ctrl+Shift+Q` | Quick capture a new task |
| `Ctrl+click` | Open metadata editor from sidebar |
| `Alt+Up/Down` | Reorder tasks (when grip handle selected) |
| `Escape` | Close popover / deselect |

## Configuration

Open Settings → Mind Like Water to configure:

- **Areas of Focus** — Add, remove, reorder, and color-code your life areas
- **Project Folder** — Where project markdown files are stored (default: `MLW/Projects`)
- **Capture Location** — Quick capture to daily note or dedicated inbox file
- **Chip Display** — Full, compact, or dot mode for inline chips
- **Contexts** — Define contexts (e.g., @home, @office, @errands) for filtering
- **Data Backup** — Auto-backup data.json on load

## License

[0-BSD](LICENSE) — James Titus
