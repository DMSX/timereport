alter table public.absences add column day_part text
  check (day_part in ('morning','afternoon'));
alter table public.absences add constraint absence_part_fraction check (day_part is null or fraction=0.5);

create table public.onboarding_progress (
  user_id uuid not null references auth.users(id),
  scope text not null,
  step integer not null default 0 check (step between 0 and 10),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(user_id,scope)
);
create table public.report_settings (
  company_id uuid not null,
  user_id uuid not null,
  responsible_id uuid,
  delay_minutes integer check (delay_minutes between 1 and 720),
  enabled boolean not null default false,
  primary key(company_id,user_id),
  foreign key(company_id,user_id) references public.company_members(company_id,user_id),
  foreign key(company_id,responsible_id) references public.company_members(company_id,user_id),
  check (not enabled or (responsible_id is not null and delay_minutes is not null))
);
create table public.company_holidays (
  company_id uuid not null references public.companies(id),
  day date not null,
  label text not null check (length(trim(label)) between 1 and 120),
  primary key(company_id,day)
);
create table public.report_alerts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null,
  responsible_id uuid not null,
  work_day date not null,
  due_at timestamptz not null,
  kind text not null check (kind in ('missing','pending_absence','unclear_half_day')),
  status text not null default 'open' check (status in ('open','resolved','clarified')),
  resolution text,
  resolved_by uuid references auth.users(id),
  reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(company_id,user_id) references public.company_members(company_id,user_id),
  foreign key(company_id,responsible_id) references public.company_members(company_id,user_id),
  unique(company_id,user_id,work_day)
);
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.report_alerts(id),
  company_id uuid not null references public.companies(id),
  recipient_id uuid not null references auth.users(id),
  purpose text not null check(purpose in ('responsible','reminder')),
  kind text not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','canceled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  sent_at timestamptz,
  unique(alert_id,recipient_id,purpose,kind)
);
create table public.scheduler_status (
  id integer primary key check (id=1),
  last_checked_at timestamptz
);
insert into public.scheduler_status(id) values(1);

alter table public.onboarding_progress enable row level security;
alter table public.report_settings enable row level security;
alter table public.company_holidays enable row level security;
alter table public.report_alerts enable row level security;
alter table public.email_outbox enable row level security;
alter table public.scheduler_status enable row level security;
create policy onboarding_own on public.onboarding_progress for all to authenticated
  using(user_id=auth.uid() and auth.jwt()->>'aal'='aal2')
  with check(user_id=auth.uid() and auth.jwt()->>'aal'='aal2' and (
    (scope='operator' and public.is_operator()) or exists(
      select 1 from public.company_members m where m.user_id=auth.uid() and m.company_id::text=scope
    )
  ));
create policy report_settings_read on public.report_settings for select to authenticated using (
  public.has_role(company_id) and (user_id=auth.uid() or public.has_role(company_id,array['hr','admin']))
);
create policy report_settings_manage on public.report_settings for all to authenticated
  using(public.has_role(company_id,array['hr','admin']))
  with check(public.has_role(company_id,array['hr','admin']));
create policy holidays_read on public.company_holidays for select to authenticated using(public.has_role(company_id));
create policy holidays_manage on public.company_holidays for all to authenticated
  using(public.has_role(company_id,array['admin'])) with check(public.has_role(company_id,array['admin']));
create policy alerts_read on public.report_alerts for select to authenticated using (
  public.has_role(company_id) and (
    responsible_id=auth.uid() or public.has_role(company_id,array['hr','admin']) or
    (user_id=auth.uid() and reminded_at is not null)
  )
);
create policy outbox_read on public.email_outbox for select to authenticated
  using(public.has_role(company_id,array['hr','admin']) or (
    public.has_role(company_id) and recipient_id=auth.uid()
  ));
create policy scheduler_read on public.scheduler_status for select to authenticated using (
  public.is_operator() or exists(select 1 from public.company_members m
    where m.user_id=auth.uid() and public.has_role(m.company_id,array['hr','admin']))
);

create function public.validate_report_setting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.responsible_id is not null and not exists(select 1 from public.company_members
    where company_id=new.company_id and user_id=new.responsible_id and role in ('hr','admin'))
    then raise exception 'Zuständigkeit nur für HR/Admin derselben Firma.'; end if;
  return new;
