alter table public.staffing_candidates
  add column if not exists clarification_message_text text,
  add column if not exists clarification_message_id text,
  add column if not exists clarification_status text not null default 'not_sent',
  add column if not exists clarification_attempted_at timestamptz,
  add column if not exists clarification_sent_at timestamptz,
  add column if not exists clarification_delivered_at timestamptz,
  add column if not exists clarification_read_at timestamptz,
  add column if not exists clarification_failed_at timestamptz,
  add column if not exists clarification_error text;

create unique index if not exists staffing_candidates_clarification_message_id_unique
  on public.staffing_candidates (clarification_message_id)
  where clarification_message_id is not null;
