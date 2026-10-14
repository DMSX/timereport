import { DateTime } from "luxon";
import { localTime, ZONE } from "./time";
import type { Department, Member, WorkRule } from "./types";

export type ResolvedRule = {
  rule: WorkRule | null;
  maxWorkMinutes: number;
  minBreakMinutes: number;
  allowOverrun: boolean;
  overrunNoteRequired: boolean;
  matchedScope: "member" | "department" | "company" | "fallback";
};

export function resolveRuleCascade(
  rules: WorkRule[],
  params: {
    userId: string;
    departmentId?: string | null;
    activity?: string | null;
    day?: string;
    fallbackMaxWorkMinutes?: number;
    fallbackMinBreakMinutes?: number;
  }
): ResolvedRule {
  const day = params.day ?? DateTime.now().setZone(ZONE).toISODate()!;
  const normalizedAct = params.activity ? params.activity.trim().toLowerCase() : null;

  const activeRules = rules.filter((r) => {
    if (!r.is_active) return false;
    if (r.valid_from > day) return false;
    if (r.valid_to && r.valid_to < day) return false;

    // Scope check
    if (r.scope === "member") {
      if (r.user_id !== params.userId) return false;
    } else if (r.scope === "department") {
      if (!params.departmentId || r.department_id !== params.departmentId) return false;
    } else if (r.scope !== "company") {
      return false;
    }

    // Activity tag check
    if (normalizedAct) {
      if (r.activity_tag && r.activity_tag.trim().toLowerCase() !== normalizedAct) return false;
    } else {
      if (r.activity_tag) return false;
    }

    return true;
  });

  activeRules.sort((a, b) => {
    // 1. Scope specificity: member > department > company
    const scopeScore = (s: string) => (s === "member" ? 3 : s === "department" ? 2 : 1);
    const scopeDiff = scopeScore(b.scope) - scopeScore(a.scope);
    if (scopeDiff !== 0) return scopeDiff;

    // 2. Activity specificity: specific activity tag wins over generic
    const actScore = (act: string | null) => (act ? 2 : 1);
    const actDiff = actScore(b.activity_tag) - actScore(a.activity_tag);
    if (actDiff !== 0) return actDiff;

    // 3. Priority
    if (b.priority !== a.priority) return b.priority - a.priority;

    // 4. Creation time
    return b.created_at.localeCompare(a.created_at);
  });

  const winning = activeRules[0] ?? null;

  if (winning) {
    return {
      rule: winning,
      maxWorkMinutes: winning.max_work_minutes,
      minBreakMinutes: winning.min_break_minutes,
      allowOverrun: winning.allow_overrun,
      overrunNoteRequired: winning.overrun_note_required,
      matchedScope: winning.scope,
    };
  }

  return {
    rule: null,
    maxWorkMinutes: params.fallbackMaxWorkMinutes ?? 600,
    minBreakMinutes: params.fallbackMinBreakMinutes ?? 30,
    allowOverrun: true,
    overrunNoteRequired: false,
    matchedScope: "fallback",
  };
}

export function evaluateOverrun(
  startedAt: string,
  endedAt: string | null,
  maxWorkMinutes: number,
  now: DateTime = DateTime.now().setZone(ZONE)
) {
  const start = localTime(startedAt).toMillis();
  const end = endedAt ? localTime(endedAt).toMillis() : now.toMillis();
  const elapsedMinutes = Math.max(0, Math.round((end - start) / 60000));
  const isOverrun = elapsedMinutes > maxWorkMinutes;
  const overrunMinutes = Math.max(0, elapsedMinutes - maxWorkMinutes);

  return {
    elapsedMinutes,
    isOverrun,
    overrunMinutes,
  };
}

export function ruleScopeLabel(rule: WorkRule, departments: Department[], members: Member[]) {
  if (rule.scope === "member") {
    const m = members.find((x) => x.user_id === rule.user_id);
    return `Mitarbeiter: ${m?.display_name ?? "Ausnahme"}`;
  }
  if (rule.scope === "department") {
    const d = departments.find((x) => x.id === rule.department_id);
    return `Abteilung: ${d?.name ?? "Gruppe"}`;
  }
  return "Unternehmen (Standard)";
}
