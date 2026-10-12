export const alertLabels = {
  missing: "Zeiterfassung fehlt – bitte klären",
  pending_absence: "Abwesenheit zur Prüfung offen",
  unclear_half_day: "Halbtagsabwesenheit oder Arbeitszeitfenster klären",
};
export function notificationText(kind: keyof typeof alertLabels, day: string, reminder: boolean, link: string) {
  return [
    reminder ? "Bitte prüfe deine Zeiterfassung." : alertLabels[kind],
    `Arbeitstag: ${day}`,
    reminder ? "Für diesen Tag wurde eine Erinnerung durch HR/Admin ausgelöst. Bitte Buchungen prüfen oder die zuständige Person kontaktieren."
      : "Für eine dir zugeordnete Person liegt ein Hinweis vor. Details sind nach Anmeldung in TimeReport sichtbar.",
    "Ein fehlender Eintrag ist kein Nachweis einer Abwesenheit.",
    link,
  ].join("\n\n");
}
