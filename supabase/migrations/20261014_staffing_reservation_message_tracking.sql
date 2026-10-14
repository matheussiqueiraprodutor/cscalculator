alter table public.staffing_candidates
  add column if not exists reservation_message_text text,
  add column if not exists reservation_message_id text,
  add column if not exists reservation_status text not null default 'not_sent',
  add column if not exists reservation_sent_at timestamptz,
  add column if not exists reservation_delivered_at timestamptz,
  add column if not exists reservation_read_at timestamptz,
  add column if not exists reservation_failed_at timestamptz,
  add column if not exists reservation_error text;

create unique index if not exists staffing_candidates_reservation_message_id_unique
  on public.staffing_candidates (reservation_message_id)
  where reservation_message_id is not null;
