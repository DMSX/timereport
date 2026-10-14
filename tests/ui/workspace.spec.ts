import { test, expect, type Page } from "@playwright/test";
import type { ReportAlert, EmailJob, WorkModel, Project } from "../../src/lib/types";

// Network-isolated fixtures: these tests must never read or mutate cloud data.
async function workspace(page: Page, role: "admin" | "employee" | "operator" = "admin", ready = false, firstRun = false, withAlert = false, hourly = false, minimal = false) {
  const claims = { sub: "test-user", aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: "password", timestamp: 1 }, { method: "totp", timestamp: 2 }] };
  const token = `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.test`;
  await page.context().addCookies([{
    name: "sb-ui-fixture-auth-token", url: "http://localhost:3190",
    value: "base64-" + Buffer.from(JSON.stringify({
      access_token: token, refresh_token: "test-refresh", token_type: "bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600,
      user: { id: "test-user", email: "test@example.invalid", factors: [{ id: "f", factor_type: "totp", status: "verified" }] },
    })).toString("base64url"),
  }]);
  let company = { id: "company", name: "Studio Beispiel", correction_weeks: 1, absence_approval: true, max_work_minutes: 120, min_break_minutes: 15, absence_tracking: !minimal, report_alerts_enabled: !minimal };
  const member = { company_id: "company", user_id: "test-user", display_name: "Alex Beispiel", role, vacation_days: 25 };
  const project = { id: "project", company_id: "company", name: "Website Relaunch", active: true, max_work_minutes: null, min_break_minutes: null };
  let projects: Project[] = ready ? [project] : [];
  let assignments = ready ? [{project_id:"project",user_id:"test-user",company_id:"company"}] : [];
  let models: WorkModel[] = ready ? [{ id:"model",company_id:"company",user_id:"test-user",valid_from:"2020-01-01",mode:hourly ? "hourly" : "scheduled",
    weekday_minutes:hourly ? [0,0,0,0,0,0,0] : [480,480,480,480,480,0,0],planned_start:null,planned_end:null }] : [];
  let running: object[] = [];
  let progress = firstRun ? [] : [{ user_id: "test-user", scope: role === "operator" ? "operator" : "company", step: 0, completed: true }];
  let absences: object[] = [];
  let alerts: ReportAlert[] = withAlert ? [{
    id: "alert", company_id: "company", user_id: "test-user", responsible_id: "test-user",
    work_day: "2020-01-02", due_at: "2020-01-02T09:00:00Z", kind: "missing", status: "open",
    resolution: null, resolved_by: null, reminded_at: null,
    created_at: "2020-01-02T09:00:00Z", updated_at: "2020-01-02T09:00:00Z",
  }] : [];
  let jobs: EmailJob[] = withAlert ? [{
    id: "job", alert_id: "alert", company_id: "company", recipient_id: "test-user", purpose: "responsible",
    kind: "missing", status: "failed", attempts: 5, next_attempt_at: "2020-01-02T09:00:00Z",
    lease_token: null, lease_until: null, last_error: "SMTP-Konfiguration prüfen.", sent_at: null,
  }] : [];
  await page.route("https://ui-fixture.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split("/").at(-1);
    if (resource === "companies" && route.request().method() === "PATCH") {
      company = {...company,...route.request().postDataJSON()};
      await route.fulfill({json:company}); return;
    }
    if (resource === "work_models" && route.request().method() === "POST") {
      models = [{id:"model",...route.request().postDataJSON()}];
      await route.fulfill({json:models}); return;
    }
    if (resource === "projects" && route.request().method() === "POST") {
      projects = [{id:"project",active:true,...route.request().postDataJSON()}];
      await route.fulfill({json:projects}); return;
    }
    if (resource === "project_members" && route.request().method() === "POST") {
      assignments = [route.request().postDataJSON()];
      await route.fulfill({json:assignments}); return;
    }
    if (resource === "onboarding_progress" && route.request().method() === "POST") {
      progress = [route.request().postDataJSON()];
      await route.fulfill({ json: progress }); return;
    }
    if (resource === "retry_report_email") {
      jobs = jobs.map((job) => ({ ...job, status: "pending", attempts: 0, last_error: null }));
      await route.fulfill({ json: null }); return;
    }
    if (resource === "handle_report_alert") {
      const input = route.request().postDataJSON();
      if (input.p_action === "remind") {
        alerts = alerts.map((alert) => ({ ...alert, reminded_at: new Date().toISOString() }));
      } else {
        alerts = alerts.map((alert) => ({ ...alert, status: "clarified", resolution: input.p_reason }));
      }
      await route.fulfill({ json: null }); return;
    }
    if (url.pathname.includes("/rpc/request_absence")) {
      const input = route.request().postDataJSON();
      absences = [{ id: "absence", company_id: "company", user_id: "test-user", kind: input.p_kind,
        starts_on: input.p_start, ends_on: input.p_end, fraction: input.p_fraction, day_part: input.p_part, status: "pending" }];
      await route.fulfill({ json: "absence" }); return;
    }
    if (url.pathname.includes("/auth/")) {
      await route.fulfill({ json: { id: "test-user", email: "test@example.invalid", factors: [{ id: "f", factor_type: "totp", status: "verified" }] } }); return;
    }
    if (url.pathname.includes("/rpc/check_in")) {
      running = [{ id: "entry", company_id: "company", user_id: "test-user", project_id: "project", started_at: new Date().toISOString(), ended_at: null, note: "", max_work_minutes: 120, min_break_minutes: 15 }];
      await route.fulfill({ json: "entry" }); return;
    }
    if (url.pathname.includes("/rpc/check_out")) {
      running = []; await route.fulfill({ json: null }); return;
    }
    const rows: Record<string, object[]> = {
      companies: role === "operator" ? [] : [company],
      company_members: role === "operator" ? [] : [member],
      operators: role === "operator" ? [{ user_id: "test-user" }] : [],
      subscriptions: [{ company_id: "company", status: "pilot", complimentary: true }],
      projects, project_members:assignments, work_models:models,
      time_entries: running, absences, break_resolutions: [],
      report_settings: [], report_alerts: alerts, email_outbox: jobs, company_holidays: [],
      onboarding_progress: progress, scheduler_status: [{ id: 1, last_checked_at: null }],
    };
    const values = rows[resource ?? ""] ?? [];
    const singular = route.request().headers()["accept"]?.includes("vnd.pgrst.object");
    await route.fulfill({ json: singular ? values[0] ?? null : values });
  });
  await page.goto("/");
}

