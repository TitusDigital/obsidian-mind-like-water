import type { DataStore } from "data/DataStore";

interface ReorderGroup {
	items: Array<{ el: HTMLElement; taskId: string }>;
}

/**
 * Manages drag-and-drop and keyboard reordering of task rows within a listEl.
 * Tasks can only be reordered within their group (AOF, project, context).
 */
export class TaskReorder {
	private groups: ReorderGroup[] = [];
	private draggedEl: HTMLElement | null = null;
	private dragGroupIdx = -1;
	private selectedEl: HTMLElement | null = null;
	private selectedGroupIdx = -1;
	private indicator: HTMLDivElement | null = null;
	private ac: AbortController | null = null;

	constructor(
		private readonly listEl: HTMLElement,
		private readonly store: DataStore,
		private readonly setLock: (locked: boolean) => void,
	) {}

	attach(): void {
		this.groups = this.parseGroups();
		if (this.groups.length === 0) return;

		// Inject grip handles
		for (const group of this.groups) {
			for (const { el } of group.items) {
				const grip = document.createElement("div");
				grip.className = "mlw-view-item__grip";
				grip.textContent = "\u2801\u2801";
				grip.draggable = true;
				el.insertBefore(grip, el.firstChild);
			}
		}

		this.ac = new AbortController();
		const o = { signal: this.ac.signal };
		this.listEl.addEventListener("dragstart", (e) => this.onDragStart(e), o);
		this.listEl.addEventListener("dragover", (e) => this.onDragOver(e), o);
		this.listEl.addEventListener("drop", (e) => this.onDrop(e), o);
		this.listEl.addEventListener("dragend", () => this.onDragEnd(), o);
		this.listEl.addEventListener("keydown", (e) => this.onKeyDown(e), o);
		this.listEl.addEventListener("click", (e) => this.onClick(e), o);
	}

	detach(): void {
		this.ac?.abort();
		this.ac = null;
		this.removeIndicator();
		this.deselect();
	}

	// ── Group Parsing ─────────────────────────────────────────────

	private parseGroups(): ReorderGroup[] {
		const groups: ReorderGroup[] = [];
		let current: ReorderGroup = { items: [] };
		for (const child of Array.from(this.listEl.children)) {
			const el = child as HTMLElement;
			if (el.classList.contains("mlw-view-group")) {
				if (current.items.length > 0) groups.push(current);
				current = { items: [] };
			} else if (el.classList.contains("mlw-view-item") && el.dataset.taskId) {
				current.items.push({ el, taskId: el.dataset.taskId });
			}
		}
		if (current.items.length > 0) groups.push(current);
		return groups;
	}

	private findGroup(el: HTMLElement): number {
		for (let g = 0; g < this.groups.length; g++) {
			if (this.groups[g]!.items.some(i => i.el === el)) return g;
		}
		return -1;
	}

	// ── Drag Events ───────────────────────────────────────────────

