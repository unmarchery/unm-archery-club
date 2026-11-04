-- UNM Archery Club: events on the landing page, and two new exco switches.
-- manage_events lets someone post events; manage_ranking (used from 0013) lets someone
-- run rank matches and skill tiers. Run once in the Supabase SQL editor, after 0010.

alter table public.permissions drop constraint permissions_permission_check;
alter table public.permissions add constraint permissions_permission_check check (permission in (
  'owner', 'approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
  'manage_sessions', 'manage_members', 'export_finance', 'write_notes', 'manage_shop',
  'manage_events', 'manage_ranking'));

create or replace function public.permission_label(p_permission text) returns text
language sql immutable set search_path = public as $$
  select case p_permission
    when 'owner' then 'President access (everything)'
    when 'manage_members' then 'Members and accounts'
    when 'approve_topups' then 'Approve top-ups'
    when 'export_finance' then 'Download finance'
    when 'edit_settings' then 'Settings'
    when 'change_positions' then 'Change positions'
    when 'assign_duty' then 'Duty roster'
    when 'take_attendance' then 'Attendance'
    when 'manage_sessions' then 'Sessions'
    when 'write_notes' then 'Write notes'
    when 'manage_shop' then 'Shop'
    when 'manage_events' then 'Events'
    when 'manage_ranking' then 'Ranking and tiers'
    else p_permission end;
$$;

create or replace function public.set_permission(p_user uuid, p_permission text, p_on boolean, p_until date default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  ends timestamptz := case when p_until is null then null
                           else (p_until + 1)::timestamp at time zone (select timezone from settings where id = 1) end;
begin
  if not can_manage_access() then raise exception 'NOT_ALLOWED'; end if;
  if p_permission = 'owner' then raise exception 'OWNER_LOCKED'; end if;
  if p_permission not in ('approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
                          'manage_sessions', 'manage_members', 'export_finance', 'write_notes', 'manage_shop',
                          'manage_events', 'manage_ranking') then
    raise exception 'NOT_ALLOWED';
  end if;
  if not has_perm(p_permission) then raise exception 'CANT_GIVE_MORE'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'STUDENT_NOT_FOUND'; end if;
  if p_until is not null and p_until < (now() at time zone (select timezone from settings where id = 1))::date then
    raise exception 'DATE_IN_PAST';
  end if;

  if p_on then
    insert into permissions (user_id, permission, granted_by, expires_at)
    values (p_user, p_permission, auth.uid(), ends)
    on conflict (user_id, permission) do update
      set granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at;
    perform log_activity(p_user, 'gave ' || permission_label(p_permission)
      || coalesce(' until ' || to_char(p_until, 'FMDD Mon YYYY'), ''));
  else
    delete from permissions where user_id = p_user and permission = p_permission;
    if found then perform log_activity(p_user, 'took away ' || permission_label(p_permission)); end if;
  end if;
end;
$$;

-- Events shown on the landing page. Anyone can read them, including visitors.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  time_label text check (char_length(time_label) <= 60),          -- e.g. "2–5pm" or "Every session"
  details text check (char_length(details) <= 300),
  audience text not null default 'all' check (audience in ('all', 'members')),
  featured boolean not null default false,                         -- shown big as "Happening now"
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index events_by_day on public.events (starts_on);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
create policy "events readable" on public.events for select to anon, authenticated using (true);

create function public.save_event(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  eid uuid := nullif(p->>'id', '')::uuid;
begin
  if not has_perm('manage_events') then raise exception 'NOT_ALLOWED'; end if;
  if eid is null then
    insert into events (title, starts_on, ends_on, time_label, details, audience, featured, created_by)
    values (trim(p->>'title'), (p->>'starts_on')::date, nullif(p->>'ends_on', '')::date, nullif(trim(p->>'time_label'), ''),
            nullif(trim(p->>'details'), ''), coalesce(p->>'audience', 'all'), coalesce((p->>'featured')::boolean, false), auth.uid())
    returning id into eid;
  else
    update events set title = trim(p->>'title'), starts_on = (p->>'starts_on')::date, ends_on = nullif(p->>'ends_on', '')::date,
      time_label = nullif(trim(p->>'time_label'), ''), details = nullif(trim(p->>'details'), ''),
      audience = coalesce(p->>'audience', 'all'), featured = coalesce((p->>'featured')::boolean, false)
    where id = eid;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return eid;
end;
$$;

create function public.delete_event(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('manage_events') then raise exception 'NOT_ALLOWED'; end if;
  delete from events where id = p_id;
end;
$$;

revoke execute on function public.save_event(jsonb), public.delete_event(uuid) from public, anon;
grant execute on function public.save_event(jsonb), public.delete_event(uuid) to authenticated;
