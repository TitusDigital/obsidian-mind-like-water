import { normalizePath, type App } from "obsidian";
import type { DataStore } from "data/DataStore";
import { deriveAOFColor } from "data/models";
import { NirvanaType, NirvanaState, type NirvanaItem, type ImportOptions, type ImportResult, type ImportProgress } from "./nirvanaTypes";
import { mapTags, extractOutcome, mapTimestamp, prepareTask } from "./nirvanaMapper";

const INVALID_CHARS = /[\\/:*?"<>|]/g;

function sanitizeName(name: string): string {
	return name.replace(INVALID_CHARS, "-").replace(/\s+/g, " ").trim().slice(0, 100);
}

interface ProjectInfo {
	nirvanaId: string;
	title: string;
	filePath: string;
}

/** Run the full Nirvana → Mind Like Water import. */
export async function runNirvanaImport(
	app: App,
	store: DataStore,
	items: NirvanaItem[],
	options: ImportOptions,
	onProgress: (p: ImportProgress) => void,
): Promise<ImportResult> {
	const result: ImportResult = { projectsCreated: 0, tasksImported: 0, tasksSkipped: 0, errors: [] };
	const settings = store.getSettings();
	const aofNames = settings.areasOfFocus.map(a => a.name);
	const projectFolder = normalizePath(settings.projectFolder);

	// ── Phase 0: Create AOFs from user-selected area tags ────────
	const existingAOFs = new Set(aofNames.map(n => n.toLowerCase()));
	const newAOFs = (options.selectedAreaTags ?? []).filter(t => !existingAOFs.has(t.toLowerCase()));
	if (newAOFs.length > 0) {
		const defaultColors = ["#6CB6FF", "#C5A3E6", "#7FCA8F", "#E6A86C", "#E66C8F", "#8FC5E6", "#C5E68F", "#E6C56C", "#6CE6C5", "#B88FE6"];
		const updatedAOFs = [...settings.areasOfFocus];
		for (let i = 0; i < newAOFs.length; i++) {
			const colorHex = defaultColors[i % defaultColors.length]!;
			updatedAOFs.push({ name: newAOFs[i]!, sort_order: updatedAOFs.length, color: deriveAOFColor(colorHex) });
		}
		store.updateSettings({ areasOfFocus: updatedAOFs });
		aofNames.push(...newAOFs);
	}

	// ── Phase 1: Create project files ────────────────────────────
	const projectMap = new Map<string, ProjectInfo>();
	const projects = items.filter(i => {
		if (i.type !== NirvanaType.Project) return false;
		if (i.state === NirvanaState.ActiveProject) return options.importActiveProjects;
		if (i.state === NirvanaState.Someday || i.state === NirvanaState.Later) return options.importSomedayProjects;
		return false;
	});

	for (let idx = 0; idx < projects.length; idx++) {
		const item = projects[idx]!;
		onProgress({ phase: "Creating projects", current: idx + 1, total: projects.length });

		const title = sanitizeName(item.name) || "Untitled Project";
		const { aof } = mapTags(item.tags, aofNames);
		const outcome = extractOutcome(item.note);

		let filePath = normalizePath(`${projectFolder}/${title}.md`);
		let suffix = 2;
		while (await app.vault.adapter.exists(filePath)) {
			filePath = normalizePath(`${projectFolder}/${title} ${suffix}.md`);
			suffix++;
		}

		try {
			const projStatus = (item.state === NirvanaState.Someday || item.state === NirvanaState.Later) ? "someday" : "active";
			await store.createProjectFile(aof, filePath.replace(`${projectFolder}/`, "").replace(".md", ""), outcome, projStatus);
			projectMap.set(item.id, { nirvanaId: item.id, title, filePath });
			result.projectsCreated++;
		} catch (e) {
			result.errors.push(`Project "${title}": ${String(e)}`);
		}

		if (idx % 5 === 0) await yieldToUI();
	}

	// ── Phase 2: Filter and prepare tasks ────────────────────────
	const taskItems = items.filter(i => {
		if (i.type !== NirvanaType.Task) return false;
		if (i.state === NirvanaState.RecurringTemplate || i.state === NirvanaState.Reference) return false;
		const isCompleted = i.state === NirvanaState.Completed || i.completed > 0;
		if (isCompleted && !options.importCompletedTasks) return false;
		if (!isCompleted && !options.importActiveTasks) return false;
		return true;
	});

	// Group tasks: project tasks vs standalone, active vs completed
	const projectTasks = new Map<string, { item: NirvanaItem; idx: number }[]>();
	const standaloneActive: NirvanaItem[] = [];
	const standaloneCompleted: NirvanaItem[] = [];

	for (const item of taskItems) {
		const proj = item.parentid ? projectMap.get(item.parentid) : undefined;
		if (proj !== undefined) {
			const group = projectTasks.get(proj.nirvanaId) ?? [];
			group.push({ item, idx: group.length });
			projectTasks.set(proj.nirvanaId, group);
		} else if (item.state === NirvanaState.Completed || item.completed > 0) {
			standaloneCompleted.push(item);
		} else {
			standaloneActive.push(item);
		}
	}

	// Dedup recurring instances: same name + multiple due dates → keep next upcoming
	const dedupedActive = deduplicateRecurring(standaloneActive);
	result.tasksSkipped += standaloneActive.length - dedupedActive.length;

	// ── Phase 3–4: Write standalone tasks ─────────────────────────
	const importPath = normalizePath("MLW/Nirvana Import.md");
	if (dedupedActive.length > 0) {
		onProgress({ phase: "Importing active tasks", current: 0, total: dedupedActive.length });
		await writeTaskFile(app, store, importPath, dedupedActive, aofNames, false, onProgress, result);
	}
	if (standaloneCompleted.length > 0) {
		const completedPath = normalizePath("MLW/Nirvana Import - Completed.md");
		onProgress({ phase: "Importing completed tasks", current: 0, total: standaloneCompleted.length });
		await writeTaskFile(app, store, completedPath, standaloneCompleted, aofNames, true, onProgress, result);
	}

	// ── Phase 5: Append tasks to project files ───────────────────
	let projIdx = 0, projTotal = projectTasks.size;
	for (const [projId, tasks] of projectTasks) {
		projIdx++;
		const proj = projectMap.get(projId);
		if (proj === undefined) continue;
		onProgress({ phase: "Adding project tasks", current: projIdx, total: projTotal });

		try {
			await appendToProjectFile(app, store, proj, tasks.map(t => t.item), aofNames, result);
		} catch (e) {
			result.errors.push(`Tasks for "${proj.title}": ${String(e)}`);
		}
		if (projIdx % 3 === 0) await yieldToUI();
	}

	// ── Phase 6: Auto-add new contexts to settings ───────────────
	const ctxSet = new Set(settings.contexts.map(c => c.toLowerCase()));
	const newCtx: string[] = [];
	for (const item of taskItems) {
		const { context } = mapTags(item.tags, aofNames);
		if (context !== null && !ctxSet.has(context.toLowerCase())) { ctxSet.add(context.toLowerCase()); newCtx.push(context); }
	}
	if (newCtx.length > 0) store.updateSettings({ contexts: [...settings.contexts, ...newCtx] });
	await store.saveImmediate();
	onProgress({ phase: "Complete", current: 1, total: 1 });
	return result;
}

/** Build and write a grouped task markdown file, then create DataStore entries. */
async function writeTaskFile(
	app: App, store: DataStore, filePath: string,
	items: NirvanaItem[], aofNames: string[], isCompleted: boolean,
	onProgress: (p: ImportProgress) => void, result: ImportResult,
): Promise<void> {
	const lines: string[] = ["# Nirvana Import" + (isCompleted ? " - Completed" : ""), ""];
	const taskLineMap: { lineIdx: number; item: NirvanaItem }[] = [];

	// Group by status header
	const groups = isCompleted
		? [{ header: "Completed", items }]
		: groupByStatus(items);

	for (const group of groups) {
		lines.push(`## ${group.header}`, "");
		for (const item of group.items) {
			const prepared = prepareTask(item, aofNames);
			if (prepared === null) { result.tasksSkipped++; continue; }

			const checkbox = isCompleted || prepared.fields.status === "completed" || prepared.fields.status === "dropped"
				? "- [x]" : "- [ ]";
			taskLineMap.push({ lineIdx: lines.length, item });
			lines.push(`${checkbox} ${prepared.text} <!-- mlw:PLACEHOLDER -->`);
			for (const note of prepared.noteLines) lines.push(`\t${note}`);
		}
		lines.push("");
	}

	const folder = filePath.split("/").slice(0, -1).join("/");
	if (folder && !(await app.vault.adapter.exists(folder))) await app.vault.createFolder(folder);

	let finalContent = lines.join("\n");
	const entries: { lineNum: number; id: string; item: NirvanaItem }[] = [];
	for (const { lineIdx, item } of taskLineMap) {
		const id = store.generateId();
		finalContent = finalContent.replace("<!-- mlw:PLACEHOLDER -->", `<!-- mlw:${id} -->`);
		entries.push({ lineNum: lineIdx + 1, id, item });
	}

	await app.vault.create(filePath, finalContent);

	// Create DataStore entries
	for (let i = 0; i < entries.length; i++) {
		const { lineNum, id, item } = entries[i]!;
		const prepared = prepareTask(item, aofNames);
		if (prepared === null) continue;

		store.createTask({
			id,
			...prepared.fields,
			project: null,
			source_file: filePath,
			source_line: lineNum,
		});
		result.tasksImported++;
		if (i % 20 === 0) onProgress({ phase: "Creating task entries", current: i, total: entries.length });
	}
}

/** Append task checkboxes to an existing project file before ## Notes. */
async function appendToProjectFile(
	app: App, store: DataStore, proj: ProjectInfo,
	items: NirvanaItem[], aofNames: string[], result: ImportResult,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(proj.filePath);
	if (file === null) return;

	const content = await app.vault.read(file as any);
	const lines = content.split("\n");

	// Find insertion point: before "## Notes" or at end
	let insertIdx = lines.length;
	for (let i = 0; i < lines.length; i++) {
		if (lines[i]!.trim() === "## Notes") { insertIdx = i; break; }
	}

	const newLines: string[] = [""];
	const entries: { offset: number; id: string; item: NirvanaItem }[] = [];

	for (const item of items) {
		const prepared = prepareTask(item, aofNames);
		if (prepared === null) { result.tasksSkipped++; continue; }

		const id = store.generateId();
		const checkbox = prepared.fields.status === "completed" || prepared.fields.status === "dropped"
			? "- [x]" : "- [ ]";
		entries.push({ offset: newLines.length, id, item });
		newLines.push(`${checkbox} ${prepared.text} <!-- mlw:${id} -->`);
		for (const note of prepared.noteLines) newLines.push(`\t${note}`);
	}
	newLines.push("");

	lines.splice(insertIdx, 0, ...newLines);
	await app.vault.modify(file as any, lines.join("\n"));

	for (const { offset, id, item } of entries) {
		const prepared = prepareTask(item, aofNames);
		if (prepared === null) continue;

		store.createTask({
			id,
			...prepared.fields,
			project: proj.title,
			source_file: proj.filePath,
			source_line: insertIdx + offset + 1,
		});
		result.tasksImported++;
	}
}

function groupByStatus(items: NirvanaItem[]): { header: string; items: NirvanaItem[] }[] {
	const map: Record<number, string> = { 0: "Inbox", 1: "Next Actions", 2: "Next Actions", 3: "Scheduled", 4: "Someday / Maybe", 5: "Someday / Maybe", 6: "Next Actions" };
	const buckets = new Map<string, NirvanaItem[]>();
	for (const item of items) {
		const h = map[item.state] ?? "Other";
		(buckets.get(h) ?? (buckets.set(h, []), buckets.get(h)!)).push(item);
	}
	return ["Inbox", "Next Actions", "Scheduled", "Someday / Maybe", "Dropped"]
		.filter(h => buckets.has(h)).map(h => ({ header: h, items: buckets.get(h)! }));
}

function deduplicateRecurring(items: NirvanaItem[]): NirvanaItem[] {
	const byName = new Map<string, NirvanaItem[]>();
	for (const item of items) {
		const group = byName.get(item.name) ?? [];
		group.push(item);
		byName.set(item.name, group);
	}
	const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const result: NirvanaItem[] = [];
	for (const [, group] of byName) {
		if (group.length === 1 || !group.every(i => i.duedate.length === 8)) {
			result.push(...group);
		} else {
			// Pick the nearest future due date, or most recent past if all overdue
			const sorted = group.sort((a, b) => a.duedate.localeCompare(b.duedate));
			const next = sorted.find(i => i.duedate >= today) ?? sorted[sorted.length - 1]!;
			result.push(next);
		}
	}
	return result;
}

function yieldToUI(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}
