-- Suivi financier partagé par les membres du planning.
create table if not exists public.planner_monthly_budgets (
  planner_id uuid not null references public.planners(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  salary numeric(12, 2) not null default 0 check (salary >= 0),
  updated_at timestamptz not null default now(),
  primary key (planner_id, month_start)
);

create table if not exists public.planner_expenses (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  expense_date date not null,
  label text not null check (char_length(trim(label)) between 1 and 80),
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.planner_monthly_budgets enable row level security;
alter table public.planner_expenses enable row level security;

drop policy if exists "Planner members can manage monthly budgets" on public.planner_monthly_budgets;
create policy "Planner members can manage monthly budgets"
on public.planner_monthly_budgets for all to authenticated
using (exists (
  select 1 from public.planner_members
  where planner_members.planner_id = planner_monthly_budgets.planner_id
    and planner_members.user_id = auth.uid()
))
with check (exists (
  select 1 from public.planner_members
  where planner_members.planner_id = planner_monthly_budgets.planner_id
    and planner_members.user_id = auth.uid()
));

drop policy if exists "Planner members can manage expenses" on public.planner_expenses;
create policy "Planner members can manage expenses"
on public.planner_expenses for all to authenticated
using (exists (
  select 1 from public.planner_members
  where planner_members.planner_id = planner_expenses.planner_id
    and planner_members.user_id = auth.uid()
))
with check (exists (
  select 1 from public.planner_members
  where planner_members.planner_id = planner_expenses.planner_id
    and planner_members.user_id = auth.uid()
));

grant select, insert, update, delete on public.planner_monthly_budgets to authenticated;
grant select, insert, update, delete on public.planner_expenses to authenticated;
