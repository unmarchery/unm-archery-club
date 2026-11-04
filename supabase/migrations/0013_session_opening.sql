-- UNM Archery Club: the exco opens, schedules or locks each training day for booking.
-- A day with no choice follows the old rule (each Monday at the opening time opens this
-- week and next). Run once in the Supabase SQL editor, after 0012_profiles.sql.

create table public.session_openings (
  day date primary key,
  status text not null check (status in ('open', 'scheduled', 'locked')),
  opens_at timestamptz check (status <> 'scheduled' or opens_at is not null),
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now()
);
alter table public.session_openings enable row level security;
revoke all on public.session_openings from anon, authenticated;
grant select on public.session_openings to authenticated;
create policy "openings readable" on public.session_openings for select to authenticated using (true);

-- The old weekly rule, kept for days the exco hasn't set.
create function public.weekly_window_end() returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  cfg settings;
  now_local timestamp;
  week_start timestamp;
begin
  select * into cfg from settings where id = 1;
  now_local := now() at time zone cfg.timezone;
  week_start := date_trunc('week', now_local);
  if now_local >= week_start + (cfg.booking_open_dow - 1) * interval '1 day' + cfg.booking_open_time::interval then
    return (week_start + interval '14 days') at time zone cfg.timezone;
  end if;
  return (week_start + interval '7 days') at time zone cfg.timezone;
end;
$$;

-- Is this training day open for booking right now?
create function public.day_open(p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when o.status = 'open' then true
    when o.status = 'scheduled' then now() >= o.opens_at
    when o.status = 'locked' then false
    else (p_day::timestamp at time zone (select timezone from settings where id = 1)) < weekly_window_end()
  end
  from (select 1) one left join session_openings o on o.day = p_day;
$$;

-- book_slot and join_waitlist compare against booking_window(); widen it so the per-day
-- rule below decides instead. next_opens_at keeps its meaning for the weekly rule.
create or replace function public.booking_window(out bookable_until timestamptz, out next_opens_at timestamptz)
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
  bookable_until := (week_start + interval '28 days') at time zone cfg.timezone;
  next_opens_at := (case when now_local >= opens_local then opens_local + interval '7 days' else opens_local end) at time zone cfg.timezone;
end;
$$;

-- Every booking or waitlist place someone makes for themselves must be on an open day.
-- Exco walk-ins and waitlist promotions (made for someone else) are exempt.
create function public.check_day_open() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d date;
begin
  if tg_table_name = 'bookings' then
    if new.walk_in then return new; end if;
  end if;
  if new.user_id is distinct from auth.uid() then return new; end if;
  select slot_day(s) into d from slots s where s.id = new.slot_id;
  if d is not null and not day_open(d) then raise exception 'NOT_OPEN_YET'; end if;
  return new;
end;
$$;
create trigger bookings_day_open before insert on public.bookings for each row execute function public.check_day_open();
create trigger waitlist_day_open before insert on public.waitlist for each row execute function public.check_day_open();

-- Exco with the Sessions switch choose: open now, open at a set time, or lock. Clearing goes back to the weekly rule.
create function public.set_session_opening(p_day date, p_status text, p_opens_at timestamptz default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('manage_sessions') then raise exception 'NOT_ALLOWED'; end if;
  if p_status is null or p_status = 'weekly' then
    delete from session_openings where day = p_day;
    return;
  end if;
  if p_status not in ('open', 'scheduled', 'locked') then raise exception 'INVALID_SETTING'; end if;
  if p_status = 'scheduled' and (p_opens_at is null or p_opens_at <= now()) then raise exception 'DATE_IN_PAST'; end if;
  insert into session_openings (day, status, opens_at, set_by)
  values (p_day, p_status, case when p_status = 'scheduled' then p_opens_at end, auth.uid())
  on conflict (day) do update set status = excluded.status, opens_at = excluded.opens_at, set_by = excluded.set_by, set_at = now();
end;
$$;

-- For the booking page: each training day's state and, if it isn't open, when it opens.
create function public.day_openings(p_from date, p_to date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', d, 'open', day_open(d),
    'status', coalesce(o.status, 'weekly'),
    'opens_at', case when o.status = 'scheduled' then o.opens_at
                     when o.status is null and not day_open(d) then (select next_opens_at from booking_window()) end
  ) order by d), '[]'::jsonb)
  from (select distinct slot_day(s) as d from slots s where slot_day(s) between p_from and p_to) days
  left join session_openings o on o.day = days.d;
$$;

-- Make slots three weeks ahead, so the exco can open a day up to two weeks early.
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
  for w in 0..2 loop
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

revoke execute on function public.weekly_window_end(), public.day_open(date), public.check_day_open(),
  public.set_session_opening(date, text, timestamptz), public.day_openings(date, date) from public, anon;
grant execute on function public.day_open(date), public.set_session_opening(date, text, timestamptz),
  public.day_openings(date, date) to authenticated;
