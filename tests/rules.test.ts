import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { resolveRuleCascade, evaluateOverrun } from "../src/lib/rules";
import type { WorkRule } from "../src/lib/types";

const companyId = "20000000-0000-4000-8000-000000000001";
const deptA = "dept-aaaa-0001";
const userAlice = "user-alice-0001";
const userBob = "user-bob-0002";

const baseRule: Omit<WorkRule, "id" | "name" | "scope" | "department_id" | "user_id" | "activity_tag" | "max_work_minutes" | "min_break_minutes"> = {
  company_id: companyId,
  allow_overrun: true,
  overrun_note_required: true,
  priority: 0,
  valid_from: "2020-01-01",
  valid_to: null,
  is_active: true,
  created_at: "2026-01-01T10:00:00Z",
};

test("resolveRuleCascade prioritizes member over department over company", () => {
  const rules: WorkRule[] = [
    { ...baseRule, id: "r-company", name: "Firma Standard", scope: "company", department_id: null, user_id: null, activity_tag: null, max_work_minutes: 600, min_break_minutes: 30 },
    { ...baseRule, id: "r-dept", name: "Produktion", scope: "department", department_id: deptA, user_id: null, activity_tag: null, max_work_minutes: 480, min_break_minutes: 45 },
    { ...baseRule, id: "r-member", name: "Alice Ausnahme", scope: "member", department_id: null, user_id: userAlice, activity_tag: null, max_work_minutes: 420, min_break_minutes: 60 },
  ];

  // Alice in Dept A gets Member rule (420 min)
  const resAlice = resolveRuleCascade(rules, { userId: userAlice, departmentId: deptA });
  assert.equal(resAlice.matchedScope, "member");
  assert.equal(resAlice.maxWorkMinutes, 420);

  // Bob in Dept A gets Department rule (480 min)
  const resBob = resolveRuleCascade(rules, { userId: userBob, departmentId: deptA });
  assert.equal(resBob.matchedScope, "department");
  assert.equal(resBob.maxWorkMinutes, 480);

  // Charlie with no department gets Company rule (600 min)
  const resCharlie = resolveRuleCascade(rules, { userId: "user-charlie", departmentId: null });
  assert.equal(resCharlie.matchedScope, "company");
  assert.equal(resCharlie.maxWorkMinutes, 600);
});

test("resolveRuleCascade handles activity tags like Schutzanzug and specific overrides", () => {
  const rules: WorkRule[] = [
    { ...baseRule, id: "r-comp-gen", name: "Firma Standard", scope: "company", department_id: null, user_id: null, activity_tag: null, max_work_minutes: 600, min_break_minutes: 30 },
    { ...baseRule, id: "r-suit", name: "Schutzanzug Generell", scope: "company", department_id: null, user_id: null, activity_tag: "schutzanzug", max_work_minutes: 120, min_break_minutes: 15 },
    { ...baseRule, id: "r-bob-suit", name: "Bob Schutzanzug Spezial", scope: "member", department_id: null, user_id: userBob, activity_tag: "schutzanzug", max_work_minutes: 150, min_break_minutes: 20 },
  ];

  // Alice with schutzanzug gets company schutzanzug rule (120 min)
  const resAliceSuit = resolveRuleCascade(rules, { userId: userAlice, activity: "schutzanzug" });
  assert.equal(resAliceSuit.matchedScope, "company");
  assert.equal(resAliceSuit.maxWorkMinutes, 120);

  // Bob with schutzanzug gets his personal member exception (150 min)
  const resBobSuit = resolveRuleCascade(rules, { userId: userBob, activity: "schutzanzug" });
  assert.equal(resBobSuit.matchedScope, "member");
  assert.equal(resBobSuit.maxWorkMinutes, 150);

  // Case-insensitive activity matching
  const resCase = resolveRuleCascade(rules, { userId: userAlice, activity: "  SCHUTZANZUG  " });
  assert.equal(resCase.maxWorkMinutes, 120);
});

test("resolveRuleCascade respects date validity and inactive flags", () => {
  const rules: WorkRule[] = [
    { ...baseRule, id: "r-inactive", name: "Inaktiv", scope: "company", department_id: null, user_id: null, activity_tag: null, max_work_minutes: 300, min_break_minutes: 15, is_active: false },
    { ...baseRule, id: "r-future", name: "Zukunft", scope: "company", department_id: null, user_id: null, activity_tag: null, max_work_minutes: 360, min_break_minutes: 15, valid_from: "2099-01-01" },
    { ...baseRule, id: "r-expired", name: "Abgelaufen", scope: "company", department_id: null, user_id: null, activity_tag: null, max_work_minutes: 400, min_break_minutes: 15, valid_from: "2020-01-01", valid_to: "2021-01-01" },
  ];

  const res = resolveRuleCascade(rules, { userId: userAlice, fallbackMaxWorkMinutes: 540, fallbackMinBreakMinutes: 30 });
  assert.equal(res.matchedScope, "fallback");
  assert.equal(res.maxWorkMinutes, 540);
});

test("evaluateOverrun detects elapsed time and overrun minutes", () => {
  const now = DateTime.fromISO("2026-10-14T12:00:00Z");
  // 3 hours worked with 2 hours limit (120 min)
  const startedAt = "2026-10-14T09:00:00Z";
  const overrun = evaluateOverrun(startedAt, null, 120, now);
  assert.equal(overrun.elapsedMinutes, 180);
  assert.equal(overrun.isOverrun, true);
  assert.equal(overrun.overrunMinutes, 60);

  // 1 hour worked with 2 hours limit
  const withinLimit = evaluateOverrun("2026-10-14T11:00:00Z", null, 120, now);
  assert.equal(withinLimit.elapsedMinutes, 60);
  assert.equal(withinLimit.isOverrun, false);
  assert.equal(withinLimit.overrunMinutes, 0);
});
