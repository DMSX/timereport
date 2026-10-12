import { test } from "node:test";
import assert from "node:assert/strict";
import { setupSteps } from "../src/lib/onboarding";
import type { Member, Project, WorkModel } from "../src/lib/types";

const members: Member[] = [{ company_id: "c", user_id: "u", display_name: "Test", role: "admin", vacation_days: 25 }];
const project: Project = { id: "p", company_id: "c", name: "Project", active: true, max_work_minutes: null, min_break_minutes: null };
const model: WorkModel = { id: "w", company_id: "c", user_id: "u", valid_from: "2026-10-01", weekday_minutes: [480, 480, 480, 480, 480, 0, 0], planned_start: null, planned_end: null };

test("new companies get three actionable setup steps", () => {
  assert.deepEqual(setupSteps(members, [], [], [], "2026-10-12").map((s) => s.done), [false, false, false]);
});
test("future models and archived project assignments are not start-ready", () => {
  assert.deepEqual(setupSteps(members, [{ ...project, active: false }], [{ ...model, valid_from: "2026-11-01" }], [{ project_id: "p", user_id: "u" }], "2026-10-12").map((s) => s.done), [false, false, false]);
});
test("all people need current schedules and an active assignment", () => {
  assert.deepEqual(setupSteps(members, [project], [model], [{ project_id: "p", user_id: "u" }], "2026-10-12").map((s) => s.done), [true, true, true]);
  assert.equal(setupSteps([...members, { ...members[0], user_id: "new" }], [project], [model], [{ project_id: "p", user_id: "u" }], "2026-10-12")[2].done, false);
});
