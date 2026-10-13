import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { breakViolations, correctionDeadline, csvCell, isValidMonth, minutesLabel, modelForDay, monthRange, monthlyReport, vacationUsed } from "../src/lib/time";
import type { Absence, Entry, WorkModel } from "../src/lib/types";
import { dayReportCells, reportNote } from "../src/lib/report-display";

function entry(id: string, start: string, end: string | null, project = "project"): Entry {
  return { id, company_id: "company", user_id: "user", project_id: project, started_at: start, ended_at: end, note: "", max_work_minutes: 120, min_break_minutes: 15 };
}
const model: WorkModel = { id: "model", company_id: "company", user_id: "user", valid_from: "2026-01-01", mode: "scheduled", weekday_minutes: [480, 480, 480, 480, 480, 0, 0], planned_start: null, planned_end: null };
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
  for (const month of ["2026-13", "2026-00", "2026-1", "1999-12", "2101-01", "wrong", ""]) {
    assert.equal(isValidMonth(month), false);
    assert.throws(() => monthRange(month), /Ungültiger Monat/);
  }
  for (const month of ["2000-01", "2026-10", "2100-12"]) {
    assert.equal(isValidMonth(month), true);
    assert.equal(monthRange(month).start.toFormat("yyyy-MM"), month);
  }
});
test("model lookup selects the latest effective model without mutating input order", () => {
  const future = { ...model, id: "future", valid_from: "2027-01-01" };
  const current = { ...model, id: "current", valid_from: "2026-10-05" };
  const models = [future, current, model];
  assert.equal(modelForDay(models, "2026-10-12"), current);
  assert.equal(modelForDay(models, "2026-01-01"), model);
  assert.equal(modelForDay(models, "2025-12-31"), undefined);
  assert.deepEqual(models.map((value) => value.id), ["future", "current", "model"]);
});
test("monthly intervals exclude other months and use elapsed time across spring DST", () => {
  const now = DateTime.fromISO("2026-03-31T23:00:00+02:00");
  const report = monthlyReport("2026-03", [
    entry("before", "2026-02-01T08:00:00Z", "2026-02-01T09:00:00Z"),
    entry("boundary", "2026-02-28T23:30:00+01:00", "2026-03-01T00:30:00+01:00"),
    entry("spring", "2026-03-29T01:30:00+01:00", "2026-03-29T03:30:00+02:00"),
    entry("running", "2026-03-31T22:30:00+02:00", null),
    entry("after", "2026-04-01T08:00:00Z", "2026-04-01T09:00:00Z"),
  ], [model], [], now);
  assert.equal(report[0].worked, 30);
  assert.equal(report[28].worked, 60);
  assert.equal(report[30].worked, 30);
  assert.equal(report.reduce((sum, day) => sum + day.worked, 0), 120);
});

test("hourly work has no target or balance and absences remain documented without credits", () => {
  const hourly: WorkModel = {...model,mode:"hourly",weekday_minutes:[0,0,0,0,0,0,0]};
  const report = monthlyReport("2026-10",[entry("work","2026-10-05T08:00:00+02:00","2026-10-05T11:00:00+02:00")],[hourly],[absence("sick","approved")]);
  assert.equal(report[4].worked,180);
  assert.equal(report[4].hasTarget,false);
  assert.equal(report[4].balance,0);
  assert.equal(report[4].sick,0);
  assert.equal(report[4].sickDays,1);
  assert.deepEqual(dayReportCells(report[4]),["3:00","","","","",0,1,"Stundenbasis ohne Soll"]);
  assert.match(reportNote(report),/ohne Soll\/Saldo/);
});
test("effective-dated changes preserve historical targets without counting hourly work as overtime",()=>{
  const hourly: WorkModel = {...model,id:"hourly",valid_from:"2026-10-06",mode:"hourly",weekday_minutes:[0,0,0,0,0,0,0]};
  const report=monthlyReport("2026-10",[entry("work","2026-10-06T08:00:00Z","2026-10-06T10:00:00Z")],[model,hourly],[]);
  assert.equal(report[4].target,480);
  assert.equal(report[4].balance,-480);
  assert.equal(report[5].worked,120);
  assert.equal(report[5].hasTarget,false);
  assert.equal(report[5].balance,0);
  const unknown=monthlyReport("2026-10",[],[],[])[0];
  assert.equal(unknown.mode,null);
  assert.equal(unknown.hasTarget,false);
});
