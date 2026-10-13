alter table public.companies add column created_at timestamptz not null default now();
alter table public.subscriptions add column trial_ends_at timestamptz not null default now() + interval '14 days';

-- Single source of truth for commercial access. Mirrored by src/lib/access.ts.
create function public.company_access(p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when s.complimentary then 'complimentary'
      when s.stripe_subscription_id is not null and s.status in ('active','trialing','past_due') then 'active'
      when s.trial_ends_at > now() and (s.stripe_subscription_id is null or s.status in ('incomplete','incomplete_expired')) then 'trial'
      else 'locked'
    end from public.subscriptions s where s.company_id = p_company
  ), 'locked');
$$;
revoke all on function public.company_access(uuid) from public, anon, authenticated;
grant execute on function public.company_access(uuid) to service_role;

-- Locked companies stay readable and exportable but cannot record new data.
create function public.billing_write_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.company_access(new.company_id) = 'locked' then
    raise exception 'Testphase oder Abo beendet. Die Daten sind nur lesbar; bitte Abo aktivieren.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.billing_write_guard() from public, anon, authenticated;
create trigger billing_write_guard before insert or update on public.time_entries
for each row execute function public.billing_write_guard();
create trigger billing_write_guard before insert or update on public.absences
for each row execute function public.billing_write_guard();

-- Self-service signup. The hourly cap limits automated abuse of the public endpoint.
create function public.signup_company(p_name text, p_user uuid, p_admin_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.companies where created_at > now() - interval '1 hour') >= 30
    then raise exception 'Zu viele Registrierungen. Bitte später erneut versuchen.'; end if;
  return public.provision_company(p_name, p_user, p_admin_name);
end;
$$;
revoke all on function public.signup_company(text,uuid,text) from public, anon, authenticated;
grant execute on function public.signup_company(text,uuid,text) to service_role;
