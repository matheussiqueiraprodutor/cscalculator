import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER_EMAIL = "matheussiqueiraprodutor@gmail.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeBrazilPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return `55${digits}`;
  throw new Error("WhatsApp do candidato inválido");
}

function formatDateBR(value: string) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_MULTIDAY") || "";
  const templateLang = Deno.env.get("WHATSAPP_TEMPLATE_LANG") || "pt_BR";
  const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "";
  const graphBase = Deno.env.get("META_GRAPH_BASE_URL") || "https://graph.facebook.com";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Configuração interna do Supabase ausente" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await admin.auth.getUser(token);

    if (userError || !userData.user) {
      return json({ error: "Sessão inválida" }, 401);
    }

    if (userData.user.email?.toLowerCase() !== MASTER_EMAIL.toLowerCase()) {
      return json({ error: "Acesso restrito ao Master Admin" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const candidateId = Number(body?.candidate_id);

    if (!Number.isInteger(candidateId) || candidateId <= 0) {
      return json({ error: "candidate_id inválido" }, 400);
    }

    if (!accessToken || !phoneNumberId || !templateName || !graphVersion) {
      return json({
        error: "Integração WhatsApp ainda não configurada",
        missing: [
          !accessToken && "WHATSAPP_ACCESS_TOKEN",
          !phoneNumberId && "WHATSAPP_PHONE_NUMBER_ID",
          !templateName && "WHATSAPP_TEMPLATE_MULTIDAY",
          !graphVersion && "META_GRAPH_VERSION",
        ].filter(Boolean),
      }, 503);
    }

    const { data: candidate, error: candidateError } = await admin
      .from("staffing_candidates")
      .select("id, request_item_id, candidate_name, candidate_whatsapp, status")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return json({ error: "Candidato não encontrado" }, 404);
    }

    if (candidate.status !== "waiting") {
      return json({
        error: "O candidato precisa estar com status waiting antes do envio",
        current_status: candidate.status,
      }, 409);
    }

    const { data: item, error: itemError } = await admin
      .from("staffing_request_items")
      .select("id, request_id, function_id")
      .eq("id", candidate.request_item_id)
      .single();

    if (itemError || !item) throw new Error("Item da solicitação não encontrado");

    const [{ data: staffingRequest, error: requestError }, { data: functionRow, error: functionError }] =
      await Promise.all([
        admin
          .from("staffing_requests")
          .select("id, event_date, event_end_date")
          .eq("id", item.request_id)
          .single(),
        admin
          .from("freelancer_functions")
          .select("id, name")
          .eq("id", item.function_id)
          .single(),
      ]);

    if (requestError || !staffingRequest) throw new Error("Solicitação não encontrada");
    if (functionError || !functionRow) throw new Error("Função não encontrada");

    const startDate = String(staffingRequest.event_date || "").trim();
    const endDate = String(staffingRequest.event_end_date || "").trim();

    if (!startDate || !endDate || startDate === endDate) {
      return json({
        error: "Este endpoint está preparado para o template de vários dias. O template de um dia ainda não foi configurado.",
      }, 409);
    }

    const to = normalizeBrazilPhone(candidate.candidate_whatsapp);
    const candidateName = String(candidate.candidate_name || "").trim();
    const roleName = String(functionRow.name || "").trim();

    if (!candidateName || !roleName) {
      throw new Error("Nome do candidato ou função ausente");
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", parameter_name: "nome", text: candidateName },
              { type: "text", parameter_name: "data_inicio", text: formatDateBR(startDate) },
              { type: "text", parameter_name: "data_fim", text: formatDateBR(endDate) },
              { type: "text", parameter_name: "funcao", text: roleName },
            ],
          },
        ],
      },
    };

    const metaResponse = await fetch(
      `${graphBase.replace(/\/$/, "")}/${graphVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const metaData = await metaResponse.json().catch(() => ({}));

    if (!metaResponse.ok) {
      const technicalError = JSON.stringify(metaData).slice(0, 1800);

      await admin
        .from("staffing_candidates")
        .update({
          whatsapp_status: "failed",
          whatsapp_failed_at: new Date().toISOString(),
          whatsapp_error: technicalError,
        })
        .eq("id", candidateId);

      return json({
        error: "A Meta recusou o envio",
        meta_status: metaResponse.status,
        details: metaData,
      }, 502);
    }

    const messageId = metaData?.messages?.[0]?.id || null;
    const now = new Date().toISOString();

    const { error: updateError } = await admin
      .from("staffing_candidates")
      .update({
        whatsapp_message_id: messageId,
        whatsapp_status: "sent",
        whatsapp_sent_at: now,
        whatsapp_failed_at: null,
        whatsapp_error: null,
        contacted_at: now,
      })
      .eq("id", candidateId);

    if (updateError) throw updateError;

    return json({
      success: true,
      candidate_id: candidateId,
      whatsapp_message_id: messageId,
      whatsapp_status: "sent",
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "Erro interno",
    }, 500);
  }
});
