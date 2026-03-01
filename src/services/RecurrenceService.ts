import { TFile, Notice } from "obsidian";
import { RRule } from "rrule";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";

const MLW_COMMENT_RE = /<!-- mlw:[a-z0-9]{6} -->/;
const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
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
	const clean = ruleStr.startsWith("RRULE:") ? ruleStr : `RRULE:${ruleStr}`;
	return RRule.fromString(clean);
}

function hasReachedEndCondition(store: DataStore, template: Task, nextDate?: Date): boolean {
	const rule = parseRRule(template.recurrence_rule!);
	const opts = rule.origOptions;
	if (opts.count !== undefined && opts.count !== null && template.recurrence_spawn_count >= opts.count) {
		return true;
	}
	if (opts.until !== undefined && opts.until !== null && nextDate !== undefined) {
		if (nextDate > opts.until) return true;
	}
	return false;
}

function incrementSpawnCount(store: DataStore, templateId: string): void {
	const template = store.getTask(templateId);
	if (template !== undefined) {
		store.updateTask(templateId, { recurrence_spawn_count: template.recurrence_spawn_count + 1 });
	}
}

// ── Markdown Sync ────────────────────────────────────────────────

async function appendCheckboxToFile(
	store: DataStore, sourceFile: string, taskText: string, newId: string,
): Promise<number> {
	const app = store.app;
	const file = app.vault.getAbstractFileByPath(sourceFile);
	if (!(file instanceof TFile)) {
		console.warn(`MLW: Source file not found for recurring spawn: ${sourceFile}`);
		return -1;
	}

	const content = await app.vault.read(file);
	const lines = content.split("\n");

	// Find the last line containing an mlw comment to keep recurring tasks grouped
	let insertAfter = -1;
	for (let i = lines.length - 1; i >= 0; i--) {
		if (MLW_COMMENT_RE.test(lines[i]!)) { insertAfter = i; break; }
	}
	if (insertAfter === -1) insertAfter = lines.length - 1;

	const newLine = `- [ ] ${taskText} <!-- mlw:${newId} -->`;
	const insertAt = insertAfter + 1;
	lines.splice(insertAt, 0, newLine);

	// Update source_line for tasks below the insertion point in the same file
	updateLineNumbersAfterInsert(store, sourceFile, insertAt + 1); // +1 because source_line is 1-based

	await app.vault.modify(file, lines.join("\n"));
	return insertAt + 1; // 1-based line number
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

	const templateId = sourceTask.recurrence_template_id ?? sourceTask.id;
	incrementSpawnCount(store, templateId);

	const dateStr = formatLocalDate(newStartDate);
	new Notice(`Next instance created: ${taskText} — starts ${dateStr}`);

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

// ── Human-Readable Summary ───────────────────────────────────────

/** Generate a human-readable summary of a recurrence rule. */
export function getRecurrenceSummary(ruleStr: string, type: "fixed" | "relative" | null): string {
	try {
		const rule = parseRRule(ruleStr);
		const text = rule.toText();
		const capitalized = text.charAt(0).toUpperCase() + text.slice(1);
		if (type === "relative") return `${capitalized} after completion`;
		return capitalized;
	} catch {
		return "Custom recurrence";
	}
}
