"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { allRows, checked } from "@/lib/query";
import { breakViolations, correctionDeadline, displayTime, localTime, minutesLabel, monthRange, monthlyReport, vacationUsed, ZONE } from "@/lib/time";
import type { Absence, Company, Entry, Member, Project, Resolution, Subscription, WorkModel } from "@/lib/types";

type Data = {
  companies: Company[]; members: Member[]; projects: Project[]; entries: Entry[];
  models: WorkModel[]; absences: Absence[]; resolutions: Resolution[];
  assignments: { project_id: string; user_id: string; company_id: string }[];
  subscriptions: Subscription[]; operator: boolean;
};
const empty: Data = { companies: [], members: [], projects: [], entries: [], models: [], absences: [], resolutions: [], assignments: [], subscriptions: [], operator: false };
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const statusLabel = { pending: "Offen", approved: "Genehmigt", rejected: "Abgelehnt" };
const roleLabel = { employee: "Mitarbeitende", hr: "HR", admin: "Admin" };

async function post(path: string, body: object) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value: unknown = await response.json();
  if (!value || typeof value !== "object") throw new Error("Ungültige Serverantwort.");
  if (!response.ok) throw new Error("error" in value && typeof value.error === "string" ? value.error : "Anfrage fehlgeschlagen.");
  return value;
}

