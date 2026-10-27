-- UNM Archery Club: member check requests.
-- A student who shows as a non-member (their details don't match the membership form)
-- asks the exco to confirm them. Run once in the Supabase SQL editor, after 0001_base.sql.

create table public.member_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 300),           -- from the student, e.g. the email they used on the form
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text check (char_length(reason) <= 300),       -- from the exco when rejecting
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index member_requests_one_pending on public.member_requests (user_id) where status = 'pending';

alter table public.member_requests enable row level security;
revoke all on public.member_requests from anon, authenticated;
grant select on public.member_requests to authenticated;
create policy "own requests, or all for member managers" on public.member_requests for select to authenticated
  using (user_id = auth.uid() or public.has_perm('manage_members'));

create function public.request_member_check(p_note text default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if membership_status(uid) = 'member' then raise exception 'ALREADY_MEMBER'; end if;
  if exists (select 1 from member_requests where user_id = uid and status = 'pending') then
    raise exception 'REQUEST_PENDING';
  end if;
  insert into member_requests (user_id, note)
  values (uid, nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- Pending requests for the exco, with what the membership form says about each student ID.
create function public.member_requests_for_review()
returns table (
  request_id uuid, created_at timestamptz, note text,
  student_id text, full_name text, email text, phone text,
  on_form boolean, form_name text, form_email text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_perm('manage_members') then raise exception 'NOT_ALLOWED'; end if;
  return query
    select r.id, r.created_at, r.note,
           p.student_id, p.full_name, p.email, p.phone,
           m.student_id is not null, m.full_name, m.email
    from member_requests r
    join profiles p on p.id = r.user_id
    left join members m on m.student_id = p.student_id
    where r.status = 'pending'
    order by r.created_at;
end;
$$;

-- Approving makes the student a member, adding them to the member list if the form has
-- no row for their ID. Nobody can decide their own request.
create function public.decide_member_request(p_request uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  req member_requests;
  prof profiles;
begin
  if not has_perm('manage_members') then raise exception 'NOT_ALLOWED'; end if;
  select * into req from member_requests where id = p_request for update;
  if not found or req.status <> 'pending' then raise exception 'REQUEST_NOT_FOUND'; end if;
  if req.user_id = auth.uid() then raise exception 'OWN_REQUEST'; end if;
  select * into prof from profiles where id = req.user_id;

  update member_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reason = nullif(left(trim(coalesce(p_reason, '')), 300), ''),
      decided_by = auth.uid(),
      decided_at = now()
  where id = p_request;

  if p_approve then
    insert into members (student_id, full_name, email)
    values (prof.student_id, prof.full_name, prof.email)
    on conflict (student_id) do nothing;
    update profiles set member_override = true where id = prof.id;
  end if;
end;
$$;

-- Home and sidebar summary, now with the archer's permissions, their latest member
-- check request, and (for member managers) how many requests are waiting.
create or replace function public.my_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'membership', membership_status(p.id),
    'single', pass_balance(p.id, 'single'),
    'full', pass_balance(p.id, 'full'),
    'banned_until', p.banned_until,
    'noshows', (select count(*) from bookings b where b.user_id = p.id and b.status = 'no_show'),
    'is_exco', exists (select 1 from permissions x where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())),
    'perms', (select coalesce(jsonb_agg(x.permission), '[]'::jsonb) from permissions x
              where x.user_id = p.id and (x.expires_at is null or x.expires_at > now())),
    'request', (select jsonb_build_object('status', r.status, 'reason', r.reason)
                from member_requests r where r.user_id = p.id order by r.created_at desc limit 1),
    'pending_member_requests', case when has_perm('manage_members')
                                    then (select count(*) from member_requests where status = 'pending') else 0 end
  )
  from profiles p where p.id = auth.uid();
$$;

revoke execute on function
  public.request_member_check(text), public.member_requests_for_review(),
  public.decide_member_request(uuid, boolean, text)
  from public, anon;
grant execute on function
  public.request_member_check(text), public.member_requests_for_review(),
  public.decide_member_request(uuid, boolean, text), public.my_status()
  to authenticated;
