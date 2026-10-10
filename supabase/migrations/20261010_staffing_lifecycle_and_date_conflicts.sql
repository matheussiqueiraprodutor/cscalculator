alter table public.staffing_requests
  add column if not exists is_test boolean not null default false;

drop index if exists public.staffing_candidates_one_active_assignment_per_external_key;

create or replace function public.staffing_parse_date(value text)
returns date
language plpgsql
immutable
as $$
declare
  v text := btrim(coalesce(value, ''));
begin
  if v = '' then return null; end if;
  if v ~ '^\d{4}-\d{2}-\d{2}$' then return to_date(v, 'YYYY-MM-DD'); end if;
  if v ~ '^\d{2}/\d{2}/\d{4}$' then return to_date(v, 'DD/MM/YYYY'); end if;
  return null;
end;
$$;

create or replace function public.prevent_overlapping_staffing_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_request_id uuid;
  new_request_status text;
  new_start date;
  new_end date;
  has_conflict boolean;
begin
  if new.external_key is null or new.status not in ('waiting','available','confirmed') then
    return new;
  end if;

  select sri.request_id into new_request_id
  from public.staffing_request_items sri
  where sri.id = new.request_item_id;

  select sr.status,
         public.staffing_parse_date(sr.event_date),
         coalesce(public.staffing_parse_date(nullif(sr.event_end_date,'')),
                  public.staffing_parse_date(sr.event_date))
    into new_request_status, new_start, new_end
  from public.staffing_requests sr
  where sr.id = new_request_id;

  if new_request_status is distinct from 'ready' then return new; end if;
  if new_start is null then raise exception 'Data da solicitação inválida.'; end if;
  if new_end is null then new_end := new_start; end if;
  if new_end < new_start then raise exception 'A data final não pode ser anterior à data inicial.'; end if;

  select exists (
    select 1
    from public.staffing_candidates sc
    join public.staffing_request_items sri on sri.id = sc.request_item_id
    join public.staffing_requests sr on sr.id = sri.request_id
    where sc.external_key = new.external_key
      and sc.id <> coalesce(new.id, -1)
      and sc.status in ('waiting','available','confirmed')
      and sr.status = 'ready'
      and public.staffing_parse_date(sr.event_date) is not null
      and daterange(
            public.staffing_parse_date(sr.event_date),
            coalesce(public.staffing_parse_date(nullif(sr.event_end_date,'')),
                     public.staffing_parse_date(sr.event_date)) + 1,
            '[)'
          )
          &&
          daterange(new_start, new_end + 1, '[)')
  ) into has_conflict;

  if has_conflict then
    raise exception 'Este profissional já está ativo em outra solicitação com conflito de datas.';
  end if;

  return new;
end;
$$;

revoke execute on function public.staffing_parse_date(text) from public, anon, authenticated;
revoke execute on function public.prevent_overlapping_staffing_assignment() from public, anon, authenticated;

drop trigger if exists staffing_candidates_prevent_overlap on public.staffing_candidates;
create trigger staffing_candidates_prevent_overlap
  before insert or update of status, external_key, request_item_id
  on public.staffing_candidates
  for each row execute function public.prevent_overlapping_staffing_assignment();
