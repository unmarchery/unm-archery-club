-- UNM Archery Club: public pages for visitors (landing page, FAQ, join).
-- Run once in the Supabase SQL editor, after 0009_shop.sql.

-- Pass prices for the landing page and FAQ. Visitors are not signed in, so they can't read settings.
create function public.public_prices() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('single_price', single_price, 'fullday_price', fullday_price) from settings where id = 1;
$$;

revoke execute on function public.public_prices() from public;
grant execute on function public.public_prices() to anon, authenticated;
