import type { App, Plugin } from "obsidian";
import type { MLWData } from "data/models";

/** Runtime context handed to every migration. */
export interface MigrationContext {
	app: App;
	plugin: Plugin;
	/** When true, migrations compute what they would do but must not mutate `data` or vault files. */
	dryRun: boolean;
}

/** Outcome of a single migration's `up()` call. */
export interface MigrationResult {
	/** Named counters for reporting (e.g. `{ tasksUpdated: 47 }`). */
	stats: Record<string, number>;
	/** Per-record notes the user should see in the console (e.g. skipped items). */
	warnings: string[];
}

/**
 * One schema change. Each migration has a unique, monotonically increasing
 * `version` and runs at most once per data.json (tracked via `data.dataVersion`).
 *
 * Rules:
 *   - `up` must be idempotent against already-migrated data (defensive re-run = no-op).
 *   - `up` must respect `ctx.dryRun`: compute results but do not persist anything.
 *   - `version` must equal its position in the registered list (no gaps, no re-use).
 */
export interface Migration {
	version: number;
	name: string;
	up(data: MLWData, ctx: MigrationContext): Promise<MigrationResult> | MigrationResult;
}

/** Per-migration summary used for reporting and tests. */
export interface MigrationRunEntry {
	version: number;
	name: string;
	result: MigrationResult;
}

/** What a full run produced. */
export interface MigrationRunSummary {
	fromVersion: number;
	toVersion: number;
	dryRun: boolean;
	entries: MigrationRunEntry[];
}
