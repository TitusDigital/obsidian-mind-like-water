import { Plugin, normalizePath } from "obsidian";
import { DataStore } from "data/DataStore";
import { MLWSettingTab } from "settings/MLWSettings";
import { mlwEditorExtension } from "editor/ChipDecoration";
import { canTrackLine, trackTaskWithEditor } from "editor/trackTask";

export default class MindLikeWaterPlugin extends Plugin {
	store!: DataStore;

	async onload(): Promise<void> {
		console.log("Loading Mind Like Water plugin");

		this.store = new DataStore(this);
		await this.store.load();

		this.addSettingTab(new MLWSettingTab(this.app, this));

		// Register CM6 editor extension (chip rendering + track button)
		this.registerEditorExtension(mlwEditorExtension(this.store));

		// Register Track Task command (Cmd+Shift+T)
		this.addCommand({
			id: "track-task",
			name: "Track Task",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "t" }],
			editorCheckCallback: (checking, editor, ctx) => {
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				if (!canTrackLine(lineText)) return false;
				if (!checking) {
					trackTaskWithEditor(editor, ctx, this.store);
				}
				return true;
			},
		});

		await this.ensureProjectFolder();
	}

	onunload(): void {
		console.log("Unloading Mind Like Water plugin");
		void this.store.saveImmediate();
	}

	/** Create the configured project folder if it does not exist. */
	private async ensureProjectFolder(): Promise<void> {
		const folderPath = normalizePath(this.store.getSettings().projectFolder);
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}
