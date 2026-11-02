-- UNM Archery Club: the rest of Phase 1.
-- Waitlist with automatic booking, cancelling sessions (weather) and closing dates, the
-- Settings page, an email queue (cancelled sessions, waitlist spots, evening reminders)
-- and a data export for the weekly backup.
-- Run once in the Supabase SQL editor, after 0007_duty.sql.

-- ---------------------------------------------------------------------------
-- Email queue. Database functions add rows; the website's server sends them right after
-- the action that caused them, and the evening job sends anything left over.
-- ---------------------------------------------------------------------------
create table public.outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('session_cancelled', 'waitlist_booked', 'reminder')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index outbox_unsent_idx on public.outbox (created_at) where sent_at is null;

create table public.closed_dates (
  day date primary key,
  reason text not null check (char_length(reason) between 1 and 120),
  closed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  equipment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);

alter table public.bookings add column reminded_at timestamptz;

alter table public.outbox enable row level security;
alter table public.closed_dates enable row level security;
alter table public.waitlist enable row level security;
revoke all on public.outbox, public.closed_dates, public.waitlist from anon, authenticated;
grant select on public.waitlist, public.closed_dates to authenticated;
create policy "own waitlist" on public.waitlist for select to authenticated using (user_id = auth.uid());
create policy "closed dates readable" on public.closed_dates for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Waitlist. Joining is for a full slot (or full non-member spots); a non-member needs a
-- single pass. When a spot opens, the first in line who can still take it is booked
-- automatically, until 1 hour before the slot.
-- ---------------------------------------------------------------------------
create function public.join_waitlist(p_slot uuid, p_equipment jsonb default '{}'::jsonb) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prof profiles;
  sl slots;
  cfg settings;
  cap int;
  member boolean;
  pos int;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into prof from profiles where id = uid;
  if prof.banned_until > now() then raise exception 'BANNED'; end if;
  select * into sl from slots where id = p_slot;
  if not found or sl.cancelled_at is not null then raise exception 'SLOT_NOT_FOUND'; end if;
  if sl.starts_at <= now() + interval '1 hour' then raise exception 'WAITLIST_CLOSED'; end if;
  if sl.starts_at >= (select bookable_until from booking_window()) then raise exception 'NOT_OPEN_YET'; end if;
  if exists (select 1 from bookings where slot_id = p_slot and user_id = uid and status <> 'cancelled') then
    raise exception 'ALREADY_BOOKED';
  end if;
  select * into cfg from settings where id = 1;
  cap := coalesce(sl.capacity_override, cfg.capacity);
  member := membership_status(uid) = 'member';
  if (select count(*) from bookings where slot_id = p_slot and status <> 'cancelled') < cap
     and (member or (select count(*) from bookings where slot_id = p_slot and status <> 'cancelled' and not is_member)
                    < floor(cap * cfg.nonmember_cap_pct / 100.0)::int) then
    raise exception 'SLOT_NOT_FULL';
  end if;
  if not member and pass_balance(uid, 'single') < 1 then raise exception 'NO_PASSES'; end if;
  insert into waitlist (slot_id, user_id, equipment) values (p_slot, uid, coalesce(p_equipment, '{}'::jsonb))
  on conflict (slot_id, user_id) do nothing;
  select count(*) into pos from waitlist w
  where w.slot_id = p_slot and w.created_at <= (select created_at from waitlist where slot_id = p_slot and user_id = uid);
  return pos;
end;
$$;

create function public.leave_waitlist(p_slot uuid) returns void
language sql volatile security definer set search_path = public as $$
  delete from waitlist where slot_id = p_slot and user_id = auth.uid();
$$;

