import type { Migration } from "./types";
import { migration001RecurrenceDefaults } from "./001-recurrence-defaults";
import { migration002StatusRename } from "./002-status-rename";
import { migration003Tags } from "./003-tags";

/**
 * Registry of every schema migration, in ascending version order.
 *
 * To add a migration:
 *   1. Create `NNN-short-name.ts` in this folder exporting a `Migration` with
 *      `version: NNN` (one greater than the highest existing version).
 *   2. Append it to this array.
 *   3. Bump `DATA_VERSION` in `data/models.ts` to match.
 *   4. Add a matching test file.
 *
 * Do NOT reorder or renumber existing entries — users' data.json tracks `dataVersion`
 * against these numbers, so changing them causes migrations to re-run or be skipped.
 */
export const ALL_MIGRATIONS: readonly Migration[] = [
	migration001RecurrenceDefaults,
	migration002StatusRename,
	migration003Tags,
];

export { runMigrations, formatRunSummary } from "./runner";
export type {
	Migration,
	MigrationContext,
	MigrationResult,
	MigrationRunEntry,
	MigrationRunSummary,
} from "./types";
