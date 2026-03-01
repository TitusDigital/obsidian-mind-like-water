export type GroupMode = "aof" | "project" | "context" | "none";

/**
 * Singleton reactive store for global view state.
 * Session-only — not persisted to data.json.
 */
export class ViewState {
	private static instance: ViewState | null = null;
	private activeAOFs = new Set<string>();
	private groupMode: GroupMode = "aof";
	private listeners = new Set<() => void>();

	static getInstance(): ViewState {
		if (ViewState.instance === null) {
			ViewState.instance = new ViewState();
		}
		return ViewState.instance;
	}

	/** Get active AOF filters. Empty set = "All" (no filtering). */
	getActiveAOFs(): ReadonlySet<string> { return this.activeAOFs; }

	/** Toggle an AOF in/out of the active set. */
	toggleAOF(aof: string): void {
		if (this.activeAOFs.has(aof)) this.activeAOFs.delete(aof);
		else this.activeAOFs.add(aof);
		for (const fn of this.listeners) fn();
	}

	/** Clear all AOF filters (back to "All Areas"). */
	clearAOFs(): void {
		if (this.activeAOFs.size === 0) return;
		this.activeAOFs = new Set();
		for (const fn of this.listeners) fn();
	}

	/** Get the active grouping mode. */
	getGroupMode(): GroupMode { return this.groupMode; }

	/** Set the active grouping mode. */
	setGroupMode(mode: GroupMode): void {
		if (mode === this.groupMode) return;
		this.groupMode = mode;
		for (const fn of this.listeners) fn();
	}

	/** Force a notification to all listeners without changing state. */
	notify(): void { for (const fn of this.listeners) fn(); }

	/** Subscribe to state changes. Returns an unsubscribe function. */
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
}
