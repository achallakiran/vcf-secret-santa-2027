const SUPABASE_URL = "https://fwrievuhudjkeffmszqf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_SJo2kgXdHNFZI65iAvQmxw_q56zuVLO";
const SESSION_KEY = "vcf_ss_pin_admin_session";
const PLAYER_KEY = "vcf_ss_player_session";
const $ = (id) => document.getElementById(id);
const param = new URLSearchParams(location.search);
let session = null;
let playerSession = null;
let playerData = null;
let showChild = false;
let hintTimeout = null;
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
    if (args[0]?.type === "submit" && args[0]?.preventDefault) args[0].preventDefault();
    if (loading) return;
    setBusy(true);
    try { await action(...args); }
    catch (error) { toast(error?.message || "Something went wrong.", true); }
    finally { setBusy(false); }
  };
}
async function gateway(action, values = {}, token = null) {
  const response = await fetch(SUPABASE_URL + "/functions/v1/ss-gateway", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      ...(token ? {"Authorization":"Bearer "+token} : {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action, ...values })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      if (session?.token === token) saveSession(null);
      if (playerSession?.token === token) clearPlayerSession();
    }
    throw Error(result.error || "Request failed ("+response.status+").");
  }
  return result;
}
function saveSession(value) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
  paintAuth();
}
function clearPlayerSession() {
  playerSession = null;
  playerData = null;
  sessionStorage.removeItem(PLAYER_KEY);
  $("player").classList.add("hidden");
  if(!param.has("admin")) $("welcome").classList.remove("hidden");
}
function organizerApi(action, values = {}) {
  if (!session?.token) throw Error("Enter your administrator PIN to continue.");
  return gateway(action, values, session.token);
}
function playerApi(action, values = {}) {
  if (!playerSession?.token) throw Error("Enter your invitation code to continue.");
  return gateway(action, values, playerSession.token);
}
function paintAuth() {
  const signedIn = !!session?.token;
  $("auth-area").classList.toggle("hidden", signedIn);
  $("dashboard").classList.toggle("hidden", !signedIn);
  $("sign-out").classList.toggle("hidden", !signedIn);
  $("signed-in-user").textContent = signedIn ? "Admin session active · expires after 8 hours" : "";
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
$("entry-code").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g,"").slice(0,4); });
$("entry-form").addEventListener("submit", withBusy(async e => {
  e.preventDefault();
  const slug = param.get("event");
  if (!slug) throw Error("Open the event-specific invitation link shared by your organizer, then enter your code.");
  const result = await gateway("player_login", {event_slug:slug,code:$("entry-code").value});
  playerSession = result;
  sessionStorage.setItem(PLAYER_KEY,JSON.stringify(result));
  $("entry-code").value = "";
  await openPlayer();
}));
$("auth-form").addEventListener("submit", withBusy(async e => {
  e.preventDefault();
  const result = await gateway("admin_login", {pin:$("admin-pin").value});
  $("admin-pin").value = "";
  saveSession(result);
  await refreshEvents();
  toast("Organizer console unlocked.");
}));
$("pin-change-form").addEventListener("submit", withBusy(async e => {
  e.preventDefault();
  const result = await organizerApi("change_admin_pin", {
    current_pin:$("current-pin").value,new_pin:$("new-pin").value
  });
  saveSession(result);
  $("pin-change-form").reset();
  toast("Administrator PIN changed. Older sessions are now invalid.");
}));
$("sign-out").addEventListener("click", () => {
  saveSession(null);
  toast("Organizer console locked.");
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

// The player has no Supabase account: only an event-scoped invitation code.
async function openPlayer() {
  const data=await playerApi("player_dashboard");
  playerData=data;
  $("welcome").classList.add("hidden");
  $("player").classList.remove("hidden");
  $("player-greeting").textContent="✦ "+data.me.display_name;
  $("player-event-title").textContent=data.event.title;
  $("player-menu").classList.add("hidden");
  $("player-pause").textContent="Ⅱ";
  $("personal-name").textContent=data.me.display_name;
  $("task-date").min=data.today;
  $("task-date").value=data.today;
  $("santa-message").value=data.myChild?.message||"";
  $("gift-purchased").checked=!!data.myChild?.gift_purchased;
  showChild=false;
  $("child-toggle").textContent="◉ Reveal";
  $("child-name").textContent=data.myChild ? "Name hidden" : "Assignments not generated yet";
  renderPersonal();
}
async function refreshPlayer() {
  playerData=await playerApi("player_dashboard");
  renderPersonal();
}
function renderPersonal(){
  if(!playerData)return;
  const data=playerData;
  const wishRoot=$("wishlist-items");
  wishRoot.replaceChildren();
  const list=data.me.wishlist||[];
  if(!list.length)wishRoot.append(node("p","muted","Your wishlist is empty."));
  for(const item of list){
    const row=node("div","personal-item");
    row.append(node("span","",item.text));
    const remove=node("button","small-outline","✕");
    remove.type="button";remove.title="Remove this wish";
    remove.addEventListener("click",withBusy(async()=>{
      const items=(playerData.me.wishlist||[]).filter(x=>x.id!==item.id);
      const res=await playerApi("save_wishlist",{items,version:playerData.me.wishlist_version});
      playerData.me.wishlist=res.wishlist;
      playerData.me.wishlist_version=res.version;
      renderPersonal();
    }));
    row.append(remove);wishRoot.append(row);
  }
  const received=$("received-tasks");
  received.replaceChildren();
  if(!data.receivedTasks?.length)received.append(node("p","muted","No tasks from your Santa yet."));
  for(const task of data.receivedTasks||[]){
    const row=node("div","personal-item");
    row.append(node("span","",task.status==="completed"?"✓ ":"○ "));
    row.append(node("span","",task.task_date+" · "+task.task_text));
    row.append(node("span","task-status",task.status));
    received.append(row);
  }
  $("child-name").textContent=!data.myChild ? "Not assigned yet" : showChild ? data.myChild.name : "Name hidden";
  $("child-toggle").disabled=!data.myChild;
  const childWish=$("child-wishlist");
  childWish.replaceChildren();
  if(!data.myChild?.wishlist?.length)childWish.append(node("p","muted","No wishlist items yet."));
  for(const item of data.myChild?.wishlist||[])childWish.append(node("div","personal-item", "• "+item.text));
  const assigned=$("assigned-tasks");
  assigned.replaceChildren();
  if(!data.myChild?.tasks?.length)assigned.append(node("p","muted","You haven't assigned any tasks yet."));
  for(const task of data.myChild?.tasks||[]){
    const row=node("label","personal-item");
    const input=node("input");input.type="checkbox";input.checked=task.status==="completed";
    input.disabled=task.status==="cancelled";
    input.addEventListener("change",withBusy(async()=>{
      await playerApi("complete_task",{task_id:task.id,completed:input.checked});
      await refreshPlayer();
    }));
    row.append(input,node("span","",task.task_date+" · "+task.task_text));
    assigned.append(row);
  }
  $("task-form").classList.toggle("hidden",!data.myChild);
  $("save-message").disabled=!data.myChild;
  $("gift-purchased").disabled=!data.myChild;
}
$("wishlist-form").addEventListener("submit",withBusy(async e=>{
  e.preventDefault();
  if(!playerData)return;
  const val=$("wishlist-input").value.trim();
  if(!val)return;
  const items=[...(playerData.me.wishlist||[]),{id:crypto.randomUUID(),text:val}];
  const res=await playerApi("save_wishlist",{items,version:playerData.me.wishlist_version});
  playerData.me.wishlist=res.wishlist;
  playerData.me.wishlist_version=res.version;
  $("wishlist-input").value="";
  renderPersonal();
  toast("Wish added.");
}));
$("task-form").addEventListener("submit",withBusy(async e=>{
  e.preventDefault();
  const date=$("task-date").value;
  const taskText=$("task-text").value.trim();
  await playerApi("add_task",{task_date:date,task_text:taskText});
  $("task-text").value="";
  await refreshPlayer();
  toast("Task assigned for "+date+".");
}));
$("save-message").addEventListener("click",withBusy(async()=>{
  await playerApi("save_message",{message:$("santa-message").value});
  toast("Message saved privately for the ceremony.");
}));
$("gift-purchased").addEventListener("change",withBusy(async()=>{
  await playerApi("gift_status",{purchased:$("gift-purchased").checked});
  toast("Gift status saved.");
}));
$("player-hint").addEventListener("click",()=>{
  const clue=playerData?.hint || "Your personalized hint will appear when today's office clues are published.";
  const text=$("player-hint-text");
  text.textContent=clue;
  text.classList.remove("hidden");
  clearTimeout(hintTimeout);
  hintTimeout=setTimeout(()=>text.classList.add("hidden"),9000);
});
$("player-pause").addEventListener("click",()=>{
  const opening=$("player-menu").classList.contains("hidden");
  $("player-menu").classList.toggle("hidden",!opening);
  if(opening){
    $("player-tab-personal").click();
    refreshPlayer().catch(e=>toast(e.message,true));
  }
});
$("player-close").addEventListener("click",()=>$("player-menu").classList.add("hidden"));
$("child-toggle").addEventListener("click",()=>{
  showChild=!showChild;
  $("child-toggle").textContent=showChild?"◉ Hide":"◉ Reveal";
  $("child-name").textContent=showChild?(playerData?.myChild?.name||"Not assigned yet"):"Name hidden";
});
$("player-tab-character").addEventListener("click",()=>selectTab("character"));
$("player-tab-personal").addEventListener("click",()=>selectTab("personal"));
function selectTab(name) {
  for(const tab of ["character","personal"]){
    $("player-"+tab).classList.toggle("hidden",tab!==name);
    $("player-tab-"+tab).classList.toggle("active",tab===name);
  }
}
$("player-sign-out").addEventListener("click",()=>{
  clearPlayerSession();
  toast("You have left the Christmas office.");
});

async function start() {
  makeSnow();
  const isAdmin=param.has("admin");
  if (isAdmin) {
    $("admin").classList.remove("hidden");
    $("welcome").classList.add("hidden");
    try {
      const old=sessionStorage.getItem(SESSION_KEY);
      if (old) {
        const restored=JSON.parse(old);
        if (restored?.token) {
          session=restored;
          paintAuth();
          await refreshEvents();
        }
      }
    } catch(error) {
      saveSession(null);
      toast("Administrator session expired. Please enter your PIN.",true);
    }
    return;
  }
  const slug=param.get("event");
  if (!slug) {
    $("entry-note").textContent="Ask your organizer for your event invitation link (which identifies the event).";
  } else {
    try {
      const info=await gateway("event_info",{event_slug:slug});
      $("entry-note").textContent="Invitation for "+info.event.title+" · Enter your private four-digit code.";
      const title=info.event.title;
      const year=title.match(/20\d{2}/)?.[0];
      if(year) $("hero-year").textContent=year;
    } catch(error) {
      $("entry-note").textContent=error.message;
    }
  }
  const stored=sessionStorage.getItem(PLAYER_KEY);
  if(stored) {
    try {
      const restored=JSON.parse(stored);
      if(restored?.token && restored.event?.slug === slug){
        playerSession=restored;
        await openPlayer();
      }
    } catch(error) {
      clearPlayerSession();
    }
  }
}
start();