test("admin onboarding leads to separate team and project areas", async ({ page }) => {
  await workspace(page);
  await expect(page.getByRole("heading", { name: "In drei Schritten startklar." })).toBeVisible();
  await page.getByRole("button", { name: /Arbeitszeiten festlegen/ }).click();
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  await page.getByText("Arbeitsmodell hinterlegen", { exact: true }).click();
  await page.getByRole("combobox",{name:"Zeiterfassungsmodell",exact:true}).selectOption("scheduled");
  await expect(page.getByText("40:00", { exact: false })).toBeVisible();
  await page.getByLabel("Montag", { exact: true }).fill("6");
  await expect(page.getByText("38:00", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "+ Person einladen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Projekte", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ein Projekt ist der Startpunkt." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Projekte", exact: true })).toBeVisible();
});

test("employee can check in and out without admin clutter", async ({ page }) => {
  await workspace(page, "employee", true);
  await expect(page.getByRole("heading", { name: "Mein Arbeitstag", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Firmenregeln" })).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("workday-desktop.png"), fullPage: true });
  await page.getByRole("combobox", { name: "Projekt", exact: true }).selectOption("project");
  await page.getByRole("button", { name: "Einchecken", exact: true }).click();
  await expect(page.getByText("Zeiterfassung läuft", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Auschecken / Pause starten" }).click();
  await expect(page.getByText("Aktuell ausgecheckt", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Zeitbuchungen", exact: true }).click();
  await page.getByRole("button", { name: "+ Zeit nachtragen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Erfassungsgrund", { exact: true })).toBeVisible();
});

test("history and report reject out-of-range months without crashing", async ({ page }) => {
  await workspace(page, "employee", true);
  await page.getByRole("link", { name: "Zeitbuchungen", exact: true }).click();
  const month = page.getByLabel("Monat", { exact: true });
  await month.fill("2026-10");
  for (const invalid of ["1999-12", "2101-01"]) {
    await month.fill(invalid);
    await expect(month).toHaveValue("2026-10");
    await expect(page.getByRole("heading", { name: "Zeitbuchungen", exact: true })).toBeVisible();
  }
  await month.fill("2000-01");
  await expect(month).toHaveValue("2000-01");
  await page.getByRole("link", { name: "Monatsrapport", exact: true }).click();
  await expect(page.getByRole("button", { name: "Vorheriger Monat" })).toBeDisabled();
  await month.fill("2100-12");
  await expect(page.getByRole("button", { name: "Nächster Monat" })).toBeDisabled();
  await month.fill("2101-01");
  await expect(month).toHaveValue("2100-12");
});

test("correction dialog cannot be dismissed while saving", async ({ page }) => {
  await workspace(page, "admin", true);
  await page.route("https://ui-fixture.supabase.co/rest/v1/time_entries?**", (route) => route.fulfill({ json: [{
    id: "correction", company_id: "company", user_id: "test-user", project_id: "project",
    started_at: "2026-10-05T08:00:00+02:00", ended_at: "2026-10-05T09:00:00+02:00",
    note: "", max_work_minutes: 120, min_break_minutes: 15,
  }] }));
  await page.reload();
  await page.getByRole("link", { name: "Zeitbuchungen", exact: true }).click();
  await page.getByLabel("Monat", { exact: true }).fill("2026-10");
  await page.getByRole("button", { name: "Korrigieren", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Arbeitsblock korrigieren" });
  const { promise: pending, resolve: complete } = Promise.withResolvers<void>();
  await page.route("https://ui-fixture.supabase.co/rest/v1/rpc/correct_entry", async (route) => {
    await pending;
    await route.fulfill({ json: null });
  });
  await dialog.getByLabel("Korrekturgrund", { exact: true }).fill("Buchung geprüft und korrigiert.");
  await dialog.getByRole("button", { name: "Korrektur speichern", exact: true }).click();
  try {
    await expect(dialog.getByRole("button", { name: "Abbrechen", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Dialog schliessen" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally { complete(); }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Korrektur gespeichert.");
});

test("operator without company gets a guided first step", async ({ page }) => {
  await workspace(page, "operator");
  await expect(page.getByRole("heading", { name: "Deine erste Firma. Ein klarer Start." })).toBeVisible();
  await page.getByRole("button", { name: "Erste Firma aufnehmen" }).click();
  await expect(page.getByRole("dialog", { name: "Neue Firma aufnehmen" })).toBeVisible();
  await expect(page.getByLabel("Admin-E-Mail", { exact: true })).toBeVisible();
});

test("mobile workspace fits viewport and keeps navigation usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page, "employee", true);
  await expect(page.getByRole("button", { name: "Einchecken", exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("workday-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Monatsrapport", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Monatsrapport", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("login presents a clear first step", async ({ page }) => {
  await page.route("https://ui-fixture.supabase.co/**", (route) => route.abort());
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Willkommen zurück." })).toBeVisible();
  await expect(page.getByLabel("E-Mail", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeVisible();
});

test("failed invitations keep input and show the error inside the dialog", async ({ page }) => {
  await workspace(page);
  await page.route("**/api/manage", (route) => route.fulfill({ status: 400, json: { error: "Test: Einladung nicht versendet." } }));
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "+ Person einladen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill("Neue Person");
  await dialog.getByLabel("E-Mail", { exact: true }).fill("person@example.invalid");
  await dialog.getByRole("button", { name: "Einladen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Test: Einladung nicht versendet.");
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Neue Person");
  await dialog.getByRole("button", { name: "Dialog schliessen" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Test: Einladung nicht versendet.");
});

test("first-run wizard resumes saved progress and blocks missing prerequisites", async ({ page }) => {
  await workspace(page, "admin", false, true);
  const wizard = page.getByRole("dialog", { name: "Deinen Arbeitsplatz einrichten" });
  await expect(wizard.getByRole("heading", { name: "Willkommen in deinem Arbeitsplatz" })).toBeVisible();
  await wizard.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(wizard.getByRole("heading", { name: "Deine Funktionen auswählen" })).toBeVisible();
  await page.reload();
  await expect(wizard.getByRole("heading", { name: "Deine Funktionen auswählen" })).toBeVisible();
  await wizard.getByRole("checkbox",{name:"Abwesenheiten erfassen",exact:true}).uncheck();
  await wizard.getByRole("checkbox",{name:"Hinweise bei fehlender Zeiterfassung verwenden"}).uncheck();
  await wizard.getByRole("button",{name:"Funktionen und Regeln speichern"}).click();
  await wizard.getByRole("button", { name: "Verstanden / Weiter" }).click();
  await expect(wizard.getByRole("button", { name: "Voraussetzung noch offen" })).toBeDisabled();
  await expect(wizard.getByRole("combobox",{name:"Zeiterfassungsmodell",exact:true})).toHaveValue("hourly");
  await expect(wizard.getByLabel("Montag",{exact:true})).toHaveCount(0);
  await wizard.getByRole("button",{name:"Arbeitsmodell speichern"}).click();
  await wizard.getByRole("button",{name:"Weiter",exact:true}).click();
  await expect(wizard.getByRole("heading",{name:"Projekte und Personen verbinden"})).toBeVisible();
  await wizard.getByLabel("Projektname",{exact:true}).fill("Eigene Arbeit");
  await wizard.getByRole("button",{name:"Projekt erstellen",exact:true}).click();
  await wizard.getByRole("checkbox",{name:"Alex Beispiel",exact:true}).click();
  await expect(wizard.getByRole("checkbox",{name:"Alex Beispiel",exact:true})).toBeChecked();
  await wizard.getByRole("button",{name:"Weiter",exact:true}).click();
  await wizard.getByRole("button",{name:"Verstanden / Weiter",exact:true}).click();
  await wizard.getByRole("button",{name:"Einrichtung abschliessen"}).click();
  await expect(wizard).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Stundenbasis",exact:true})).toBeVisible();
  await expect(page.getByRole("link",{name:"Abwesenheiten",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Hinweise",exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("hourly users see only actual hours without target progress or monthly balance",async({page})=>{
  await workspace(page,"employee",true,false,false,true,true);
  await expect(page.getByRole("heading",{name:"Stundenbasis",exact:true})).toBeVisible();
  await expect(page.getByRole("progressbar",{name:"Erfülltes Tagessoll"})).toHaveCount(0);
  await page.getByRole("combobox",{name:"Projekt",exact:true}).selectOption("project");
  await page.getByRole("button",{name:"Einchecken",exact:true}).click();
  await expect(page.getByText("Zeiterfassung läuft",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Monatsrapport",exact:true}).click();
  await expect(page.getByRole("columnheader",{name:"Soll",exact:true})).toHaveCount(0);
  await expect(page.getByRole("columnheader",{name:"Saldo",exact:true})).toHaveCount(0);
  await expect(page.getByRole("columnheader",{name:"Ferien (Tage)",exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"PDF herunterladen"})).toBeVisible();
});

test("setup modal fits mobile and can be dismissed and resumed",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await workspace(page,"admin",false,true);
  const dialog=page.getByRole("dialog",{name:"Deinen Arbeitsplatz einrichten"});
  await expect(dialog).toBeVisible();
  const bounds=await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  await dialog.getByRole("button",{name:"Weiter",exact:true}).click();
  await expect(dialog.getByRole("textbox",{name:"Firmenname",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button",{name:"Einrichtung fortsetzen",exact:true}).click();
  await expect(dialog.getByRole("heading",{name:"Deine Funktionen auswählen",exact:true})).toBeVisible();
});

test("half-day requests carry their time window and appear in the absence list", async({page})=>{
  await workspace(page,"employee",true);
  await page.getByRole("link",{name:"Abwesenheiten",exact:true}).click();
  await page.getByRole("button",{name:"+ Abwesenheit erfassen"}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("combobox",{name:"Umfang",exact:true}).selectOption("0.5");
  await dialog.getByRole("combobox",{name:"Tageshälfte (nur bei halbem Tag)",exact:true}).selectOption("afternoon");
  await dialog.getByLabel("Von",{exact:true}).fill("2026-12-01");
  await dialog.getByLabel("Bis",{exact:true}).fill("2026-12-01");
  await dialog.getByRole("button",{name:"Abwesenheit eintragen"}).click();
  await expect(page.getByRole("cell",{name:"Nachmittag",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Hinweise",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Keine Hinweise vorhanden."})).toBeVisible();
});

test("scheduler rejects missing and incorrect secrets before database access", async ({request})=>{
  for (const authorization of ["", "Bearer incorrect-scheduler-secret"]) {
    const response = await request.post("/api/jobs/report-alerts", {headers:{authorization}});
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toBe("Scheduler nicht autorisiert.");
  }
});

test("managers can retry failed delivery, remind once and clarify with a reason", async ({page})=>{
  await workspace(page,"admin",true,false,true);
  await page.getByRole("link",{name:"Hinweise",exact:true}).click();
  await expect(page.getByText(/Versand fehlgeschlagen/)).toBeVisible();
  await page.getByRole("button",{name:"Versand erneut beauftragen"}).click();
  await expect(page.getByText(/Hinweis an Zuständige: Versand ausstehend/)).toBeVisible();
  await page.getByRole("button",{name:"Person in App und per E-Mail erinnern"}).click();
  await expect(page.getByRole("button",{name:"Erinnerung bereits beauftragt"})).toBeDisabled();
  await page.getByRole("textbox",{name:"Klärungsgrund",exact:true}).fill("Nachtrag mit Person vereinbart.");
  await page.getByRole("button",{name:"Hinweis klären",exact:true}).click();
  await expect(page.getByText("Mit Begründung geklärt",{exact:true})).toBeVisible();
  await expect(page.getByText("Nachtrag mit Person vereinbart.",{exact:true})).toBeVisible();
});

test("monthly report provides day details, project allocation and month navigation",async({page})=>{
  await workspace(page,"employee",true,false,false,true,true);
  await page.route("https://ui-fixture.supabase.co/rest/v1/time_entries?**",route=>route.fulfill({json:[
    {id:"report-block",company_id:"company",user_id:"test-user",project_id:"project",
      started_at:"2026-10-05T23:30:00+02:00",ended_at:"2026-10-06T01:00:00+02:00",
      note:"Besprechung und Umsetzung",max_work_minutes:120,min_break_minutes:15},
  ]}));
  await page.reload();
  await page.getByRole("link",{name:"Monatsrapport",exact:true}).click();
  await page.getByLabel("Monat",{exact:true}).fill("2026-10");
  const report=page.locator(".report-workspace");
  await expect(report.getByRole("heading",{name:"Oktober 2026",exact:true})).toBeVisible();
  await expect(report.locator(".report-primary-metric")).toContainText("1:30");
  await report.getByRole("checkbox",{name:"Nur Tage mit Erfassung oder Abwesenheit"}).check();
  await expect(report.getByText("2 von 31 Tagen",{exact:true})).toBeVisible();
  const day=report.getByRole("button",{name:/06.*Okt/});
  await day.click();
  await expect(day).toHaveAttribute("aria-expanded","true");
  await expect(report.getByText("1:00 h an diesem Tag",{exact:true})).toBeVisible();
  await expect(report.getByText("Besprechung und Umsetzung",{exact:true})).toBeVisible();
  await report.getByRole("button",{name:"Nach Projekten",exact:true}).click();
  await expect(report.locator(".report-project-row")).toContainText("Website Relaunch");
  await expect(report.locator(".report-project-value")).toContainText("1:30 h");
  await expect(report.getByRole("link",{name:"CSV herunterladen"})).toHaveAttribute("href",/month=2026-10/);
  await report.getByRole("button",{name:"Nächster Monat"}).click();
  await expect(report.getByRole("heading",{name:"November 2026",exact:true})).toBeVisible();
  await expect(report.getByRole("heading",{name:"Noch keine Projektstunden in diesem Monat."})).toBeVisible();
  await expect(report.getByRole("link",{name:"PDF herunterladen"})).toHaveAttribute("href",/month=2026-11/);
  await report.getByRole("button",{name:"Vorheriger Monat"}).click();
  await report.getByRole("button",{name:"Tagesübersicht",exact:true}).click();
  await expect(report.getByText("2 von 31 Tagen",{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(report.getByRole("link",{name:"PDF herunterladen"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath("monthly-report-mobile.png"),fullPage:true});
});

test("scheduled report retains whole-month targets and shows pending absence without credit",async({page})=>{
  await workspace(page,"employee",true);
  await page.route("https://ui-fixture.supabase.co/rest/v1/absences?**",route=>route.fulfill({json:[
    {id:"pending",company_id:"company",user_id:"test-user",kind:"vacation",starts_on:"2026-10-05",ends_on:"2026-10-05",fraction:1,status:"pending"},
  ]}));
  await page.reload();
  await page.getByRole("link",{name:"Monatsrapport",exact:true}).click();
  const report=page.locator(".report-workspace");
  await report.getByLabel("Monat",{exact:true}).fill("2026-10");
  await expect(report.getByRole("columnheader",{name:"Soll",exact:true})).toBeVisible();
  await expect(report.getByRole("columnheader",{name:"Saldo",exact:true})).toBeVisible();
  await report.getByRole("checkbox",{name:"Nur Tage mit Erfassung oder Abwesenheit"}).check();
  await expect(report.getByText("1 von 31 Tagen",{exact:true})).toBeVisible();
  await expect(report.getByText("Freigabe offen",{exact:true})).toBeVisible();
  await expect(report.locator(".report-metrics")).toContainText("176:00");
  await expect(report.locator(".report-metrics")).toContainText("-176:00");
  await page.screenshot({path:test.info().outputPath("monthly-report-desktop.png"),fullPage:true});
});
