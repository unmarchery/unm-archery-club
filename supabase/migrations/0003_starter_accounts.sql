-- UNM Archery Club: starter accounts for members.
-- The exco can create accounts for everyone on the member list with a starter password
-- (first name + student ID). The archer must choose their own password at first login,
-- and a starter password stops working after starter_password_days.
-- Run once in the Supabase SQL editor, after 0002_member_requests.sql.

alter table public.profiles add column must_change_password boolean not null default false;
alter table public.settings add column starter_password_days int not null default 14 check (starter_password_days > 0);

-- Same as before, plus the must_change_password flag for accounts the exco creates.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
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
  insert into public.profiles (id, student_id, full_name, phone, email, must_change_password)
  values (new.id, meta ->> 'student_id', coalesce(meta ->> 'full_name', ''), meta ->> 'phone', lower(new.email),
          coalesce((meta ->> 'must_change_password')::boolean, false));
  return new;
end;
$$;

-- Called after the archer sets their own password.
create function public.password_changed() returns void
language sql volatile security definer set search_path = public as $$
  update profiles set must_change_password = false where id = auth.uid();
$$;

-- For the exco Accounts page: who on the member list has an account, who can get a
-- starter account (uni email on the form), and who can't (missing or non-uni email).
create function public.member_account_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_perm('manage_members') then raise exception 'NOT_ALLOWED'; end if;
  return (
    select jsonb_build_object(
      'total', count(*),
      'with_account', count(p.id),
      'ready', coalesce(jsonb_agg(jsonb_build_object('student_id', m.student_id, 'full_name', m.full_name, 'email', m.email))
                        filter (where p.id is null and lower(coalesce(m.email, '')) like '%@nottingham.edu.my'), '[]'::jsonb),
      'blocked', coalesce(jsonb_agg(jsonb_build_object('student_id', m.student_id, 'full_name', m.full_name, 'email', m.email))
                          filter (where p.id is null and lower(coalesce(m.email, '')) not like '%@nottingham.edu.my'), '[]'::jsonb)
    )
    from members m
    left join profiles p on p.student_id = m.student_id
  );
end;
$$;

revoke execute on function public.password_changed(), public.member_account_overview() from public, anon;
grant execute on function public.password_changed(), public.member_account_overview() to authenticated;
