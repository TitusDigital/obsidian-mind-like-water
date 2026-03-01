import { TFile, Notice } from "obsidian";
import { RRule } from "rrule";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";

const MLW_COMMENT_RE = /<!-- mlw:[a-z0-9]{6} -->/;
const MAX_SPAWN_PER_RUN = 50;

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(dateStr: string): Date {
	const [y, m, d] = dateStr.split("-").map(Number);
	return new Date(y!, m! - 1, d!);
}

function formatLocalDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ── End Condition ────────────────────────────────────────────────

function parseRRule(ruleStr: string): RRule {
	return RRule.fromString(ruleStr.startsWith("RRULE:") ? ruleStr : `RRULE:${ruleStr}`);
}

function hasReachedEndCondition(store: DataStore, tmpl: Task, nextDate?: Date): boolean {
	const opts = parseRRule(tmpl.recurrence_rule!).origOptions;
	if (opts.count != null && tmpl.recurrence_spawn_count >= opts.count) return true;
	return opts.until != null && nextDate !== undefined && nextDate > opts.until;
}

function incrementSpawnCount(store: DataStore, templateId: string): void {
	const tmpl = store.getTask(templateId);
	if (tmpl !== undefined) store.updateTask(templateId, { recurrence_spawn_count: tmpl.recurrence_spawn_count + 1 });
}

// ── Markdown Sync ────────────────────────────────────────────────

async function appendCheckboxToFile(
	store: DataStore, sourceFile: string, taskText: string, newId: string,
): Promise<number> {
	const file = store.app.vault.getAbstractFileByPath(sourceFile);
	if (!(file instanceof TFile)) { console.warn(`MLW: Source file not found: ${sourceFile}`); return -1; }
	const content = await store.app.vault.read(file);
	const lines = content.split("\n");
	// Find last mlw comment line to group recurring tasks together
	let insertAfter = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (MLW_COMMENT_RE.test(lines[i]!)) { insertAfter = i; break; }
	}
	if (insertAfter === -1) insertAfter = lines.length - 1;
	const insertAt = insertAfter + 1;
	lines.splice(insertAt, 0, `- [ ] ${taskText} <!-- mlw:${newId} -->`);
	updateLineNumbersAfterInsert(store, sourceFile, insertAt + 1);
	await store.app.vault.modify(file, lines.join("\n"));
	return insertAt + 1;
}

function updateLineNumbersAfterInsert(store: DataStore, filePath: string, insertedLine1Based: number): void {
	for (const task of store.getAllTasks()) {
		if (task.source_file === filePath && task.source_line >= insertedLine1Based) {
			store.updateTask(task.id, { source_line: task.source_line + 1 });
		}
	}
}

// ── Spawn Instance ───────────────────────────────────────────────

async function spawnInstance(
	store: DataStore, sourceTask: Task, newStartDate: Date,
): Promise<Task> {
	const today = parseLocalDate(localToday());
	const status = newStartDate > today ? TaskStatus.Scheduled : TaskStatus.NextAction;

	// Calculate due_date: preserve offset from source if both start_date and due_date existed
	let newDueDate: string | null = null;
	if (sourceTask.due_date !== null && sourceTask.start_date !== null) {
		const offsetMs = parseLocalDate(sourceTask.due_date).getTime() - parseLocalDate(sourceTask.start_date).getTime();
		newDueDate = formatLocalDate(new Date(newStartDate.getTime() + offsetMs));
	}

	// Get task text for the new checkbox line
	const taskText = sourceTask.cached_text ?? "Recurring task";

	const newId = store.generateId();
	const sourceLine = await appendCheckboxToFile(store, sourceTask.source_file, taskText, newId);

	const newTask = store.createTask({
		id: newId,
		status,
		source_file: sourceTask.source_file,
		source_line: sourceLine,
		area_of_focus: sourceTask.area_of_focus,
		project: sourceTask.project,
		context: sourceTask.context,
		starred: false,
		due_date: newDueDate,
		start_date: formatLocalDate(newStartDate),
		sort_order: sourceTask.sort_order,
		recurrence_rule: sourceTask.recurrence_rule,
		recurrence_type: sourceTask.recurrence_type,
		recurrence_template_id: sourceTask.recurrence_template_id,
		parent_task_id: sourceTask.id,
		recurrence_suspended: false,
		recurrence_spawn_count: 0,
		cached_text: sourceTask.cached_text,
	});

	incrementSpawnCount(store, sourceTask.recurrence_template_id ?? sourceTask.id);
	new Notice(`Next instance created: ${taskText} — starts ${formatLocalDate(newStartDate)}`);

	return newTask;
}

