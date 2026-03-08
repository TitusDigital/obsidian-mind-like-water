import type { DataStore } from "data/DataStore";
import type { Task, TaskStatus } from "data/models";
import type { GroupMode } from "views/ViewState";

/** Context carried by a group header for pre-filling new tasks/projects. */
export interface GroupContext {
	aof?: string;
	project?: string;
	status?: TaskStatus;
	createProject?: boolean;
}

/** Group tasks by a string key. Returns sorted groups with fallback label for empty keys. */
function groupTasksBy(tasks: Task[], getKey: (t: Task) => string, fallback: string): { name: string; tasks: Task[] }[] {
	const grouped = new Map<string, Task[]>();
	for (const task of tasks) {
		const key = getKey(task) || "";
		const existing = grouped.get(key);
		if (existing !== undefined) existing.push(task);
		else grouped.set(key, [task]);
	}
	const result: { name: string; tasks: Task[] }[] = [];
	const noKey = grouped.get("");
	grouped.delete("");
	for (const [key, gt] of [...grouped].sort((a, b) => a[0].localeCompare(b[0]))) {
		gt.sort((a, b) => a.sort_order - b.sort_order);
		result.push({ name: key, tasks: gt });
	}
	if (noKey !== undefined) {
		noKey.sort((a, b) => a.sort_order - b.sort_order);
		result.push({ name: fallback, tasks: noKey });
	}
	return result;
}

/** Group tasks by AOF, respecting settings display order and colors. */
export function groupByAOF(tasks: Task[], store: DataStore): { name: string; color?: string; tasks: Task[] }[] {
	const aofOrder = store.getSettings().areasOfFocus;
	const colorMap = new Map(aofOrder.map(a => [a.name, a.color.text]));
	const orderMap = new Map(aofOrder.map((a, i) => [a.name, i]));
	const groups = groupTasksBy(tasks, t => t.area_of_focus || "", "Uncategorized");
	groups.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
	return groups.map(g => ({ ...g, color: colorMap.get(g.name) ?? "#A0A0A0" }));
}

/** Dispatch to the appropriate grouping function based on mode. */
export function groupTasks(tasks: Task[], mode: GroupMode, store: DataStore): { name: string; color?: string; tasks: Task[] }[] {
	switch (mode) {
		case "aof": return groupByAOF(tasks, store);
		case "project": return groupTasksBy(tasks, t => t.project ?? "", "No Project");
		case "context": return groupTasksBy(tasks, t => t.context ?? "", "No Context");
		case "none": return [{ name: "", tasks: [...tasks].sort((a, b) => a.sort_order - b.sort_order) }];
	}
}
