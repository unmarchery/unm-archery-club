-- UNM Archery Club: change the equipment on a booking (Book a session → Edit).
-- Run once in the Supabase SQL editor, after 0017.
--
-- Only the archer's own booking, while it is still booked and its slot hasn't started or been cancelled.
-- A day-pass booking shares one set-up, so the change applies to every hour of that day that hasn't
-- started yet. The website checks the equipment's shape before calling this (as it does for book_slot).
-- Returns how many bookings changed. Safe to run again (create or replace).
create or replace function public.update_booking_equipment(p_booking uuid, p_equipment jsonb)
returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b bookings;
  sl slots;
  n int;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_equipment is null or jsonb_typeof(p_equipment) <> 'object' then raise exception 'INVALID_EQUIPMENT'; end if;

  select * into b from bookings where id = p_booking for update;
  if not found or b.user_id <> uid then raise exception 'BOOKING_NOT_FOUND'; end if;
  if b.status <> 'booked' then raise exception 'NOT_EDITABLE'; end if;
  select * into sl from slots where id = b.slot_id;
  if sl.cancelled_at is not null then raise exception 'SLOT_CANCELLED'; end if;
  if sl.starts_at <= now() then raise exception 'ALREADY_STARTED'; end if;

  if b.full_day_group is not null then
    update bookings x set equipment = p_equipment
    from slots s
    where s.id = x.slot_id and x.full_day_group = b.full_day_group and x.user_id = uid
      and x.status = 'booked' and s.starts_at > now();
  else
    update bookings set equipment = p_equipment where id = b.id;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.update_booking_equipment(uuid, jsonb) from public, anon;
grant execute on function public.update_booking_equipment(uuid, jsonb) to authenticated;
