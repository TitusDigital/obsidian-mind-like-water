import type { Migration } from "./types";
import { migration001RecurrenceDefaults } from "./001-recurrence-defaults";
import { migration002StatusRename } from "./002-status-rename";
import { migration003Tags } from "./003-tags";
import { migration004UuidIds } from "./004-uuid-ids";

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
/**
 * Migrations that run automatically at plugin load. These only touch
 * `data.json` and are safe to auto-apply on every user on upgrade.
 */
export const ALL_MIGRATIONS: readonly Migration[] = [
	migration001RecurrenceDefaults,
	migration002StatusRename,
	migration003Tags,
];

/**
 * Migrations that rewrite files in the user's vault. These NEVER auto-run —
 * each is invoked via its own user-gated command (see main.ts). The ordering
 * within this list is still significant; a later migration may depend on an
 * earlier one having run.
 */
export const VAULT_MIGRATIONS: readonly Migration[] = [
	migration004UuidIds,
];

export { runMigrations, formatRunSummary } from "./runner";
export type {
	Migration,
	MigrationContext,
	MigrationResult,
	MigrationRunEntry,
	MigrationRunSummary,
} from "./types";
