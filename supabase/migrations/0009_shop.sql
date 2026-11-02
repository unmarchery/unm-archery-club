-- UNM Archery Club: the Shop.
-- Sections (Passes, Merch, and any added later) hold items with photos, a price, an
-- optional member price and options (size, colour...), each option with its own stock.
-- Items are either in stock (sell out at 0) or pre-order (until a closing date). Buyers
-- check out a cart with one DuitNow QR payment (receipt) or cash; someone with the new
-- manage_shop switch checks the payment, then marks the order collected. Prices are in sen.
-- Run once in the Supabase SQL editor, after 0008_phase1_finish.sql.

alter table public.permissions drop constraint permissions_permission_check;
alter table public.permissions add constraint permissions_permission_check check (permission in (
  'owner', 'approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
  'manage_sessions', 'manage_members', 'export_finance', 'write_notes', 'manage_shop'));

alter table public.settings add column shop_whatsapp_link text;  -- pick-up group, shown once an order is paid

create table public.shop_sections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'products' check (kind in ('products', 'passes')),  -- 'passes' shows the top-up form
  sort int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.shop_sections (name, kind, sort) values ('Passes', 'passes', 0), ('Merch', 'products', 1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.shop_sections (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  price_sen int not null check (price_sen >= 0),
  member_price_sen int check (member_price_sen >= 0),
  mode text not null default 'stock' check (mode in ('stock', 'preorder')),
  preorder_until date,               -- last day pre-orders are taken (Malaysia time)
  images text[] not null default '{}',  -- paths in the public "shop" bucket; the first is the main photo
  size_chart text,
  visible boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),   -- "M / Black", or "One size"
  stock int check (stock >= 0),       -- null for pre-order items
  active boolean not null default true,
  sort int not null default 0
);
create index product_options_product_idx on public.product_options (product_id, sort);

create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,   -- "Order #12"
  user_id uuid not null references public.profiles (id) on delete cascade,
  total_sen int not null check (total_sen >= 0),
  method text not null check (method in ('qr', 'cash')),
  bank_ref text check (char_length(bank_ref) <= 40),
  receipt_path text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected', 'cancelled')),
  reason text check (char_length(reason) <= 300),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  collected_at timestamptz,
  collected_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (method = 'cash' or (bank_ref is not null and receipt_path is not null))
);
create index shop_orders_user_idx on public.shop_orders (user_id, created_at desc);
create unique index shop_orders_bank_ref_once on public.shop_orders (upper(bank_ref)) where status in ('pending', 'paid');

create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  option_id uuid references public.product_options (id) on delete set null,
  name text not null,        -- copied at checkout, so later edits don't change old orders
  option_label text not null,
  qty int not null check (qty between 1 and 20),
  unit_sen int not null check (unit_sen >= 0),
  preorder boolean not null default false
);

alter table public.shop_sections enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
revoke all on public.shop_sections, public.products, public.product_options, public.shop_orders, public.shop_order_items
  from anon, authenticated;
grant select on public.shop_orders, public.shop_order_items to authenticated;
create policy "own orders" on public.shop_orders for select to authenticated using (user_id = auth.uid());
create policy "own order items" on public.shop_order_items for select to authenticated
  using (exists (select 1 from shop_orders o where o.id = order_id and o.user_id = auth.uid()));

-- Product photos are public pictures (they're for selling), in their own bucket.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('shop', 'shop', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

-- What an item costs this buyer: the member price for members, when there is one.
create function public.price_for(p_product products, p_member boolean) returns int
language sql immutable as $$
  select case when p_member and p_product.member_price_sen is not null then p_product.member_price_sen else p_product.price_sen end;
$$;

create function public.preorder_open(p_product products) returns boolean
language sql stable security definer set search_path = public as $$
  select p_product.mode = 'preorder' and (p_product.preorder_until is null or p_product.preorder_until >= club_today());
$$;

-- The shop for any signed-in archer; managers also see hidden sections and items.
create function public.shop_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'member', membership_status(auth.uid()) = 'member',
    'manager', has_perm('manage_shop'),
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'kind', s.kind, 'visible', s.visible, 'sort', s.sort,
        'products', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'name', p.name, 'description', p.description,
            'price_sen', p.price_sen, 'member_price_sen', p.member_price_sen,
            'your_price_sen', price_for(p, membership_status(auth.uid()) = 'member'),
            'mode', p.mode, 'preorder_until', p.preorder_until, 'open', p.mode = 'stock' or preorder_open(p),
            'images', p.images, 'size_chart', p.size_chart, 'visible', p.visible, 'sort', p.sort,
            'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'stock', o.stock, 'active', o.active)
                                                  order by o.sort, o.label), '[]'::jsonb)
                        from product_options o where o.product_id = p.id and (o.active or has_perm('manage_shop')))
          ) order by p.sort, p.created_at), '[]'::jsonb)
          from products p where p.section_id = s.id and (p.visible or has_perm('manage_shop')))
      ) order by s.sort, s.created_at), '[]'::jsonb)
      from shop_sections s where s.visible or has_perm('manage_shop')),
    'pickup_link', (select shop_whatsapp_link from settings where id = 1)
  ) end;
