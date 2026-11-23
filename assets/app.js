
"use strict";
import {createVisualAvatarEditor} from "./game/avatar-editor.js?v=face-refine-v4-studio-qa-v1";
import {createChristmasMusic, playFestiveChime} from "./game/christmas-music.js?v=jingle-bells-v1";
import {SKIN_COLORS,HAIR_COLORS,OUTFIT_COLORS} from "./game/palette.js?v=custom-v1";
const GATEWAY="https://fwrievuhudjkeffmszqf.supabase.co/functions/v1/ss-gateway";
const PUBLIC_KEY="sb_publishable_SJo2kgXdHNFZI65iAvQmxw_q56zuVLO";
const PARAMS=new URLSearchParams(location.search);
const ADMIN=PARAMS.has("admin");
const EVENT_SLUG=PARAMS.get("event")||"";
const SESSION_STORAGE_KEY=ADMIN?"vcf_ss_admin_pin_session":"vcf_ss_player_pin_session";
const $=id=>document.getElementById(id);
const node=(tag,cls,text)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==undefined)n.textContent=String(text);
  return n;
};
const button=(label,handler,style="small-outline")=>{
  const b=node("button",style,label);
  b.type="button"; b.addEventListener("click",handler);return b;
};
let session=null, busy=false, events=[],event=null,participants=[],assignments=[],player=null,childVisible=false;
let officeRuntime=null,officeLoading=null,officeKey=null,officeNoticeTimer=null;
let clueDismissTimer=null;
let avatarBaseline=null,avatarPreviewTimer=null;
let avatarStudio=null,avatarStudioLoading=null,activeStudioTab="look",visualEditor=null;
let adminEditingParticipant=null;
let latestAdminInvitation=null;
// The finale exists only in the organizer view and never opens automatically.
let ceremonyRuntime=null,ceremonyPeople=[],ceremonyIndex=0,ceremonyData=null,
    ceremonyRevealed=false,ceremonyCluesShown=0,ceremonySerial=0;
const christmasMusic=createChristmasMusic();
function syncChristmasMusic(){
  const button=$("player-music");
  if(!button)return;
  const muted=christmasMusic.muted;
  button.textContent=muted?"🔇":"🔊";
  button.title=muted?"Play Jingle Bells":"Mute Jingle Bells";
  button.setAttribute("aria-label",button.title);
  button.setAttribute("aria-pressed",String(muted));
}
$("player-music").addEventListener("click",()=>{
  christmasMusic.unlock();
  christmasMusic.toggle();
  syncChristmasMusic();
});
$("office-view").addEventListener("pointerdown",()=>{
  // Restored mobile sessions have no fresh login gesture; the first in-game
  // touch is a valid moment to resume the soundtrack without autoplay errors.
  if(player&&!christmasMusic.muted)christmasMusic.unlock();
},{passive:true});
syncChristmasMusic();
const codes=new Map();
function toast(message,error=false){
  const el=$("toast");el.textContent=message;
  el.style.background=error?"#ffe2dc":"#e9f3e8";
  el.style.color=error?"#7f251f":"#173824";
  el.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.add("hidden"),4600);
}
let progressTimer=null;
const ACTION_STEPS={
  admin_login:"Unlocking organizer console",
  admin_register:"Creating administrator account",
  create_admin_invite:"Generating organizer invitation",
  player_login:"Verifying your invitation code",
  list_events:"Loading events",
  create_event:"Creating Christmas event",
  list_participants:"Loading participants",
  add_participant:"Registering participant and generating code",
  edit_participant:"Saving participant changes",
  rotate_code:"Generating a replacement invitation code",
  assign_pending:"Assigning Santas to participants who are waiting",
  delete_participant:"Deleting participant and repairing remaining Santa pairs",
  reassign_all:"Resetting all Santa allocations",
  ceremony_roster:"Preparing the Christmas stage",
  ceremony_details:"Bringing the next participant to the stage",
  unlock_santa_hint:"Unlocking a mystery clue",
  change_admin_pin:"Updating administrator PIN",
  player_dashboard:"Loading personal dashboard",
  save_wishlist:"Saving wishlist",
  add_task:"Assigning a dated task",
  complete_task:"Updating task completion",
  gift_status:"Updating gift-purchase status",
  save_message:"Saving Santa's private message",
  save_avatar:"Saving your voxel character",
  admin_save_avatar:"Saving participant avatar"
};
function showProgress(title,detail,state="loading"){
  clearTimeout(progressTimer);
  const el=$("action-progress");
  if(!el)return;
  $("progress-title").textContent=title;
  $("progress-detail").textContent=detail;
  el.dataset.state=state;
  el.classList.remove("hidden");
}
function hideProgressLater(ms=1400){
  progressTimer=setTimeout(()=>$("action-progress")?.classList.add("hidden"),ms);
}
const run=task=>async(...args)=>{
  if(busy)return;
  busy=true;
  document.body.classList.add("processing");
  showProgress("Working on your request","Checking your Christmas event…");
  try{
    await task(...args);
    showProgress("Completed","Your action finished successfully.","success");
  }catch(error){
    if(/session expired|invalid session|invitation has changed|sign in again/i.test(error?.message||""))endSession();
    showProgress("Could not finish",error?.message||"Please try again.","error");
    toast(error?.message||"Something went wrong.",true);
  }finally{
    busy=false;
    document.body.classList.remove("processing");
    hideProgressLater();
  }
};
async function api(action,values={}){
  if(busy&&ACTION_STEPS[action])showProgress(ACTION_STEPS[action],"Preparing your Christmas event…");
  let reply;
  try{
    reply=await fetch(GATEWAY,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":PUBLIC_KEY,
        ...(session?.token?{"Authorization":"Bearer "+session.token}:{})
      },
      body:JSON.stringify({action,...values})
    });
  }catch{
    throw Error("Connection failed. Check your internet connection and try again.");
  }
  const data=await reply.json().catch(()=>({}));
  if(!reply.ok)throw Error(data.error||"The server returned "+reply.status);
  return data;
}
function setSession(info){
  session=info;
  if(info)sessionStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify(info));
  else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  paintLogin();
}
function endSession(){
  if(adminEditingParticipant)closeAdminCharacterEditor();
  document.body.classList.remove("office-playing");
  christmasMusic.leave();
  if(avatarStudio){avatarStudio.dispose();avatarStudio=null;}
  avatarStudioLoading=null;
  if(officeRuntime){officeRuntime.dispose();officeRuntime=null;}
  clearTimeout(avatarPreviewTimer);
  avatarBaseline=null;officeLoading=null;officeKey=null;
  clearTimeout(clueDismissTimer);clueDismissTimer=null;
  $("clue-popover").classList.add("hidden");
  $("office-tutorial").classList.add("hidden");
  setSession(null);player=null;event=null;participants=[];assignments=[];events=[];codes.clear();
  latestAdminInvitation=null;
  $("admin-invite-result").classList.add("hidden");
  $("admin-register-form").classList.add("hidden");
  $("admin-register-toggle").textContent="New organizer? Create account";
  $("player").classList.add("hidden");
  $("welcome").classList.toggle("hidden",ADMIN);
  $("admin").classList.toggle("hidden",!ADMIN);
}
function paintLogin(){
  if(!ADMIN)return;
  const yes=!!session?.token;
  $("auth-area").classList.toggle("hidden",yes);
  $("dashboard").classList.toggle("hidden",!yes);
  $("sign-out").classList.toggle("hidden",!yes);
  $("signed-in-user").textContent=yes?(session.admin?.name||"Organizer"):"";
  if(!yes)$("event-workspace").classList.add("hidden");
  if(yes)$("admin-register-form").classList.add("hidden");
}
function snowfall(){
  const count=matchMedia("(max-width:650px)").matches?38:72;
  for(let i=0;i<count;i++){
    const flake=node("span","flake",Math.random()>.8?"✧":"·");
    flake.style.setProperty("--x",Math.random()*100+"%");
    flake.style.setProperty("--opacity",(0.13+Math.random()*.58).toFixed(2));
    flake.style.setProperty("--size",Math.round(10+Math.random()*15)+"px");
    flake.style.setProperty("--speed",(8+Math.random()*14)+"s");
    flake.style.setProperty("--delay",(-Math.random()*17)+"s");
    flake.style.setProperty("--drift",(-80+Math.random()*160)+"px");
    $("snow").append(flake);
  }
}
async function copyTextWithFallback(text){
  try{
    if(!navigator.clipboard?.writeText)throw Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(text);
    return true;
  }catch{
    // Mobile browsers can deny clipboard access; offer a selectable text prompt.
    window.prompt("Copy this link or invitation:",text);
    return false;
  }
}
function eventUrl(){return location.origin+location.pathname+"?event="+encodeURIComponent(event.slug);}
function shareText(p){
  const code=codes.get(p.id);
  if(!code)throw Error("Generate a new code before sharing.");
  return "🎄 VCF Secret Santa 🎁\n\nYou've been invited to our Christmas office mystery!\n\n🎮 "+eventUrl()+"\n🔐 Your private code: "+code+
    "\n\nKeep your code private. Share warm wishes and make your Secret Child feel special! 🎅";
}

// Recipient numbers exist only in this dialog; never in event/participant data.
// A wa.me link pre-populates chat and text; WhatsApp requires the user to send.
let whatsappRecipientId=null;
function normalizeWhatsAppNumber(raw){
  const trimmed=String(raw||"").trim();
  if(!trimmed)return "";
  // Allow conventional separators and optional international +, but no
  // extensions, slashes, letters or additional + symbols.
  if(!/^\+?[0-9(). -]+$/.test(trimmed))return "";
  let digits=trimmed.replace(/\D/g,"");
  if(digits.startsWith("00")&&digits.length>12)digits=digits.slice(2);
  // This is a Bengaluru-based event. Bare 10-digit domestic numbers use +91.
  // For international recipients the organizer must provide a country code.
  if(digits.length===10&&/^[6-9]/.test(digits))digits="91"+digits;
  if(digits.length<11||digits.length>15||digits.startsWith("0"))return "";
  return digits;
}
function closeWhatsAppInvite(){
  const dialog=$("whatsapp-invite-dialog");
  if(dialog.open)dialog.close();
  $("whatsapp-phone-number").value="";
  $("whatsapp-message-preview").textContent="";
  $("whatsapp-invite-person").textContent="";
  $("whatsapp-phone-error").textContent="";
  $("whatsapp-open-link").removeAttribute("href");
  $("whatsapp-open-link").classList.add("is-disabled");
  $("whatsapp-open-link").setAttribute("aria-disabled","true");
  $("whatsapp-open-link").tabIndex=-1;
  whatsappRecipientId=null;
}
function updateWhatsAppInvite(){
  const participant=participants.find(p=>p.id===whatsappRecipientId);
  const raw=$("whatsapp-phone-number").value;
  const number=normalizeWhatsAppNumber(raw);
  const link=$("whatsapp-open-link");
  if(!participant||!codes.has(participant.id)||!number){
    link.removeAttribute("href");
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled","true");
    link.tabIndex=-1;
    $("whatsapp-phone-error").textContent=raw.trim()&&!number?
      "Enter a valid number with country code, or a 10-digit Indian mobile number.":"";
    return;
  }
  // encodeURIComponent escapes the invitation URL and 4-digit code
  // without placing the telephone number into our backend or storage.
  link.href="https://wa.me/"+number+"?text="+encodeURIComponent(shareText(participant));
  link.classList.remove("is-disabled");
  link.setAttribute("aria-disabled","false");
  link.tabIndex=0;
  $("whatsapp-phone-error").textContent="";
}
function openWhatsAppInvite(participant){
  if(!event||!codes.has(participant.id))throw Error("Generate a code before sharing.");
  whatsappRecipientId=participant.id;
  $("whatsapp-invite-person").textContent="To: "+participant.display_name;
  $("whatsapp-message-preview").textContent=shareText(participant);
  $("whatsapp-phone-number").value="";
  updateWhatsAppInvite();
  $("whatsapp-invite-dialog").showModal();
  $("whatsapp-phone-number").focus();
}
$("whatsapp-invite-close").addEventListener("click",closeWhatsAppInvite);
$("whatsapp-invite-dialog").addEventListener("close",()=>{
  // Escape / native dialog close also destroys the temporary phone number.
  $("whatsapp-phone-number").value="";
  $("whatsapp-message-preview").textContent="";
  whatsappRecipientId=null;
  $("whatsapp-open-link").removeAttribute("href");
  $("whatsapp-open-link").classList.add("is-disabled");
  $("whatsapp-open-link").setAttribute("aria-disabled","true");
  $("whatsapp-open-link").tabIndex=-1;
});
$("whatsapp-phone-number").addEventListener("input",updateWhatsAppInvite);
$("whatsapp-open-link").addEventListener("click",e=>{
  if(!$("whatsapp-open-link").href||$("whatsapp-open-link").classList.contains("is-disabled")){
    e.preventDefault();
    $("whatsapp-phone-error").textContent="Enter the recipient's phone number first.";
    $("whatsapp-phone-number").focus();
  }
  // Valid links use the browser's native anchor action; do not call
  // window.open asynchronously, which mobile popup blockers can suppress.
});

