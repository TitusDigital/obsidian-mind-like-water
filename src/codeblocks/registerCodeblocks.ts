import type { Plugin } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { EmbedRenderer, type EmbedItem } from "codeblocks/EmbedRenderer";

/** Local YYYY-MM-DD (avoids UTC date drift from toISOString). */
function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Convert a full ISO timestamp to local YYYY-MM-DD. */
function isoToLocalDate(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Register the mlw-focus codeblock processor. */
export function registerFocusBlock(plugin: Plugin, store: DataStore): void {
	plugin.registerMarkdownCodeBlockProcessor("mlw-focus", (_source, el, ctx) => {
		const renderer = new EmbedRenderer(
			el,
			plugin.app,
			store,
			() => buildFocusItems(store),
			"Nothing on your focus list today.",
		);
		renderer.start();
		ctx.addChild(renderer);
	});
}

/** Register the mlw-completed codeblock processor. */
export function registerCompletedBlock(plugin: Plugin, store: DataStore): void {
	plugin.registerMarkdownCodeBlockProcessor("mlw-completed", (_source, el, ctx) => {
		const renderer = new EmbedRenderer(
			el,
			plugin.app,
			store,
			() => buildCompletedTodayItems(store),
			"No tasks completed today.",
		);
		renderer.start();
		ctx.addChild(renderer);
	});
}

function buildFocusItems(store: DataStore): EmbedItem[] {
	const today = localToday();
	const result: EmbedItem[] = [];

	for (const task of store.getAllTasks()) {
		if (task.status === TaskStatus.Completed || task.status === TaskStatus.Dropped) continue;
		const badges: string[] = [];
		if (task.starred) badges.push("\u2B50 Starred");
		if (task.due_date !== null && task.due_date <= today) {
			badges.push(task.due_date < today ? "\uD83D\uDCC5 Overdue" : "\uD83D\uDCC5 Due today");
		}
		if (task.start_date !== null && task.start_date === today && task.status === TaskStatus.NextAction) {
			badges.push("\uD83D\uDDD3\uFE0F Start today");
		}
		if (badges.length > 0) result.push({ task, badges });
	}

	result.sort((a, b) => {
		const sa = a.task.starred ? 0 : 1;
		const sb = b.task.starred ? 0 : 1;
		if (sa !== sb) return sa - sb;
		const da = a.task.due_date ?? "\uffff";
		const db = b.task.due_date ?? "\uffff";
		return da.localeCompare(db);
	});

	return result;
}

function buildCompletedTodayItems(store: DataStore): EmbedItem[] {
	const today = localToday();
	return store.getTasksByStatus(TaskStatus.Completed)
		.filter(t => t.completed_date !== null && isoToLocalDate(t.completed_date) === today)
		.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""))
		.map(t => ({ task: t, badges: [] }));
}
