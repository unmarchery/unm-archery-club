-- UNM Archery Club: duty roster, attendance, walk-ins and the no-show rule.
-- The equipment team signs up for the training days they'll be on duty. On the day,
-- anyone with take_attendance ticks Present or No-show for each booking, up to
-- attendance_days after the session (after that only the President or VP can change it).
-- Unticked never counts as a no-show. The 2nd no-show brings a warning, the 3rd a ban,
-- and bookings during the ban are cancelled with their passes returned.
-- Run once in the Supabase SQL editor, after 0006_people.sql.

alter table public.settings
  add column duty_min_people int not null default 2 check (duty_min_people between 1 and 10),
  add column attendance_days int not null default 3 check (attendance_days between 0 and 14),
  add column noshow_count_from date;     -- start of the semester: earlier no-shows stop counting

alter table public.profiles add column noshows_since timestamptz;  -- set when a ban starts, so the count restarts
alter table public.bookings add column walk_in boolean not null default false;

create table public.duty (
  day date not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (day, user_id)
);

-- Walk-ins without an account: a name for the day's attendance, nothing else.
create table public.walkins (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.duty enable row level security;
alter table public.walkins enable row level security;
revoke all on public.duty, public.walkins from anon, authenticated;

create function public.club_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone (select timezone from settings where id = 1))::date;
$$;

create function public.slot_day(p_slot slots) returns date
language sql stable security definer set search_path = public as $$
  select (p_slot.starts_at at time zone (select timezone from settings where id = 1))::date;
$$;

create function public.is_training_day(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from slots s where s.cancelled_at is null and slot_day(s) = p_day);
$$;

-- No-shows that count: since the last ban and since the start of the semester.
create function public.noshow_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from bookings b join slots s on s.id = b.slot_id
  where b.user_id = p_user and b.status = 'no_show'
    and s.starts_at > coalesce((select noshows_since from profiles where id = p_user), '-infinity')
    and s.starts_at > coalesce((select noshow_count_from::timestamp at time zone timezone from settings where id = 1), '-infinity');
$$;

-- The President and VP fix attendance after the window and lift bans.
create function public.can_fix_attendance() returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm('owner') or exists (select 1 from profiles where id = auth.uid() and position = 'Vice President');
$$;

create function public.can_sign_duty() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and position in ('Equipment', 'Equipment Dept'));
$$;

-- The roster: every upcoming training day (today and the next two weeks) with who is on duty.
create function public.duty_roster() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_exco(auth.uid()) then null else jsonb_build_object(
    'can_sign', can_sign_duty(),
    'can_manage', has_perm('assign_duty'),
    'can_attend', has_perm('take_attendance'),
    'min_people', (select duty_min_people from settings where id = 1),
    'today', club_today(),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'people', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'position', p.position,
                                                                'me', p.id = auth.uid()) order by p.full_name), '[]'::jsonb)
                   from duty x join profiles p on p.id = x.user_id where x.day = d.day)
      ) order by d.day), '[]'::jsonb)
      from (select distinct slot_day(s) as day from slots s
            where s.cancelled_at is null and slot_day(s) between club_today() and club_today() + 14) d),
    'team', case when has_perm('assign_duty') then (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'position', p.position)
                                order by p.full_name), '[]'::jsonb)
      from profiles p where is_exco(p.id)) else '[]'::jsonb end
  ) end;
$$;

