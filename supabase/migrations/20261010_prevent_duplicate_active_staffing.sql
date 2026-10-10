create unique index if not exists staffing_candidates_one_active_assignment_per_external_key
  on public.staffing_candidates (external_key)
  where external_key is not null
    and status in ('waiting','available','confirmed');
