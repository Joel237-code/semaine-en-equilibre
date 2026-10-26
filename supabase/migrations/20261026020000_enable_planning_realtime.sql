-- Activer après validation. Les relectures des données respectent les politiques SELECT/RLS.
begin;
do $$
declare table_name text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'La publication supabase_realtime doit être activée dans ce projet.';
  end if;
  foreach table_name in array array['activities','planner_weekly_goals','planner_expenses','planner_monthly_budgets','planner_recurring_bills'] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Table manquante : %. Exécuter les migrations précédentes.', table_name;
    end if;
    if not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
commit;
