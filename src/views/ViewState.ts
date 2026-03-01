export type GroupMode = "aof" | "project" | "context" | "none";

/**
 * Singleton reactive store for global view state.
 * Session-only — not persisted to data.json.
 */
export class ViewState {
	private static instance: ViewState | null = null;
	private activeAOF = "";
	private groupMode: GroupMode = "aof";
	private listeners = new Set<() => void>();

	static getInstance(): ViewState {
		if (ViewState.instance === null) {
			ViewState.instance = new ViewState();
		}
		return ViewState.instance;
	}

	/** Get the active AOF filter. Empty string = "All" (no filtering). */
	getActiveAOF(): string { return this.activeAOF; }

	/** Set the active AOF filter. Empty string = "All". */
	setActiveAOF(aof: string): void {
		if (aof === this.activeAOF) return;
		this.activeAOF = aof;
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

	/** Subscribe to state changes. Returns an unsubscribe function. */
	subscribe(fn: () => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}
}