create function public.promote_waitlist(p_slot uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  sl slots;
  cfg settings;
  cap int;
  nm_cap int;
  w waitlist;
  member boolean;
  new_id uuid;
begin
  select * into sl from slots where id = p_slot for update;
  if not found or sl.cancelled_at is not null or sl.starts_at <= now() + interval '1 hour' then return; end if;
  select * into cfg from settings where id = 1;
  cap := coalesce(sl.capacity_override, cfg.capacity);
  nm_cap := floor(cap * cfg.nonmember_cap_pct / 100.0)::int;

  for w in select * from waitlist where slot_id = p_slot order by created_at loop
    exit when (select count(*) from bookings where slot_id = p_slot and status <> 'cancelled') >= cap;
    if exists (select 1 from bookings where slot_id = p_slot and user_id = w.user_id and status <> 'cancelled')
       or exists (select 1 from profiles where id = w.user_id and banned_until > now()) then
      delete from waitlist where id = w.id;
      continue;
    end if;
    member := membership_status(w.user_id) = 'member';
    if not member then
      continue when (select count(*) from bookings where slot_id = p_slot and status <> 'cancelled' and not is_member) >= nm_cap;
      continue when pass_balance(w.user_id, 'single') < 1;
    end if;
    insert into bookings (slot_id, user_id, pass_kind, is_member, equipment)
    values (p_slot, w.user_id, case when member then 'member' else 'single' end, member, w.equipment)
    returning id into new_id;
    if not member then
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (w.user_id, 'single', -1, 'booking', new_id, w.user_id);
    end if;
    delete from waitlist where id = w.id;
    insert into outbox (user_id, kind, payload)
    values (w.user_id, 'waitlist_booked', jsonb_build_object('starts_at', sl.starts_at, 'ends_at', sl.ends_at, 'pass', not member));
  end loop;
end;
$$;

-- Any booking that becomes cancelled frees a spot for the waitlist.
create function public.bookings_cancelled_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform promote_waitlist(new.slot_id);
  return null;
end;
$$;
create trigger bookings_free_spot after update of status on public.bookings
  for each row when (new.status = 'cancelled' and old.status <> 'cancelled')
  execute function public.bookings_cancelled_trigger();

-- Sessions page data, now with the waitlist.
drop function public.slot_availability(timestamptz, timestamptz);
create function public.slot_availability(p_from timestamptz, p_to timestamptz)
returns table (
  slot_id uuid, starts_at timestamptz, ends_at timestamptz, cancelled boolean, cancelled_reason text,
  capacity int, nonmember_cap int, booked int, nonmember_booked int,
  my_booking_id uuid, my_pass_kind text, my_group uuid, waiting int, my_waitlist int
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.starts_at, s.ends_at, s.cancelled_at is not null, s.cancelled_reason,
    coalesce(s.capacity_override, cfg.capacity),
    floor(coalesce(s.capacity_override, cfg.capacity) * cfg.nonmember_cap_pct / 100.0)::int,
    (select count(*) from bookings b where b.slot_id = s.id and b.status <> 'cancelled')::int,
    (select count(*) from bookings b where b.slot_id = s.id and b.status <> 'cancelled' and not b.is_member)::int,
    mine.id, mine.pass_kind, mine.full_day_group,
    (select count(*) from waitlist w where w.slot_id = s.id)::int,
    (select count(*) from waitlist w, waitlist me
     where me.slot_id = s.id and me.user_id = auth.uid() and w.slot_id = s.id and w.created_at <= me.created_at)::int
  from slots s
  cross join settings cfg
  left join bookings mine
    on mine.slot_id = s.id and mine.user_id = auth.uid() and mine.status <> 'cancelled'
  where s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at;
$$;

-- ---------------------------------------------------------------------------
-- Cancelling sessions. Bookings not yet marked present are cancelled and everyone gets an
-- email. A single pass comes back. A full-day pass comes back whole when the club cancels
-- every slot of that day; otherwise each cancelled slot of it returns one single pass.
-- ---------------------------------------------------------------------------
create function public.cancel_slots_internal(p_slots uuid[], p_reason text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  b record;
  affected int := 0;
  sl slots;
begin
  update slots set cancelled_at = now(), cancelled_reason = p_reason, cancelled_by = auth.uid()
  where id = any(p_slots) and cancelled_at is null;
  delete from waitlist where slot_id = any(p_slots);

  for b in
    select x.*, s.starts_at, s.ends_at from bookings x join slots s on s.id = x.slot_id
    where x.slot_id = any(p_slots) and x.status = 'booked' order by s.starts_at
  loop
    update bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
    affected := affected + 1;
    if b.pass_kind = 'single' and not b.refunded then
      update bookings set refunded = true where id = b.id;
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (b.user_id, 'single', 1, 'session_cancelled', b.id, auth.uid());
    elsif b.pass_kind = 'full' and not (select refunded from bookings where id = b.id) then
      if not exists (select 1 from bookings x join slots s on s.id = x.slot_id
                     where x.full_day_group = b.full_day_group and s.cancelled_at is null)
         and not exists (select 1 from bookings where full_day_group = b.full_day_group and refunded) then
        -- The whole day is off and nothing was returned yet: the full-day pass comes back.
        update bookings set refunded = true where full_day_group = b.full_day_group;
        insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
        values (b.user_id, 'full', 1, 'session_cancelled', b.id, auth.uid());
      else
        -- Part of the day is off (or singles were already given): one single pass per slot.
        update bookings set refunded = true where id = b.id;
        insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
        values (b.user_id, 'single', 1, 'session_cancelled', b.id, auth.uid());
      end if;
    end if;
    insert into outbox (user_id, kind, payload)
    values (b.user_id, 'session_cancelled', jsonb_build_object('starts_at', b.starts_at, 'ends_at', b.ends_at,
            'reason', p_reason, 'refund', b.pass_kind <> 'member'));
  end loop;
  return affected;
end;
$$;

-- Weather: on the day, whoever is on duty, the President or the VP; any day with Sessions access.
create function public.can_cancel_day(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm('manage_sessions') or can_fix_attendance()
      or (p_day = club_today() and exists (select 1 from duty where day = p_day and user_id = auth.uid()));
$$;

-- Cancel one slot, or it and the rest of that day's slots that haven't ended.
create function public.cancel_sessions(p_slot uuid, p_rest_of_day boolean, p_reason text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  sl slots;
  why text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
  ids uuid[];
begin
  select * into sl from slots where id = p_slot;
  if not found or sl.cancelled_at is not null then raise exception 'SLOT_NOT_FOUND'; end if;
  if not can_cancel_day(slot_day(sl)) then raise exception 'NOT_ALLOWED'; end if;
  if why is null then raise exception 'REASON_REQUIRED'; end if;
  if sl.ends_at <= now() then raise exception 'SLOT_STARTED'; end if;
  select array_agg(id) into ids from slots s
  where s.cancelled_at is null and s.ends_at > now()
    and (s.id = p_slot or (p_rest_of_day and slot_day(s) = slot_day(sl) and s.starts_at >= sl.starts_at));
  perform log_activity(null, 'cancelled ' || array_length(ids, 1) || ' slot(s) on ' || to_char(slot_day(sl), 'FMDD Mon') || ': ' || why);
  return cancel_slots_internal(ids, why);
end;
$$;

-- Close a date ahead (exam week, holiday): its slots are cancelled now or as they're created.
create function public.close_date(p_day date, p_reason text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  why text := nullif(left(trim(coalesce(p_reason, '')), 120), '');
  ids uuid[];
begin
  if not (has_perm('manage_sessions') or can_fix_attendance()) then raise exception 'NOT_ALLOWED'; end if;
  if why is null then raise exception 'REASON_REQUIRED'; end if;
  if p_day < club_today() then raise exception 'DAY_PASSED'; end if;
  insert into closed_dates (day, reason, closed_by) values (p_day, why, auth.uid())
  on conflict (day) do update set reason = excluded.reason;
  perform log_activity(null, 'closed ' || to_char(p_day, 'FMDD Mon YYYY') || ': ' || why);
  select array_agg(s.id) into ids from slots s where s.cancelled_at is null and slot_day(s) = p_day and s.ends_at > now();
  if ids is null then return 0; end if;
  return cancel_slots_internal(ids, 'Closed: ' || why);
end;
$$;

-- Reopen a closed date: future slots that day open again (cancelled bookings stay cancelled).
create function public.reopen_date(p_day date) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not (has_perm('manage_sessions') or can_fix_attendance()) then raise exception 'NOT_ALLOWED'; end if;
  delete from closed_dates where day = p_day;
  if not found then raise exception 'NOT_TRAINING_DAY'; end if;
  update slots s set cancelled_at = null, cancelled_reason = null, cancelled_by = null
  where slot_day(s) = p_day and s.starts_at > now() and s.cancelled_reason like 'Closed: %';
  perform log_activity(null, 'reopened ' || to_char(p_day, 'FMDD Mon YYYY'));
end;
$$;

-- The next two weeks for the Sessions manager, with closed dates further ahead.
create function public.sessions_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not is_exco(auth.uid()) then null else jsonb_build_object(
    'can_close', has_perm('manage_sessions') or can_fix_attendance(),
    'today', club_today(),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day, 'can_cancel', can_cancel_day(d.day),
        'slots', (select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
                    'cancelled_reason', case when s.cancelled_at is not null then coalesce(s.cancelled_reason, 'Cancelled') end,
                    'booked', (select count(*) from bookings b where b.slot_id = s.id and b.status <> 'cancelled'),
                    'ended', s.ends_at <= now()
                  ) order by s.starts_at)
                  from slots s where slot_day(s) = d.day)
      ) order by d.day), '[]'::jsonb)
      from (select distinct slot_day(s) as day from slots s
            where slot_day(s) between club_today() and club_today() + 14) d),
    'closed', (select coalesce(jsonb_agg(jsonb_build_object('day', c.day, 'reason', c.reason) order by c.day), '[]'::jsonb)
               from closed_dates c where c.day >= club_today())
  ) end;
