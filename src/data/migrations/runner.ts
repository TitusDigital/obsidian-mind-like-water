import type { MLWData } from "data/models";
import type { Migration, MigrationContext, MigrationRunEntry, MigrationRunSummary } from "./types";

/**
 * Run every migration whose version is greater than `data.dataVersion`, in order.
 *
 * On dry-run, `data` is NOT mutated: the runner works against a deep clone so callers
 * can report what would happen without persisting anything.
 *
 * Throws if `data.dataVersion` is higher than any registered migration (plugin downgrade).
 */
export async function runMigrations(
	data: MLWData,
	ctx: MigrationContext,
	migrations: readonly Migration[],
): Promise<MigrationRunSummary> {
	assertVersionsValid(migrations);

	const fromVersion = data.dataVersion ?? 0;
	const latest = migrations.length > 0
		? Math.max(...migrations.map(m => m.version))
		: fromVersion;

	if (fromVersion > latest) {
		throw new Error(
			`MLW: data.json version ${fromVersion} is newer than this plugin supports (${latest}). ` +
			`Did you downgrade the plugin? Update to the newer version or restore data.json.bak.`
		);
	}

	const pending = migrations
		.filter(m => m.version > fromVersion)
		.sort((a, b) => a.version - b.version);

	const target = ctx.dryRun ? structuredClone(data) : data;
	const entries: MigrationRunEntry[] = [];

	for (const m of pending) {
		const result = await m.up(target, ctx);
		entries.push({ version: m.version, name: m.name, result });
		if (!ctx.dryRun) {
			target.dataVersion = m.version;
		}
	}

	return {
		fromVersion,
		toVersion: ctx.dryRun ? fromVersion : (pending[pending.length - 1]?.version ?? fromVersion),
		dryRun: ctx.dryRun,
		entries,
	};
}

/** Guard against accidentally-duplicated or non-monotonic version numbers. */
function assertVersionsValid(migrations: readonly Migration[]): void {
	const seen = new Set<number>();
	let lastVersion = 0;
	for (const m of migrations) {
		if (m.version <= 0) {
			throw new Error(`MLW migration "${m.name}" has invalid version ${m.version} (must be >= 1).`);
		}
		if (seen.has(m.version)) {
			throw new Error(`MLW migration version ${m.version} is registered twice.`);
		}
		if (m.version <= lastVersion) {
			throw new Error(
				`MLW migrations must be registered in ascending order. ` +
				`Got version ${m.version} after ${lastVersion}.`
			);
		}
		seen.add(m.version);
		lastVersion = m.version;
	}
}

/** Build a short, human-readable report line for use in Notices / console logs. */
export function formatRunSummary(summary: MigrationRunSummary): string {
	if (summary.entries.length === 0) return "No migrations to run.";
	const prefix = summary.dryRun ? "[DRY RUN] " : "";
	const names = summary.entries.map(e => `#${e.version} ${e.name}`).join(", ");
	return `${prefix}Ran ${summary.entries.length} migration(s): ${names} ` +
		`(v${summary.fromVersion} \u2192 v${summary.toVersion}).`;
}
