import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VAPID_SUBJECT = "https://mientrevista.online";

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function ensureVapidKeys() {
  const currentPublic = await admin.rpc("push_vapid_public_key");
  let publicKey = typeof currentPublic.data === "string" ? currentPublic.data : null;

  if (!publicKey) {
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"],
    );

    const publicRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const generatedPublic = base64Url(publicRaw);
    const generatedPrivate = privateJwk.d || "";

    if (!generatedPrivate) throw new Error("No se pudo generar la clave privada VAPID.");

    const initialized = await admin.rpc("initialize_push_vapid", {
      p_public_key: generatedPublic,
      p_private_key: generatedPrivate,
    });
    if (initialized.error) throw initialized.error;
    publicKey = typeof initialized.data === "string" ? initialized.data : generatedPublic;
  }

  const privateResult = await admin.rpc("push_vapid_private_key");
  if (privateResult.error) throw privateResult.error;
  const privateKey = typeof privateResult.data === "string" ? privateResult.data : null;

  if (!publicKey || !privateKey) {
    throw new Error("La configuración VAPID no está disponible.");
  }

  return { publicKey, privateKey };
}

async function authenticatedUser(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

function memberPayload(status: string, eventType: string) {
  if (eventType === "created") {
    return {
      title: "Solicitud recibida",
      body: "Recibimos tu solicitud de entrevista. Secretaría la revisará.",
    };
  }

  const messages: Record<string, { title: string; body: string }> = {
    pending_secretary: {
      title: "Solicitud en revisión",
      body: "Tu solicitud volvió a Secretaría para continuar su revisión.",
    },
    contacted: {
      title: "Secretaría revisó tu solicitud",
      body: "Tu solicitud fue recibida y continúa con el proceso.",
    },
    pending_leader: {
      title: "Solicitud enviada al líder",
      body: "Secretaría envió tu solicitud al líder para su confirmación.",
    },
    approved: {
      title: "Entrevista aprobada",
      body: "El líder confirmó tu solicitud. Revisa el estado en Mis entrevistas.",
    },
    rejected: {
      title: "Solicitud rechazada",
      body: "Tu solicitud fue rechazada. Puedes revisar el estado en Mis entrevistas.",
    },
    reschedule: {
      title: "Reprogramación necesaria",
      body: "Tu solicitud necesita un nuevo horario. Revisa Mis entrevistas.",
    },
    completed: {
      title: "Entrevista completada",
      body: "Tu entrevista fue marcada como completada.",
    },
    cancelled: {
      title: "Solicitud cancelada",
      body: "Tu solicitud de entrevista fue cancelada.",
    },
  };

  return messages[status] || {
    title: "Actualización de entrevista",
    body: "El estado de tu solicitud cambió. Revisa Mis entrevistas.",
  };
}

function staffPayload(kind: "new" | "leader_review" | "leader_confirmed") {
  if (kind === "new") {
    return {
      title: "Nueva solicitud de entrevista",
      body: "Hay una nueva solicitud pendiente en el sistema.",
    };
  }
  if (kind === "leader_review") {
    return {
      title: "Solicitud lista para revisar",
      body: "Secretaría envió una solicitud para tu confirmación.",
    };
  }
  return {
    title: "Entrevista confirmada por el líder",
    body: "Un líder aprobó una solicitud de entrevista.",
  };
}

type PushMessage = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

async function subscriptionsForUsers(userIds: string[]) {
  if (!userIds.length) return [];
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth_key")
    .in("user_id", [...new Set(userIds)]);
  if (error) throw error;
  return data || [];
}

async function secretaryIds(unitId: string | null) {
  const ids = new Set<string>();

  if (unitId) {
    const { data } = await admin
      .from("unit_staff_assignments")
      .select("profile_id,role")
      .eq("church_unit_id", unitId)
      .eq("is_active", true)
      .eq("role", "secretary");
    for (const row of data || []) if (row.profile_id) ids.add(row.profile_id);
  }

  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "secretary_admin")
    .eq("is_active", true);
  for (const row of admins || []) if (row.id) ids.add(row.id);

  return [...ids];
}

