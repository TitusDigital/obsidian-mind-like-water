import { type App, type Plugin, normalizePath, type TFile } from "obsidian";
import {
	type MLWData,
	type MLWSettings,
	type Task,
	type AOFColor,
	TaskStatus,
	FALLBACK_AOF_COLOR,
	DEFAULT_DATA,
	DEFAULT_SETTINGS,
} from "data/models";
import { readAllProjects } from "data/ProjectReader";
import { onTaskCompleted } from "services/RecurrenceService";

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_LENGTH = 6;
const SAVE_DEBOUNCE_MS = 500;

export class DataStore {
	private plugin: Plugin;
	private data: MLWData;
	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	private onChangeCallbacks = new Set<() => void>();

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = structuredClone(DEFAULT_DATA);
	}

	/** Expose the Obsidian App for services that need vault access. */
	get app(): App { return this.plugin.app; }

	// ── Initialization ──────────────────────────────────────────────

	/** Load data.json, merge with defaults, optionally create backup. */
	async load(): Promise<void> {
		const raw: unknown = await this.plugin.loadData();
		if (raw !== null && raw !== undefined && typeof raw === "object") {
			const loaded = raw as Partial<MLWData>;
			this.data = {
				tasks: (loaded.tasks as Record<string, Task> | undefined) ?? {},
				settings: { ...DEFAULT_SETTINGS, ...(loaded.settings ?? {}) },
			};
			// Backward-compat: default new recurrence fields on existing tasks
			for (const task of Object.values(this.data.tasks)) {
				task.recurrence_type ??= null;
				task.recurrence_template_id ??= null;
				task.recurrence_suspended ??= false;
				task.recurrence_spawn_count ??= 0;
			}
		} else {
			this.data = structuredClone(DEFAULT_DATA);
		}

		if (this.data.settings.dataStoreBackup) {
			await this.createBackup();
		}
	}

	/** Write data.json.bak in the plugin directory. */
	private async createBackup(): Promise<void> {
		try {
			const adapter = this.plugin.app.vault.adapter;
			const pluginDir = normalizePath(
				`${this.plugin.app.vault.configDir}/plugins/${this.plugin.manifest.id}`
			);
			const backupPath = normalizePath(`${pluginDir}/data.json.bak`);
			await adapter.write(backupPath, JSON.stringify(this.data, null, 2));
		} catch (e) { console.warn("MLW: Failed to create backup", e); }
	}

	// ── Persistence ─────────────────────────────────────────────────

	/** Schedule a debounced save. Multiple rapid calls coalesce into one write. */
	private scheduleSave(): void {
		if (this.saveTimeout !== null) {
			clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = setTimeout(() => {
			this.saveTimeout = null;
			void this.plugin.saveData(this.data);
		}, SAVE_DEBOUNCE_MS);
	}

	/** Force an immediate save (used during plugin unload). */
	async saveImmediate(): Promise<void> {
		if (this.saveTimeout !== null) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		await this.plugin.saveData(this.data);
	}

	// ── Change Notification ─────────────────────────────────────────

	/** Register a callback invoked after any task create/update/delete. */
	setOnChange(callback: () => void): void {
		this.onChangeCallbacks.add(callback);
	}

	/** Register a change listener. Returns an unsubscribe function. */
	onChange(callback: () => void): () => void {
		this.onChangeCallbacks.add(callback);
		return () => { this.onChangeCallbacks.delete(callback); };
	}

	private notifyChange(): void {
		for (const fn of this.onChangeCallbacks) fn();
	}

	// ── ID Generation ───────────────────────────────────────────────

	/** Generate a unique 6-char alphanumeric ID. */
	generateId(): string {
		let id: string;
		do {
			id = "";
			for (let i = 0; i < ID_LENGTH; i++) {
				id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
			}
		} while (id in this.data.tasks);
		return id;
	}

	// ── Task CRUD ───────────────────────────────────────────────────

	/** Create a new task. Caller may supply a pre-generated `id`. Returns the created task. */
	createTask(fields: Partial<Omit<Task, "created" | "modified">> & {
		source_file: string;
		source_line: number;
	}): Task {
		const now = new Date().toISOString();
		const task: Task = {
			id: fields.id ?? this.generateId(),
			status: fields.status ?? TaskStatus.Inbox,
			area_of_focus: fields.area_of_focus ?? "",
			project: fields.project ?? null,
			starred: fields.starred ?? false,
			due_date: fields.due_date ?? null,
			start_date: fields.start_date ?? null,
			completed_date: fields.completed_date ?? null,
			energy: fields.energy ?? null,
			context: fields.context ?? null,
			sort_order: fields.sort_order ?? this.getNextSortOrder(),
			source_file: fields.source_file,
			source_line: fields.source_line,
			created: now,
			modified: now,
			recurrence_rule: fields.recurrence_rule ?? null,
			recurrence_type: fields.recurrence_type ?? null,
			recurrence_template_id: fields.recurrence_template_id ?? null,
			parent_task_id: fields.parent_task_id ?? null,
			recurrence_suspended: fields.recurrence_suspended ?? false,
			recurrence_spawn_count: fields.recurrence_spawn_count ?? 0,
			cached_text: fields.cached_text ?? null,
		};
		this.data.tasks[task.id] = task;
		this.scheduleSave();
		this.notifyChange();
		return task;
	}

	/** Get a task by ID. */
	getTask(id: string): Task | undefined {
		return this.data.tasks[id];
	}

	/** Get all tasks as an array. */
	getAllTasks(): Task[] {
		return Object.values(this.data.tasks);
	}

	/** Update specific fields on an existing task. Returns updated task or undefined. */
	updateTask(id: string, fields: Partial<Omit<Task, "id" | "created">>): Task | undefined {
		const task = this.data.tasks[id];
		if (task === undefined) return undefined;
		Object.assign(task, fields, { modified: new Date().toISOString() });
		this.scheduleSave();
		this.notifyChange();
		return task;
	}

	/** Mark a task as completed. Triggers recurrence spawn if applicable. */
	completeTask(id: string): Task | undefined {
		const task = this.updateTask(id, {
			status: TaskStatus.Completed,
			completed_date: new Date().toISOString(),
		});
		if (task !== undefined) {
			void onTaskCompleted(this, task);
		}
		return task;
	}

	/** Delete a task by ID. Returns true if the task existed. */
	deleteTask(id: string): boolean {
		if (!(id in this.data.tasks)) return false;
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete this.data.tasks[id];
		this.scheduleSave();
		this.notifyChange();
		return true;
	}

	// ── Settings ────────────────────────────────────────────────────

	/** Get the current settings. */
	getSettings(): MLWSettings {
		return this.data.settings;
	}

	/** Update settings (merges with current). */
	updateSettings(partial: Partial<MLWSettings>): void {
		Object.assign(this.data.settings, partial);
		this.scheduleSave();
	}

	// ── Utilities ───────────────────────────────────────────────────

	/** Get the next sort_order value (max + 1, or 0 if empty). */
	private getNextSortOrder(): number {
		const tasks = Object.values(this.data.tasks);
		if (tasks.length === 0) return 0;
		return Math.max(...tasks.map(t => t.sort_order)) + 1;
	}

	/** Count tasks in a given status. */
	getTaskCountByStatus(status: TaskStatus): number {
		return Object.values(this.data.tasks).filter(t => t.status === status).length;
	}

	/** Get all tasks with a given status. */
	getTasksByStatus(status: TaskStatus): Task[] {
		return Object.values(this.data.tasks).filter(t => t.status === status);
	}

	/** Get all tasks sharing a recurrence template ID. */
	getTasksByTemplateId(templateId: string): Task[] {
		return Object.values(this.data.tasks).filter(t => t.recurrence_template_id === templateId);
	}

	/** Count starred tasks that are not completed or dropped. */
	getStarredCount(): number {
		return Object.values(this.data.tasks).filter(
			t => t.starred && t.status !== TaskStatus.Completed && t.status !== TaskStatus.Dropped
		).length;
	}

	/** Get the color for an Area of Focus by name. Falls back to grey. */
	getAOFColor(aofName: string): AOFColor {
		const aof = this.data.settings.areasOfFocus.find(a => a.name === aofName);
		return aof?.color ?? FALLBACK_AOF_COLOR;
	}

	// ── Projects ────────────────────────────────────────────────────

	/** Get project titles whose frontmatter area_of_focus matches the given AOF. */
	getProjectsForAOF(aof: string): string[] {
		const projects = readAllProjects(this.plugin.app, this.data.settings.projectFolder);
		return projects.filter(p => p.area_of_focus === aof).map(p => p.title).sort();
	}

	/** Look up a project's area_of_focus from its frontmatter. */
	getProjectAOF(projectName: string): string {
		const projects = readAllProjects(this.plugin.app, this.data.settings.projectFolder);
		return projects.find(p => p.title === projectName)?.area_of_focus ?? "";
	}

	/** Repair tasks whose AOF doesn't match their project's AOF. Returns count fixed. */
	repairTaskProjectAOFs(): number {
		const projects = readAllProjects(this.plugin.app, this.data.settings.projectFolder);
		const aofMap = new Map(projects.map(p => [p.title, p.area_of_focus]));
		let fixed = 0;
		for (const task of Object.values(this.data.tasks)) {
			if (task.project === null) continue;
			const projectAOF = aofMap.get(task.project);
			if (projectAOF !== undefined && projectAOF !== "" && task.area_of_focus !== projectAOF) {
				task.area_of_focus = projectAOF;
				task.modified = new Date().toISOString();
				fixed++;
			}
		}
		if (fixed > 0) { this.scheduleSave(); this.notifyChange(); }
		return fixed;
	}

	/** Create a new project markdown file with frontmatter. */
	async createProjectFile(aof: string, name: string, outcome: string, status = "active"): Promise<void> {
		const folder = normalizePath(this.data.settings.projectFolder);
		const exists = await this.plugin.app.vault.adapter.exists(folder);
		if (!exists) {
			await this.plugin.app.vault.createFolder(folder);
		}
		const filePath = normalizePath(`${folder}/${name}.md`);
		const now = new Date().toISOString();
		const content = [
			"---",
			"mlw_type: project",
			`title: "${name}"`,
			`status: ${status}`,
			`area_of_focus: "${aof}"`,
			`successful_outcome: "${outcome}"`,
			"sort_order: 0",
			`created: ${now}`,
			`modified: ${now}`,
			"---",
			"",
			"## Successful Outcome",
			"",
			outcome,
			"",
			"## Tasks",
			"",
			"```mlw-project-tasks",
			"```",
			"",
			"## Notes",
			"",
		].join("\n");
		await this.plugin.app.vault.create(filePath, content);
	}
}