$$;

-- Checkout. Items: [{"option_id": "...", "qty": 2}, ...]. Stock is held as soon as the
-- order is placed and comes back if it's rejected or cancelled.
create function public.place_order(p_items jsonb, p_method text, p_bank_ref text default null, p_receipt_path text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  member boolean;
  ref text := normalize_bank_ref(p_bank_ref);
  item jsonb;
  opt product_options;
  prod products;
  qty int;
  total int := 0;
  new_order shop_orders;
begin
  if uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'CART_EMPTY';
  end if;
  if p_method not in ('qr', 'cash') then raise exception 'INVALID_METHOD'; end if;
  if p_method = 'qr' then
    if ref is null or char_length(ref) < 4 then raise exception 'BANK_REF_REQUIRED'; end if;
    if p_receipt_path is null or p_receipt_path not like uid::text || '/%' then raise exception 'RECEIPT_REQUIRED'; end if;
    if exists (select 1 from shop_orders where upper(bank_ref) = ref and status in ('pending', 'paid'))
       or exists (select 1 from topups where upper(bank_ref) = ref and status in ('pending', 'approved')) then
      raise exception 'BANK_REF_USED';
    end if;
  end if;
  if (select count(*) from shop_orders where user_id = uid and status = 'pending') >= 3 then raise exception 'TOO_MANY_PENDING'; end if;
  member := membership_status(uid) = 'member';

  insert into shop_orders (user_id, total_sen, method, bank_ref, receipt_path)
  values (uid, 0, p_method, case when p_method = 'qr' then ref end, case when p_method = 'qr' then p_receipt_path end)
  returning * into new_order;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'qty')::int;
    if qty is null or qty < 1 or qty > 20 then raise exception 'INVALID_QUANTITY'; end if;
    select * into opt from product_options where id = (item->>'option_id')::uuid and active for update;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
    select * into prod from products where id = opt.product_id;
    if not prod.visible or not exists (select 1 from shop_sections where id = prod.section_id and visible) then
      raise exception 'ITEM_NOT_FOUND';
    end if;
    if prod.mode = 'preorder' then
      if not preorder_open(prod) then raise exception 'PREORDER_CLOSED'; end if;
    else
      if coalesce(opt.stock, 0) < qty then raise exception 'OUT_OF_STOCK'; end if;
      update product_options set stock = stock - qty where id = opt.id;
    end if;
    insert into shop_order_items (order_id, product_id, option_id, name, option_label, qty, unit_sen, preorder)
    values (new_order.id, prod.id, opt.id, prod.name, opt.label, qty, price_for(prod, member), prod.mode = 'preorder');
    total := total + qty * price_for(prod, member);
  end loop;

  update shop_orders set total_sen = total where id = new_order.id;
  return (select jsonb_build_object('id', new_order.id, 'number', new_order.number, 'total_sen', total,
                                    'full_name', p.full_name, 'student_id', p.student_id)
          from profiles p where p.id = uid);
exception
  when unique_violation then raise exception 'BANK_REF_USED';
end;
$$;

create function public.restock_order(p_order uuid) returns void
language sql volatile security definer set search_path = public as $$
  update product_options o set stock = o.stock + i.qty
  from shop_order_items i
  where i.order_id = p_order and i.option_id = o.id and not i.preorder and o.stock is not null;
$$;

