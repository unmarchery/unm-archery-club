-- UNM Archery Club: public profiles, skill tiers and emoji reactions.
-- Members react to each other's profiles to cheer them on (no messaging, so no arguments).
-- Run once in the Supabase SQL editor, after 0013_session_opening.sql.

-- Everyone starts as Beginner; people with the Ranking switch move archers up (0015).
alter table public.profiles add column tier text not null default 'beginner' check (tier in ('beginner', 'intermediate', 'pro'));

create table public.profile_reactions (
  target uuid not null references public.profiles (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('clap', 'fire', 'target', 'strong', 'star')),
  created_at timestamptz not null default now(),
  primary key (target, from_user, emoji),
  check (target <> from_user)
);
alter table public.profile_reactions enable row level security;
revoke all on public.profile_reactions from anon, authenticated;

-- What a signed-in archer sees on someone's profile page. Counts only: reactions are anonymous.
create function public.public_profile(p_username text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'id', p.id, 'username', p.username, 'full_name', p.full_name, 'bio', p.bio, 'instagram', p.instagram,
      'tier', p.tier, 'member', membership_status(p.id) = 'member', 'position', p.position, 'is_me', p.id = auth.uid(),
      'reactions', (select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb)
                    from (select emoji, count(*) n from profile_reactions where target = p.id group by emoji) c),
      'mine', (select coalesce(jsonb_agg(emoji), '[]'::jsonb) from profile_reactions where target = p.id and from_user = auth.uid()))
    from profiles p where p.username = lower(p_username)
  ) end;
$$;

-- Members tap an emoji to react, and tap again to take it back.
create function public.toggle_reaction(p_target uuid, p_emoji text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if membership_status(auth.uid()) <> 'member' then raise exception 'MEMBERS_ONLY'; end if;
  if p_target = auth.uid() then raise exception 'NOT_ALLOWED'; end if;
  if p_emoji not in ('clap', 'fire', 'target', 'strong', 'star') then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from profiles where id = p_target) then raise exception 'NOT_FOUND'; end if;
  delete from profile_reactions where target = p_target and from_user = auth.uid() and emoji = p_emoji;
  if found then return false; end if;
  insert into profile_reactions (target, from_user, emoji) values (p_target, auth.uid(), p_emoji);
  return true;
end;
$$;

revoke execute on function public.public_profile(text), public.toggle_reaction(uuid, text) from public, anon;
grant execute on function public.public_profile(text), public.toggle_reaction(uuid, text) to authenticated;
