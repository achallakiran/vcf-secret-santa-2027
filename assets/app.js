const SUPABASE_URL = "https://fwrievuhudjkeffmszqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SJo2kgXdHNFZI65iAvQmxw_q56zuVLO";
const SESSION_KEY = "vcf_ss_organizer_session";
const $ = (id) => document.getElementById(id);
const param = new URLSearchParams(location.search);
let session = null;
let events = [];
let activeEvent = null;
let people = [];
let assignments = [];
const shownCodes = new Map();
let loading = false;
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.background = isError ? "#ffe9df" : "#e9f3e8";
  el.style.color = isError ? "#803326" : "#173824";
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add("hidden"), 5200);
}
function setBusy(busy) {
  loading = busy;
  // Keep each button's own authorization and validation disabled state intact.
  document.body.classList.toggle("processing", busy);
}
function withBusy(action) {
  return async function (...args) {
    if (loading) return;
    setBusy(true);
    try { await action(...args); }
    catch (error) { toast(error?.message || "Something went wrong.", true); }
    finally { setBusy(false); }
  };
}
async function request(path, options = {}) {
  const resp = await fetch(SUPABASE_URL + path, {
    ...options,
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw Error(data.error_description || data.msg || data.error || data.message || ("Request failed (" + resp.status + ")"));
  return data;
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
  paintAuth();
}
async function renewSession() {
  if (!session?.refresh_token) throw Error("Please sign in again.");
  try {
    const result = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    saveSession(result);
  } catch (error) {
    saveSession(null);
    throw error;
  }
}
async function organizerApi(action, values = {}, retry = true) {
  if (!session?.access_token) throw Error("Please sign in.");
  if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) await renewSession();
  const resp = await fetch(SUPABASE_URL + "/functions/v1/ss-organizer", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": "Bearer " + session.access_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...values }),
  });
  const result = await resp.json().catch(() => ({}));
  if (resp.status === 401 && retry) {
    await renewSession();
    return organizerApi(action, values, false);
  }
  if (!resp.ok) throw Error(result.error || "Organizer request failed.");
  return result;
}
function paintAuth() {
  const signedIn = !!session?.access_token;
  $("auth-area").classList.toggle("hidden", signedIn);
  $("dashboard").classList.toggle("hidden", !signedIn);
  $("sign-out").classList.toggle("hidden", !signedIn);
  $("signed-in-user").textContent = signedIn ? (session.user?.email || "Signed in") : "";
  if (!signedIn) {
    events = []; activeEvent = null; people = []; assignments = [];
    shownCodes.clear(); $("event-workspace").classList.add("hidden");
  }
}
async function refreshEvents() {
  const result = await organizerApi("list_events");
  events = result.events || [];
  paintEvents();
  if (activeEvent) {
    const match = events.find(e => e.id === activeEvent.id);
    if (match) await selectEvent(match);
    else { activeEvent = null; $("event-workspace").classList.add("hidden"); }
  }
}
function paintEvents() {
  const root = $("event-list");
  root.replaceChildren();
  if (!events.length) {
    root.append(node("p", "muted", "No events yet. Create your first Christmas celebration above."));
    return;
  }
  for (const e of events) {
    const card = node("div", "event-card");
    const details = node("div");
    details.append(node("strong", "", e.title));
    details.append(node("small", "", e.slug + " · " + e.status));
    const button = node("button", "small-outline", activeEvent?.id === e.id ? "Selected ✓" : "Manage event →");
    button.type = "button";
    button.addEventListener("click", withBusy(async () => await selectEvent(e)));
    card.append(details, button);
    root.append(card);
  }
}
async function selectEvent(event) {
  activeEvent = event;
  const data = await organizerApi("list_participants", {event_id:event.id});
  activeEvent = {...event, ...data.event};
  people = data.participants || [];
  assignments = data.assignments || [];
  $("workspace-title").textContent = activeEvent.title;
  $("workspace-slug").textContent = "Shareable game URL: " + location.origin + location.pathname + "?event=" + activeEvent.slug;
  $("workspace-state").textContent = activeEvent.assignments_locked_at ? "ASSIGNMENTS LOCKED" : "DRAFT";
  $("event-workspace").classList.remove("hidden");
  paintStats(); paintPeople(); paintAssignments(); paintEvents();
  $("participant-form").querySelectorAll("input").forEach(i => {i.disabled = !!activeEvent.assignments_locked_at;});
  $("participant-form").querySelector("button").disabled = !!activeEvent.assignments_locked_at;
  $("assign-btn").disabled = !!activeEvent.assignments_locked_at || people.filter(p=>p.is_active).length<2;
}
function paintStats() {
  $("people-count").textContent = people.length;
  $("assignment-count").textContent = assignments.length;
  $("invite-count").textContent = shownCodes.size;
}
function messageForPerson(p) {
  const code = shownCodes.get(p.id);
  if (!code) throw Error("Regenerate this person's code before sharing.");
  const gameUrl = location.origin + location.pathname + "?event=" + activeEvent.slug;
  return "🎄 *Voxel Secret Santa* 🎁\n\nJoin our Christmas office mystery! Visit the link and enter your own 4-digit code.\n\n🎮 " +
    gameUrl + "\n🔐 Your private code: *" + code + "*\n\nKeep your code private. Share good wishes and make your Secret Child feel special! 🎅";
}
function paintPeople() {
  const root = $("participant-rows");
  root.replaceChildren();
  if (!people.length) {
    const row = node("tr"); const cell = node("td", "muted", "No employees yet. Add your first participant above.");
    cell.colSpan = 5; row.append(cell); root.append(row);
  }
  for (const p of people) {
    const row = node("tr");
    row.append(node("td", "", p.display_name + (p.is_active ? "" : " (inactive)")));
    row.append(node("td", "", p.desk_key || "—"));
    const codeCell = node("td");
    const code = shownCodes.get(p.id);
    const codeLabel = node("code", "", code || "••••");
    codeCell.append(codeLabel); row.append(codeCell);
    const inviteCell = node("td");
    const share = node("button", "small-outline", "WhatsApp ↗");
    share.type = "button";
    share.disabled = !code || !p.phone_e164;
    share.title = !code ? "Regenerate code first" : (!p.phone_e164 ? "Add a phone number to use WhatsApp" : "Open WhatsApp with a prefilled message");
    share.addEventListener("click", () => {
      try {
        const url = "https://wa.me/" + p.phone_e164.replace(/\D/g,"") + "?text=" + encodeURIComponent(messageForPerson(p));
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) { toast(error.message, true); }
    });
    const copy = node("button", "small-outline", "Copy");
    copy.type = "button"; copy.disabled = !code;
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(messageForPerson(p)); toast("Invite copied."); }
      catch { toast("Copy failed. Use your browser's clipboard permissions.", true); }
    });
    inviteCell.append(share, copy); row.append(inviteCell);
    const actions = node("td");
    const edit = node("button", "small-outline", "Edit");
    edit.type = "button"; edit.disabled = !!activeEvent.assignments_locked_at;
    edit.addEventListener("click", withBusy(async () => {
      const name = prompt("Employee name", p.display_name);
      if (name === null) return;
      const phone = prompt("International WhatsApp number (or blank)", p.phone_e164 || "");
      if (phone === null) return;
      const desk = prompt("Desk identifier (or blank)", p.desk_key || "");
      if (desk === null) return;
      await organizerApi("edit_participant",{
        event_id:activeEvent.id,participant_id:p.id,display_name:name,
        phone_e164:phone,desk_key:desk,is_active:p.is_active,
      });
      toast("Employee updated.");
      await selectEvent(activeEvent);
    }));
    const rotate = node("button", "small-outline", "New code");
    rotate.type="button";
    rotate.addEventListener("click", withBusy(async () => {
      if (!confirm("Regenerate the code for " + p.display_name + "? Their previous code will stop working.")) return;
      const res = await organizerApi("rotate_code",{event_id:activeEvent.id,participant_id:p.id});
      shownCodes.set(p.id,res.code);
      toast("New code generated. Send it privately.");
      paintStats();paintPeople();
    }));
    actions.append(edit,rotate);row.append(actions);root.append(row);
  }
}
function paintAssignments() {
  const root = $("pair-list");
  root.replaceChildren();
  $("assignment-details").classList.toggle("hidden", assignments.length===0);
  const lookup = new Map(people.map(p=>[p.id,p.display_name]));
  for (const a of assignments) {
    root.append(node("div", "", (lookup.get(a.santa_id)||"Unknown") + " → " + (lookup.get(a.child_id)||"Unknown")));
  }
}
function makeSnow() {
  const root=$("snow");
  const count=matchMedia("(max-width: 650px)").matches?40:75;
  for(let i=0;i<count;i++){
    const flake=node("span","flake",Math.random()>.78?"✧":"·");
    flake.style.setProperty("--x",Math.random()*100+"%");
    flake.style.setProperty("--opacity",(.15+Math.random()*.65).toFixed(2));
    flake.style.setProperty("--size",(9+Math.random()*18)+"px");
    flake.style.setProperty("--speed",(8+Math.random()*13)+"s");
    flake.style.setProperty("--delay",(-Math.random()*18)+"s");
    flake.style.setProperty("--drift",(-80+Math.random()*160)+"px");
    root.append(flake);
  }
}
$("entry-code").addEventListener("input", e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,4);});
$("entry-form").addEventListener("submit",e=>{
  e.preventDefault();
  $("entry-note").textContent = "The office entrance is not activated yet. Your organizer can already create and distribute invitation codes.";
});
$("auth-form").addEventListener("submit",withBusy(async e=>{
  e.preventDefault();
  const email=$("auth-email").value.trim();
  const password=$("auth-password").value;
  const result=await request("/auth/v1/token?grant_type=password",{
    method:"POST",body:JSON.stringify({email,password})
  });
  saveSession(result);
  $("auth-password").value="";
  await refreshEvents();
  toast("Welcome back, organizer.");
}));
$("register-btn").addEventListener("click",withBusy(async()=>{
  const email=$("auth-email").value.trim();
  const password=$("auth-password").value;
  if(!email||password.length<8) throw Error("Enter a valid email and a password of at least 8 characters.");
  const result=await request("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password})});
  if(result.access_token){saveSession(result);await refreshEvents();}
  else toast("Account submitted. Confirm your email if Supabase sends a verification link, then sign in.");
}));
$("sign-out").addEventListener("click",async()=>{
  const token=session?.access_token;
  saveSession(null);
  if(token) await request("/auth/v1/logout",{method:"POST",headers:{"Authorization":"Bearer "+token}}).catch(()=>{});
});
$("refresh-events").addEventListener("click",withBusy(refreshEvents));
$("event-form").addEventListener("submit",withBusy(async e=>{
  e.preventDefault();
  const title=$("event-name").value.trim();
  const response=await organizerApi("create_event",{title});
  $("event-name").value="";
  toast("Event created.");
  await refreshEvents();
  await selectEvent(response.event);
}));
$("participant-form").addEventListener("submit",withBusy(async e=>{
  e.preventDefault();
  if(!activeEvent) throw Error("Select an event.");
  const name=$("participant-name").value.trim();
  const phone=$("participant-phone").value.trim();
  const desk=$("participant-desk").value.trim();
  const result=await organizerApi("add_participant",{
    event_id:activeEvent.id,display_name:name,phone_e164:phone,desk_key:desk
  });
  shownCodes.set(result.id,result.code);
  $("participant-form").reset();
  await selectEvent(activeEvent);
  toast("Participant created. The new code is visible in this session; share it privately.");
}));
$("assign-btn").addEventListener("click",withBusy(async()=>{
  if(!activeEvent) return;
  if(!confirm("Generate and permanently lock Santa–Child assignments for " + activeEvent.title + "? You cannot edit the roster afterward.")) return;
  const data=await organizerApi("lock_assignments",{event_id:activeEvent.id});
  toast(data.assigned + " Santa–Child pairs generated.");
  await refreshEvents();
}));
async function start() {
  makeSnow();
  if(param.has("admin")) {$("admin").classList.remove("hidden");$("welcome").classList.add("hidden");}
  try {
    const existing=sessionStorage.getItem(SESSION_KEY);
    if(existing) {
      const restored=JSON.parse(existing);
      if(restored?.access_token && restored.refresh_token) {
        session=restored;
        paintAuth();
        await refreshEvents();
      }
    }
  } catch(error) {
    saveSession(null);
    toast("Your organizer session expired. Please sign in again.",true);
  }
}
start();
