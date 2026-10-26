begin;
alter table public.planner_expenses add column if not exists category text not null default 'other';
alter table public.planner_expenses drop constraint if exists expense_category_valid;
alter table public.planner_expenses add constraint expense_category_valid
check (category in ('groceries','transport','housing','health','leisure','bills','other'));
alter table public.planner_monthly_budgets add column if not exists carry_amount numeric(12,2) not null default 0;
-- Les règles RLS et droits existants restent applicables aux nouvelles colonnes.
commit;
