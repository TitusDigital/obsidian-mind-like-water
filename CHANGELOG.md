# Changelog

All notable changes to Mind Like Water will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] - 2026-03-01

### Added
- Inline task tracking with `Ctrl+Shift+T` and colored editor chips
- Quick capture modal (`Ctrl+Shift+Q`) with daily note or inbox file target
- Unified sidebar view with 7 tabs: Focus, Next Actions, Scheduled, Someday, Projects, Completed, Review
- Areas of Focus with color-coded chips, per-area filtering, and settings management
- Project management with YAML frontmatter, outcome tracking, and in-editor creation
- Recurring tasks: fixed-schedule and relative recurrence with RRULE support
- Recurrence pause/resume (per-task and global), end conditions (count, until), history modal
- Calendar date picker for start and due dates
- Task reordering via drag-and-drop and keyboard (Alt+Arrow keys)
- Three-state filter chips (off/include/exclude) for energy, context, and area
- Metadata editor popover with all task fields (opens from chip click or Ctrl+click in sidebar)
- Automatic scheduler: transitions scheduled tasks to Next Actions when start date arrives
- Data integrity checker with orphan detection and AOF repair
- Weekly review tab with 7 sections and review reminder badge
- Codeblock embeds: `mlw-focus`, `mlw-completed`, `mlw-project-tasks`
- Checkbox watcher: syncs checkbox state changes to DataStore
- Status bar widget showing inbox count
- Ribbon icon with inbox count badge and review reminder indicator
- Nirvana import with project creation, area mapping, and context auto-detection
- Settings tab with full configuration UI
- GitHub Actions CI (lint + build) and release workflow
