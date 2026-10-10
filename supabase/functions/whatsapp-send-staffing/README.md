# WhatsApp staffing backend

A Edge Function `whatsapp-send-staffing` envia o template de disponibilidade de vários dias pela WhatsApp Cloud API.

## Segurança

Nenhum token da Meta deve ser salvo no GitHub, em HTML ou JavaScript do navegador.

Configure os valores abaixo em **Supabase Dashboard > Edge Functions > Secrets**:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_MULTIDAY`
- `WHATSAPP_TEMPLATE_LANG` (recomendado: `pt_BR`)
- `META_GRAPH_VERSION`

Opcional:
- `META_GRAPH_BASE_URL` (padrão: `https://graph.facebook.com`)

O nome do template deve ser preenchido somente depois que a Meta aprovar o modelo.

## Chamada

A função recebe somente:

```json
{ "candidate_id": 123 }
```

Ela busca telefone, nome, datas e função diretamente do banco, exige sessão autenticada do Master Admin e registra o ID/status técnico da mensagem em `staffing_candidates`.