async function sendToUser(userId: string, message: PushMessage, vapid: { publicKey: string; privateKey: string }) {
  const subscriptions = await subscriptionsForUsers([userId]);
  let sent = 0;
  let removed = 0;
  const errors: string[] = [];

  webpush.setVapidDetails(VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_key,
          },
        },
        JSON.stringify(message),
        { TTL: 60 * 60 * 12 },
      );
      sent += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        removed += 1;
      } else {
        errors.push(String((error as Error)?.message || error).slice(0, 240));
      }
    }
  }

  return { sent, removed, errors };
}

async function dispatchEvent(eventId: string, token: string) {
  const { data: event, error: eventError } = await admin
    .from("push_events")
    .select("id,appointment_id,event_type,status,dispatch_token,dispatched_at")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw eventError;
  if (!event || String(event.dispatch_token) !== String(token)) {
    return new Response(JSON.stringify({ error: "Invalid event token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  if (event.dispatched_at) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  }

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("id,status,request_code,member_user_id,church_unit_id,assigned_profile_id")
    .eq("id", event.appointment_id)
    .maybeSingle();

  if (appointmentError || !appointment) {
    const message = appointmentError?.message || "Appointment not found";
    await admin.from("push_events").update({ last_error: message }).eq("id", event.id);
    throw new Error(message);
  }

  const vapid = await ensureVapidKeys();
  const deliveries: Array<{ userId: string; message: PushMessage }> = [];
  const memberId = appointment.member_user_id as string | null;
  const leaderId = appointment.assigned_profile_id as string | null;
  const secretaries = await secretaryIds(appointment.church_unit_id as string | null);

  const member = memberPayload(event.status, event.event_type);
  if (memberId) {
    deliveries.push({
      userId: memberId,
      message: {
        ...member,
        url: "/index.html?v=4.4.0&view=appointments",
        tag: "appointment-" + appointment.id,
      },
    });
  }

  if (event.event_type === "created") {
    const staffMessage = staffPayload("new");
    for (const userId of new Set([...secretaries, ...(leaderId ? [leaderId] : [])])) {
      deliveries.push({
        userId,
        message: {
          ...staffMessage,
          url: "/panel.html?v=4.4.0&view=requests",
          tag: "appointment-" + appointment.id,
        },
      });
    }
  } else if (event.status === "pending_leader" && leaderId) {
    const staffMessage = staffPayload("leader_review");
    deliveries.push({
      userId: leaderId,
      message: {
        ...staffMessage,
        url: "/panel.html?v=4.4.0&view=requests",
        tag: "appointment-" + appointment.id,
      },
    });
  } else if (event.status === "approved") {
    const staffMessage = staffPayload("leader_confirmed");
    for (const userId of secretaries) {
      deliveries.push({
        userId,
        message: {
          ...staffMessage,
          url: "/panel.html?v=4.4.0&view=requests",
          tag: "appointment-" + appointment.id,
        },
      });
    }
  }

  const byUser = new Map<string, PushMessage>();
  for (const delivery of deliveries) {
    if (!byUser.has(delivery.userId)) byUser.set(delivery.userId, delivery.message);
  }

  let sent = 0;
  let removed = 0;
  const errors: string[] = [];

  for (const [userId, message] of byUser.entries()) {
    const result = await sendToUser(userId, message, vapid);
    sent += result.sent;
    removed += result.removed;
    errors.push(...result.errors);
  }

  await admin
    .from("push_events")
    .update({
      dispatched_at: new Date().toISOString(),
      last_error: errors.length ? errors.join(" | ").slice(0, 1000) : null,
    })
    .eq("id", event.id);

  // Limpieza oportunista de eventos antiguos ya procesados.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await admin.from("push_events").delete().lt("created_at", cutoff).not("dispatched_at", "is", null);

  return new Response(JSON.stringify({ ok: true, sent, removed, recipients: byUser.size }), {
    status: 200,
    headers: jsonHeaders,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "config") {
      const user = await authenticatedUser(req);
      if (!user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: jsonHeaders,
        });
      }

      const vapid = await ensureVapidKeys();
      return new Response(JSON.stringify({ publicKey: vapid.publicKey }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (action === "dispatch") {
      const eventId = String(body?.event_id || "");
      const token = String(body?.token || "");
      if (!eventId || !token) {
        return new Response(JSON.stringify({ error: "Missing event credentials" }), {
          status: 400,
          headers: jsonHeaders,
        });
      }
      return await dispatchEvent(eventId, token);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("push-notifications", error);
    return new Response(JSON.stringify({
      error: String((error as Error)?.message || error).slice(0, 500),
    }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