create function public.cancel_order(p_order uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update shop_orders set status = 'cancelled' where id = p_order and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  perform restock_order(p_order);
end;
$$;

-- Shop managers check the payment; nobody decides their own order. Returns what the
-- buyer's email needs.
create function public.decide_order(p_order uuid, p_approve boolean, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  o shop_orders;
  why text := nullif(left(trim(coalesce(p_reason, '')), 300), '');
begin
  if not has_perm('manage_shop') then raise exception 'NOT_ALLOWED'; end if;
  select * into o from shop_orders where id = p_order for update;
  if not found or o.status <> 'pending' then raise exception 'ORDER_NOT_FOUND'; end if;
  if o.user_id = auth.uid() then raise exception 'OWN_REQUEST'; end if;
  if not p_approve and why is null then raise exception 'REASON_REQUIRED'; end if;
  update shop_orders set status = case when p_approve then 'paid' else 'rejected' end,
         reason = why, decided_by = auth.uid(), decided_at = now()
  where id = p_order;
  if not p_approve then perform restock_order(p_order); end if;
  return (select jsonb_build_object('email', p.email, 'full_name', p.full_name, 'number', o.number, 'total_sen', o.total_sen,
                                    'approved', p_approve, 'reason', why,
                                    'pickup_link', (select shop_whatsapp_link from settings where id = 1))
          from profiles p where p.id = o.user_id);
end;
$$;

create function public.mark_collected(p_order uuid, p_collected boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('manage_shop') then raise exception 'NOT_ALLOWED'; end if;
  update shop_orders set collected_at = case when p_collected then now() end,
                         collected_by = case when p_collected then auth.uid() end
  where id = p_order and status = 'paid';
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
end;
$$;

-- The managers' queue: orders waiting for a payment check, paid orders still to hand
-- over, and the last 30 days of finished ones.
create function public.shop_orders_for_review() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not has_perm('manage_shop') then null else (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'number', o.number, 'created_at', o.created_at, 'status', o.status,
      'student_id', p.student_id, 'full_name', p.full_name, 'total_sen', o.total_sen,
      'method', o.method, 'bank_ref', o.bank_ref, 'receipt_path', o.receipt_path, 'reason', o.reason,
      'decided_by', name_with_position(o.decided_by), 'decided_at', o.decided_at, 'collected_at', o.collected_at,
      'mine', o.user_id = auth.uid(),
      'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'option', i.option_label, 'qty', i.qty,
                                                    'unit_sen', i.unit_sen, 'preorder', i.preorder) order by i.name)
                from shop_order_items i where i.order_id = o.id)
    ) order by o.created_at), '[]'::jsonb)
    from shop_orders o join profiles p on p.id = o.user_id
    where o.status = 'pending' or (o.status = 'paid' and o.collected_at is null)
       or (o.status in ('paid', 'rejected') and o.decided_at > now() - interval '30 days')
  ) end;
$$;

-- Managers add or edit a section.
create function public.save_section(p_id uuid, p_name text, p_sort int, p_visible boolean) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not has_perm('manage_shop') then raise exception 'NOT_ALLOWED'; end if;
  if p_id is null then
    insert into shop_sections (name, sort, visible) values (trim(p_name), coalesce(p_sort, 0), coalesce(p_visible, true))
    returning id into new_id;
    return new_id;
  end if;
  update shop_sections set name = trim(p_name), sort = coalesce(p_sort, sort), visible = coalesce(p_visible, visible)
  where id = p_id;
  if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  return p_id;
exception
  when check_violation then raise exception 'INVALID_ITEM';
end;
$$;

