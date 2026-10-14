import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const admin = "10000000-0000-4000-8000-000000000001";
const employee = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000003";
const operator = "10000000-0000-4000-8000-000000000004";
const company = "20000000-0000-4000-8000-000000000001";
const otherCompany = "20000000-0000-4000-8000-000000000002";
const project = "30000000-0000-4000-8000-000000000001";
const otherProject = "30000000-0000-4000-8000-000000000002";

test("PostgreSQL migration and tenant/write boundaries", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims', true)::jsonb $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/202610120001_initial.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202610120002_onboarding_alerts.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202610120003_flexible_work_models.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../supabase/migrations/202610140001_departments_and_work_rules.sql", import.meta.url), "utf8"));
    await db.exec(`
      insert into auth.users values ('${admin}'),('${employee}'),('${outsider}'),('${operator}');
      insert into public.companies(id,name,absence_tracking) values ('${company}','Pilot',true),('${otherCompany}','Other',true);
      insert into public.company_members(company_id,user_id,display_name,role) values
        ('${company}','${admin}','Admin','admin'),('${company}','${employee}','Employee','employee'),
        ('${otherCompany}','${outsider}','Outsider','admin');
      insert into public.operators values('${operator}');
      insert into public.projects(id,company_id,name) values ('${project}','${company}','Assigned'),('${otherProject}','${otherCompany}','Private');
      insert into public.project_members values('${company}','${project}','${employee}');
      insert into public.subscriptions(company_id) values('${company}'),('${otherCompany}');
    `);
    async function asUser<T>(id: string, sql: string, params: unknown[] = [], aal = "aal2") {
      await db.exec("begin; set local role authenticated;");
      try {
        await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, aal })]);
        const result = await db.query<T>(sql, params);
        await db.exec("commit");
        return result.rows;
      } catch (e) { await db.exec("rollback"); throw e; }
    }
    await t.test("employee sees only own company and assigned project", async () => {
      const companies = await asUser<{ id: string }>(employee, "select id from companies");
      const projects = await asUser<{ id: string }>(employee, "select id from projects");
      assert.deepEqual(companies.map((c) => c.id), [company]);
      assert.deepEqual(projects.map((p) => p.id), [project]);
    });
    await t.test("aal1 cannot read company data or clock in", async () => {
      assert.equal((await asUser(employee, "select * from companies", [], "aal1")).length, 0);
      await assert.rejects(asUser(employee, "select check_in($1,$2)", [company, project], "aal1"), /2FA/);
    });
    await t.test("unassigned or cross-tenant clock-in is denied", async () => {
      await assert.rejects(asUser(employee, "select check_in($1,$2)", [company, otherProject]), /Projekt/);
      await assert.rejects(asUser(outsider, "select check_in($1,$2)", [company, project]), /Berechtigung/);
    });
    await t.test("direct writes cannot bypass RPC checks", async () => {
      await assert.rejects(asUser(employee, `insert into time_entries(company_id,user_id,project_id,started_at,max_work_minutes,min_break_minutes) values($1,$2,$3,now(),120,15)`, [company, employee, project]), /permission denied/);
      await assert.rejects(asUser(employee, "update subscriptions set complimentary=true where company_id=$1", [company]), /permission denied/);
    });
    await t.test("clock-in uses DB time, cannot be duplicated, and snapshots rules", async () => {
      const result = await asUser<{ check_in: string }>(employee, "select check_in($1,$2)", [company, project]);
      assert.ok(result[0].check_in);
      await assert.rejects(asUser(employee, "select check_in($1,$2)", [company, project]), /überschneiden|duplicate/);
      const rows = await asUser<{ max_work_minutes: number }>(employee, "select max_work_minutes from time_entries");
      assert.equal(rows[0].max_work_minutes, 120);
      await asUser(employee, "select check_out($1)", [company]);
    });
    await t.test("old entries are locked for employees but HR/admin corrections are audited", async () => {
      const id = "40000000-0000-4000-8000-000000000001";
      await db.query(`insert into time_entries(id,company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes)
        values($1,$2,$3,$4,'2020-01-06T08:00:00Z','2020-01-06T09:00:00Z',120,15)`, [id, company, employee, project]);
      const params = [id, project, "2020-01-06T08:00:00Z", "2020-01-06T09:30:00Z", "note", "Correction"];
      await assert.rejects(asUser(employee, "select correct_entry($1,$2,$3,$4,$5,$6)", params), /Korrekturfrist/);
      await asUser(admin, "select correct_entry($1,$2,$3,$4,$5,$6)", params);
      assert.equal((await asUser(admin, "select * from audit_log")).length, 1);
      assert.equal((await asUser(employee, "select * from audit_log")).length, 0);
    });
    await t.test("future corrections fail", async () => {
      const id = "40000000-0000-4000-8000-000000000001";
      await assert.rejects(asUser(admin, "select correct_entry($1,$2,$3,$4,$5,$6)",
        [id, project, "2099-01-01T08:00:00Z", "2099-01-01T09:00:00Z", "", "Future"]), /Zukünftige/);
    });
    await t.test("overlapping corrections are rejected even for admin", async () => {
      const id = "40000000-0000-4000-8000-000000000002";
      await db.query(`insert into time_entries(id,company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes)
        values($1,$2,$3,$4,'2020-01-06T10:00:00Z','2020-01-06T11:00:00Z',120,15)`, [id, company, employee, project]);
      await assert.rejects(asUser(admin, "select correct_entry($1,$2,$3,$4,$5,$6)",
        [id, project, "2020-01-06T09:00:00Z", "2020-01-06T10:30:00Z", "", "Overlap"]), /überschneiden/);
    });
    await t.test("employees cannot move a current entry into a locked week", async () => {
      const current = await asUser<{ id: string }>(employee, "select id from time_entries where started_at > now() - interval '1 day'");
      await assert.rejects(asUser(employee, "select correct_entry($1,$2,$3,$4,$5,$6)",
        [current[0].id, project, "2020-01-07T08:00:00Z", "2020-01-07T09:00:00Z", "", "Move"]), /Korrekturfrist/);
    });
    await t.test("employees cannot read another person's records", async () => {
      await db.query(`insert into time_entries(company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes)
        values($1,$2,$3,'2020-01-06T08:00:00Z','2020-01-06T09:00:00Z',120,15)`, [company, admin, project]);
      assert.equal((await asUser(employee, "select * from time_entries where user_id=$1", [admin])).length, 0);
      assert.equal((await asUser(admin, "select * from time_entries where user_id=$1", [employee])).length, 3);
    });
    await t.test("project names remain readable for historical own bookings after unassignment", async () => {
      await db.query("delete from project_members where user_id=$1 and project_id=$2", [employee, project]);
      assert.equal((await asUser(employee, "select * from projects where id=$1", [project])).length, 1);
      await assert.rejects(asUser(employee, "select check_in($1,$2)", [company, project]), /zugewiesen/);
      await db.query("insert into project_members values($1,$2,$3)", [company, project, employee]);
    });
    await t.test("last admin cannot be demoted through direct API access", async () => {
      await assert.rejects(asUser(admin, "update company_members set role='employee' where company_id=$1 and user_id=$2", [company, admin]), /letzte/);
      assert.equal((await asUser(employee, "update companies set name='Unauthorized' where id=$1 returning id", [company])).length, 0);
    });
    await t.test("approval setting applies to absence requests", async () => {
      await asUser(employee, "select request_absence($1,'vacation','2026-11-02','2026-11-02',1)", [company]);
      assert.equal((await asUser<{ status: string }>(employee, "select status from absences"))[0].status, "pending");
      await asUser(admin, "update companies set absence_approval=false where id=$1", [company]);
      await asUser(employee, "select request_absence($1,'sick','2026-11-03','2026-11-03',1)", [company]);
      assert.equal((await asUser<{ status: string }>(employee, "select status from absences where kind='sick'"))[0].status, "approved");
      await assert.rejects(asUser(employee, "select request_absence($1,'vacation','2026-11-02','2026-11-03',1)", [company]), /bereits/);
    });
    await t.test("historical self-service absence requests cannot bypass correction locks", async () => {
      await assert.rejects(asUser(employee, "select request_absence($1,'sick','2020-01-06','2020-01-06',1)", [company]), /Korrekturfrist/);
    });
    await t.test("only HR/admin may approve or resolve breaks", async () => {
      const requests = await asUser<{ id: string }>(employee, "select id from absences where status='pending'");
      await assert.rejects(asUser(employee, "select review_absence($1,'approved','Approve')", [requests[0].id]), /Berechtigung/);
      await asUser(admin, "select review_absence($1,'approved','Approve')", [requests[0].id]);
      await assert.rejects(asUser(admin, "select review_absence($1,'approved','Again')", [requests[0].id]), /bereits entschieden/);
      await assert.rejects(asUser(employee, "select resolve_break($1,'Checked')", ["40000000-0000-4000-8000-000000000001"]), /Berechtigung/);
    });
    await t.test("manual entries obey ownership, time locks and audit requirements", async () => {
      await assert.rejects(asUser(employee, "select record_entry($1,$2,$3,$4,$5,$6,$7)", [
        company, admin, project, "2020-01-07T08:00:00Z", "2020-01-07T09:00:00Z", "", "Manual",
      ]), /Berechtigung/);
      await assert.rejects(asUser(employee, "select record_entry($1,$2,$3,$4,$5,$6,$7)", [
        company, employee, project, "2020-01-07T08:00:00Z", "2020-01-07T09:00:00Z", "", "Manual",
      ]), /Korrekturfrist/);
      const manual = await asUser<{ record_entry: string }>(admin, "select record_entry($1,$2,$3,$4,$5,$6,$7)", [
        company, employee, project, "2020-01-07T08:00:00Z", "2020-01-07T09:00:00Z", "", "Forgot clock-in",
      ]);
      assert.equal((await asUser(admin, "select * from audit_log where entity_id=$1", [manual[0].record_entry])).length, 1);
      await assert.rejects(asUser(admin, "select record_entry($1,$2,$3,$4,$5,$6,$7)", [
        company, employee, project, "2020-01-07T08:30:00Z", "2020-01-07T09:30:00Z", "", "Overlap",
      ]), /überschneiden/);
    });
    await t.test("break resolution reasons are only visible to the person concerned and managers", async () => {
      const adminsEntry = await asUser<{ id: string }>(admin, "select id from time_entries where user_id=$1", [admin]);
      await asUser(admin, "select resolve_break($1,'Internal review')", [adminsEntry[0].id]);
      assert.equal((await asUser(employee, "select * from break_resolutions where entry_id=$1", [adminsEntry[0].id])).length, 0);
      assert.equal((await asUser(admin, "select * from break_resolutions where entry_id=$1", [adminsEntry[0].id])).length, 1);
    });
    await t.test("checkout lease is stable and cannot be claimed by an employee", async () => {
      const first = await db.query<{ token: string; expires_at: number }>("select * from claim_checkout($1)", [company]);
      const second = await db.query<{ token: string; expires_at: number }>("select * from claim_checkout($1)", [company]);
      assert.deepEqual(first.rows, second.rows);
      await assert.rejects(asUser(employee, "select * from claim_checkout($1)", [company]), /permission denied/);
      await db.query("update subscriptions set complimentary=true where company_id=$1", [company]);
      await assert.rejects(db.query("select * from claim_checkout($1)", [company]), /kostenfrei/);
    });
    await t.test("company provisioning is atomic when membership cannot be created", async () => {
      await assert.rejects(db.query("select provision_company('Failed', $1, 'Missing user')", ["10000000-0000-4000-8000-000000000099"]), /foreign key/);
      assert.equal((await db.query("select * from companies where name='Failed'")).rows.length, 0);
      await assert.rejects(asUser(employee, "select provision_company('Forbidden',$1,'Employee')", [employee]), /permission denied/);
    });
    await t.test("work schedules must contain seven non-null day values", async () => {
      await assert.rejects(asUser(admin, `insert into work_models(company_id,user_id,valid_from,weekday_minutes)
        values($1,$2,'2026-01-01',array[480,480,null,480,480,0,0])`, [company, employee]), /check constraint/);
      await assert.rejects(asUser(admin, "update company_members set user_id=$1 where company_id=$2", [outsider, company]), /permission denied/);
    });
    await t.test("operator sees company metadata but cannot read time records", async () => {
      assert.equal((await asUser(operator, "select * from companies")).length, 2);
      assert.equal((await asUser(operator, "select * from subscriptions")).length, 2);
      assert.equal((await asUser(operator, "select * from time_entries")).length, 0);
      assert.equal((await asUser(operator, "select * from company_members")).length, 0);
    });
    await t.test("departments and cascading work rules cascade company -> department -> member", async () => {
      // 1. Create department as admin
      const dept = (await asUser<{ id: string }>(admin,
        "insert into departments(company_id, name) values($1, 'Produktion Reinraum') returning id",
        [company]
      ))[0].id;
      // Employee can see department but cannot insert
      assert.equal((await asUser(employee, "select * from departments where id=$1", [dept])).length, 1);
      await assert.rejects(asUser(employee, "insert into departments(company_id, name) values($1, 'Hacker')", [company]), /row-level security policy/);

      // Assign employee to department
      await asUser(admin, "update company_members set department_id=$1 where company_id=$2 and user_id=$3", [dept, company, employee]);

      // 2. Define rules:
      // Company-level default rule (e.g. 540 min max, 30 min break)
      await asUser(admin,
        `insert into work_rules(company_id, name, scope, max_work_minutes, min_break_minutes, allow_overrun)
         values($1, 'Standard Firma', 'company', 540, 30, true)`,
        [company]
      );

      // Department-level rule (e.g. 480 min max, 45 min break)
      await asUser(admin,
        `insert into work_rules(company_id, name, scope, department_id, max_work_minutes, min_break_minutes, allow_overrun)
         values($1, 'Produktion Standard', 'department', $2, 480, 45, true)`,
        [company, dept]
      );

      // Activity-specific rule: Schutzanzug (e.g. max 120 min, 15 min break)
      await asUser(admin,
        `insert into work_rules(company_id, name, scope, activity_tag, max_work_minutes, min_break_minutes, allow_overrun, overrun_note_required)
         values($1, 'Schutzanzug Einsatz', 'company', 'schutzanzug', 120, 15, true, true)`,
        [company]
      );

      // Member exception rule: Employee has special exemption for Schutzanzug (e.g. 150 min, allow_overrun = true)
      const memberRule = (await asUser<{ id: string }>(admin,
        `insert into work_rules(company_id, name, scope, user_id, activity_tag, max_work_minutes, min_break_minutes, allow_overrun)
         values($1, 'Ausnahme Max Muster Schutzanzug', 'member', $2, 'schutzanzug', 150, 20, true) returning id`,
        [company, employee]
      ))[0].id;

      // Test resolve_work_rule for generic work (Department rule 480 mins wins over company 540 mins)
      const genericResolved = await asUser<{ max_work_minutes: number; matched_scope: string }>(
        employee,
        "select max_work_minutes, matched_scope from resolve_work_rule($1, $2, null)",
        [company, employee]
      );
      assert.equal(genericResolved[0].max_work_minutes, 480);
      assert.equal(genericResolved[0].matched_scope, "department");

      // Test resolve_work_rule with activity 'schutzanzug' (Member exception 150 mins wins over company activity rule 120 mins)
      const suitResolved = await asUser<{ rule_id: string; max_work_minutes: number; matched_scope: string }>(
        employee,
        "select rule_id, max_work_minutes, matched_scope from resolve_work_rule($1, $2, 'schutzanzug')",
        [company, employee]
      );
      assert.equal(suitResolved[0].rule_id, memberRule);
      assert.equal(suitResolved[0].max_work_minutes, 150);
      assert.equal(suitResolved[0].matched_scope, "member");

      // Check-in with activity tag snapshots the resolved rule limit
      const entryId = (await asUser<{ check_in: string }>(
        employee,
        "select check_in($1, $2, 'schutzanzug')",
        [company, project]
      ))[0].check_in;

      const checkedInEntry = (await asUser<{ max_work_minutes: number; activity_tag: string }>(
        employee,
        "select max_work_minutes, activity_tag from time_entries where id=$1",
        [entryId]
      ))[0];
      assert.equal(checkedInEntry.max_work_minutes, 150);
      assert.equal(checkedInEntry.activity_tag, "schutzanzug");

      // Check-out with overrun note
      await asUser(employee, "select check_out($1, 'Wartungszyklus durfte nicht unterbrochen werden')", [company]);
      const checkedOutEntry = (await asUser<{ overrun_reason: string }>(
        employee,
        "select overrun_reason from time_entries where id=$1",
        [entryId]
      ))[0];
      assert.equal(checkedOutEntry.overrun_reason, "Wartungszyklus durfte nicht unterbrochen werden");
    });
  } finally { await db.close(); }
});
