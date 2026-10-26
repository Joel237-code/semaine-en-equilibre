begin;
create table if not exists public.planner_weekly_goals (
  planner_id uuid not null references public.planners(id) on delete cascade,
  category text not null check (category in ('school','work','spiritual','selfcare','sport','other')),
  target integer not null default 0 check (target between 0 and 99),
  primary key (planner_id, category)
);
alter table public.planner_weekly_goals enable row level security;
drop policy if exists "Members manage weekly goals" on public.planner_weekly_goals;
create policy "Members manage weekly goals" on public.planner_weekly_goals for all to authenticated
using (exists (select 1 from public.planner_members m where m.planner_id = planner_weekly_goals.planner_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.planner_members m where m.planner_id = planner_weekly_goals.planner_id and m.user_id = auth.uid()));
grant select, insert, update, delete on public.planner_weekly_goals to authenticated;
commit;
