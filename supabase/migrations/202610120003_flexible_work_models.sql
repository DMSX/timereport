alter table public.work_models add column mode text not null default 'scheduled'
  check(mode in ('scheduled','hourly'));
alter table public.work_models add constraint hourly_without_target check (
  mode<>'hourly' or (weekday_minutes=array[0,0,0,0,0,0,0] and planned_start is null and planned_end is null)
);
alter table public.companies add column absence_tracking boolean not null default true;
alter table public.companies add column report_alerts_enabled boolean not null default true;
-- Keep existing workspaces unchanged; new workspaces opt in to additional workflows.
alter table public.companies alter column absence_tracking set default false;
alter table public.companies alter column report_alerts_enabled set default false;

create or replace function public.report_condition(p_company uuid,p_user uuid,p_day date)
returns table(kind text,due_at timestamptz) language plpgsql security definer set search_path='' as $$
declare s public.report_settings; w public.work_models; a public.absences;
  start_local timestamp; end_local timestamp; due timestamptz;
begin
  if not exists(select 1 from public.companies where id=p_company and report_alerts_enabled) then return; end if;
  select * into s from public.report_settings where company_id=p_company and user_id=p_user and enabled;
  if s.user_id is null or not exists(select 1 from public.company_members
    where company_id=p_company and user_id=s.responsible_id and role in ('hr','admin')) then return; end if;
  select * into w from public.work_models where company_id=p_company and user_id=p_user and valid_from<=p_day
    order by valid_from desc limit 1;
  if w.id is null or w.mode<>'scheduled' or w.planned_start is null or w.weekday_minutes[extract(isodow from p_day)::integer]=0 then return; end if;
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
    due:=least(due,end_local at time zone 'Europe/Zurich');
  end if;
  return query select 'missing'::text,due;
end;
$$;
revoke all on function public.report_condition(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.report_condition(uuid,uuid,date) to service_role;

create function public.require_absence_tracking() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.companies where id=new.company_id and absence_tracking)
    then raise exception 'Abwesenheitserfassung ist für diese Firma deaktiviert.'; end if;
  return new;
end;
$$;
revoke all on function public.require_absence_tracking() from public,anon,authenticated;
create trigger absence_tracking_enabled before insert on public.absences
for each row execute function public.require_absence_tracking();
