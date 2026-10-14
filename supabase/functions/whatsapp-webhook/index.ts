import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  return digits;
}

function formatDateBR(value: string) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

function buildReservationMessage(candidateName: string, startDate: string, endDate: string) {
  const firstName = String(candidateName || "").trim().split(/\s+/)[0] || "tudo bem";
  const start = formatDateBR(startDate);
  const end = formatDateBR(endDate || startDate);

  if (!end || end === start) {
    return `Perfeito, ${firstName}! Pode reservar para nós a data de ${start}. Em breve envio mais informações sobre o evento. Obrigado!`;
  }

  return `Perfeito, ${firstName}! Pode reservar para nós as datas de ${start} até ${end}. Em breve envio mais informações sobre o evento. Obrigado!`;
}

function normalizeText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyReply(value: string): "available" | "unavailable" | "unknown" {
  const t = normalizeText(value);
  if (!t) return "unknown";

  const ambiguousPatterns = [
    /^talvez$/,
    /\bme chama depois\b/,
    /\bme chame depois\b/,
    /\bfala comigo depois\b/,
    /\bqual horario\b/,
    /\bque horario\b/,
    /\bqual o horario\b/,
    /\bdepende\b/,
    /\bnao sei\b/,
    /\bpreciso confirmar\b/,
    /\bte aviso\b/,
  ];

  if (ambiguousPatterns.some((re) => re.test(t))) return "unknown";

  const negativePatterns = [
    /^nao$/,
    /\bnao posso\b/,
    /\bnao consigo\b/,
    /\bnao tenho disponibilidade\b/,
    /\bindisponivel\b/,
    /\bsem disponibilidade\b/,
  ];

  if (negativePatterns.some((re) => re.test(t))) return "unavailable";

  const positivePatterns = [
    /^sim$/,
    /\btenho disponibilidade\b/,
    /\bestou disponivel\b/,
    /\bposso sim\b/,
    /\bconsigo sim\b/,
    /\bconfirmo\b/,
    /^disponivel$/,
  ];

  if (positivePatterns.some((re) => re.test(t))) return "available";

  return "unknown";
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice(7).toLowerCase();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );

  const actualHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(actualHex, expectedHex);
}

