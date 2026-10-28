-- UNM Archery Club: let the website's server read accounts.
-- The server uses the secret key, which acts as the service_role database role, to find a
-- student's email at login, tidy up unfinished signups, check starter passwords, and save
-- the member list from the Google Form. Newer Supabase projects don't give service_role
-- access to tables automatically, and without it every login says
-- "Student ID or password is incorrect".
-- Run once in the Supabase SQL editor. Running it again does no harm.

grant usage on schema public to service_role;
grant select on public.profiles, public.settings to service_role;
grant select, insert, update on public.members to service_role;