function normalizedParticipantName(name){
  return String(name||"").trim().replace(/\s+/g," ").toLocaleLowerCase();
}
function namesById(id){
  const p=participants.find(p=>p.id===id);
  if(!p)return "Unknown";
  const hasDuplicate=participants.some(other=>other.id!==p.id&&other.is_active&&
    normalizedParticipantName(other.display_name)===normalizedParticipantName(p.display_name));
  return hasDuplicate?p.display_name+" ("+(p.desk_key||"ID "+p.id.slice(0,6))+")":p.display_name;
}
function privateChildLabel(){
  const child=player?.myChild;
  if(!child)return "Awaiting assignment";
  const peers=player.colleagues||[];
  const duplicate=peers.some(p=>p.id!==child.id&&
    normalizedParticipantName(p.name)===normalizedParticipantName(child.name));
  const target=peers.find(p=>p.id===child.id);
  return duplicate?child.name+" ("+(target?.desk_key||"ID "+child.id.slice(0,6))+")":child.name;
}
function pendingPeople(){
  const taken=new Set(assignments.flatMap(a=>[a.santa_id,a.child_id]));
  return participants.filter(p=>p.is_active&&!taken.has(p.id));
}
async function loadEvents(){
  const result=await api("list_events");
  events=result.events||[];
  const dest=$("event-list");dest.replaceChildren();
  if(!events.length)dest.append(node("p","muted","No events yet. Create one above."));
  for(const item of events){
    const row=node("div","event-card");
    const text=node("div");
    text.append(node("strong","",item.title),node("small","",item.slug+" · "+item.status));
    row.append(text,button("Manage →",run(()=>openEvent(item))));
    dest.append(row);
  }
  // Immediately show the most recent event's complete participant roster
  // on organizer login. Previously, all rows stayed hidden until Manage
  // was clicked even when only one event existed.
  const selected=(event&&events.find(e=>e.id===event.id))||events[0];
  if(selected)await openEvent(selected);
  else{$("event-workspace").classList.add("hidden");event=null;codes.clear();}
}
async function openEvent(e){
  const result=await api("list_participants",{event_id:e.id});
  event={...e,...result.event};
  participants=result.participants||[];
  assignments=result.assignments||[];
  // The gateway returns decryptable codes ONLY after organizer authorization.
  // Repopulate on every event load; do not carry codes between events.
  codes.clear();
  for(const [id,code] of Object.entries(result.codes||{})){
    if(/^[0-9]{4}$/.test(code))codes.set(id,code);
  }
  $("workspace-title").textContent=event.title;
  $("workspace-slug").textContent=eventUrl();
  const open=["draft","active"].includes(event.status);
  const pending=pendingPeople();
  $("workspace-state").textContent=!open?"CLOSED":assignments.length?"DRAWN · OPEN":"OPEN";
  $("people-count").textContent=participants.filter(p=>p.is_active).length;
  $("assignment-count").textContent=assignments.length;
  $("pending-count").textContent=pending.length;
  $("event-workspace").classList.remove("hidden");
  // Drawing is not a registration lock. Newcomers can join after existing
  // Santas have already received their private Secret Child.
  $("participant-form").querySelectorAll("input,button").forEach(el=>el.disabled=!open);
  $("assign-btn").disabled=!open||pending.length<2;
  $("assign-btn").textContent=assignments.length?"🎁 Assign newcomers":"🎁 Draw Secret Santas";
  const notice=$("assignment-notice");
  if(!open)notice.textContent="This event is closed to new assignments.";
  else if(!pending.length)notice.textContent=assignments.length?
    "Everyone is assigned. Add newcomers here at any time; existing Santa–Child pairs will stay unchanged.":
    "Add two or more colleagues before the first draw.";
  else if(pending.length===1)notice.textContent=
    "1 participant is waiting. Add at least one more newcomer before drawing; previously assigned pairs will not change.";
  else if(pending.length===2)notice.textContent=
    "2 participants are ready. They would be paired with each other and may infer their Santa's identity. For better secrecy, wait until at least 3 are available.";
  else notice.textContent=pending.length+
    " participants are ready for "+(assignments.length?"an additional":"the first")+
    " draw. No tasks are necessary.";
  renderPeople();renderPairs();
}
function renderPeople(){
  const tbody=$("participant-rows");tbody.replaceChildren();
  if(!participants.length){
    const tr=node("tr"),td=node("td","muted","Add a participant above.");
    td.colSpan=5;tbody.append(tr);tr.append(td);return;
  }
  for(const p of participants){
    const tr=node("tr","participant-entry");
    const name=node("td","participant-name-cell");
    name.dataset.label="Name";
    name.title=p.display_name;
    name.append(node("strong","participant-full-name",p.display_name));
    if(participants.some(other=>other.id!==p.id&&other.is_active&&
      normalizedParticipantName(other.display_name)===normalizedParticipantName(p.display_name)))
      name.append(node("small","participant-name-warning",
        "Duplicate name · "+(p.desk_key||"ID "+p.id.slice(0,6))+" · verify person"));
    if(!p.is_active)name.append(node("small","participant-inactive","Inactive"));
    else if(pendingPeople().some(q=>q.id===p.id))
      name.append(node("small","participant-awaiting","Awaiting Santa draw"));
    tr.append(name);
    const desk=node("td","participant-desk-cell",p.desk_key||"—");
    desk.dataset.label="Desk";tr.append(desk);
    const code=codes.get(p.id);
    const codeCell=node("td","participant-code-cell");codeCell.dataset.label="Code";
    if(code)codeCell.append(node("code","organizer-code",code));
    else codeCell.append(node("small","code-not-recoverable","Reissue to view"));
    tr.append(codeCell);
    const inviteCell=node("td","participant-invite-cell");inviteCell.dataset.label="Share";
    const wa=button("◉ WhatsApp",()=>openWhatsAppInvite(p),"small-outline roster-whatsapp");
    wa.title="Enter a phone number and share the invitation for "+p.display_name;
    wa.setAttribute("aria-label",wa.title);
    wa.disabled=!code;
    inviteCell.append(wa);tr.append(inviteCell);
    const control=node("td","participant-manage-cell");control.dataset.label="Actions";
    const edit=button("✎",()=>{void openAdminCharacterEditor(p);},"small-outline roster-icon-button");
    edit.title="Edit "+p.display_name+" and style character";
    edit.setAttribute("aria-label",edit.title);
    const rotate=button("↻",run(async()=>{
      if(!confirm("Replace the code for "+p.display_name+"? The old code will stop working."))return;
      await api("rotate_code",{event_id:event.id,participant_id:p.id});
      await openEvent(event);toast("New code generated.");
    }),"small-outline roster-icon-button");
    rotate.title=code?"Regenerate invitation code":"Issue readable invitation code";
    rotate.setAttribute("aria-label",rotate.title);
    const remove=button("🗑",run(async()=>{
      if(!event)return;
      const named=p.display_name+(p.desk_key?" ("+p.desk_key+")":"");
      const typed=prompt("Delete "+named+"? This revokes the invitation and reconnects the Santa cycle when safe. Active gift messages, tasks, purchased-gift records and other personal work are protected.\n\nType DELETE to continue.");
      if(typed!=="DELETE")return;
      if(!confirm("Permanently delete "+named+" and repair remaining allocations? This cannot be undone."))return;
      const res=await api("delete_participant",{event_id:event.id,participant_id:p.id});
      await openEvent(event);
      toast(named+" deleted"+(res?.rewired?" and Santa chain repaired.":"."));
    }),"small-outline roster-icon-button roster-delete");
    remove.title="Permanently delete "+p.display_name+" ("+(p.desk_key||p.id.slice(0,6))+")";
    remove.setAttribute("aria-label",remove.title);
    remove.disabled=!["draft","active"].includes(event.status);
    control.append(edit,rotate,remove);tr.append(control);
    tbody.append(tr);
  }
}
function renderPairs(){
  const list=$("pair-list");list.replaceChildren();
  $("assignment-details").classList.toggle("hidden",!assignments.length);
  assignments.forEach(a=>list.append(node("div","",namesById(a.santa_id)+" → "+namesById(a.child_id))));
  $("reassign-all-btn").disabled=!["draft","active"].includes(event?.status)||!assignments.length;
  $("ceremony-launch").disabled=!participants.some(p=>p.is_active);
}

