-- UNM Archery Club: QR check-in and "mark everyone present".
-- Duty shows a QR code for the day; members scan it and their own bookings that day turn present.
-- Run once in the Supabase SQL editor, after 0015_ranking.sql.

create table public.checkin_codes (
  day date primary key,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.checkin_codes enable row level security;
revoke all on public.checkin_codes from anon, authenticated;

-- The day's code for the QR poster, made the first time someone taking attendance asks.
create function public.checkin_code(p_day date) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  c text;
begin
  if not has_perm('take_attendance') then raise exception 'NOT_ALLOWED'; end if;
  select code into c from checkin_codes where day = p_day;
  if c is null then
    c := substr(md5(random()::text || clock_timestamp()::text || p_day::text), 1, 12);
    insert into checkin_codes (day, code) values (p_day, c) on conflict (day) do nothing;
    select code into c from checkin_codes where day = p_day;
  end if;
  return c;
end;
$$;

-- A member scans the code at the range: their bookings today are marked present.
create function public.check_in(p_day date, p_code text) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_day <> club_today() then raise exception 'NOT_TODAY'; end if;
  if not exists (select 1 from checkin_codes where day = p_day and code = p_code) then raise exception 'CHECKIN_INVALID'; end if;
  update bookings b set status = 'present'
  from slots s where s.id = b.slot_id and slot_day(s) = p_day and b.user_id = auth.uid() and b.status = 'booked';
  get diagnostics n = row_count;
  if n = 0 and not exists (select 1 from bookings b join slots s on s.id = b.slot_id
                           where slot_day(s) = p_day and b.user_id = auth.uid() and b.status = 'present') then
    raise exception 'NO_BOOKING_TODAY';
  end if;
  return n;
end;
$$;

-- Everyone still marked "booked" in a slot becomes present; change the no-shows after.
create function public.mark_all_present(p_slot uuid) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  if not has_perm('take_attendance') then raise exception 'NOT_ALLOWED'; end if;
  if not attendance_open((select slot_day(s) from slots s where s.id = p_slot)) then raise exception 'ATTENDANCE_LOCKED'; end if;
  update bookings set status = 'present' where slot_id = p_slot and status = 'booked';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.checkin_code(date), public.check_in(date, text), public.mark_all_present(uuid) from public, anon;
grant execute on function public.checkin_code(date), public.check_in(date, text), public.mark_all_present(uuid) to authenticated;
