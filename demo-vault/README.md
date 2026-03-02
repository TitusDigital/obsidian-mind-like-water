# Mind Like Water — Demo Vault

A pre-populated Obsidian vault for demos and screenshots of the Mind Like Water plugin.

## Persona

**Sarah Chen** — Engineering manager at a SaaS company, mother of three (Emma 14, Jake 11, Lily 5).
Juggling a busy tech career, three kids with active school lives, family finances, and social travel plans.

## Contents

### Areas of Focus (5)
| Area | Color | Projects |
|------|-------|----------|
| Work | Blue | 8 projects |
| Family | Purple | 6 projects |
| Finance | Orange | 3 projects |
| Travel | Teal | 3 projects |
| Personal | Green | — |

### Tasks (150 total)
- **5** Inbox — freshly captured, unprocessed
- **81** Next Actions — across all areas, with contexts and energy levels
- **18** Scheduled — with start dates and due dates spread across March–November 2026
- **24** Someday/Maybe — aspirational items and parked ideas
- **22** Completed — visible history

### Projects (20)
Eight work projects, six family projects, three finance projects, three travel projects.

### Recurring Tasks (4)
- Weekly team standup prep (every Monday)
- Monthly financial check-in (1st of month)
- Weekly GTD review (every Friday) ⭐
- Monthly 1-on-1 with manager (monthly)

## Setup

1. Install the **Mind Like Water** plugin in Obsidian
2. Open this folder as an Obsidian vault
3. Copy `data.json` into `.obsidian/plugins/mind-like-water/data.json`
4. Reload the plugin (disable → enable in Community Plugins)

The plugin will pick up all 150 pre-configured tasks and their metadata immediately.

## Notes

- **Last review date** is set to 2026-02-22 (8 days ago) so the review badge shows in the ribbon
- **Completed visibility** is set to 30 days so all completed tasks are visible
- Tasks in `Daily Notes/2026-03-02.md` serve as today's inbox captures and a few completed items
- `Someday.md` and `Recurring.md` hold tasks that don't belong to a specific project
- All project files are in `MLW/Projects/` with proper `mlw_type: project` frontmatter

## Regenerating data.json

If you edit the markdown files and need to update task metadata, edit `generate-data.cjs` and run:

```bash
node generate-data.cjs
```

Then copy the output `data.json` into `.obsidian/plugins/mind-like-water/data.json`.
