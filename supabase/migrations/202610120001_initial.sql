create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  correction_weeks integer not null default 1 check (correction_weeks between 0 and 8),
  absence_approval boolean not null default true,
  max_work_minutes integer not null default 120 check (max_work_minutes between 15 and 720),
  min_break_minutes integer not null default 15 check (min_break_minutes between 1 and 120)
);

create table public.operators (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.company_members (
  company_id uuid not null references public.companies(id),
  user_id uuid not null references auth.users(id),
  display_name text not null check (length(display_name) between 1 and 120),
  role text not null default 'employee' check (role in ('employee', 'hr', 'admin')),
  vacation_days numeric(5,1) not null default 25 check (vacation_days between 0 and 100),
  primary key (company_id, user_id)
);

create table public.subscriptions (
  company_id uuid primary key references public.companies(id),
  complimentary boolean not null default false,
  status text not null default 'pilot',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  checkout_lease uuid,
  checkout_lease_until timestamptz
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(name) between 1 and 120),
  active boolean not null default true,
  max_work_minutes integer check (max_work_minutes between 15 and 720),
  min_break_minutes integer check (min_break_minutes between 1 and 120),
  unique (company_id, id)
);

create table public.project_members (
  company_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  primary key (project_id, user_id),
  foreign key (company_id, project_id) references public.projects(company_id, id),
  foreign key (company_id, user_id) references public.company_members(company_id, user_id)
);

create table public.work_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  valid_from date not null,
  weekday_minutes integer[] not null check (
    array_ndims(weekday_minutes) = 1 and array_length(weekday_minutes, 1) = 7 and
    array_position(weekday_minutes, null) is null and
    0 <= all(weekday_minutes) and 1440 >= all(weekday_minutes)
  ),
  planned_start time,
  planned_end time,
  foreign key (company_id, user_id) references public.company_members(company_id, user_id),
  unique (company_id, user_id, valid_from)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  project_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  note text not null default '' check (length(note) <= 1000),
  max_work_minutes integer not null,
  min_break_minutes integer not null,
  foreign key (company_id, user_id) references public.company_members(company_id, user_id),
  foreign key (company_id, project_id) references public.projects(company_id, id),
  check (ended_at is null or ended_at > started_at)
);
create unique index one_running_entry_per_person on public.time_entries(user_id) where ended_at is null;
create index entries_company_user_start on public.time_entries(company_id, user_id, started_at);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind in ('vacation', 'sick')),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  fraction numeric(2,1) not null default 1 check (fraction in (0.5, 1)),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  foreign key (company_id, user_id) references public.company_members(company_id, user_id),
  check (fraction = 1 or starts_on = ends_on)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  actor_id uuid not null references auth.users(id),
  entity_id uuid not null,
  action text not null,
  reason text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.break_resolutions (
  entry_id uuid primary key references public.time_entries(id),
  company_id uuid not null references public.companies(id),
  resolved_by uuid not null references auth.users(id),
  reason text not null check (length(reason) between 3 and 1000),
  resolved_at timestamptz not null default now()
);

create function public.has_role(c uuid, roles text[] default array['employee','hr','admin'])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2' and exists (
    select 1 from public.company_members m
    where m.company_id = c and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;
create function public.is_operator()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2' and exists (
    select 1 from public.operators where user_id = auth.uid()
  );
$$;

alter table public.companies enable row level security;
alter table public.operators enable row level security;
alter table public.company_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.work_models enable row level security;
alter table public.time_entries enable row level security;
alter table public.absences enable row level security;
alter table public.audit_log enable row level security;
alter table public.break_resolutions enable row level security;

create policy companies_read on public.companies for select to authenticated
  using (public.has_role(id) or public.is_operator());
create policy companies_update on public.companies for update to authenticated
  using (public.has_role(id, array['admin'])) with check (public.has_role(id, array['admin']));
create policy operators_self on public.operators for select to authenticated using (user_id = auth.uid() and public.is_operator());
create policy members_read on public.company_members for select to authenticated
  using (public.has_role(company_id) and (user_id = auth.uid() or public.has_role(company_id, array['hr','admin'])));
