import {
	ViewPlugin,
	type ViewUpdate,
	type DecorationSet,
	Decoration,
	type EditorView,
} from "@codemirror/view";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Facet } from "@codemirror/state";
import { editorLivePreviewField } from "obsidian";
import type { DataStore } from "data/DataStore";
import { ChipWidget } from "editor/ChipWidget";
import { TrackWidget } from "editor/TrackWidget";
import { canTrackLine } from "editor/trackTask";

// ── Facet: bridge between Obsidian plugin and CM6 ──────────────

const dataStoreFacet = Facet.define<DataStore, DataStore | null>({
	combine(inputs) {
		return inputs[0] ?? null;
	},
});

// ── Regex patterns ──────────────────────────────────────────────

const MLW_COMMENT_RE = /<!-- mlw:([a-z0-9]{6}) -->/;

// ── ViewPlugin ──────────────────────────────────────────────────

class MLWDecorationPlugin {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate): void {
		// Always rebuild — scanning visibleRanges is cheap and ensures
		// chip content reflects current DataStore state.
		this.decorations = this.buildDecorations(update.view);
	}

	private buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		const isLivePreview = view.state.field(editorLivePreviewField);
		const store = view.state.facet(dataStoreFacet);

		// No decorations in Source Mode or if DataStore is unavailable
		if (!isLivePreview || store === null) {
			return builder.finish();
		}

		for (const { from, to } of view.visibleRanges) {
			this.scanRange(view, builder, from, to, store);
		}

		return builder.finish();
	}

	private scanRange(
		view: EditorView,
		builder: RangeSetBuilder<Decoration>,
		from: number,
		to: number,
		store: DataStore,
	): void {
		for (let pos = from; pos <= to;) {
			const line = view.state.doc.lineAt(pos);
			const lineText = line.text;

			// Check for tracked MLW comment
			const match = MLW_COMMENT_RE.exec(lineText);

			if (match !== null) {
				const taskId = match[1];
				if (taskId !== undefined) {
					const matchFrom = line.from + match.index;
					const matchTo = matchFrom + match[0].length;

					builder.add(
						matchFrom,
						matchTo,
						Decoration.replace({
							widget: new ChipWidget(taskId, store),
						}),
					);
				}
			} else if (canTrackLine(lineText)) {
				// Untracked checkbox — show + Track button at end of text
				const trimmedEnd = line.from + lineText.trimEnd().length;

				builder.add(
					trimmedEnd,
					trimmedEnd,
					Decoration.widget({
						widget: new TrackWidget(line.from, store),
						side: 1,
					}),
				);
			}

			pos = line.to + 1;
		}
	}
}

// ── Exported extension ──────────────────────────────────────────

const mlwDecorationPlugin = ViewPlugin.fromClass(MLWDecorationPlugin, {
	decorations: (v) => v.decorations,
});

/**
 * Create the full MLW editor extension array.
 * Call this once in Plugin.onload() and pass to registerEditorExtension().
 */
export function mlwEditorExtension(store: DataStore): Extension[] {
	return [
		dataStoreFacet.of(store),
		mlwDecorationPlugin,
	];
}
