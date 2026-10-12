"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
import { allRows, checked } from "@/lib/query";
import { breakViolations, correctionDeadline, displayTime, localTime, minutesLabel, monthRange, monthlyReport, vacationUsed, ZONE } from "@/lib/time";
import type { Absence, Company, EmailJob, Entry, Member, OnboardingProgress, Project, ReportAlert, ReportSetting, Resolution, Subscription, WorkModel } from "@/lib/types";
import Modal from "./modal";
import { isSection, sections, WorkspaceNav, type Section } from "./workspace";
import { setupSteps } from "@/lib/onboarding";
import WorkSchedule from "./work-schedule";
import FirstRun, { type WizardStep } from "./first-run";
import ReportCenter from "./report-center";

type Data = {
  companies: Company[]; members: Member[]; projects: Project[]; entries: Entry[];
  models: WorkModel[]; absences: Absence[]; resolutions: Resolution[];
  assignments: { project_id: string; user_id: string; company_id: string }[];
  subscriptions: Subscription[]; operator: boolean;
  reportSettings: ReportSetting[]; alerts: ReportAlert[]; jobs: EmailJob[];
  holidays: { company_id: string; day: string; label: string }[];
  progress: OnboardingProgress | null; lastChecked: string | null;
};
const empty: Data = { companies: [], members: [], projects: [], entries: [], models: [], absences: [], resolutions: [], assignments: [], subscriptions: [], operator: false,
  reportSettings: [], alerts: [], jobs: [], holidays: [], progress: null, lastChecked: null };
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
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
  const [tab, setTab] = useState<Section>("time");
  const [panel, setPanel] = useState<"manual" | "absence" | "invite" | "project" | "company" | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(DateTime.now().setZone(ZONE));
  const [editing, setEditing] = useState<Entry | null>(null);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const loadSequence = useRef(0);

  function navigate(section: Section) {
    setTab(section); setPanel(null); setEditing(null); setSearch("");
    window.location.hash = section;
    window.scrollTo({ top: 0 });
  }
  function openPanel(value: NonNullable<typeof panel>) {
    setMessage(""); setFailed(false); setPanel(value);
  }
  useEffect(() => {
    function sync() {
      const value = window.location.hash.slice(1);
      if (isSection(value)) { setTab(value); setPanel(null); setEditing(null); setSearch(""); }
    }
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

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
      const { data: progress, error: progressError } = await db.from("onboarding_progress").select("*").eq("user_id", auth.user.id).eq("scope", "operator").maybeSingle();
      if (progressError) throw new Error(`Neue Datenbankmigration erforderlich: ${progressError.message}`);
      if (sequence !== loadSequence.current) return;
      setData({ ...empty, companies, subscriptions, operator: operators.length > 0, progress }); setLoaded(true); return;
    }
    const [reportSettings, alerts, jobs, holidays, progressResult, scheduler] = await Promise.all([
      allRows((from, to) => db.from("report_settings").select("*").eq("company_id", selected).order("user_id").range(from, to)),
      allRows((from, to) => db.from("report_alerts").select("*").eq("company_id", selected).order("work_day", { ascending: false }).order("id").range(from, to)),
      allRows((from, to) => db.from("email_outbox").select("*").eq("company_id", selected).order("id").range(from, to)),
      allRows((from, to) => db.from("company_holidays").select("*").eq("company_id", selected).order("day").range(from, to)),
      db.from("onboarding_progress").select("*").eq("user_id", auth.user.id).eq("scope", selected).maybeSingle(),
      db.from("scheduler_status").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (progressResult.error) throw new Error(`Neue Datenbankmigration erforderlich: ${progressResult.error.message}`);
    if (scheduler.error) throw new Error(scheduler.error.message);
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
    setData({ companies, members, projects, entries, models, absences, resolutions, assignments, subscriptions, operator: operators.length > 0,
      reportSettings, alerts, jobs, holidays, progress: progressResult.data, lastChecked: scheduler.data?.last_checked_at ?? null });
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
  useEffect(() => {
    if (!loaded || !companyId) return;
    const timer = setInterval(() => {
      if (busy || document.visibilityState !== "visible") return;
      void reload().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Hinweise konnten nicht aktualisiert werden.");
        setFailed(true);
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [busy, companyId, loaded, reload]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage(""); setFailed(false);
    try { const result = await operation(); await reload(); setPanel(null); setMessage(typeof result === "string" ? result : success); }
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
  const allowed: Section[] = [
    ...(ownMember ? ["time", "history", "absences", "report", "notifications"] as Section[] : []),
    ...(manager ? ["team"] as Section[] : []),
    ...(admin ? ["projects", "settings", "billing"] as Section[] : []),
    ...(data.operator ? ["operator"] as Section[] : []),
  ];
  const current = allowed.includes(tab) ? tab : allowed[0] ?? "time";
  const today = now.toISODate()!;
  const ownModels = data.models.filter((m) => m.user_id === userId);
  const ownAbsences = data.absences.filter((a) => a.user_id === userId);
  const todayReport = monthlyReport(now.toFormat("yyyy-MM"), ownEntries, ownModels, ownAbsences, now).find((d) => d.date === today)!;
  const todayEntries = ownEntries.filter((e) => localTime(e.started_at) < now.endOf("day") && localTime(e.ended_at ?? now.toISO()!) >= now.startOf("day"));
  const weekStart = now.startOf("week");
  const weekDays = [
    ...(weekStart.month !== now.month ? monthlyReport(weekStart.toFormat("yyyy-MM"), ownEntries, ownModels, ownAbsences, now) : []),
    ...monthlyReport(now.toFormat("yyyy-MM"), ownEntries, ownModels, ownAbsences, now),
  ].filter((d) => d.date >= weekStart.toISODate()! && d.date <= today);
  const steps = setupSteps(data.members, data.projects, data.models, data.assignments, today);
  const needsSetup = admin && steps.some((s) => !s.done);
  const pending = data.absences.filter((a) => a.status === "pending");
  const dueAlerts = data.alerts.filter((a) => a.status === "open" && localTime(a.due_at) <= now);
  const elapsedSeconds = running ? Math.max(0, Math.floor(now.diff(localTime(running.started_at), "seconds").seconds)) : 0;
  const timerLabel = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:${String(Math.floor(elapsedSeconds / 60) % 60).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const filteredMembers = data.members.filter((m) => m.display_name.toLocaleLowerCase("de-CH").includes(search.toLocaleLowerCase("de-CH")));
  const filteredProjects = data.projects.filter((p) => p.name.toLocaleLowerCase("de-CH").includes(search.toLocaleLowerCase("de-CH")));
  const wizardSteps: WizardStep[] = ownMember ? [
    { title: "Willkommen in deinem Arbeitsplatz", description: "Dein Zugang ist durch Authenticator geschützt. Wir richten deinen Firmenkontext gemeinsam ein.", ready: true, required: true },
    ...(admin ? [
      { title: "Firmenregeln festlegen", description: "Prüfe Firmenname, Pausen, Korrekturfrist und Freigaben. Speichere Änderungen im Bereich Firmenregeln.", section: "settings" as const, ready: true, required: false },
      { title: "Arbeitszeiten hinterlegen", description: "Jede Person benötigt ein gültiges Arbeitsmodell. Für Hinweise werden zusätzlich geplante Uhrzeiten benötigt.", section: "team" as const, ready: steps[0].done, required: true },
      { title: "Projekte und Team verbinden", description: "Erstelle ein aktives Projekt und weise jede Person zu.", section: "projects" as const, ready: steps[1].done && steps[2].done, required: true },
      { title: "Hinweise konfigurieren", description: "Optional: Im Team je Person die Prüfung aktivieren, HR/Admin bestimmen und eine Frist nach Arbeitsbeginn festlegen. Ohne Aktivierung werden keine Hinweise erstellt.", section: "team" as const, ready: true, required: false },
    ] : [
      { title: "Deine Arbeitszeiten prüfen", description: ownModels.some((m) => m.valid_from <= today) ? `Dein Wochen-Soll: ${minutesLabel(ownModels.filter((m) => m.valid_from <= today).sort((a,b) => b.valid_from.localeCompare(a.valid_from))[0].weekday_minutes.reduce((sum,n) => sum+n,0))} h. Änderungen übernimmt HR/Admin.` : "Dein Arbeitsmodell fehlt noch. Bitte HR/Admin um Einrichtung bitten.", section: "time" as const, ready: ownModels.some((m) => m.valid_from <= today), required: true },
      { title: "Deine Projekte kennenlernen", description: assigned.length ? `Zugewiesen: ${assigned.map((p) => p.name).join(", ")}. Einchecken erstellt eine echte Buchung; die Einführung selbst tut das nicht.` : "Noch kein aktives Projekt zugewiesen. Bitte den Firmen-Admin kontaktieren.", section: "time" as const, ready: assigned.length > 0, required: true },
    ]),
    { title: "Zeiten und Abwesenheiten verstehen", description: "Auschecken startet eine Pause. Nachträge liegen unter Zeitbuchungen. Abwesenheiten erfassen und bei Bedarf genehmigen lassen; Hinweise sind keine automatische Fehlzeitenbewertung.", section: "absences" as const, ready: true, required: false },
    { title: "Bereit für deinen ersten Arbeitstag", description: "Du kannst jederzeit über Einführung fortsetzen bzw. erneut öffnen. Deine Arbeitszeiten und Firmeneinstellungen bleiben dabei erhalten.", section: "time" as const, ready: true, required: true },
  ] : [
    { title: "Willkommen als Betreiber", description: "Dein sicherer Zugang ist eingerichtet. Als Betreiber verwaltest du Firmen, nicht automatisch ihre Personaldaten.", ready: true, required: true },
    { title: "Erste Firma aufnehmen", description: "Firmenname, Admin und E-Mail hinterlegen. Deine bestehende E-Mail kann als Admin verwendet werden.", section: "operator" as const, ready: data.companies.length > 0, required: true },
    { title: "Freischaltung und Übergabe", description: "Entscheide in der SaaS-Verwaltung über die kostenfreie Freischaltung. Firmen-Admins erhalten ihre eigene Einrichtung für Arbeitsmodelle und Projekte.", section: "operator" as const, ready: true, required: false },
  ];
  async function saveWizard(step: number, completed: boolean) {
    setWizardError("");
    try {
      checked(await db.from("onboarding_progress").upsert({
        user_id: userId, scope: ownMember ? companyId : "operator", step: Math.min(step, wizardSteps.length - 1), completed, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,scope" }).select());
      await reload();
    } catch (error) { setWizardError(error instanceof Error ? error.message : "Fortschritt konnte nicht gespeichert werden."); }
  }

  return <div className="shell">
    <a className="skip-link" href="#workspace">Zum Inhalt</a>
    <WorkspaceNav allowed={allowed} current={current} name={ownMember?.display_name ?? "Betreiber"} role={ownMember ? roleLabel[ownMember.role] : "SaaS-Verwaltung"}
      busy={busy} onNavigate={navigate} onSignOut={() => run(async () => {
        const { error } = await db.auth.signOut(); if (error) throw new Error(error.message);
        router.replace("/login"); router.refresh();
      }, "")} />
    <div className="workspace-body">
    <header className="topbar">
      <span className="breadcrumb">Arbeitsplatz <span>/</span> <strong>{sections[current].title}</strong></span>
      <div className="header-tools">
        {data.companies.length > 0 && <label>Firma<select value={companyId} disabled={busy} onChange={(e) => {
          loadSequence.current++;
          setLoaded(false); setData(empty); setEditing(null); setPanel(null); setSearch(""); setWizardDismissed(false); setWizardError(""); setCompanyId(e.target.value); setPersonId(userId);
        }}>{data.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <span className="secure-label">2FA geschützt</span>
        {loaded && <button className="secondary compact" disabled={busy} onClick={async () => { setWizardDismissed(false); await saveWizard(0, false); }}>Einführung öffnen</button>}
      </div>
    </header>
    <main id="workspace">
      <div className="page-heading">
        <div><span className="eyebrow">{now.setLocale("de-CH").toFormat("cccc, dd. MMMM yyyy")}</span>
        <h1>{loaded ? sections[current].title : "Dein Arbeitsplatz"}</h1>
        <p className="muted">{loaded ? sections[current].description : "Deine Übersicht wird vorbereitet."}</p></div>
        {loaded && <div className="actions">
          {current === "history" && ownMember && <button disabled={busy} onClick={() => openPanel("manual")}>+ Zeit nachtragen</button>}
          {current === "absences" && ownMember && <button disabled={busy} onClick={() => openPanel("absence")}>+ Abwesenheit erfassen</button>}
          {current === "team" && admin && <button disabled={busy} onClick={() => openPanel("invite")}>+ Person einladen</button>}
          {current === "projects" && admin && <button disabled={busy} onClick={() => openPanel("project")}>+ Projekt erstellen</button>}
          {current === "operator" && data.operator && <button disabled={busy} onClick={() => openPanel("company")}>+ Firma aufnehmen</button>}
        </div>}
      </div>
      {message && !panel && !editing && <p role={failed ? "alert" : "status"} className={`notice ${failed ? "error" : ""}`}>{message}</p>}
      {!loaded && !failed && <div className="loading-state" role="status"><span className="loading-dot" /> Daten werden geladen …</div>}
      {!loaded && failed && <button className="secondary" disabled={busy} onClick={() => run(reload, "Übersicht aktualisiert.")}>Erneut laden</button>}
      {loaded && !ownMember && !data.operator && <section className="card"><p>Dein Benutzer ist noch keiner Firma zugewiesen. Bitte kontaktiere deinen Admin.</p></section>}
      {loaded && (ownMember || data.operator) && !data.progress?.completed && !wizardDismissed &&
        <FirstRun steps={wizardSteps} progress={data.progress} busy={busy} error={wizardError} onSave={saveWizard} onNavigate={navigate} onLater={() => setWizardDismissed(true)} />}
      {loaded && !data.progress?.completed && wizardDismissed && <button className="secondary compact" onClick={() => setWizardDismissed(false)}>Einrichtung fortsetzen</button>}
      {manager && ["history", "absences", "report"].includes(current) && <label className="person-picker">Ansicht für<select value={selectedPerson} disabled={busy} onChange={(e) => { setPersonId(e.target.value); setEditing(null); }}>
        {data.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
      </select></label>}

      {ownMember && current === "time" && <>
        {!!dueAlerts.length && <button className="review-banner" onClick={()=>navigate("notifications")}><strong>{dueAlerts.length} offene Hinweise</strong><span>Zeiterfassung und Rückmeldungen prüfen →</span></button>}
        {needsSetup && <section className="onboarding card">
          <div className="section-heading"><div><span className="eyebrow">Einrichtung</span><h2>In drei Schritten startklar.</h2></div><span className="badge">{steps.filter((s) => s.done).length} von 3 erledigt</span></div>
          <div className="setup-steps">{steps.map((step, i) => <button key={step.title} className={`setup-step ${step.done ? "done" : ""}`} onClick={() => navigate(step.section)}>
            <span className="step-number">{step.done ? "✓" : i + 1}</span><span><strong>{step.title}</strong><small>{step.description}</small></span><span aria-hidden="true">→</span>
          </button>)}</div>
        </section>}
        <div className="tiles stats">
          <section className="card"><span className="eyebrow">Heute erfasst</span><h2>{minutesLabel(todayReport.worked)} <small>h</small></h2><p>{todayEntries.length} Arbeitsblöcke heute</p></section>
          <section className="card"><span className="eyebrow">Tagessoll</span><h2>{minutesLabel(todayReport.target)} <small>h</small></h2><p>{ownModels.some((m) => m.valid_from <= today) ? "Gemäss deinem Arbeitsmodell" : "Noch kein gültiges Arbeitsmodell"}</p></section>
          <section className="card"><span className="eyebrow">Diese Woche bis heute</span><h2>{minutesLabel(weekDays.reduce((sum, d) => sum + d.worked, 0))} <small>h</small></h2><p>Arbeit ohne Abwesenheitsgutschriften</p></section>
        </div>
        <section className={`card clock ${running ? "running" : ""}`}>
          <div><span className={`clock-status ${running ? "live" : ""}`}><span />{running ? "Zeiterfassung läuft" : "Aktuell ausgecheckt"}</span>
            <p className="timer">{running ? timerLabel : "00:00:00"}</p>
            <h2>{running ? projectName(running.project_id) : `Bereit, ${ownMember.display_name.split(" ")[0]}?`}</h2>
            <p className="muted">{running ? `Gestartet um ${localTime(running.started_at).toFormat("HH:mm")} Uhr · läuft auch bei geschlossenem Browser.` : "Wähle dein Projekt und starte deinen nächsten Arbeitsblock."}</p>
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
        <section className="card day-progress"><div className="section-heading"><h2>Dein Tagesfortschritt</h2><strong>{minutesLabel(todayReport.worked + todayReport.vacation + todayReport.sick)} / {minutesLabel(todayReport.target)} h</strong></div>
          <progress max={Math.max(todayReport.target, 1)} value={Math.min(todayReport.worked + todayReport.vacation + todayReport.sick, Math.max(todayReport.target, 1))} aria-label="Erfülltes Tagessoll" />
          <p className="muted">{todayReport.target > 0 ? `${minutesLabel(Math.max(0, todayReport.target - todayReport.worked - todayReport.vacation - todayReport.sick))} h bis zum Tagessoll · genehmigte Abwesenheiten zählen mit.` : "Heute ist kein Soll hinterlegt."}</p>
        </section>
        {manager && pending.length > 0 && <button className="review-banner" onClick={() => navigate("absences")}><strong>{pending.length} offene Abwesenheitsanträge</strong><span>Im Bereich Abwesenheiten prüfen →</span></button>}
        <div className="section-heading"><h2>Heute gebucht</h2><button className="secondary compact" onClick={() => { setPersonId(userId); navigate("history"); }}>Alle Buchungen ansehen →</button></div>
        {todayEntries.length ? <div className="today-list">{todayEntries.slice().reverse().map((e) => <div className="today-row" key={e.id}><span className="project-dot" /><div><strong>{projectName(e.project_id)}</strong><small>{displayTime(e.started_at)} – {e.ended_at ? displayTime(e.ended_at) : "läuft"}</small></div><span className="badge">{e.ended_at ? minutesLabel(Math.max(0, (Math.min(localTime(e.ended_at).toMillis(), now.endOf("day").toMillis()) - Math.max(localTime(e.started_at).toMillis(), now.startOf("day").toMillis())) / 60000)) + " h heute" : "Aktiv"}</span></div>)}</div> : <section className="empty-state card"><h3>Dein Tag beginnt hier.</h3><p>Nach dem ersten Einchecken erscheinen deine Arbeitsblöcke an dieser Stelle.</p></section>}
      </>}
      {ownMember && current === "history" && <>
        {panel === "manual" && <Modal title={`Zeit nachtragen · ${person?.display_name}`} busy={busy} onClose={() => setPanel(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
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
        </Modal>}
        <div className="section-heading"><h2>Arbeitsblöcke · {person?.display_name}</h2><label>Monat<input type="month" min="2000-01" max="2100-12" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} /></label></div>
        <div className="table-wrap"><table><thead><tr><th>Projekt</th><th>Von</th><th>Bis</th><th>Dauer</th><th>Pause / Korrektur</th></tr></thead><tbody>
          {visibleEntries.slice().reverse().map((e) => {
            const resolved = data.resolutions.find((r) => r.entry_id === e.id);
            const canCorrect = e.ended_at && (manager || (e.user_id === userId && company && now < correctionDeadline(e.started_at, company.correction_weeks)));
            return <tr key={e.id}><td>{projectName(e.project_id)}{e.note && <small>{e.note}</small>}</td><td>{displayTime(e.started_at)}</td><td>{e.ended_at ? displayTime(e.ended_at) : "Läuft"}</td>
              <td>{minutesLabel(localTime(e.ended_at ?? now.toISO()!).diff(localTime(e.started_at), "minutes").minutes)}</td>
              <td>{violations.has(e.id) ? <span className={`badge ${resolved ? "" : "warning"}`}>{resolved ? `Geklärt: ${resolved.reason}` : "Pause prüfen"}</span> : "—"}
                {canCorrect && <button className="secondary compact" disabled={busy} onClick={() => { setMessage(""); setFailed(false); setEditing(e); }}>Korrigieren</button>}
                {manager && violations.has(e.id) && e.ended_at && !resolved && <form onSubmit={formAction(async (f) => {
                  const { error } = await db.rpc("resolve_break", { p_entry: e.id, p_reason: text(f, "reason") });
                  if (error) throw new Error(error.message);
                }, "Pausenverstoss geklärt.")}><input name="reason" placeholder="Klärungsgrund" minLength={3} maxLength={1000} aria-label="Klärungsgrund" required /><button disabled={busy} className="compact">Klären</button></form>}
              </td></tr>;
          })}
          {!visibleEntries.length && <tr><td colSpan={5}>Noch keine Arbeitsblöcke für diesen Monat.</td></tr>}
        </tbody></table></div>
        {editing && <Modal title="Arbeitsblock korrigieren" busy={busy} onClose={() => setEditing(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
          <p>Zeiten in Zürich. Jede Änderung wird mit Grund protokolliert.</p>
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
        </Modal>}
      </>}

      {ownMember && current === "absences" && <>
        <div className="tiles">
          <section className="card"><span className="eyebrow">Ferien · {now.year} · {person?.display_name}</span><h2>{(person?.vacation_days ?? 0) - vacationUsed(now.year, models, absences)} Tage verfügbar</h2><p>Jahresguthaben: {person?.vacation_days} Tage. Offene Anträge sind reserviert; nur genehmigte Abwesenheiten werden im Rapport gutgeschrieben.</p></section>
          <section className="card"><span className="eyebrow">Krankheit</span><h2>Separat erfasst</h2><p>Kein begrenztes Guthaben. {company?.absence_approval ? "Freigabe durch HR/Admin erforderlich." : "Abwesenheiten werden ohne Freigabe genehmigt."}</p></section>
        </div>
        {manager && <p className="notice">Du prüfst die Anträge von <strong>{person?.display_name}</strong>. Über «Abwesenheit erfassen» trägst du immer eine eigene Abwesenheit ein.</p>}
        {panel === "absence" && <Modal title="Eigene Abwesenheit erfassen" busy={busy} onClose={() => setPanel(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
          <form onSubmit={formAction(async (f) => {
            const fraction = Number(f.get("fraction"));
            checked(await db.rpc("request_absence", { p_company: companyId, p_kind: text(f, "kind"), p_start: text(f, "start"), p_end: text(f, "end"), p_fraction: fraction, p_part: fraction === 0.5 ? text(f, "part") : null }));
          }, company?.absence_approval ? "Abwesenheit zur Freigabe eingereicht." : "Abwesenheit gespeichert.")}>
            <div className="form-grid"><label>Art<select name="kind"><option value="vacation">Ferien</option><option value="sick">Krankheit</option></select></label>
              <label>Umfang<select name="fraction"><option value="1">Ganze Tage</option><option value="0.5">Halber Tag (nur ein Datum)</option></select></label>
              <label>Tageshälfte (nur bei halbem Tag)<select name="part"><option value="morning">Vormittag</option><option value="afternoon">Nachmittag</option></select></label>
              <label>Von<input type="date" name="start" required /></label><label>Bis<input type="date" name="end" required /></label></div>
            <button disabled={busy}>Abwesenheit eintragen</button>
          </form>
        </Modal>}
        <div className="table-wrap"><table><thead><tr><th>Art</th><th>Von / bis</th><th>Umfang</th><th>Status</th><th>Entscheidung</th></tr></thead><tbody>
          {absences.map((a) => <tr key={a.id}><td>{a.kind === "vacation" ? "Ferien" : "Krankheit"}</td><td>{a.starts_on} – {a.ends_on}</td><td>{a.fraction === 0.5 ? a.day_part === "morning" ? "Vormittag" : a.day_part === "afternoon" ? "Nachmittag" : "Halber Tag – Zuordnung offen" : "Ganze Tage"}</td><td>{statusLabel[a.status]}</td><td>
            {manager && a.fraction===0.5 && <details><summary>Tageshälfte zuordnen</summary><form onSubmit={formAction(async(f)=>{
              const {error}=await db.rpc("set_absence_part",{p_absence:a.id,p_part:text(f,"part"),p_reason:text(f,"reason")});
              if(error) throw new Error(error.message);
            },"Tageshälfte gespeichert; Hinweise werden beim nächsten Scheduler-Lauf neu geprüft.")}><label>Tageshälfte<select name="part" defaultValue={a.day_part ?? "morning"}><option value="morning">Vormittag</option><option value="afternoon">Nachmittag</option></select></label><label>Änderungsgrund<input name="reason" required minLength={3} maxLength={1000} /></label><button disabled={busy}>Zuordnung speichern</button></form></details>}
            {manager && a.status === "pending" && <form onSubmit={formAction(async (f) => {
              const { error } = await db.rpc("review_absence", { p_absence: a.id, p_status: text(f, "status"), p_reason: text(f, "reason") });
              if (error) throw new Error(error.message);
            }, "Entscheidung gespeichert.")}><input name="reason" required minLength={3} maxLength={1000} placeholder="Entscheidungsgrund" aria-label="Entscheidungsgrund" /><select name="status" aria-label="Entscheidung"><option value="approved">Genehmigen</option><option value="rejected">Ablehnen</option></select><button disabled={busy} className="compact">Speichern</button></form>}
          </td></tr>)}
          {!absences.length && <tr><td colSpan={5}>Noch keine Abwesenheiten.</td></tr>}
        </tbody></table></div>
      </>}
      {ownMember && current === "notifications" && <>
        <div className="actions"><button className="secondary" disabled={busy} onClick={() => run(reload, "Hinweise aktualisiert.")}>Hinweise aktualisieren</button></div>
        {manager && <p className="muted">{data.lastChecked ? `Letzte serverseitige Prüfung: ${displayTime(data.lastChecked)}` : "Scheduler noch nicht ausgeführt. SMTP und Zeitplan gemäss README einrichten."}</p>}
        <ReportCenter alerts={data.alerts} jobs={data.jobs} members={data.members} userId={userId} manager={manager} busy={busy} nowMs={now.toMillis()} onRetry={async(job)=>{
          await run(async()=>{
            const {error}=await db.rpc("retry_report_email",{p_job:job});
            if(error) throw new Error(error.message);
          },"Neuer Zustellversuch für den nächsten Scheduler-Lauf beauftragt.");
        }} onAction={async (alert, action, reason) => {
          await run(async () => {
            const { error } = await db.rpc("handle_report_alert", { p_alert: alert, p_action: action, p_reason: reason ?? "" });
            if (error) throw new Error(error.message);
          }, action === "remind" ? "Erinnerung in der App sichtbar; E-Mail zum Versand durch den Scheduler vorgemerkt." : "Hinweis nachvollziehbar geklärt.");
        }} />
      </>}

      {ownMember && current === "report" && <>
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

      {manager && current === "team" && <>
        <div className="collection-toolbar"><span>{data.members.length} Personen im Team</span><label>Team durchsuchen<input type="search" placeholder="Name suchen …" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
        {admin && panel === "invite" && <Modal title="Person einladen" busy={busy} onClose={() => setPanel(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
          <p>Neue Personen erhalten eine E-Mail. Bestehende Benutzer werden direkt hinzugefügt.</p><form onSubmit={formAction(async (f) => {
          const response = await post("/api/manage", { action: "invite", company: companyId, email: text(f, "email"), name: text(f, "name"), role: text(f, "role") });
          if (!("message" in response) || typeof response.message !== "string") throw new Error("Einladungsbestätigung fehlt.");
          return response.message;
        }, "Benutzer hinzugefügt; neue Benutzer erhalten eine Einladung. Arbeitsmodell und Projektzuweisung bitte ergänzen.")}>
          <div className="form-grid"><label>Name<input name="name" required maxLength={120} /></label><label>E-Mail<input name="email" type="email" required /></label>
            <label>Rolle<select name="role"><option value="employee">Mitarbeitende</option><option value="hr">HR</option><option value="admin">Admin</option></select></label></div><button disabled={busy}>Einladen</button>
        </form></Modal>}
        {!filteredMembers.length && <section className="empty-state card"><h3>Keine Person gefunden.</h3><p>Versuche einen anderen Namen.</p></section>}
        {filteredMembers.map((m) => <section className="card member-card" key={m.user_id}>
          <div className="entity-heading"><span className="avatar">{m.display_name.slice(0, 1)}</span><div><h2>{m.display_name}</h2><p>{roleLabel[m.role]} · {m.vacation_days} Ferientage / Jahr</p></div><span className={`badge ${data.models.some((w) => w.user_id === m.user_id && w.valid_from <= today) ? "" : "warning"}`}>{data.models.some((w) => w.user_id === m.user_id && w.valid_from <= today) ? "Arbeitsmodell hinterlegt" : "Arbeitsmodell fehlt"}</span></div>
          {admin && <details><summary>Profil und Berechtigungen bearbeiten</summary><form onSubmit={formAction(async (f) => {
            const role = text(f, "role");
            if (role !== "admin" && m.role === "admin" && data.members.filter((p) => p.role === "admin").length < 2) throw new Error("Der letzte Firmen-Admin darf nicht entfernt werden.");
            if (role !== "employee" && role !== "hr" && role !== "admin") throw new Error("Ungültige Rolle.");
            checked(await db.from("company_members").update({ display_name: text(f, "name"), role, vacation_days: Number(f.get("vacation")) }).eq("company_id", companyId).eq("user_id", m.user_id).select());
          }, "Mitarbeitenden-Einstellungen gespeichert.")}>
            <div className="form-grid"><label>Name<input name="name" defaultValue={m.display_name} required maxLength={120} /></label>
              <label>Rolle<select name="role" defaultValue={m.role}><option value="employee">Mitarbeitende</option><option value="hr">HR</option><option value="admin">Admin</option></select></label>
              <label>Ferientage pro Jahr<input name="vacation" type="number" min={0} max={100} step={0.5} defaultValue={m.vacation_days} required /></label></div><button disabled={busy} className="secondary">Profil speichern</button>
          </form></details>}
          <details><summary>Arbeitsmodell hinterlegen</summary><p>Gültig ab Datum, bis zum nächsten Modell. Die Tagesverteilung ergibt das Wochen-Soll. Geplante Uhrzeiten starten keine Buchungen, dienen aber als Grundlage aktivierter Fehlbuchungshinweise. Bei Halbtagen teilt das System das geplante Zeitfenster in zwei gleiche Hälften.</p>
            <WorkSchedule key={m.user_id + data.models.filter((w) => w.user_id === m.user_id).map((w) => w.id + w.weekday_minutes.join(",")).join("|")}
              model={data.models.filter((w) => w.user_id === m.user_id && w.valid_from <= today).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]}
              today={today} busy={busy} onSubmit={formAction(async (f) => {
              const weekday_minutes = Array.from({ length: 7 }, (_, i) => Math.round(Number(f.get(`day${i}`)) * 60));
              checked(await db.from("work_models").upsert({ company_id: companyId, user_id: m.user_id, valid_from: text(f, "from"), weekday_minutes, planned_start: text(f, "start") || null, planned_end: text(f, "end") || null }, { onConflict: "company_id,user_id,valid_from" }).select());
            }, "Arbeitsmodell gespeichert.")} />
            {data.models.filter((w) => w.user_id === m.user_id).map((w) => <p key={w.id}>Ab {w.valid_from}: {minutesLabel(w.weekday_minutes.reduce((sum, n) => sum + n, 0))} h / Woche · {w.planned_start ?? "—"} bis {w.planned_end ?? "—"}</p>)}
          </details>
          <details><summary>Fehlende Zeiterfassung: Zuständigkeit und Frist</summary>
            <p className="muted">Die Prüfung berücksichtigt Arbeitstage, Feiertage und Abwesenheiten. Der geplante Beginn muss im gültigen Arbeitsmodell hinterlegt sein; für Halbtage auch das geplante Ende. Zuständige müssen HR/Admin dieser Firma sein.</p>
            <form onSubmit={formAction(async (f) => {
              checked(await db.from("report_settings").upsert({
                company_id: companyId, user_id: m.user_id, responsible_id: text(f,"responsible") || null,
                delay_minutes: text(f,"delay") ? Number(f.get("delay")) : null, enabled: f.get("enabled")==="on",
              }, { onConflict: "company_id,user_id" }).select());
            }, "Hinweisregeln gespeichert.")}>
              <label className="check"><input type="checkbox" name="enabled" defaultChecked={data.reportSettings.find((s)=>s.user_id===m.user_id)?.enabled} /> Fehlende Zeiterfassung prüfen</label>
              <div className="form-grid"><label>Zuständige Person<select name="responsible" defaultValue={data.reportSettings.find((s)=>s.user_id===m.user_id)?.responsible_id ?? ""}><option value="">Bitte wählen</option>{data.members.filter((p)=>p.role!=="employee").map((p)=><option key={p.user_id} value={p.user_id}>{p.display_name}</option>)}</select></label>
              <label>Frist nach Arbeitsbeginn (Minuten)<input type="number" min={1} max={720} name="delay" defaultValue={data.reportSettings.find((s)=>s.user_id===m.user_id)?.delay_minutes ?? ""} /></label></div>
              {data.reportSettings.find((s)=>s.user_id===m.user_id)?.enabled && !data.models.some((w)=>w.user_id===m.user_id && w.valid_from<=today && w.planned_start) && <p className="notice error">Aktiviert, aber kein gültiger geplanter Arbeitsbeginn: Es werden keine Fehlbuchungshinweise erzeugt. Bitte Arbeitsmodell ergänzen.</p>}
              {data.reportSettings.find((s)=>s.user_id===m.user_id)?.enabled && !data.members.some((p)=>p.user_id===data.reportSettings.find((s)=>s.user_id===m.user_id)?.responsible_id && p.role!=="employee") && <p className="notice error">Zuständigkeit nicht mehr gültig. Bitte HR/Admin neu zuweisen.</p>}
              <button className="secondary" disabled={busy}>Hinweisregeln speichern</button>
            </form>
          </details>
        </section>)}
      </>}

      {admin && current === "settings" && <>
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
        <section className="card"><h2>Firmenweite Feiertage / arbeitsfreie Tage</h2><p>Diese Tage unterdrücken Fehlbuchungshinweise. Die Sollzeit im Monatsrapport wird derzeit nicht automatisch verändert.</p>
          <form onSubmit={formAction(async (f) => {
            checked(await db.from("company_holidays").upsert({ company_id:companyId, day:text(f,"day"), label:text(f,"label") }).select());
          }, "Arbeitsfreier Tag gespeichert.")}><div className="form-grid"><label>Datum<input name="day" type="date" required /></label><label>Bezeichnung<input name="label" required maxLength={120} /></label></div><button disabled={busy}>Tag hinzufügen</button></form>
          {data.holidays.map((h)=><p key={h.day}>{h.day} · {h.label} <button className="secondary compact" disabled={busy} onClick={()=>run(async()=>{
            checked(await db.from("company_holidays").delete().eq("company_id",companyId).eq("day",h.day).select());
          },"Arbeitsfreier Tag entfernt.")}>Entfernen</button></p>)}
        </section>
      </>}
      {admin && current === "projects" && <>
        <div className="collection-toolbar"><span>{data.projects.filter((p) => p.active).length} aktive Projekte</span><label>Projekte durchsuchen<input type="search" placeholder="Projekt suchen …" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
        {panel === "project" && <Modal title="Projekt erstellen" busy={busy} onClose={() => setPanel(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
          <form onSubmit={formAction(async (f) => {
          checked(await db.from("projects").insert({ company_id: companyId, name: text(f, "name"), max_work_minutes: text(f, "work") ? Number(f.get("work")) : null, min_break_minutes: text(f, "break") ? Number(f.get("break")) : null }).select());
        }, "Projekt erstellt. Bitte Mitarbeitende zuweisen.")}>
          <label>Projektname<input name="name" required maxLength={120} /></label>
          <div className="form-grid"><label>Max. Arbeit (Minuten, optional)<input type="number" name="work" min={15} max={720} /></label><label>Min. Pause (Minuten, optional)<input type="number" name="break" min={1} max={120} /></label></div>
          <p>Projektregeln können die Firmenregel verschärfen, nicht lockern. Projektwechsel setzt die Arbeitszeit seit der letzten ausreichenden Pause nicht zurück.</p><button disabled={busy}>Projekt erstellen</button>
        </form></Modal>}
        {!filteredProjects.length && <section className="empty-state card"><h3>{search ? "Kein Projekt gefunden." : "Ein Projekt ist der Startpunkt."}</h3><p>{search ? "Versuche einen anderen Suchbegriff." : "Erstelle dein erstes Projekt und weise anschliessend dein Team zu."}</p>{!search && <button onClick={() => openPanel("project")}>Erstes Projekt erstellen</button>}</section>}
        {filteredProjects.map((p) => <section key={p.id} className="card"><div className="entity-heading"><span className="project-avatar">{p.name.slice(0, 1).toUpperCase()}</span><div><h2>{p.name}</h2><p>{data.assignments.filter((a) => a.project_id === p.id).length} Personen zugewiesen · Pause nach {Math.min(company?.max_work_minutes ?? 120, p.max_work_minutes ?? Infinity)} Minuten</p></div><span className="badge">{p.active ? "Aktiv" : "Archiviert"}</span></div>
          <details><summary>Projektdetails bearbeiten</summary>
          <form onSubmit={formAction(async (f) => {
            checked(await db.from("projects").update({ name: text(f, "name"), active: f.get("active") === "on", max_work_minutes: text(f, "work") ? Number(f.get("work")) : null, min_break_minutes: text(f, "break") ? Number(f.get("break")) : null }).eq("id", p.id).eq("company_id", companyId).select());
          }, "Projekt gespeichert.")}>
            <div className="form-grid"><label>Name<input name="name" defaultValue={p.name} required maxLength={120} /></label><label>Max. Arbeit (Minuten)<input name="work" type="number" min={15} max={720} defaultValue={p.max_work_minutes ?? ""} /></label><label>Min. Pause (Minuten)<input name="break" type="number" min={1} max={120} defaultValue={p.min_break_minutes ?? ""} /></label></div>
            <label className="check"><input name="active" type="checkbox" defaultChecked={p.active} /> Aktiv</label><button disabled={busy} className="secondary">Projekt speichern</button>
          </form></details>
          <details><summary>Mitarbeitende zuweisen</summary>
          {data.members.map((m) => {
            const assigned = data.assignments.some((a) => a.project_id === p.id && a.user_id === m.user_id);
            return <label className="check" key={m.user_id}><input type="checkbox" checked={assigned} disabled={busy} onChange={(e) => {
              const enabled = e.target.checked;
              void run(async () => {
                if (enabled) checked(await db.from("project_members").insert({ company_id: companyId, project_id: p.id, user_id: m.user_id }).select());
                else checked(await db.from("project_members").delete().eq("project_id", p.id).eq("user_id", m.user_id).select());
              }, "Projektzuweisung gespeichert.");
            }} />{m.display_name}</label>;
          })}</details>
        </section>)}
      </>}

      {admin && current === "billing" && <section className="card"><h2>Ein Firmenabo für dein Team.</h2>
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

      {data.operator && current === "operator" && <>
        <p className="muted">Du verwaltest Firmen und Abos. Zeitrapporte bleiben für dich ohne Firmenmitgliedschaft gesperrt.</p>
        {panel === "company" && <Modal title="Neue Firma aufnehmen" busy={busy} onClose={() => setPanel(null)}>
          {failed && message && <p role="alert" className="notice error">{message}</p>}
          <form onSubmit={formAction(async (f) => {
            const response = await post("/api/manage", { action: "createCompany", name: text(f, "name"), email: text(f, "email"), adminName: text(f, "adminName") });
            if ("message" in response && typeof response.message === "string") return response.message;
            throw new Error("Bestätigung der Firmenaufnahme fehlt.");
          }, "Firma angelegt und Admin eingeladen.")}>
            <div className="form-grid"><label>Firmenname<input name="name" required maxLength={120} /></label><label>Admin-Name<input name="adminName" required maxLength={120} /></label><label>Admin-E-Mail<input name="email" type="email" required /></label></div>
            <button disabled={busy}>Firma anlegen</button>
          </form>
        </Modal>}
        {!data.companies.length && <section className="operator-welcome card"><span className="eyebrow">Willkommen bei TimeReport</span><h2>Deine erste Firma. Ein klarer Start.</h2><p>Lege eine Firma an und bestimme ihren Admin. Verwende deine eigene E-Mail, wenn du die Pilotfirma selbst einrichten möchtest.</p><button onClick={() => openPanel("company")}>Erste Firma aufnehmen</button><div className="welcome-flow"><span>1 · Firma aufnehmen</span><span>2 · Arbeitsmodell & Projekte</span><span>3 · Einchecken</span></div></section>}
        {data.companies.map((c) => {
          const subscription = data.subscriptions.find((s) => s.company_id === c.id);
          return <section className="card" key={c.id}><h2>{c.name}</h2><p>{subscription?.complimentary ? "Kostenfrei" : subscription?.status ?? "Kein Abostatus"}</p>
            {c.id === companyId && ownMember && <p><button className="secondary" disabled={busy} onClick={() => navigate("time")}>Zum Arbeitsplatz und zur Einrichtung →</button></p>}
            <button disabled={busy} className="secondary" onClick={() => run(async () => {
              await post("/api/manage", { action: "complimentary", company: c.id, enabled: !subscription?.complimentary });
            }, subscription?.complimentary ? "Kostenfreie Freischaltung aufgehoben." : "Kostenfrei freigeschaltet. Bestehende Stripe-Abos werden nicht automatisch gekündigt.")}>{subscription?.complimentary ? "Kostenfreie Freischaltung aufheben" : "Kostenfrei freischalten"}</button>
          </section>;
        })}
      </>}
    </main>
    <footer><span>TimeReport · Dein Team. Deine Zeit.</span><span>Europe/Zurich · Pilotversion</span></footer>
    </div>
  </div>;
}
