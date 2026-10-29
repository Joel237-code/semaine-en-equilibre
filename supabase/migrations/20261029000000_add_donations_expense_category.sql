begin;
alter table public.planner_expenses drop constraint if exists expense_category_valid;
alter table public.planner_expenses add constraint expense_category_valid
check (category in ('groceries','transport','housing','health','leisure','bills','donations','other'));
commit;
