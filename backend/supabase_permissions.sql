-- The Flask API uses Supabase's publishable key, so its database role is `anon`.
-- These permissive policies intentionally make these endpoint operations public.

begin;

grant usage on schema public to anon;

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.users enable row level security;

grant select on table public.events to anon;
grant select, insert on table public.registrations to anon;
grant select on table public.users to anon;

drop policy if exists "Public API can read events" on public.events;
create policy "Public API can read events"
  on public.events
  for select
  to anon
  using (true);

drop policy if exists "Public API can read registrations" on public.registrations;
create policy "Public API can read registrations"
  on public.registrations
  for select
  to anon
  using (true);

drop policy if exists "Public API can create registrations" on public.registrations;
create policy "Public API can create registrations"
  on public.registrations
  for insert
  to anon
  with check (true);

drop policy if exists "Public API can read users" on public.users;
create policy "Public API can read users"
  on public.users
  for select
  to anon
  using (true);

commit;