	private onDragStart(e: DragEvent): void {
		const grip = (e.target as HTMLElement).closest(".mlw-view-item__grip");
		if (grip === null) { e.preventDefault(); return; }
		const row = grip.closest(".mlw-view-item") as HTMLElement | null;
		if (row === null) { e.preventDefault(); return; }
		this.draggedEl = row;
		this.dragGroupIdx = this.findGroup(row);
		if (this.dragGroupIdx < 0) { e.preventDefault(); return; }
		row.classList.add("mlw-view-item--dragging");
		this.setLock(true);
		if (e.dataTransfer !== null) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", "");
		}
	}

	private onDragOver(e: DragEvent): void {
		if (this.draggedEl === null) return;
		e.preventDefault();
		if (e.dataTransfer !== null) e.dataTransfer.dropEffect = "move";

		const target = (e.target as HTMLElement).closest(".mlw-view-item") as HTMLElement | null;
		if (target === null || target === this.draggedEl) { this.removeIndicator(); return; }
		const targetGroup = this.findGroup(target);
		if (targetGroup !== this.dragGroupIdx) { this.removeIndicator(); return; }

		const rect = target.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		const before = e.clientY < midY;
		this.showIndicator(target, before);
	}

	private onDrop(e: DragEvent): void {
		e.preventDefault();
		if (this.draggedEl === null || this.indicator === null) { this.onDragEnd(); return; }
		// Move DOM element to indicator position
		this.indicator.parentElement?.insertBefore(this.draggedEl, this.indicator);
		this.removeIndicator();
		this.draggedEl.classList.remove("mlw-view-item--dragging");
		// Re-parse and persist
		this.groups = this.parseGroups();
		this.persistGroupOrder(this.findGroup(this.draggedEl));
		this.draggedEl = null;
		this.dragGroupIdx = -1;
	}

	private onDragEnd(): void {
		if (this.draggedEl !== null) {
			this.draggedEl.classList.remove("mlw-view-item--dragging");
			this.draggedEl = null;
			this.dragGroupIdx = -1;
		}
		this.removeIndicator();
		this.setLock(false);
	}

	// ── Drop Indicator ────────────────────────────────────────────

	private showIndicator(ref: HTMLElement, before: boolean): void {
		if (this.indicator === null) {
			this.indicator = document.createElement("div");
			this.indicator.className = "mlw-reorder-indicator";
		}
		if (before) ref.parentElement?.insertBefore(this.indicator, ref);
		else ref.parentElement?.insertBefore(this.indicator, ref.nextSibling);
	}

	private removeIndicator(): void {
		this.indicator?.remove();
		this.indicator = null;
	}

	// ── Keyboard & Selection ──────────────────────────────────────

	private onClick(e: MouseEvent): void {
		const grip = (e.target as HTMLElement).closest(".mlw-view-item__grip");
		if (grip === null) return;
		e.stopPropagation();
		const row = grip.closest(".mlw-view-item") as HTMLElement | null;
		if (row === null) return;
		if (this.selectedEl === row) { this.deselect(); return; }
		this.deselect();
		this.selectedEl = row;
		this.selectedGroupIdx = this.findGroup(row);
		row.classList.add("mlw-view-item--selected");
		row.tabIndex = 0;
		row.focus();
	}

	private deselect(): void {
		if (this.selectedEl !== null) {
			this.selectedEl.classList.remove("mlw-view-item--selected");
			this.selectedEl.tabIndex = -1;
			this.selectedEl = null;
			this.selectedGroupIdx = -1;
		}
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (this.selectedEl === null || this.selectedGroupIdx < 0) return;
		const group = this.groups[this.selectedGroupIdx];
		if (group === undefined) return;
		const items = group.items;
		const idx = items.findIndex(i => i.el === this.selectedEl);
		if (idx < 0) return;

		if (e.altKey && e.key === "ArrowUp" && idx > 0) {
			e.preventDefault();
			this.swapItems(this.selectedGroupIdx, idx, idx - 1);
		} else if (e.altKey && e.key === "ArrowDown" && idx < items.length - 1) {
			e.preventDefault();
			this.swapItems(this.selectedGroupIdx, idx, idx + 1);
		} else if (e.key === "ArrowUp" && !e.altKey && idx > 0) {
			e.preventDefault();
			this.selectByIndex(this.selectedGroupIdx, idx - 1);
		} else if (e.key === "ArrowDown" && !e.altKey && idx < items.length - 1) {
			e.preventDefault();
			this.selectByIndex(this.selectedGroupIdx, idx + 1);
		} else if (e.key === "Escape") {
			e.preventDefault();
			this.deselect();
		}
	}

	private selectByIndex(groupIdx: number, itemIdx: number): void {
		const item = this.groups[groupIdx]?.items[itemIdx];
		if (item === undefined) return;
		this.deselect();
		this.selectedEl = item.el;
		this.selectedGroupIdx = groupIdx;
		item.el.classList.add("mlw-view-item--selected");
		item.el.tabIndex = 0;
		item.el.focus();
	}

	private swapItems(groupIdx: number, fromIdx: number, toIdx: number): void {
		const group = this.groups[groupIdx];
		if (group === undefined) return;
		const fromItem = group.items[fromIdx];
		const toItem = group.items[toIdx];
		if (fromItem === undefined || toItem === undefined) return;

		// Swap in DOM
		const parent = fromItem.el.parentElement;
		if (parent === null) return;
		if (fromIdx < toIdx) parent.insertBefore(fromItem.el, toItem.el.nextSibling);
		else parent.insertBefore(fromItem.el, toItem.el);

		// Swap in array
		group.items[fromIdx] = toItem;
		group.items[toIdx] = fromItem;

		// Flash animation
		fromItem.el.classList.add("mlw-view-item--moved");
		setTimeout(() => fromItem.el.classList.remove("mlw-view-item--moved"), 400);

		this.persistGroupOrder(groupIdx);
	}

	// ── Persist ───────────────────────────────────────────────────

	private persistGroupOrder(groupIdx: number): void {
		const group = this.groups[groupIdx];
		if (group === undefined) return;
		this.setLock(true);
		for (let i = 0; i < group.items.length; i++) {
			const item = group.items[i];
			if (item !== undefined) this.store.updateTask(item.taskId, { sort_order: i });
		}
		this.setLock(false);
	}
}
