import { type App, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { ProjectStatus, type ProjectMeta, type Task, TaskStatus } from "data/models";
import { readAllProjects, updateProjectStatus } from "data/ProjectReader";
import { ViewState } from "views/ViewState";

interface ProjectCard {
	project: ProjectMeta;
	totalTasks: number;
	completedTasks: number;
	staleDays: number;
}

interface CardGroup {
	name: string;
	color: string | undefined;
	cards: ProjectCard[];
}

/** Render project cards grouped by AOF into the given container. */
export function renderProjects(listEl: HTMLElement, store: DataStore, app: App): void {
	const settings = store.getSettings();
	const projects = readAllProjects(app, settings.projectFolder);

	const activeAOF = ViewState.getInstance().getActiveAOF();
	const filtered = projects.filter(p => {
		if (p.status !== ProjectStatus.Active) return false;
		if (activeAOF !== "" && p.area_of_focus !== activeAOF) return false;
		return true;
	});

	if (filtered.length === 0) {
		const empty = listEl.createDiv("mlw-view-empty");
		empty.createEl("p", { text: "No active projects." });
		empty.createEl("p", { text: "Create a project from the metadata editor.", cls: "mlw-view-empty__hint" });
		return;
	}

	const allTasks = store.getAllTasks();
	const cards = filtered.map(p => buildCard(p, allTasks));
	const groups = groupCardsByAOF(cards, settings.areasOfFocus);

	for (const group of groups) {
		const header = listEl.createDiv("mlw-view-group");
		if (group.color !== undefined) {
			const dot = header.createSpan("mlw-view-group__dot");
			dot.style.background = group.color;
		}
		header.createSpan({ text: group.name, cls: "mlw-view-group__name" });
		for (const card of group.cards) renderCard(listEl, card, app);
	}
}

function buildCard(project: ProjectMeta, allTasks: Task[]): ProjectCard {
	const projectTasks = allTasks.filter(t => t.project === project.title);
	const completedTasks = projectTasks.filter(t => t.status === TaskStatus.Completed).length;
	const staleDays = computeStaleDays(project, projectTasks);
	return { project, totalTasks: projectTasks.length, completedTasks, staleDays };
}

function computeStaleDays(project: ProjectMeta, tasks: Task[]): number {
	let mostRecent = project.modified;
	for (const t of tasks) {
		if (t.modified > mostRecent) mostRecent = t.modified;
	}
	const ms = Date.now() - new Date(mostRecent).getTime();
	return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function renderCard(listEl: HTMLElement, card: ProjectCard, app: App): void {
	const { project, totalTasks, completedTasks, staleDays } = card;
	const el = listEl.createDiv("mlw-project-card");

	// Title row
	const titleRow = el.createDiv("mlw-project-card__title-row");
	titleRow.createSpan({ text: project.title, cls: "mlw-project-card__title" });
	if (staleDays > 7) {
		titleRow.createSpan({ text: `${staleDays}d stale`, cls: "mlw-project-card__stale" });
	}

	// Outcome (truncated via CSS)
	if (project.successful_outcome) {
		el.createDiv({ text: project.successful_outcome, cls: "mlw-project-card__outcome" });
	}

	// Footer: task count + status dropdown
	const footer = el.createDiv("mlw-project-card__footer");
	footer.createSpan({ text: `${completedTasks}/${totalTasks} tasks`, cls: "mlw-project-card__count" });

	const select = footer.createEl("select", { cls: "mlw-project-card__status" });
	for (const s of [ProjectStatus.Active, ProjectStatus.OnHold, ProjectStatus.Completed, ProjectStatus.Dropped]) {
		const label = s === "active" ? "Active" : s === "on_hold" ? "On Hold" : s === "completed" ? "Completed" : "Dropped";
		select.createEl("option", { text: label, value: s }).value = s;
	}
	select.value = project.status;
	select.addEventListener("change", (e) => {
		e.stopPropagation();
		void updateProjectStatus(app, project.filePath, select.value as ProjectStatus);
	});
	select.addEventListener("click", (e) => e.stopPropagation());

	// Click card → open file
	el.addEventListener("click", () => {
		const file = app.vault.getAbstractFileByPath(project.filePath);
		if (file instanceof TFile) void app.workspace.getLeaf(false).openFile(file);
	});
}

function groupCardsByAOF(
	cards: ProjectCard[],
	aofOrder: { name: string; color: { text: string } }[],
): CardGroup[] {
	const grouped = new Map<string, ProjectCard[]>();
	for (const card of cards) {
		const key = card.project.area_of_focus || "";
		const existing = grouped.get(key);
		if (existing !== undefined) existing.push(card);
		else grouped.set(key, [card]);
	}

	const result: CardGroup[] = [];
	for (const aof of aofOrder) {
		const groupCards = grouped.get(aof.name);
		if (groupCards !== undefined) {
			result.push({ name: aof.name, color: aof.color.text, cards: groupCards });
			grouped.delete(aof.name);
		}
	}
	for (const [key, groupCards] of grouped) {
		result.push({ name: key || "Uncategorized", color: undefined, cards: groupCards });
	}
	return result;
}
