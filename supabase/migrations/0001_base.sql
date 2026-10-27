-- UNM Archery Club: base schema (accounts, members, sessions, bookings, passes).
-- Run once in the Supabase SQL editor. Every table has Row Level Security on,
-- and the website changes bookings and passes only through the functions below.

-- ---------------------------------------------------------------------------
-- Settings: one row holding every rule the exco can tune later.
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Kuala_Lumpur',
  single_price int not null default 5,
  fullday_price int not null default 12,
  session_days int[] not null default '{2,4}',          -- ISO weekday: 1 = Monday ... 7 = Sunday
  day_start time not null default '16:00',
  day_end time not null default '19:00',
  slot_minutes int not null default 60 check (slot_minutes between 15 and 240),
  capacity int not null default 20 check (capacity > 0),
  nonmember_cap_pct int not null default 25 check (nonmember_cap_pct between 0 and 100),
  booking_open_dow int not null default 1 check (booking_open_dow between 1 and 7),
  booking_open_time time not null default '09:00',
  nonmember_refund_hours int not null default 2,
  member_cancel_minutes int not null default 0,
  noshow_warn_after int not null default 2,
  noshow_ban_after int not null default 3,
  ban_days int not null default 14,
  membership_valid_until date,
  club_bows jsonb not null default '{"RH": [14, 18, 20, 22, 24], "LH": [12, 14, 22]}', -- draw weights offered at booking
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Members: synced from the membership Google Form. No direct client access.
-- ---------------------------------------------------------------------------
create table public.members (
  student_id text primary key check (student_id ~ '^[0-9]{8}$'),
  full_name text,
  email text,
  level text,
  experience text,
  synced_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles: one per signed-up student, created from the signup form.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  student_id text not null unique check (student_id ~ '^[0-9]{8}$'),
  full_name text not null,
  phone text,
  email text not null unique,
  member_override boolean not null default false,  -- exco confirmed membership when only the ID matched
  hand text not null default 'RH' check (hand in ('RH', 'LH')),
  draw_lbs text not null default 'Not sure',
  own_bow boolean not null default false,
  own_bow_type text,
  own_bow_lbs int check (own_bow_lbs between 5 and 80),
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Users created by hand in the dashboard have no student ID; skip them.
  if meta ->> 'student_id' is null then
    return new;
  end if;
  if (meta ->> 'student_id') !~ '^[0-9]{8}$' then
    raise exception 'INVALID_STUDENT_ID';
  end if;
  if lower(new.email) not like '%@nottingham.edu.my' then
    raise exception 'INVALID_EMAIL_DOMAIN';
  end if;
  insert into public.profiles (id, student_id, full_name, phone, email)
  values (new.id, meta ->> 'student_id', coalesce(meta ->> 'full_name', ''), meta ->> 'phone', lower(new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Permissions: switches the President (owner) turns on for other exco.
-- ---------------------------------------------------------------------------
create table public.permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null check (permission in (
    'owner', 'approve_topups', 'edit_settings', 'change_positions',
    'assign_duty', 'take_attendance', 'manage_sessions', 'manage_members', 'export_finance')),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (user_id, permission)
);

create function public.has_perm(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from permissions
    where user_id = auth.uid()
      and permission in ('owner', p_permission)
      and (expires_at is null or expires_at > now())
  );
$$;

-- ---------------------------------------------------------------------------
-- Slots, bookings and the pass ledger.
-- ---------------------------------------------------------------------------
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null unique,
  ends_at timestamptz not null,
  capacity_override int check (capacity_override > 0),
  cancelled_at timestamptz,
  cancelled_reason text,
  cancelled_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled', 'present', 'no_show')),
  pass_kind text not null check (pass_kind in ('member', 'single', 'full')),
  full_day_group uuid,
  is_member boolean not null,
  equipment jsonb not null default '{}'::jsonb,
  refunded boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index bookings_one_active_per_slot on public.bookings (slot_id, user_id) where status <> 'cancelled';
create index bookings_user_idx on public.bookings (user_id);
create index bookings_group_idx on public.bookings (full_day_group) where full_day_group is not null;

create table public.pass_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('single', 'full')),
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('topup', 'booking', 'refund', 'session_cancelled', 'adjust')),
  booking_id uuid references public.bookings (id) on delete set null,
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index pass_ledger_user_idx on public.pass_ledger (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 'member' (ID and email match the form, or exco confirmed), 'pending' (ID matches only), or 'none'.
create function public.membership_status(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when m.student_id is null then 'none'
    when s.membership_valid_until is not null and (now() at time zone s.timezone)::date > s.membership_valid_until then 'none'
    when lower(coalesce(m.email, '')) = p.email or p.member_override then 'member'
    else 'pending'
  end
  from profiles p
  cross join settings s
  left join members m on m.student_id = p.student_id
  where p.id = p_user;
$$;

create function public.pass_balance(p_user uuid, p_kind text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from pass_ledger where user_id = p_user and kind = p_kind;
$$;

-- When booking opens: every booking_open_dow at booking_open_time for the whole following week.
-- Returns the end of the bookable range and the moment the next week opens.
create function public.booking_window(out bookable_until timestamptz, out next_opens_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  cfg settings;
  now_local timestamp;
  week_start timestamp;
  opens_local timestamp;
begin
  select * into cfg from settings where id = 1;
  now_local := now() at time zone cfg.timezone;
  week_start := date_trunc('week', now_local);
  opens_local := week_start + (cfg.booking_open_dow - 1) * interval '1 day' + cfg.booking_open_time::interval;
  if now_local >= opens_local then
    bookable_until := (week_start + interval '14 days') at time zone cfg.timezone;
    next_opens_at := (opens_local + interval '7 days') at time zone cfg.timezone;
  else
    bookable_until := (week_start + interval '7 days') at time zone cfg.timezone;
    next_opens_at := opens_local at time zone cfg.timezone;
  end if;
end;
$$;

-- Creates this week's and next week's slots from the settings. A week that already
-- has slots is left alone, so schedule changes start from the next untouched week.
create function public.ensure_slots() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg settings;
  week_start date;
  w int;
  d int;
  t time;
  day_date date;
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
      t := cfg.day_start;
      while t + make_interval(mins => cfg.slot_minutes) <= cfg.day_end
            and t + make_interval(mins => cfg.slot_minutes) > t loop
        insert into slots (starts_at, ends_at)
        values ((day_date + t) at time zone cfg.timezone,
                (day_date + t + make_interval(mins => cfg.slot_minutes)) at time zone cfg.timezone)
        on conflict (starts_at) do nothing;
        t := t + make_interval(mins => cfg.slot_minutes);
      end loop;
    end loop;
  end loop;
end;
$$;

-- Everything the Sessions page needs, without revealing who booked.
create function public.slot_availability(p_from timestamptz, p_to timestamptz)
returns table (
  slot_id uuid, starts_at timestamptz, ends_at timestamptz, cancelled boolean, cancelled_reason text,
  capacity int, nonmember_cap int, booked int, nonmember_booked int,
  my_booking_id uuid, my_pass_kind text, my_group uuid
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.starts_at, s.ends_at, s.cancelled_at is not null, s.cancelled_reason,
    coalesce(s.capacity_override, cfg.capacity),
    floor(coalesce(s.capacity_override, cfg.capacity) * cfg.nonmember_cap_pct / 100.0)::int,
    (select count(*) from bookings b where b.slot_id = s.id and b.status <> 'cancelled')::int,
    (select count(*) from bookings b where b.slot_id = s.id and b.status <> 'cancelled' and not b.is_member)::int,
    mine.id, mine.pass_kind, mine.full_day_group
  from slots s
  cross join settings cfg
  left join bookings mine
    on mine.slot_id = s.id and mine.user_id = auth.uid() and mine.status <> 'cancelled'
  where s.starts_at >= p_from and s.starts_at < p_to
  order by s.starts_at;
$$;

-- Home page summary for the signed-in user.
create function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'membership', membership_status(p.id),
    'single', pass_balance(p.id, 'single'),
    'full', pass_balance(p.id, 'full'),
    'banned_until', p.banned_until,
    'noshows', (select count(*) from bookings b where b.user_id = p.id and b.status = 'no_show'),
    'is_exco', exists (select 1 from permissions x where x.user_id = p.id and (x.expires_at is null or x.expires_at > now()))
  )
  from profiles p where p.id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Booking and cancelling. Errors are short codes the website turns into messages.
-- ---------------------------------------------------------------------------
create function public.book_slot(p_slot uuid, p_pass text default null, p_equipment jsonb default '{}'::jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  prof profiles;
  cfg settings;
  target slots;
  member boolean;
  kind text;
  slot_ids uuid[];
  sid uuid;
  sl slots;
  cap int;
  nm_cap int;
  group_id uuid;
  first_booking uuid;
  new_id uuid;
  window_end timestamptz;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;

  -- Lock the profile so one person's parallel bookings cannot overspend passes.
  select * into prof from profiles where id = uid for update;
  if not found then raise exception 'NO_PROFILE'; end if;
  if prof.banned_until is not null and prof.banned_until > now() then raise exception 'BANNED'; end if;

  select * into cfg from settings where id = 1;
  select bookable_until into window_end from booking_window();

  select * into target from slots where id = p_slot for update;
  if not found then raise exception 'SLOT_NOT_FOUND'; end if;

  member := membership_status(uid) = 'member';
  if member then
    kind := 'member';
    slot_ids := array[p_slot];
  elsif p_pass = 'single' then
    kind := 'single';
    slot_ids := array[p_slot];
  elsif p_pass = 'full' then
    kind := 'full';
    select array_agg(id order by starts_at) into slot_ids
    from slots
    where (starts_at at time zone cfg.timezone)::date = (target.starts_at at time zone cfg.timezone)::date
      and cancelled_at is null;
    group_id := gen_random_uuid();
  else
    raise exception 'PASS_REQUIRED';
  end if;

  if kind <> 'member' and pass_balance(uid, kind) < 1 then raise exception 'NO_PASSES'; end if;

  foreach sid in array slot_ids loop
    select * into sl from slots where id = sid for update;
    if sl.cancelled_at is not null then raise exception 'SLOT_CANCELLED'; end if;
    if sl.starts_at <= now() then raise exception 'SLOT_STARTED'; end if;
    if sl.starts_at >= window_end then raise exception 'NOT_OPEN_YET'; end if;
    if exists (select 1 from bookings where slot_id = sid and user_id = uid and status <> 'cancelled') then
      raise exception 'ALREADY_BOOKED';
    end if;
    cap := coalesce(sl.capacity_override, cfg.capacity);
    nm_cap := floor(cap * cfg.nonmember_cap_pct / 100.0)::int;
    if (select count(*) from bookings where slot_id = sid and status <> 'cancelled') >= cap then
      raise exception 'SLOT_FULL';
    end if;
    if not member and (select count(*) from bookings where slot_id = sid and status <> 'cancelled' and not is_member) >= nm_cap then
      raise exception 'NONMEMBER_FULL';
    end if;

    insert into bookings (slot_id, user_id, pass_kind, full_day_group, is_member, equipment)
    values (sid, uid, kind, group_id, member, coalesce(p_equipment, '{}'::jsonb))
    returning id into new_id;
    first_booking := coalesce(first_booking, new_id);
  end loop;

  if kind <> 'member' then
    insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
    values (uid, kind, -1, 'booking', first_booking, uid);
  end if;

  return first_booking;
end;
$$;

-- Members cancel until the slot starts. Non-members get the pass back if they cancel
-- nonmember_refund_hours or more before. A full-day pass comes back only when the
-- whole day is cancelled in time; cancelling one slot of it frees the spot only.
create function public.cancel_booking(p_booking uuid, p_whole_day boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cfg settings;
  b bookings;
  sl slots;
  first_start timestamptz;
  in_time boolean;
  did_refund boolean := false;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into cfg from settings where id = 1;

  select * into b from bookings where id = p_booking for update;
  if not found or b.user_id <> uid then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status <> 'booked' then raise exception 'NOT_CANCELLABLE'; end if;
  select * into sl from slots where id = b.slot_id;
  if sl.starts_at <= now() + make_interval(mins => case when b.pass_kind = 'member' then cfg.member_cancel_minutes else 0 end) then
    raise exception 'ALREADY_STARTED';
  end if;

  if b.pass_kind = 'full' and p_whole_day then
    select min(s.starts_at) into first_start
    from bookings x join slots s on s.id = x.slot_id
    where x.full_day_group = b.full_day_group;
    in_time := now() <= first_start - make_interval(hours => cfg.nonmember_refund_hours);

    update bookings x set status = 'cancelled', cancelled_at = now()
    from slots s
    where s.id = x.slot_id and x.full_day_group = b.full_day_group
      and x.status = 'booked' and s.starts_at > now();

    if in_time and not exists (select 1 from bookings where full_day_group = b.full_day_group and refunded) then
      update bookings set refunded = true where full_day_group = b.full_day_group;
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (uid, 'full', 1, 'refund', b.id, uid);
      did_refund := true;
    end if;
  else
    update bookings set status = 'cancelled', cancelled_at = now() where id = b.id;
    if b.pass_kind = 'single' and now() <= sl.starts_at - make_interval(hours => cfg.nonmember_refund_hours) then
      update bookings set refunded = true where id = b.id;
      insert into pass_ledger (user_id, kind, delta, reason, booking_id, created_by)
      values (uid, 'single', 1, 'refund', b.id, uid);
      did_refund := true;
    end if;
  end if;

  return jsonb_build_object('refunded', did_refund);
end;
$$;

-- Saves the archer's equipment preferences (also stored on each booking).
create function public.save_my_gear(p_hand text, p_draw_lbs text, p_own_bow boolean, p_own_bow_type text, p_own_bow_lbs int)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  update profiles set
    hand = case when p_hand in ('RH', 'LH') then p_hand else hand end,
    draw_lbs = coalesce(nullif(p_draw_lbs, ''), draw_lbs),
    own_bow = coalesce(p_own_bow, false),
    own_bow_type = case when p_own_bow then p_own_bow_type else own_bow_type end,
    own_bow_lbs = case when p_own_bow then p_own_bow_lbs else own_bow_lbs end
  where id = auth.uid();
end;
$$;

-- Exco: add or remove passes by hand (used until the top-up page is built).
create function public.adjust_passes(p_student_id text, p_kind text, p_delta int, p_note text)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  target uuid;
begin
  if not has_perm('approve_topups') then raise exception 'NOT_ALLOWED'; end if;
  select id into target from profiles where student_id = p_student_id;
  if target is null then raise exception 'STUDENT_NOT_FOUND'; end if;
  insert into pass_ledger (user_id, kind, delta, reason, note, created_by)
  values (target, p_kind, p_delta, 'adjust', p_note, auth.uid());
  return pass_balance(target, p_kind);
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security and grants. Clients read only their own rows; every
-- change to bookings and passes goes through the functions above.
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.pass_ledger enable row level security;

revoke all on public.settings, public.members, public.profiles, public.permissions,
  public.slots, public.bookings, public.pass_ledger from anon, authenticated;

grant select on public.settings, public.slots to authenticated;
grant select on public.profiles, public.permissions, public.bookings, public.pass_ledger to authenticated;
grant update (phone) on public.profiles to authenticated;
grant update on public.settings to authenticated;

create policy "settings readable" on public.settings for select to authenticated using (true);
create policy "settings editable by permission" on public.settings for update to authenticated
  using (public.has_perm('edit_settings')) with check (public.has_perm('edit_settings'));
create policy "slots readable" on public.slots for select to authenticated using (true);
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile phone" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own permissions" on public.permissions for select to authenticated using (user_id = auth.uid());
create policy "own bookings" on public.bookings for select to authenticated using (user_id = auth.uid());
create policy "own passes" on public.pass_ledger for select to authenticated using (user_id = auth.uid());
-- members: RLS on with no policies, so only server code with the secret key can read or write it.

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.has_perm(text), public.booking_window(), public.ensure_slots(),
  public.slot_availability(timestamptz, timestamptz), public.my_status(),
  public.book_slot(uuid, text, jsonb), public.cancel_booking(uuid, boolean),
  public.save_my_gear(text, text, boolean, text, int), public.adjust_passes(text, text, int, text)
  to authenticated;
