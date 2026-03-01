import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { ViewState } from "views/ViewState";

export interface ToolbarConfig {
	activeTab: string;
	tabLabels: [id: string, label: string][];
	onSwitchTab: (id: string) => void;
	store: DataStore;
}

/** Build the compact toolbar: AOF button, tab pills. */
export function buildToolbar(el: HTMLElement, cfg: ToolbarConfig, tabBtns: Map<string, HTMLElement>): void {
	// Skip rebuild while the AOF dropdown is open (multi-select in progress)
	if (el.querySelector(".mlw-aof__dropdown") !== null) return;
	el.empty();
	tabBtns.clear();

	// AOF button
	const aofWrap = el.createDiv("mlw-aof");
	const aofs = ViewState.getInstance().getActiveAOFs();
	const aofLabel = aofs.size === 0 ? "All Areas"
		: aofs.size === 1 ? (aofs.has("") ? "No Area" : [...aofs][0]!) : `${aofs.size} Areas`;
	const aofColor = aofs.size === 1 && !aofs.has("") ? getAOFColor(cfg.store, [...aofs][0]!) : "var(--text-muted)";
	const aofBtn = aofWrap.createEl("button", { cls: "mlw-aof__btn" });
	const dot = aofBtn.createSpan("mlw-aof__dot");
	dot.style.background = aofColor;
	aofBtn.createSpan({ text: aofLabel, cls: "mlw-aof__label" });
	aofBtn.createSpan({ text: "\u25BE", cls: "mlw-aof__caret" });
	aofBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleAOFDropdown(aofWrap, cfg.store); });

	el.createDiv("mlw-toolbar__sep");

	// Tab pills with label
	const tabsWrap = el.createDiv("mlw-toolbar__section");
	tabsWrap.createDiv({ text: "Lists", cls: "mlw-toolbar__label" });
	const tabsEl = tabsWrap.createDiv("mlw-toolbar__tabs");
	const inboxCount = cfg.store.getTasksByStatus(TaskStatus.Inbox).length;
	for (const [id, label] of cfg.tabLabels) {
		const btn = tabsEl.createEl("button", {
			text: label, cls: `mlw-tab-pill${id === cfg.activeTab ? " mlw-tab-pill--active" : ""}`,
		});
		if (id === "inbox" && inboxCount > 0) {
			btn.createSpan({ text: String(inboxCount), cls: "mlw-tab-pill__badge" });
		}
		btn.addEventListener("click", () => cfg.onSwitchTab(id));
		tabBtns.set(id, btn);
	}

}

function getAOFColor(store: DataStore, aofName: string): string {
	if (!aofName) return "var(--text-muted)";
	return store.getSettings().areasOfFocus.find(a => a.name === aofName)?.color.text ?? "var(--text-muted)";
}

function toggleAOFDropdown(wrapEl: HTMLElement, store: DataStore): void {
	const existing = wrapEl.querySelector(".mlw-aof__dropdown");
	if (existing) { existing.remove(); return; }

	const vs = ViewState.getInstance();
	const dropdown = wrapEl.createDiv("mlw-aof__dropdown");
	dropdown.createDiv({ text: "Filter Areas", cls: "mlw-aof__dropdown-title" });

	const renderOptions = () => {
		dropdown.querySelectorAll(".mlw-aof__option, .mlw-aof__dropdown-sep").forEach(el => el.remove());
		const aofs = vs.getActiveAOFs();
		const addOpt = (name: string, color: string | undefined, checked: boolean, onClick: () => void) => {
			const opt = dropdown.createEl("button", { cls: `mlw-aof__option${checked ? " mlw-aof__option--active" : ""}` });
			if (color !== undefined) { const d = opt.createSpan("mlw-aof__dot"); d.style.background = color; }
			opt.createSpan({ text: name });
			if (checked) opt.createSpan({ text: "\u2713", cls: "mlw-aof__check" });
			opt.addEventListener("click", () => { onClick(); renderOptions(); });
		};
		addOpt("All Areas", "var(--text-muted)", aofs.size === 0, () => vs.clearAOFs());
		for (const aof of store.getSettings().areasOfFocus) {
			addOpt(aof.name, aof.color.text, aofs.has(aof.name), () => vs.toggleAOF(aof.name));
		}
		dropdown.createDiv("mlw-aof__dropdown-sep");
		addOpt("No Area", "var(--text-faint)", aofs.has(""), () => vs.toggleAOF(""));
	};
	renderOptions();

	const close = (e: MouseEvent) => {
		if (!wrapEl.contains(e.target as Node)) {
			dropdown.remove();
			document.removeEventListener("mousedown", close);
			vs.notify(); // Rebuild toolbar now that dropdown is gone
		}
	};
	setTimeout(() => document.addEventListener("mousedown", close), 0);
}
