-- UNM Archery Club: top-ups, finance, exco positions and receipt deletion.
-- Non-members choose how many single and full-day passes they want and pay by DuitNow QR
-- (uploading the receipt) or cash. Nothing is credited until someone with approve_topups
-- checks the payment and approves it, and every decision records who made it and when.
-- Receipts are kept until the Treasurer and the President or VP both agree to delete one.
-- Run once in the Supabase SQL editor, after 0004_server_grants.sql.

-- Exco positions, from the committee list. A position says who someone is (and who must
-- agree to delete a receipt); permissions still decide which pages they can open.
alter table public.profiles add column position text check (position in (
  'President', 'Vice President', 'Secretary', 'Treasurer', 'Events', 'Marketing', 'Equipment',
  'Treasurer Dept', 'Events Dept', 'Marketing Dept', 'Equipment Dept'));
create unique index profiles_one_officer on public.profiles (position)
  where position in ('President', 'Vice President', 'Treasurer');

-- "Lee Lit Hang (President)", for showing who approved or asked for something.
create function public.name_with_position(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select full_name || coalesce(' (' || position || ')', '') from profiles where id = p_user;
$$;

alter table public.settings
  add column payment_qr_path text,        -- the club's DuitNow QR, in the private receipts bucket
  add column payment_whatsapp_link text;  -- finance WhatsApp group, shown to people paying cash

create table public.topups (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,   -- shown as "Top-up #12"
  user_id uuid not null references public.profiles (id) on delete cascade,
  single_qty int not null check (single_qty between 0 and 20),
  full_qty int not null check (full_qty between 0 and 20),
  amount int not null check (amount >= 0),             -- RM, from the prices when it was requested
  method text not null check (method in ('qr', 'cash')),
  bank_ref text check (char_length(bank_ref) <= 40),   -- transaction reference from the banking app
  receipt_path text,                                   -- receipts bucket, under the archer's own folder
  receipt_deleted_at timestamptz,                      -- set when the officers agree to delete it
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text check (char_length(reason) <= 300),      -- from the approver; required when rejecting
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (single_qty + full_qty > 0),
  check (method = 'cash' or bank_ref is not null),
  check (method = 'cash' or receipt_path is not null or receipt_deleted_at is not null)
);
create index topups_user_idx on public.topups (user_id, created_at desc);
create index topups_status_idx on public.topups (status, created_at);
-- A bank reference counts once, so the same receipt can't be sent twice. A rejected or
-- cancelled request frees it, so the archer can send it again with the right details.
create unique index topups_bank_ref_once on public.topups (upper(bank_ref))
  where status in ('pending', 'approved');

alter table public.pass_ledger add column topup_id uuid references public.topups (id) on delete set null;

alter table public.topups enable row level security;
revoke all on public.topups from anon, authenticated;
grant select on public.topups to authenticated;
create policy "own top-ups" on public.topups for select to authenticated using (user_id = auth.uid());

-- Receipts and the payment QR live in a private bucket. There are no storage policies, so
-- only the website's server (secret key) can read or write it, after checking permissions.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('receipts', 'receipts', false, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

create function public.normalize_bank_ref(p_ref text) returns text
language sql immutable set search_path = public as $$
  select nullif(upper(regexp_replace(coalesce(p_ref, ''), '\s', '', 'g')), '');
$$;

create function public.request_topup(
  p_single int, p_full int, p_method text, p_bank_ref text default null, p_receipt_path text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s settings;
  ref text := normalize_bank_ref(p_bank_ref);
  created topups;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if membership_status(uid) = 'member' then raise exception 'MEMBERS_FREE'; end if;
  if p_method not in ('qr', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if coalesce(p_single, 0) not between 0 and 20 or coalesce(p_full, 0) not between 0 and 20
     or coalesce(p_single, 0) + coalesce(p_full, 0) = 0 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if p_method = 'qr' then
    if ref is null or char_length(ref) < 4 or char_length(ref) > 40 then raise exception 'BANK_REF_REQUIRED'; end if;
    if p_receipt_path is null or p_receipt_path not like uid::text || '/%' then raise exception 'RECEIPT_REQUIRED'; end if;
    if exists (select 1 from topups where upper(bank_ref) = ref and status in ('pending', 'approved')) then
      raise exception 'BANK_REF_USED';
    end if;
  end if;
  if (select count(*) from topups where user_id = uid and status = 'pending') >= 3 then
    raise exception 'TOO_MANY_PENDING';
  end if;

  select * into s from settings where id = 1;
  insert into topups (user_id, single_qty, full_qty, amount, method, bank_ref, receipt_path)
  values (uid, coalesce(p_single, 0), coalesce(p_full, 0),
          coalesce(p_single, 0) * s.single_price + coalesce(p_full, 0) * s.fullday_price,
          p_method,
          case when p_method = 'qr' then ref end,
          case when p_method = 'qr' then p_receipt_path end)
  returning * into created;
  return (select jsonb_build_object('id', created.id, 'number', created.number, 'amount', created.amount,
                                    'full_name', p.full_name, 'student_id', p.student_id)
          from profiles p where p.id = uid);
exception
  when unique_violation then raise exception 'BANK_REF_USED';
end;
$$;

create function public.cancel_topup(p_topup uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update topups set status = 'cancelled'
  where id = p_topup and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'TOPUP_NOT_FOUND'; end if;
end;
$$;

-- The approval queue: everything waiting, plus the last 30 days of decisions.
create function public.topups_for_review() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_perm('approve_topups') then raise exception 'NOT_ALLOWED'; end if;
  return jsonb_build_object(
    'pending', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'number', t.number, 'created_at', t.created_at,
        'student_id', p.student_id, 'full_name', p.full_name,
        'single_qty', t.single_qty, 'full_qty', t.full_qty, 'amount', t.amount,
        'method', t.method, 'bank_ref', t.bank_ref, 'receipt_path', t.receipt_path,
        'mine', t.user_id = auth.uid()
      ) order by t.created_at), '[]'::jsonb)
      from topups t join profiles p on p.id = t.user_id
      where t.status = 'pending'),
    'recent', (
      select coalesce(jsonb_agg(r order by r.decided_at desc), '[]'::jsonb)
      from (
        select t.id, t.number, t.decided_at, t.status, t.reason, t.amount, t.method,
               t.single_qty, t.full_qty, p.student_id, p.full_name, name_with_position(t.decided_by) as decided_by,
               t.receipt_path, t.receipt_deleted_at is not null as receipt_deleted,
               exists (select 1 from receipt_deletions r where r.topup_id = t.id and r.status = 'pending'
                       and r.created_at > now() - interval '14 days') as delete_requested
        from topups t
        join profiles p on p.id = t.user_id
        where t.status in ('approved', 'rejected') and t.decided_at > now() - interval '30 days'
        order by t.decided_at desc
        limit 30
      ) r)
  );
