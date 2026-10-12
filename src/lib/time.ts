import { DateTime } from "luxon";
import type { Absence, Entry, WorkModel } from "./types";

export const ZONE = "Europe/Zurich";
export const localTime = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
export const minutesLabel = (minutes: number) => {
  const rounded = Math.round(Math.abs(minutes));
  return `${minutes < 0 && rounded > 0 ? "-" : ""}${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};
export const displayTime = (iso: string) => localTime(iso).toFormat("dd.MM.yyyy HH:mm");

export function monthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Ungültiger Monat.");
  const start = DateTime.fromISO(`${month}-01`, { zone: ZONE });
  if (!start.isValid || start.year < 2000 || start.year > 2100) throw new Error("Ungültiger Monat.");
  return { start, end: start.plus({ months: 1 }) };
}

export function correctionDeadline(start: string, weeks: number) {
  return localTime(start).startOf("week").plus({ weeks: weeks + 1 });
}

export function modelForDay(models: WorkModel[], day: string) {
  return models.filter((m) => m.valid_from <= day).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
}

export type DayReport = { date: string; worked: number; target: number; vacation: number; sick: number; balance: number };
export function monthlyReport(month: string, entries: Entry[], models: WorkModel[], absences: Absence[], now: DateTime = DateTime.now()) {
  const { start, end } = monthRange(month);
  const days: DayReport[] = [];
  for (let day = start; day < end; day = day.plus({ days: 1 })) {
    const next = day.plus({ days: 1 });
    const date = day.toISODate()!;
    const target = modelForDay(models, date)?.weekday_minutes[day.weekday - 1] ?? 0;
    const worked = entries.reduce((sum, entry) => {
      const from = Math.max(localTime(entry.started_at).toMillis(), day.toMillis());
      const to = Math.min(localTime(entry.ended_at ?? now.toISO()!).toMillis(), next.toMillis());
      return sum + Math.max(0, (to - from) / 60000);
    }, 0);
    const matching = absences.filter((a) => a.status === "approved" && a.starts_on <= date && a.ends_on >= date);
    const vacation = matching.filter((a) => a.kind === "vacation").reduce((sum, a) => sum + target * a.fraction, 0);
    const sick = matching.filter((a) => a.kind === "sick").reduce((sum, a) => sum + target * a.fraction, 0);
    days.push({ date, worked, target, vacation, sick, balance: worked + vacation + sick - target });
  }
  return days;
}

// A project switch is not a break. Carry the strictest rule through the work stretch.
export function breakViolations(entries: Entry[], now: DateTime = DateTime.now()) {
  const sorted = [...entries].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const violations = new Set<string>();
  let worked = 0, limit = Infinity, requiredBreak = 0, previousEnd: number | null = null;
  for (const entry of sorted) {
    const start = localTime(entry.started_at).toMillis();
    if (previousEnd !== null && start - previousEnd >= requiredBreak * 60000) {
      worked = 0; limit = Infinity; requiredBreak = 0;
    }
    limit = Math.min(limit, entry.max_work_minutes);
    requiredBreak = Math.max(requiredBreak, entry.min_break_minutes);
    const end = localTime(entry.ended_at ?? now.toISO()!).toMillis();
    worked += Math.max(0, (end - start) / 60000);
    if (worked > limit) violations.add(entry.id);
    previousEnd = end;
  }
  return violations;
}

export function vacationUsed(year: number, models: WorkModel[], absences: Absence[]) {
  let used = 0;
  for (const a of absences.filter((a) => a.kind === "vacation" && a.status !== "rejected")) {
    let day = DateTime.fromISO(a.starts_on, { zone: ZONE });
    const end = DateTime.fromISO(a.ends_on, { zone: ZONE });
    while (day <= end) {
      if (day.year === year && (modelForDay(models, day.toISODate()!)?.weekday_minutes[day.weekday - 1] ?? 0) > 0) used += a.fraction;
      day = day.plus({ days: 1 });
    }
  }
  return used;
}

export function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^\s*[=+\-@]|^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
