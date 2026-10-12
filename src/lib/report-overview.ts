import type { DateTime } from "luxon";
import type { Entry, Project } from "./types";
import { localTime, monthRange } from "./time";

export function entryMinutesInRange(entry: Entry, start: DateTime, end: DateTime, now: DateTime) {
  return Math.max(0, (Math.min(localTime(entry.ended_at ?? now.toISO()!).toMillis(), end.toMillis()) -
    Math.max(localTime(entry.started_at).toMillis(), start.toMillis())) / 60000);
}

export function projectOverview(month: string, entries: Entry[], projects: Project[], now: DateTime) {
  const { start, end } = monthRange(month);
  const totals = new Map<string, { id: string; name: string; minutes: number; blocks: number; running: boolean }>();
  for (const entry of entries) {
    const minutes = entryMinutesInRange(entry, start, end, now);
    if (minutes <= 0) continue;
    const row = totals.get(entry.project_id) ?? {
      id: entry.project_id, name: projects.find((project) => project.id === entry.project_id)?.name ?? "Archiviertes Projekt",
      minutes: 0, blocks: 0, running: false,
    };
    row.minutes += minutes; row.blocks++; row.running ||= !entry.ended_at;
    totals.set(row.id, row);
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, "de-CH"));
}
