alter table public.staffing_candidates
  add column if not exists whatsapp_message_id text,
  add column if not exists whatsapp_status text not null default 'not_sent',
  add column if not exists whatsapp_sent_at timestamptz,
  add column if not exists whatsapp_delivered_at timestamptz,
  add column if not exists whatsapp_read_at timestamptz,
  add column if not exists whatsapp_failed_at timestamptz,
  add column if not exists whatsapp_error text;

create unique index if not exists staffing_candidates_whatsapp_message_id_uidx
  on public.staffing_candidates (whatsapp_message_id)
  where whatsapp_message_id is not null;

comment on column public.staffing_candidates.whatsapp_message_id is 'ID da mensagem retornado pela Meta WhatsApp Cloud API.';
comment on column public.staffing_candidates.whatsapp_status is 'Status técnico do envio WhatsApp, separado do status da fila de staffing.';
comment on column public.staffing_candidates.whatsapp_sent_at is 'Data/hora em que a Meta aceitou o envio.';
comment on column public.staffing_candidates.whatsapp_delivered_at is 'Data/hora de entrega informada pelo webhook.';
comment on column public.staffing_candidates.whatsapp_read_at is 'Data/hora de leitura informada pelo webhook.';
comment on column public.staffing_candidates.whatsapp_failed_at is 'Data/hora de falha informada pela API/webhook.';
comment on column public.staffing_candidates.whatsapp_error is 'Último erro técnico de envio/entrega do WhatsApp.';
