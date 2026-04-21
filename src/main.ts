import { Plugin, normalizePath, Platform, TFile, Notice } from "obsidian";
import { DataStore } from "data/DataStore";
import { formatRunSummary } from "data/migrations";
import { TaskStatus, nextChipDisplayMode } from "data/models";
import { MLWSettingTab } from "settings/MLWSettings";
import { mlwEditorExtension } from "editor/ChipDecoration";
import { canTrackLine, trackTaskWithEditor } from "editor/trackTask";
import { registerCheckboxWatcher } from "editor/CheckboxWatcher";
import { QuickCaptureModal } from "capture/QuickCaptureModal";
import { UnifiedTaskView } from "views/UnifiedTaskView";
import { VIEW_TYPE_MLW_UNIFIED, UNIFIED_ICON } from "views/ViewConstants";
import { StatusBarWidget } from "widgets/StatusBarWidget";
import { runScheduler } from "services/SchedulerService";
import { onPluginLoad as runRecurrenceCheck, pauseAllRecurrence, resumeAllRecurrence } from "services/RecurrenceService";
import { runIntegrityCheck } from "services/IntegrityChecker";
import { registerFocusBlock, registerCompletedBlock, registerProjectTasksBlock } from "codeblocks/registerCodeblocks";
import { NirvanaImportModal } from "import/NirvanaImportModal";
import { UuidMigrationModal } from "data/UuidMigrationModal";

export default class MindLikeWaterPlugin extends Plugin {
	store!: DataStore;
	private statusBarWidget: StatusBarWidget | null = null;
	private ribbonBadgeEl!: HTMLSpanElement;
	private pauseIndicator: HTMLElement | null = null;

