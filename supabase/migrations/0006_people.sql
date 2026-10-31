-- UNM Archery Club: the Exco page (for every member) and the People page (for exco).
-- Exco cards show each person's position, what they handle and, only if they switch it
-- on, a WhatsApp button. The People page lets the President and the VP switch access on
-- and off from the website instead of the SQL editor, with every change logged.
-- Run once in the Supabase SQL editor, after 0005_topups.sql.

-- A new switch: who may write notes about exco on the People page.
alter table public.permissions drop constraint permissions_permission_check;
alter table public.permissions add constraint permissions_permission_check check (permission in (
  'owner', 'approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
  'manage_sessions', 'manage_members', 'export_finance', 'write_notes'));

alter table public.profiles
  add column handles text check (char_length(handles) <= 120),   -- "Payments and top-ups"
  add column whatsapp text check (whatsapp ~ '^[0-9]{9,15}$'),   -- digits with country code, e.g. 60123456789
  add column show_whatsapp boolean not null default false;       -- off until the person switches it on

create table public.exco_notes (
  id uuid primary key default gen_random_uuid(),
  about uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  written_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index exco_notes_about_idx on public.exco_notes (about, created_at desc);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id) on delete set null,
  target uuid references public.profiles (id) on delete set null,
  action text not null,           -- "gave Approve top-ups until 30 Jun 2027", "set position to Treasurer"
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

alter table public.exco_notes enable row level security;
alter table public.activity_log enable row level security;
revoke all on public.exco_notes, public.activity_log from anon, authenticated;

-- Someone counts as exco with a position or any access switched on.
create function public.is_exco(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and position is not null)
      or exists (select 1 from permissions where user_id = p_user and (expires_at is null or expires_at > now()));
$$;

-- The President (owner) and the VP switch access; only the owner touches President-level things.
create function public.can_manage_access() returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm('owner') or exists (select 1 from profiles where id = auth.uid() and position = 'Vice President');
$$;

create function public.log_activity(p_target uuid, p_action text) returns void
language sql volatile security definer set search_path = public as $$
  insert into activity_log (actor, target, action) values (auth.uid(), p_target, left(p_action, 300));
$$;

-- Readable labels for the switches, used in the log.
create function public.permission_label(p_permission text) returns text
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
    else p_permission end;
$$;

-- The Exco page, for every signed-in archer. A number appears only when its owner allows it.
create function public.exco_directory() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'position', p.position, 'handles', p.handles,
    'whatsapp', case when p.show_whatsapp or p.id = auth.uid() then p.whatsapp end,
    'show_whatsapp', p.show_whatsapp, 'me', p.id = auth.uid()
  ) order by array_position(array['President', 'Vice President', 'Secretary', 'Treasurer', 'Events', 'Marketing',
    'Equipment', 'Treasurer Dept', 'Events Dept', 'Marketing Dept', 'Equipment Dept'], p.position) nulls last, p.full_name), '[]'::jsonb)
  from profiles p
  where auth.uid() is not null and is_exco(p.id);
$$;

-- Exco edit their own card: their WhatsApp number and whether members can see it.
create function public.save_my_card(p_whatsapp text, p_show boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
begin
  if not is_exco(auth.uid()) then raise exception 'NOT_ALLOWED'; end if;
  if digits like '0%' then digits := '6' || digits; end if;   -- 012-345 6789 -> 60123456789
  if digits = '' then digits := null; end if;
  if digits is not null and digits !~ '^[0-9]{9,15}$' then raise exception 'INVALID_PHONE'; end if;
  if p_show and digits is null then raise exception 'INVALID_PHONE'; end if;
  update profiles set whatsapp = digits, show_whatsapp = coalesce(p_show, false) and digits is not null
  where id = auth.uid();
end;
$$;

-- The People page: every exco with their access, account status and notes, plus what the
-- caller may change. Anyone counted as exco can read it.
create function public.people_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_exco(auth.uid()) then null else jsonb_build_object(
    'can_access', can_manage_access(),
    'can_positions', has_perm('change_positions'),
    'can_notes', has_perm('write_notes'),
    'is_owner', has_perm('owner'),
    'my_perms', (select coalesce(jsonb_agg(permission), '[]'::jsonb) from permissions
                 where user_id = auth.uid() and (expires_at is null or expires_at > now())),
    'people', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'full_name', p.full_name, 'student_id', p.student_id, 'email', p.email,
        'position', p.position, 'handles', p.handles, 'me', p.id = auth.uid(),
        'last_sign_in_at', u.last_sign_in_at,
        'perms', (select coalesce(jsonb_agg(jsonb_build_object('permission', x.permission, 'expires_at', x.expires_at)
                                            order by x.permission), '[]'::jsonb)
                  from permissions x where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())),
        'notes', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at,
                                                               'by', name_with_position(n.written_by), 'mine', n.written_by = auth.uid())
                                            order by n.created_at desc), '[]'::jsonb)
                  from exco_notes n where n.about = p.id)
      ) order by array_position(array['President', 'Vice President', 'Secretary', 'Treasurer', 'Events', 'Marketing',
        'Equipment', 'Treasurer Dept', 'Events Dept', 'Marketing Dept', 'Equipment Dept'], p.position) nulls last, p.full_name), '[]'::jsonb)
      from profiles p left join auth.users u on u.id = p.id
      where is_exco(p.id)),
    'log', case when can_manage_access() then (
      select coalesce(jsonb_agg(jsonb_build_object('at', l.created_at, 'actor', name_with_position(l.actor),
                                                   'target', (select full_name from profiles where id = l.target), 'action', l.action)
                                order by l.created_at desc), '[]'::jsonb)
      from (select * from activity_log order by created_at desc limit 40) l) else '[]'::jsonb end
  ) end;
