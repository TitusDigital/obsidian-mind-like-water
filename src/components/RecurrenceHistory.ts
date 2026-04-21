import { Modal, type App, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { getRecurrenceSummary } from "services/RecurrenceService";

/** Modal showing the history of all instances in a recurrence chain. */
export class RecurrenceHistoryModal extends Modal {
	constructor(app: App, private readonly store: DataStore, private readonly task: Task) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("mlw-recurrence-history");

		const templateId = this.task.recurrence_template_id ?? this.task.id;
		const instances = this.store.getTasksByTemplateId(templateId)
			.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));

		// Header
		const header = contentEl.createDiv("mlw-recurrence-history__header");
		header.createEl("h3", { text: "Recurrence History" });
		if (this.task.recurrence_rule !== null) {
			header.createEl("p", {
				text: getRecurrenceSummary(this.task.recurrence_rule, this.task.recurrence_type),
				cls: "mlw-recurrence-history__summary",
			});
		}
		header.createEl("p", {
			text: `${instances.length} instance${instances.length !== 1 ? "s" : ""}`,
			cls: "mlw-recurrence-history__count",
		});

		// Instance list
		const list = contentEl.createDiv("mlw-recurrence-history__list");
		for (const inst of instances) {
			const row = list.createDiv("mlw-recurrence-history__row");
			const isCurrent = inst.id === this.task.id;
			if (isCurrent) row.addClass("mlw-recurrence-history__row--current");

			// Status badge
			const statusMap: Record<string, string> = {
				[TaskStatus.Done]: "\u2705",
				[TaskStatus.Dropped]: "\u274C",
				[TaskStatus.Active]: "\u25CB",
				[TaskStatus.Scheduled]: "\uD83D\uDDD3\uFE0F",
				[TaskStatus.Inbox]: "\uD83D\uDCE5",
				[TaskStatus.Someday]: "\uD83D\uDCA4",
			};
			row.createSpan({ text: statusMap[inst.status] ?? "\u25CB", cls: "mlw-recurrence-history__status" });

			// Text
			const text = inst.cached_text ?? `Task ${inst.id}`;
			row.createSpan({ text, cls: "mlw-recurrence-history__text" });

			// Dates
			const meta = row.createDiv("mlw-recurrence-history__meta");
			if (inst.start_date !== null) meta.createSpan({ text: `Start: ${inst.start_date}`, cls: "mlw-recurrence-history__date" });
			if (inst.completed_date !== null) {
				const completedDate = inst.completed_date.slice(0, 10);
				meta.createSpan({ text: `Done: ${completedDate}`, cls: "mlw-recurrence-history__date" });
			}
			if (isCurrent) meta.createSpan({ text: "(current)", cls: "mlw-recurrence-history__current-tag" });

			// Click to navigate
			row.addEventListener("click", () => {
				const file = this.app.vault.getAbstractFileByPath(inst.source_file);
				if (file instanceof TFile) {
					void this.app.workspace.getLeaf(false).openFile(file, { eState: { line: inst.source_line - 1 } });
					this.close();
				}
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