create policy members_admin on public.company_members for update to authenticated
  using (public.has_role(company_id, array['admin'])) with check (public.has_role(company_id, array['admin']));
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (public.has_role(company_id, array['admin']) or public.is_operator());
create policy projects_read on public.projects for select to authenticated using (
  public.has_role(company_id, array['hr','admin']) or (
    public.has_role(company_id) and exists (
      select 1 from public.project_members pm where pm.project_id = id and pm.user_id = auth.uid()
    ) or public.has_role(company_id) and exists (
      select 1 from public.time_entries e where e.project_id = projects.id and e.user_id = auth.uid()
    )
  )
);
create policy projects_admin on public.projects for all to authenticated
  using (public.has_role(company_id, array['admin'])) with check (public.has_role(company_id, array['admin']));
create policy assignments_read on public.project_members for select to authenticated
  using (public.has_role(company_id) and (user_id=auth.uid() or public.has_role(company_id,array['hr','admin'])));
create policy assignments_admin on public.project_members for all to authenticated
  using (public.has_role(company_id, array['admin'])) with check (public.has_role(company_id, array['admin']));
create policy models_read on public.work_models for select to authenticated
  using (public.has_role(company_id) and (user_id = auth.uid() or public.has_role(company_id, array['hr','admin'])));
create policy models_manage on public.work_models for all to authenticated
  using (public.has_role(company_id, array['hr','admin'])) with check (public.has_role(company_id, array['hr','admin']));
create policy entries_read on public.time_entries for select to authenticated
  using (public.has_role(company_id) and (user_id = auth.uid() or public.has_role(company_id, array['hr','admin'])));
create policy absences_read on public.absences for select to authenticated
  using (public.has_role(company_id) and (user_id = auth.uid() or public.has_role(company_id, array['hr','admin'])));
create policy audit_read on public.audit_log for select to authenticated using (public.has_role(company_id, array['hr','admin']));
create policy resolutions_read on public.break_resolutions for select to authenticated using (
  public.has_role(company_id) and (public.has_role(company_id,array['hr','admin']) or exists (
    select 1 from public.time_entries e where e.id=entry_id and e.user_id=auth.uid()
  ))
);

-- All entry writes take the same member lock, including corrections.
create function public.validate_entry() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id = new.user_id for update;
  if new.started_at > now() or new.ended_at > now() then raise exception 'Zukünftige Arbeitszeiten sind nicht erlaubt.'; end if;
  if exists (
    select 1 from public.time_entries e
    where e.user_id = new.user_id and e.id <> new.id
      and tstzrange(e.started_at, e.ended_at, '[)') && tstzrange(new.started_at, new.ended_at, '[)')
  ) then raise exception 'Arbeitszeiten dürfen sich nicht überschneiden.'; end if;
  return new;
end;
$$;
create trigger entries_validate before insert or update on public.time_entries
for each row execute function public.validate_entry();

