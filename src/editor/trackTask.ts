import { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";
import type { Editor, MarkdownFileInfo } from "obsidian";
import type { DataStore } from "data/DataStore";

const CHECKBOX_RE = /^\s*[-*]\s+\[[ xX]\]\s+/;
const MLW_COMMENT_RE = /<!-- mlw:[a-z0-9]{6} -->/;

/** Check whether a line of text is an untracked checkbox. */
export function canTrackLine(lineText: string): boolean {
	return CHECKBOX_RE.test(lineText) && !MLW_COMMENT_RE.test(lineText);
}

/**
 * Track a task via CM6 EditorView (used by TrackWidget click).
 * Creates a DataStore entry and injects <!-- mlw:ID --> into the document.
 */
export function trackTaskAtLine(
	view: EditorView,
	store: DataStore,
	linePos: number,
): void {
	const line = view.state.doc.lineAt(linePos);
	const fileInfo = view.state.field(editorInfoField);
	const filePath = fileInfo.file?.path ?? "unknown";

	const task = store.createTask({
		source_file: filePath,
		source_line: line.number,
	});

	const comment = " <!-- mlw:" + task.id + " -->";
	const trimmedEnd = line.from + line.text.trimEnd().length;

	view.dispatch({
		changes: { from: trimmedEnd, to: trimmedEnd, insert: comment },
	});
}

/**
 * Track a task via Obsidian Editor API (used by keyboard command).
 * Returns true if the current line was trackable and was tracked.
 */
export function trackTaskWithEditor(
	editor: Editor,
	ctx: MarkdownFileInfo,
	store: DataStore,
): boolean {
	const cursor = editor.getCursor();
	const lineText = editor.getLine(cursor.line);

	if (!canTrackLine(lineText)) return false;

	const filePath = ctx.file?.path ?? "unknown";

	const task = store.createTask({
		source_file: filePath,
		source_line: cursor.line + 1, // Obsidian Editor is 0-based, model is 1-based
	});

	const comment = " <!-- mlw:" + task.id + " -->";
	const trimmedEnd = lineText.trimEnd().length;

	editor.replaceRange(comment, { line: cursor.line, ch: trimmedEnd });
	return true;
}
