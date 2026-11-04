-- UNM Archery Club: usernames, bios and Instagram on profiles.
-- Run once in the Supabase SQL editor, after 0011_events.sql.

alter table public.profiles
  add column username text unique check (username ~ '^[a-z0-9._]{3,20}$'),
  add column bio text check (char_length(bio) <= 160),
  add column instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- New sign-ups can choose a username; it is saved lower-case.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text := nullif(lower(trim(meta ->> 'username')), '');
begin
  if meta ->> 'student_id' is null then
    return new;
  end if;
  if (meta ->> 'student_id') !~ '^[0-9]{8}$' then
    raise exception 'INVALID_STUDENT_ID';
  end if;
  if lower(new.email) not like '%@nottingham.edu.my' then
    raise exception 'INVALID_EMAIL_DOMAIN';
  end if;
  if uname is not null and exists (select 1 from profiles where username = uname) then
    raise exception 'USERNAME_TAKEN';
  end if;
  insert into public.profiles (id, student_id, full_name, phone, email, must_change_password, username)
  values (new.id, meta ->> 'student_id', coalesce(meta ->> 'full_name', ''), meta ->> 'phone', lower(new.email),
          coalesce((meta ->> 'must_change_password')::boolean, false), uname);
  return new;
end;
$$;

-- Edit your own username, bio and Instagram from the profile page.
create function public.save_my_profile(p_username text, p_bio text, p_instagram text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uname text := nullif(lower(trim(p_username)), '');
  ig text := nullif(trim(both '@' from trim(coalesce(p_instagram, ''))), '');
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if uname is not null and uname !~ '^[a-z0-9._]{3,20}$' then raise exception 'INVALID_USERNAME'; end if;
  if ig is not null and ig !~ '^[A-Za-z0-9._]{1,30}$' then raise exception 'INVALID_INSTAGRAM'; end if;
  if char_length(coalesce(p_bio, '')) > 160 then raise exception 'BIO_TOO_LONG'; end if;
  if uname is not null and exists (select 1 from profiles where username = uname and id <> auth.uid()) then
    raise exception 'USERNAME_TAKEN';
  end if;
  update profiles set username = uname, bio = nullif(trim(p_bio), ''), instagram = ig where id = auth.uid();
end;
$$;

revoke execute on function public.save_my_profile(text, text, text) from public, anon;
grant execute on function public.save_my_profile(text, text, text) to authenticated;
