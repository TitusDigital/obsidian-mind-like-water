import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";

/**
 * On vault load, transition scheduled tasks whose start_date has arrived
 * to next_action status. Returns the count of transitioned tasks.
 */
export function runScheduler(store: DataStore): number {
	if (!store.getSettings().autoTransitionScheduled) return 0;

	const d = new Date();
	const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	const scheduled = store.getTasksByStatus(TaskStatus.Scheduled);
	let count = 0;

	for (const task of scheduled) {
		if (task.start_date !== null && task.start_date <= today) {
			store.updateTask(task.id, { status: TaskStatus.NextAction });
			count++;
		}
	}

	return count;
}
