import type { MLWData } from "data/models";
import type { Migration, MigrationContext, MigrationResult } from "./types";

/**
 * Formalization of the ad-hoc recurrence-field defaulting that previously lived
 * in `DataStore.load()`. Sets missing recurrence fields to their neutral defaults.
 *
 * For any user whose data.json was saved by a plugin version that already ran the
 * old defaulting block, this is a no-op (all fields are already populated).
 */
export const migration001RecurrenceDefaults: Migration = {
	version: 1,
	name: "recurrence-field-defaults",
	up(data: MLWData, ctx: MigrationContext): MigrationResult {
		let updated = 0;
		for (const task of Object.values(data.tasks)) {
			const needsUpdate =
				task.recurrence_type === undefined ||
				task.recurrence_template_id === undefined ||
				task.recurrence_suspended === undefined ||
				task.recurrence_spawn_count === undefined;
			if (!needsUpdate) continue;
			if (!ctx.dryRun) {
				task.recurrence_type ??= null;
				task.recurrence_template_id ??= null;
				task.recurrence_suspended ??= false;
				task.recurrence_spawn_count ??= 0;
			}
			updated++;
		}
		return { stats: { tasksUpdated: updated }, warnings: [] };
	},
};