$$;

-- Switch one permission on (optionally until a date, Malaysia time, end of that day) or off.
-- The VP can only switch what they hold themselves. President access is never switched here,
-- and nobody switches off their own President access.
create function public.set_permission(p_user uuid, p_permission text, p_on boolean, p_until date default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  ends timestamptz := case when p_until is null then null
                           else (p_until + 1)::timestamp at time zone (select timezone from settings where id = 1) end;
begin
  if not can_manage_access() then raise exception 'NOT_ALLOWED'; end if;
  if p_permission = 'owner' then raise exception 'OWNER_LOCKED'; end if;
  if p_permission not in ('approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
                          'manage_sessions', 'manage_members', 'export_finance', 'write_notes') then
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

-- Set someone's position and "what they handle" line, or add them to the exco by student ID.
-- President, VP and Treasurer positions are set by the President only.
create function public.set_position(p_student_id text, p_position text, p_handles text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  target profiles;
  pos text := nullif(trim(coalesce(p_position, '')), '');
  what text := nullif(left(trim(coalesce(p_handles, '')), 120), '');
begin
  if not (has_perm('change_positions') or has_perm('owner')) then raise exception 'NOT_ALLOWED'; end if;
  select * into target from profiles where student_id = trim(p_student_id);
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if (pos in ('President', 'Vice President', 'Treasurer') or target.position in ('President', 'Vice President', 'Treasurer'))
     and pos is distinct from target.position and not has_perm('owner') then
    raise exception 'OFFICER_POSITION';
  end if;

  update profiles set position = pos, handles = what where id = target.id;
  if pos is distinct from target.position then
    perform log_activity(target.id, coalesce('set position to ' || pos, 'removed position ' || target.position));
  end if;
  return target.id;
exception
  when unique_violation then raise exception 'POSITION_TAKEN';
  when check_violation then raise exception 'INVALID_POSITION';
end;
$$;

-- Take someone off the exco: clear their position and switch off all their access.
-- President access stays (it is handed over separately).
create function public.remove_from_exco(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  target profiles;
begin
  if not can_manage_access() then raise exception 'NOT_ALLOWED'; end if;
  select * into target from profiles where id = p_user;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if exists (select 1 from permissions where user_id = p_user and permission = 'owner') then raise exception 'OWNER_LOCKED'; end if;
  if target.position in ('President', 'Vice President', 'Treasurer') and not has_perm('owner') then
    raise exception 'OFFICER_POSITION';
  end if;
  delete from permissions where user_id = p_user;
  update profiles set position = null, handles = null, show_whatsapp = false where id = p_user;
  perform log_activity(p_user, 'removed from the exco');
end;
$$;

create function public.add_exco_note(p_about uuid, p_body text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  body text := nullif(left(trim(coalesce(p_body, '')), 1000), '');
begin
  if not has_perm('write_notes') then raise exception 'NOT_ALLOWED'; end if;
  if body is null then raise exception 'NOTE_EMPTY'; end if;
  if not is_exco(p_about) then raise exception 'STUDENT_NOT_FOUND'; end if;
  insert into exco_notes (about, body, written_by) values (p_about, body, auth.uid());
end;
$$;

-- Writers delete their own notes; the President can delete any.
create function public.delete_exco_note(p_note uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from exco_notes where id = p_note and (written_by = auth.uid() or has_perm('owner'));
  if not found then raise exception 'NOT_ALLOWED'; end if;
end;
$$;

-- Same as 0005, except that a position alone also counts as exco.
create or replace function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'membership', membership_status(p.id),
    'single', pass_balance(p.id, 'single'),
    'full', pass_balance(p.id, 'full'),
    'banned_until', p.banned_until,
    'noshows', (select count(*) from bookings b where b.user_id = p.id and b.status = 'no_show'),
    'is_exco', is_exco(p.id),
    'perms', (select coalesce(jsonb_agg(x.permission), '[]'::jsonb) from permissions x
              where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())),
    'request', (select jsonb_build_object('status', r.status, 'reason', r.reason)
                from member_requests r where r.user_id = p.id order by r.created_at desc limit 1),
    'pending_member_requests', case when has_perm('manage_members')
                                    then (select count(*) from member_requests where status = 'pending') else 0 end,
    'pending_topups', case when has_perm('approve_topups')
                           then (select count(*) from topups where status = 'pending') else 0 end,
    'position', p.position
  )
  from profiles p where p.id = auth.uid();
$$;

revoke execute on function
  public.is_exco(uuid), public.can_manage_access(), public.log_activity(uuid, text), public.permission_label(text),
  public.exco_directory(), public.save_my_card(text, boolean), public.people_overview(),
  public.set_permission(uuid, text, boolean, date), public.set_position(text, text, text),
  public.remove_from_exco(uuid), public.add_exco_note(uuid, text), public.delete_exco_note(uuid)
  from public, anon;
grant execute on function
  public.exco_directory(), public.save_my_card(text, boolean), public.people_overview(),
  public.set_permission(uuid, text, boolean, date), public.set_position(text, text, text),
  public.remove_from_exco(uuid), public.add_exco_note(uuid, text), public.delete_exco_note(uuid),
  public.my_status()
  to authenticated;
