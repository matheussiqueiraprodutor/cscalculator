# WhatsApp webhook

A Edge Function `whatsapp-webhook` recebe callbacks da Meta.

## O que ela faz

- responde ao desafio GET usado pela Meta para validar a Callback URL;
- valida a assinatura `X-Hub-Signature-256` dos POSTs com o App Secret;
- atualiza os status de entrega: `sent`, `delivered`, `read` e `failed`;
- registra mensagens recebidas de forma idempotente em `whatsapp_inbound_events`;
- localiza o candidato em `waiting` pelo WhatsApp;
- classifica respostas claras como `available` ou `unavailable`;
- respostas ambíguas ficam como `unknown` e não alteram o status da fila.

## Secrets necessários

Configurar em Supabase > Edge Functions > Secrets:

- `WHATSAPP_VERIFY_TOKEN` — valor criado por você e repetido na configuração do webhook da Meta;
- `META_APP_SECRET` — App Secret do app Hive pro na Meta.

Nunca salve esses valores no GitHub nem no JavaScript do navegador.

## Comportamento da fila

Quando uma resposta é marcada como `unavailable`, o próximo profissional continua `pending`.
A tela `equipe.html` já recalcula automaticamente qual candidato fica liberado para aprovação, preservando o fluxo de aprovação humana antes de disparar a próxima mensagem.
