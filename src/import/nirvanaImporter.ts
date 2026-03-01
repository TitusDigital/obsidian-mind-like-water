import { normalizePath, type App, TFolder } from "obsidian";
import type { DataStore } from "data/DataStore";
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

	// ── Phase 1: Create project files ────────────────────────────
	const projectMap = new Map<string, ProjectInfo>();

	if (options.importActiveProjects) {
		const projects = items.filter(i => i.type === NirvanaType.Project && i.state === NirvanaState.ActiveProject);
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
				await store.createProjectFile(aof, filePath.replace(`${projectFolder}/`, "").replace(".md", ""), outcome);
				projectMap.set(item.id, { nirvanaId: item.id, title, filePath });
				result.projectsCreated++;
			} catch (e) {
				result.errors.push(`Project "${title}": ${String(e)}`);
			}

			if (idx % 5 === 0) await yieldToUI();
		}
	}

	// ── Phase 2: Filter and prepare tasks ────────────────────────
	const taskItems = items.filter(i => {
		if (i.type !== NirvanaType.Task) return false;
		if (i.state === NirvanaState.RecurringTemplate || i.state === NirvanaState.Reference) return false;
		if (i.state === NirvanaState.Completed && !options.importCompletedTasks) return false;
		if (i.state !== NirvanaState.Completed && !options.importActiveTasks) return false;
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
		} else if (item.state === NirvanaState.Completed) {
			standaloneCompleted.push(item);
		} else {
			standaloneActive.push(item);
		}
	}

	// ── Phase 3: Write standalone active tasks ───────────────────
	const importPath = normalizePath("MLW/Nirvana Import.md");
	if (standaloneActive.length > 0) {
		onProgress({ phase: "Importing active tasks", current: 0, total: standaloneActive.length });
		await writeTaskFile(app, store, importPath, standaloneActive, aofNames, false, onProgress, result);
	}

	// ── Phase 4: Write standalone completed tasks ────────────────
	if (standaloneCompleted.length > 0) {
		const completedPath = normalizePath("MLW/Nirvana Import - Completed.md");
		onProgress({ phase: "Importing completed tasks", current: 0, total: standaloneCompleted.length });
		await writeTaskFile(app, store, completedPath, standaloneCompleted, aofNames, true, onProgress, result);
	}

	// ── Phase 5: Append tasks to project files ───────────────────
	let projIdx = 0;
	const projTotal = projectTasks.size;
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
	const existingContexts = new Set(settings.contexts.map(c => c.toLowerCase()));
	const newContexts: string[] = [];
	for (const item of taskItems) {
		const { context } = mapTags(item.tags, aofNames);
		if (context !== null && !existingContexts.has(context.toLowerCase())) {
			existingContexts.add(context.toLowerCase());
			newContexts.push(context);
		}
	}
	if (newContexts.length > 0) {
		store.updateSettings({ contexts: [...settings.contexts, ...newContexts] });
	}

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

	// Ensure MLW folder exists
	const folder = filePath.split("/").slice(0, -1).join("/");
	if (folder && !(await app.vault.adapter.exists(folder))) {
		await app.vault.createFolder(folder);
	}

	// Generate IDs and replace placeholders
	const content = lines.join("\n");
	let finalContent = content;
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
	const buckets = new Map<string, NirvanaItem[]>();
	const order = ["Inbox", "Next Actions", "Scheduled", "Someday / Maybe", "Dropped"];
	const stateToHeader: Record<number, string> = {
		0: "Inbox", 1: "Next Actions", 2: "Next Actions",
		3: "Scheduled", 4: "Someday / Maybe", 5: "Someday / Maybe",
		6: "Next Actions",
	};

	for (const item of items) {
		const header = stateToHeader[item.state] ?? "Other";
		const list = buckets.get(header) ?? [];
		list.push(item);
		buckets.set(header, list);
	}

	return order
		.filter(h => buckets.has(h))
		.map(h => ({ header: h, items: buckets.get(h)! }));
}

function yieldToUI(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}
