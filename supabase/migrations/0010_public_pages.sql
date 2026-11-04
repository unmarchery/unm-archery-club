-- UNM Archery Club: public pages for visitors (landing page, FAQ, join).
-- Run once in the Supabase SQL editor, after 0009_shop.sql.

-- Yearly membership fee in RM, shown on the Join page. Empty hides the line.
alter table public.settings add column membership_fee int check (membership_fee is null or membership_fee >= 0);

-- What the public pages show: pass prices, the membership fee and the no-show rules.
-- Visitors are not signed in, so they can't read settings directly.
create function public.public_prices() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('single_price', single_price, 'fullday_price', fullday_price, 'membership_fee', membership_fee,
                            'noshow_warn_after', noshow_warn_after, 'noshow_ban_after', noshow_ban_after, 'ban_days', ban_days)
  from settings where id = 1;
$$;

-- Saved from the Settings page, next to the prices.
create function public.save_membership_fee(p_fee int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('edit_settings') then raise exception 'NOT_ALLOWED'; end if;
  if p_fee is not null and p_fee < 0 then raise exception 'INVALID_SETTING'; end if;
  update settings set membership_fee = p_fee, updated_at = now(), updated_by = auth.uid() where id = 1;
end;
$$;

revoke execute on function public.public_prices(), public.save_membership_fee(int) from public;
grant execute on function public.public_prices() to anon, authenticated;
grant execute on function public.save_membership_fee(int) to authenticated;
