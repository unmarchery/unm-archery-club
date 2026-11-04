-- UNM Archery Club: rank matches and one leaderboard per skill tier.
-- Scores are stamped with the archer's tier when entered, so after a move up, older scores stay
-- in the old tier's history. Run once in the Supabase SQL editor, after 0014_social.sql.

alter table public.settings
  add column auto_tier_on boolean not null default false,   -- kept off for now; tiers are set by hand
  add column auto_tier_intermediate int not null default 450,
  add column auto_tier_pro int not null default 540,
  add column auto_tier_matches int not null default 2 check (auto_tier_matches between 1 and 10);

create table public.rank_matches (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  held_on date not null,
  time_label text check (char_length(time_label) <= 40),
  format text check (char_length(format) <= 60),
  capacity int not null default 36 check (capacity > 0),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.rank_registrations (
  match_id uuid not null references public.rank_matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create table public.rank_scores (
  match_id uuid not null references public.rank_matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null check (tier in ('beginner', 'intermediate', 'pro')),
  score int not null check (score between 0 and 1000),
  primary key (match_id, user_id)
);
alter table public.rank_matches enable row level security;
alter table public.rank_registrations enable row level security;
alter table public.rank_scores enable row level security;
revoke all on public.rank_matches, public.rank_registrations, public.rank_scores from anon, authenticated;

-- One tier's standings: each archer's best score in that tier, best first.
-- Visitors see usernames only; signed-in archers also see names.
create function public.leaderboard(p_tier text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'place', place, 'username', username, 'name', case when auth.uid() is null then null else full_name end,
      'score', best, 'me', id = auth.uid()) order by place), '[]'::jsonb)
  from (
    select p.id, p.username, p.full_name, max(s.score) best, rank() over (order by max(s.score) desc) place
    from rank_scores s join profiles p on p.id = s.user_id
    where s.tier = p_tier
    group by p.id
  ) t;
$$;

-- Upcoming matches (with places taken and whether you registered) and past results (top 3 per tier).
create function public.rank_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'upcoming', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'held_on', m.held_on,
        'time_label', m.time_label, 'format', m.format, 'capacity', m.capacity,
        'taken', (select count(*) from rank_registrations r where r.match_id = m.id),
        'registered', exists (select 1 from rank_registrations r where r.match_id = m.id and r.user_id = auth.uid()))
        order by m.held_on), '[]'::jsonb) from rank_matches m where not m.done),
    'history', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'held_on', m.held_on,
        'archers', (select count(*) from rank_scores s where s.match_id = m.id),
        'top', (select coalesce(jsonb_object_agg(tier, podium), '{}'::jsonb) from (
            select tier, jsonb_agg(jsonb_build_object('username', username, 'score', score) order by score desc) podium
            from (select s.tier, p.username, s.score, row_number() over (partition by s.tier order by s.score desc) n
                  from rank_scores s join profiles p on p.id = s.user_id where s.match_id = m.id) x
            where n <= 3 group by tier) t))
        order by m.held_on desc), '[]'::jsonb) from rank_matches m where m.done));
$$;

-- Members register for an upcoming match, or withdraw.
create function public.register_match(p_match uuid, p_on boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  m rank_matches;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  if membership_status(auth.uid()) <> 'member' then raise exception 'MEMBERS_ONLY'; end if;
  select * into m from rank_matches where id = p_match;
  if m.id is null or m.done then raise exception 'NOT_FOUND'; end if;
  if not p_on then delete from rank_registrations where match_id = p_match and user_id = auth.uid(); return; end if;
  if (select count(*) from rank_registrations where match_id = p_match) >= m.capacity then raise exception 'MATCH_FULL'; end if;
  insert into rank_registrations (match_id, user_id) values (p_match, auth.uid()) on conflict do nothing;
end;
$$;

-- Ranking tools (manage_ranking): matches, scores, tiers, and the automatic tier-up setting.
create function public.save_match(p jsonb) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  mid uuid := nullif(p->>'id', '')::uuid;
begin
  if not has_perm('manage_ranking') then raise exception 'NOT_ALLOWED'; end if;
  if mid is null then
    insert into rank_matches (title, held_on, time_label, format, capacity)
    values (trim(p->>'title'), (p->>'held_on')::date, nullif(trim(p->>'time_label'), ''), nullif(trim(p->>'format'), ''), coalesce((p->>'capacity')::int, 36))
    returning id into mid;
  else
    update rank_matches set title = trim(p->>'title'), held_on = (p->>'held_on')::date, time_label = nullif(trim(p->>'time_label'), ''),
      format = nullif(trim(p->>'format'), ''), capacity = coalesce((p->>'capacity')::int, capacity) where id = mid;
  end if;
  return mid;
end;
$$;

-- Scores as [{"student_id": "20231111", "score": 537}, ...]. Saving marks the match done.
create function public.save_scores(p_match uuid, p_scores jsonb) returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int;
begin
  if not has_perm('manage_ranking') then raise exception 'NOT_ALLOWED'; end if;
  insert into rank_scores (match_id, user_id, tier, score)
  select p_match, pr.id, pr.tier, (x->>'score')::int
  from jsonb_array_elements(p_scores) x join profiles pr on pr.student_id = x->>'student_id'
  on conflict (match_id, user_id) do update set score = excluded.score;
  get diagnostics n = row_count;
  update rank_matches set done = true where id = p_match;
  return n;
end;
$$;

-- Returns the archer's name for the confirmation message.
create function public.set_tier(p_student_id text, p_tier text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid;
  nm text;
begin
  if not has_perm('manage_ranking') then raise exception 'NOT_ALLOWED'; end if;
  if p_tier not in ('beginner', 'intermediate', 'pro') then raise exception 'NOT_ALLOWED'; end if;
  update profiles set tier = p_tier where student_id = p_student_id returning id, full_name into uid, nm;
  if uid is null then raise exception 'STUDENT_NOT_FOUND'; end if;
  perform log_activity(uid, 'set skill tier to ' || p_tier);
  return nm;
end;
$$;

create function public.save_auto_tier(p_on boolean, p_intermediate int, p_pro int, p_matches int) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not has_perm('manage_ranking') then raise exception 'NOT_ALLOWED'; end if;
  update settings set auto_tier_on = p_on, auto_tier_intermediate = p_intermediate, auto_tier_pro = p_pro,
    auto_tier_matches = p_matches, updated_at = now(), updated_by = auth.uid() where id = 1;
end;
$$;

revoke execute on function public.leaderboard(text), public.rank_overview(), public.register_match(uuid, boolean),
  public.save_match(jsonb), public.save_scores(uuid, jsonb), public.set_tier(text, text),
  public.save_auto_tier(boolean, int, int, int) from public;
grant execute on function public.leaderboard(text), public.rank_overview() to anon, authenticated;
grant execute on function public.register_match(uuid, boolean), public.save_match(jsonb), public.save_scores(uuid, jsonb),
  public.set_tier(text, text), public.save_auto_tier(boolean, int, int, int) to authenticated;
revoke execute on function public.register_match(uuid, boolean), public.save_match(jsonb), public.save_scores(uuid, jsonb),
  public.set_tier(text, text), public.save_auto_tier(boolean, int, int, int) from anon;