end;
$$;
create trigger report_setting_validate before insert or update on public.report_settings
for each row execute function public.validate_report_setting();

drop function public.request_absence(uuid,text,date,date,numeric);
create function public.request_absence(p_company uuid,p_kind text,p_start date,p_end date,p_fraction numeric,p_part text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare approval boolean; result uuid;
begin
  if not public.has_role(p_company) then raise exception 'Keine Berechtigung.'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>366 then raise exception 'Ungültiger Zeitraum.'; end if;
  if p_fraction=0.5 and (p_part is null or p_part not in ('morning','afternoon')) then raise exception 'Bitte Vormittag oder Nachmittag wählen.'; end if;
  if p_fraction=1 and p_part is not null then raise exception 'Ganzer Tag benötigt keine Tageshälfte.'; end if;
  perform 1 from public.company_members where company_id=p_company and user_id=auth.uid() for update;
  if exists(select 1 from public.absences where company_id=p_company and user_id=auth.uid()
    and status<>'rejected' and starts_on<=p_end and ends_on>=p_start)
    then raise exception 'Für diesen Zeitraum besteht bereits eine Abwesenheit.'; end if;
  if not public.has_role(p_company,array['hr','admin']) and now() >= (
    select (date_trunc('week',p_start::timestamp)+(correction_weeks+1)*interval '1 week') at time zone 'Europe/Zurich'
    from public.companies where id=p_company
  ) then raise exception 'Korrekturfrist abgelaufen. Bitte HR/Admin kontaktieren.'; end if;
  select absence_approval into approval from public.companies where id=p_company;
  insert into public.absences(company_id,user_id,kind,starts_on,ends_on,fraction,day_part,status)
  values(p_company,auth.uid(),p_kind,p_start,p_end,p_fraction,p_part,case when approval then 'pending' else 'approved' end)
  returning id into result;
  return result;
end;
$$;

-- Stable result for one person's day; no attendance judgment is inferred.
create function public.report_condition(p_company uuid,p_user uuid,p_day date)
returns table(kind text,due_at timestamptz) language plpgsql security definer set search_path='' as $$
declare s public.report_settings; w public.work_models; a public.absences;
  start_local timestamp; end_local timestamp; due timestamptz;
begin
  select * into s from public.report_settings where company_id=p_company and user_id=p_user and enabled;
  if s.user_id is null or not exists(select 1 from public.company_members
    where company_id=p_company and user_id=s.responsible_id and role in ('hr','admin')) then return; end if;
  select * into w from public.work_models where company_id=p_company and user_id=p_user and valid_from<=p_day
    order by valid_from desc limit 1;
  if w.id is null or w.planned_start is null or w.weekday_minutes[extract(isodow from p_day)::integer]=0 then return; end if;
  if exists(select 1 from public.company_holidays where company_id=p_company and day=p_day) then return; end if;
  if exists(select 1 from public.time_entries e where e.company_id=p_company and e.user_id=p_user
    and e.started_at<((p_day+1)::timestamp at time zone 'Europe/Zurich')
    and coalesce(e.ended_at,now())>(p_day::timestamp at time zone 'Europe/Zurich'))
    then return; end if;
  start_local:=p_day+w.planned_start;
  select * into a from public.absences where company_id=p_company and user_id=p_user
    and starts_on<=p_day and ends_on>=p_day and status<>'rejected' limit 1;
  if a.status='approved' and a.fraction=1 then return; end if;
  if a.status='approved' and a.fraction=0.5 and a.day_part='morning' then
    if w.planned_end is null or w.planned_end<=w.planned_start then
      due:=(start_local+make_interval(mins=>s.delay_minutes)) at time zone 'Europe/Zurich';
      return query select 'unclear_half_day'::text,due; return;
    end if;
    start_local:=start_local+(w.planned_end-w.planned_start)/2;
  end if;
  due:=(start_local+make_interval(mins=>s.delay_minutes)) at time zone 'Europe/Zurich';
  if a.fraction=0.5 and (a.day_part is null or w.planned_end is null or w.planned_end<=w.planned_start) then
    return query select 'unclear_half_day'::text,due; return;
  end if;
  if a.status='pending' then return query select 'pending_absence'::text,due; return; end if;
  if a.status='approved' and a.day_part='afternoon' then
    end_local:=p_day+w.planned_start+(w.planned_end-w.planned_start)/2;
    -- Evaluate missing morning work at its end at the latest, not during an excused afternoon.
    due:=least(due,end_local at time zone 'Europe/Zurich');
  end if;
  return query select 'missing'::text,due;
end;
$$;

create function public.refresh_report_alerts() returns integer
language plpgsql security definer set search_path='' as $$
declare r record; condition record; alert public.report_alerts; count_created integer:=0;
begin
  perform pg_advisory_xact_lock(784231);
  for r in
    select company_id,user_id,(now() at time zone 'Europe/Zurich')::date as day from public.report_settings where enabled
    union select company_id,user_id,(now() at time zone 'Europe/Zurich')::date-1 from public.report_settings where enabled
    union select company_id,user_id,work_day from public.report_alerts where status='open'
  loop
    select * into condition from public.report_condition(r.company_id,r.user_id,r.day);
    select * into alert from public.report_alerts where company_id=r.company_id and user_id=r.user_id and work_day=r.day;
    if condition.kind is null then
      if alert.id is not null and alert.status='open' then
        update public.report_alerts set status='resolved',resolution='Nach erneuter Prüfung erledigt.',updated_at=now() where id=alert.id;
      end if;
    elsif alert.id is not null and alert.status='open' then
      -- Existing hints must adopt later deadlines, e.g. after an approved morning absence.
      update public.report_alerts set kind=condition.kind,due_at=condition.due_at,
        responsible_id=(select responsible_id from public.report_settings where company_id=r.company_id and user_id=r.user_id),
        updated_at=now() where id=alert.id returning * into alert;
    elsif condition.due_at<=now() then
      if alert.id is null then
        insert into public.report_alerts(company_id,user_id,responsible_id,work_day,due_at,kind)
        select r.company_id,r.user_id,s.responsible_id,r.day,condition.due_at,condition.kind
          from public.report_settings s where s.company_id=r.company_id and s.user_id=r.user_id returning * into alert;
        count_created:=count_created+1;
      end if;
    end if;
    if condition.kind is not null and condition.due_at<=now() and alert.status='open' then
      insert into public.email_outbox(alert_id,company_id,recipient_id,purpose,kind)
        values(alert.id,alert.company_id,alert.responsible_id,'responsible',alert.kind) on conflict do nothing;
    end if;
  end loop;
  update public.email_outbox q set status='canceled' where status in ('pending','failed') and exists(
    select 1 from public.report_alerts a where a.id=q.alert_id and (
      a.status<>'open' or a.kind<>q.kind or (q.purpose='responsible' and a.responsible_id<>q.recipient_id)
    )
  );
  update public.scheduler_status set last_checked_at=now() where id=1;
  return count_created;
end;
$$;

create function public.handle_report_alert(p_alert uuid,p_action text,p_reason text default '')
returns void language plpgsql security definer set search_path='' as $$
declare a public.report_alerts; current_condition record;
begin
  select * into a from public.report_alerts where id=p_alert for update;
  if a.id is null or not public.has_role(a.company_id,array['hr','admin']) then raise exception 'Keine Berechtigung.'; end if;
  if a.status<>'open' then raise exception 'Hinweis bereits erledigt.'; end if;
  if p_action='clarify' then
    if p_reason is null or length(trim(p_reason))<3 or length(p_reason)>1000 then raise exception 'Klärungsgrund erforderlich.'; end if;
    update public.report_alerts set status='clarified',resolution=p_reason,resolved_by=auth.uid(),updated_at=now() where id=a.id;
    insert into public.audit_log(company_id,actor_id,entity_id,action,reason)
      values(a.company_id,auth.uid(),a.id,'report_alert_clarified',p_reason);
  elsif p_action='remind' then
    if a.kind<>'missing' then raise exception 'Zuerst die Abwesenheit klären.'; end if;
    select * into current_condition from public.report_condition(a.company_id,a.user_id,a.work_day);
    if current_condition.kind is distinct from 'missing' or current_condition.due_at>now() then
      raise exception 'Hinweis nicht mehr aktuell oder Frist noch offen. Nächste serverseitige Prüfung abwarten.';
    end if;
    if a.reminded_at is not null then raise exception 'Erinnerung bereits beauftragt. Zustellstatus prüfen.'; end if;
    update public.report_alerts set reminded_at=now(),updated_at=now() where id=a.id;
    insert into public.email_outbox(alert_id,company_id,recipient_id,purpose,kind)
      values(a.id,a.company_id,a.user_id,'reminder',a.kind);
    insert into public.audit_log(company_id,actor_id,entity_id,action,reason)
      values(a.company_id,auth.uid(),a.id,'report_reminder','Manuelle Erinnerung beauftragt.');
  else raise exception 'Ungültige Aktion.'; end if;
end;
$$;

create function public.claim_report_emails() returns setof public.email_outbox
language plpgsql security definer set search_path='' as $$
begin
  update public.email_outbox set status='failed',lease_until=null,
    last_error='Versandstatus nach Ablauf der letzten Zustellfrist unklar. Administrator muss prüfen.'
    where status='sending' and lease_until<now() and attempts>=5;
  return query update public.email_outbox set status='sending',attempts=attempts+1,
    lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes'
  where id in(select id from public.email_outbox where (
    (status in ('pending','failed') and next_attempt_at<=now()) or (status='sending' and lease_until<now())
  ) and attempts<5 order by next_attempt_at limit 5 for update skip locked)
  returning *;
end;
$$;

create function public.retry_report_email(p_job uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.email_outbox;
begin
  select * into q from public.email_outbox where id=p_job for update;
  if q.id is null or not public.has_role(q.company_id,array['hr','admin']) then raise exception 'Keine Berechtigung.'; end if;
  if q.status<>'failed' then raise exception 'Nur fehlgeschlagene Zustellungen können erneut beauftragt werden.'; end if;
  update public.email_outbox set status='pending',attempts=0,next_attempt_at=now(),lease_token=null,lease_until=null,last_error=null where id=q.id;
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason)
    values(q.company_id,auth.uid(),q.id,'email_retry','Erneuter Zustellversuch manuell beauftragt.');
end;
$$;

create function public.set_absence_part(p_absence uuid,p_part text,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.absences;
begin
  select * into a from public.absences where id=p_absence for update;
  if a.id is null or not public.has_role(a.company_id,array['hr','admin']) then raise exception 'Keine Berechtigung.'; end if;
  if a.fraction<>0.5 or p_part not in ('morning','afternoon') or p_part is null then raise exception 'Ungültige Tageshälfte.'; end if;
  if p_reason is null or length(trim(p_reason))<3 or length(p_reason)>1000 then raise exception 'Änderungsgrund erforderlich.'; end if;
  update public.absences set day_part=p_part where id=a.id;
  insert into public.audit_log(company_id,actor_id,entity_id,action,reason,before_data,after_data)
    values(a.company_id,auth.uid(),a.id,'absence_day_part',p_reason,to_jsonb(a),jsonb_build_object('day_part',p_part));
end;
$$;

revoke all on public.onboarding_progress,public.report_settings,public.company_holidays,
  public.report_alerts,public.email_outbox,public.scheduler_status from anon,authenticated;
grant select,insert,update on public.onboarding_progress to authenticated;
grant select,insert,update,delete on public.report_settings,public.company_holidays to authenticated;
grant select on public.report_alerts,public.email_outbox,public.scheduler_status to authenticated;
grant all on public.onboarding_progress,public.report_settings,public.company_holidays,
  public.report_alerts,public.email_outbox,public.scheduler_status to service_role;
revoke all on function public.validate_report_setting(),public.report_condition(uuid,uuid,date),
  public.refresh_report_alerts(),public.claim_report_emails(),
  public.handle_report_alert(uuid,text,text),public.request_absence(uuid,text,date,date,numeric,text) from public,anon,authenticated;
revoke all on function public.retry_report_email(uuid),public.set_absence_part(uuid,text,text) from public,anon,authenticated;
grant execute on function public.handle_report_alert(uuid,text,text),
  public.request_absence(uuid,text,date,date,numeric,text),public.retry_report_email(uuid),
  public.set_absence_part(uuid,text,text) to authenticated;
grant execute on function public.report_condition(uuid,uuid,date),public.refresh_report_alerts(),
  public.claim_report_emails() to service_role;
