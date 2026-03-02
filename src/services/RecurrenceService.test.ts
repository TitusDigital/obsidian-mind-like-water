import { describe, it, expect } from "vitest";
import { getRecurrenceSummary } from "services/RecurrenceService";

describe("getRecurrenceSummary", () => {
	it("returns human-readable text for weekly rule", () => {
		const result = getRecurrenceSummary("FREQ=WEEKLY;BYDAY=MO", "fixed");
		expect(result).toContain("week");
	});

	it("returns human-readable text for daily rule", () => {
		const result = getRecurrenceSummary("FREQ=DAILY;INTERVAL=1", "fixed");
		expect(result).toContain("day");
	});

	it("returns human-readable text for monthly rule", () => {
		const result = getRecurrenceSummary("FREQ=MONTHLY;INTERVAL=1", "fixed");
		expect(result).toContain("month");
	});

	it("appends 'after completion' for relative type", () => {
		const result = getRecurrenceSummary("FREQ=WEEKLY;INTERVAL=1", "relative");
		expect(result).toContain("after completion");
	});

	it("does not append 'after completion' for fixed type", () => {
		const result = getRecurrenceSummary("FREQ=WEEKLY;INTERVAL=1", "fixed");
		expect(result).not.toContain("after completion");
	});

	it("handles RRULE: prefix", () => {
		const result = getRecurrenceSummary("RRULE:FREQ=DAILY;INTERVAL=2", "fixed");
		expect(result).toContain("2 days");
	});

	it("returns fallback for invalid rule", () => {
		const result = getRecurrenceSummary("INVALID_GARBAGE", null);
		expect(result).toBe("Custom recurrence");
	});

	it("returns fallback for empty string", () => {
		const result = getRecurrenceSummary("", null);
		expect(result).toBe("Custom recurrence");
	});

	it("handles rule with COUNT end condition", () => {
		const result = getRecurrenceSummary("FREQ=WEEKLY;INTERVAL=1;COUNT=5", "fixed");
		expect(result).toContain("week");
	});
});
