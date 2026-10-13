import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { accessState } from "../src/lib/access";

const user = "10000000-0000-4000-8000-000000000001";
const day = 86_400_000;

test("accessState mirrors the commercial rules", () => {
  const future = new Date(Date.now() + day).toISOString();
  const past = new Date(Date.now() - day).toISOString();
  const base = { complimentary: false, status: "pilot", stripe_subscription_id: null, trial_ends_at: future };
  assert.equal(accessState(base), "trial");
  assert.equal(accessState({ ...base, trial_ends_at: past }), "locked");
  assert.equal(accessState({ ...base, complimentary: true, trial_ends_at: past }), "complimentary");
  assert.equal(accessState({ ...base, stripe_subscription_id: "sub", status: "active", trial_ends_at: past }), "active");
  assert.equal(accessState({ ...base, stripe_subscription_id: "sub", status: "canceled" }), "locked");
  assert.equal(accessState({ ...base, stripe_subscription_id: "sub", status: "incomplete" }), "trial");
  assert.equal(accessState(undefined), "locked");
});

test("database locks writes after the trial and unlocks on subscription", async () => {
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
    for (const file of ["202610120001_initial", "202610120002_onboarding_alerts", "202610120003_flexible_work_models", "202610120004_self_service_billing"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into auth.users values ('${user}')`);
    const company = (await db.query<{ id: string }>("select public.signup_company('Test', $1, 'Owner') as id", [user])).rows[0].id;
    const access = async () => (await db.query<{ a: string }>("select public.company_access($1) as a", [company])).rows[0].a;
    const record = (hoursAgo = 3) => db.query(
      `insert into public.time_entries(company_id,user_id,project_id,started_at,ended_at,max_work_minutes,min_break_minutes) select $1,$2,p.id,now()-make_interval(hours=>$3+1),now()-make_interval(hours=>$3),120,15 from public.projects p limit 1`,
      [company, user, hoursAgo],
    );
    await db.query("insert into public.projects(company_id,name) values($1,'P')", [company]);

    assert.equal(await access(), "trial");
    await record(3);

    await db.query("update public.subscriptions set trial_ends_at = now() - interval '1 day' where company_id=$1", [company]);
    assert.equal(await access(), "locked");
    await assert.rejects(record(6), /nur lesbar/);
    assert.equal((await db.query("select 1 from public.time_entries where company_id=$1", [company])).rows.length, 1);

    await db.query("update public.subscriptions set stripe_subscription_id='sub_1', status='active' where company_id=$1", [company]);
    assert.equal(await access(), "active");
    await record(9);

    await db.query("update public.subscriptions set status='canceled' where company_id=$1", [company]);
    assert.equal(await access(), "locked");
    await db.query("update public.subscriptions set complimentary=true where company_id=$1", [company]);
    assert.equal(await access(), "complimentary");
  } finally { await db.close(); }
});

test("signup is rate limited", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      grant usage on schema auth to authenticated;
      grant execute on all functions in schema auth to authenticated;
    `);
    for (const file of ["202610120001_initial", "202610120002_onboarding_alerts", "202610120003_flexible_work_models", "202610120004_self_service_billing"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}.sql`, import.meta.url), "utf8"));
    }
    await db.exec(`insert into auth.users values ('${user}')`);
    for (let i = 0; i < 30; i++) await db.query("select public.signup_company('F', $1, 'A')", [user]);
    await assert.rejects(db.query("select public.signup_company('F', $1, 'A')", [user]), /Zu viele/);
  } finally { await db.close(); }
});
