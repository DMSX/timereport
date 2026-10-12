import { minutesLabel, type DayReport } from "./time";

export function dayReportCells(day: DayReport) {
  return [minutesLabel(day.worked), day.hasTarget ? minutesLabel(day.target) : "",
    day.hasTarget ? minutesLabel(day.vacation) : "", day.hasTarget ? minutesLabel(day.sick) : "",
    day.hasTarget ? minutesLabel(day.balance) : "", day.vacationDays, day.sickDays,
    day.mode === "hourly" ? "Stundenbasis ohne Soll" : day.mode === "scheduled" ? "Mit Soll" : "Modell fehlt"];
}

export function reportNote(report: DayReport[]) {
  return "Stundenbasis ohne Soll/Saldo; Abwesenheiten ohne Stundengutschrift. " +
    (report.some((day) => day.hasTarget) ? "Saldo nur für Soll-Tage des ganzen Monats; keine automatischen Feiertage. " : "") +
    "Laufende Buchungen vorläufig. Abwesenheitstage sind dokumentierte Kalendertage, keine Ferienlohnabrechnung.";
}
