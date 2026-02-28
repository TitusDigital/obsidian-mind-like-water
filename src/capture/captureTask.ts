import type { App, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";

export interface CaptureResult {
	taskId: string;
	filePath: string;
	lineNumber: number;
}

/**
 * Append a new tracked checkbox to the end of a file.
 * Creates a DataStore entry with status: inbox.
 */
export async function captureTask(
	app: App, store: DataStore, taskText: string, targetFile: TFile,
): Promise<CaptureResult> {
	const id = store.generateId();
	const checkboxLine = `- [ ] ${taskText} <!-- mlw:${id} -->`;

	let content = await app.vault.read(targetFile);
	if (content.length > 0 && !content.endsWith("\n")) {
		content += "\n";
	}
	content += checkboxLine + "\n";

	const lineNumber = content.trimEnd().split("\n").length;
	await app.vault.modify(targetFile, content);

	store.createTask({
		id,
		source_file: targetFile.path,
		source_line: lineNumber,
		status: TaskStatus.Inbox,
	});

	return { taskId: id, filePath: targetFile.path, lineNumber };
}
