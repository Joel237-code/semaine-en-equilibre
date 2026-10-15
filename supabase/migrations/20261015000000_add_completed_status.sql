alter table public.activities
add column if not exists completed boolean not null default false;

alter table public.activities
drop constraint if exists activities_cannot_be_cancelled_and_completed;

alter table public.activities
add constraint activities_cannot_be_cancelled_and_completed
check (not (cancelled and completed));
