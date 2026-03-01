import { type Plugin, TFile } from "obsidian";
import type { App } from "obsidian";
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

/** Register the mlw-project-tasks codeblock processor. */
export function registerProjectTasksBlock(plugin: Plugin, store: DataStore): void {
	plugin.registerMarkdownCodeBlockProcessor("mlw-project-tasks", (_source, el, ctx) => {
		const title = getProjectTitle(plugin.app, ctx.sourcePath);
		const renderer = new EmbedRenderer(
			el, plugin.app, store,
			() => buildProjectItems(store, title),
			"No tasks assigned to this project.",
		);
		renderer.start();
		ctx.addChild(renderer);
	});
}

function getProjectTitle(app: App, sourcePath: string): string {
	const file = app.vault.getAbstractFileByPath(sourcePath);
	if (!(file instanceof TFile)) return "";
	const cache = app.metadataCache.getFileCache(file);
	return String(cache?.frontmatter?.title ?? file.basename);
}

function buildProjectItems(store: DataStore, projectTitle: string): EmbedItem[] {
	if (projectTitle === "") return [];
	const tasks = store.getAllTasks().filter(t => t.project === projectTitle);
	const active: EmbedItem[] = [];
	const completed: EmbedItem[] = [];
	for (const task of tasks) {
		if (task.status === TaskStatus.Completed || task.status === TaskStatus.Dropped) {
			completed.push({ task, badges: [] });
		} else {
			const badges: string[] = [];
			if (task.due_date !== null) badges.push(task.due_date);
			if (task.status !== TaskStatus.NextAction) badges.push(task.status);
			active.push({ task, badges });
		}
	}
	active.sort((a, b) => a.task.sort_order - b.task.sort_order);
	completed.sort((a, b) => (b.task.completed_date ?? "").localeCompare(a.task.completed_date ?? ""));
	return [...active, ...completed];
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
