-- Departments for grouping members within a company
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

-- Assign members to optional department
alter table public.company_members
  add column if not exists department_id uuid references public.departments(id) on delete set null;

-- Work rules with cascading scopes: company (default) -> department -> member (individual exception)
create table if not exists public.work_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  scope text not null check (scope in ('company', 'department', 'member')),
  department_id uuid references public.departments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  activity_tag text check (activity_tag is null or length(trim(activity_tag)) between 1 and 50),
  max_work_minutes integer not null check (max_work_minutes between 15 and 720),
  min_break_minutes integer not null check (min_break_minutes between 0 and 240),
  allow_overrun boolean not null default true,
  overrun_note_required boolean not null default true,
  priority integer not null default 0,
  valid_from date not null default '2000-01-01',
  valid_to date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (scope = 'company' and department_id is null and user_id is null) or
    (scope = 'department' and department_id is not null and user_id is null) or
    (scope = 'member' and user_id is not null)
  ),
  check (valid_to is null or valid_to >= valid_from)
);

create index if not exists idx_work_rules_lookup
  on public.work_rules(company_id, is_active, scope, activity_tag, valid_from);

-- Extensions to time_entries for activity tags, applied rule reference and overrun explanation
alter table public.time_entries
  add column if not exists activity_tag text check (activity_tag is null or length(trim(activity_tag)) <= 50),
  add column if not exists rule_id uuid references public.work_rules(id) on delete set null,
  add column if not exists overrun_reason text check (overrun_reason is null or length(trim(overrun_reason)) <= 1000);

-- RLS
alter table public.departments enable row level security;
alter table public.work_rules enable row level security;

create policy departments_read on public.departments for select to authenticated
  using (public.has_role(company_id));

create policy departments_manage on public.departments for all to authenticated
  using (public.has_role(company_id, array['admin', 'hr']))
  with check (public.has_role(company_id, array['admin', 'hr']));

create policy work_rules_read on public.work_rules for select to authenticated
  using (public.has_role(company_id));

create policy work_rules_manage on public.work_rules for all to authenticated
  using (public.has_role(company_id, array['admin', 'hr']))
  with check (public.has_role(company_id, array['admin', 'hr']));

