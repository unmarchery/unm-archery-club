-- UNM Archery Club: a picture for each event on the landing page.
-- Run once in the Supabase SQL editor, after 0016.
-- Pictures are public, so they live in the existing public "shop" bucket under e/ (no new bucket).
-- An event without a picture shows drawn art on the landing page instead.

alter table public.events add column if not exists image_path text
  check (image_path is null or (image_path like 'e/%' and char_length(image_path) <= 200));

-- Same as 0011, plus image_path: sent as a path to set it, as "" to remove it, or left out to keep it.
create or replace function public.save_event(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  eid uuid := nullif(p->>'id', '')::uuid;
begin
  if not has_perm('manage_events') then raise exception 'NOT_ALLOWED'; end if;
  if eid is null then
    insert into events (title, starts_on, ends_on, time_label, details, audience, featured, image_path, created_by)
    values (trim(p->>'title'), (p->>'starts_on')::date, nullif(p->>'ends_on', '')::date, nullif(trim(p->>'time_label'), ''),
            nullif(trim(p->>'details'), ''), coalesce(p->>'audience', 'all'), coalesce((p->>'featured')::boolean, false),
            nullif(p->>'image_path', ''), auth.uid())
    returning id into eid;
  else
    update events set title = trim(p->>'title'), starts_on = (p->>'starts_on')::date, ends_on = nullif(p->>'ends_on', '')::date,
      time_label = nullif(trim(p->>'time_label'), ''), details = nullif(trim(p->>'details'), ''),
      audience = coalesce(p->>'audience', 'all'), featured = coalesce((p->>'featured')::boolean, false),
      image_path = case when p ? 'image_path' then nullif(p->>'image_path', '') else image_path end
    where id = eid;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return eid;
end;
$$;

revoke execute on function public.save_event(jsonb) from public, anon;
grant execute on function public.save_event(jsonb) to authenticated;
