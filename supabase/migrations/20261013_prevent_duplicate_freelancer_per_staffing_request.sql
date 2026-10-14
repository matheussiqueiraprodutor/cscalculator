create or replace function public.prevent_duplicate_freelancer_per_staffing_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if new.external_key is null or btrim(new.external_key) = '' then
    return new;
  end if;

  select request_id
    into v_request_id
  from public.staffing_request_items
  where id = new.request_item_id;

  if v_request_id is null then
    return new;
  end if;

  if exists (
    select 1
    from public.staffing_candidates sc
    join public.staffing_request_items sri
      on sri.id = sc.request_item_id
    where sri.request_id = v_request_id
      and sc.external_key = new.external_key
      and sc.id is distinct from new.id
  ) then
    raise exception 'Freelancer já incluído em outra vaga desta solicitação.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists staffing_candidates_unique_freelancer_per_request
  on public.staffing_candidates;

create trigger staffing_candidates_unique_freelancer_per_request
before insert or update of request_item_id, external_key
on public.staffing_candidates
for each row
execute function public.prevent_duplicate_freelancer_per_staffing_request();

revoke execute on function public.prevent_duplicate_freelancer_per_staffing_request()
from public, anon, authenticated;
