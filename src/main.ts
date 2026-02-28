import { Plugin, normalizePath, Platform } from "obsidian";
import { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { MLWSettingTab } from "settings/MLWSettings";
import { mlwEditorExtension } from "editor/ChipDecoration";
import { canTrackLine, trackTaskWithEditor } from "editor/trackTask";
import { QuickCaptureModal } from "capture/QuickCaptureModal";
import { InboxView } from "views/InboxView";
import { VIEW_TYPE_MLW_INBOX, INBOX_ICON } from "views/InboxViewConstants";
import { StatusBarWidget } from "widgets/StatusBarWidget";

export default class MindLikeWaterPlugin extends Plugin {
	store!: DataStore;
	private statusBarWidget: StatusBarWidget | null = null;
	private ribbonBadgeEl!: HTMLSpanElement;

	async onload(): Promise<void> {
		console.log("Loading Mind Like Water plugin");

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
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "i" }],
			callback: () => {
				new QuickCaptureModal(this.app, this.store).open();
			},
		});

		this.addCommand({
			id: "open-inbox",
			name: "Open Inbox",
			callback: () => void this.activateInboxView(),
		});

		// ── Inbox View ────────────────────────────────────────
		this.registerView(
			VIEW_TYPE_MLW_INBOX,
			(leaf) => new InboxView(leaf, this.store),
		);

		// ── Ribbon Icon + Badge ───────────────────────────────
		const ribbonEl = this.addRibbonIcon(INBOX_ICON, "Open Inbox", () => {
			void this.activateInboxView();
		});
		ribbonEl.addClass("mlw-ribbon-inbox");
		this.ribbonBadgeEl = ribbonEl.createSpan("mlw-ribbon-badge");

		// ── Status Bar (desktop only) ─────────────────────────
		if (Platform.isDesktop) {
			this.statusBarWidget = new StatusBarWidget(this.addStatusBarItem(), this.store);
		}

		// ── Reactive Updates ──────────────────────────────────
		this.store.setOnChange(() => this.onTasksChanged());

		await this.ensureProjectFolder();
	}

	onunload(): void {
		console.log("Unloading Mind Like Water plugin");
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MLW_INBOX);
		void this.store.saveImmediate();
	}

	private async activateInboxView(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_INBOX);
		if (leaves.length > 0 && leaves[0] !== undefined) {
			await this.app.workspace.revealLeaf(leaves[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf !== null) {
			await leaf.setViewState({ type: VIEW_TYPE_MLW_INBOX, active: true });
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	private onTasksChanged(): void {
		this.statusBarWidget?.update();

		const count = this.store.getTaskCountByStatus(TaskStatus.Inbox);
		if (count > 0) {
			this.ribbonBadgeEl.textContent = count > 99 ? "99+" : String(count);
			this.ribbonBadgeEl.style.display = "";
		} else {
			this.ribbonBadgeEl.style.display = "none";
		}

		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_INBOX)) {
			if (leaf.view instanceof InboxView) {
				leaf.view.refresh();
			}
		}
	}

	private async ensureProjectFolder(): Promise<void> {
		const folderPath = normalizePath(this.store.getSettings().projectFolder);
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) await this.app.vault.createFolder(folderPath);
	}
}