end;
$$;

-- Approving credits the passes from the request itself, so nobody types a number in.
-- Rejecting needs a reason, which the archer sees. Nobody decides their own top-up.
-- Returns what the archer's email needs.
create function public.decide_topup(p_topup uuid, p_approve boolean, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  t topups;
  why text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if not has_perm('approve_topups') then raise exception 'NOT_ALLOWED'; end if;
  select * into t from topups where id = p_topup for update;
  if not found or t.status <> 'pending' then raise exception 'TOPUP_NOT_FOUND'; end if;
  if t.user_id = auth.uid() then raise exception 'OWN_REQUEST'; end if;
  if not p_approve and why is null then raise exception 'REASON_REQUIRED'; end if;

  update topups
  set status = case when p_approve then 'approved' else 'rejected' end,
      reason = why, decided_by = auth.uid(), decided_at = now()
  where id = p_topup;

  if p_approve then
    if t.single_qty > 0 then
      insert into pass_ledger (user_id, kind, delta, reason, note, created_by, topup_id)
      values (t.user_id, 'single', t.single_qty, 'topup', 'Top-up #' || t.number, auth.uid(), t.id);
    end if;
    if t.full_qty > 0 then
      insert into pass_ledger (user_id, kind, delta, reason, note, created_by, topup_id)
      values (t.user_id, 'full', t.full_qty, 'topup', 'Top-up #' || t.number, auth.uid(), t.id);
    end if;
  end if;
  return (select jsonb_build_object('email', p.email, 'full_name', p.full_name, 'number', t.number,
                                    'amount', t.amount, 'single_qty', t.single_qty, 'full_qty', t.full_qty,
                                    'approved', p_approve, 'reason', why)
          from profiles p where p.id = t.user_id);
end;
$$;

-- Finance history: approved top-ups between two dates (Malaysia time, both included),
-- the totals, and the passes sold but not used yet, which the club still owes.
create function public.finance_report(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s settings;
  start_at timestamptz;
  end_at timestamptz;
begin
  if not (has_perm('export_finance') or has_perm('approve_topups')) then raise exception 'NOT_ALLOWED'; end if;
  select * into s from settings where id = 1;
  start_at := p_from::timestamp at time zone s.timezone;
  end_at := (p_to + 1)::timestamp at time zone s.timezone;
  return (
    with rows as (
      select t.id, t.number, t.created_at, t.decided_at, p.student_id, p.full_name,
             t.single_qty, t.full_qty, t.amount, t.method, t.bank_ref, name_with_position(t.decided_by) as approved_by,
             t.receipt_path, t.receipt_deleted_at is not null as receipt_deleted,
             exists (select 1 from receipt_deletions r where r.topup_id = t.id and r.status = 'pending'
                     and r.created_at > now() - interval '14 days') as delete_requested
      from topups t
      join profiles p on p.id = t.user_id
      where t.status = 'approved' and t.decided_at >= start_at and t.decided_at < end_at
    ),
    owed as (
      select coalesce(sum(delta) filter (where kind = 'single'), 0)::int as single_left,
             coalesce(sum(delta) filter (where kind = 'full'), 0)::int as full_left
      from pass_ledger
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.decided_at desc) from rows r), '[]'::jsonb),
      'count', (select count(*) from rows),
      'total', (select coalesce(sum(amount), 0) from rows),
      'qr_total', (select coalesce(sum(amount) filter (where method = 'qr'), 0) from rows),
      'cash_total', (select coalesce(sum(amount) filter (where method = 'cash'), 0) from rows),
      'unused_single', o.single_left,
      'unused_full', o.full_left,
      'unused_value', o.single_left * s.single_price + o.full_left * s.fullday_price
    )
    from owed o
  );
