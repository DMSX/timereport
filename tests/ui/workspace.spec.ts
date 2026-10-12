import { test, expect, type Page } from "@playwright/test";

// Network-isolated fixtures: these tests must never read or mutate cloud data.
async function workspace(page: Page, role: "admin" | "employee" | "operator" = "admin", ready = false) {
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
  const company = { id: "company", name: "Studio Beispiel", correction_weeks: 1, absence_approval: true, max_work_minutes: 120, min_break_minutes: 15 };
  const member = { company_id: "company", user_id: "test-user", display_name: "Alex Beispiel", role, vacation_days: 25 };
  const project = { id: "project", company_id: "company", name: "Website Relaunch", active: true, max_work_minutes: null, min_break_minutes: null };
  let running: object[] = [];
  await page.route("https://ui-fixture.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const resource = url.pathname.split("/").at(-1);
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
      projects: ready ? [project] : [],
      project_members: ready ? [{ project_id: "project", user_id: "test-user", company_id: "company" }] : [],
      work_models: ready ? [{ id: "model", company_id: "company", user_id: "test-user", valid_from: "2020-01-01", weekday_minutes: [480, 480, 480, 480, 480, 0, 0], planned_start: null, planned_end: null }] : [],
      time_entries: running, absences: [], break_resolutions: [],
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