-- Managers add or edit an item and its options in one go. Options not listed any more are
-- switched off (kept for old orders). p: {id?, section_id, name, description, price_sen,
-- member_price_sen, mode, preorder_until, images[], size_chart, visible, sort,
-- options: [{id?, label, stock}]}
create function public.save_product(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  pid uuid := nullif(p->>'id', '')::uuid;
  opt jsonb;
  keep uuid[] := '{}';
  oid uuid;
  n int := 0;
begin
  if not has_perm('manage_shop') then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from shop_sections where id = (p->>'section_id')::uuid and kind = 'products') then raise exception 'INVALID_ITEM'; end if;
  if jsonb_typeof(p->'options') <> 'array' or jsonb_array_length(p->'options') = 0 then raise exception 'OPTIONS_REQUIRED'; end if;

  if pid is null then
    insert into products (section_id, name, description, price_sen, member_price_sen, mode, preorder_until, images, size_chart, visible, sort)
    values ((p->>'section_id')::uuid, trim(p->>'name'), nullif(trim(coalesce(p->>'description', '')), ''),
            (p->>'price_sen')::int, nullif(p->>'member_price_sen', '')::int, p->>'mode', nullif(p->>'preorder_until', '')::date,
            coalesce((select array_agg(x) from jsonb_array_elements_text(p->'images') x), '{}'), nullif(p->>'size_chart', ''),
            coalesce((p->>'visible')::boolean, true), coalesce((p->>'sort')::int, 0))
    returning id into pid;
  else
    update products set section_id = (p->>'section_id')::uuid, name = trim(p->>'name'),
      description = nullif(trim(coalesce(p->>'description', '')), ''), price_sen = (p->>'price_sen')::int,
      member_price_sen = nullif(p->>'member_price_sen', '')::int, mode = p->>'mode', preorder_until = nullif(p->>'preorder_until', '')::date,
      images = coalesce((select array_agg(x) from jsonb_array_elements_text(p->'images') x), '{}'), size_chart = nullif(p->>'size_chart', ''),
      visible = coalesce((p->>'visible')::boolean, visible), sort = coalesce((p->>'sort')::int, sort)
    where id = pid;
    if not found then raise exception 'ITEM_NOT_FOUND'; end if;
  end if;

  for opt in select * from jsonb_array_elements(p->'options') loop
    n := n + 1;
    oid := nullif(opt->>'id', '')::uuid;
    if oid is not null and exists (select 1 from product_options where id = oid and product_id = pid) then
      update product_options set label = trim(opt->>'label'), sort = n, active = true,
        stock = case when p->>'mode' = 'stock' then greatest(coalesce((opt->>'stock')::int, 0), 0) end
      where id = oid;
    else
      insert into product_options (product_id, label, stock, sort)
      values (pid, trim(opt->>'label'), case when p->>'mode' = 'stock' then greatest(coalesce((opt->>'stock')::int, 0), 0) end, n)
      returning id into oid;
    end if;
    keep := keep || oid;
  end loop;
  update product_options set active = false where product_id = pid and not (id = any(keep));
  return pid;
exception
  when check_violation or invalid_text_representation or not_null_violation then raise exception 'INVALID_ITEM';
end;
$$;

create function public.save_shop_link(p_link text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  link text := nullif(trim(coalesce(p_link, '')), '');
begin
  if not has_perm('manage_shop') then raise exception 'NOT_ALLOWED'; end if;
  if link is not null and link !~ '^https://(chat\.whatsapp\.com|wa\.me)/[A-Za-z0-9/_?=&.-]+$' then raise exception 'INVALID_LINK'; end if;
  update settings set shop_whatsapp_link = link where id = 1;
end;
$$;

-- Shop sales for the Finance page, alongside top-ups.
create function public.shop_finance(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz text := (select timezone from settings where id = 1);
begin
  if not (has_perm('export_finance') or has_perm('approve_topups') or has_perm('manage_shop')) then raise exception 'NOT_ALLOWED'; end if;
  return (
    with rows as (
      select o.number, o.decided_at, p.student_id, p.full_name, o.total_sen, o.method, o.bank_ref,
             name_with_position(o.decided_by) as approved_by, o.collected_at is not null as collected,
             (select string_agg(i.qty || '× ' || i.name || ' (' || i.option_label || ')', ', ' order by i.name)
              from shop_order_items i where i.order_id = o.id) as items
      from shop_orders o join profiles p on p.id = o.user_id
      where o.status = 'paid' and o.decided_at >= p_from::timestamp at time zone tz and o.decided_at < (p_to + 1)::timestamp at time zone tz
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.decided_at desc) from rows r), '[]'::jsonb),
      'total_sen', (select coalesce(sum(total_sen), 0) from rows),
      'qr_sen', (select coalesce(sum(total_sen) filter (where method = 'qr'), 0) from rows),
      'cash_sen', (select coalesce(sum(total_sen) filter (where method = 'cash'), 0) from rows)
    )
  );
