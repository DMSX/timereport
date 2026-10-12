import type { Member, Project, WorkModel } from "./types";

export function setupSteps(members: Member[], projects: Project[], models: WorkModel[], assignments: { project_id: string; user_id: string }[], today: string) {
  const active = projects.filter((p) => p.active);
  return [
    { title: "Arbeitszeiten festlegen", description: "Pro Person Stundenbasis ohne Soll oder ein Wochen-Soll wählen.", section: "team" as const,
      done: members.length > 0 && members.every((m) => models.some((w) => w.user_id === m.user_id && w.valid_from <= today)) },
    { title: "Erstes Projekt erstellen", description: "Ein aktives Projekt für die Zeitbuchungen anlegen.", section: "projects" as const, done: active.length > 0 },
    { title: "Team zuweisen", description: "Jede Person mindestens einem aktiven Projekt zuordnen.", section: "projects" as const,
      done: members.length > 0 && members.every((m) => assignments.some((a) => a.user_id === m.user_id && active.some((p) => p.id === a.project_id))) },
  ];
}