$$;

-- Same as 0001, except that slots on a closed date are created already cancelled.
create or replace function public.ensure_slots() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg settings;
  week_start date;
  w int;
  d int;
  t time;
  day_date date;
  closed text;
begin
  select * into cfg from settings where id = 1;
  week_start := date_trunc('week', now() at time zone cfg.timezone)::date;
  for w in 0..1 loop
    if exists (
      select 1 from slots
      where starts_at >= ((week_start + w * 7)::timestamp at time zone cfg.timezone)
        and starts_at < ((week_start + w * 7 + 7)::timestamp at time zone cfg.timezone)
    ) then
      continue;
    end if;
    foreach d in array cfg.session_days loop
      day_date := week_start + w * 7 + (d - 1);
      select reason into closed from closed_dates where day = day_date;
      t := cfg.day_start;
      while t + make_interval(mins => cfg.slot_minutes) <= cfg.day_end
            and t + make_interval(mins => cfg.slot_minutes) > t loop
        insert into slots (starts_at, ends_at, cancelled_at, cancelled_reason)
        values ((day_date + t) at time zone cfg.timezone,
                (day_date + t + make_interval(mins => cfg.slot_minutes)) at time zone cfg.timezone,
                case when closed is not null then now() end,
                case when closed is not null then 'Closed: ' || closed end)
        on conflict (starts_at) do nothing;
        t := t + make_interval(mins => cfg.slot_minutes);
      end loop;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings page. Each changed value is logged with its old and new value.