-- Equipment and Equipment Dept put themselves on (or off) duty for a training day.
create function public.set_my_duty(p_day date, p_on boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not can_sign_duty() then raise exception 'NOT_ALLOWED'; end if;
  if p_day < club_today() then raise exception 'DAY_PASSED'; end if;
  if not is_training_day(p_day) then raise exception 'NOT_TRAINING_DAY'; end if;
  if p_on then
    insert into duty (day, user_id, added_by) values (p_day, auth.uid(), auth.uid()) on conflict do nothing;
  else
    delete from duty where day = p_day and user_id = auth.uid();
  end if;
end;
$$;

-- Whoever has assign_duty adds or removes anyone on the exco.
create function public.set_duty(p_day date, p_user uuid, p_on boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('assign_duty') then raise exception 'NOT_ALLOWED'; end if;
  if p_day < club_today() then raise exception 'DAY_PASSED'; end if;
  if not is_training_day(p_day) then raise exception 'NOT_TRAINING_DAY'; end if;
  if not is_exco(p_user) then raise exception 'STUDENT_NOT_FOUND'; end if;
  if p_on then
    insert into duty (day, user_id, added_by) values (p_day, p_user, auth.uid()) on conflict do nothing;
  else
    delete from duty where day = p_day and user_id = p_user;
  end if;
end;
$$;

-- Can attendance for this day still be changed by the caller?
create function public.attendance_open(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm('take_attendance') and p_day <= club_today()
     and (can_fix_attendance() or p_day >= club_today() - (select attendance_days from settings where id = 1));
$$;

-- One day's attendance sheet: each slot with its bookings, walk-ins and gear.
create function public.attendance_day(p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not has_perm('take_attendance') then null else jsonb_build_object(
    'day', p_day,
    'open', attendance_open(p_day),
    'can_fix', can_fix_attendance(),
    'locked_after', p_day + (select attendance_days from settings where id = 1),
    'duty', (select coalesce(jsonb_agg(p.full_name order by p.full_name), '[]'::jsonb)
             from duty x join profiles p on p.id = x.user_id where x.day = p_day),
    'slots', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
        'bookings', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', b.id, 'full_name', p.full_name, 'student_id', p.student_id, 'is_member', b.is_member,
                       'pass_kind', b.pass_kind, 'equipment', b.equipment, 'status', b.status, 'walk_in', b.walk_in,
                       'user_id', p.id, 'noshows', noshow_count(p.id),
                       'banned_until', case when p.banned_until > now() then p.banned_until end
                     ) order by p.full_name), '[]'::jsonb)
                     from bookings b join profiles p on p.id = b.user_id
                     where b.slot_id = s.id and b.status <> 'cancelled'),
        'walkins', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'full_name', w.full_name) order by w.created_at), '[]'::jsonb)
                    from walkins w where w.slot_id = s.id)
      ) order by s.starts_at), '[]'::jsonb)
      from slots s where s.cancelled_at is null and slot_day(s) = p_day)
  ) end;
$$;

-- A ban: from now for ban_days. Bookings in that time are cancelled and their passes
-- come back, and the no-show count starts again.
create function public.apply_ban(p_user uuid) returns timestamptz
language plpgsql volatile security definer set search_path = public as $$
declare
  ends timestamptz := now() + make_interval(days => (select ban_days from settings where id = 1));
  b record;
begin
  update profiles set banned_until = ends, noshows_since = now() where id = p_user;
  for b in
    select x.* from bookings x join slots s on s.id = x.slot_id
    where x.user_id = p_user and x.status = 'booked' and s.starts_at > now() and s.starts_at < ends
  loop
    update bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
    if b.pass_kind = 'single' and not b.refunded then
      update bookings set refunded = true where id = b.id;
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (p_user, 'single', 1, 'refund', b.id, auth.uid());
    elsif b.pass_kind = 'full' and not exists (select 1 from bookings where full_day_group = b.full_day_group and refunded) then
      update bookings set refunded = true where full_day_group = b.full_day_group;
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (p_user, 'full', 1, 'refund', b.id, auth.uid());
    end if;
  end loop;
  return ends;
end;
$$;

