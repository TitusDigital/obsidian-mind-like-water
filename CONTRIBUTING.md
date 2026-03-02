# Contributing to Mind Like Water

## Development Setup

```bash
git clone https://github.com/TitusDigital/obsidian-mind-like-water.git
cd obsidian-mind-like-water
npm install
npm run dev     # watch mode — rebuilds on file changes
```

Copy build artifacts to your test vault:
```bash
cp main.js styles.css manifest.json /path/to/vault/.obsidian/plugins/mind-like-water/
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Build in watch mode |
| `npm run build` | Run tests + type check + production build |
| `npm test` | Run tests only (vitest) |
| `npm run lint` | Lint with ESLint |

## Architecture

- **DataStore** (`src/data/DataStore.ts`) — Central data layer. All task CRUD goes through here. Debounced saves to `data.json`.
- **Models** (`src/data/models.ts`) — TypeScript types, enums, and defaults.
- **Editor Extensions** (`src/editor/`) — CM6 decorations (chips, track button), checkbox watcher.
- **Views** (`src/views/`) — `BaseTaskView` abstract class, `UnifiedTaskView` with tab delegation.
- **Components** (`src/components/`) — MetadataEditor, CalendarPicker, FilterBar, TaskReorder, RecurrenceFields.
- **Services** (`src/services/`) — RecurrenceService, SchedulerService, IntegrityChecker.
- **Capture** (`src/capture/`) — Quick capture modal and daily note resolution.

## Coding Standards

- **300-line file limit** — Split files that approach this limit.
- **Obsidian CSS variables** — Use `var(--text-normal)`, `var(--interactive-accent)`, etc. No hardcoded colors.
- **No `any`** — Use typed interfaces or `unknown` with type guards. Test mocks are an exception.
- **Strict null checks** — `noUncheckedIndexedAccess` is enabled. Handle `undefined` from array/object access.
- **Error handling** — Wrap vault operations and RRULE parsing in try/catch. Show `Notice` for user-facing errors, `console.error` for internal ones.

## PR Checklist

- [ ] `npm run build` passes (tests + types + bundle)
- [ ] No files over 300 lines (`wc -l src/**/*.ts`)
- [ ] New features include tests
- [ ] CSS uses Obsidian variables (no hardcoded colors)
- [ ] Aria labels on interactive elements

## Releasing

1. Update version in `package.json`
2. Run `npm version patch` (or `minor`/`major`) — auto-bumps `manifest.json` and `versions.json`
3. Push the tag: `git push origin v1.0.1`
4. GitHub Actions builds and creates a release with `main.js`, `manifest.json`, `styles.css`
