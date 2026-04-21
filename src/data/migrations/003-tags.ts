import type { MLWData, Task } from "data/models";
import { TaskStatus } from "data/models";
import type { Migration, MigrationContext, MigrationResult } from "./types";

/**
 * v3 schema change: introduce `tags: string[]` on every task.
 *
 * For each task:
 *   - If `tags` is already present, leave it alone.
 *   - Else seed `tags = []`.
 *   - If the legacy `context` field is non-empty, strip a leading `@` or `#`
 *     and move the result into `tags`. Special case: if the normalized value
 *     is "waiting", promote the task's status to `TaskStatus.Waiting` with
 *     `waiting_date` set to `task.modified` as a best-effort fallback. Do NOT
 *     tag the task with "waiting".
 *
 * `context` is NOT cleared — it remains as a deprecated back-compat field and
 * is removed in a later migration once all read sites have moved to `tags`.
 */
export const migration003Tags: Migration = {
	version: 3,
	name: "tags-from-context",
	up(data: MLWData, ctx: MigrationContext): MigrationResult {
		let tagsMigrated = 0;
		let promotedToWaiting = 0;
		let waitingDateEstimated = 0;
		let alreadyMigrated = 0;
		const warnings: string[] = [];

		for (const task of Object.values(data.tasks) as Task[]) {
			const hasTags = Array.isArray((task as Partial<Task>).tags);

			if (hasTags) {
				alreadyMigrated++;
				continue;
			}

			const rawContext = (task.context ?? "").trim();
			const stripped = rawContext.replace(/^[@#]/, "").trim().toLowerCase();

			if (!ctx.dryRun) task.tags = [];

			if (stripped === "") {
				// No context to migrate.
				continue;
			}

			if (stripped === "waiting") {
				// Special case: promote to Waiting status instead of tagging.
				if (!ctx.dryRun) {
					if (task.status !== TaskStatus.Waiting) {
						task.status = TaskStatus.Waiting;
						if (task.waiting_date === null || task.waiting_date === undefined) {
							task.waiting_date = task.modified;
							waitingDateEstimated++;
						}
					}
				}
				promotedToWaiting++;
				continue;
			}

			// Preserve the original prefix on the tag string — that's how we
			// encode category intent (`@` = person/place, `#` = context/topic).
			if (!ctx.dryRun) task.tags.push(rawContext);
			tagsMigrated++;
		}

		if (waitingDateEstimated > 0) {
			warnings.push(
				`${waitingDateEstimated} task(s) promoted to Waiting used task.modified ` +
				`as a best-effort waiting_date. Review under the Waiting view.`
			);
		}

		return {
			stats: { tagsMigrated, promotedToWaiting, waitingDateEstimated, alreadyMigrated },
			warnings,
		};
	},
};
