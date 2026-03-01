import type { Task } from "data/models";

export type Bucket = "Overdue" | "Today" | "This Week" | "Next Week" | "This Month" | "Later" | "No Date";

function stripTime(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getBucket(sd: string | null, today: Date, eow: Date, eonw: Date, eom: Date): Bucket {
	if (sd === null) return "No Date";
	const d = stripTime(new Date(sd));
	if (d < today) return "Overdue";
	if (d.getTime() === today.getTime()) return "Today";
	if (d < eow) return "This Week";
	if (d < eonw) return "Next Week";
	if (d < eom) return "This Month";
	return "Later";
}

/** Group tasks into date buckets for the Scheduled view. */
export function bucketByDate(tasks: Task[]): Map<Bucket, Task[]> {
	const today = stripTime(new Date());
	const endOfWeek = addDays(today, 7 - today.getDay());
	const endOfNextWeek = addDays(endOfWeek, 7);
	const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
	const result = new Map<Bucket, Task[]>();
	const sorted = [...tasks].sort((a, b) => {
		if (a.start_date === null && b.start_date === null) return 0;
		if (a.start_date === null) return 1;
		if (b.start_date === null) return -1;
		return a.start_date.localeCompare(b.start_date);
	});
	for (const task of sorted) {
		const bucket = getBucket(task.start_date, today, endOfWeek, endOfNextWeek, endOfMonth);
		const list = result.get(bucket);
		if (list !== undefined) list.push(task);
		else result.set(bucket, [task]);
	}
	return result;
}
