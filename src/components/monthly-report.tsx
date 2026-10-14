"use client";

import { Fragment, useState } from "react";
import { DateTime } from "luxon";
import type { Absence, Entry, Project } from "@/lib/types";
import { displayTime, isValidMonth, localTime, minutesLabel, monthRange, type DayReport, ZONE } from "@/lib/time";
import { entryMinutesInRange, projectOverview } from "@/lib/report-overview";

export default function MonthlyReport({ month, onMonth, name, companyName, companyId, userId, report, entries, projects, absences, showAbsences, now }: {
  month: string; onMonth: (month: string) => void; name: string; companyName: string; companyId: string; userId: string;
  report: DayReport[]; entries: Entry[]; projects: Project[]; absences: Absence[]; showAbsences: boolean; now: DateTime;
}) {
  const [view, setView] = useState<"days" | "projects">("days");
  const [onlyActive, setOnlyActive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { start, end } = monthRange(month);
  const hasTarget = report.some((day) => day.hasTarget);
  const total = report.reduce((sum, day) => ({
    worked: sum.worked + day.worked, target: sum.target + day.target,
    credited: sum.credited + day.vacation + day.sick, balance: sum.balance + day.balance,
  }), { worked: 0, target: 0, credited: 0, balance: 0 });
  const projectRows = projectOverview(month, entries, projects, now);
  const activeDays = report.filter((day) => day.worked > 0).length;
  const running = entries.some((entry) => !entry.ended_at && localTime(entry.started_at) < end && now > start);
  const days = onlyActive ? report.filter((day) => day.worked > 0 || (showAbsences && absences.some((absence) =>
    absence.status !== "rejected" && absence.starts_on <= day.date && absence.ends_on >= day.date))) : report;
  const maxWorked = Math.max(1, ...report.map((day) => day.worked));
  const monthTitle = start.setLocale("de-CH").toFormat("LLLL yyyy");
  const exportUrl = (format: string) => `/api/report?${new URLSearchParams({company:companyId,user:userId,month,format})}`;
  function moveMonth(direction: number) {
    const next = start.plus({ months: direction });
    if (next.year >= 2000 && next.year <= 2100) { setExpanded(null); onMonth(next.toFormat("yyyy-MM")); }
  }
  return <div className="report-workspace">
    <section className="card report-header" aria-label="Rapportauswahl">
      <div><span className="eyebrow">{companyName} · {name}</span><h2>{monthTitle}</h2>
        <div className="report-meta"><span className="badge">{hasTarget ? report.some((day) => day.mode === "hourly") ? "Gemischte Modelle" : "Arbeitszeit mit Soll" : report.every((day) => day.mode === "hourly") ? "Stundenbasis ohne Soll" : "Modell teilweise offen"}</span>
          <span>{activeDays} Tage mit Arbeitszeit</span>{running && <span className="badge warning">Laufende Zeit · vorläufig</span>}</div>
      </div>
      <div className="report-tools"><div className="report-month-controls">
        <button className="secondary" aria-label="Vorheriger Monat" disabled={month === "2000-01"} onClick={() => moveMonth(-1)}>‹</button>
        <label>Monat<input type="month" value={month} min="2000-01" max="2100-12" onChange={(event) => {
          if (isValidMonth(event.target.value)) {
            setExpanded(null); onMonth(event.target.value);
          }
        }} /></label>
        <button className="secondary" aria-label="Nächster Monat" disabled={month === "2100-12"} onClick={() => moveMonth(1)}>›</button>
        <button className="secondary compact" onClick={() => { setExpanded(null); onMonth(now.toFormat("yyyy-MM")); }}>Dieser Monat</button>
      </div><div className="actions report-exports"><a className="button" href={exportUrl("pdf")}>PDF herunterladen</a><a className="button secondary" href={exportUrl("csv")}>CSV herunterladen</a></div></div>
    </section>
    {report.some((day) => day.mode === null) && <p className="notice error">Für einzelne Tage fehlt ein Zeiterfassungsmodell. Dort werden weder Soll noch Saldo berechnet.</p>}
    <div className={`report-metrics${hasTarget ? "" : " report-hourly"}`}>
      <section className="card report-primary-metric"><span className="eyebrow">Erfasste Arbeitszeit</span><strong>{minutesLabel(total.worked)} <small>h</small></strong><p>{projectRows.length} Projekte · {projectRows.reduce((sum, project) => sum + project.blocks, 0)} Arbeitsblöcke</p></section>
      {hasTarget ? <>
        <section className="card"><span className="eyebrow">Monatssoll</span><strong>{minutesLabel(total.target)} <small>h</small></strong><p>Alle Soll-Tage, auch zukünftige</p></section>
        {showAbsences && <section className="card"><span className="eyebrow">Abwesenheitsgutschrift</span><strong>{minutesLabel(total.credited)} <small>h</small></strong><p>Genehmigt · nur auf Soll-Tagen</p></section>}
        <section className="card"><span className="eyebrow">Monatssaldo</span><strong>{total.balance > 0 ? "+" : ""}{minutesLabel(total.balance)} <small>h</small></strong><p>Nur Tage mit Soll-Modell</p></section>
      </> : <section className="card report-model-note"><span className="eyebrow">Deine Auswertung</span><h3>Gearbeitete Stunden. Ohne Sollvergleich.</h3><p>Keine Plus- oder Minuszeiten. Projektstunden und Tagesdetails zeigen, wie sich deine Zeit verteilt.</p></section>}
    </div>
    <section className="card report-detail-card">
      <div className="report-detail-heading"><div><h2>Dein Monat im Detail</h2><p className="muted">Die Anzeige wechselt nur die Ansicht – der Export enthält immer den ganzen Monat.</p></div>
        <div className="report-view-switch" role="group" aria-label="Rapportansicht"><button className={view === "days" ? "" : "secondary"} aria-pressed={view === "days"} onClick={() => setView("days")}>Tagesübersicht</button><button className={view === "projects" ? "" : "secondary"} aria-pressed={view === "projects"} onClick={() => setView("projects")}>Nach Projekten</button></div>
      </div>
      {view === "projects" ? <div className="report-projects">
        {!projectRows.length && <div className="empty-state"><h3>Noch keine Projektstunden in diesem Monat.</h3><p>Erfasste Arbeitsblöcke erscheinen hier automatisch.</p></div>}
        {projectRows.map((project) => <div className="report-project-row" key={project.id}><span className="project-avatar">{project.name.slice(0, 1)}</span>
          <div><strong>{project.name}</strong><small>{project.blocks} Arbeitsblöcke{project.running ? " · laufende Zeit enthalten" : ""}</small>
            <progress value={project.minutes} max={Math.max(total.worked, 1)} aria-label={`Zeitanteil ${project.name}`} /></div>
          <div className="report-project-value"><strong>{minutesLabel(project.minutes)} h</strong><small>{Math.round(project.minutes / Math.max(total.worked, 1) * 100)} % der Arbeitszeit</small></div>
        </div>)}
      </div> : <>
        <div className="report-day-toolbar"><span>{days.length} von {report.length} Tagen</span><label className="check"><input type="checkbox" checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} /> Nur Tage mit Erfassung oder Abwesenheit</label></div>
        <div className="table-wrap report-days"><table><caption className="sr-only">Tagesübersicht {monthTitle} für {name}; Tagesdetails über die Datumsschaltfläche öffnen.</caption>
          <thead><tr><th>Tag / Details</th><th>Arbeitszeit</th>{hasTarget && <><th>Soll</th><th>Saldo</th></>}{showAbsences && <th>Abwesenheit</th>}</tr></thead><tbody>
            {days.map((day) => {
              const date = DateTime.fromISO(day.date, {zone:ZONE}).setLocale("de-CH");
              const next = date.plus({days:1});
              const blocks = entries.filter((entry) => entryMinutesInRange(entry,date,next,now)>0);
              const dayAbsences = absences.filter((absence) => absence.starts_on<=day.date && absence.ends_on>=day.date && absence.status!=="rejected");
              const open = expanded === day.date;
              return <Fragment key={day.date}><tr className={`${date.weekday > 5 ? "report-weekend " : ""}${day.date === now.toISODate() ? "report-today" : ""}`}>
                <td><button className="report-day-button" aria-expanded={open} aria-controls={open ? `report-day-${day.date}` : undefined} onClick={() => setExpanded(open ? null : day.date)}><span aria-hidden="true">{open ? "−" : "+"}</span><span><strong>{date.toFormat("ccc, dd. LLL")}</strong><small>{day.date === now.toISODate() ? "Heute" : day.mode === "hourly" ? "Stundenbasis" : day.mode === null ? "Modell fehlt" : blocks.length ? `${blocks.length} Arbeitsblöcke` : date.weekday > 5 && day.target === 0 ? "Wochenende" : "Keine Arbeitsbuchung"}</small></span></button></td>
                <td className="report-number"><strong>{day.worked > 0 ? minutesLabel(day.worked) : "—"}</strong><div className="report-day-meter" aria-hidden="true"><span style={{width:`${day.worked/maxWorked*100}%`}} /></div></td>
                {hasTarget && <><td className="report-number">{day.hasTarget ? minutesLabel(day.target) : "—"}</td><td className="report-number">{day.hasTarget ? `${day.balance>0 ? "+" : ""}${minutesLabel(day.balance)}` : "—"}</td></>}
                {showAbsences && <td>{day.vacationDays>0 && <span className="badge">Ferien · {day.vacationDays} Tag</span>}{day.sickDays>0 && <span className="badge">Krankheit · {day.sickDays} Tag</span>}{dayAbsences.some((absence) => absence.status==="pending") && <span className="badge warning">Freigabe offen</span>}{!dayAbsences.length && "—"}</td>}
              </tr>{open && <tr className="report-expanded"><td colSpan={2+(hasTarget ? 2 : 0)+(showAbsences ? 1 : 0)}><div id={`report-day-${day.date}`}>
                <h3>Arbeitsblöcke · {date.toFormat("dd.MM.yyyy")}</h3>
                {!blocks.length && <p className="muted">Keine Arbeitsblöcke für diesen Tag.</p>}
                {blocks.map((entry) => <div className="report-block" key={entry.id}><div><strong>{projects.find((project) => project.id===entry.project_id)?.name ?? "Archiviertes Projekt"}</strong><small>{displayTime(entry.started_at)} – {entry.ended_at ? displayTime(entry.ended_at) : "läuft (vorläufig)"}</small>{entry.note && <p>{entry.note}</p>}</div><strong>{minutesLabel(entryMinutesInRange(entry,date,next,now))} h an diesem Tag</strong></div>)}
                {showAbsences && dayAbsences.map((absence) => <p className="muted" key={absence.id}>{absence.kind==="vacation" ? "Ferien" : "Krankheit"} · {absence.fraction===0.5 ? absence.day_part==="morning" ? "Vormittag" : absence.day_part==="afternoon" ? "Nachmittag" : "Halber Tag" : "Ganzer Tag"} · {absence.status==="pending" ? "Freigabe offen" : "Genehmigt"}</p>)}
                {day.hasTarget && showAbsences && (day.vacation+day.sick)>0 && <p className="muted">Abwesenheitsgutschrift: {minutesLabel(day.vacation+day.sick)} h</p>}
              </div></td></tr>}</Fragment>;
            })}
            {!days.length && <tr><td colSpan={2+(hasTarget ? 2 : 0)+(showAbsences ? 1 : 0)}><div className="empty-state"><h3>Keine erfassten Tage in diesem Monat.</h3><p>Blende alle Tage ein oder wähle einen anderen Monat.</p></div></td></tr>}
          </tbody></table></div>
      </>}
    </section>
    <details className="report-explanation"><summary>So wird dieser Rapport berechnet</summary><p>Zeitzone Zürich. Blöcke über Monats- und Tagesgrenzen werden auf die tatsächliche Zeit im gewählten Zeitraum begrenzt. Laufende Buchungen sind vorläufig. Stundenbasis hat kein Soll und keinen Saldo. Bei Modellwechseln gilt das Modell des jeweiligen Tages.</p>{hasTarget && <p>Der Saldo umfasst das Soll des ganzen Monats einschliesslich zukünftiger Tage. Genehmigte Abwesenheiten werden nur auf Soll-Tagen gutgeschrieben. Feiertage werden nicht automatisch vom Soll abgezogen.</p>}{showAbsences && <p>Abwesenheitstage sind dokumentierte Kalendertage, keine Ferienrest- oder Lohnabrechnung. Offene Anträge erzeugen keine Stundengutschrift.</p>}</details>
  </div>;
}
