import type { EditorView } from "@codemirror/view";
import type { DataStore } from "data/DataStore";
import { type Task, type AOFColor, TaskStatus, FALLBACK_AOF_COLOR } from "data/models";
import { ProjectCreator } from "components/ProjectCreator";
import {
	STATUS_LABELS, ENERGY_LABELS,
	createSelectGroup, createDateGroup, populateSelect,
} from "components/fieldBuilders";

let activeEditor: MetadataEditor | null = null;

/** Singleton metadata editor popover. Click a chip → opens anchored near it. */
export class MetadataEditor {
	private backdrop!: HTMLDivElement;
	private popover!: HTMLDivElement;
	private projectSelect!: HTMLSelectElement;
	private projectRow!: HTMLDivElement;
	private aofGroup!: HTMLElement;
	private creatorOpen = false;
	private scrollHandler: (() => void) | null = null;

	private constructor(
		private task: Task,
		private readonly taskText: string,
		private readonly anchorRect: DOMRect,
		private readonly store: DataStore,
		private readonly view: EditorView,
	) {
		this.build();
		this.mount();
	}

	static open(
		task: Task, taskText: string, anchorRect: DOMRect,
		store: DataStore, view: EditorView,
	): void {
		if (activeEditor !== null) activeEditor.close();
		activeEditor = new MetadataEditor(task, taskText, anchorRect, store, view);
	}

	private build(): void {
		this.backdrop = this.el("div", "mlw-popover-backdrop");
		this.backdrop.addEventListener("mousedown", (e) => { if (e.target === this.backdrop) this.close(); });
		this.popover = this.el("div", "mlw-editor-popover");
		this.popover.addEventListener("keydown", (e) => this.handleKeyDown(e));
		this.backdrop.appendChild(this.popover);
		this.popover.append(this.buildHeader(), this.buildPreview(), this.buildFields(), this.buildFooter());
	}

	private mount(): void {
		document.body.appendChild(this.backdrop);
		const below = window.innerHeight - this.anchorRect.bottom;
		if (below > 420) this.popover.style.top = (this.anchorRect.bottom + 6) + "px";
		else this.popover.style.bottom = (window.innerHeight - this.anchorRect.top + 6) + "px";
		this.popover.style.left = Math.max(8, Math.min(this.anchorRect.left, window.innerWidth - 340)) + "px";
		this.scrollHandler = () => this.close();
		this.view.scrollDOM.addEventListener("scroll", this.scrollHandler, { once: true });
		const first = this.popover.querySelector("select");
		if (first !== null) requestAnimationFrame(() => first.focus());
	}

	close(): void {
		// Auto-promote: if task is still in Inbox but has an AOF, move to Next Action
		if (this.task.status === TaskStatus.Inbox && this.task.area_of_focus !== "") {
			this.store.updateTask(this.task.id, { status: TaskStatus.NextAction });
			this.view.dispatch({});
		}

		if (this.scrollHandler !== null) {
			this.view.scrollDOM.removeEventListener("scroll", this.scrollHandler);
			this.scrollHandler = null;
		}
		this.backdrop.remove();
		if (activeEditor === this) activeEditor = null;
	}

	private buildHeader(): HTMLElement {
		const header = this.el("div", "mlw-editor-header");
		const dot = this.el("span", "mlw-editor-header__dot");
		dot.style.backgroundColor = this.getAOFColor(this.task.area_of_focus).text;
		header.append(dot, this.el("span", "mlw-editor-header__title", "Edit Task"));
		const close = this.el("span", "mlw-editor-header__close", "\u00D7");
		close.addEventListener("click", () => this.close());
		header.appendChild(close);
		return header;
	}

	private buildPreview(): HTMLElement {
		const p = this.el("div", "mlw-editor-preview");
		const input = document.createElement("input");
		input.type = "text";
		input.className = "mlw-editor-preview__input";
		input.value = this.taskText;
		input.placeholder = "Task name…";
		input.addEventListener("change", () => this.updateTaskText(input.value.trim()));
		p.appendChild(input);
		return p;
	}