-- ---------------------------------------------------------------------------
create function public.update_settings(p jsonb) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  before jsonb;
  after_row jsonb;
  k text;
  keys text[] := array['single_price', 'fullday_price', 'session_days', 'day_start', 'day_end', 'slot_minutes',
    'capacity', 'nonmember_cap_pct', 'booking_open_dow', 'booking_open_time', 'nonmember_refund_hours',
    'member_cancel_minutes', 'noshow_warn_after', 'noshow_ban_after', 'ban_days', 'membership_valid_until',
    'club_bows', 'starter_password_days', 'duty_min_people', 'attendance_days', 'noshow_count_from'];
begin
  if not has_perm('edit_settings') then raise exception 'NOT_ALLOWED'; end if;
  select to_jsonb(s) into before from settings s where id = 1;
  update settings set
    single_price = coalesce((p->>'single_price')::int, single_price),
    fullday_price = coalesce((p->>'fullday_price')::int, fullday_price),
    session_days = coalesce((select array_agg(x::int order by x::int) from jsonb_array_elements_text(p->'session_days') x), session_days),
    day_start = coalesce((p->>'day_start')::time, day_start),
    day_end = coalesce((p->>'day_end')::time, day_end),
    slot_minutes = coalesce((p->>'slot_minutes')::int, slot_minutes),
    capacity = coalesce((p->>'capacity')::int, capacity),
    nonmember_cap_pct = coalesce((p->>'nonmember_cap_pct')::int, nonmember_cap_pct),
    booking_open_dow = coalesce((p->>'booking_open_dow')::int, booking_open_dow),
    booking_open_time = coalesce((p->>'booking_open_time')::time, booking_open_time),
    nonmember_refund_hours = coalesce((p->>'nonmember_refund_hours')::int, nonmember_refund_hours),
    member_cancel_minutes = coalesce((p->>'member_cancel_minutes')::int, member_cancel_minutes),
    noshow_warn_after = coalesce((p->>'noshow_warn_after')::int, noshow_warn_after),
    noshow_ban_after = coalesce((p->>'noshow_ban_after')::int, noshow_ban_after),
    ban_days = coalesce((p->>'ban_days')::int, ban_days),
    membership_valid_until = case when p ? 'membership_valid_until' then nullif(p->>'membership_valid_until', '')::date else membership_valid_until end,
    club_bows = coalesce(p->'club_bows', club_bows),
    starter_password_days = coalesce((p->>'starter_password_days')::int, starter_password_days),
    duty_min_people = coalesce((p->>'duty_min_people')::int, duty_min_people),
    attendance_days = coalesce((p->>'attendance_days')::int, attendance_days),
    noshow_count_from = case when p ? 'noshow_count_from' then nullif(p->>'noshow_count_from', '')::date else noshow_count_from end,
    updated_at = now(), updated_by = auth.uid()
  where id = 1;
  select to_jsonb(s) into after_row from settings s where id = 1;
  if (after_row->>'day_end')::time <= (after_row->>'day_start')::time then raise exception 'INVALID_SETTING'; end if;
  if (after_row->>'noshow_ban_after')::int <= (after_row->>'noshow_warn_after')::int then raise exception 'INVALID_SETTING'; end if;
  foreach k in array keys loop
    if before->k is distinct from after_row->k then
      perform log_activity(null, 'changed setting ' || k || ' from ' || coalesce(before->>k, 'empty') || ' to ' || coalesce(after_row->>k, 'empty'));
    end if;
  end loop;
