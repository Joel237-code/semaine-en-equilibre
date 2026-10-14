alter table public.activities
add column if not exists cancelled boolean not null default false;