// ── On Task Completed ────────────────────────────────────────────

/** Called after a task is completed. Spawns next recurrence instance if applicable. */
export async function onTaskCompleted(store: DataStore, task: Task): Promise<void> {
	if (task.recurrence_rule === null) return;
	if (task.recurrence_suspended) return;
	if (store.getSettings().recurrenceGloballyPaused) return;

	const templateId = task.recurrence_template_id ?? task.id;
	const template = store.getTask(templateId);
	if (template === undefined) return;

	if (task.recurrence_type === "relative") {
		if (hasReachedEndCondition(store, template)) return;

		const completedDate = task.completed_date;
		if (completedDate === null) return;

		// Duplicate guard: check if a child was already spawned from this task
		const existing = store.getTasksByTemplateId(templateId);
		if (existing.some(t => t.parent_task_id === task.id)) return;

		const rule = parseRRule(task.recurrence_rule);
		const anchor = new Date(completedDate);
		const nextDate = rule.after(anchor, false);
		if (nextDate === null) return;

		await spawnInstance(store, task, nextDate);

	} else if (task.recurrence_type === "fixed") {
		// Completion of a fixed task triggers a catch-up check
		await checkFixedSpawnsForTemplate(store, templateId);
	}
}

// ── Fixed Schedule Spawning ──────────────────────────────────────

/** Check and spawn missed fixed-schedule instances for a single template. */
async function checkFixedSpawnsForTemplate(store: DataStore, templateId: string): Promise<number> {
	const template = store.getTask(templateId);
	if (template === undefined) return 0;
	if (template.recurrence_suspended) return 0;
	if (template.recurrence_rule === null) return 0;
	if (template.recurrence_type !== "fixed") return 0;

	const allInstances = store.getTasksByTemplateId(templateId);
	if (allInstances.length === 0) return 0;

	const today = parseLocalDate(localToday());
	const rule = parseRRule(template.recurrence_rule);

	// Find latest instance by start_date
	let latestStartDate = "";
	let latestInstance = allInstances[0]!;
	for (const inst of allInstances) {
		if ((inst.start_date ?? "") > latestStartDate) {
			latestStartDate = inst.start_date ?? "";
			latestInstance = inst;
		}
	}

	let spawned = 0;
	let anchor = latestStartDate !== "" ? parseLocalDate(latestStartDate) : today;
	let nextDate = rule.after(anchor, false);

	while (nextDate !== null && nextDate <= today) {
		if (hasReachedEndCondition(store, template, nextDate)) break;

		const nextDateStr = formatLocalDate(nextDate);
		const exists = allInstances.some(t => t.start_date === nextDateStr);
		if (!exists) {
			const newTask = await spawnInstance(store, latestInstance, nextDate);
			allInstances.push(newTask);
			latestInstance = newTask;
			spawned++;
			if (spawned >= MAX_SPAWN_PER_RUN) break;
		}

		anchor = nextDate;
		nextDate = rule.after(anchor, false);
	}

	return spawned;
}

// ── Plugin Load ──────────────────────────────────────────────────