export default function Dashboard() {
  const router = useRouter();
  const [db] = useState(browserClient);
  const [data, setData] = useState<Data>(empty);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");
  const [personId, setPersonId] = useState("");
  const [month, setMonth] = useState(DateTime.now().setZone(ZONE).toFormat("yyyy-MM"));
  const [tab, setTab] = useState("time");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(DateTime.now().setZone(ZONE));
  const [editing, setEditing] = useState<Entry | null>(null);
  const loadSequence = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth.user) { router.replace("/login"); return; }
    const level = checked(await db.auth.mfa.getAuthenticatorAssuranceLevel());
    if (level.currentLevel !== "aal2") { router.replace("/login"); return; }
    setUserId(auth.user.id);
    setPersonId((id) => id || auth.user.id);
    const [companies, operators, subscriptions] = await Promise.all([
      allRows((from, to) => db.from("companies").select("*").order("name").order("id").range(from, to)),
      db.from("operators").select("user_id").eq("user_id", auth.user.id).then(checked),
      allRows((from, to) => db.from("subscriptions").select("*").order("company_id").range(from, to)),
    ]);
    const selected = companyId || companies[0]?.id || "";
    if (sequence !== loadSequence.current) return;
    if (!companyId && selected) { setCompanyId(selected); return; }
    const own = selected ? await db.from("company_members").select("*").eq("company_id", selected).eq("user_id", auth.user.id).maybeSingle() : { data: null, error: null };
    if (own.error) throw new Error(own.error.message);
    if (!own.data) {
      if (sequence !== loadSequence.current) return;
      setData({ ...empty, companies, subscriptions, operator: operators.length > 0 }); setLoaded(true); return;
    }
    const [members, projects, entries, models, absences, resolutions, assignments] = await Promise.all([
      allRows((from, to) => db.from("company_members").select("*").eq("company_id", selected).order("user_id").range(from, to)),
      allRows((from, to) => db.from("projects").select("*").eq("company_id", selected).order("name").order("id").range(from, to)),
      allRows((from, to) => db.from("time_entries").select("*").eq("company_id", selected).order("started_at").order("id").range(from, to)),
      allRows((from, to) => db.from("work_models").select("*").eq("company_id", selected).order("valid_from").order("id").range(from, to)),
      allRows((from, to) => db.from("absences").select("*").eq("company_id", selected).order("starts_on").order("id").range(from, to)),
      allRows((from, to) => db.from("break_resolutions").select("*").eq("company_id", selected).order("entry_id").range(from, to)),
      allRows((from, to) => db.from("project_members").select("*").eq("company_id", selected).order("project_id").order("user_id").range(from, to)),
    ]);
    if (sequence !== loadSequence.current) return;
    setData({ companies, members, projects, entries, models, absences, resolutions, assignments, subscriptions, operator: operators.length > 0 });
    setLoaded(true);
  }, [companyId, db, router]);
  useEffect(() => {
    // State updates happen after the asynchronous database response, not during the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().catch((e: unknown) => { setMessage(e instanceof Error ? e.message : "Daten konnten nicht geladen werden."); setFailed(true); });
  }, [reload]);
  useEffect(() => {
    const timer = setInterval(() => setNow(DateTime.now().setZone(ZONE)), 1000);
    return () => clearInterval(timer);
  }, []);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage(""); setFailed(false);
    try { const result = await operation(); await reload(); setMessage(typeof result === "string" ? result : success); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Aktion fehlgeschlagen."); setFailed(true); }
    finally { setBusy(false); }
  }
  function formAction(operation: (form: FormData) => Promise<unknown>, success: string) {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void run(() => operation(form), success);
    };
  }
  const ownMember = data.members.find((m) => m.user_id === userId);
  const company = data.companies.find((c) => c.id === companyId);
  const manager = ownMember?.role === "admin" || ownMember?.role === "hr";
  const admin = ownMember?.role === "admin";
  const selectedPerson = data.members.some((m) => m.user_id === personId) ? personId : userId;
  const person = data.members.find((m) => m.user_id === selectedPerson);
  const entries = data.entries.filter((e) => e.user_id === selectedPerson);
  const models = data.models.filter((m) => m.user_id === selectedPerson);
  const absences = data.absences.filter((a) => a.user_id === selectedPerson);
  const violations = breakViolations(entries, now);
  const running = data.entries.find((e) => e.user_id === userId && !e.ended_at);
  const assigned = data.projects.filter((p) => p.active && data.assignments.some((a) => a.project_id === p.id && a.user_id === userId));
  const projectName = (id: string) => data.projects.find((p) => p.id === id)?.name ?? "Archiviertes Projekt";
  const ownEntries = data.entries.filter((e) => e.user_id === userId);
  const ownViolations = breakViolations(ownEntries, now);
  const report = /^\d{4}-\d{2}$/.test(month) ? monthlyReport(month, entries, models, absences, now) : [];
  const total = report.reduce((sum, d) => ({ worked: sum.worked + d.worked, target: sum.target + d.target, credited: sum.credited + d.vacation + d.sick, balance: sum.balance + d.balance }), { worked: 0, target: 0, credited: 0, balance: 0 });
  const sub = data.subscriptions.find((s) => s.company_id === companyId);
  const range = monthRange(month);
  const visibleEntries = entries.filter((e) => localTime(e.started_at) < range.end && localTime(e.ended_at ?? now.toISO()!) > range.start);

  return <div className="shell">
    <header>
      <Link className="brand" href="/">TimeReport<span>CH</span></Link>
      <div className="header-tools">
        {data.companies.length > 0 && <label>Firma<select value={companyId} disabled={busy} onChange={(e) => {
          loadSequence.current++;
          setLoaded(false); setData(empty); setEditing(null); setCompanyId(e.target.value); setPersonId(userId);
        }}>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <button className="secondary" disabled={busy} onClick={() => run(async () => {
          const { error } = await db.auth.signOut(); if (error) throw new Error(error.message);
          router.replace("/login"); router.refresh();
        }, "")}>Abmelden</button>
      </div>
    </header>
    <main>
      <span className="eyebrow">{company?.name ?? "Dein Arbeitsplatz"} · Europe/Zurich</span>
      <h1>{ownMember ? `Hallo, ${ownMember.display_name}.` : data.operator ? "Firmen verwalten." : "Dein Zugang wird vorbereitet."}</h1>
      {ownMember && <p className="muted">{roleLabel[ownMember.role]} · Zeiten bleiben bei Regelverstössen vollständig erhalten.</p>}
      {message && <p role={failed ? "alert" : "status"} className={`notice ${failed ? "error" : ""}`}>{message}</p>}
      {!loaded && !failed && <p>Daten werden geladen …</p>}
      {loaded && !ownMember && !data.operator && <section className="card"><p>Dein Benutzer ist noch keiner Firma zugewiesen. Bitte kontaktiere deinen Admin.</p></section>}
      <nav aria-label="Hauptnavigation">
        {ownMember && [["time", "Zeiterfassung"], ["absences", "Abwesenheiten"], ["report", "Monatsrapport"]].map(([id, label]) => <button className={tab === id ? "active" : "secondary"} key={id} onClick={() => setTab(id)}>{label}</button>)}
        {manager && <button className={tab === "team" ? "active" : "secondary"} onClick={() => setTab("team")}>Team & Arbeitsmodelle</button>}
        {admin && <button className={tab === "settings" ? "active" : "secondary"} onClick={() => setTab("settings")}>Projekte & Firma</button>}
        {admin && <button className={tab === "billing" ? "active" : "secondary"} onClick={() => setTab("billing")}>Firmenabo</button>}
        {data.operator && <button className={tab === "operator" || !ownMember ? "active" : "secondary"} onClick={() => setTab("operator")}>SaaS-Verwaltung</button>}
      </nav>
      {manager && ["time", "absences", "report"].includes(tab) && <label className="person-picker">Rapport für<select value={selectedPerson} disabled={busy} onChange={(e) => { setPersonId(e.target.value); setEditing(null); }}>
        {data.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
      </select></label>}

      {ownMember && tab === "time" && <>
        <section className={`card clock ${running ? "running" : ""}`}>
          <div><span className="eyebrow">{running ? "Eingecheckt" : "Bereit für den nächsten Arbeitsblock"}</span>
            <h2>{running ? projectName(running.project_id) : "Deine Zeit zählt."}</h2>
            {running && <p className="timer">{minutesLabel(now.diff(localTime(running.started_at), "minutes").minutes)} h</p>}
            {running && <p>Seit {displayTime(running.started_at)}. Die Zeit läuft auch bei geschlossenem Browser weiter.</p>}
          </div>
          {running ? <button disabled={busy} onClick={() => run(async () => {
            const { error } = await db.rpc("check_out", { p_company: companyId });
            if (error) throw new Error(error.message);
          }, "Ausgecheckt. Die Lücke bis zum nächsten Einchecken zählt als Pause.")}>Auschecken / Pause starten</button> :
            <form onSubmit={formAction(async (f) => {
              checked(await db.rpc("check_in", { p_company: companyId, p_project: text(f, "project") }));
            }, "Eingecheckt.")}>
              <label>Projekt<select name="project" required defaultValue=""><option value="" disabled>Projekt wählen</option>{assigned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <button disabled={busy || !assigned.length}>Einchecken</button>
              {!assigned.length && <p>Bitte den Admin um eine Projektzuweisung bitten.</p>}
            </form>}
        </section>
        {running && ownViolations.has(running.id) && <p role="alert" className="notice error">Pausenregel überschritten. Bitte eine Pause machen; HR/Admin muss den Verstoss klären. Deine Arbeitszeit wird weiterhin erfasst.</p>}
        <section className="card"><details><summary>Vergessenen Arbeitsblock nachtragen · {person?.display_name}</summary>
          <p>Zeiten in Zürich. Es gelten Korrekturfrist, Überschneidungsprüfung und die aktuellen Pausenregeln. Die Erfassung wird protokolliert.</p>
          <form onSubmit={formAction(async (f) => {
            const start = DateTime.fromISO(text(f, "start"), { zone: ZONE });
            const end = DateTime.fromISO(text(f, "end"), { zone: ZONE });
            if (!start.isValid || !end.isValid) throw new Error("Ungültige Zeit.");
            checked(await db.rpc("record_entry", { p_company: companyId, p_user: selectedPerson, p_project: text(f, "project"), p_start: start.toISO()!, p_end: end.toISO()!, p_note: text(f, "note"), p_reason: text(f, "reason") }));
          }, "Arbeitsblock nachgetragen.")}>
            <label>Projekt<select name="project" required defaultValue=""><option value="" disabled>Projekt wählen</option>{(manager ? data.projects : assigned).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div className="form-grid"><label>Von<input type="datetime-local" name="start" required /></label><label>Bis<input type="datetime-local" name="end" required /></label></div>
            <label>Notiz<input name="note" maxLength={1000} /></label><label>Erfassungsgrund<input name="reason" minLength={3} maxLength={1000} required /></label>
            <button disabled={busy}>Arbeitsblock nachtragen</button>
          </form>
        </details></section>
        <div className="section-heading"><h2>Arbeitsblöcke · {person?.display_name}</h2><label>Monat<input type="month" min="2000-01" max="2100-12" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} /></label></div>
        <div className="table-wrap"><table><thead><tr><th>Projekt</th><th>Von</th><th>Bis</th><th>Dauer</th><th>Pause / Korrektur</th></tr></thead><tbody>
          {visibleEntries.slice().reverse().map((e) => {
            const resolved = data.resolutions.find((r) => r.entry_id === e.id);
            const canCorrect = e.ended_at && (manager || (e.user_id === userId && company && now < correctionDeadline(e.started_at, company.correction_weeks)));
            return <tr key={e.id}><td>{projectName(e.project_id)}{e.note && <small>{e.note}</small>}</td><td>{displayTime(e.started_at)}</td><td>{e.ended_at ? displayTime(e.ended_at) : "Läuft"}</td>
              <td>{minutesLabel(localTime(e.ended_at ?? now.toISO()!).diff(localTime(e.started_at), "minutes").minutes)}</td>
              <td>{violations.has(e.id) ? <span className={`badge ${resolved ? "" : "warning"}`}>{resolved ? `Geklärt: ${resolved.reason}` : "Pause prüfen"}</span> : "—"}
                {canCorrect && <button className="secondary compact" disabled={busy} onClick={() => setEditing(e)}>Korrigieren</button>}
                {manager && violations.has(e.id) && e.ended_at && !resolved && <form onSubmit={formAction(async (f) => {
                  const { error } = await db.rpc("resolve_break", { p_entry: e.id, p_reason: text(f, "reason") });
                  if (error) throw new Error(error.message);
                }, "Pausenverstoss geklärt.")}><input name="reason" placeholder="Klärungsgrund" minLength={3} maxLength={1000} aria-label="Klärungsgrund" required /><button disabled={busy} className="compact">Klären</button></form>}
              </td></tr>;
          })}
          {!visibleEntries.length && <tr><td colSpan={5}>Noch keine Arbeitsblöcke für diesen Monat.</td></tr>}
        </tbody></table></div>
        {editing && <section className="card"><h2>Arbeitsblock korrigieren</h2><p>Zeiten in Zürich. Jede Änderung wird mit Grund protokolliert.</p>
          <form key={editing.id} onSubmit={formAction(async (f) => {
            const start = DateTime.fromISO(text(f, "start"), { zone: ZONE });
            const end = DateTime.fromISO(text(f, "end"), { zone: ZONE });
            if (!start.isValid || !end.isValid) throw new Error("Ungültige Zeit.");
            const { error } = await db.rpc("correct_entry", { p_entry: editing.id, p_project: text(f, "project"), p_start: start.toISO()!, p_end: end.toISO()!, p_note: text(f, "note"), p_reason: text(f, "reason") });
            if (error) throw new Error(error.message);
            setEditing(null);
          }, "Korrektur gespeichert.")}>
            <label>Projekt<select name="project" defaultValue={editing.project_id}>{data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div className="form-grid"><label>Von<input type="datetime-local" name="start" defaultValue={localTime(editing.started_at).toFormat("yyyy-MM-dd'T'HH:mm")} required /></label>
              <label>Bis<input type="datetime-local" name="end" defaultValue={localTime(editing.ended_at!).toFormat("yyyy-MM-dd'T'HH:mm")} required /></label></div>
            <label>Notiz<input name="note" defaultValue={editing.note} maxLength={1000} /></label>
            <label>Korrekturgrund<input name="reason" minLength={3} maxLength={1000} required /></label>
            <div className="actions"><button disabled={busy}>Korrektur speichern</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Abbrechen</button></div>
          </form>
        </section>}
      </>}

      {ownMember && tab === "absences" && <>
        <div className="tiles">
          <section className="card"><span className="eyebrow">Ferien · {now.year} · {person?.display_name}</span><h2>{(person?.vacation_days ?? 0) - vacationUsed(now.year, models, absences)} Tage verfügbar</h2><p>Jahresguthaben: {person?.vacation_days} Tage. Offene Anträge sind reserviert; nur genehmigte Abwesenheiten werden im Rapport gutgeschrieben.</p></section>
          <section className="card"><span className="eyebrow">Krankheit</span><h2>Separat erfasst</h2><p>Kein begrenztes Guthaben. {company?.absence_approval ? "Freigabe durch HR/Admin erforderlich." : "Abwesenheiten werden ohne Freigabe genehmigt."}</p></section>
        </div>
        <section className="card"><h2>Eigene Abwesenheit erfassen</h2>
          <form onSubmit={formAction(async (f) => {
            checked(await db.rpc("request_absence", { p_company: companyId, p_kind: text(f, "kind"), p_start: text(f, "start"), p_end: text(f, "end"), p_fraction: Number(f.get("fraction")) }));
          }, company?.absence_approval ? "Abwesenheit zur Freigabe eingereicht." : "Abwesenheit gespeichert.")}>
            <div className="form-grid"><label>Art<select name="kind"><option value="vacation">Ferien</option><option value="sick">Krankheit</option></select></label>
              <label>Umfang<select name="fraction"><option value="1">Ganze Tage</option><option value="0.5">Halber Tag (nur ein Datum)</option></select></label>
              <label>Von<input type="date" name="start" required /></label><label>Bis<input type="date" name="end" required /></label></div>
            <button disabled={busy}>Abwesenheit eintragen</button>
          </form>
        </section>
        <div className="table-wrap"><table><thead><tr><th>Art</th><th>Von / bis</th><th>Umfang</th><th>Status</th><th>Entscheidung</th></tr></thead><tbody>
          {absences.map((a) => <tr key={a.id}><td>{a.kind === "vacation" ? "Ferien" : "Krankheit"}</td><td>{a.starts_on} – {a.ends_on}</td><td>{a.fraction === 0.5 ? "Halber Tag" : "Ganze Tage"}</td><td>{statusLabel[a.status]}</td><td>
            {manager && a.status === "pending" && <form onSubmit={formAction(async (f) => {
              const { error } = await db.rpc("review_absence", { p_absence: a.id, p_status: text(f, "status"), p_reason: text(f, "reason") });
              if (error) throw new Error(error.message);
            }, "Entscheidung gespeichert.")}><input name="reason" required minLength={3} maxLength={1000} placeholder="Entscheidungsgrund" aria-label="Entscheidungsgrund" /><select name="status" aria-label="Entscheidung"><option value="approved">Genehmigen</option><option value="rejected">Ablehnen</option></select><button disabled={busy} className="compact">Speichern</button></form>}
          </td></tr>)}
          {!absences.length && <tr><td colSpan={5}>Noch keine Abwesenheiten.</td></tr>}
        </tbody></table></div>
      </>}

      {ownMember && tab === "report" && <>
        <div className="section-heading"><h2>Monatsrapport · {person?.display_name}</h2><label>Monat<input type="month" value={month} min="2000-01" max="2100-12" onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} /></label></div>
        {!models.length && <p className="notice error">Kein Arbeitsmodell hinterlegt. Das Soll ist deshalb 0; bitte HR/Admin kontaktieren.</p>}
        <div className="tiles">
          {[["Arbeitszeit", total.worked], ["Sollzeit", total.target], ["Ferien / Krankheit", total.credited], ["Saldo", total.balance]].map(([label, value]) => <section className="card" key={label}><span className="eyebrow">{label}</span><h2>{minutesLabel(Number(value))} h</h2></section>)}
        </div>
        <p className="muted">Der Saldo berücksichtigt das Soll des ganzen Monats, auch zukünftige Tage. Laufende Buchungen sind vorläufig. Feiertage werden noch nicht automatisch abgezogen.</p>
        <div className="actions">{["pdf", "csv"].map((format) => <a className="button" key={format} href={`/api/report?company=${companyId}&user=${selectedPerson}&month=${month}&format=${format}`}>{format.toUpperCase()} herunterladen</a>)}</div>
        <div className="table-wrap"><table><thead><tr><th>Datum</th><th>Arbeit</th><th>Soll</th><th>Ferien</th><th>Krankheit</th><th>Saldo</th></tr></thead><tbody>
          {report.map((d) => <tr key={d.date}><td>{DateTime.fromISO(d.date).toFormat("dd.MM.yyyy")}</td><td>{minutesLabel(d.worked)}</td><td>{minutesLabel(d.target)}</td><td>{minutesLabel(d.vacation)}</td><td>{minutesLabel(d.sick)}</td><td>{minutesLabel(d.balance)}</td></tr>)}
        </tbody></table></div>
      </>}

      {manager && tab === "team" && <>
        {admin && <section className="card"><h2>Mitarbeitende einladen</h2><form onSubmit={formAction(async (f) => {
          const response = await post("/api/manage", { action: "invite", company: companyId, email: text(f, "email"), name: text(f, "name"), role: text(f, "role") });
          if (!("message" in response) || typeof response.message !== "string") throw new Error("Einladungsbestätigung fehlt.");
          return response.message;
        }, "Benutzer hinzugefügt; neue Benutzer erhalten eine Einladung. Arbeitsmodell und Projektzuweisung bitte ergänzen.")}>
          <div className="form-grid"><label>Name<input name="name" required maxLength={120} /></label><label>E-Mail<input name="email" type="email" required /></label>
            <label>Rolle<select name="role"><option value="employee">Mitarbeitende</option><option value="hr">HR</option><option value="admin">Admin</option></select></label></div><button disabled={busy}>Einladen</button>
        </form></section>}
        {data.members.map((m) => <section className="card" key={m.user_id}>
          <h2>{m.display_name} <span className="badge">{roleLabel[m.role]}</span></h2>
          <p className="muted">Benutzer-ID: {m.user_id}</p>
          {admin && <form onSubmit={formAction(async (f) => {
            const role = text(f, "role");
            if (role !== "admin" && m.role === "admin" && data.members.filter((p) => p.role === "admin").length < 2) throw new Error("Der letzte Firmen-Admin darf nicht entfernt werden.");
            if (role !== "employee" && role !== "hr" && role !== "admin") throw new Error("Ungültige Rolle.");
            checked(await db.from("company_members").update({ display_name: text(f, "name"), role, vacation_days: Number(f.get("vacation")) }).eq("company_id", companyId).eq("user_id", m.user_id).select());
          }, "Mitarbeitenden-Einstellungen gespeichert.")}>
            <div className="form-grid"><label>Name<input name="name" defaultValue={m.display_name} required maxLength={120} /></label>
              <label>Rolle<select name="role" defaultValue={m.role}><option value="employee">Mitarbeitende</option><option value="hr">HR</option><option value="admin">Admin</option></select></label>
              <label>Ferientage pro Jahr<input name="vacation" type="number" min={0} max={100} step={0.5} defaultValue={m.vacation_days} required /></label></div><button disabled={busy} className="secondary">Profil speichern</button>
          </form>}
          <details><summary>Arbeitsmodell hinterlegen</summary><p>Gültig ab Datum, bis zum nächsten Modell. Die Tagesverteilung ergibt das Wochen-Soll. Geplante Uhrzeiten sind informativ und starten keine Buchungen.</p>
            <form onSubmit={formAction(async (f) => {
              const weekday_minutes = weekdays.map((_, i) => Number(f.get(`day${i}`)));
              checked(await db.from("work_models").upsert({ company_id: companyId, user_id: m.user_id, valid_from: text(f, "from"), weekday_minutes, planned_start: text(f, "start") || null, planned_end: text(f, "end") || null }, { onConflict: "company_id,user_id,valid_from" }).select());
            }, "Arbeitsmodell gespeichert.")}>
              <label>Gültig ab<input name="from" type="date" required defaultValue={now.setZone(ZONE).toISODate()!} /></label>
              <div className="form-grid">{weekdays.map((day, i) => <label key={day}>{day} (Minuten)<input name={`day${i}`} type="number" min={0} max={1440} defaultValue={i < 5 ? 480 : 0} required /></label>)}</div>
              <div className="form-grid"><label>Geplanter Beginn<input name="start" type="time" /></label><label>Geplantes Ende<input name="end" type="time" /></label></div>
              <button disabled={busy}>Arbeitsmodell speichern</button>
            </form>
            {data.models.filter((w) => w.user_id === m.user_id).map((w) => <p key={w.id}>Ab {w.valid_from}: {minutesLabel(w.weekday_minutes.reduce((sum, n) => sum + n, 0))} h / Woche · {w.planned_start ?? "—"} bis {w.planned_end ?? "—"}</p>)}
          </details>
        </section>)}
      </>}

      {admin && tab === "settings" && <>
        <section className="card"><h2>Firmenregeln</h2><form onSubmit={formAction(async (f) => {
          checked(await db.from("companies").update({ name: text(f, "name"), correction_weeks: Number(f.get("weeks")), absence_approval: f.get("approval") === "on", max_work_minutes: Number(f.get("work")), min_break_minutes: Number(f.get("break")) }).eq("id", companyId).select());
        }, "Firmenregeln gespeichert. Pausenänderungen gelten für neue Arbeitsblöcke.")}>
          <label>Firmenname<input name="name" defaultValue={company?.name} required maxLength={120} /></label>
          <div className="form-grid"><label>Zusätzliche Korrekturwochen<input type="number" name="weeks" defaultValue={company?.correction_weeks} min={0} max={8} required /></label>
            <label>Arbeit spätestens nach (Minuten)<input type="number" name="work" defaultValue={company?.max_work_minutes} min={15} max={720} required /></label>
            <label>Erforderliche Pause (Minuten)<input type="number" name="break" defaultValue={company?.min_break_minutes} min={1} max={120} required /></label></div>
          <label className="check"><input name="approval" type="checkbox" defaultChecked={company?.absence_approval} /> Abwesenheiten müssen genehmigt werden</label>
          <p>1 zusätzliche Woche: Korrektur bis Sonntag der Folgewoche, 23:59 Uhr Zürich. Danach nur HR/Admin.</p><button disabled={busy}>Regeln speichern</button>
        </form></section>
        <section className="card"><h2>Projekt erstellen</h2><form onSubmit={formAction(async (f) => {
          checked(await db.from("projects").insert({ company_id: companyId, name: text(f, "name"), max_work_minutes: text(f, "work") ? Number(f.get("work")) : null, min_break_minutes: text(f, "break") ? Number(f.get("break")) : null }).select());
        }, "Projekt erstellt. Bitte Mitarbeitende zuweisen.")}>
          <label>Projektname<input name="name" required maxLength={120} /></label>
          <div className="form-grid"><label>Max. Arbeit (Minuten, optional)<input type="number" name="work" min={15} max={720} /></label><label>Min. Pause (Minuten, optional)<input type="number" name="break" min={1} max={120} /></label></div>
          <p>Projektregeln können die Firmenregel verschärfen, nicht lockern. Projektwechsel setzt die Arbeitszeit seit der letzten ausreichenden Pause nicht zurück.</p><button disabled={busy}>Projekt erstellen</button>
        </form></section>
        {data.projects.map((p) => <section key={p.id} className="card"><h2>{p.name} <span className="badge">{p.active ? "Aktiv" : "Archiviert"}</span></h2>
          <form onSubmit={formAction(async (f) => {
            checked(await db.from("projects").update({ name: text(f, "name"), active: f.get("active") === "on", max_work_minutes: text(f, "work") ? Number(f.get("work")) : null, min_break_minutes: text(f, "break") ? Number(f.get("break")) : null }).eq("id", p.id).eq("company_id", companyId).select());
          }, "Projekt gespeichert.")}>
            <div className="form-grid"><label>Name<input name="name" defaultValue={p.name} required maxLength={120} /></label><label>Max. Arbeit (Minuten)<input name="work" type="number" min={15} max={720} defaultValue={p.max_work_minutes ?? ""} /></label><label>Min. Pause (Minuten)<input name="break" type="number" min={1} max={120} defaultValue={p.min_break_minutes ?? ""} /></label></div>
            <label className="check"><input name="active" type="checkbox" defaultChecked={p.active} /> Aktiv</label><button disabled={busy} className="secondary">Projekt speichern</button>
          </form>
          <h3>Zugewiesene Mitarbeitende</h3>
          {data.members.map((m) => {
            const assigned = data.assignments.some((a) => a.project_id === p.id && a.user_id === m.user_id);
            return <label className="check" key={m.user_id}><input type="checkbox" checked={assigned} disabled={busy} onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                if (enabled) checked(await db.from("project_members").insert({ company_id: companyId, project_id: p.id, user_id: m.user_id }).select());
                else checked(await db.from("project_members").delete().eq("project_id", p.id).eq("user_id", m.user_id).select());
              }, "Projektzuweisung gespeichert.");
            }} />{m.display_name}</label>;
          })}
        </section>)}
      </>}

      {admin && tab === "billing" && <section className="card"><h2>Ein Firmenabo für dein Team.</h2>
        <p>Status: <strong>{sub?.complimentary ? "Kostenfrei freigeschaltet" : sub?.status ?? "Nicht eingerichtet"}</strong></p>
        <p>Monatlicher Festpreis pro Firma. Preis und Währung werden vor Abschluss im Stripe-Checkout angezeigt. Keine automatische Abbuchung ohne Abschluss.</p>
        <div className="actions"><button disabled={busy || !sub || sub.complimentary} onClick={() => run(async () => {
          const result = await post("/api/billing", { company: companyId, action: "checkout" });
          if ("url" in result && typeof result.url === "string") window.location.assign(result.url); else throw new Error("Checkout-URL fehlt.");
        }, "")}>Firmenabo abschliessen</button>
          <button className="secondary" disabled={busy || !sub?.stripe_customer_id} onClick={() => run(async () => {
            const result = await post("/api/billing", { company: companyId, action: "portal" });
            if ("url" in result && typeof result.url === "string") window.location.assign(result.url); else throw new Error("Portal-URL fehlt.");
          }, "")}>Abo verwalten</button></div>
        <p className="muted">Im Pilotbetrieb sperrt ein Zahlungsproblem keine Zeiterfassung. Eine kommerzielle Zugangssperre wird vor dem Verkauf gesondert festgelegt.</p>
      </section>}

      {data.operator && (tab === "operator" || !ownMember) && <>
        <section className="card"><h2>Firma aufnehmen</h2><p>Als Betreiber siehst du Firmen und Abostatus, aber keine Zeitrapporte ohne ausdrückliche Firmenmitgliedschaft.</p>
          <form onSubmit={formAction(async (f) => {
            await post("/api/manage", { action: "createCompany", name: text(f, "name"), email: text(f, "email"), adminName: text(f, "adminName") });
          }, "Firma angelegt und Admin eingeladen.")}>
            <div className="form-grid"><label>Firmenname<input name="name" required maxLength={120} /></label><label>Admin-Name<input name="adminName" required maxLength={120} /></label><label>Admin-E-Mail<input name="email" type="email" required /></label></div>
            <button disabled={busy}>Firma anlegen</button>
          </form>
        </section>
        {data.companies.map((c) => {
          const subscription = data.subscriptions.find((s) => s.company_id === c.id);
          return <section className="card" key={c.id}><h2>{c.name}</h2><p>{subscription?.complimentary ? "Kostenfrei" : subscription?.status ?? "Kein Abostatus"}</p>
            <button disabled={busy} className="secondary" onClick={() => run(async () => {
              await post("/api/manage", { action: "complimentary", company: c.id, enabled: !subscription?.complimentary });
            }, subscription?.complimentary ? "Kostenfreie Freischaltung aufgehoben." : "Kostenfrei freigeschaltet. Bestehende Stripe-Abos werden nicht automatisch gekündigt.")}>{subscription?.complimentary ? "Kostenfreie Freischaltung aufheben" : "Kostenfrei freischalten"}</button>
          </section>;
        })}
      </>}
    </main>
    <footer>TimeReport · Schweizer Zeiterfassung · Arbeitszeit wird serverseitig gespeichert, nicht im Browser.</footer>
  </div>;
}
