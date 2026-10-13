-- Semaine en équilibre: shared planning schema for Supabase
-- Run this once in the Supabase SQL Editor after creating a project.

create extension if not exists pgcrypto with schema extensions;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre planning' check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code_hash bytea unique,
  created_at timestamptz not null default now()
);

create table public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 80),
  category text not null check (category in ('school', 'work', 'travel', 'spiritual', 'sport')),
  status text not null default 'scheduled' check (status in ('scheduled', 'proposed', 'accepted', 'declined')),
  event_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  location text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_plan_date_idx on public.events(plan_id, event_date, start_time);
create index plan_members_user_idx on public.plan_members(user_id);

create or replace function public.is_plan_member(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_members
    where plan_id = p_plan_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_plan_owner(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.plan_members
    where plan_id = p_plan_id and user_id = auth.uid() and role = 'owner'
  );
$$;

alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.events enable row level security;

create policy "Members can view their plans"
  on public.plans for select to authenticated
  using (public.is_plan_member(id));

create policy "Members can view their membership"
  on public.plan_members for select to authenticated
  using (public.is_plan_member(plan_id));

create policy "Members can view shared events"
  on public.events for select to authenticated
  using (public.is_plan_member(plan_id));

create policy "Owners add schedule; partners propose sport"
  on public.events for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.is_plan_member(plan_id)
    and (
      public.is_plan_owner(plan_id)
      or (category = 'sport' and status = 'proposed')
    )
  );

create policy "Owners manage events"
  on public.events for update to authenticated
  using (public.is_plan_owner(plan_id))
  with check (public.is_plan_owner(plan_id));

create policy "Owners or proposers remove events"
  on public.events for delete to authenticated
  using (
    public.is_plan_owner(plan_id)
    or (
      public.is_plan_member(plan_id)
      and created_by = auth.uid()
      and category = 'sport'
      and status = 'proposed'
    )
  );

revoke all on public.plans, public.plan_members, public.events from anon, authenticated;
grant select on public.plans, public.plan_members, public.events to authenticated;
grant insert, update, delete on public.events to authenticated;

create or replace function public.create_shared_plan(p_name text default 'Notre planning')
returns table(plan_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid := gen_random_uuid();
  v_code text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a plan';
  end if;

  insert into public.plans (id, name, owner_id, invite_code_hash)
  values (
    v_plan_id,
    coalesce(nullif(trim(p_name), ''), 'Notre planning'),
    auth.uid(),
    extensions.digest(v_code, 'sha256')
  );
  insert into public.plan_members (plan_id, user_id, role)
  values (v_plan_id, auth.uid(), 'owner');

  return query select v_plan_id, v_code;
end;
$$;

create or replace function public.join_shared_plan(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan_id uuid;
  v_member_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a plan';
  end if;

  select id into v_plan_id
  from public.plans
  where invite_code_hash = extensions.digest(lower(trim(coalesce(p_invite_code, ''))), 'sha256')
  for update;

  if v_plan_id is null then
    raise exception 'Invalid or already used invitation code';
  end if;

  if exists (
    select 1 from public.plan_members
    where plan_id = v_plan_id and user_id = auth.uid()
  ) then
    return v_plan_id;
  end if;

  select count(*) into v_member_count
  from public.plan_members where plan_id = v_plan_id;

  if v_member_count >= 2 then
    raise exception 'This shared plan already has two members';
  end if;

  insert into public.plan_members (plan_id, user_id, role)
  values (v_plan_id, auth.uid(), 'partner');

  -- Invitation codes are single-use; an owner can generate another if needed.
  update public.plans set invite_code_hash = null where id = v_plan_id;
  return v_plan_id;
end;
$$;

create or replace function public.rotate_plan_invite(p_plan_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if not public.is_plan_owner(p_plan_id) then
    raise exception 'Only the plan owner can create an invitation';
  end if;

  update public.plans
  set invite_code_hash = extensions.digest(v_code, 'sha256')
  where id = p_plan_id;

  return v_code;
end;
$$;

revoke all on function public.is_plan_member(uuid) from public, anon;
revoke all on function public.is_plan_owner(uuid) from public, anon;
revoke all on function public.create_shared_plan(text) from public, anon;
revoke all on function public.join_shared_plan(text) from public, anon;
revoke all on function public.rotate_plan_invite(uuid) from public, anon;
grant execute on function public.is_plan_member(uuid) to authenticated;
grant execute on function public.is_plan_owner(uuid) to authenticated;
grant execute on function public.create_shared_plan(text) to authenticated;
grant execute on function public.join_shared_plan(text) to authenticated;
grant execute on function public.rotate_plan_invite(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then
  null;
end
$$;
