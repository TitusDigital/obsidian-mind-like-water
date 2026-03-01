import type { Task } from "data/models";

/** A single item from a Nirvana GTD JSON export. */
export interface NirvanaItem {
	id: string;
	name: string;
	note: string;
	type: number;
	state: number;
	tags: string;
	parentid: string;
	duedate: string;
	startdate: string;
	energy: number;
	etime: number;
	completed: number;
	cancelled: number;
	created: number;
	updated: number;
	waitingfor: string;
	recurring: string;
	ps: number;
	seq: number;
	seqp: number;
	seqt: number;
}

export const enum NirvanaType {
	Task = 0,
	Project = 1,
	ReferenceItem = 2,
	ReferenceList = 3,
}

export const enum NirvanaState {
	Inbox = 0,
	Next = 1,
	Waiting = 2,
	Scheduled = 3,
	Someday = 4,
	Later = 5,
	Focus = 6,
	Completed = 7,
	RecurringTemplate = 9,
	Reference = 10,
	ActiveProject = 11,
}

export interface ImportOptions {
	importActiveTasks: boolean;
	importCompletedTasks: boolean;
	importActiveProjects: boolean;
}

export interface ImportSummary {
	totalItems: number;
	activeTasks: number;
	completedTasks: number;
	cancelledTasks: number;
	activeProjects: number;
	somedayProjects: number;
	recurringTemplates: number;
	referenceItems: number;
}

export interface ImportResult {
	projectsCreated: number;
	tasksImported: number;
	tasksSkipped: number;
	errors: string[];
}

export interface ImportProgress {
	phase: string;
	current: number;
	total: number;
}

/** A task ready to be written to a file and added to the DataStore. */
export interface PreparedTask {
	text: string;
	noteLines: string[];
	fields: Partial<Task>;
}
