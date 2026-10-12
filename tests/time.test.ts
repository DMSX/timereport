import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { breakViolations, correctionDeadline, csvCell, minutesLabel, monthRange, monthlyReport, vacationUsed } from "../src/lib/time";
import type { Absence, Entry, WorkModel } from "../src/lib/types";

function entry(id: string, start: string, end: string | null, project = "project"): Entry {
  return { id, company_id: "company", user_id: "user", project_id: project, started_at: start, ended_at: end, note: "", max_work_minutes: 120, min_break_minutes: 15 };
}
const model: WorkModel = { id: "model", company_id: "company", user_id: "user", valid_from: "2026-01-01", weekday_minutes: [480, 480, 480, 480, 480, 0, 0], planned_start: null, planned_end: null };
const absence = (kind: Absence["kind"], status: Absence["status"], start = "2026-10-05", end = start): Absence => ({
  id: "absence", company_id: "company", user_id: "user", kind, status, starts_on: start, ends_on: end, fraction: 1,
});

test("minutes roll over cleanly when rounding", () => {
  assert.equal(minutesLabel(59.9), "1:00");
  assert.equal(minutesLabel(-60), "-1:00");
});
test("project changes and short breaks do not reset accumulated work", () => {
  const entries = [
    entry("first", "2026-10-12T08:00:00+02:00", "2026-10-12T09:00:00+02:00"),
    entry("second", "2026-10-12T09:05:00+02:00", "2026-10-12T10:06:00+02:00", "other"),
    entry("third", "2026-10-12T10:21:00+02:00", "2026-10-12T11:00:00+02:00"),
  ];
  assert.deepEqual([...breakViolations(entries)], ["second"]);
});
test("strictest project rule applies across the continuous stretch", () => {
  const first = entry("first", "2026-10-12T08:00:00Z", "2026-10-12T09:30:00Z");
  first.min_break_minutes = 30;
  const second = entry("second", "2026-10-12T09:45:00Z", "2026-10-12T10:30:00Z");
  second.max_work_minutes = 100;
  assert.deepEqual([...breakViolations([first, second])], ["second"]);
});
test("running entries use actual elapsed time, including after browser closure", () => {
  assert.deepEqual([...breakViolations([entry("running", "2026-10-12T08:00:00Z", null)], DateTime.fromISO("2026-10-12T10:01:00Z"))], ["running"]);
});
test("correction deadline is midnight after Sunday of the following week in Zurich", () => {
  assert.equal(correctionDeadline("2026-10-05T10:00:00+02:00", 1).toISO(), "2026-10-19T00:00:00.000+02:00");
  assert.equal(correctionDeadline("2026-10-19T10:00:00+02:00", 1).toISO(), "2026-11-02T00:00:00.000+01:00");
});
test("monthly report splits midnight and handles DST by elapsed time", () => {
  const report = monthlyReport("2026-10", [
    entry("midnight", "2026-09-30T23:30:00+02:00", "2026-10-01T00:30:00+02:00"),
    entry("dst", "2026-10-25T01:30:00+02:00", "2026-10-25T03:30:00+01:00"),
  ], [model], []);
  assert.equal(report[0].worked, 30);
  assert.equal(report[24].worked, 180);
});
test("only approved absences credit scheduled time, new models are effective dated", () => {
  const newer = { ...model, id: "new", valid_from: "2026-10-06", weekday_minutes: [240, 240, 240, 240, 240, 0, 0] };
  const report = monthlyReport("2026-10", [], [model, newer], [
    absence("vacation", "approved"), absence("sick", "pending", "2026-10-06"), absence("sick", "approved", "2026-10-07"),
  ]);
  assert.equal(report[4].vacation, 480);
  assert.equal(report[4].balance, 0);
  assert.equal(report[5].sick, 0);
  assert.equal(report[6].sick, 240);
});
test("vacation count skips non-working days, clips year, and reserves pending requests", () => {
  assert.equal(vacationUsed(2026, [model], [absence("vacation", "pending", "2026-10-09", "2026-10-12")]), 2);
  assert.equal(vacationUsed(2026, [model], [absence("vacation", "rejected")]), 0);
});
test("CSV quotes content and prevents spreadsheet formula execution", () => {
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(csvCell('a;b"c'), '"a;b""c"');
  assert.equal(csvCell("  =1+1"), "\"'  =1+1\"");
});
test("invalid months cannot silently generate empty reports", () => {
  assert.throws(() => monthRange("2026-13"));
  assert.throws(() => monthRange("wrong"));
});
