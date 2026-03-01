import { type App, TFile, Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, ProjectStatus, type Task } from "data/models";
import { readAllProjects } from "data/ProjectReader";
import type { IntegrityReport } from "services/IntegrityChecker";

const CHECKBOX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
const MLW_COMMENT_RE = /\s*<!-- mlw:[a-z0-9]{6} -->/;

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysSince(iso: string): number {
	return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

/** Render the periodic review dashboard with 7 collapsible sections. */
export function renderReview(
	listEl: HTMLElement, store: DataStore, app: App,
	report: IntegrityReport | null,
	onSwitchTab: (tabId: string) => void,
): void {
	const settings = store.getSettings();
	const allTasks = store.getAllTasks();
	const today = localToday();

	// 1. Inbox count
	const inboxCount = store.getTaskCountByStatus(TaskStatus.Inbox);
	renderSection(listEl, "Inbox", inboxCount, (body) => {
		if (inboxCount === 0) { body.createDiv({ text: "All clear!", cls: "mlw-review-section__empty" }); return; }
		const link = body.createDiv({ cls: "mlw-review-section__link" });
		link.textContent = `You have ${inboxCount} unclarified item${inboxCount > 1 ? "s" : ""}`;
		link.addEventListener("click", () => onSwitchTab("inbox"));
	});

	// 2. Stalled projects
	const projects = readAllProjects(app, settings.projectFolder)
		.filter(p => p.status === ProjectStatus.Active);
	const stalled = projects.filter(p => {
		let mostRecent = p.modified;
		for (const t of allTasks) {
			if (t.project === p.title && t.modified > mostRecent) mostRecent = t.modified;
		}
		return daysSince(mostRecent) > 7;
	});
	renderSection(listEl, "Stalled Projects", stalled.length, (body) => {
		if (stalled.length === 0) { body.createDiv({ text: "All projects active.", cls: "mlw-review-section__empty" }); return; }
		for (const p of stalled) {
			const row = body.createDiv("mlw-view-item");
			row.createDiv({ text: p.title, cls: "mlw-view-item__text" });
			let mostRecent = p.modified;
			for (const t of allTasks) {
				if (t.project === p.title && t.modified > mostRecent) mostRecent = t.modified;
			}
			row.createSpan({ text: `${daysSince(mostRecent)}d stale`, cls: "mlw-project-card__stale" });
			row.addEventListener("click", () => {
				const file = app.vault.getAbstractFileByPath(p.filePath);
				if (file instanceof TFile) void app.workspace.getLeaf(false).openFile(file);
			});
		}
	});

	// 3. Overdue tasks
	const overdue = allTasks.filter(t =>
		t.status !== TaskStatus.Completed && t.status !== TaskStatus.Dropped &&
		t.due_date !== null && t.due_date < today,
	);
	renderSection(listEl, "Overdue Tasks", overdue.length, (body) => {
		if (overdue.length === 0) { body.createDiv({ text: "No overdue tasks.", cls: "mlw-review-section__empty" }); return; }
		for (const task of overdue) renderReviewTaskRow(body, task, store, app);
	});

	// 4. Stale next actions (untouched 14+ days)
	const staleActions = store.getTasksByStatus(TaskStatus.NextAction)
		.filter(t => daysSince(t.modified) >= 14);
	renderSection(listEl, "Stale Next Actions", staleActions.length, (body) => {
		if (staleActions.length === 0) { body.createDiv({ text: "All next actions are fresh.", cls: "mlw-review-section__empty" }); return; }
		for (const task of staleActions) renderReviewTaskRow(body, task, store, app);
	});

	// 5. Deleted tasks (orphans — source note/line was removed)
	const orphans = (report?.orphanedTasks ?? []).filter(t => store.getTask(t.id) !== undefined);
	renderSection(listEl, "Deleted Tasks", orphans.length, (body) => {
		if (orphans.length === 0) { body.createDiv({ text: "No deleted tasks.", cls: "mlw-review-section__empty" }); return; }
		body.createDiv({
			text: "These tasks were in notes that have been deleted or modified. Move them to keep working on them, or delete them.",
			cls: "mlw-review-section__hint",
		});
		for (const task of orphans) {
			const row = body.createDiv("mlw-view-item");
			const label = task.cached_text ?? `Task in ${shortenPath(task.source_file)}`;
			row.createDiv({ text: label, cls: "mlw-view-item__text" });
			const meta: string[] = [];
			if (task.area_of_focus) meta.push(task.area_of_focus);
			if (task.project !== null) meta.push(task.project);
			if (meta.length > 0) {
				const metaEl = row.createDiv("mlw-view-item__meta");
				for (const m of meta) metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
			}
			const select = row.createEl("select", { cls: "mlw-review-action-select" });
			for (const [val, lbl] of [["", "---"], ["inbox", "Move to Inbox"], ["next", "Move to Next"], ["drop", "Drop"], ["delete", "Delete"]] as const) {
				select.createEl("option", { text: lbl, value: val }).value = val;
			}
			select.addEventListener("change", (e) => {
				e.stopPropagation();
				switch (select.value) {
					case "inbox": store.updateTask(task.id, { status: TaskStatus.Inbox }); break;
					case "next": store.updateTask(task.id, { status: TaskStatus.NextAction }); break;
					case "drop": store.updateTask(task.id, { status: TaskStatus.Dropped }); break;
					case "delete": store.deleteTask(task.id); break;
				}
			});
			select.addEventListener("click", (e) => e.stopPropagation());
		}
	});

	// 6. Someday review
	const someday = store.getTasksByStatus(TaskStatus.Someday);
	renderSection(listEl, "Someday / Maybe", someday.length, (body) => {
		if (someday.length === 0) { body.createDiv({ text: "No someday items.", cls: "mlw-review-section__empty" }); return; }
		for (const task of someday) renderReviewTaskRow(body, task, store, app);
	});

	// 7. Completed since last review
	const cutoff = settings.lastReviewDate ?? "";
	const completedSince = store.getTasksByStatus(TaskStatus.Completed)
		.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
		.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
	renderSection(listEl, "Completed Since Last Review", completedSince.length, (body) => {
		if (completedSince.length === 0) { body.createDiv({ text: "No completions yet.", cls: "mlw-review-section__empty" }); return; }
		for (const task of completedSince) {
			const row = body.createDiv("mlw-view-item mlw-view-item--completed");
			void readTaskText(app, task).then(text => row.createDiv({ text, cls: "mlw-view-item__text" }));
		}
	});

	// Mark Review Complete button
	const btn = listEl.createEl("button", { text: "Mark Review Complete", cls: "mlw-review-complete-btn" });
	btn.addEventListener("click", () => {
		store.updateSettings({ lastReviewDate: new Date().toISOString() });
		btn.textContent = "Review Complete!";
		btn.addClass("mlw-review-complete-btn--done");
		btn.disabled = true;
		new Notice("Weekly review marked complete.");
	});
}

function renderSection(
	parent: HTMLElement, title: string, count: number,
	renderBody: (body: HTMLElement) => void,
): void {
	const details = parent.createEl("details", { cls: "mlw-review-section" });
	if (count > 0) details.setAttribute("open", "");
	const summary = details.createEl("summary", { cls: "mlw-review-section__header" });
	summary.createSpan({ text: title, cls: "mlw-review-section__title" });
	summary.createSpan({ text: String(count), cls: "mlw-review-section__count" });
	const body = details.createDiv("mlw-review-section__body");
	renderBody(body);
}

function renderReviewTaskRow(parent: HTMLElement, task: Task, store: DataStore, app: App): void {
	const row = parent.createDiv("mlw-view-item");
	void readTaskText(app, task).then(text => row.createDiv({ text, cls: "mlw-view-item__text" }));

	const select = row.createEl("select", { cls: "mlw-review-action-select" });
	for (const [val, label] of [["", "---"], ["complete", "Complete"], ["drop", "Drop"], ["next", "Move to Next"], ["schedule", "Reschedule"]] as const) {
		select.createEl("option", { text: label, value: val }).value = val;
	}
	select.addEventListener("change", (e) => {
		e.stopPropagation();
		switch (select.value) {
			case "complete": store.completeTask(task.id); break;
			case "drop": store.updateTask(task.id, { status: TaskStatus.Dropped }); break;
			case "next": store.updateTask(task.id, { status: TaskStatus.NextAction }); break;
			case "schedule": store.updateTask(task.id, { status: TaskStatus.Scheduled }); break;
		}
	});
	select.addEventListener("click", (e) => e.stopPropagation());

	row.addEventListener("click", () => {
		const file = app.vault.getAbstractFileByPath(task.source_file);
		if (file instanceof TFile) {
			void app.workspace.getLeaf(false).openFile(file, { eState: { line: task.source_line - 1 } });
		}
	});
}

async function readTaskText(app: App, task: Task): Promise<string> {
	const file = app.vault.getAbstractFileByPath(task.source_file);
	if (!(file instanceof TFile)) return `Task ${task.id}`;
	const content = await app.vault.cachedRead(file);
	const line = content.split("\n")[task.source_line - 1];
	if (line === undefined) return `Task ${task.id}`;
	const cleaned = line.replace(CHECKBOX_RE, "").replace(MLW_COMMENT_RE, "").trim();
	return cleaned || `Task ${task.id}`;
}

function shortenPath(path: string): string {
	return path.split("/").pop()?.replace(".md", "") ?? path;
}