function ceremonyLine(id,content,emptyText){
  const parent=$(id);parent.replaceChildren();
  if(!content.length){
    parent.append(node("div","ceremony-story-empty",emptyText));
    return;
  }
  content.forEach(value=>parent.append(node("div","ceremony-story-item",String(value))));
}
function ceremonyName(person){
  return person?.display_name+(person?.desk_key?" · "+person.desk_key:"");
}
async function showCeremonyMember(index){
  if(!ceremonyPeople.length)return;
  const serial=++ceremonySerial;
  ceremonyIndex=Math.max(0,Math.min(index,ceremonyPeople.length-1));
  const person=ceremonyPeople[ceremonyIndex];
  $("ceremony-select").value=person.id;
  $("ceremony-person").textContent=person.display_name;
  $("ceremony-person-desk").textContent=person.desk_key||"";
  $("ceremony-progress").textContent="PARTICIPANT "+(ceremonyIndex+1)+" OF "+ceremonyPeople.length;
  $("ceremony-spotlight-state").textContent="Preparing the spotlight…";
  $("ceremony-prev").disabled=ceremonyIndex===0;
  $("ceremony-next").disabled=ceremonyIndex===ceremonyPeople.length-1;
  $("ceremony-revealed").classList.add("hidden");
  $("ceremony-guess").value="";
  $("ceremony-santa-name").textContent="";
  $("ceremony-guess-result").textContent="";
  $("ceremony-reveal-btn").disabled=true;
  $("ceremony-next-clue").disabled=true;
  ceremonyRevealed=false;ceremonyCluesShown=0;ceremonyData=null;
  ceremonyLine("ceremony-wishlist",[],"Collecting their Christmas wishes…");
  ceremonyLine("ceremony-tasks",[],"Collecting any Santa tasks…");
  $("ceremony-message").textContent="Preparing the anonymous Santa's message…";
  ceremonyLine("ceremony-clues",[],"The clues are coming…");
  const data=await api("ceremony_details",{event_id:event.id,participant_id:person.id});
  if(serial!==ceremonySerial||!$("ceremony-dialog").open)return;
  ceremonyData=data;
  $("ceremony-person").textContent=data.participant.display_name;
  $("ceremony-person-desk").textContent=data.participant.desk_key||"";
  $("ceremony-spotlight-state").textContent="ON STAGE · THE AUDIENCE IS WATCHING";
  const wishes=(data.wishlist||[]).map(x=>typeof x==="string"?x:x?.text||"").filter(Boolean);
  ceremonyLine("ceremony-wishlist",wishes,"No wishlist entries were added.");
  const tasks=(data.tasks||[]).map(x=>
    (x.task_date?niceDate(x.task_date)+" · ":"")+x.task_text+
    (x.status==="completed"?" ✓":""));
  ceremonyLine("ceremony-tasks",tasks,"Their Secret Santa did not set any tasks. Tasks are optional.");
  $("ceremony-message").textContent=data.message||"No personal message has been written by their Santa yet.";
  ceremonyLine("ceremony-clues",[],"No clues shown yet. Use Next hint to reveal them one by one.");
  $("ceremony-next-clue").disabled=!(data.hints||[]).length;
  $("ceremony-reveal-btn").disabled=!data.santa;
  try{
    if(!ceremonyRuntime){
      const {mountCeremonyStage}=await import("./game/ceremony-stage.js?v=evergreen-stage-v1");
      if(serial!==ceremonySerial||!$("ceremony-dialog").open)return;
      ceremonyRuntime=mountCeremonyStage($("ceremony-avatar"),data.participant);
    }else ceremonyRuntime.update(data.participant);
  }catch(error){
    console.warn("3D stage unavailable; showing accessible nameplate instead.",error);
    $("ceremony-avatar").textContent="✦ "+data.participant.display_name+" ✦";
  }
}
async function startCeremony(){
  if(!event)return;
  const response=await api("ceremony_roster",{event_id:event.id});
  ceremonyPeople=response.people||[];
  if(!ceremonyPeople.length)throw Error("Add at least one participant before opening the stage.");
  const select=$("ceremony-select");select.replaceChildren();
  ceremonyPeople.forEach(p=>{
    const option=node("option","",ceremonyName(p));option.value=p.id;select.append(option);
  });
  const dialog=$("ceremony-dialog");
  dialog.showModal();
  try{await showCeremonyMember(0);}
  catch(error){dialog.close();throw error;}
}
function revealCeremonySanta(){
  if(!ceremonyData?.santa||ceremonyRevealed)return;
  ceremonyRevealed=true;
  $("ceremony-revealed").classList.remove("hidden");
  $("ceremony-reveal-btn").disabled=true;
  $("ceremony-santa-name").textContent=ceremonyName(ceremonyData.santa);
  const guess=$("ceremony-guess").value.trim();
  const matches=guess&&normalizedParticipantName(guess)===
    normalizedParticipantName(ceremonyData.santa.display_name);
  $("ceremony-guess-result").textContent=guess?
    (matches?"🎉 The audience guessed correctly!":"The audience guessed: "+guess):"Christmas mystery solved! ✨";
  $("ceremony-spotlight-state").textContent="THE SECRET SANTA IS REVEALED ✦";
  ceremonyRuntime?.reveal();
}
function niceDate(value){
  const d=new Date(value+"T12:00:00Z");
  return new Intl.DateTimeFormat("en-IN",{timeZone:"UTC",day:"numeric",month:"short"}).format(d);
}
function itemLine(parent,text){
  const row=node("div","personal-item");row.append(node("span","",text));parent.append(row);return row;
}

function officeToast(message){
  const el=$("office-toast");
  if(!el)return;
  el.textContent=message;
  el.classList.remove("hidden");
  clearTimeout(officeNoticeTimer);
  officeNoticeTimer=setTimeout(()=>el.classList.add("hidden"),2200);
}
function hideClue(){
  clearTimeout(clueDismissTimer);
  clueDismissTimer=null;
  $("clue-popover").classList.add("hidden");
}
function showClue(title,message,canUnlock=false){
  hideClue();
  $("clue-popover-title").textContent=title;
  $("clue-popover-text").textContent=message;
  $("clue-next").classList.toggle("hidden",!canUnlock);
  $("clue-popover").classList.remove("hidden");
  clueDismissTimer=setTimeout(hideClue,8500);
}
function updateClueButton(){
  const mystery=player?.mystery;
  const count=mystery?.unlocked||0;
  const valid=Array.isArray(mystery?.hints);
  const available=Boolean(mystery?.can_unlock && count<3 &&
    (!mystery.next_at || Date.parse(mystery.next_at)<=Date.now()));
  const control=$("player-clue");
  control.disabled=!mystery;
  control.classList.toggle("clue-ready",available);
  control.title=!mystery?"Available after Santa assignments":
    available?"A new Santa clue is ready":"See your Santa clue";
  control.setAttribute("aria-label",control.title);
  $("clue-next").classList.toggle("hidden",!available);
  return {available,count,valid};
}
function revealClue(){
  const mystery=player?.mystery;
  const {available,count}=updateClueButton();
  if(!mystery){
    showClue("Santa clue","Clues will appear after the Santa draw.");
    return;
  }
  const hints=(mystery.hints||[]).filter(t=>typeof t==="string"&&t.trim());
  if(hints.length){
    const last=hints[hints.length-1];
    const note=available?"You can reveal the next clue when you're ready.":"";
    const daily=player?.hint?"\nToday's note: "+player.hint:"";
    showClue("Clue "+hints.length+" of 3",last+daily+(note?"\n"+note:""),available);
    return;
  }
  if(available){
    showClue("Your first Santa clue","Your first clue is ready.",true);
    return;
  }
  const next=mystery.next_at?Date.parse(mystery.next_at):0;
  const wait=next>Date.now()?"Next clue available "+new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short"}).format(new Date(next))+".":"Your Santa clues aren't ready yet.";
  showClue("Santa clue",player?.hint?player.hint:count>=3?
    "All three clues have been revealed.":wait);
}
function showOfficeTutorial(){
  if(!player?.me||!player?.event)return;
  const key="secret-santa-office-tutorial-v1:"+player.event.slug+":"+player.me.id;
  if(sessionStorage.getItem(key))return;
  $("office-tutorial").dataset.storageKey=key;
  $("office-tutorial").classList.remove("hidden");
}
function hideOfficeTutorial(){
  const el=$("office-tutorial");
  if(el.dataset.storageKey)sessionStorage.setItem(el.dataset.storageKey,"1");
  el.classList.add("hidden");
}
$("office-tutorial-close").addEventListener("click",hideOfficeTutorial);
$("clue-dismiss").addEventListener("click",hideClue);
$("player-clue").addEventListener("click",()=>{
  // The first bulb tap unlocks and immediately displays clue one. Later taps
  // revisit the current clue; advancing to clue two or three is an explicit
  // second action, avoiding accidental consumption of 24-hour unlocks.
  const hints=player?.mystery?.hints||[];
  if(!hints.length&&updateClueButton().available){
    void run(async()=>{
      await api("unlock_santa_hint");
      await loadPlayer();
      const latest=player?.mystery?.hints||[];
      showClue("Clue "+latest.length+" of 3",latest.at(-1)||"Your Santa clue is ready.");
    })();
  }else revealClue();
});
$("clue-next").addEventListener("click",run(async()=>{
  const {available}=updateClueButton();
  if(!available)throw Error("The next Santa clue isn't ready yet.");
  await api("unlock_santa_hint");
  await loadPlayer();
  const hints=player?.mystery?.hints||[];
  showClue("Clue "+hints.length+" of 3",hints.at(-1)||"Your new clue is ready.");
}));
function avatarIdentity(info){
  const people=info.colleagues||[];
  return JSON.stringify({
    person:info.me?.id,avatar:info.me?.avatar,
    colleagues:people.map(p=>[p.id,p.name,p.avatar])
  });
}
async function enterOffice(info){
  if(ADMIN)return;
  const identity=avatarIdentity(info);
  if(officeRuntime){
    if(identity!==officeKey){
      officeRuntime.setProfile(info);officeKey=identity;
      avatarBaseline=officeRuntime.getAvatar();
      setAvatarEditor(avatarBaseline);
    }
    return;
  }
  if(officeLoading){
    await officeLoading;
    if(officeRuntime&&identity!==officeKey){
      officeRuntime.setProfile(info);officeKey=identity;
      avatarBaseline=officeRuntime.getAvatar();
      setAvatarEditor(avatarBaseline);
    }
    return;
  }
  $("office-loading").classList.remove("hidden");
  officeLoading=(async()=>{
    const module=await import("./game/main.js?v=gameplay-v2");
    officeRuntime=module.mountOffice($("office-canvas"),info,officeToast);
    officeRuntime.setCamera("wide");
    officeKey=identity;
    avatarBaseline=officeRuntime.getAvatar();
    setAvatarEditor(avatarBaseline);
    $("office-loading").classList.add("hidden");
    showOfficeTutorial();
  })();
  try{await officeLoading;}
  catch(error){
    const loader=$("office-loading");
    loader.replaceChildren();
    const title=node("strong","", "The 3D office could not be opened.");
    const msg=node("small","",error?.message||"Check WebGL support and internet connectivity.");
    const retry=button("Try loading again",()=>{
      officeLoading=null;
      loader.replaceChildren();
      enterOffice(player);
    },"primary");
    loader.append(title,msg,retry);
    console.error("VCF office error:",error);
  }finally{officeLoading=null;}
}
const AVATAR_FIELDS=["gender","outfit","bottom","hairstyle","skin","hair","height","build","footwear","bottomColor","shoeColor","facialHair","glassesStyle","glassesColor","bindiStyle","bindiColor"];
// 50 means natural proportions. Slider bounds are visual, not stored
// percentages: existing profiles remain valid and keep their measurements.
const SHAPE_BOUNDS={height:[.80,1.30],build:[.65,1.55]};
function shapeFromSlider(field,value){
  const [low,high]=SHAPE_BOUNDS[field],n=Math.max(0,Math.min(100,Number(value)||0));
  return n<=50?1-(1-low)*(50-n)/50:1+(high-1)*(n-50)/50;
}
function sliderFromShape(field,value){
  const [low,high]=SHAPE_BOUNDS[field],n=Number(value)||1;
  return Math.round(Math.max(0,Math.min(100,n<=1?50-(1-n)*50/(1-low):50+(n-1)*50/(high-1))));
}
function syncShapeOutputs(){
  for(const field of ["height","build"])$("avatar-"+field+"-out").textContent=$("avatar-"+field).value+" / 100";
}
function readAvatarEditor(){
  const result={schema_version:4};
  for(const field of AVATAR_FIELDS){
    const input=$("avatar-"+field);
    result[field]=["skin","hair","hairstyle","bottomColor","shoeColor","glassesColor","bindiColor"].includes(field)?Number(input.value):
      ["height","build"].includes(field)?shapeFromSlider(field,input.value):input.value;
  }
  result.color=Number($("avatar-color").value);
  result.glasses=result.glassesStyle!=="none";
  return result;
}
function setAvatarEditor(values){
  const avatar=values&&typeof values==="object"?values:{};
  const defaults={gender:"female",outfit:"salwar",bottom:"leggings",hairstyle:2,skin:2,hair:0,color:1,height:1,build:1,footwear:"auto",bottomColor:-1,shoeColor:-1,facialHair:"none",glassesStyle:"none",glassesColor:0,bindiStyle:"none",bindiColor:0,glasses:false};
  const settings={...defaults,...avatar};
  // Backward compatibility: pre-v3 stored profiles only had a glasses boolean.
  if(!Object.hasOwn(avatar,"glassesStyle") && avatar.glasses)settings.glassesStyle="rectangle";
  for(const field of AVATAR_FIELDS){
    const el=$("avatar-"+field);
    el.value=String(["height","build"].includes(field)?sliderFromShape(field,settings[field]):settings[field]);
  }
  $("avatar-color").value=String(settings.color);
  $("avatar-glasses").checked=!!settings.glasses;
  syncShapeOutputs();
  $("avatar-preview-status").textContent="Your changes preview immediately. Save when you are happy with your look.";
  $("avatar-save").disabled=false;
  avatarStudio?.update(settings);
  visualEditor?.refresh(activeStudioTab);
}
function previewAvatarNow(){
  if(!officeRuntime&&!adminEditingParticipant)return;
  const data=readAvatarEditor();
  if(!adminEditingParticipant)officeRuntime?.previewAvatar(data);
  avatarStudio?.update(data);
  syncShapeOutputs();
  $("avatar-preview-status").textContent=adminEditingParticipant?
    "Changes are visible in the 3D preview. Save to update this participant.":
    "Unsaved changes are visible on your 3D character.";
}
function previewAvatarSoon(){
  clearTimeout(avatarPreviewTimer);
  syncShapeOutputs();
  avatarPreviewTimer=setTimeout(previewAvatarNow,45);
}
for(const field of AVATAR_FIELDS){
  if(field==="height"||field==="build")continue;
  $("avatar-"+field).addEventListener("input",previewAvatarSoon);
}
for(const field of ["height","build"]){
  $("avatar-"+field).addEventListener("input",()=>{
    clearTimeout(avatarPreviewTimer);
    syncShapeOutputs();
    const height=shapeFromSlider("height",$("avatar-height").value);
    const build=shapeFromSlider("build",$("avatar-build").value);
    avatarStudio?.setBodyShape(height,build);
    if(!adminEditingParticipant)officeRuntime?.setBodyShape(height,build);
    $("avatar-preview-status").textContent="Live proportions updated. Release the slider to apply detailed clothing.";
  });
  // Rebuild detailed clothing only at the end of the drag. This avoids
  // expensive, laggy WebGL regeneration for every touch movement.
  $("avatar-"+field).addEventListener("change",previewAvatarNow);
}
$("avatar-glasses").addEventListener("change",previewAvatarSoon);
// Actual 3D outfit/hair/accessory cards, swatches and two character portraits.
// Hidden inputs keep the established save payload and version-check behavior.
visualEditor=createVisualAvatarEditor({
  read:readAvatarEditor,
  studio:()=>avatarStudio,
  choose:(field,value)=>{
    $("avatar-"+field).value=String(value);
    visualEditor.refresh(activeStudioTab);
    previewAvatarSoon();
  }
});
visualEditor.refresh(activeStudioTab);