exception
  when check_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'INVALID_SETTING';
end;
$$;

-- ---------------------------------------------------------------------------
-- Evening reminders and the email queue, for the website's server only.
-- ---------------------------------------------------------------------------
-- One reminder per archer for tomorrow's bookings, queued once.
create function public.queue_reminders() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  with due as (
    update bookings b set reminded_at = now()
    from slots s
    where s.id = b.slot_id and b.status = 'booked' and b.reminded_at is null and s.cancelled_at is null
      and slot_day(s) = club_today() + 1
    returning b.user_id, s.starts_at, s.ends_at
  ), grouped as (
    insert into outbox (user_id, kind, payload)
    select user_id, 'reminder', jsonb_build_object('slots', jsonb_agg(jsonb_build_object('starts_at', starts_at, 'ends_at', ends_at) order by starts_at))
    from due group by user_id
    returning 1
  )
  select count(*) into n from grouped;
  return n;
end;
$$;

create function public.outbox_pending(p_limit int default 100)
returns table (id uuid, kind text, payload jsonb, email text, full_name text)
language sql stable security definer set search_path = public as $$
  select o.id, o.kind, o.payload, p.email, p.full_name
  from outbox o join profiles p on p.id = o.user_id
  where o.sent_at is null and o.created_at > now() - interval '3 days'
  order by o.created_at limit p_limit;
$$;

create function public.outbox_done(p_ids uuid[]) returns void
language sql volatile security definer set search_path = public as $$
  update outbox set sent_at = now() where id = any(p_ids);
$$;

-- Everything in the club's tables, for the weekly backup. Login passwords are not here:
-- Supabase keeps those itself, and after a restore people set a new one.
create function public.backup_export() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from settings t),
    'members', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from members t),
    'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from profiles t),
    'permissions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from permissions t),
    'slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from slots t),
    'bookings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from bookings t),
    'pass_ledger', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from pass_ledger t),
    'member_requests', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from member_requests t),
    'topups', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from topups t),
    'receipt_deletions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from receipt_deletions t),
    'exco_notes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from exco_notes t),
    'activity_log', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from activity_log t),
    'duty', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from duty t),
    'walkins', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from walkins t),
    'waitlist', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from waitlist t),
    'closed_dates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from closed_dates t)
  );
$$;

revoke execute on function
  public.join_waitlist(uuid, jsonb), public.leave_waitlist(uuid), public.promote_waitlist(uuid),
  public.bookings_cancelled_trigger(), public.slot_availability(timestamptz, timestamptz),
  public.cancel_slots_internal(uuid[], text), public.can_cancel_day(date), public.cancel_sessions(uuid, boolean, text),
  public.close_date(date, text), public.reopen_date(date), public.sessions_overview(), public.update_settings(jsonb),
  public.queue_reminders(), public.outbox_pending(int), public.outbox_done(uuid[]), public.backup_export()
  from public, anon;
grant execute on function
  public.join_waitlist(uuid, jsonb), public.leave_waitlist(uuid), public.slot_availability(timestamptz, timestamptz),
  public.cancel_sessions(uuid, boolean, text), public.close_date(date, text), public.reopen_date(date),
  public.sessions_overview(), public.update_settings(jsonb), public.can_cancel_day(date)
  to authenticated;
revoke execute on function
  public.queue_reminders(), public.outbox_pending(int), public.outbox_done(uuid[]), public.backup_export()
  from authenticated;
grant execute on function
  public.queue_reminders(), public.outbox_pending(int), public.outbox_done(uuid[]), public.backup_export()
  to service_role;