	async onload(): Promise<void> {

		this.store = new DataStore(this);
		await this.store.load();

		this.addSettingTab(new MLWSettingTab(this.app, this));
		this.registerEditorExtension(mlwEditorExtension(this.store));

		// ── Commands ───────────────────────────────────────────
		this.addCommand({
			id: "track-task",
			name: "Track Task",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "t" }],
			editorCheckCallback: (checking, editor, ctx) => {
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				if (!canTrackLine(lineText)) return false;
				if (!checking) trackTaskWithEditor(editor, ctx, this.store);
				return true;
			},
		});

		this.addCommand({
			id: "quick-capture",
			name: "Quick Capture",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "q" }],
			callback: () => {
				new QuickCaptureModal(this.app, this.store).open();
			},
		});

		this.addCommand({ id: "open-view", name: "Open Mind Like Water", callback: () => void this.openTab("focus") });

		this.addCommand({
			id: "import-nirvana",
			name: "Import from Nirvana",
			callback: () => { new NirvanaImportModal(this.app, this.store).open(); },
		});

		this.addCommand({
			id: "preview-migrations",
			name: "Preview data migrations (dry run)",
			callback: () => {
				void this.store.previewMigrations().then(summary => {
					const msg = formatRunSummary(summary);
					console.info("[MLW migration] preview", msg, summary);
					new Notice(`Mind Like Water: ${msg}`, 8000);
				}).catch((e: unknown) => {
					console.error("MLW: Migration preview failed", e);
					new Notice("Mind Like Water: migration preview failed — see console.");
				});
			},
		});

		this.addCommand({
			id: "migrate-uuid-ids",
			name: "Migrate task IDs to UUID (one-time, back up vault first)",
			callback: () => { new UuidMigrationModal(this.app, this.store).open(); },
		});

		this.addCommand({
			id: "cycle-chip-display",
			name: "Cycle chip display mode (full \u2192 compact \u2192 dot)",
			callback: () => {
				const current = this.store.getSettings().chipDisplayMode;
				this.store.updateSettings({ chipDisplayMode: nextChipDisplayMode(current) });
				this.refreshEditorChips();
			},
		});

		this.addCommand({
			id: "pause-all-recurrence",
			name: "Pause all recurring tasks",
			callback: () => {
				const count = this.store.getAllTasks().filter(t => t.recurrence_rule !== null && !t.recurrence_suspended).length;
				if (count === 0) { new Notice("No active recurring tasks to pause."); return; }
				pauseAllRecurrence(this.store);
				new Notice(`Paused ${count} recurring task(s).`);
			},
		});

		this.addCommand({
			id: "resume-all-recurrence",
			name: "Resume all recurring tasks",
			callback: () => {
				const count = this.store.getAllTasks().filter(t => t.recurrence_rule !== null && t.recurrence_suspended).length;
				if (count === 0) { new Notice("No paused recurring tasks to resume."); return; }
				void resumeAllRecurrence(this.store).then(() => {
					new Notice(`Resumed ${count} recurring task(s).`);
				}).catch(e => console.error("MLW: Resume recurrence failed", e));
			},
		});

		// ── View ──────────────────────────────────────────────
		this.registerView(VIEW_TYPE_MLW_UNIFIED, (leaf) => new UnifiedTaskView(leaf, this.store));

		// ── Ribbon Icon + Badge ───────────────────────────────
		const ribbonEl = this.addRibbonIcon(UNIFIED_ICON, "Open Mind Like Water", () => {
			void this.openTab("focus");
		});
		ribbonEl.addClass("mlw-ribbon-inbox");
		this.ribbonBadgeEl = ribbonEl.createSpan("mlw-ribbon-badge");

		// ── Status Bar (desktop only) ─────────────────────────
		if (Platform.isDesktop) {
			this.statusBarWidget = new StatusBarWidget(this.addStatusBarItem(), this.store);
			this.pauseIndicator = this.addStatusBarItem();
			this.pauseIndicator.addClass("mlw-pause-indicator");
			this.updatePauseIndicator();
		}

		// ── Codeblock Processors ─────────────────────────────
		registerFocusBlock(this, this.store);
		registerCompletedBlock(this, this.store);
		registerProjectTasksBlock(this, this.store);

		// ── Checkbox Watcher ──────────────────────────────────
		registerCheckboxWatcher(this, this.store);

		// ── Scheduler (auto-transition scheduled tasks) ───────
		runScheduler(this.store);

		// ── Recurrence (spawn missed fixed-schedule instances) ─
		void runRecurrenceCheck(this.store).catch(e => console.error("MLW: Recurrence check failed", e));

		// ── Integrity Check (deferred for metadata cache warmup) ─
		setTimeout(() => {
			this.store.repairTaskProjectAOFs();
			void runIntegrityCheck(this.app, this.store).then(report => {
				for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_UNIFIED)) {
					(leaf.view as UnifiedTaskView).setIntegrityReport(report);
				}
				this.refreshAllViews();
			}).catch(e => console.error("MLW: Integrity check failed", e));
		}, 2000);

		// ── File Delete → mark tasks orphaned ─────────────────
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				for (const task of this.store.getAllTasks()) {
					if (task.source_file === file.path) {
						this.store.updateTask(task.id, { source_line: -1 });
					}
				}
			}),
		);

		// ── File Rename → update source_file on affected tasks ──
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				for (const task of this.store.getAllTasks()) {
					if (task.source_file === oldPath) {
						this.store.updateTask(task.id, { source_file: file.path });
					}
				}
			}),
		);

		// ── Reactive Updates ──────────────────────────────────
		this.store.setOnChange(() => this.onTasksChanged());

		// Refresh views when any markdown file changes (catches text renames)
		let fileChangeTimer: ReturnType<typeof setTimeout> | null = null;
		this.registerEvent(
			this.app.vault.on("modify", () => {
				if (fileChangeTimer !== null) clearTimeout(fileChangeTimer);
				fileChangeTimer = setTimeout(() => {
					fileChangeTimer = null;
					this.refreshAllViews();
				}, 200);
			}),
		);

		await this.ensureProjectFolder();
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MLW_UNIFIED);
		void this.store.saveImmediate();
	}

	private async openTab(tabId: string): Promise<void> {
		try {
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_UNIFIED);
			if (leaves.length > 0 && leaves[0] !== undefined) {
				await this.app.workspace.revealLeaf(leaves[0]);
				(leaves[0].view as UnifiedTaskView).switchTab(tabId);
				return;
			}
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf !== null) {
				await leaf.setViewState({ type: VIEW_TYPE_MLW_UNIFIED, active: true });
				await this.app.workspace.revealLeaf(leaf);
				(leaf.view as UnifiedTaskView).switchTab(tabId);
			}
		} catch (e) { console.error("MLW: Failed to open tab", e); }
	}

	private updatePauseIndicator(): void {
		if (this.pauseIndicator === null) return;
		const paused = this.store.getSettings().recurrenceGloballyPaused;
		this.pauseIndicator.textContent = paused ? "\u23F8 Recurrence paused" : "";
		this.pauseIndicator.style.display = paused ? "" : "none";
	}

	private onTasksChanged(): void {
		this.statusBarWidget?.update();
		this.updatePauseIndicator();

		const count = this.store.getTaskCountByStatus(TaskStatus.Inbox);
		if (count > 0) {
			this.ribbonBadgeEl.textContent = count > 99 ? "99+" : String(count);
			this.ribbonBadgeEl.style.display = "";
		} else {
			this.ribbonBadgeEl.style.display = "none";
		}

		// Review reminder indicator
		const settings = this.store.getSettings();
		const needsReview = settings.lastReviewDate === null ||
			(Date.now() - new Date(settings.lastReviewDate).getTime()) > settings.reviewReminderDays * 86400000;
		this.ribbonBadgeEl.toggleClass("mlw-ribbon-badge--review", needsReview);

		this.refreshAllViews();
	}

	private refreshAllViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_UNIFIED)) {
			const view = leaf.view as UnifiedTaskView;
			if (typeof view.refresh === "function") view.refresh();
		}
	}

	/** Force CM6 to re-render chips in all open editors. */
	refreshEditorChips(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			const cm = (leaf.view as unknown as Record<string, unknown>)?.["editor"] as Record<string, unknown> | undefined;
			const editorView = cm?.["cm"] as { dispatch?: (tr: object) => void } | undefined;
			if (editorView?.dispatch !== undefined) editorView.dispatch({});
		});
	}

	private async ensureProjectFolder(): Promise<void> {
		try {
			const folderPath = this.store.getSettings().projectFolder;
			if (folderPath === "") return;
			const exists = await this.app.vault.adapter.exists(folderPath);
			if (!exists) await this.app.vault.createFolder(folderPath);
		} catch (e) { console.error("MLW: Failed to create project folder", e); }
	}
}