	private updateTaskText(newText: string): void {
		const doc = this.view.state.doc;
		const needle = "<!-- mlw:" + this.task.id + " -->";
		for (let i = 1; i <= doc.lines; i++) {
			const line = doc.line(i);
			if (!line.text.includes(needle)) continue;
			// Region between checkbox prefix and MLW comment is the task text
			const prefixMatch = /^(\s*[-*]\s+\[[ xX]\]\s*)/.exec(line.text);
			const commentIdx = line.text.indexOf(needle);
			if (prefixMatch === null || commentIdx < 0) return;
			const textFrom = line.from + prefixMatch[0].length;
			const textTo = line.from + commentIdx;
			const insert = newText === "" ? "" : newText + " ";
			this.view.dispatch({ changes: { from: textFrom, to: textTo, insert } });
			return;
		}
	}

	// ── Fields ──────────────────────────────────────────────────

	private buildFields(): HTMLElement {
		const c = this.el("div", "mlw-editor-fields");
		c.appendChild(createSelectGroup("Status", this.task.status, STATUS_LABELS, (v) => this.updateField("status", v), true));
		const row = (a: HTMLElement, b: HTMLElement) => { const r = this.el("div", "mlw-editor-fields__row"); r.append(a, b); return r; };
		this.aofGroup = this.buildAOFField();
		this.projectRow = this.el("div", "mlw-editor-fields__group") as HTMLDivElement;
		this.buildProjectFieldContent();
		c.appendChild(row(this.aofGroup, this.projectRow));
		c.appendChild(row(
			createDateGroup("Due Date", this.task.due_date, (v) => this.updateField("due_date", v || null)),
			createDateGroup("Start Date", this.task.start_date, (v) => this.updateField("start_date", v || null)),
		));
		c.appendChild(row(
			createSelectGroup("Energy", this.task.energy ?? "", { "": "None", ...ENERGY_LABELS }, (v) => this.updateField("energy", v === "" ? null : v)),
			this.buildContextField(),
		));
		c.appendChild(this.buildStarToggle());
		return c;
	}

	private buildAOFField(): HTMLElement {
		const aofs = this.store.getSettings().areasOfFocus;
		const options: Record<string, string> = { "": "None" };
		for (const aof of aofs) options[aof.name] = aof.name;
		return createSelectGroup("Area of Focus", this.task.area_of_focus, options, (v) => {
			this.updateField("area_of_focus", v);
			const projects = this.store.getProjectsForAOF(v);
			if (this.task.project !== null && !projects.includes(this.task.project)) {
				this.updateField("project", null);
			}
			this.rebuildProjectDropdown();
			const dot = this.popover.querySelector(".mlw-editor-header__dot") as HTMLElement | null;
			if (dot !== null) dot.style.backgroundColor = this.getAOFColor(v).text;
		});
	}

	private buildProjectFieldContent(): void {
		this.projectRow.innerHTML = "";
		this.creatorOpen = false;
		const labelRow = this.el("div", "mlw-editor-fields__label-row");
		labelRow.appendChild(this.el("label", "mlw-editor-label", "Project"));
		const addBtn = this.el("span", "mlw-project-add-btn", "+");
		addBtn.addEventListener("click", () => this.openProjectCreator());
		labelRow.appendChild(addBtn);
		this.projectRow.appendChild(labelRow);
		this.projectSelect = document.createElement("select");
		this.projectSelect.className = "mlw-editor-select";
		this.rebuildProjectDropdown();
		this.projectSelect.addEventListener("change", () => {
			const name = this.projectSelect.value === "" ? null : this.projectSelect.value;
			this.updateField("project", name);
			if (name !== null) this.syncAOFFromProject(name);
		});
		this.projectRow.appendChild(this.projectSelect);
	}

