create table if not exists public.whatsapp_inbound_events (
  message_id text primary key,
  sender_whatsapp text not null,
  message_text text not null default '',
  classification text not null default 'unknown'
    check (classification in ('available','unavailable','unknown')),
  staffing_candidate_id bigint references public.staffing_candidates(id) on delete set null,
  received_at timestamptz not null default now()
);

alter table public.whatsapp_inbound_events enable row level security;

revoke all on table public.whatsapp_inbound_events from anon;
revoke all on table public.whatsapp_inbound_events from authenticated;

alter table public.staffing_candidates
  add column if not exists whatsapp_last_inbound_text text,
  add column if not exists whatsapp_last_inbound_at timestamptz,
  add column if not exists whatsapp_last_inbound_message_id text,
  add column if not exists whatsapp_response_classification text;

create unique index if not exists staffing_candidates_last_inbound_message_uidx
  on public.staffing_candidates (whatsapp_last_inbound_message_id)
  where whatsapp_last_inbound_message_id is not null;

comment on table public.whatsapp_inbound_events is
  'Registro idempotente de mensagens recebidas pelo webhook do WhatsApp.';

comment on column public.staffing_candidates.whatsapp_response_classification is
  'Classificação automática da última resposta: available, unavailable ou unknown.';
