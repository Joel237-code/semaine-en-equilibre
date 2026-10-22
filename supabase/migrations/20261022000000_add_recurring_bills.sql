begin;
-- À exécuter une seule fois après validation dans Supabase SQL Editor.
create table if not exists public.planner_recurring_bills (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  amount numeric(12,2) not null check (amount > 0),
  due_day integer not null check (due_day between 1 and 31),
  start_month date not null check (extract(day from start_month) = 1),
  active boolean not null default true,
  unique (id, planner_id)
);
alter table public.planner_recurring_bills enable row level security;
drop policy if exists "Members manage recurring bills" on public.planner_recurring_bills;
create policy "Members manage recurring bills" on public.planner_recurring_bills
for all to authenticated
using (exists (select 1 from public.planner_members m where m.planner_id = planner_recurring_bills.planner_id and m.user_id = auth.uid()))
with check (exists (select 1 from public.planner_members m where m.planner_id = planner_recurring_bills.planner_id and m.user_id = auth.uid()));
grant select, insert, update, delete on public.planner_recurring_bills to authenticated;
alter table public.planner_expenses add column if not exists recurring_bill_id uuid;
alter table public.planner_expenses drop constraint if exists expense_recurring_bill_planner_fk;
alter table public.planner_expenses add constraint expense_recurring_bill_planner_fk
foreign key (recurring_bill_id, planner_id) references public.planner_recurring_bills(id, planner_id);
-- Un seul ajout par facture et par mois, même depuis deux appareils simultanés.
create unique index if not exists expense_recurring_bill_month_unique
on public.planner_expenses (recurring_bill_id, (extract(year from expense_date)), (extract(month from expense_date)))
where recurring_bill_id is not null;

commit;