end;
$$;

-- "New order waiting" goes to everyone who runs the shop. Server only.
create function public.shop_alert_emails(p_exclude uuid) returns table (email text)
language sql stable security definer set search_path = public as $$
  select distinct p.email from permissions x join profiles p on p.id = x.user_id
  where x.permission in ('owner', 'manage_shop') and (x.expires_at is null or x.expires_at > now())
    and p.id is distinct from p_exclude;
$$;

-- The shop's tables in the weekly backup too.
create or replace function public.backup_export() returns jsonb
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
    'closed_dates', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from closed_dates t),
    'shop_sections', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from shop_sections t),
    'products', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from products t),
    'product_options', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from product_options t),
    'shop_orders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from shop_orders t),
    'shop_order_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from shop_order_items t)
  );
$$;

-- The People page's switches, now including Shop (same as 0006 otherwise).
create or replace function public.permission_label(p_permission text) returns text
language sql immutable set search_path = public as $$
  select case p_permission
    when 'owner' then 'President access (everything)'
    when 'manage_members' then 'Members and accounts'
    when 'approve_topups' then 'Approve top-ups'
    when 'export_finance' then 'Download finance'
    when 'edit_settings' then 'Settings'
    when 'change_positions' then 'Change positions'
    when 'assign_duty' then 'Duty roster'
    when 'take_attendance' then 'Attendance'
    when 'manage_sessions' then 'Sessions'
    when 'write_notes' then 'Write notes'
    when 'manage_shop' then 'Shop'
    else p_permission end;
$$;

create or replace function public.set_permission(p_user uuid, p_permission text, p_on boolean, p_until date default null)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  ends timestamptz := case when p_until is null then null
                           else (p_until + 1)::timestamp at time zone (select timezone from settings where id = 1) end;
begin
  if not can_manage_access() then raise exception 'NOT_ALLOWED'; end if;
  if p_permission = 'owner' then raise exception 'OWNER_LOCKED'; end if;
  if p_permission not in ('approve_topups', 'edit_settings', 'change_positions', 'assign_duty', 'take_attendance',
                          'manage_sessions', 'manage_members', 'export_finance', 'write_notes', 'manage_shop') then
    raise exception 'NOT_ALLOWED';
  end if;
  if not has_perm(p_permission) then raise exception 'CANT_GIVE_MORE'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'STUDENT_NOT_FOUND'; end if;
  if p_until is not null and p_until < (now() at time zone (select timezone from settings where id = 1))::date then
    raise exception 'DATE_IN_PAST';
  end if;

  if p_on then
    insert into permissions (user_id, permission, granted_by, expires_at)
    values (p_user, p_permission, auth.uid(), ends)
    on conflict (user_id, permission) do update
      set granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at;
    perform log_activity(p_user, 'gave ' || permission_label(p_permission)
      || coalesce(' until ' || to_char(p_until, 'FMDD Mon YYYY'), ''));
  else
    delete from permissions where user_id = p_user and permission = p_permission;
    if found then perform log_activity(p_user, 'took away ' || permission_label(p_permission)); end if;
  end if;
end;
$$;

revoke execute on function
  public.price_for(products, boolean), public.preorder_open(products), public.shop_catalog(),
  public.place_order(jsonb, text, text, text), public.restock_order(uuid), public.cancel_order(uuid),
  public.decide_order(uuid, boolean, text), public.mark_collected(uuid, boolean), public.shop_orders_for_review(),
  public.save_section(uuid, text, int, boolean), public.save_product(jsonb), public.save_shop_link(text),
  public.shop_finance(date, date), public.shop_alert_emails(uuid), public.backup_export()
  from public, anon;
grant execute on function
  public.shop_catalog(), public.place_order(jsonb, text, text, text), public.cancel_order(uuid),
  public.decide_order(uuid, boolean, text), public.mark_collected(uuid, boolean), public.shop_orders_for_review(),
  public.save_section(uuid, text, int, boolean), public.save_product(jsonb), public.save_shop_link(text),
  public.shop_finance(date, date)
  to authenticated;
revoke execute on function public.shop_alert_emails(uuid), public.backup_export() from authenticated;
grant execute on function public.shop_alert_emails(uuid), public.backup_export() to service_role;
