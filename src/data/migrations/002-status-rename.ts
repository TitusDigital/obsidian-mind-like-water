import type { MLWData, Task } from "data/models";
import type { Migration, MigrationContext, MigrationResult } from "./types";

/**
 * v2 schema change: rename two task statuses and add `waiting_date`.
 *
 *   - "next_action" is renamed to "active"
 *   - "completed"   is renamed to "done"
 *
 * New status values ("waiting", "archived") do not require any data rewrite —
 * they simply become valid for new tasks. Every existing task gains a
 * `waiting_date` field defaulted to `null`.
 *
 * Idempotent: tasks already on the new strings / with `waiting_date` set are
 * left alone and counted in `stats.alreadyMigrated`.
 */
const LEGACY_TO_NEW: Record<string, string> = {
	next_action: "active",
	completed: "done",
};

export const migration002StatusRename: Migration = {
	version: 2,
	name: "status-rename-and-waiting-date",
	up(data: MLWData, ctx: MigrationContext): MigrationResult {
		let statusRenamed = 0;
		let waitingDateAdded = 0;
		let alreadyMigrated = 0;
		const warnings: string[] = [];

		for (const task of Object.values(data.tasks) as Task[]) {
			const legacyStatus = task.status as unknown as string;
			const renameTo = LEGACY_TO_NEW[legacyStatus];
			const needsStatusRewrite = renameTo !== undefined;
			const needsWaitingDate =
				(task as Partial<Task>).waiting_date === undefined;

			if (!needsStatusRewrite && !needsWaitingDate) {
				alreadyMigrated++;
				continue;
			}

			if (!ctx.dryRun) {
				if (needsStatusRewrite) {
					(task as unknown as Record<string, string>).status = renameTo;
				}
				if (needsWaitingDate) {
					task.waiting_date = null;
				}
			}
			if (needsStatusRewrite) statusRenamed++;
			if (needsWaitingDate) waitingDateAdded++;
		}

		return {
			stats: { statusRenamed, waitingDateAdded, alreadyMigrated },
			warnings,
		};
	},
};
