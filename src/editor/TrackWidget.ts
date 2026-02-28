import { WidgetType, EditorView } from "@codemirror/view";
import type { DataStore } from "data/DataStore";
import { trackTaskAtLine } from "editor/trackTask";

/** Renders a "+ Track" button on untracked checkbox lines. */
export class TrackWidget extends WidgetType {
	constructor(
		readonly linePos: number,
		private readonly store: DataStore,
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.className = "mlw-track-btn";
		span.textContent = "+ Track";

		span.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			trackTaskAtLine(view, this.store, this.linePos);
		});

		return span;
	}

	eq(other: WidgetType): boolean {
		return other instanceof TrackWidget && other.linePos === this.linePos;
	}

	ignoreEvent(event: Event): boolean {
		return event.type === "mousedown" || event.type === "click";
	}
}
