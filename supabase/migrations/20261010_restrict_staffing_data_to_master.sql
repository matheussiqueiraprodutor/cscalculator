drop policy if exists "Autenticados consultam candidatos" on public.staffing_candidates;
drop policy if exists "Autenticados consultam itens de equipe" on public.staffing_request_items;
drop policy if exists "Autenticados consultam solicitações" on public.staffing_requests;

drop policy if exists "authenticated can read company freelancer cache" on public.company_freelancers_cache;
create policy "Master consulta cache de freelancers"
  on public.company_freelancers_cache
  for select
  to authenticated
  using (
    lower((select auth.jwt() ->> 'email')) = 'matheussiqueiraprodutor@gmail.com'
  );
