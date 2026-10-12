"use client";

import { alertLabels } from "@/lib/report-notifications";
import { displayTime } from "@/lib/time";
import type { EmailJob, Member, ReportAlert } from "@/lib/types";

export default function ReportCenter({ alerts, jobs, members, userId, manager, busy, nowMs, onAction, onRetry }: {
  alerts: ReportAlert[]; jobs: EmailJob[]; members: Member[]; userId: string; manager: boolean; busy: boolean;
  nowMs: number; onAction: (alert: string, action: string, reason?: string) => Promise<void>;
  onRetry: (job: string) => Promise<void>;
}) {
  return <>
    <p className="notice">Ein fehlender Eintrag ist kein Nachweis, dass nicht gearbeitet wurde. Hinweise werden alle 15 Minuten neu geprüft, wenn der Scheduler eingerichtet ist.</p>
    {!alerts.length && <section className="empty-state card"><h3>Keine Hinweise vorhanden.</h3><p>Hinweise erscheinen nach der konfigurierten Frist. Eigene Hinweise siehst du erst, wenn HR/Admin eine Erinnerung auslöst.</p></section>}
    {alerts.map((alert) => {
      const related = jobs.filter((j) => j.alert_id === alert.id);
      const deferred = alert.status === "open" && new Date(alert.due_at).getTime() > nowMs;
      return <section className="card" key={alert.id}>
        <div className="section-heading"><h2>{deferred ? "Hinweis bis zur neuen Prüffrist zurückgestellt" : alertLabels[alert.kind]}</h2><span className={`badge ${alert.status === "open" && !deferred ? "warning" : ""}`}>{deferred ? "Prüffrist noch offen" : alert.status === "open" ? "Offen" : alert.status === "clarified" ? "Mit Begründung geklärt" : "Automatisch erledigt"}</span></div>
        <p>{members.find((m) => m.user_id === alert.user_id)?.display_name ?? "Eigene Zeiterfassung"} · {alert.work_day} · Prüfzeit {displayTime(alert.due_at)}</p>
        {alert.resolution && <p>{alert.resolution}</p>}
        {related.map((job) => <p className="muted" key={job.id}>
          {job.purpose === "reminder" ? "Erinnerung" : "Hinweis an Zuständige"}: {({ pending: "Versand ausstehend", sending: "Wird versendet", sent: "Vom Mailserver angenommen", failed: "Versand fehlgeschlagen", canceled: "Versand nicht mehr erforderlich" })[job.status]}
          {job.status === "failed" && ` · ${job.last_error} · Versuch ${job.attempts}/5`}
          {manager && job.status === "failed" && <button className="secondary compact" disabled={busy} onClick={() => onRetry(job.id)}>Versand erneut beauftragen</button>}
        </p>)}
        {alert.reminded_at && <p className="muted">Erinnerung am {displayTime(alert.reminded_at)} beauftragt.</p>}
        {manager && alert.status === "open" && <div>
          <div className="actions">{alert.kind === "missing" && <button disabled={busy || deferred || !!alert.reminded_at} onClick={() => onAction(alert.id, "remind")}>{alert.reminded_at ? "Erinnerung bereits beauftragt" : "Person in App und per E-Mail erinnern"}</button>}</div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void onAction(alert.id, "clarify", String(new FormData(event.currentTarget).get("reason")));
          }}><label>Klärungsgrund<input name="reason" required minLength={3} maxLength={1000} placeholder="Zum Beispiel Rückmeldung eingeholt; Nachtrag vereinbart." /></label><button disabled={busy} className="secondary">Hinweis klären</button></form>
        </div>}
        {!manager && alert.user_id === userId && alert.status === "open" && !deferred && <p>Bitte unter Zeitbuchungen den Tag prüfen oder HR/Admin kontaktieren.</p>}
      </section>;
    })}
  </>;
}
