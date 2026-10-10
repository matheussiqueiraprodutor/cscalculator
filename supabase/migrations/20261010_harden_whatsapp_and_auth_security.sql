revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "Master consulta eventos WhatsApp" on public.whatsapp_inbound_events;
create policy "Master consulta eventos WhatsApp"
  on public.whatsapp_inbound_events
  for select
  to authenticated
  using (
    lower((select auth.jwt() ->> 'email')) = 'matheussiqueiraprodutor@gmail.com'
  );

create index if not exists whatsapp_inbound_events_candidate_idx
  on public.whatsapp_inbound_events (staffing_candidate_id);

create index if not exists staffing_candidates_freelancer_idx
  on public.staffing_candidates (freelancer_id)
  where freelancer_id is not null;

create index if not exists staffing_requests_created_by_idx
  on public.staffing_requests (created_by)
  where created_by is not null;