/** Run on plugin load: check all fixed-schedule recurrences for missed spawns. */
export async function onPluginLoad(store: DataStore): Promise<number> {
	if (store.getSettings().recurrenceGloballyPaused) return 0;

	const templates = getActiveFixedTemplates(store);
	let totalSpawned = 0;

	for (const template of templates) {
		const spawned = await checkFixedSpawnsForTemplate(store, template.id);
		totalSpawned += spawned;
		if (totalSpawned >= MAX_SPAWN_PER_RUN) {
			new Notice(`Created ${totalSpawned} recurring task instances. Some recurrences may need manual catch-up.`);
			break;
		}
	}

	return totalSpawned;
}

function getActiveFixedTemplates(store: DataStore): Task[] {
	return store.getAllTasks().filter(t =>
		t.recurrence_type === "fixed" &&
		t.recurrence_rule !== null &&
		t.recurrence_template_id === t.id &&
		!t.recurrence_suspended,
	);
}

// ── Pause / Resume ───────────────────────────────────────────────

/** Pause recurrence on a single task. */
export function pauseTask(store: DataStore, taskId: string): void {
	store.updateTask(taskId, { recurrence_suspended: true });
}

/** Resume recurrence on a single task. For fixed: spawns next upcoming instance via skip-to-today. */
export async function resumeTask(store: DataStore, taskId: string): Promise<void> {
	const task = store.getTask(taskId);
	if (task === undefined) return;
	store.updateTask(taskId, { recurrence_suspended: false });
	if (task.recurrence_type === "fixed") {
		await resumeFixedForTemplate(store, task.recurrence_template_id ?? task.id);
	}
}

/** Pause all recurring tasks globally. */
export function pauseAllRecurrence(store: DataStore): void {
	store.updateSettings({ recurrenceGloballyPaused: true, recurrencePausedAt: new Date().toISOString() });
	for (const t of store.getAllTasks()) {
		if (t.recurrence_rule !== null && !t.recurrence_suspended) store.updateTask(t.id, { recurrence_suspended: true });
	}
}

/** Resume all recurring tasks globally. Runs skip-to-today for fixed schedules. */
export async function resumeAllRecurrence(store: DataStore): Promise<void> {
	store.updateSettings({ recurrenceGloballyPaused: false, recurrencePausedAt: null });
	for (const t of store.getAllTasks()) {
		if (t.recurrence_rule !== null && t.recurrence_suspended) store.updateTask(t.id, { recurrence_suspended: false });
	}
	// Skip-to-today: spawn next occurrence on/after today (NOT catch-up)
	const templates = getActiveFixedTemplates(store);
	let totalSpawned = 0;
	for (const tmpl of templates) {
		if (totalSpawned >= MAX_SPAWN_PER_RUN) break;
		totalSpawned += await resumeFixedForTemplate(store, tmpl.id);
	}
}

async function resumeFixedForTemplate(store: DataStore, templateId: string): Promise<number> {
	const template = store.getTask(templateId);
	if (template === undefined || template.recurrence_rule === null) return 0;
	if (template.recurrence_suspended || hasReachedEndCondition(store, template)) return 0;
	const today = parseLocalDate(localToday());
	const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
	const nextDate = parseRRule(template.recurrence_rule).after(yesterday, true);
	if (nextDate === null) return 0;
	const allInstances = store.getTasksByTemplateId(templateId);
	if (allInstances.some(t => t.start_date === formatLocalDate(nextDate))) return 0;
	const latest = allInstances.reduce((a, b) => ((a.start_date ?? "") > (b.start_date ?? "") ? a : b), allInstances[0]!);
	await spawnInstance(store, latest, nextDate);
	return 1;
}

// ── Human-Readable Summary ───────────────────────────────────────

/** Generate a human-readable summary of a recurrence rule. */
export function getRecurrenceSummary(ruleStr: string, type: "fixed" | "relative" | null): string {
	try {
		const text = parseRRule(ruleStr).toText();
		const cap = text.charAt(0).toUpperCase() + text.slice(1);
		return type === "relative" ? `${cap} after completion` : cap;
	} catch { return "Custom recurrence"; }
}
