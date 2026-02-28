// Minimal stubs for the obsidian module used in tests
export const editorInfoField = {};
export const editorLivePreviewField = {};
export class TAbstractFile { path = ""; }
export class TFile extends TAbstractFile { extension = "md"; }
export class Modal { app: unknown; constructor(app: unknown) { this.app = app; } open() {} close() {} setTitle(_t: string) {} contentEl = { empty() {}, addClass(_c: string) {}, createEl: () => document.createElement("div") }; scope = {}; }
export class ItemView { app: unknown; leaf: unknown; contentEl = { empty() {}, addClass(_c: string) {}, createDiv: () => document.createElement("div"), createEl: () => document.createElement("div") }; constructor(leaf: unknown) { this.leaf = leaf; this.app = {}; } getViewType() { return ""; } getDisplayText() { return ""; } getIcon() { return ""; } }
export class Plugin { app = {}; registerEvent(_e: unknown) {} }
export class WorkspaceLeaf {}
export class Notice { constructor(_msg: string) {} }
export function normalizePath(p: string) { return p; }
export const moment = () => ({ format: (f: string) => f });
export const Platform = { isDesktop: true };
