
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: cors });
const bad = (message: string, status = 400) => reply({ error: message }, status);
function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function rest(path: string, method = "GET", body?: unknown, prefer = "") {
  const response = await fetch(URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw Error(data?.message || data?.error || "Database operation failed");
  return data;
}
async function authenticatedUser(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const response = await fetch(URL + "/auth/v1/user", {
    headers: { apikey: PUBLIC_KEY, Authorization: auth },
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!uuid(user.id) || !user.email || !user.email_confirmed_at || user.is_anonymous) return null;
  return user;
}
async function ensureOwner(eventId: unknown, userId: string) {
  if (!uuid(eventId)) throw Error("Invalid event");
  const rows = await rest("ss_events?select=id,slug,title,assignments_locked_at,status&id=eq." + eventId +
    "&organizer_auth_user_id=eq." + userId + "&limit=1");
  if (!rows.length) throw Error("Event not found or access denied");
  return rows[0];
}
async function fingerprint(eventId: string, code: string) {
  const secret = new TextEncoder().encode(SERVICE_KEY);
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("vcf-ss-code|" + eventId + "|" + code));
  return Array.from(new Uint8Array(signed), b => b.toString(16).padStart(2, "0")).join("");
}
function newCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(1000 + (bytes[0] % 9000));
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}
const str = (v: unknown, max = 160) => typeof v === "string" ? v.trim().slice(0, max) : "";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  if (req.method !== "POST") return bad("Method not allowed", 405);
  try {
    const user = await authenticatedUser(req);
    if (!user) return bad("Sign in with a confirmed email to manage your events.", 401);
    const input = await req.json();
    const action = str(input.action, 40);
    if (action === "list_events") {
      const data = await rest("ss_events?select=id,slug,title,status,starts_on,ends_on,reveal_at,assignments_locked_at,created_at&organizer_auth_user_id=eq." + user.id + "&order=created_at.desc");
      return reply({ events: data });
    }
    if (action === "create_event") {
      const title = str(input.title);
      if (title.length < 3) return bad("Enter an event name of at least 3 characters.");
      const existing = await rest("ss_events?select=id&organizer_auth_user_id=eq." + user.id + "&limit=6");
      if (existing.length >= 5) return bad("Organizer event limit reached.");
      const eventSlug = slug(title) + "-" + crypto.randomUUID().slice(0, 6);
      const data = await rest("ss_events?select=id,slug,title,status", "POST", {
        title, slug: eventSlug, organizer_auth_user_id: user.id,
        timezone: "Asia/Kolkata",
        gift_budget_recommendation_inr: 500,
        rules: {
          budget_note: "We recommend a thoughtful gift within ₹500. Most importantly, leave warm wishes and make your Secret Child feel special.",
          tasks_optional: true,
        },
        office_layout: {
          version: 1, far_end_window: true, walls: "white",
          workstation_banks: ["single-sided-wall-row", "double-sided-island"],
          spawn: "christmas-tree",
        },
      }, "return=representation");
      return reply({ event: data[0] }, 201);
    }
    const event = await ensureOwner(input.event_id, user.id);
    if (action === "list_participants") {
      const [people, privateRows, assignments] = await Promise.all([
        rest("ss_participants?select=id,display_name,desk_key,is_active,created_at&event_id=eq." + event.id + "&order=created_at.asc"),
        rest("ss_participant_private?select=participant_id,phone_e164&event_id=eq." + event.id),
        rest("ss_assignments?select=id,santa_id,child_id&event_id=eq." + event.id),
      ]);
      const phones = new Map(privateRows.map((p: { participant_id:string; phone_e164:string|null }) => [p.participant_id,p.phone_e164]));
      return reply({ event, participants: people.map((p: {id:string}) => ({...p,phone_e164:phones.get(p.id)||null})), assignments });
    }
    if (action === "add_participant") {
      if (event.assignments_locked_at) return bad("Assignments are locked; the roster can no longer be changed.");
      const name = str(input.display_name);
      const phone = str(input.phone_e164, 20);
      if (!name) return bad("Participant name is required.");
      if (phone && !/^\+[1-9][0-9]{6,14}$/.test(phone)) return bad("Use a full international phone number, e.g. +919876543210.");
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = newCode();
        const hash = await fingerprint(event.id, code);
        try {
          const id = await rest("rpc/ss_register_participant", "POST", {
            p_event_id: event.id, p_display_name: name,
            p_phone_e164: phone || null, p_desk_key: str(input.desk_key, 30) || null,
            p_code_fingerprint: hash,
          });
          return reply({ id, code }, 201);
        } catch (error) {
          const e = String(error);
          if (!e.includes("duplicate key") && !e.includes("unique constraint")) throw error;
        }
      }
      return bad("Unable to generate a unique code. Try again.");
    }
    if (action === "edit_participant") {
      if (event.assignments_locked_at) return bad("Roster is locked. Changes are disabled after Santa assignments.");
      if (!uuid(input.participant_id)) return bad("Invalid participant.");
      const name = str(input.display_name);
      const phone = str(input.phone_e164, 20);
      if (!name) return bad("Participant name is required.");
      if (phone && !/^\+[1-9][0-9]{6,14}$/.test(phone)) return bad("Invalid phone number.");
      const id = input.participant_id;
      await rest("ss_participants?id=eq." + id + "&event_id=eq." + event.id, "PATCH",
        { display_name: name, desk_key: str(input.desk_key,30)||null, is_active: !!input.is_active, updated_at: new Date().toISOString() });
      await rest("ss_participant_private?participant_id=eq." + id + "&event_id=eq." + event.id, "PATCH",
        { phone_e164: phone || null, updated_at: new Date().toISOString() });
      return reply({ ok:true });
    }
    if (action === "rotate_code") {
      if (!uuid(input.participant_id)) return bad("Invalid participant.");
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = newCode();
        const hash = await fingerprint(event.id, code);
        try {
          await rest("rpc/ss_rotate_access_code","POST",{
            p_event_id: event.id,p_participant_id: input.participant_id,p_new_fingerprint: hash,
          });
          return reply({ code });
        } catch (error) {
          const e = String(error);
          if (!e.includes("duplicate key") && !e.includes("unique constraint")) throw error;
        }
      }
      return bad("Unable to generate a unique code. Try again.");
    }
    if (action === "lock_assignments") {
      const count = await rest("rpc/ss_lock_assignments", "POST", {p_event_id:event.id});
      return reply({ assigned:count });
    }
    return bad("Unknown action");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return bad(message, 400);
  }
});