end;
$$;

-- The QR picture and the finance WhatsApp link, set on the Approvals page.
-- Pass null for the QR to keep the current one.
create function public.save_payment_settings(p_qr_path text, p_whatsapp_link text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  link text := nullif(trim(coalesce(p_whatsapp_link, '')), '');
begin
  if not (has_perm('approve_topups') or has_perm('edit_settings')) then raise exception 'NOT_ALLOWED'; end if;
  if link is not null and link !~ '^https://(chat\.whatsapp\.com|wa\.me)/[A-Za-z0-9/_?=&.-]+$' then
    raise exception 'INVALID_LINK';
  end if;
  if p_qr_path is not null and p_qr_path not like 'club/%' then raise exception 'INVALID_PATH'; end if;
  update settings
  set payment_qr_path = coalesce(p_qr_path, payment_qr_path),
      payment_whatsapp_link = link,
      updated_at = now(), updated_by = auth.uid()
  where id = 1;
end;
$$;

-- Receipt deletion. Receipts show bank details, but they are the club's proof of payment,
-- so one is deleted only when the Treasurer and the President or VP both agree: one of
-- them asks (with a reason), the other agrees. A request lapses after 14 days.
-- The top-up itself (amount, bank reference, who approved) always stays in Finance.
create table public.receipt_deletions (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid not null references public.topups (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  requested_by uuid not null references public.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'done', 'declined', 'expired')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index receipt_deletions_one_open on public.receipt_deletions (topup_id) where status = 'pending';
alter table public.receipt_deletions enable row level security;
revoke all on public.receipt_deletions from anon, authenticated;

create function public.officer_position(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select position from profiles where id = p_user and position in ('President', 'Vice President', 'Treasurer');
$$;

-- The Treasurer plus the President or the VP, two different people.
create function public.officers_can_delete(p_asker uuid, p_agreer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_asker <> p_agreer
     and 'Treasurer' in (officer_position(p_asker), officer_position(p_agreer))
     and (officer_position(p_asker) in ('President', 'Vice President')
          or officer_position(p_agreer) in ('President', 'Vice President'));
$$;

create function public.request_receipt_deletion(p_topup uuid, p_reason text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  why text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
  t topups;
  new_id uuid;
begin
  if officer_position(auth.uid()) is null then raise exception 'NOT_ALLOWED'; end if;
  if why is null then raise exception 'REASON_REQUIRED'; end if;
  select * into t from topups where id = p_topup;
  if not found or t.receipt_path is null then raise exception 'RECEIPT_NOT_FOUND'; end if;
  if t.status = 'pending' then raise exception 'TOPUP_PENDING'; end if;
  update receipt_deletions set status = 'expired'
  where topup_id = p_topup and status = 'pending' and created_at <= now() - interval '14 days';
  if exists (select 1 from receipt_deletions where topup_id = p_topup and status = 'pending') then
    raise exception 'DELETE_PENDING';
  end if;
  insert into receipt_deletions (topup_id, reason, requested_by) values (p_topup, why, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;

-- Agreeing deletes the receipt from the top-up and returns its storage path, so the
-- server can remove the file. Declining just closes the request.
create function public.decide_receipt_deletion(p_request uuid, p_agree boolean) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  r receipt_deletions;
  path text;
begin
  if officer_position(auth.uid()) is null then raise exception 'NOT_ALLOWED'; end if;
  select * into r from receipt_deletions where id = p_request for update;
  if not found or r.status <> 'pending' then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.created_at <= now() - interval '14 days' then raise exception 'REQUEST_EXPIRED'; end if;
  if r.requested_by = auth.uid() then raise exception 'OWN_REQUEST'; end if;

  if not p_agree then
    update receipt_deletions set status = 'declined', decided_by = auth.uid(), decided_at = now() where id = p_request;
    return null;
  end if;
  if not officers_can_delete(r.requested_by, auth.uid()) then raise exception 'TREASURER_AND_PRESIDENT'; end if;

  select receipt_path into path from topups where id = r.topup_id for update;
  update topups set receipt_path = null, receipt_deleted_at = now() where id = r.topup_id;
  update receipt_deletions set status = 'done', decided_by = auth.uid(), decided_at = now() where id = p_request;
  return path;
end;
$$;

-- Open requests, for the President, VP and Treasurer.
create function public.receipt_deletions_open() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'topup_id', t.id, 'number', t.number, 'amount', t.amount, 'full_name', p.full_name,
    'reason', r.reason, 'requested_by', name_with_position(r.requested_by), 'created_at', r.created_at,
    'expires_at', r.created_at + interval '14 days',
    'mine', r.requested_by = auth.uid(),
    'can_agree', officers_can_delete(r.requested_by, auth.uid())
  ) order by r.created_at), '[]'::jsonb)
  from receipt_deletions r
  join topups t on t.id = r.topup_id
  join profiles p on p.id = t.user_id
  where officer_position(auth.uid()) is not null
    and r.status = 'pending' and r.created_at > now() - interval '14 days';
$$;

-- Who gets the "new top-up waiting" email. Only the website's server can call this.
create function public.topup_alert_emails(p_exclude uuid) returns table (email text, full_name text)
language sql stable security definer set search_path = public as $$
  select distinct p.email, p.full_name
  from permissions x join profiles p on p.id = x.user_id
  where x.permission in ('owner', 'approve_topups')
    and (x.expires_at is null or x.expires_at > now())
    and p.id is distinct from p_exclude;
$$;

-- Same as 0002, plus how many top-ups are waiting (for approvers) and the exco position.
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
                                    then (select count(*) from member_requests where status = 'pending') else 0 end,
    'pending_topups', case when has_perm('approve_topups')
                           then (select count(*) from topups where status = 'pending') else 0 end,
    'position', p.position
  )
  from profiles p where p.id = auth.uid();
$$;

revoke execute on function
  public.normalize_bank_ref(text), public.name_with_position(uuid),
  public.request_topup(int, int, text, text, text), public.cancel_topup(uuid),
  public.topups_for_review(), public.decide_topup(uuid, boolean, text),
  public.finance_report(date, date), public.save_payment_settings(text, text),
  public.officer_position(uuid), public.officers_can_delete(uuid, uuid),
  public.request_receipt_deletion(uuid, text), public.decide_receipt_deletion(uuid, boolean),
  public.receipt_deletions_open(), public.topup_alert_emails(uuid)
  from public, anon;
grant execute on function
  public.normalize_bank_ref(text),
  public.request_topup(int, int, text, text, text), public.cancel_topup(uuid),
  public.topups_for_review(), public.decide_topup(uuid, boolean, text),
  public.finance_report(date, date), public.save_payment_settings(text, text),
  public.request_receipt_deletion(uuid, text), public.decide_receipt_deletion(uuid, boolean),
  public.receipt_deletions_open(), public.my_status()
  to authenticated;
revoke execute on function public.topup_alert_emails(uuid) from authenticated;
grant execute on function public.topup_alert_emails(uuid) to service_role;