Deno.serve(async (req) => {
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
  const appSecret = Deno.env.get("META_APP_SECRET") || "";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && verifyToken && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "";
  const graphBase = Deno.env.get("META_GRAPH_BASE_URL") || "https://graph.facebook.com";

  if (!supabaseUrl || !serviceRoleKey || !appSecret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await req.text();

  const validSignature = await verifyMetaSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
    appSecret,
  );

  if (!validSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload?.object !== "whatsapp_business_account") {
    return new Response("Ignored", { status: 200 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};

      for (const status of value?.statuses || []) {
        const messageId = status?.id;
        const statusName = String(status?.status || "");
        if (!messageId) continue;

        const update: Record<string, unknown> = { whatsapp_status: statusName };
        const eventTs = status?.timestamp
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        if (statusName === "sent") update.whatsapp_sent_at = eventTs;
        if (statusName === "delivered") update.whatsapp_delivered_at = eventTs;
        if (statusName === "read") update.whatsapp_read_at = eventTs;

        if (statusName === "failed") {
          update.whatsapp_failed_at = eventTs;
          update.whatsapp_error = JSON.stringify(status?.errors || []).slice(0, 1800);
        }

        await admin
          .from("staffing_candidates")
          .update(update)
          .eq("whatsapp_message_id", messageId);

        const reservationUpdate: Record<string, unknown> = { reservation_status: statusName };
        if (statusName === "sent") reservationUpdate.reservation_sent_at = eventTs;
        if (statusName === "delivered") reservationUpdate.reservation_delivered_at = eventTs;
        if (statusName === "read") reservationUpdate.reservation_read_at = eventTs;
        if (statusName === "failed") {
          reservationUpdate.reservation_failed_at = eventTs;
          reservationUpdate.reservation_error = JSON.stringify(status?.errors || []).slice(0, 1800);
        }

        await admin
          .from("staffing_candidates")
          .update(reservationUpdate)
          .eq("reservation_message_id", messageId);
      }

      for (const message of value?.messages || []) {
        const messageId = String(message?.id || "");
        const from = normalizePhone(message?.from || "");
        if (!messageId || !from) continue;

        const messageText =
          String(message?.text?.body || message?.button?.text || "").trim();

        const classification = classifyReply(messageText);

        const { data: existing } = await admin
          .from("whatsapp_inbound_events")
          .select("message_id")
          .eq("message_id", messageId)
          .maybeSingle();

        if (existing) continue;

        const { data: waitingCandidates } = await admin
          .from("staffing_candidates")
          .select("id,request_item_id,candidate_name,candidate_whatsapp,status,contacted_at,reservation_message_id,reservation_status")
          .eq("status", "waiting")
          .order("contacted_at", { ascending: false })
          .limit(200);

        const candidate = (waitingCandidates || []).find((row: any) => {
          return normalizePhone(row.candidate_whatsapp || "") === from;
        });

        await admin.from("whatsapp_inbound_events").insert({
          message_id: messageId,
          sender_whatsapp: from,
          message_text: messageText,
          classification,
          staffing_candidate_id: candidate?.id || null,
          received_at: message?.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
        });

        if (!candidate) continue;

        const now = message?.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        const update: Record<string, unknown> = {
          whatsapp_last_inbound_text: messageText,
          whatsapp_last_inbound_at: now,
          whatsapp_last_inbound_message_id: messageId,
          whatsapp_response_classification: classification,
        };

        if (classification === "available") {
          update.status = "available";
          update.responded_at = now;
        } else if (classification === "unavailable") {
          update.status = "unavailable";
          update.responded_at = now;
        }

        const { error: candidateUpdateError } = await admin
          .from("staffing_candidates")
          .update(update)
          .eq("id", candidate.id);

        if (candidateUpdateError) {
          console.error("Erro ao atualizar resposta do freelancer:", candidateUpdateError);
          continue;
        }

        if (
          classification === "available" &&
          !candidate.reservation_message_id &&
          candidate.reservation_status !== "sent"
        ) {
          const reservationNow = new Date().toISOString();

          try {
            if (!accessToken || !phoneNumberId || !graphVersion) {
              throw new Error("Integração WhatsApp incompleta para envio da confirmação de reserva.");
            }

            const { data: item, error: itemError } = await admin
              .from("staffing_request_items")
              .select("request_id")
              .eq("id", candidate.request_item_id)
              .single();

            if (itemError || !item) throw new Error("Item da solicitação não encontrado.");

            const { data: staffingRequest, error: requestError } = await admin
              .from("staffing_requests")
              .select("event_date,event_end_date,is_test")
              .eq("id", item.request_id)
              .single();

            if (requestError || !staffingRequest) throw new Error("Solicitação não encontrada.");
            if (staffingRequest.is_test) continue;

            const reservationText = buildReservationMessage(
              candidate.candidate_name,
              staffingRequest.event_date,
              staffingRequest.event_end_date,
            );

            const metaResponse = await fetch(
              `${graphBase.replace(/\/$/, "")}/${graphVersion}/${phoneNumberId}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: from,
                  type: "text",
                  text: {
                    preview_url: false,
                    body: reservationText,
                  },
                }),
              },
            );

            const metaData = await metaResponse.json().catch(() => ({}));

            if (!metaResponse.ok) {
              throw new Error(
                `Meta recusou confirmação de reserva (${metaResponse.status}): ${JSON.stringify(metaData).slice(0, 1200)}`,
              );
            }

            const reservationMessageId = metaData?.messages?.[0]?.id || null;

            await admin
              .from("staffing_candidates")
              .update({
                reservation_message_text: reservationText,
                reservation_message_id: reservationMessageId,
                reservation_status: "sent",
                reservation_sent_at: reservationNow,
                reservation_failed_at: null,
                reservation_error: null,
              })
              .eq("id", candidate.id);
          } catch (reservationError) {
            console.error("Falha no envio automático da confirmação de reserva:", reservationError);

            await admin
              .from("staffing_candidates")
              .update({
                reservation_status: "failed",
                reservation_failed_at: reservationNow,
                reservation_error:
                  reservationError instanceof Error
                    ? reservationError.message.slice(0, 1800)
                    : String(reservationError).slice(0, 1800),
              })
              .eq("id", candidate.id);
          }
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});
