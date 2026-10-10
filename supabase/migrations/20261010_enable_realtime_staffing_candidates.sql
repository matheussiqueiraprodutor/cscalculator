do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'staffing_candidates'
  ) then
    alter publication supabase_realtime add table public.staffing_candidates;
  end if;
end
$$;
