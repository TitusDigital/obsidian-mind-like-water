# Mind Like Water

GTD-powered task management for [Obsidian](https://obsidian.md). Track tasks inline, organize by Areas of Focus, manage projects, and run weekly reviews — all without leaving your vault.

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
