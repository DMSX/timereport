import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { notificationText } from "../src/lib/report-notifications";

const admin = "10000000-0000-4000-8000-000000000001";
const employee = "10000000-0000-4000-8000-000000000002";
const outsider = "10000000-0000-4000-8000-000000000003";
const company = "20000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000002";
const project = "30000000-0000-4000-8000-000000000001";

test("alert detection, access, half-days, queue and onboarding persistence", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims',true)::jsonb->>'sub')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;
    `);
    for (const file of ["202610120001_initial.sql", "202610120002_onboarding_alerts.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`
      insert into auth.users values('${admin}'),('${employee}'),('${outsider}');
      insert into companies(id,name) values('${company}','Test'),('${other}','Other');
      insert into company_members(company_id,user_id,display_name,role) values
        ('${company}','${admin}','Admin','admin'),('${company}','${employee}','Employee','employee'),
        ('${other}','${outsider}','Other','admin');
      insert into projects(id,company_id,name) values('${project}','${company}','Project');
      insert into project_members values('${company}','${project}','${employee}');
      insert into work_models(company_id,user_id,valid_from,weekday_minutes,planned_start,planned_end)
        values('${company}','${employee}','2020-01-01',array[480,480,480,480,480,480,480],'08:00','17:00');
      insert into report_settings(company_id,user_id,responsible_id,delay_minutes,enabled)
        values('${company}','${employee}','${admin}',120,true);
    `);
    async function asUser<T>(id: string, sql: string, params: unknown[] = [], aal = "aal2") {
      await db.exec("begin; set local role authenticated");
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: id, aal })]);
        const result = await db.query<T>(sql, params); await db.exec("commit"); return result.rows;
      } catch (e) { await db.exec("rollback"); throw e; }
    }
    const condition = async (day = "2026-10-12") => (await db.query<{ kind: string; due_at: string }>(
      "select * from report_condition($1,$2,$3)", [company, employee, day])).rows;
    await t.test("configured delay uses Zurich local start and DST", async () => {
      const row = (await condition())[0];
      assert.equal(row.kind, "missing");
      assert.equal(new Date(row.due_at).toISOString(), "2026-10-12T08:00:00.000Z");
      assert.equal(new Date((await condition("2026-11-02"))[0].due_at).toISOString(), "2026-11-02T09:00:00.000Z");
    });
    await t.test("settings cannot leak across companies or assign employees as HR", async () => {
      await assert.rejects(asUser(admin, "update report_settings set responsible_id=$1", [employee]), /HR\/Admin/);
      await assert.rejects(asUser(admin, "update report_settings set responsible_id=$1", [outsider]), /HR\/Admin/);
      assert.equal((await asUser(outsider, "select * from report_settings")).length, 0);
      await assert.rejects(asUser(employee, "select refresh_report_alerts()"), /permission denied/);
    });
    await t.test("no schedule, disabled checks, holidays and free days suppress false hints", async () => {
      await db.exec("update report_settings set enabled=false");
      assert.equal((await condition()).length, 0);
      await db.exec("update report_settings set enabled=true; update work_models set planned_start=null");
      assert.equal((await condition()).length, 0);
      await db.exec("update work_models set planned_start='08:00',weekday_minutes=array[0,480,480,480,480,0,0]");
      assert.equal((await condition()).length, 0);
      await db.exec("update work_models set weekday_minutes=array[480,480,480,480,480,480,480]");
      await db.query("insert into company_holidays values($1,'2026-10-12','Test')", [company]);
      assert.equal((await condition()).length, 0);
      await db.exec("delete from company_holidays");
    });
    await t.test("pending, full, morning and legacy half-day absences are distinguished", async () => {
      await db.query("insert into absences(company_id,user_id,kind,starts_on,ends_on,fraction,status) values($1,$2,'vacation','2026-10-12','2026-10-12',1,'pending')", [company, employee]);
      assert.equal((await condition())[0].kind, "pending_absence");
      await db.exec("update absences set status='approved'");
      assert.equal((await condition()).length, 0);
      await db.exec("update absences set fraction=0.5,day_part='morning'");
      assert.equal(new Date((await condition())[0].due_at).toISOString(), "2026-10-12T12:30:00.000Z");
      await db.exec("update absences set day_part='afternoon'");
      assert.equal(new Date((await condition())[0].due_at).toISOString(), "2026-10-12T08:00:00.000Z");
      await db.exec("update absences set day_part=null");
      assert.equal((await condition())[0].kind, "unclear_half_day");
      await db.exec("update absences set day_part='morning';update work_models set planned_end=null");
      assert.equal((await condition())[0].kind, "unclear_half_day");
      await db.exec("delete from absences;update work_models set planned_end='17:00'");
    });
    await t.test("new half-days require explicit part while historical entries remain valid", async () => {
      await assert.rejects(asUser(admin, "select request_absence($1,'sick','2026-12-01','2026-12-01',0.5)", [company]), /Vormittag/);
      await asUser(admin, "select request_absence($1,'sick','2026-12-01','2026-12-01',0.5,'afternoon')", [company]);
      const half = (await db.query<{id:string}>("select id from absences where starts_on='2026-12-01'")).rows[0];
      await assert.rejects(asUser(employee,"select set_absence_part($1,'morning','Fix part')",[half.id]),/Berechtigung/);
      await asUser(admin,"select set_absence_part($1,'morning','Fix part')",[half.id]);
      assert.equal((await db.query<{day_part:string}>("select day_part from absences where id=$1",[half.id])).rows[0].day_part,"morning");
    });
    await t.test("running and midnight-overlapping entries count as reporting", async () => {
      await db.query(`insert into time_entries(company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes)
        values($1,$2,$3,'2020-01-01T22:30:00Z','2020-01-02T01:00:00Z',120,15)`, [company,employee,project]);
      assert.equal((await condition("2020-01-02")).length, 0);
      await db.exec("delete from time_entries");
    });
    await t.test("scheduler deduplicates, queues once and reveals reminders only when manually sent", async () => {
      // A previous-day open candidate lets this test run at any time of day.
      await db.query(`insert into report_alerts(company_id,user_id,responsible_id,work_day,due_at,kind)
        values($1,$2,$3,(now() at time zone 'Europe/Zurich')::date-1,now()-interval '1 day','missing')`, [company,employee,admin]);
      await db.exec("select refresh_report_alerts(); select refresh_report_alerts()");
      const alerts = (await db.query<{ id: string }>("select id from report_alerts order by work_day")).rows;
      const id = alerts[0].id;
      const count = (await db.query("select * from email_outbox")).rows.length;
      assert.equal(count, alerts.length);
      assert.equal((await asUser(employee, "select * from report_alerts")).length, 0);
      assert.equal((await asUser(outsider, "select * from report_alerts")).length, 0);
      await assert.rejects(asUser(employee, "select handle_report_alert($1,'remind')", [id]), /Berechtigung/);
      await asUser(admin, "select handle_report_alert($1,'remind')", [id]);
      assert.equal((await asUser(employee, "select * from report_alerts")).length, 1);
      await assert.rejects(asUser(admin, "select handle_report_alert($1,'remind')", [id]), /bereits/);
      assert.equal((await db.query("select * from email_outbox")).rows.length, count+1);
      const claimed = (await db.query<{id:string}>("select * from claim_report_emails()")).rows;
      assert.ok(claimed.length > 0);
      assert.equal((await db.query("select * from claim_report_emails()")).rows.length, 0);
      const claimedId = claimed[0].id;
      await db.query("update email_outbox set status='failed',attempts=5 where id=$1",[claimedId]);
      await assert.rejects(asUser(employee,"select retry_report_email($1)",[claimedId]),/Berechtigung/);
      await asUser(admin,"select retry_report_email($1)",[claimedId]);
      assert.equal((await db.query<{attempts:number}>("select attempts from email_outbox where id=$1",[claimedId])).rows[0].attempts,0);
      await asUser(admin, "select handle_report_alert($1,'clarify','Rückmeldung eingeholt')", [id]);
      await db.exec("select refresh_report_alerts()");
      assert.equal((await db.query<{ status: string }>("select status from report_alerts where id=$1", [id])).rows[0].status, "clarified");
    });
    await t.test("changed future deadlines defer old hints and block premature reminders", async () => {
      await db.query(`insert into report_alerts(company_id,user_id,responsible_id,work_day,due_at,kind)
        values($1,$2,$3,(now() at time zone 'Europe/Zurich')::date,now()-interval '1 hour','missing')
        on conflict(company_id,user_id,work_day) do update set status='open',due_at=now()-interval '1 hour',reminded_at=null`,
        [company,employee,admin]);
      await db.exec("update work_models set planned_start='23:59';update report_settings set delay_minutes=720;select refresh_report_alerts()");
      const alert = (await db.query<{id:string; deferred:boolean}>("select id,due_at>now() as deferred from report_alerts where work_day=(now() at time zone 'Europe/Zurich')::date")).rows[0];
      assert.equal(alert.deferred,true);
      await assert.rejects(asUser(admin,"select handle_report_alert($1,'remind')",[alert.id]),/Frist noch offen/);
      await db.exec("update work_models set planned_start='08:00';update report_settings set delay_minutes=120");
    });
    await t.test("scheduler checks the previous day for deadlines crossing midnight", async () => {
      await db.exec("delete from email_outbox;delete from report_alerts;update work_models set planned_start='23:59';update report_settings set delay_minutes=1;select refresh_report_alerts()");
      const previous = (await db.query<{due_at:string}>("select due_at from report_alerts where work_day=(now() at time zone 'Europe/Zurich')::date-1")).rows;
      const midnight = (await db.query<{value:string}>(
        "select (date_trunc('day',now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich') as value"
      )).rows[0].value;
      assert.equal(previous.length,1);
      assert.equal(new Date(previous[0].due_at).getTime(),new Date(midnight).getTime());
      await db.exec("update work_models set planned_start='08:00';update report_settings set delay_minutes=120");
    });
    await t.test("late reporting resolves open hints and cancels unneeded email", async () => {
      await db.query(`insert into report_alerts(company_id,user_id,responsible_id,work_day,due_at,kind)
        values($1,$2,$3,'2020-01-03','2020-01-03T10:00:00Z','missing')`, [company,employee,admin]);
      await db.exec("select refresh_report_alerts()");
      await db.query(`insert into time_entries(company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes)
        values($1,$2,$3,'2020-01-03T08:00:00Z','2020-01-03T09:00:00Z',120,15)`, [company,employee,project]);
      await db.exec("select refresh_report_alerts()");
      assert.equal((await db.query<{ status: string }>("select status from report_alerts where work_day='2020-01-03'")).rows[0].status, "resolved");
      assert.equal((await db.query<{ status: string }>("select q.status from email_outbox q join report_alerts a on a.id=q.alert_id where a.work_day='2020-01-03'")).rows[0].status, "canceled");
    });
    await t.test("wizard progress persists per membership and cannot be modified by others", async () => {
      await asUser(employee, "insert into onboarding_progress(user_id,scope,step) values($1,$2,2)", [employee,company]);
      assert.equal((await asUser<{ step: number }>(employee, "select step from onboarding_progress"))[0].step, 2);
      assert.equal((await asUser(admin, "select * from onboarding_progress")).length, 0);
      await assert.rejects(asUser(employee, "insert into onboarding_progress(user_id,scope) values($1,$2)", [employee,other]), /row-level security/);
      assert.equal((await asUser(employee, "select * from onboarding_progress", [], "aal1")).length, 0);
    });
  } finally { await db.close(); }
});

test("email contents do not disclose diagnoses or employee names", () => {
  const text = notificationText("pending_absence", "2026-10-12", false, "https://example.invalid/#notifications");
  assert.match(text, /Abwesenheit zur Prüfung offen/);
  assert.doesNotMatch(text, /Krankheit|Diagnose/);
});
