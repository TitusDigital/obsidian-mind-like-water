import { type App, Modal, Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { NirvanaItem, ImportOptions, ImportSummary } from "./nirvanaTypes";
import { computeSummary } from "./nirvanaMapper";
import { runNirvanaImport } from "./nirvanaImporter";

export class NirvanaImportModal extends Modal {
	private items: NirvanaItem[] | null = null;
	private summary: ImportSummary | null = null;
	private options: ImportOptions = {
		importActiveTasks: true,
		importCompletedTasks: false,
		importActiveProjects: true,
	};

	private summaryEl!: HTMLElement;
	private optionsEl!: HTMLElement;
	private actionsEl!: HTMLElement;
	private importBtn!: HTMLButtonElement;

	constructor(app: App, private readonly store: DataStore) { super(app); }

	onOpen(): void {
		this.setTitle("Import from Nirvana");
		const { contentEl } = this;
		contentEl.addClass("mlw-import-modal");

		// File input
		const fileRow = contentEl.createDiv("mlw-import-file-row");
		const fileInput = fileRow.createEl("input", {
			type: "file",
			attr: { accept: ".json" },
			cls: "mlw-import-file-input",
		});
		const fileLabel = fileRow.createDiv({ text: "Select your Nirvana export JSON file", cls: "mlw-import-file-label" });
		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			if (file !== undefined) {
				fileLabel.textContent = file.name;
				void this.handleFileSelect(file);
			}
		});

		// Summary (hidden until file loaded)
		this.summaryEl = contentEl.createDiv("mlw-import-summary");
		this.summaryEl.style.display = "none";

		// Options (hidden until file loaded)
		this.optionsEl = contentEl.createDiv("mlw-import-options");
		this.optionsEl.style.display = "none";

		// Actions
		this.actionsEl = contentEl.createDiv("mlw-import-actions");
		this.importBtn = this.actionsEl.createEl("button", { text: "Import", cls: "mod-cta mlw-import-btn" });
		this.importBtn.disabled = true;
		this.importBtn.addEventListener("click", () => void this.doImport());
	}

	onClose(): void { this.contentEl.empty(); }

	private async handleFileSelect(file: File): Promise<void> {
		try {
			const text = await file.text();
			const parsed = JSON.parse(text);
			if (!Array.isArray(parsed)) {
				new Notice("Invalid file: expected a JSON array.");
				return;
			}
			if (parsed.length > 0 && !("name" in parsed[0] && "state" in parsed[0])) {
				new Notice("Invalid file: does not look like a Nirvana export.");
				return;
			}

			this.items = parsed as NirvanaItem[];
			this.summary = computeSummary(this.items);
			this.renderSummary();
			this.renderOptions();
			this.importBtn.disabled = false;
		} catch (e) {
			new Notice(`Failed to parse JSON: ${String(e)}`);
		}
	}

	private renderSummary(): void {
		const s = this.summary!;
		this.summaryEl.empty();
		this.summaryEl.style.display = "";

		this.summaryEl.createDiv({ text: "Summary", cls: "mlw-import-section-title" });
		const stats = this.summaryEl.createDiv("mlw-import-stats");
		stats.createDiv({ text: `${s.totalItems.toLocaleString()} total items` });
		stats.createDiv({ text: `${s.activeTasks} active tasks` });
		stats.createDiv({ text: `${s.completedTasks.toLocaleString()} completed \u00B7 ${s.cancelledTasks.toLocaleString()} cancelled` });
		stats.createDiv({ text: `${s.activeProjects} active projects \u00B7 ${s.somedayProjects} someday projects` });
		stats.createDiv({ text: `${s.recurringTemplates} recurring (skip) \u00B7 ${s.referenceItems} reference (skip)` });
	}

	private renderOptions(): void {
		this.optionsEl.empty();
		this.optionsEl.style.display = "";

		this.optionsEl.createDiv({ text: "Options", cls: "mlw-import-section-title" });
		this.addCheckbox(this.optionsEl, `Import active tasks (${this.summary!.activeTasks})`,
			this.options.importActiveTasks, (v) => { this.options.importActiveTasks = v; });
		this.addCheckbox(this.optionsEl, `Import completed tasks (${this.summary!.completedTasks.toLocaleString()})`,
			this.options.importCompletedTasks, (v) => { this.options.importCompletedTasks = v; });
		this.addCheckbox(this.optionsEl, `Import active projects (${this.summary!.activeProjects})`,
			this.options.importActiveProjects, (v) => { this.options.importActiveProjects = v; });
	}

	private addCheckbox(parent: HTMLElement, label: string, checked: boolean, onChange: (v: boolean) => void): void {
		const row = parent.createEl("label", { cls: "mlw-import-option" });
		const cb = row.createEl("input", { type: "checkbox" });
		cb.checked = checked;
		cb.addEventListener("change", () => onChange(cb.checked));
		row.createSpan({ text: label });
	}

	private async doImport(): Promise<void> {
		if (this.items === null) return;

		// Disable controls
		this.importBtn.disabled = true;
		this.optionsEl.querySelectorAll("input").forEach(i => (i as HTMLInputElement).disabled = true);

		// Add progress area
		const progressEl = this.actionsEl.createDiv("mlw-import-progress");
		const progressText = progressEl.createDiv("mlw-import-progress__text");
		const progressBarOuter = progressEl.createDiv("mlw-import-progress__bar-outer");
		const progressBar = progressBarOuter.createDiv("mlw-import-progress__bar");
		this.importBtn.style.display = "none";

		try {
			const result = await runNirvanaImport(
				this.app, this.store, this.items, this.options,
				(p) => {
					progressText.textContent = `${p.phase}... ${p.current}/${p.total}`;
					const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
					progressBar.style.width = `${pct}%`;
				},
			);

			// Show results
			this.actionsEl.empty();
			const resultEl = this.actionsEl.createDiv("mlw-import-result");
			resultEl.createDiv({ text: "Import Complete!", cls: "mlw-import-result__title" });
			resultEl.createDiv({ text: `${result.projectsCreated} projects created` });
			resultEl.createDiv({ text: `${result.tasksImported} tasks imported` });
			if (result.tasksSkipped > 0) {
				resultEl.createDiv({ text: `${result.tasksSkipped} items skipped` });
			}
			for (const err of result.errors) {
				resultEl.createDiv({ text: err, cls: "mlw-import-result__error" });
			}

			const closeBtn = this.actionsEl.createEl("button", { text: "Close", cls: "mod-cta mlw-import-btn" });
			closeBtn.addEventListener("click", () => this.close());

			new Notice(`Imported ${result.tasksImported} tasks and ${result.projectsCreated} projects from Nirvana.`);
		} catch (e) {
			new Notice(`Import failed: ${String(e)}`);
			progressText.textContent = `Error: ${String(e)}`;
			this.importBtn.style.display = "";
			this.importBtn.disabled = false;
		}
	}
}