const SKIN_NAMES=["Fair","Warm Ivory","Golden Bronze","Warm Chestnut","Deep Espresso","Porcelain","Obsidian","Peachy Cream","Rich Mahogany"];
const HAIR_NAMES=["Jet Black","Mocha Brown","Chocolate Brown","Deep Auburn","Midnight Navy","Platinum","Classic Black","Silver Gray","Warm Brunette"];
const OUTFIT_NAMES=["Pine Green","Festive Crimson","Royal Navy","Warm Ochre","Plum Purple","Winter Cream","Snow White","Classic Charcoal","Cranberry","Teal Frost","Caramel Tan","Cornflower Blue"];

function analyzePhotoForAvatar(img){
  const canvas=document.createElement("canvas");
  const size=200;
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return null;

  const scale=Math.max(size/img.naturalWidth,size/img.naturalHeight);
  const w=img.naturalWidth*scale;
  const h=img.naturalHeight*scale;
  const x=(size-w)/2;
  const y=(size-h)/2;
  ctx.drawImage(img,x,y,w,h);

  const imgData=ctx.getImageData(0,0,size,size).data;
  function getPixel(px,py){
    px=Math.max(0,Math.min(size-1,Math.round(px)));
    py=Math.max(0,Math.min(size-1,Math.round(py)));
    const idx=(py*size+px)*4;
    return [imgData[idx],imgData[idx+1],imgData[idx+2]];
  }

  function getAverageRegion(x0,y0,x1,y1,filterOutliers=true){
    let rSum=0,gSum=0,bSum=0,count=0;
    const samples=[];
    for(let py=y0;py<=y1;py+=2){
      for(let px=x0;px<=x1;px+=2){
        const [r,g,b]=getPixel(px,py);
        const lum=0.299*r+0.587*g+0.114*b;
        if(filterOutliers&&(lum<15||lum>245))continue;
        samples.push([r,g,b,lum]);
      }
    }
    if(!samples.length)return [180,140,110];
    samples.sort((a,b)=>a[3]-b[3]);
    const start=Math.floor(samples.length*0.15);
    const end=Math.ceil(samples.length*0.85);
    for(let i=start;i<end;i++){
      rSum+=samples[i][0];
      gSum+=samples[i][1];
      bSum+=samples[i][2];
      count++;
    }
    return count?[Math.round(rSum/count),Math.round(gSum/count),Math.round(bSum/count)]:[180,140,110];
  }

  function closestColorIndex(rgb,paletteHexList){
    let bestIdx=0;
    let bestDist=Infinity;
    const [r1,g1,b1]=rgb;
    for(let i=0;i<paletteHexList.length;i++){
      const hex=paletteHexList[i];
      const r2=(hex>>16)&0xff;
      const g2=(hex>>8)&0xff;
      const b2=hex&0xff;
      const rMean=(r1+r2)/2;
      const dr=r1-r2;
      const dg=g1-g2;
      const db=b1-b2;
      const dist=(2+rMean/256)*dr*dr+4*dg*dg+(2+(255-rMean)/256)*db*db;
      if(dist<bestDist){
        bestDist=dist;
        bestIdx=i;
      }
    }
    return bestIdx;
  }

  // 1. Skin tone: Center face
  const skinRgb=getAverageRegion(size*0.35,size*0.32,size*0.65,size*0.52);
  const skinIdx=closestColorIndex(skinRgb,SKIN_COLORS);

  // 2. Hair color: Crown of head
  const hairRgb=getAverageRegion(size*0.25,size*0.06,size*0.75,size*0.22);
  const hairIdx=closestColorIndex(hairRgb,HAIR_COLORS);

  // 3. Outfit color: Upper torso
  const outfitRgb=getAverageRegion(size*0.20,size*0.72,size*0.80,size*0.92);
  const outfitColorIdx=closestColorIndex(outfitRgb,OUTFIT_COLORS);

  // 4. Facial hair detection: compare lower jaw/chin luminance vs forehead skin
  const jawRgb=getAverageRegion(size*0.38,size*0.56,size*0.62,size*0.68,false);
  const skinLum=0.299*skinRgb[0]+0.587*skinRgb[1]+0.114*skinRgb[2];
  const jawLum=0.299*jawRgb[0]+0.587*jawRgb[1]+0.114*jawRgb[2];
  const beardDiff=skinLum-jawLum;

  let facialHair="none";
  let facialHairLabel="Clean shaven";
  if(beardDiff>42){
    facialHair="beard-boxed";
    facialHairLabel="Full/Boxed beard";
  }else if(beardDiff>24){
    facialHair="combo-short";
    facialHairLabel="Short beard";
  }else if(beardDiff>14){
    facialHair="stubble-light";
    facialHairLabel="Light stubble";
  }

  // 5. Glasses / Spectacles detection
  let eyeBridgeMinLum=255;
  for(let px=size*0.44;px<=size*0.56;px+=2){
    const [r,g,b]=getPixel(px,size*0.38);
    const lum=0.299*r+0.587*g+0.114*b;
    if(lum<eyeBridgeMinLum)eyeBridgeMinLum=lum;
  }
  const glassesDetected=(skinLum-eyeBridgeMinLum)>48;
  const glassesStyle=glassesDetected?"rectangle":"none";

  // 6. Hair length & Hairstyle estimation
  const leftSideRgb=getAverageRegion(size*0.12,size*0.40,size*0.24,size*0.65,false);
  const rightSideRgb=getAverageRegion(size*0.76,size*0.40,size*0.88,size*0.65,false);
  const hairLum=0.299*hairRgb[0]+0.587*hairRgb[1]+0.114*hairRgb[2];
  const leftLum=0.299*leftSideRgb[0]+0.587*leftSideRgb[1]+0.114*leftSideRgb[2];
  const rightLum=0.299*rightSideRgb[0]+0.587*rightSideRgb[1]+0.114*rightSideRgb[2];
  const sideHairMatch=(Math.abs(leftLum-hairLum)<32||Math.abs(rightLum-hairLum)<32);

  let hairstyle=0;
  let hairStyleLabel="Short classic";
  let gender="male";
  let outfit="shirt";

  if(sideHairMatch&&hairLum<120){
    hairstyle=2;
    hairStyleLabel="Long hair";
    gender="female";
    outfit="salwar";
  }else if(hairLum>180&&skinLum>160&&Math.abs(hairLum-skinLum)<25){
    hairstyle=19;
    hairStyleLabel="Bald / buzz cut";
    gender="male";
    outfit="tshirt";
  }else if(facialHair!=="none"){
    hairstyle=0;
    hairStyleLabel="Short classic";
    gender="male";
    outfit="shirt";
  }else{
    hairstyle=1;
    hairStyleLabel="Layered medium";
    gender="female";
    outfit="dress";
  }

  return {
    skin:skinIdx,
    hair:hairIdx,
    color:outfitColorIdx,
    hairstyle,
    gender,
    outfit,
    facialHair,
    facialHairLabel,
    glassesStyle,
    glasses:glassesDetected,
    hairStyleLabel,
    skinHex:SKIN_COLORS[skinIdx],
    hairHex:HAIR_COLORS[hairIdx],
    outfitHex:OUTFIT_COLORS[outfitColorIdx]
  };
}

function hexToCss(hex){
  return "#"+hex.toString(16).padStart(6,"0");
}

function applyMatchedPhoto(img,dataUrl){
  const result=analyzePhotoForAvatar(img);
  if(!result)return;
  const thumb=$("photo-matcher-thumb");
  const previewBox=$("photo-matcher-preview");
  const summaryEl=$("photo-matcher-summary");
  const chipsBox=$("photo-matcher-chips");

  if(thumb)thumb.src=dataUrl;
  if(previewBox)previewBox.classList.remove("hidden");

  setAvatarEditor({
    skin:result.skin,
    hair:result.hair,
    color:result.color,
    hairstyle:result.hairstyle,
    gender:result.gender,
    outfit:result.outfit,
    facialHair:result.facialHair,
    glassesStyle:result.glassesStyle,
    glasses:result.glasses
  });
  previewAvatarNow();

  try{localStorage.setItem("vcf_ss_avatar_photo",dataUrl);}catch{}
  if(officeRuntime?.updateAvatarPhoto)officeRuntime.updateAvatarPhoto(dataUrl);

  if(chipsBox){
    chipsBox.innerHTML="";
    const chips=[
      {label:`Skin: ${SKIN_NAMES[result.skin]||"Tone"}`,color:hexToCss(result.skinHex)},
      {label:`Hair: ${HAIR_NAMES[result.hair]||"Tone"}`,color:hexToCss(result.hairHex)},
      {label:`Style: ${result.hairStyleLabel}`},
      {label:`Outfit: ${OUTFIT_NAMES[result.color]||"Tone"}`,color:hexToCss(result.outfitHex)}
    ];
    if(result.facialHair!=="none")chips.push({label:`🧔 ${result.facialHairLabel}`});
    if(result.glasses)chips.push({label:"👓 Spectacles"});

    for(const chip of chips){
      const el=document.createElement("span");
      el.className="photo-chip";
      if(chip.color){
        const dot=document.createElement("span");
        dot.className="photo-chip-color";
        dot.style.backgroundColor=chip.color;
        el.appendChild(dot);
      }
      const text=document.createElement("span");
      text.textContent=chip.label;
      el.appendChild(text);
      chipsBox.appendChild(el);
    }
  }

  if(summaryEl)summaryEl.textContent=`Matched ${result.facialHair!=="none"||result.glasses?5:4} features! Avatar and 3D desk badge updated.`;
  if(typeof officeToast==="function")officeToast("✨ Avatar & desk badge updated from photo!");
  else toast("✨ Avatar & desk badge updated from photo!");
}

