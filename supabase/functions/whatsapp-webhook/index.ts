import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(value: string) {
  return String(value || "").replace(/\D/g, "");
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
          .select("id,candidate_whatsapp,status,contacted_at")
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

        await admin
          .from("staffing_candidates")
          .update(update)
          .eq("id", candidate.id);
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
});