-- Tick Present or No-show, or clear the tick ('booked'). Returns what the email to the
-- archer needs when this no-show brings a warning or a ban.
create function public.mark_attendance(p_booking uuid, p_status text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  b bookings;
  sl slots;
  cfg settings;
  n int;
  ends timestamptz;
begin
  if p_status not in ('present', 'no_show', 'booked') then raise exception 'NOT_ALLOWED'; end if;
  select * into b from bookings where id = p_booking for update;
  if not found or b.status = 'cancelled' then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into sl from slots where id = b.slot_id;
  if not attendance_open(slot_day(sl)) then raise exception 'ATTENDANCE_LOCKED'; end if;
  if b.walk_in and p_status <> 'present' then raise exception 'NOT_ALLOWED'; end if;
  if b.status = p_status then return null; end if;

  update bookings set status = p_status where id = b.id;
  if p_status <> 'no_show' then return null; end if;

  select * into cfg from settings where id = 1;
  n := noshow_count(b.user_id);
  if n >= cfg.noshow_ban_after then
    ends := apply_ban(b.user_id);
    perform log_activity(b.user_id, 'banned until ' || to_char(ends at time zone cfg.timezone, 'FMDD Mon') || ' after ' || n || ' no-shows');
  end if;
  return (select jsonb_build_object('email', p.email, 'full_name', p.full_name, 'noshows', n,
                                    'warned', n = cfg.noshow_warn_after and ends is null,
                                    'banned_until', ends, 'ban_after', cfg.noshow_ban_after)
          from profiles p where p.id = b.user_id);
end;
$$;

create function public.lift_ban(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not can_fix_attendance() then raise exception 'NOT_ALLOWED'; end if;
  update profiles set banned_until = null where id = p_user and banned_until > now();
  if found then perform log_activity(p_user, 'lifted the no-show ban'); end if;
end;
$$;

-- A walk-in with an account becomes a Present booking (a member's is free; a non-member
-- uses a single pass). Without an account, just the name is kept.
create function public.add_walkin(p_slot uuid, p_student_id text, p_name text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  sl slots;
  cfg settings;
  prof profiles;
  member boolean;
  cap int;
  new_id uuid;
begin
  select * into sl from slots where id = p_slot for update;
  if not found or sl.cancelled_at is not null then raise exception 'SLOT_NOT_FOUND'; end if;
  if not attendance_open(slot_day(sl)) then raise exception 'ATTENDANCE_LOCKED'; end if;

  if nullif(trim(coalesce(p_student_id, '')), '') is null then
    if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'NAME_REQUIRED'; end if;
    insert into walkins (slot_id, full_name, added_by) values (p_slot, left(trim(p_name), 80), auth.uid());
    return;
  end if;

  select * into prof from profiles where student_id = trim(p_student_id) for update;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if prof.banned_until > now() then raise exception 'WALKIN_BANNED'; end if;
  if exists (select 1 from bookings where slot_id = p_slot and user_id = prof.id and status <> 'cancelled') then
    raise exception 'ALREADY_BOOKED';
  end if;
  select * into cfg from settings where id = 1;
  cap := coalesce(sl.capacity_override, cfg.capacity);
  if (select count(*) from bookings where slot_id = p_slot and status <> 'cancelled') >= cap then raise exception 'SLOT_FULL'; end if;
  member := membership_status(prof.id) = 'member';
  if not member and pass_balance(prof.id, 'single') < 1 then raise exception 'WALKIN_NO_PASS'; end if;

  insert into bookings (slot_id, user_id, status, pass_kind, is_member, walk_in, equipment)
  values (p_slot, prof.id, 'present', case when member then 'member' else 'single' end, member, true,
          jsonb_build_object('hand', prof.hand, 'draw_lbs', prof.draw_lbs, 'own_bow', prof.own_bow,
                             'own_bow_type', prof.own_bow_type, 'own_bow_lbs', prof.own_bow_lbs))
  returning id into new_id;
  if not member then
    insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
    values (prof.id, 'single', -1, 'booking', new_id, auth.uid());
  end if;
end;
$$;

-- Undo a walk-in added by mistake: the name goes, or the booking is cancelled and the pass returned.
create function public.remove_walkin(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  w walkins;
  b bookings;
  sl slots;
begin
  select * into w from walkins where id = p_id;
  if found then
    select * into sl from slots where id = w.slot_id;
    if not attendance_open(slot_day(sl)) then raise exception 'ATTENDANCE_LOCKED'; end if;
    delete from walkins where id = p_id;
    return;
  end if;
  select * into b from bookings where id = p_id and walk_in and status <> 'cancelled' for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into sl from slots where id = b.slot_id;
  if not attendance_open(slot_day(sl)) then raise exception 'ATTENDANCE_LOCKED'; end if;
  update bookings set status = 'cancelled', cancelled_at = now(), refunded = (b.pass_kind = 'single') where id = b.id;
  if b.pass_kind = 'single' then
    insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
    values (b.user_id, 'single', 1, 'refund', b.id, auth.uid());
  end if;
end;
$$;

-- Same as 0006, with the no-show count that resets after a ban and each semester.
create or replace function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'membership', membership_status(p.id),
    'single', pass_balance(p.id, 'single'),
    'full', pass_balance(p.id, 'full'),
    'banned_until', p.banned_until,
    'noshows', noshow_count(p.id),
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
  public.club_today(), public.slot_day(slots), public.is_training_day(date), public.noshow_count(uuid),
  public.can_fix_attendance(), public.can_sign_duty(), public.duty_roster(), public.set_my_duty(date, boolean),
  public.set_duty(date, uuid, boolean), public.attendance_open(date), public.attendance_day(date),
  public.apply_ban(uuid), public.mark_attendance(uuid, text), public.lift_ban(uuid),
  public.add_walkin(uuid, text, text), public.remove_walkin(uuid)
  from public, anon;
grant execute on function
  public.club_today(), public.duty_roster(), public.set_my_duty(date, boolean), public.set_duty(date, uuid, boolean),
  public.attendance_day(date), public.mark_attendance(uuid, text), public.lift_ban(uuid),
  public.add_walkin(uuid, text, text), public.remove_walkin(uuid), public.my_status()
  to authenticated;