create function public.check_in(p_company uuid, p_project uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.companies; p public.projects; result uuid;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung oder 2FA fehlt.'; end if;
  select * into c from public.companies where id = p_company;
  select * into p from public.projects where id = p_project and company_id = p_company and active;
  if p.id is null or not exists (
    select 1 from public.project_members where project_id = p_project and user_id = auth.uid()
  ) then raise exception 'Projekt nicht zugewiesen oder inaktiv.'; end if;
  insert into public.time_entries(company_id,user_id,project_id,started_at,max_work_minutes,min_break_minutes)
  values (p_company,auth.uid(),p_project,now(),least(c.max_work_minutes,coalesce(p.max_work_minutes,c.max_work_minutes)),
    greatest(c.min_break_minutes,coalesce(p.min_break_minutes,c.min_break_minutes)))
  returning id into result;
  return result;
end;
$$;

create function public.check_out(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung oder 2FA fehlt.'; end if;
  update public.time_entries set ended_at = now() where company_id = p_company and user_id = auth.uid() and ended_at is null;
  if not found then raise exception 'Keine laufende Buchung.'; end if;
end;
$$;

create function public.record_entry(p_company uuid,p_user uuid,p_project uuid,p_start timestamptz,p_end timestamptz,p_note text,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.companies; p public.projects; manager boolean; result public.time_entries;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung.'; end if;
  manager := public.has_role(p_company,array['hr','admin']);
  if not manager and p_user <> auth.uid() then raise exception 'Keine Berechtigung.'; end if;
  select * into c from public.companies where id=p_company;
  if not manager and now() >= (date_trunc('week',p_start at time zone 'Europe/Zurich')+
    (c.correction_weeks+1)*interval '1 week') at time zone 'Europe/Zurich'
    then raise exception 'Korrekturfrist abgelaufen. Bitte HR/Admin kontaktieren.'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Ungültiger Arbeitsblock.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Bitte einen Erfassungsgrund angeben.'; end if;
  select * into p from public.projects where id=p_project and company_id=p_company;
  if p.id is null or (not manager and (not p.active or not exists (
    select 1 from public.project_members where project_id=p_project and user_id=auth.uid()
  ))) then raise exception 'Projekt nicht verfügbar.'; end if;
  insert into public.time_entries(company_id,user_id,project_id,started_at,ended_at,note,max_work_minutes,min_break_minutes)
    values(p_company,p_user,p_project,p_start,p_end,p_note,
      least(c.max_work_minutes,coalesce(p.max_work_minutes,c.max_work_minutes)),
      greatest(c.min_break_minutes,coalesce(p.min_break_minutes,c.min_break_minutes))) returning * into result;
  delete from public.break_resolutions where entry_id in (
    select id from public.time_entries where company_id=p_company and user_id=p_user and started_at>=p_start
  );
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason,after_data)
    values(p_company,auth.uid(),result.id,'manual_entry',p_reason,to_jsonb(result));
  return result.id;
end;
$$;

create function public.correct_entry(p_entry uuid, p_project uuid, p_start timestamptz, p_end timestamptz, p_note text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.time_entries; c public.companies; p public.projects; deadline timestamptz; manager boolean; updated public.time_entries;
begin
  select * into e from public.time_entries where id = p_entry for update;
  if e.id is null or not public.has_role(e.company_id) then raise exception 'Keine Berechtigung.'; end if;
  manager := public.has_role(e.company_id, array['hr','admin']);
  if not manager and e.user_id <> auth.uid() then raise exception 'Keine Berechtigung.'; end if;
  select * into c from public.companies where id = e.company_id;
  deadline := (date_trunc('week', e.started_at at time zone 'Europe/Zurich')
    + (c.correction_weeks + 1) * interval '1 week') at time zone 'Europe/Zurich';
  if not manager and (now() >= deadline or now() >= (
    date_trunc('week', p_start at time zone 'Europe/Zurich')
      + (c.correction_weeks + 1) * interval '1 week') at time zone 'Europe/Zurich')
    then raise exception 'Korrekturfrist abgelaufen. Bitte HR/Admin kontaktieren.'; end if;
  if e.ended_at is null or p_end is null or p_start is null or p_end <= p_start then raise exception 'Nur abgeschlossene Arbeitsblöcke können korrigiert werden.'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Bitte einen Korrekturgrund angeben.'; end if;
  select * into p from public.projects where id = p_project and company_id = e.company_id;
  if p.id is null or (not manager and (not p.active or not exists (
    select 1 from public.project_members where project_id = p_project and user_id = auth.uid()
  ))) then raise exception 'Projekt nicht verfügbar.'; end if;
  update public.time_entries set started_at=p_start, ended_at=p_end, project_id=p_project, note=p_note,
    max_work_minutes=case when p_project=e.project_id then e.max_work_minutes else least(c.max_work_minutes,coalesce(p.max_work_minutes,c.max_work_minutes)) end,
    min_break_minutes=case when p_project=e.project_id then e.min_break_minutes else greatest(c.min_break_minutes,coalesce(p.min_break_minutes,c.min_break_minutes)) end
    where id=e.id returning * into updated;
  delete from public.break_resolutions where entry_id in (
    select id from public.time_entries where company_id=e.company_id and user_id=e.user_id
      and started_at >= least(e.started_at,p_start)
  );
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason,before_data,after_data)
    values(e.company_id,auth.uid(),e.id,'correction',p_reason,to_jsonb(e),to_jsonb(updated));
end;
$$;

create function public.request_absence(p_company uuid, p_kind text, p_start date, p_end date, p_fraction numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare approval boolean; result uuid;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung.'; end if;
  if p_end < p_start or p_end - p_start > 366 then raise exception 'Ungültiger Zeitraum (maximal 366 Tage).'; end if;
  perform 1 from public.company_members where company_id=p_company and user_id=auth.uid() for update;
  if exists (select 1 from public.absences where company_id=p_company and user_id=auth.uid()
    and status <> 'rejected' and starts_on <= p_end and ends_on >= p_start)
    then raise exception 'Für diesen Zeitraum besteht bereits eine Abwesenheit.'; end if;
  if not public.has_role(p_company,array['hr','admin']) and now() >= (
    select (date_trunc('week', p_start::timestamp) + (correction_weeks+1)*interval '1 week') at time zone 'Europe/Zurich'
    from public.companies where id=p_company
  ) then raise exception 'Korrekturfrist abgelaufen. Bitte HR/Admin kontaktieren.'; end if;
  select absence_approval into approval from public.companies where id=p_company;
  insert into public.absences(company_id,user_id,kind,starts_on,ends_on,fraction,status)
    values(p_company,auth.uid(),p_kind,p_start,p_end,p_fraction,case when approval then 'pending' else 'approved' end)
    returning id into result;
  return result;
end;
$$;

create function public.review_absence(p_absence uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.absences;
begin
  select * into a from public.absences where id=p_absence for update;
  if a.id is null or not public.has_role(a.company_id,array['hr','admin']) then raise exception 'Keine Berechtigung.'; end if;
  if a.status <> 'pending' then raise exception 'Dieser Antrag wurde bereits entschieden.'; end if;
  if p_status not in ('approved','rejected') or length(trim(p_reason)) < 3 then raise exception 'Entscheidung und Grund erforderlich.'; end if;
  update public.absences set status=p_status where id=a.id;
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason,before_data,after_data)
    values(a.company_id,auth.uid(),a.id,'absence_review',p_reason,to_jsonb(a),jsonb_build_object('status',p_status));
end;
$$;

create function public.resolve_break(p_entry uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  select company_id into c from public.time_entries where id=p_entry and ended_at is not null;
  if c is null or not public.has_role(c,array['hr','admin']) then raise exception 'Keine Berechtigung oder Buchung läuft noch.'; end if;
  if length(trim(p_reason)) < 3 then raise exception 'Klärungsgrund erforderlich.'; end if;
  insert into public.break_resolutions(entry_id,company_id,resolved_by,reason)
    values(p_entry,c,auth.uid(),p_reason)
    on conflict(entry_id) do update set reason=excluded.reason,resolved_by=excluded.resolved_by,resolved_at=now();
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason)
    values(c,auth.uid(),p_entry,'break_resolution',p_reason);
end;
$$;

create function public.protect_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role='admin' and new.role <> 'admin' then
    perform 1 from public.companies where id=old.company_id for update;
    if not exists(select 1 from public.company_members where company_id=old.company_id and role='admin' and user_id<>old.user_id)
      then raise exception 'Der letzte Firmen-Admin darf nicht entfernt werden.'; end if;
  end if;
  return new;
end;
$$;
create trigger members_keep_admin before update on public.company_members
for each row execute function public.protect_last_admin();

create function public.provision_company(p_name text, p_user uuid, p_admin_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c uuid;
begin
  insert into public.companies(name) values(p_name) returning id into c;
  insert into public.subscriptions(company_id) values(c);
  insert into public.company_members(company_id,user_id,display_name,role) values(c,p_user,p_admin_name,'admin');
  return c;
end;
$$;

create function public.claim_checkout(p_company uuid) returns table(token uuid, expires_at bigint)
language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions;
begin
  select * into s from public.subscriptions where company_id=p_company for update;
  if s.company_id is null or s.complimentary or
    (s.stripe_subscription_id is not null and s.status not in ('canceled','incomplete_expired'))
    then raise exception 'Firma kostenfrei oder Abo bereits vorhanden.'; end if;
  if s.checkout_lease is null or s.checkout_lease_until <= now() then
    update public.subscriptions set checkout_lease=gen_random_uuid(), checkout_lease_until=now()+interval '23 hours'
      where company_id=p_company returning * into s;
  end if;
  return query select s.checkout_lease, floor(extract(epoch from s.checkout_lease_until))::bigint;
end;
$$;

-- No API client may write around the guarded functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant update on public.companies to authenticated;
grant update(display_name,role,vacation_days) on public.company_members to authenticated;
grant insert, update, delete on public.projects, public.project_members, public.work_models to authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.has_role(uuid,text[]), public.is_operator(),
  public.check_in(uuid,uuid), public.check_out(uuid),
  public.record_entry(uuid,uuid,uuid,timestamptz,timestamptz,text,text),
  public.correct_entry(uuid,uuid,timestamptz,timestamptz,text,text),
  public.request_absence(uuid,text,date,date,numeric),
  public.review_absence(uuid,text,text), public.resolve_break(uuid,text) to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.provision_company(text,uuid,text) to service_role;
grant execute on function public.claim_checkout(uuid) to service_role;