function setupPhotoAvatarMatcher(){
  const fileInput=$("avatar-photo-input");
  const previewBox=$("photo-matcher-preview");
  const thumb=$("photo-matcher-thumb");
  const chipsBox=$("photo-matcher-chips");
  const clearBtn=$("photo-matcher-clear");
  if(!fileInput)return;

  fileInput.addEventListener("change",e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        applyMatchedPhoto(img,ev.target.result);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  clearBtn?.addEventListener("click",()=>{
    fileInput.value="";
    previewBox?.classList.add("hidden");
    if(thumb)thumb.src="";
    if(chipsBox)chipsBox.innerHTML="";
    try{localStorage.removeItem("vcf_ss_avatar_photo");}catch{}
    if(officeRuntime?.updateAvatarPhoto)officeRuntime.updateAvatarPhoto(null);
  });
}

function setupWebcamSelfie(){
  const openBtn=$("photo-webcam-btn");
  const modal=$("webcam-modal");
  const closeBtn=$("webcam-close-btn");
  const cancelBtn=$("webcam-cancel-btn");
  const snapBtn=$("webcam-snap-btn");
  const video=$("webcam-video");
  const deskSelfieBtn=$("customizer-take-selfie");
  let stream=null;

  async function startCamera(){
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
        toast("Webcam access is not supported in this browser. Please use file upload.");
        return;
      }
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},
        audio:false
      });
      if(video){
        video.srcObject=stream;
        await video.play();
      }
      if(modal){
        if(typeof modal.showModal==="function") modal.showModal();
        else modal.classList.remove("hidden");
      }
    }catch(err){
      toast("Could not access camera ("+(err.name||"Permission denied")+"). You can upload a photo instead!");
    }
  }

  function stopCamera(){
    if(stream){
      stream.getTracks().forEach(t=>t.stop());
      stream=null;
    }
    if(video) video.srcObject=null;
    if(modal){
      if(typeof modal.close==="function") modal.close();
      else modal.classList.add("hidden");
    }
  }

  function snapPhoto(){
    if(!video||!video.videoWidth)return;
    const canvas=document.createElement("canvas");
    const size=Math.min(video.videoWidth,video.videoHeight);
    canvas.width=320;
    canvas.height=320;
    const ctx=canvas.getContext("2d");
    const sx=(video.videoWidth-size)/2;
    const sy=(video.videoHeight-size)/2;
    ctx.drawImage(video,sx,sy,size,size,0,0,320,320);
    const dataUrl=canvas.toDataURL("image/jpeg",0.88);

    const img=new Image();
    img.onload=()=>{
      applyMatchedPhoto(img,dataUrl);
      stopCamera();
    };
    img.src=dataUrl;
  }

  openBtn?.addEventListener("click",startCamera);
  deskSelfieBtn?.addEventListener("click",startCamera);
  closeBtn?.addEventListener("click",stopCamera);
  cancelBtn?.addEventListener("click",stopCamera);
  snapBtn?.addEventListener("click",snapPhoto);
  modal?.addEventListener("cancel",stopCamera);
}

function setupDeskCustomizer(){
  const dialog=$("desk-customizer-dialog");
  const closeBtn=$("desk-customizer-close");
  const cancelBtn=$("desk-customizer-cancel");
  const saveBtn=$("desk-customizer-save");
  const mottoInput=$("customizer-motto-input");
  const showBadgeCheck=$("customizer-show-badge");
  const propCards=document.querySelectorAll(".prop-choice-card");
  const themeCards=document.querySelectorAll(".theme-choice-card");
  const presetPills=document.querySelectorAll(".motto-preset-pill");

  let selectedProp="mini-tree";
  let selectedTheme="emerald";

  function loadSavedSettings(){
    let saved={};
    try{saved=JSON.parse(localStorage.getItem("vcf_ss_desk_custom")||"{}");}catch{}
    selectedProp=saved.prop||"mini-tree";
    selectedTheme=saved.theme||"emerald";
    if(mottoInput)mottoInput.value=saved.motto||"";
    if(showBadgeCheck)showBadgeCheck.checked=saved.showBadge!==false;

    propCards.forEach(c=>{
      c.classList.toggle("active",c.dataset.prop===selectedProp);
    });
    themeCards.forEach(c=>{
      c.classList.toggle("active",c.dataset.theme===selectedTheme);
    });
  }

  propCards.forEach(card=>{
    card.addEventListener("click",()=>{
      propCards.forEach(c=>c.classList.remove("active"));
      card.classList.add("active");
      selectedProp=card.dataset.prop;
    });
  });

  themeCards.forEach(card=>{
    card.addEventListener("click",()=>{
      themeCards.forEach(c=>c.classList.remove("active"));
      card.classList.add("active");
      selectedTheme=card.dataset.theme;
    });
  });

  presetPills.forEach(pill=>{
    pill.addEventListener("click",()=>{
      if(mottoInput) mottoInput.value=pill.dataset.motto;
    });
  });

  function closeDialog(){
    if(dialog){
      if(typeof dialog.close==="function")dialog.close();
      else dialog.classList.add("hidden");
    }
  }

  closeBtn?.addEventListener("click",closeDialog);
  cancelBtn?.addEventListener("click",closeDialog);
  dialog?.addEventListener("cancel",closeDialog);

  saveBtn?.addEventListener("click",()=>{
    const settings={
      prop:selectedProp,
      theme:selectedTheme,
      motto:mottoInput?.value?.trim()||"",
      showBadge:showBadgeCheck ? showBadgeCheck.checked : true
    };
    try{localStorage.setItem("vcf_ss_desk_custom",JSON.stringify(settings));}catch{}
    if(officeRuntime?.customizeMyDesk){
      officeRuntime.customizeMyDesk(settings);
    }
    closeDialog();
    if(typeof officeToast==="function")officeToast("✨ Desk personalized & saved!");
    else toast("✨ Desk personalized & saved!");
  });

  loadSavedSettings();
}

setupPhotoAvatarMatcher();
setupWebcamSelfie();
setupDeskCustomizer();