-- Function to resolve the winning rule by cascade:
-- Member exception > Department rule > Company default
-- Specific activity_tag > Generic rule
-- Higher priority > lower priority
create or replace function public.resolve_work_rule(
  p_company uuid,
  p_user uuid,
  p_activity text default null,
  p_day date default current_date
) returns table (
  rule_id uuid,
  rule_name text,
  max_work_minutes integer,
  min_break_minutes integer,
  allow_overrun boolean,
  overrun_note_required boolean,
  matched_scope text
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_department uuid;
  v_normalized_act text;
begin
  select department_id into v_department
  from public.company_members
  where company_id = p_company and user_id = p_user;

  v_normalized_act := nullif(lower(trim(coalesce(p_activity, ''))), '');

  return query
  select
    r.id as rule_id,
    r.name as rule_name,
    r.max_work_minutes,
    r.min_break_minutes,
    r.allow_overrun,
    r.overrun_note_required,
    r.scope as matched_scope
  from public.work_rules r
  where r.company_id = p_company
    and r.is_active = true
    and r.valid_from <= p_day
    and (r.valid_to is null or r.valid_to >= p_day)
    and (
      (r.scope = 'member' and r.user_id = p_user)
      or (r.scope = 'department' and v_department is not null and r.department_id = v_department)
      or (r.scope = 'company')
    )
    and (
      (v_normalized_act is not null and (lower(r.activity_tag) = v_normalized_act or r.activity_tag is null))
      or (v_normalized_act is null and r.activity_tag is null)
    )
  order by
    -- 1. Scope specificity: member exception wins over department wins over company
    case r.scope when 'member' then 3 when 'department' then 2 else 1 end desc,
    -- 2. Activity specificity: specific activity tag wins over generic rule
    case when r.activity_tag is not null then 2 else 1 end desc,
    -- 3. Explicit priority
    r.priority desc,
    -- 4. Newest rule
    r.created_at desc
  limit 1;
end;
$$;

-- Drop old signatures to avoid ambiguous function calls in PostgreSQL
drop function if exists public.check_in(uuid, uuid);
drop function if exists public.check_out(uuid);
drop function if exists public.record_entry(uuid, uuid, uuid, timestamptz, timestamptz, text, text);

-- Enhanced check_in supporting optional activity tag and cascading rule resolution
create or replace function public.check_in(
  p_company uuid,
  p_project uuid,
  p_activity text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies;
  p public.projects;
  r record;
  v_max_work integer;
  v_min_break integer;
  v_rule_id uuid;
  result uuid;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung oder 2FA fehlt.'; end if;
  select * into c from public.companies where id = p_company;
  select * into p from public.projects where id = p_project and company_id = p_company and active;
  if p.id is null or not exists (
    select 1 from public.project_members where project_id = p_project and user_id = auth.uid()
  ) then raise exception 'Projekt nicht zugewiesen oder inaktiv.'; end if;

  -- Resolve cascading rule
  select * into r from public.resolve_work_rule(p_company, auth.uid(), p_activity, current_date);
  if r.rule_id is not null then
    v_rule_id := r.rule_id;
    v_max_work := least(r.max_work_minutes, coalesce(p.max_work_minutes, r.max_work_minutes));
    v_min_break := greatest(r.min_break_minutes, coalesce(p.min_break_minutes, r.min_break_minutes));
  else
    v_rule_id := null;
    v_max_work := least(c.max_work_minutes, coalesce(p.max_work_minutes, c.max_work_minutes));
    v_min_break := greatest(c.min_break_minutes, coalesce(p.min_break_minutes, c.min_break_minutes));
  end if;

  insert into public.time_entries(
    company_id, user_id, project_id, started_at,
    max_work_minutes, min_break_minutes, activity_tag, rule_id
  )
  values (
    p_company, auth.uid(), p_project, now(),
    v_max_work, v_min_break, nullif(trim(coalesce(p_activity, '')), ''), v_rule_id
  )
  returning id into result;

  return result;
end;
$$;

-- Enhanced check_out supporting optional overrun reason
create or replace function public.check_out(
  p_company uuid,
  p_overrun_reason text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung oder 2FA fehlt.'; end if;
  update public.time_entries
  set ended_at = now(),
      overrun_reason = coalesce(nullif(trim(coalesce(p_overrun_reason, '')), ''), overrun_reason)
  where company_id = p_company and user_id = auth.uid() and ended_at is null;
  if not found then raise exception 'Keine laufende Buchung.'; end if;
end;
$$;

-- Enhanced record_entry supporting optional activity and overrun reason
create or replace function public.record_entry(
  p_company uuid,
  p_user uuid,
  p_project uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_note text,
  p_reason text,
  p_activity text default null,
  p_overrun_reason text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c public.companies;
  p public.projects;
  r record;
  manager boolean;
  result public.time_entries;
  v_max_work integer;
  v_min_break integer;
  v_rule_id uuid;
  v_duration_min integer;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung.'; end if;
  manager := public.has_role(p_company, array['hr','admin']);
  if not manager and p_user <> auth.uid() then raise exception 'Keine Berechtigung.'; end if;
  select * into c from public.companies where id = p_company;
  if not manager and now() >= (date_trunc('week', p_start at time zone 'Europe/Zurich') +
    (c.correction_weeks + 1) * interval '1 week') at time zone 'Europe/Zurich'
    then raise exception 'Korrekturfrist abgelaufen. Bitte HR/Admin kontaktieren.'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Ungültiger Arbeitsblock.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Bitte einen Erfassungsgrund angeben.'; end if;
  select * into p from public.projects where id = p_project and company_id = p_company;
  if p.id is null or (not manager and (not p.active or not exists (
    select 1 from public.project_members where project_id = p_project and user_id = auth.uid()
  ))) then raise exception 'Projekt nicht verfügbar.'; end if;

  -- Resolve rule
  select * into r from public.resolve_work_rule(p_company, p_user, p_activity, (p_start at time zone 'Europe/Zurich')::date);
  if r.rule_id is not null then
    v_rule_id := r.rule_id;
    v_max_work := least(r.max_work_minutes, coalesce(p.max_work_minutes, r.max_work_minutes));
    v_min_break := greatest(r.min_break_minutes, coalesce(p.min_break_minutes, r.min_break_minutes));
    v_duration_min := round(extract(epoch from (p_end - p_start)) / 60);

    -- Check overrun restrictions if duration exceeds max work minutes
    if v_duration_min > v_max_work and not r.allow_overrun then
      raise exception 'Höchstarbeitszeit gemäss Regel überschritten (Überzug nicht gestattet).';
    end if;
  else
    v_rule_id := null;
    v_max_work := least(c.max_work_minutes, coalesce(p.max_work_minutes, c.max_work_minutes));
    v_min_break := greatest(c.min_break_minutes, coalesce(p.min_break_minutes, c.min_break_minutes));
  end if;

  insert into public.time_entries(
    company_id, user_id, project_id, started_at, ended_at, note,
    max_work_minutes, min_break_minutes, activity_tag, rule_id, overrun_reason
  )
  values(
    p_company, p_user, p_project, p_start, p_end, p_note,
    v_max_work, v_min_break,
    nullif(trim(coalesce(p_activity, '')), ''),
    v_rule_id,
    nullif(trim(coalesce(p_overrun_reason, '')), '')
  ) returning * into result;

  delete from public.break_resolutions where entry_id in (
    select id from public.time_entries where company_id = p_company and user_id = p_user and started_at >= p_start
  );

  insert into public.audit_log(company_id, actor_id, entity_id, action, reason, after_data)
    values(p_company, auth.uid(), result.id, 'manual_entry', p_reason, to_jsonb(result));

  return result.id;
end;
$$;

grant select on public.departments, public.work_rules to authenticated;
grant insert, update, delete on public.departments, public.work_rules to authenticated;
grant update(department_id) on public.company_members to authenticated;

grant execute on function public.resolve_work_rule(uuid, uuid, text, date) to authenticated;
grant execute on function public.check_in(uuid, uuid, text) to authenticated;
grant execute on function public.check_out(uuid, text) to authenticated;
grant execute on function public.record_entry(uuid, uuid, uuid, timestamptz, timestamptz, text, text, text, text) to authenticated;

grant all on public.departments, public.work_rules to service_role;

