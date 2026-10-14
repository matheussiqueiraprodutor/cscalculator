alter table public.company_freelancers_cache
  add column if not exists preferred_function text not null default '';

alter table public.freelancer_functions
  drop constraint if exists freelancer_functions_sector_check;

alter table public.freelancer_functions
  add constraint freelancer_functions_sector_check
  check (sector = any (array['audio'::text,'luz'::text,'video'::text,'geral'::text]));

insert into public.freelancer_functions (sector,name,active,sort_order)
values
  ('video','Técnico de Streaming',true,15),
  ('geral','Auxiliar Geral',true,10)
on conflict (sector,name) do update
set active=excluded.active,
    sort_order=excluded.sort_order;