function setupChildQuestAndArcade(){
  const STORAGE_KEY="vcf_child_quest_data";
  const DEFAULT_QUEST={
    childName:"Holiday Explorer",
    santaName:"Secret Santa",
    activeGame:"voxel-racers",
    tasks:[
      {
        id:"voxel-racers",
        title:"Voxel Monster Racers",
        icon:"🏎️",
        gameUrl:"https://achallakiran.github.io/voxel-racers/",
        goal:"Finish 1 lap on Dust Track or score over 500 points!",
        clue:"Your Secret Santa sits on the bright window side of the office!",
        completed:false
      },
      {
        id:"voxel-bike",
        title:"Voxel Bikes Redline",
        icon:"🏍️",
        gameUrl:"https://achallakiran.github.io/voxel-bike/",
        goal:"Complete the Redline race course without crashing!",
        clue:"Your Secret Santa always carries a blue water bottle and loves dark chocolate!",
        completed:false
      }
    ],
    giftReveal:{
      hidingLocation:"Look under the Christmas tree wrapped in shiny red paper with golden ribbons! 🎁",
      message:"Ho Ho Ho! You solved all the mysteries! You are so clever! Merry Christmas!"
    }
  };

  function loadQuestData(){
    const urlParam=PARAMS.get("quest");
    if(urlParam){
      try{
        const decoded=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(urlParam)))));
        if(decoded&&decoded.tasks){
          localStorage.setItem(STORAGE_KEY,JSON.stringify(decoded));
          return decoded;
        }
      }catch(_e){}
    }
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(saved&&saved.tasks)return Object.assign({},DEFAULT_QUEST,saved);
    }catch(_e){}
    return JSON.parse(JSON.stringify(DEFAULT_QUEST));
  }

  let quest=loadQuestData();
  function saveQuest(){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(quest));
    }catch(_e){}
    updateUI();
  }

  function updateUI(){
    const completedCount=quest.tasks.filter(t=>t.completed).length;
    const badge=$("hud-quest-badge");
    if(badge)badge.textContent=`${completedCount}/${quest.tasks.length}`;

    const list=$("quest-tasks-list");
    if(list){
      list.innerHTML="";
      quest.tasks.forEach((t,index)=>{
        const card=document.createElement("div");
        card.className=`quest-task-card ${t.completed?"completed":""}`;
        card.innerHTML=`
          <div class="task-left">
            <span class="task-status-icon">${t.completed?"🔓":"🔒"}</span>
            <div>
              <p class="task-title">Task ${index+1}: ${t.icon} ${t.title}</p>
              <p class="task-goal-text" style="font-size:11px;color:#a0aec0;margin:2px 0 0;">🎯 ${t.goal}</p>
              ${t.completed?`<p class="task-clue-reveal">💡 Clue #${index+1}: "${t.clue}"</p>`:`<p style="font-size:11px;color:#cbd5cb;margin:2px 0 0;font-style:italic;">Play in Break-Room Arcade to unlock clue</p>`}
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-play-game="${t.id}">
            ${t.completed?"Replay 🎮":"Play 🕹️"}
          </button>
        `;
        list.appendChild(card);
      });

      list.querySelectorAll("[data-play-game]").forEach(btn=>{
        btn.addEventListener("click",()=>{
          const gameId=btn.getAttribute("data-play-game");
          $("child-quest-modal")?.close();
          openArcade(gameId);
        });
      });
    }

    const modalTitle=$("quest-modal-title");
    if(modalTitle&&quest.childName){
      modalTitle.textContent=`🎄 ${quest.childName}'s Secret Santa Quest`;
    }

    const finaleStatus=$("quest-finale-status");
    const goTreeBtn=$("quest-go-tree-btn");
    if(finaleStatus&&goTreeBtn){
      if(completedCount===quest.tasks.length){
        finaleStatus.textContent=`✨ All ${quest.tasks.length} Clues Unlocked! The Christmas Tree is glowing in celebration!`;
        goTreeBtn.disabled=false;
      }else{
        finaleStatus.textContent=`🔒 ${completedCount} of ${quest.tasks.length} clues unlocked. Beat the tasks to unlock all clues!`;
        goTreeBtn.disabled=true;
      }
    }
  }

  const arcadeModal=$("arcade-modal");
  const arcadeIframe=$("arcade-iframe");
  const arcadeFullscreen=$("arcade-fullscreen-link");
  const arcadeGoalDesc=$("arcade-goal-desc");
  const arcadeClaimBtn=$("arcade-claim-clue-btn");
  const arcadeTimerBtn=$("arcade-timer-btn");
  const arcadeTimerDisplay=$("arcade-timer-display");

  let arcadeTimerInterval=null;
  let arcadeTimerSeconds=0;

  function resetArcadeTimer(){
    if(arcadeTimerInterval){
      clearInterval(arcadeTimerInterval);
      arcadeTimerInterval=null;
    }
    arcadeTimerSeconds=0;
    if(arcadeTimerDisplay)arcadeTimerDisplay.textContent="Start Timer";
  }

  arcadeTimerBtn?.addEventListener("click",()=>{
    if(arcadeTimerInterval){
      // Stop timer
      clearInterval(arcadeTimerInterval);
      arcadeTimerInterval=null;
      if(arcadeTimerDisplay){
        const m=String(Math.floor(arcadeTimerSeconds/60)).padStart(2,"0");
        const s=String(arcadeTimerSeconds%60).padStart(2,"0");
        arcadeTimerDisplay.textContent=`Stopped (${m}:${s}) ↻`;
      }
    }else{
      // Start timer
      arcadeTimerSeconds=0;
      arcadeTimerInterval=setInterval(()=>{
        arcadeTimerSeconds++;
        const m=String(Math.floor(arcadeTimerSeconds/60)).padStart(2,"0");
        const s=String(arcadeTimerSeconds%60).padStart(2,"0");
        if(arcadeTimerDisplay)arcadeTimerDisplay.textContent=`${m}:${s} (Stop)`;
      },1000);
    }
  });

  function openArcade(gameId="voxel-racers"){
    quest.activeGame=gameId;
    resetArcadeTimer();
    document.querySelectorAll(".arcade-tab-btn").forEach(btn=>{
      btn.classList.toggle("active",btn.getAttribute("data-game")===gameId);
    });

    const activeTask=quest.tasks.find(t=>t.id===gameId)||quest.tasks[0];
    if(arcadeGoalDesc){
      arcadeGoalDesc.textContent=`${activeTask.goal} (Unlocks Clue for: "${activeTask.title}")`;
    }
    if(arcadeClaimBtn){
      arcadeClaimBtn.textContent=activeTask.completed?"✨ Clue Already Claimed!":"🏆 Claim Clue!";
      arcadeClaimBtn.style.opacity=activeTask.completed?"0.6":"1";
    }

    if(arcadeFullscreen)arcadeFullscreen.style.display="inline-flex";
    const url=gameId==="voxel-bike"
      ?"https://achallakiran.github.io/voxel-bike/"
      :"https://achallakiran.github.io/voxel-racers/";
    if(arcadeIframe&&arcadeIframe.src!==url){
      arcadeIframe.src=url;
    }
    if(arcadeFullscreen)arcadeFullscreen.href=url;

    if(typeof arcadeModal.showModal==="function")arcadeModal.showModal();
    else arcadeModal.classList.remove("hidden");
  }

  document.querySelectorAll(".arcade-tab-btn").forEach(tab=>{
    tab.addEventListener("click",()=>{
      const game=tab.getAttribute("data-game");
      openArcade(game);
    });
  });

  $("arcade-close-btn")?.addEventListener("click",()=>{
    resetArcadeTimer();
    arcadeModal.close();
  });
  $("arcade-reload-btn")?.addEventListener("click",()=>{
    resetArcadeTimer();
    if(arcadeIframe&&!arcadeIframe.classList.contains("hidden")){
      const src=arcadeIframe.src;
      arcadeIframe.src=src;
    }
  });

  arcadeClaimBtn?.addEventListener("click",()=>{
    const activeTask=quest.tasks.find(t=>t.id===quest.activeGame);
    if(!activeTask)return;
    if(activeTask.completed){
      if(typeof officeToast==="function"){
        officeToast(`ℹ️ Clue already unlocked: "${activeTask.clue}"`);
      }else{
        toast(`ℹ️ Clue already unlocked: "${activeTask.clue}"`);
      }
      return;
    }

    const confirmed=confirm(`🏁 Secret Santa Challenge Verification:\n\nDid you achieve Santa's goal?\n"${activeTask.goal}"\n\nClick OK to verify and unlock your clue!`);
    if(!confirmed)return;

    activeTask.completed=true;
    saveQuest();
    playFestiveChime("unlock");
    officeRuntime?.triggerCelebration?.();
    if(typeof officeToast==="function"){
      officeToast(`🎉 GOAL ACHIEVED! Clue Unlocked: "${activeTask.clue}"`);
    }else{
      toast(`🎉 GOAL ACHIEVED! Clue Unlocked: "${activeTask.clue}"`);
    }
    arcadeClaimBtn.textContent="✨ Clue Claimed! (Check Quest Log)";
    arcadeClaimBtn.style.opacity="0.6";
  });

  const workshopModal=$("parent-workshop-modal");
  function openWorkshop(){
    $("workshop-child-name").value=quest.childName||"Holiday Explorer";
    $("workshop-santa-name").value=quest.santaName||"Secret Santa";
    $("workshop-goal-1").value=quest.tasks[0]?.goal||"";
    $("workshop-clue-1").value=quest.tasks[0]?.clue||"";
    $("workshop-goal-2").value=quest.tasks[1]?.goal||"";
    $("workshop-clue-2").value=quest.tasks[1]?.clue||"";
    $("workshop-gift-location").value=quest.giftReveal?.hidingLocation||"";
    $("workshop-gift-message").value=quest.giftReveal?.message||"";

    if(typeof workshopModal.showModal==="function")workshopModal.showModal();
    else workshopModal.classList.remove("hidden");
  }

  function readWorkshopForm(){
    quest.childName=$("workshop-child-name").value.trim()||"Holiday Explorer";
    quest.santaName=$("workshop-santa-name").value.trim()||"Secret Santa";
    if(quest.tasks[0]){
      quest.tasks[0].goal=$("workshop-goal-1").value.trim();
      quest.tasks[0].clue=$("workshop-clue-1").value.trim();
    }
    if(quest.tasks[1]){
      quest.tasks[1].goal=$("workshop-goal-2").value.trim();
      quest.tasks[1].clue=$("workshop-clue-2").value.trim();
    }
    quest.giftReveal={
      hidingLocation:$("workshop-gift-location").value.trim(),
      message:$("workshop-gift-message").value.trim()
    };
  }

  $("workshop-close-btn")?.addEventListener("click",()=>workshopModal.close());
  $("workshop-cancel-btn")?.addEventListener("click",()=>workshopModal.close());

  $("workshop-start-quest-btn")?.addEventListener("click",()=>{
    readWorkshopForm();
    quest.tasks.forEach(t=>t.completed=false);
    saveQuest();
    workshopModal.close();
    toast(`🎅 Child Quest armed for ${quest.childName}!`);
  });

  $("workshop-share-link-btn")?.addEventListener("click",async()=>{
    readWorkshopForm();
    saveQuest();
    const encoded=encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(quest)))));
    const fullUrl=`${location.origin}${location.pathname}?quest=${encoded}`;
    try{
      await navigator.clipboard.writeText(fullUrl);
      toast("📋 Shareable Child Quest Link copied to clipboard!");
    }catch(_e){
      prompt("Copy your shareable quest link:",fullUrl);
    }
  });

  const treeModal=$("tree-guess-modal");
  function openTreeGuessing(){
    const cluesBox=$("tree-unlocked-clues-box");
    if(cluesBox){
      cluesBox.innerHTML="";
      const unlocked=quest.tasks.filter(t=>t.completed);
      if(unlocked.length===0){
        cluesBox.innerHTML=`<p style="font-size:12px;color:#a0aec0;margin:0;">No clues unlocked yet! Visit the Break-Room Arcade to unlock your first clue.</p>`;
      }else{
        unlocked.forEach((t,i)=>{
          const pill=document.createElement("div");
          pill.className="clue-pill";
          pill.textContent=`💡 Clue #${i+1}: ${t.clue}`;
          cluesBox.appendChild(pill);
        });
      }
    }
    $("tree-guess-feedback").textContent="";
    $("tree-guess-input").value="";
    $("tree-guess-view")?.classList.remove("hidden");
    $("tree-reveal-view")?.classList.add("hidden");

    if(typeof treeModal.showModal==="function")treeModal.showModal();
    else treeModal.classList.remove("hidden");
  }

  $("tree-guess-close-btn")?.addEventListener("click",()=>treeModal.close());

  $("tree-guess-submit-btn")?.addEventListener("click",()=>{
    const input=$("tree-guess-input").value.trim().toLowerCase();
    const santa=(quest.santaName||"Secret Santa").trim().toLowerCase();
    const feedback=$("tree-guess-feedback");
    if(!input){
      if(feedback)feedback.textContent="Please type your guess!";
      return;
    }
    const isCorrect=input===santa||santa.includes(input)||input.includes(santa);
    if(isCorrect){
      playFestiveChime("victory");
      officeRuntime?.triggerCelebration?.();
      $("tree-guess-view")?.classList.add("hidden");
      $("tree-reveal-view")?.classList.remove("hidden");
      $("unwrapping-box-container")?.classList.remove("hidden");
      $("tree-gift-content")?.classList.add("hidden");
    }else{
      if(feedback){
        feedback.textContent="🤔 Good guess, but not quite! Re-read your clues and try again!";
        feedback.style.color="#fc8181";
      }
    }
  });

  $("tree-unwrap-action-btn")?.addEventListener("click",()=>{
    playFestiveChime("fanfare");
    officeRuntime?.triggerCelebration?.();
    $("unwrapping-box-container")?.classList.add("hidden");
    const content=$("tree-gift-content");
    content?.classList.remove("hidden");
    $("gift-santa-reveal").textContent=`Your Secret Santa is ${quest.santaName}!`;
    $("gift-location-text").textContent=quest.giftReveal?.hidingLocation||"Look under the tree!";
    $("gift-blessing-text").textContent=quest.giftReveal?.message||"Merry Christmas!";
  });

  $("tree-finish-celebration-btn")?.addEventListener("click",()=>{
    treeModal.close();
  });

  function openQuestModal(){
    updateUI();
    const questModal=$("child-quest-modal");
    if(typeof questModal?.showModal==="function")questModal.showModal();
    else questModal?.classList.remove("hidden");
  }

  $("hud-btn-quest")?.addEventListener("click",openQuestModal);
  $("nav-btn-quest")?.addEventListener("click",openQuestModal);

  $("quest-close-btn")?.addEventListener("click",()=>$("child-quest-modal")?.close());

  $("quest-go-tree-btn")?.addEventListener("click",()=>{
    $("child-quest-modal")?.close();
    officeRuntime?.goToTree?.();
    setTimeout(openTreeGuessing,1200);
  });

  $("hud-btn-arcade")?.addEventListener("click",()=>officeRuntime?.goToArcade?.());
  $("nav-btn-arcade")?.addEventListener("click",()=>officeRuntime?.goToArcade?.());

  $("hud-btn-mydesk")?.addEventListener("click",()=>officeRuntime?.goToDesk?.());
  $("nav-btn-mydesk")?.addEventListener("click",()=>officeRuntime?.goToDesk?.());

  $("hud-btn-workshop")?.addEventListener("click",openWorkshop);
  $("nav-btn-workshop")?.addEventListener("click",openWorkshop);

  // Bottom Navigation "More / Menu" Drawer
  $("nav-btn-more")?.addEventListener("click",()=>{
    const moreDlg=$("more-menu-dialog");
    if(typeof moreDlg?.showModal==="function")moreDlg.showModal();
    else moreDlg?.classList.remove("hidden");
  });
  $("more-menu-close-btn")?.addEventListener("click",()=>$("more-menu-dialog")?.close());

  $("menu-item-party")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.toggleParty?.();
  });
  $("menu-item-time")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.cycleTimeTheme?.();
  });
  $("menu-item-santahub")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    const menu=$("player-menu");
    menu.classList.remove("hidden");
    $("notebook-scroll").scrollTop=0;
    officeRuntime?.setPaused(true);
    showPlayerTab("personal");
  });
  $("menu-item-avatar")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    const menu=$("player-menu");
    menu.classList.remove("hidden");
    $("notebook-scroll").scrollTop=0;
    officeRuntime?.setPaused(true);
    showPlayerTab("character");
  });
  $("menu-item-rules")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    $("rules-dialog")?.showModal();
  });
  $("menu-item-help")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    $("help-dialog")?.showModal();
  });

  window.addEventListener("arcade:open",()=>{
    openArcade("voxel-racers");
  });

  window.addEventListener("christmastree:tap",()=>{
    openTreeGuessing();
  });

  updateUI();
}

setupChildQuestAndArcade();