	private rebuildProjectDropdown(): void {
		const projects = this.store.getProjectsForAOF(this.task.area_of_focus);
		populateSelect(this.projectSelect, projects, this.task.project);
		// If current project isn't in the AOF list, still show it selected
		if (this.task.project !== null && !projects.includes(this.task.project)) {
			const opt = document.createElement("option");
			opt.value = this.task.project;
			opt.textContent = this.task.project;
			opt.selected = true;
			this.projectSelect.appendChild(opt);
		}
	}

	private openProjectCreator(): void {
		this.creatorOpen = true;
		new ProjectCreator(
			this.projectRow,
			this.task.area_of_focus || "Uncategorized",
			this.getAOFColor(this.task.area_of_focus),
			this.store,
			(name) => { this.updateField("project", name); this.buildProjectFieldContent(); },
			() => this.buildProjectFieldContent(),
		);
	}

	private buildContextField(): HTMLElement {
		const contexts = this.store.getSettings().contexts;
		const options: Record<string, string> = { "": "None" };
		for (const ctx of contexts) options[ctx] = ctx;
		return createSelectGroup("Context", this.task.context ?? "", options,
			(v) => this.updateField("context", v === "" ? null : v));
	}

	private buildStarToggle(): HTMLElement {
		const group = document.createElement("div");
		group.className = "mlw-editor-fields__group";
		const btn = document.createElement("button");
		const update = (starred: boolean) => {
			btn.className = "mlw-editor-star" + (starred ? " mlw-editor-star--active" : "");
			btn.textContent = starred ? "\u2B50 Starred" : "\u2606 Not starred";
		};
		update(this.task.starred);
		btn.addEventListener("click", () => {
			this.updateField("starred", !this.task.starred);
			update(this.task.starred);
		});
		group.appendChild(btn);
		return group;
	}

	// ── Footer ──────────────────────────────────────────────────

	private buildFooter(): HTMLElement {
		const footer = this.el("div", "mlw-editor-footer");
		footer.append(
			this.el("span", "mlw-editor-footer__id", "mlw:" + this.task.id),
			this.el("span", "mlw-editor-footer__hints", "Tab \u21B9 fields \u00B7 Enter \u21B5 save \u00B7 Esc close"),
		);
		const done = this.el("button", "mlw-editor-footer__done", "Done");
		done.addEventListener("click", () => this.close());
		footer.appendChild(done);
		return footer;
	}

	// ── Helpers ──────────────────────────────────────────────────

	private updateField(field: string, value: unknown): void {
		this.store.updateTask(this.task.id, { [field]: value } as Partial<Task>);
		const refreshed = this.store.getTask(this.task.id);
		if (refreshed !== undefined) this.task = refreshed;
		this.view.dispatch({});
	}

	private handleKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape" && !this.creatorOpen) {
			e.preventDefault();
			this.close();
		} else if (e.key === "Enter" && !this.creatorOpen) {
			if ((e.target as HTMLElement)?.tagName !== "INPUT") {
				e.preventDefault();
				this.close();
			}
		}
	}

	/** When a project is selected, sync the task's AOF to match the project's frontmatter. */
	private syncAOFFromProject(projectName: string): void {
		const projectAOF = this.store.getProjectAOF(projectName);
		if (projectAOF === "" || projectAOF === this.task.area_of_focus) return;
		this.updateField("area_of_focus", projectAOF);
		const aofSelect = this.aofGroup.querySelector("select");
		if (aofSelect !== null) (aofSelect as HTMLSelectElement).value = projectAOF;
		const dot = this.popover.querySelector(".mlw-editor-header__dot") as HTMLElement | null;
		if (dot !== null) dot.style.backgroundColor = this.getAOFColor(projectAOF).text;
		this.rebuildProjectDropdown();
	}

	private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
		const e = document.createElement(tag);
		e.className = cls;
		if (text !== undefined) e.textContent = text;
		return e;
	}

	private getAOFColor(aofName: string): AOFColor {
		if (aofName === "") return FALLBACK_AOF_COLOR;
		const aofs = this.store.getSettings().areasOfFocus;
		return aofs.find(a => a.name === aofName)?.color ?? FALLBACK_AOF_COLOR;
	}
}
