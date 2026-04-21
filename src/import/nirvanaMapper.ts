import { TaskStatus, EnergyLevel } from "data/models";
import { NirvanaType, NirvanaState, type NirvanaItem, type ImportSummary, type PreparedTask } from "./nirvanaTypes";

/** Map Nirvana state to MLW status + starred flag. Returns null for items to skip. */
export function mapState(item: NirvanaItem): { status: TaskStatus; starred: boolean } | null {
	// completed timestamp is the ground truth — state field can be stale
	if (item.state === NirvanaState.Completed || item.completed > 0) {
		return item.cancelled === 1
			? { status: TaskStatus.Dropped, starred: false }
			: { status: TaskStatus.Done, starred: false };
	}
	switch (item.state) {
		case NirvanaState.Inbox: return { status: TaskStatus.Inbox, starred: false };
		case NirvanaState.Next: return { status: TaskStatus.Active, starred: false };
		case NirvanaState.Waiting: return { status: TaskStatus.Waiting, starred: false };
		case NirvanaState.Scheduled: return { status: TaskStatus.Scheduled, starred: false };
		case NirvanaState.Someday: return { status: TaskStatus.Someday, starred: false };
		case NirvanaState.Later: return { status: TaskStatus.Someday, starred: false };
		case NirvanaState.Focus: return { status: TaskStatus.Active, starred: true };
		default: return null;
	}
}

/** Convert Nirvana "YYYYMMDD" date to "YYYY-MM-DD", or null if empty/invalid. */
export function mapDate(nirvanaDate: string): string | null {
	if (nirvanaDate.length !== 8) return null;
	return `${nirvanaDate.slice(0, 4)}-${nirvanaDate.slice(4, 6)}-${nirvanaDate.slice(6, 8)}`;
}

/** Convert Nirvana energy (0–3) to MLW EnergyLevel. */
export function mapEnergy(energy: number): EnergyLevel | null {
	switch (energy) {
		case 1: return EnergyLevel.Low;
		case 2: return EnergyLevel.Medium;
		case 3: return EnergyLevel.High;
		default: return null;
	}
}

/** Convert Unix timestamp (seconds) to ISO string. Returns empty string for 0. */
export function mapTimestamp(unixSeconds: number): string {
	if (unixSeconds === 0) return "";
	return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Parse Nirvana tags string into AOF and context.
 * - Tags starting with @ → context (first match)
 * - Tags matching an existing AOF name (case-insensitive) → area_of_focus
 */
export function mapTags(
	tagsStr: string,
	aofNames: string[],
): { aof: string; context: string | null } {
	const tags = tagsStr.split(",").map(t => t.trim()).filter(t => t.length > 0);
	const aofLower = new Map(aofNames.map(n => [n.toLowerCase(), n]));

	let aof = "";
	let context: string | null = null;

	for (const tag of tags) {
		if (tag.startsWith("@") && context === null) {
			context = tag;
		} else if (aof === "") {
			const match = aofLower.get(tag.toLowerCase());
			if (match !== undefined) aof = match;
		}
	}
	return { aof, context };
}

/** Extract "SUCCESSFUL OUTCOME: ..." from a Nirvana note. */
export function extractOutcome(note: string): string {
	const match = note.match(/SUCCESSFUL OUTCOME:\s*(.*)/i);
	if (match !== null && match[1] !== undefined) return match[1].trim();
	return "";
}

/** Build an ImportSummary from raw Nirvana items. */
export function computeSummary(items: NirvanaItem[]): ImportSummary {
	let activeTasks = 0, completedTasks = 0, cancelledTasks = 0;
	let activeProjects = 0, somedayProjects = 0, recurringTemplates = 0, referenceItems = 0;

	for (const item of items) {
		if (item.type === NirvanaType.ReferenceItem || item.type === NirvanaType.ReferenceList ||
			item.state === NirvanaState.Reference) {
			referenceItems++; continue;
		}
		if (item.state === NirvanaState.RecurringTemplate) { recurringTemplates++; continue; }
		if (item.state === NirvanaState.ActiveProject) { activeProjects++; continue; }
		if (item.type === NirvanaType.Project && (item.state === NirvanaState.Someday || item.state === NirvanaState.Later)) {
			somedayProjects++; continue;
		}
		if (item.state === NirvanaState.Completed || item.completed > 0) {
			if (item.cancelled === 1) cancelledTasks++; else completedTasks++;
			continue;
		}
		if (item.type === NirvanaType.Task) activeTasks++;
	}

	return { totalItems: items.length, activeTasks, completedTasks, cancelledTasks, activeProjects, somedayProjects, recurringTemplates, referenceItems };
}

/** Discover all unique non-@ tags across importable items, excluding project names. */
export function discoverTags(items: NirvanaItem[]): string[] {
	const projectNames = new Set(items.filter(i => i.type === NirvanaType.Project).map(i => i.name.toLowerCase()));
	const seen = new Set<string>();
	const tags: string[] = [];
	for (const item of items) {
		if (item.type !== NirvanaType.Task) continue;
		if (item.completed > 0 || item.state === NirvanaState.Completed) continue;
		for (const t of item.tags.split(",")) {
			const trimmed = t.trim();
			if (trimmed && !trimmed.startsWith("@") && !seen.has(trimmed.toLowerCase()) && !projectNames.has(trimmed.toLowerCase())) {
				seen.add(trimmed.toLowerCase());
				tags.push(trimmed);
			}
		}
	}
	return tags.sort((a, b) => a.localeCompare(b));
}

/** Prepare a Nirvana task item for import: build text, note lines, and MLW field values. */
export function prepareTask(item: NirvanaItem, aofNames: string[]): PreparedTask | null {
	const mapped = mapState(item);
	if (mapped === null) return null;

	let text = item.name || "(untitled task)";
	if (item.state === NirvanaState.Waiting && item.waitingfor) {
		text += ` (waiting for: ${item.waitingfor})`;
	}

	const { aof, context: tagContext } = mapTags(item.tags, aofNames);
	const context = item.state === NirvanaState.Waiting ? "@waiting" : tagContext;

	const noteLines: string[] = [];
	if (item.note) {
		for (const line of item.note.split("\n")) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.match(/^SUCCESSFUL OUTCOME:/i)) {
				noteLines.push(trimmed);
			}
		}
	}

	return {
		text,
		noteLines,
		fields: {
			status: mapped.status,
			starred: mapped.starred,
			area_of_focus: aof,
			due_date: mapDate(item.duedate),
			start_date: mapDate(item.startdate),
			completed_date: mapped.status === TaskStatus.Done || mapped.status === TaskStatus.Dropped
				? mapTimestamp(item.completed) || mapTimestamp(item.updated)
				: null,
			energy: mapEnergy(item.energy),
			context,
			sort_order: item.seqt || item.seq || 0,
		},
	};
}