$("avatar-reset").addEventListener("click",()=>{
  clearTimeout(avatarPreviewTimer);
  if(!avatarBaseline)return;
  setAvatarEditor(avatarBaseline);
  if(!adminEditingParticipant)officeRuntime?.previewAvatar(avatarBaseline);
  avatarStudio?.update(avatarBaseline);
  if(adminEditingParticipant)toast("Restored this participant's saved appearance.");
  else officeToast("Restored the last saved appearance.");
});
$("avatar-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  clearTimeout(avatarPreviewTimer);
  const avatar=readAvatarEditor();
  if(adminEditingParticipant){
    const edited=adminEditingParticipant;
    const result=await api("admin_save_avatar",{
      event_id:event.id,participant_id:edited.id,
      avatar,version:edited.version
    });
    if(adminEditingParticipant!==edited)return;
    edited.version=result.version;
    edited.avatar=result.avatar;
    avatarBaseline=result.avatar;
    avatarStudio?.update(result.avatar);
    setAvatarEditor(result.avatar);
    $("avatar-preview-status").textContent="✓ Saved to this participant's profile.";
    await openEvent(event);
    toast("Participant character saved.");
    return;
  }
  if(!player?.me?.id)throw Error("Please enter using your invitation code.");
  const result=await api("save_avatar",{avatar,version:player.me.avatar_version||1});
  player.me.avatar=result.avatar;
  player.me.avatar_version=result.version;
  avatarBaseline=result.avatar;
  officeKey=avatarIdentity(player);
  officeRuntime?.previewAvatar(result.avatar);
  avatarStudio?.update(result.avatar);
  setAvatarEditor(result.avatar);
  $("avatar-preview-status").textContent="✓ Saved to your Secret Santa participant profile.";
  officeToast("✓ Your appearance is saved.");
}));


function setStudioTab(name){
  if(!["look","hair","fashion","accessories","footwear","shape"].includes(name))return;
  activeStudioTab=name;
  document.querySelectorAll("[data-studio-tab]").forEach(button=>{
    const selected=button.dataset.studioTab===name;
    button.classList.toggle("active",selected);
    button.setAttribute("aria-selected",String(selected));
  });
  document.querySelectorAll("[data-studio-panel]").forEach(panel=>{
    panel.classList.toggle("hidden",panel.dataset.studioPanel!==name);
  });
  const titles={look:"Face & skin",hair:"Hair, beards & choti",fashion:"Outfit & colors",
    accessories:"Spectacles",footwear:"Footwear & shoe color",shape:"Height & build"};
  $("atelier-category-title").textContent=titles[name];
  visualEditor?.refresh(name);
}
document.querySelectorAll("[data-studio-tab]").forEach(button=>
  button.addEventListener("click",()=>setStudioTab(button.dataset.studioTab))
);
async function ensureAvatarStudio(){
  if(avatarStudio||avatarStudioLoading)return;
  const isVisible=()=>adminEditingParticipant?
    $("admin-avatar-dialog").open&&$("player-character").parentElement===$("admin-avatar-editor-host"):
    Boolean(officeRuntime&&player&&!$("player-menu").classList.contains("hidden")
      &&!$("player-character").classList.contains("hidden"));
  if(!isVisible())return;
  avatarStudioLoading=(async()=>{
    const module=await import("./game/studio.js?v=clean-avatar-preview-v1");
    if(!isVisible())return;
    avatarStudio=module.mountAvatarStudio($("avatar-studio-canvas"),readAvatarEditor());
    visualEditor?.refresh(activeStudioTab);
  })();
  try{await avatarStudioLoading;}
  catch(err){
    toast("3D character preview couldn't load. Please try reopening the editor.",true);
    console.error(err);
  }finally{avatarStudioLoading=null;}
}
function closeAdminCharacterEditor(){
  clearTimeout(avatarPreviewTimer);
  const dialog=$("admin-avatar-dialog");
  if(avatarStudio){avatarStudio.dispose();avatarStudio=null;}
  // In-game avatar and Santa Hub panels share an independently scrolling
  // content region. The administrator editor temporarily borrows the avatar
  // panel and must restore it to that region, not above the fixed header.
  const section=$("player-character"),parent=$("notebook-scroll");
  if(section.parentElement!==parent)parent.insertBefore(section,$("player-personal"));
  adminEditingParticipant=null;
  document.body.classList.remove("admin-avatar-editing");
  if(dialog.open)dialog.close();
}
async function openAdminCharacterEditor(person){
  if(!ADMIN||!session?.token||!event)return;
  const p=participants.find(x=>x.id===person.id);
  if(!p){toast("Participant no longer exists. Refresh the roster.",true);return;}
  if(adminEditingParticipant)closeAdminCharacterEditor();
  adminEditingParticipant={
    id:p.id,version:p.avatar_version||1,avatar:p.avatar||{},
    eventId:event.id,name:p.display_name
  };
  $("admin-avatar-name").textContent=p.display_name;
  $("admin-character-name").value=p.display_name;
  $("admin-character-desk").value=p.desk_key||"";
  const detailsLocked=assignments.some(a=>a.santa_id===p.id||a.child_id===p.id)||!["draft","active"].includes(event.status);
  $("admin-character-name").disabled=detailsLocked;
  $("admin-character-desk").disabled=detailsLocked;
  $("admin-character-save-details").disabled=detailsLocked;
  $("admin-avatar-editor-host").append($("player-character"));
  $("admin-avatar-dialog").showModal();
  document.body.classList.add("admin-avatar-editing");
  avatarBaseline=p.avatar||{};
  setAvatarEditor(avatarBaseline);
  setStudioTab("look");
  await ensureAvatarStudio();
}
$("admin-avatar-close").addEventListener("click",closeAdminCharacterEditor);
$("admin-avatar-dialog").addEventListener("close",closeAdminCharacterEditor);
$("admin-character-details").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const edited=adminEditingParticipant;
  if(!edited)return;
  const display_name=$("admin-character-name").value.trim();
  if(!display_name)throw Error("Enter the participant's name.");
  const desk_key=$("admin-character-desk").value.trim();
  const p=participants.find(p=>p.id===edited.id);
  await api("edit_participant",{
    event_id:edited.eventId,participant_id:edited.id,
    display_name,desk_key,is_active:p?.is_active??true
  });
  edited.name=display_name;
  $("admin-avatar-name").textContent=display_name;
  await openEvent(event);
  toast("Participant details saved.");
}));
function closePlayerMenu(){
  $("player-menu").classList.add("hidden");
  officeRuntime?.setPaused(false);
  if(avatarStudio){avatarStudio.dispose();avatarStudio=null;}
}

function showPlayerTab(name){
  const personal=name==="personal";
  $("player-character").classList.toggle("hidden",personal);
  $("player-personal").classList.toggle("hidden",!personal);
  $("player-tab-character").classList.toggle("active",!personal);
  $("player-tab-personal").classList.toggle("active",personal);
  $("player-tab-character").setAttribute("aria-selected",String(!personal));
  $("player-tab-personal").setAttribute("aria-selected",String(personal));
  // Changing panels must never carry over the previous panel's scroll
  // offset; scrolling now affects only the body, leaving tabs stationary.
  $("notebook-scroll").scrollTop=0;
  if(!personal){
    setStudioTab(activeStudioTab);
    void ensureAvatarStudio();
  }else if(avatarStudio){
    avatarStudio.dispose();avatarStudio=null;
  }
}
async function loadPlayer(){
  const firstEntry=!player||$("player").classList.contains("hidden");
  player=await api("player_dashboard");
  // The daily note is available from the gameplay bulb, not a redundant
  // Santa Hub mystery/office-puzzle panel.
  if(firstEntry){
    $("welcome").classList.add("hidden");
    $("admin").classList.add("hidden");
    $("player").classList.remove("hidden");
    document.body.classList.add("office-playing");
    christmasMusic.enter();
    void enterOffice(player);
  }
  $("player-greeting").textContent="✦ "+player.me.display_name;
  $("player-event-title").textContent=player.event.title;
  if($("hud-event-name")&&player.event?.title){
    $("hud-event-name").textContent=player.event.title;
  }
  $("personal-name").textContent=player.me.display_name;
  const child=player.myChild;
  $("my-assignment-status").classList.toggle("hidden",!!child);
  $("my-assignment-status").textContent=child?"": 
    "⏳ Waiting for the organizer's Santa draw. You can prepare your wishlist now.";
  const budget=Number(player.event?.budget);
  $("personal-budget").textContent=Number.isFinite(budget)&&budget>0?
    "Suggested gift budget: ₹"+budget.toLocaleString("en-IN"):"";
  $("task-date").min=player.today;
  if(!$("task-date").value||$("task-date").value<player.today)$("task-date").value=player.today;
  const wished=$("wishlist-items");wished.replaceChildren();
  if(!player.me.wishlist.length)itemLine(wished,"Add a few thoughtful gift ideas.");
  for(const w of player.me.wishlist){
    const row=itemLine(wished,w.text);
    row.append(button("×",run(async()=>{
      await saveWishlist(player.me.wishlist.filter(x=>x.id!==w.id));
    })));
  }
  const incoming=$("received-tasks");incoming.replaceChildren();
  if(!player.receivedTasks.length)itemLine(incoming,"No tasks assigned yet.");
  for(const t of player.receivedTasks)renderSantaTask(incoming,t,false);
  const label=$("child-name");
  label.classList.toggle("hidden",!child||!childVisible);
  label.textContent=child&&childVisible?privateChildLabel():"";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
  $("child-toggle").disabled=!child;
  const childWishes=$("child-wishlist");childWishes.replaceChildren();
  const myTasks=$("assigned-tasks");myTasks.replaceChildren();
  $("santa-message").disabled=!child;
  $("save-message").disabled=!child;
  $("gift-purchased").disabled=!child;
  $("task-form").querySelectorAll("input,textarea,button").forEach(x=>x.disabled=!child);

  // Clues now live exclusively behind the in-office lightbulb.
  // Preserve the existing server-side unlock count and 24h cooldown.
  updateClueButton();
  if(!child){
    itemLine(childWishes,"Your Secret Child's wishlist will appear after the draw.");
    itemLine(myTasks,"No assigned Secret Child yet. Tasks are optional.");
    $("santa-message").value="";
    $("gift-purchased").checked=false;
    return;
  }
  if(!child.wishlist.length)itemLine(childWishes,"Your Child hasn't added wishes yet.");
  else child.wishlist.forEach(w=>itemLine(childWishes,w.text));
  $("santa-message").value=child.message||"";
  $("gift-purchased").checked=!!child.gift_purchased;
  if(!child.tasks.length)itemLine(myTasks,"No tasks assigned yet.");
  for(const task of child.tasks)renderSantaTask(myTasks,task,true);
}
// Both columns use the same dated task visual; only the author can mark
// the tasks they sent as completed, preserving the current permission model.
function renderSantaTask(parent,task,editable){
  const row=node("div","personal-item santa-task-entry");
  const date=node("time","santa-task-date",niceDate(task.task_date));
  date.dateTime=task.task_date;
  const words=node("span","santa-task-text",task.task_text);
  const state=node("span","santa-task-status",task.status==="completed"?"✓ Done":"");
  row.append(date,words);
  if(editable){
    const box=node("input");box.type="checkbox";box.checked=task.status==="completed";
    box.disabled=task.status==="cancelled";
    box.setAttribute("aria-label","Mark task completed: "+task.task_text);
    box.addEventListener("change",run(async()=>{
      await api("complete_task",{task_id:task.id,completed:box.checked});
      await loadPlayer();
    }));
    row.append(box);
  }else if(task.status==="completed")row.append(state);
  parent.append(row);
}
async function saveWishlist(wishes){
  await api("save_wishlist",{items:wishes,version:player.me.wishlist_version});
  await loadPlayer();
  toast("Wishlist saved.");
}

$("workspace-copy-link").addEventListener("click",run(async()=>{
  if(!event)throw Error("Choose an event first.");
  const link=eventUrl();
  const copied=await copyTextWithFallback(link);
  if(copied)toast("Event URL copied. Send it to your colleagues.");
}));

