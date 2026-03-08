import type { App, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { CapturePosition, TaskStatus } from "data/models";

export interface CaptureResult {
	taskId: string;
	filePath: string;
	lineNumber: number;
}

/** Optional overrides for task fields when capturing from a context-aware source (e.g. group header "+"). */
export interface CaptureOptions {
	status?: TaskStatus;
	area_of_focus?: string;
	project?: string;
}

/**
 * Insert a checkbox line at the top of a file's content.
 * Returns the modified content and 1-based line number of the inserted line.
 */
export function insertAtTop(content: string, checkboxLine: string): { newContent: string; lineNumber: number } {
	const newContent = content.length > 0
		? checkboxLine + "\n" + content
		: checkboxLine + "\n";
	return { newContent, lineNumber: 1 };
}

/**
 * Append a checkbox line to the bottom of a file's content.
 * Returns the modified content and 1-based line number of the inserted line.
 */
export function insertAtBottom(content: string, checkboxLine: string): { newContent: string; lineNumber: number } {
	const base = content.length > 0 && !content.endsWith("\n") ? content + "\n" : content;
	const newContent = base + checkboxLine + "\n";
	const lineNumber = newContent.trimEnd().split("\n").length;
	return { newContent, lineNumber };
}

/**
 * Insert a checkbox line under a named heading.
 * - If the heading exists: inserts after the last non-blank line in that section.
 * - If the heading does not exist: appends the heading + task at end of file.
 * The heading string may include # markers (e.g. "## Inbox") or just text ("Inbox").
 * Returns the modified content and 1-based line number of the inserted line.
 */
export function insertUnderHeading(content: string, checkboxLine: string, heading: string): { newContent: string; lineNumber: number } {
	const target = heading.trim();
	const lines = content.split("\n");

	// Find the heading line — match exact (e.g. "## Inbox") or any heading level with that text
	let headingIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]?.trimEnd() ?? "";
		if (line === target) { headingIdx = i; break; }
		const m = line.match(/^(#+)\s+(.+)$/);
		if (m && m[2]?.trim() === target) { headingIdx = i; break; }
	}

	if (headingIdx === -1) {
		// Heading not found — append it plus the task at end of file
		while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") lines.pop();
		lines.push("", target, checkboxLine, "");
		const newContent = lines.join("\n");
		// Task is the third-to-last line (heading, task, blank)
		const lineNumber = lines.length - 1;
		return { newContent, lineNumber };
	}

	// Determine heading level to know where the section ends
	const headingLine = lines[headingIdx]?.trimEnd() ?? "";
	const headingLevel = (headingLine.match(/^(#+)/) ?? ["", ""])[1]?.length ?? 1;

	// Find next heading at same or higher level
	let nextHeadingIdx = lines.length;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		const m = (lines[i]?.trimEnd() ?? "").match(/^(#+)\s/);
		if (m && (m[1]?.length ?? 99) <= headingLevel) { nextHeadingIdx = i; break; }
	}

	// Find last non-blank line within the section; insert after it
	let insertAfter = headingIdx;
	for (let i = nextHeadingIdx - 1; i > headingIdx; i--) {
		if ((lines[i]?.trim() ?? "") !== "") { insertAfter = i; break; }
	}

	const insertIdx = insertAfter + 1;
	lines.splice(insertIdx, 0, checkboxLine);
	return { newContent: lines.join("\n"), lineNumber: insertIdx + 1 };
}

/**
 * Capture a new tracked task into a file according to the user's capture position setting.
 */
export async function captureTask(
	app: App, store: DataStore, taskText: string, targetFile: TFile,
	options?: CaptureOptions,
): Promise<CaptureResult> {
	const id = store.generateId();
	const checkboxLine = `- [ ] ${taskText} <!-- mlw:${id} -->`;
	const { capturePosition, captureHeading } = store.getSettings();

	const content = await app.vault.read(targetFile);

	let newContent: string;
	let lineNumber: number;

	if (capturePosition === CapturePosition.Top) {
		({ newContent, lineNumber } = insertAtTop(content, checkboxLine));
	} else if (capturePosition === CapturePosition.UnderHeading && captureHeading.trim()) {
		({ newContent, lineNumber } = insertUnderHeading(content, checkboxLine, captureHeading.trim()));
	} else {
		({ newContent, lineNumber } = insertAtBottom(content, checkboxLine));
	}

	await app.vault.modify(targetFile, newContent);

	store.createTask({
		id,
		source_file: targetFile.path,
		source_line: lineNumber,
		status: options?.status ?? TaskStatus.Inbox,
		area_of_focus: options?.area_of_focus ?? "",
		project: options?.project ?? null,
	});

	return { taskId: id, filePath: targetFile.path, lineNumber };
}
