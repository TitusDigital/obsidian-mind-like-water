import { App, Modal, Notice, Setting } from "obsidian";
import type { DataStore } from "data/DataStore";
import { formatRunSummary } from "data/migrations";

/**
 * Confirmation modal for the one-shot UUID migration. Rewrites every
 * `<!-- mlw:xxxxxx -->` comment in the vault from 6-char hex to UUID.
 *
 * Guard rails:
 *   - Dry-run preview is shown first with impact counts.
 *   - User must type "MIGRATE" exactly to enable the run button.
 *   - Strong warning copy emphasizes that the user should have a vault backup.
 */
export class UuidMigrationModal extends Modal {
	private confirmInput!: HTMLInputElement;
	private runButton!: HTMLButtonElement;

	constructor(app: App, private readonly store: DataStore) {
		super(app);
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Migrate task IDs to UUID" });

		const intro = contentEl.createDiv();
		intro.createEl("p", {
			text: "This rewrites every <!-- mlw:abc123 --> comment in your vault to a UUID, and updates data.json to match. This is required before bidirectional sync with MLW Cloud is enabled.",
		});
		intro.createEl("p", {
			text: "Before running: make a full vault backup. The migration resumes automatically if interrupted, but no guarantees cover simultaneous edits from other devices or from Obsidian Sync.",
		}).style.color = "var(--text-warning)";

		const impactSummary = contentEl.createDiv();
		impactSummary.setText("Computing impact…");

		void this.store.runUuidMigration({ dryRun: true }).then(summary => {
			impactSummary.empty();
			const msg = formatRunSummary(summary);
			const lines = impactSummary.createDiv();
			lines.createEl("strong", { text: "Dry-run result" });
			lines.createEl("div", { text: msg });
			if (summary.entries.length > 0) {
				const entry = summary.entries[0]!;
				const stats = entry.result.stats;
				const ul = lines.createEl("ul");
				ul.createEl("li", { text: `${stats["tasksMappedNew"] ?? 0} task IDs will be reassigned.` });
				ul.createEl("li", { text: `${stats["filesScanned"] ?? 0} vault files scanned.` });
				ul.createEl("li", { text: `${stats["filesRewritten"] ?? 0} files would be updated, rewriting ${stats["commentsRewritten"] ?? 0} comments.` });
				if ((stats["legacyIdsLeftUnmapped"] ?? 0) > 0) {
					ul.createEl("li", {
						text: `${stats["legacyIdsLeftUnmapped"]} legacy ID(s) in markdown have no matching data.json entry and will be left alone.`,
					}).style.color = "var(--text-warning)";
				}
			}
		}).catch((e: unknown) => {
			impactSummary.setText(`Preview failed: ${String(e)}`);
		});

		new Setting(contentEl)
			.setName("Type MIGRATE to confirm")
			.setDesc("This is a one-time action. Back up your vault first.")
			.addText(text => {
				this.confirmInput = text.inputEl;
				text.onChange(v => {
					this.runButton.disabled = v !== "MIGRATE";
				});
			});

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		const cancel = buttons.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => this.close());

		this.runButton = buttons.createEl("button", { text: "Run migration", cls: "mod-warning" });
		this.runButton.disabled = true;
		this.runButton.addEventListener("click", () => {
			if (this.confirmInput.value !== "MIGRATE") return;
			this.runButton.disabled = true;
			this.runButton.setText("Migrating…");
			void this.store.runUuidMigration({ dryRun: false }).then(summary => {
				console.info("[MLW migration] UUID", formatRunSummary(summary), summary);
				const stats = summary.entries[0]?.result.stats ?? {};
				new Notice(
					`Mind Like Water: UUID migration complete. ` +
					`${stats["filesRewritten"] ?? 0} files rewrote, ` +
					`${stats["commentsRewritten"] ?? 0} comments updated.`,
					10000,
				);
				this.close();
			}).catch((e: unknown) => {
				console.error("MLW: UUID migration failed", e);
				new Notice("Mind Like Water: UUID migration failed — see console.");
				this.runButton.disabled = false;
				this.runButton.setText("Run migration");
			});
		});
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