$("entry-code").addEventListener("input",e=>{
  e.target.value=e.target.value.replace(/\D/g,"").slice(0,4);
});
$("entry-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  if(!EVENT_SLUG)throw Error("Use the event-specific invitation link sent by your organizer.");
  // Unlock Web Audio inside the user's form-submit gesture. Audio remains
  // silent until the invitation is verified and the office actually opens.
  christmasMusic.unlock();
  const result=await api("player_login",{event_slug:EVENT_SLUG,code:$("entry-code").value});
  setSession(result);
  $("entry-code").value="";
  await loadPlayer();
}));
$("auth-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const result=await api("admin_login",{pin:$("admin-pin").value});
  setSession(result);$("admin-pin").value="";
  await loadEvents();
}));
$("admin-register-toggle").addEventListener("click",()=>{
  const form=$("admin-register-form");
  form.classList.toggle("hidden");
  const active=!form.classList.contains("hidden");
  $("auth-form").classList.toggle("hidden",active);
  $("admin-register-toggle").textContent=active?"Already an organizer? Sign in":"New organizer? Create account";
});
$("admin-register-cancel").addEventListener("click",()=>{
  $("admin-register-form").reset();
  $("admin-register-form").classList.add("hidden");
  $("auth-form").classList.remove("hidden");
  $("admin-register-toggle").textContent="New organizer? Create account";
});
$("admin-register-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const pin=$("admin-reg-pin").value;
  const confirm_pin=$("admin-reg-pin-confirm").value;
  if(pin!==confirm_pin)throw Error("PIN confirmation does not match.");
  const result=await api("admin_register",{
    name:$("admin-reg-name").value.trim(),
    invite_code:$("admin-reg-code").value.trim(),
    pin,confirm_pin
  });
  $("admin-register-form").reset();
  $("admin-register-form").classList.add("hidden");
  $("auth-form").classList.remove("hidden");
  setSession(result);
  await loadEvents();
  toast("Organizer account created. Your events are private to this PIN.");
}));
$("admin-invite-create").addEventListener("click",run(async()=>{
  if(!session?.token)throw Error("Sign in as an organizer first.");
  const invitation=await api("create_admin_invite");
  latestAdminInvitation=invitation;
  $("admin-invite-code").textContent=invitation.code;
  $("admin-invite-result").classList.remove("hidden");
  toast("One-time registration code created.");
}));
$("admin-invite-copy").addEventListener("click",run(async()=>{
  if(!latestAdminInvitation?.code)throw Error("Generate a registration code first.");
  const url=location.origin+location.pathname+"?admin=1";
  const text="Secret Santa Admin Console: "+url+
    "\nRegistration code: "+latestAdminInvitation.code+
    "\nExpires: "+new Date(latestAdminInvitation.expires_at).toLocaleString()+
    "\nOpen the console and choose New organizer? Create account.";
  const copied=await copyTextWithFallback(text);
  if(copied)toast("Organizer invitation details copied.");
}));
$("sign-out").addEventListener("click",()=>{endSession();toast("Admin session ended.");});
$("refresh-events").addEventListener("click",run(loadEvents));
$("pin-change-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const current_pin=$("current-pin").value;
  const new_pin=$("new-pin").value;
  if(!confirm("Change the admin PIN? Earlier admin sessions will stop working."))return;
  const result=await api("change_admin_pin",{current_pin,new_pin});
  setSession(result);
  $("pin-change-form").reset();toast("Administrator PIN changed.");
}));
$("event-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const created=await api("create_event",{title:$("event-name").value});
  $("event-name").value="";
  await loadEvents();await openEvent(created.event);
  toast("Event created.");
}));
$("participant-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const result=await api("add_participant",{
    event_id:event.id,display_name:$("participant-name").value,
    desk_key:$("participant-desk").value.trim()
  });
  $("participant-form").reset();
  await openEvent(event);
  toast("Participant added. Use WhatsApp to share their invitation privately.");
}));
$("reassign-all-btn").addEventListener("click",run(async()=>{
  if(!event||!assignments.length)return;
  const text="This will permanently replace ALL "+assignments.length+
    " Santa pairings and clear their existing gift flags, personal messages, hints and tasks. Participants may already know their original Secret Child.";
  if(!confirm("DANGEROUS RESET\n\n"+text+"\n\nDo you want to continue?"))return;
  if(prompt("For the final confirmation, type REASSIGN (uppercase):")!=="REASSIGN")return;
  const result=await api("reassign_all",{event_id:event.id,confirmation:"REASSIGN"});
  await openEvent(event);
  toast(result.assigned+" new Santa pairs generated. Old pair-specific data was cleared.");
}));
$("ceremony-launch").addEventListener("click",run(startCeremony));
$("ceremony-close").addEventListener("click",()=>$("ceremony-dialog").close());
$("ceremony-dialog").addEventListener("close",()=>{
  ceremonySerial++;ceremonyRuntime?.dispose();ceremonyRuntime=null;
  ceremonyData=null;ceremonyRevealed=false;
});
$("ceremony-select").addEventListener("change",run(async e=>{
  const index=ceremonyPeople.findIndex(p=>p.id===e.target.value);
  if(index>=0)await showCeremonyMember(index);
}));
$("ceremony-next").addEventListener("click",run(async()=>{
  if(ceremonyIndex<ceremonyPeople.length-1)await showCeremonyMember(ceremonyIndex+1);
}));
$("ceremony-prev").addEventListener("click",run(async()=>{
  if(ceremonyIndex>0)await showCeremonyMember(ceremonyIndex-1);
}));
$("ceremony-next-clue").addEventListener("click",()=>{
  if(!ceremonyData?.hints||ceremonyCluesShown>=ceremonyData.hints.length)return;
  ceremonyCluesShown++;
  ceremonyLine("ceremony-clues",ceremonyData.hints.slice(0,ceremonyCluesShown)
    .map((h,i)=>"CLUE "+(i+1)+" · "+h),"No hints have been written.");
  $("ceremony-next-clue").disabled=ceremonyCluesShown>=ceremonyData.hints.length;
});
$("ceremony-reveal-btn").addEventListener("click",revealCeremonySanta);
$("assign-btn").addEventListener("click",run(async()=>{
  if(!event)return;
  const pending=pendingPeople();
  if(pending.length<2)return;
  const warning=pending.length===2?
    "Only two participants are awaiting allocation. They will be each other's Santa and could infer the sender. Assign them anyway?":
    "Assign "+pending.length+" participants now? Everyone will give to one person and receive from someone else. No tasks will be created. Existing pairs will never change.";
  if(!confirm(warning))return;
  const res=await api("assign_pending",{event_id:event.id});
  await openEvent(event);
  toast(res.assigned+" Santa–Child pairs assigned privately. No tasks created.");
}));
$("player-pause")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  const menu=$("player-menu");
  if(!menu.classList.contains("hidden")){closePlayerMenu();return;}
  menu.classList.remove("hidden");
  $("notebook-scroll").scrollTop=0;
  officeRuntime?.setPaused(true);
  showPlayerTab("character");
});
$("hud-btn-santa")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  const menu=$("player-menu");
  menu.classList.remove("hidden");
  $("notebook-scroll").scrollTop=0;
  officeRuntime?.setPaused(true);
  showPlayerTab("personal");
});
$("hud-btn-avatar")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  const menu=$("player-menu");
  menu.classList.remove("hidden");
  $("notebook-scroll").scrollTop=0;
  officeRuntime?.setPaused(true);
  showPlayerTab("character");
});
$("hud-btn-rules")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  $("rules-dialog")?.showModal();
});
$("rules-dialog-close")?.addEventListener("click",()=>{$("rules-dialog")?.close();});
$("rules-dialog-ok")?.addEventListener("click",()=>{$("rules-dialog")?.close();});

$("hud-btn-help")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  $("help-dialog")?.showModal();
});
$("help-dialog-close")?.addEventListener("click",()=>{$("help-dialog")?.close();});
$("help-dialog-gotit")?.addEventListener("click",()=>{$("help-dialog")?.close();});

$("hud-btn-mydesk")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  officeRuntime?.goToDesk();
});
$("hud-btn-time")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  officeRuntime?.cycleTimeTheme();
});

$("player-close").addEventListener("click",closePlayerMenu);

// Multi-Action Buttons (Wave, Dance, Clap, Cheer)
document.querySelectorAll(".action-pill").forEach(btn=>{
  btn.addEventListener("click",()=>{
    christmasMusic.unlock();
    if(!$("player-menu").classList.contains("hidden"))return;
    if(!officeRuntime){officeToast("Office is still loading.");return;}
    const action=btn.dataset.action;
    if(action){
      officeRuntime.playAction(action);
      btn.style.transform="scale(0.92)";
      setTimeout(()=>btn.style.transform="",150);
    }
  });
});

// Keyboard shortcuts for emotes (1, 2, 3, 4, Space)
window.addEventListener("keydown",e=>{
  if(!officeRuntime||$("player").classList.contains("hidden"))return;
  const menuOpen=!$("player-menu").classList.contains("hidden");
  const dialogOpen=Boolean(document.querySelector("dialog[open]"));
  if(menuOpen||dialogOpen)return;
  const tag=document.activeElement?.tagName;
  if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;

  if(e.key==="1"||e.code==="Digit1"){
    e.preventDefault();
    officeRuntime.playAction("hi");
  }else if(e.key==="2"||e.code==="Digit2"){
    e.preventDefault();
    officeRuntime.playAction("dance");
  }else if(e.key==="3"||e.code==="Digit3"){
    e.preventDefault();
    officeRuntime.playAction("clap");
  }else if(e.key==="4"||e.code==="Digit4"){
    e.preventDefault();
    officeRuntime.playAction("cheer");
  }else if(e.code==="Space"){
    e.preventDefault();
    officeRuntime.playAction("hi");
  }
});

$("player-tab-character").addEventListener("click",()=>showPlayerTab("character"));
$("player-tab-personal").addEventListener("click",()=>showPlayerTab("personal"));
$("refresh-personal").addEventListener("click",run(async()=>{
  await loadPlayer();
  toast("Your private Santa notebook is up to date.");
}));
$("wishlist-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const text=$("wishlist-input").value.trim();
  if(!text)return;
  if(player.me.wishlist.length>=25)throw Error("Your wishlist already has 25 wishes.");
  await saveWishlist([...player.me.wishlist,{id:crypto.randomUUID(),text}]);
  $("wishlist-form").reset();
}));
$("child-toggle").addEventListener("click",()=>{
  if(!player?.myChild)return;
  childVisible=!childVisible;
  $("child-name").classList.toggle("hidden",!childVisible);
  $("child-name").textContent=childVisible?privateChildLabel():"";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
});
$("task-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  await api("add_task",{task_date:$("task-date").value,task_text:$("task-text").value});
  $("task-text").value="";
  await loadPlayer();toast("Task saved for your Secret Child.");
}));
$("gift-purchased").addEventListener("change",run(async e=>{
  await api("gift_status",{purchased:e.target.checked});
  await loadPlayer();toast("Gift status saved.");
}));
$("save-message").addEventListener("click",run(async()=>{
  await api("save_message",{message:$("santa-message").value});
  toast("Private message saved for the ceremony.");
}));
async function init(){
  snowfall();
  $("admin").classList.toggle("hidden",!ADMIN);
  $("welcome").classList.toggle("hidden",ADMIN);
  // Keep the participant landing page focused on the invitation code.
  // Only real participants with event-specific codes may enter the office.
  try{
    const cached=JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY)||"null");
    if(cached?.token&&cached.role===(ADMIN?"admin":"player")){
      session=cached;paintLogin();
      if(ADMIN)await loadEvents();
      else await loadPlayer();
    }
  }catch{endSession();}
}
init();
