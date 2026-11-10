-- Add team roles without updating existing functions or staffing rules.
insert into public.freelancer_functions (sector, name, active, sort_order)
values
  ('geral', 'Técnico AV', true, 5),
  ('video', 'Cinegrafista', true, 25)
on conflict (sector, name) do nothing;
