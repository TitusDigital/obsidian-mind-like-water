import { WidgetType, type EditorView } from "@codemirror/view";
import { TaskStatus, FALLBACK_AOF_COLOR, ChipDisplayMode, nextChipDisplayMode } from "data/models";
import type { AOFColor } from "data/models";
import type { DataStore } from "data/DataStore";
import { MetadataEditor } from "components/MetadataEditor";
import { MLW_COMMENT_STRIP_RE } from "data/idPattern";

/** Renders a colored metadata chip for a tracked MLW task. */
export class ChipWidget extends WidgetType {
	constructor(
		readonly taskId: string,
		private readonly store: DataStore,
	) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		const task = this.store.getTask(this.taskId);

		if (task === undefined) {
			span.className = "mlw-chip mlw-chip--unknown";
			span.textContent = "? unknown";
			return span;
		}

		// Build full chip content (always needed for tooltip)
		const parts: string[] = [];
		if (task.status === TaskStatus.Inbox && task.area_of_focus === "") {
			parts.push("\u{1F4E5} Inbox");
		} else {
			if (task.starred) parts.push("\u2B50");
			if (task.area_of_focus !== "") parts.push(task.area_of_focus);
			if (task.project !== null) parts.push(task.project);
			if (task.due_date !== null) parts.push("\u{1F4C5} " + task.due_date);
			if (task.recurrence_rule !== null) parts.push(task.recurrence_suspended ? "\u21BB\u23F8" : "\u21BB");
			if (parts.length === 0) parts.push("Tracked");
		}
		const fullText = parts.join(" \u00B7 ");

		// Apply AOF color (all modes)
		const color = this.getAOFColor(task.area_of_focus);
		span.style.backgroundColor = color.bg;
		span.style.color = color.text;
		span.style.borderColor = color.border;

		// Render based on display mode
		const mode = this.store.getSettings().chipDisplayMode;
		if (mode === ChipDisplayMode.Dot) {
			span.className = "mlw-chip mlw-chip--dot";
			span.title = fullText;
		} else if (mode === ChipDisplayMode.Compact) {
			span.className = "mlw-chip mlw-chip--compact";
			span.textContent = (task.status === TaskStatus.Inbox && task.area_of_focus === "")
				? "\u{1F4E5}" : (task.area_of_focus || "Tracked");
			span.title = fullText;
		} else {
			span.className = "mlw-chip";
			span.textContent = fullText;
		}

		// Mousedown: modifier+click cycles mode, plain click opens editor
		span.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const settings = this.store.getSettings();
			const mod = settings.chipCycleModifier === "shift" ? e.shiftKey : e.ctrlKey;
			if (mod) {
				this.store.updateSettings({ chipDisplayMode: nextChipDisplayMode(settings.chipDisplayMode) });
				view.dispatch({});
				return;
			}
			const current = this.store.getTask(this.taskId);
			if (current === undefined) return;
			MetadataEditor.open(current, this.extractTaskText(view), span.getBoundingClientRect(), this.store, view);
		});

		return span;
	}

	eq(): boolean {
		// Always re-render — task metadata may have changed in the DataStore
		return false;
	}

	ignoreEvent(event: Event): boolean {
		return event.type === "mousedown" || event.type === "click";
	}

	private extractTaskText(view: EditorView): string {
		const doc = view.state.doc;
		const needle = "<!-- mlw:" + this.taskId + " -->";
		for (let i = 1; i <= doc.lines; i++) {
			const line = doc.line(i);
			if (line.text.includes(needle)) {
				return line.text
					.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "")
					.replace(MLW_COMMENT_STRIP_RE, "")
					.trim();
			}
		}
		return "";
	}

	private getAOFColor(aofName: string): AOFColor {
		if (aofName === "") return FALLBACK_AOF_COLOR;
		const aofs = this.store.getSettings().areasOfFocus;
		const match = aofs.find(a => a.name === aofName);
		return match?.color ?? FALLBACK_AOF_COLOR;
	}
}
