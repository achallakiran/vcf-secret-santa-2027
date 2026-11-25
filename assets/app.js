
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
  const directLink=eventUrl()+"&code="+encodeURIComponent(code);
  return "🎄 VCF Secret Santa 🎁\n\nYou've been invited to our Christmas office mystery!\n\n🎮 1-Click Join Link:\n"+directLink+
    "\n\n🔐 Your private code: "+code+
    "\n\n(Clicking the link logs you in automatically!) Share warm wishes and make your Secret Child feel special! 🎅";
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
  const shareUrlInput=$("team-share-url-input");
  if(shareUrlInput)shareUrlInput.value=eventUrl();
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
    const tr=node("tr"),td=node("td","muted","Add a participant above or use Bulk Add Teammates.");
    td.colSpan=7;tbody.append(tr);tr.append(td);return;
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
    const directLink=eventUrl()+(code?"&code="+encodeURIComponent(code):"");

    const directCell=node("td","participant-direct-cell");
    directCell.dataset.label="1-Click Link";
    const copyDirectBtn=button("🔗 Copy",async()=>{
      const ok=await copyTextWithFallback(directLink);
      if(ok)toast(`📋 1-Click link copied for ${p.display_name}!`);
    },"small-outline roster-icon-button");
    copyDirectBtn.title=`Copy 1-Click login link for ${p.display_name}`;
    copyDirectBtn.disabled=!code;
    directCell.append(copyDirectBtn);
    tr.append(directCell);

    const codeCell=node("td","participant-code-cell");codeCell.dataset.label="Code";
    if(code)codeCell.append(node("code","organizer-code",code));
    else codeCell.append(node("small","code-not-recoverable","Reissue to view"));
    tr.append(codeCell);

    const wishlistCell=node("td","participant-wishlist-cell");
    wishlistCell.dataset.label="Wishlist";
    const hasWishlist=Boolean(p.wishlist&&p.wishlist.length>0);
    const wishBadge=node("span",hasWishlist?"wishlist-badge ready":"wishlist-badge pending",hasWishlist?`🎁 Ready (${p.wishlist.length})`:"⏳ Pending");
    wishlistCell.append(wishBadge);
    tr.append(wishlistCell);

    const inviteCell=node("td","participant-invite-cell");inviteCell.dataset.label="WhatsApp";
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

// 100% Blind / Zero-Leak Privacy Mode: NEVER expose who is paired with whom!
function renderPairs(){
  const activeCount=participants.filter(p=>p.is_active).length;
  const pairsCount=$("blind-pairs-count");
  if(pairsCount)pairsCount.textContent=String(assignments.length);

  const loopStatus=$("blind-loop-status");
  if(loopStatus){
    if(assignments.length>0&&assignments.length>=activeCount&&activeCount>=2){
      loopStatus.textContent="100% Sealed & Private 🔒";
      loopStatus.className="blind-status-pill status-sealed";
    }else if(assignments.length>0){
      loopStatus.textContent="Partially Sealed 🔒";
      loopStatus.className="blind-status-pill status-partial";
    }else{
      loopStatus.textContent="Waiting for Draw ⏳";
      loopStatus.className="blind-status-pill status-pending";
    }
  }

  const wishlistsReady=participants.filter(p=>p.is_active&&p.wishlist&&p.wishlist.length>0).length;
  const wishCountEl=$("blind-wishlist-count");
  if(wishCountEl)wishCountEl.textContent=`${wishlistsReady} / ${activeCount}`;

  const arcadeEl=$("blind-arcade-count");
  if(arcadeEl)arcadeEl.textContent=`${assignments.length} Active`;

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
  const proceed=confirm("⚠️ Live Party Stage Show Warning:\n\nThe Christmas Stage Show is designed for your live team party on a projector or screen. It will bring colleagues to the spotlight and reveal who their Secret Santa is.\n\nOnly launch this when you are presenting live to the whole team!\n\nOpen Stage Show now?");
  if(!proceed)return;
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
    const module=await import("./game/main.js?v=arcade-grand-v9");
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
const AVATAR_FIELDS=["gender","outfit","bottom","hairstyle","skin","hair","height","build","footwear","bottomColor","shoeColor","facialHair","glassesStyle","glassesColor","bindiStyle","bindiColor","facePhoto"];
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
    if(!input)continue;
    result[field]=["skin","hair","hairstyle","bottomColor","shoeColor","glassesColor","bindiColor"].includes(field)?Number(input.value):
      ["height","build"].includes(field)?shapeFromSlider(field,input.value):input.value;
  }
  result.color=Number($("avatar-color").value);
  result.glasses=result.glassesStyle!=="none";
  if(!result.facePhoto&&typeof localStorage!=="undefined"){
    result.facePhoto=localStorage.getItem("vcf_ss_avatar_photo")||"";
  }
  return result;
}
function setAvatarEditor(values){
  const avatar=values&&typeof values==="object"?values:{};
  const defaults={gender:"female",outfit:"salwar",bottom:"leggings",hairstyle:2,skin:2,hair:0,color:1,height:1,build:1,footwear:"auto",bottomColor:-1,shoeColor:-1,facialHair:"none",glassesStyle:"none",glassesColor:0,bindiStyle:"none",bindiColor:0,facePhoto:(typeof localStorage!=="undefined"?localStorage.getItem("vcf_ss_avatar_photo"):"")||"",glasses:false};
  const settings={...defaults,...avatar};
  // Backward compatibility: pre-v3 stored profiles only had a glasses boolean.
  if(!Object.hasOwn(avatar,"glassesStyle") && avatar.glasses)settings.glassesStyle="rectangle";
  for(const field of AVATAR_FIELDS){
    const el=$("avatar-"+field);
    if(!el)continue;
    el.value=String(["height","build"].includes(field)?sliderFromShape(field,settings[field]):(settings[field]??defaults[field]??""));
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

  const w=img.naturalWidth||img.width||size;
  const h=img.naturalHeight||img.height||size;
  const cropSize=Math.min(w,h);
  let sx=Math.max(0,Math.floor((w-cropSize)/2));
  let sy=0;
  if(h>w){
    // Faces in portrait selfies are positioned in upper 60%
    sy=Math.floor((h-cropSize)*0.24);
  }else{
    sy=Math.max(0,Math.floor((h-cropSize)/2));
  }
  ctx.drawImage(img,sx,sy,cropSize,cropSize,0,0,size,size);

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
    for(let py=Math.round(y0);py<=Math.round(y1);py+=2){
      for(let px=Math.round(x0);px<=Math.round(x1);px+=2){
        const [r,g,b]=getPixel(px,py);
        const lum=0.299*r+0.587*g+0.114*b;
        if(filterOutliers&&(lum<12||lum>248))continue;
        samples.push([r,g,b,lum]);
      }
    }
    if(!samples.length)return [180,140,110];
    samples.sort((a,b)=>a[3]-b[3]);
    const start=Math.floor(samples.length*0.12);
    const end=Math.ceil(samples.length*0.88);
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

  // 1. Forehead and upper cheek skin tone (avoids mouth, beard, eyes & hair)
  const foreheadRgb=getAverageRegion(size*0.35,size*0.22,size*0.65,size*0.32);
  const leftCheekRgb=getAverageRegion(size*0.22,size*0.44,size*0.32,size*0.54);
  const rightCheekRgb=getAverageRegion(size*0.68,size*0.44,size*0.78,size*0.54);
  const skinRgb=[
    Math.round((foreheadRgb[0]+leftCheekRgb[0]+rightCheekRgb[0])/3),
    Math.round((foreheadRgb[1]+leftCheekRgb[1]+rightCheekRgb[1])/3),
    Math.round((foreheadRgb[2]+leftCheekRgb[2]+rightCheekRgb[2])/3)
  ];
  const skinIdx=closestColorIndex(skinRgb,SKIN_COLORS);
  const skinLum=0.299*skinRgb[0]+0.587*skinRgb[1]+0.114*skinRgb[2];

  // 2. Intelligent hair color detection:
  // Discard white/light wall and ceiling pixels (lum > 180) to avoid false white hair.
  // Sample directly above forehead (hairline) and at the temples.
  const hairSamples=[];
  for(let py=Math.round(size*0.11);py<=Math.round(size*0.22);py+=2){
    for(let px=Math.round(size*0.34);px<=Math.round(size*0.66);px+=2){
      const [r,g,b]=getPixel(px,py);
      const lum=0.299*r+0.587*g+0.114*b;
      if(lum>180)continue; // Background wall/ceiling
      const skinDist=Math.abs(r-skinRgb[0])+Math.abs(g-skinRgb[1])+Math.abs(b-skinRgb[2]);
      if(skinDist<40 && lum>skinLum-15)continue; // Forehead skin
      hairSamples.push([r,g,b,lum]);
    }
  }
  for(let py=Math.round(size*0.20);py<=Math.round(size*0.34);py+=2){
    for(const px of [Math.round(size*0.20),Math.round(size*0.25),Math.round(size*0.75),Math.round(size*0.80)]){
      const [r,g,b]=getPixel(px,py);
      const lum=0.299*r+0.587*g+0.114*b;
      if(lum>180)continue;
      const skinDist=Math.abs(r-skinRgb[0])+Math.abs(g-skinRgb[1])+Math.abs(b-skinRgb[2]);
      if(skinDist<40 && lum>skinLum-15)continue;
      hairSamples.push([r,g,b,lum]);
    }
  }

  let hairRgb=[26,20,25]; // Default Jet Black (HAIR_COLORS[0])
  let hairIdx=0;
  let hairLum=22;
  if(hairSamples.length>0){
    hairSamples.sort((a,b)=>a[3]-b[3]);
    let rSum=0,gSum=0,bSum=0,count=0;
    const take=Math.min(hairSamples.length,Math.max(4,Math.floor(hairSamples.length*0.65)));
    for(let i=0;i<take;i++){
      rSum+=hairSamples[i][0];
      gSum+=hairSamples[i][1];
      bSum+=hairSamples[i][2];
      count++;
    }
    const avgR=Math.round(rSum/count),avgG=Math.round(gSum/count),avgB=Math.round(bSum/count);
    hairLum=0.299*avgR+0.587*avgG+0.114*avgB;
    hairRgb=[avgR,avgG,avgB];
    let matchedIdx=closestColorIndex(hairRgb,HAIR_COLORS);
    // Disallow pure white (index 5) or silver-gray (index 7) from background wall bleed; default to Jet Black (0)
    if(matchedIdx===5 || matchedIdx===7){
      if(chinDiff > 6 || moustDiff > 6 || hairLum < 235){
        matchedIdx=0; // Jet Black default
      }
    }
    if(hairLum<70 && matchedIdx!==0 && matchedIdx!==6){
      matchedIdx=0;
    }
    hairIdx=matchedIdx;
  }

  // 3. Outfit tone (lower torso)
  const outfitRgb=getAverageRegion(size*0.22,size*0.82,size*0.78,size*0.96);
  const outfitColorIdx=closestColorIndex(outfitRgb,OUTFIT_COLORS);

  // 4. Moustache zone (upper lip between nose and mouth)
  const moustRgb=getAverageRegion(size*0.38,size*0.54,size*0.62,size*0.63,false);
  const moustLum=0.299*moustRgb[0]+0.587*moustRgb[1]+0.114*moustRgb[2];
  const moustDiff=skinLum-moustLum;

  // 5. Chin beard zone (chin pad from lower lip down)
  const chinRgb=getAverageRegion(size*0.38,size*0.66,size*0.62,size*0.79,false);
  const chinLum=0.299*chinRgb[0]+0.587*chinRgb[1]+0.114*chinRgb[2];
  const chinDiff=skinLum-chinLum;

  // 6. Jawline beard zone (sides of lower jaw)
  const leftJawRgb=getAverageRegion(size*0.24,size*0.60,size*0.36,size*0.76,false);
  const rightJawRgb=getAverageRegion(size*0.64,size*0.60,size*0.76,size*0.76,false);
  const jawLum=(0.299*(leftJawRgb[0]+rightJawRgb[0])+0.587*(leftJawRgb[1]+rightJawRgb[1])+0.114*(leftJawRgb[2]+rightJawRgb[2]))/2;
  const jawDiff=skinLum-jawLum;

  // Multi-band facial hair classification
  let facialHair="none";
  let facialHairLabel="Clean shaven";
  const fullBeardScore=0.35*moustDiff+0.45*chinDiff+0.20*jawDiff;

  if(fullBeardScore>22||(chinDiff>20&&moustDiff>15)){
    if(fullBeardScore>30||chinDiff>30||jawDiff>26){
      facialHair="beard-boxed";
      facialHairLabel="Short boxed beard";
    }else{
      facialHair="combo-short";
      facialHairLabel="Short beard + moustache";
    }
  }else if(chinDiff>18&&moustDiff>12){
    facialHair="combo-short";
    facialHairLabel="Short beard + moustache";
  }else if(chinDiff>18){
    facialHair="beard-short";
    facialHairLabel="Short beard";
  }else if(moustDiff>18){
    facialHair="moustache-classic";
    facialHairLabel="Classic moustache";
  }else if(fullBeardScore>8||chinDiff>10||moustDiff>10){
    facialHair="stubble-full";
    facialHairLabel="Full stubble";
  }

  // 7. Spectacles / Eyeglasses detection:
  // Check eye bridge and rim dips across y in [0.38, 0.46]
  let bridgeMinLum=255;
  for(let px=Math.round(size*0.44);px<=Math.round(size*0.56);px+=2){
    for(let py=Math.round(size*0.38);py<=Math.round(size*0.44);py+=2){
      const [r,g,b]=getPixel(px,py);
      const lum=0.299*r+0.587*g+0.114*b;
      if(lum<bridgeMinLum)bridgeMinLum=lum;
    }
  }
  let rimMinLum=255;
  for(let px of [size*0.30,size*0.36,size*0.64,size*0.70]){
    for(let py=Math.round(size*0.38);py<=Math.round(size*0.44);py+=2){
      const [r,g,b]=getPixel(px,py);
      const lum=0.299*r+0.587*g+0.114*b;
      if(lum<rimMinLum)rimMinLum=lum;
    }
  }
  const glassesDetected=(skinLum-bridgeMinLum>30)||(skinLum-rimMinLum>38);
  const glassesStyle=glassesDetected?"rectangle":"none";

  // 8. Hairstyle & Gender estimation
  const leftSideRgb=getAverageRegion(size*0.12,size*0.36,size*0.22,size*0.60,false);
  const rightSideRgb=getAverageRegion(size*0.78,size*0.36,size*0.88,size*0.60,false);
  const leftLum=0.299*leftSideRgb[0]+0.587*leftSideRgb[1]+0.114*leftSideRgb[2];
  const rightLum=0.299*rightSideRgb[0]+0.587*rightSideRgb[1]+0.114*rightSideRgb[2];
  const sideHairMatch=(Math.abs(leftLum-hairLum)<36||Math.abs(rightLum-hairLum)<36);

  let hairstyle=0;
  let hairStyleLabel="Short classic";
  let gender="male";
  let outfit="shirt";

  if(facialHair!=="none"){
    gender="male";
    outfit="shirt";
    hairstyle=hairLum<110?14:0; // 14 = Textured quiff, 0 = Short classic
    hairStyleLabel=hairstyle===14?"Textured quiff":"Short classic";
  }else if(sideHairMatch&&hairLum<125){
    gender="female";
    outfit="salwar";
    hairstyle=2;
    hairStyleLabel="Long classic";
  }else{
    gender="male";
    outfit="shirt";
    hairstyle=0;
    hairStyleLabel="Short classic";
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

function cropFaceDataUrl(img){
  const canvas=document.createElement("canvas");
  canvas.width=256;
  canvas.height=256;
  const ctx=canvas.getContext("2d");
  if(!ctx)return "";
  const w=img.naturalWidth||img.width||256;
  const h=img.naturalHeight||img.height||256;
  const cropSize=Math.min(w,h);
  let sx=Math.max(0,Math.floor((w-cropSize)/2));
  let sy=0;
  if(h>w){
    // Faces in portrait orientation are positioned towards the upper-center
    sy=Math.floor((h-cropSize)*0.26);
  }else{
    sy=Math.max(0,Math.floor((h-cropSize)/2));
  }
  ctx.drawImage(img,sx,sy,cropSize,cropSize,0,0,256,256);
  return canvas.toDataURL("image/jpeg",0.92);
}

function renderPhotoQuickTune(container, currentSettings){
  if(!container)return;
  container.innerHTML="";

  const quicktune=document.createElement("div");
  quicktune.className="photo-matcher-quicktune";

  const rows=[
    {
      label:"🧔 Facial Hair / Beard",
      field:"facialHair",
      options:[
        {val:"none",label:"Clean"},
        {val:"stubble-full",label:"Stubble"},
        {val:"combo-short",label:"Short Beard"},
        {val:"beard-boxed",label:"Boxed Beard"},
        {val:"beard-goatee",label:"Goatee"},
        {val:"beard-full",label:"Full Beard"},
        {val:"moustache-classic",label:"Moustache"}
      ]
    },
    {
      label:"👓 Spectacles",
      field:"glassesStyle",
      options:[
        {val:"none",label:"None"},
        {val:"rectangle",label:"👓 Rectangle"},
        {val:"round",label:"👓 Round"},
        {val:"aviator",label:"🕶 Aviator"},
        {val:"square",label:"👓 Square"}
      ]
    },
    {
      label:"💇 Hairstyle",
      field:"hairstyle",
      options:[
        {val:0,label:"Short Classic"},
        {val:14,label:"Textured Quiff"},
        {val:13,label:"Low Fade"},
        {val:18,label:"Slick Back"},
        {val:2,label:"Long Hair"}
      ]
    },
    {
      label:"🧑 Base Model",
      field:"gender",
      options:[
        {val:"male",label:"👨 Male"},
        {val:"female",label:"👩 Female"}
      ]
    }
  ];

  for(const row of rows){
    const group=document.createElement("div");
    group.className="quicktune-group";

    const label=document.createElement("span");
    label.className="quicktune-label";
    label.textContent=row.label;
    group.appendChild(label);

    const pills=document.createElement("div");
    pills.className="quicktune-pills";

    for(const opt of row.options){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="qt-pill";
      btn.dataset.field=row.field;
      btn.dataset.val=String(opt.val);
      btn.textContent=opt.label;

      const curVal=currentSettings[row.field];
      if(String(curVal)===String(opt.val)){
        btn.classList.add("active");
      }

      pills.appendChild(btn);
    }
    group.appendChild(pills);
    quicktune.appendChild(group);
  }

  // Hair & Beard color swatches row
  const hairGroup=document.createElement("div");
  hairGroup.className="quicktune-group";
  const hairLabel=document.createElement("span");
  hairLabel.className="quicktune-label";
  hairLabel.textContent="💇 Hair & Beard Color";
  hairGroup.appendChild(hairLabel);

  const hairSwatches=document.createElement("div");
  hairSwatches.className="quicktune-swatches";
  for(let i=0;i<HAIR_COLORS.length;i++){
    const swatch=document.createElement("button");
    swatch.type="button";
    swatch.className="qt-swatch"+(Number(currentSettings.hair)===i?" active":"");
    swatch.dataset.field="hair";
    swatch.dataset.val=String(i);
    swatch.title=HAIR_NAMES[i]||`Hair Color ${i+1}`;
    swatch.style.backgroundColor=hexToCss(HAIR_COLORS[i]);
    hairSwatches.appendChild(swatch);
  }
  hairGroup.appendChild(hairSwatches);
  quicktune.appendChild(hairGroup);

  // Skin swatches row
  const skinGroup=document.createElement("div");
  skinGroup.className="quicktune-group";
  const skinLabel=document.createElement("span");
  skinLabel.className="quicktune-label";
  skinLabel.textContent="🎨 Skin Tone";
  skinGroup.appendChild(skinLabel);

  const swatches=document.createElement("div");
  swatches.className="quicktune-swatches";
  for(let i=0;i<SKIN_COLORS.length;i++){
    const swatch=document.createElement("button");
    swatch.type="button";
    swatch.className="qt-swatch"+(Number(currentSettings.skin)===i?" active":"");
    swatch.dataset.field="skin";
    swatch.dataset.val=String(i);
    swatch.title=SKIN_NAMES[i]||`Skin Tone ${i+1}`;
    swatch.style.backgroundColor=hexToCss(SKIN_COLORS[i]);
    swatches.appendChild(swatch);
  }
  skinGroup.appendChild(swatches);
  quicktune.appendChild(skinGroup);

  // Attach interactive click handler
  quicktune.addEventListener("click",e=>{
    const pill=e.target.closest(".qt-pill, .qt-swatch");
    if(!pill)return;
    const field=pill.dataset.field;
    let val=pill.dataset.val;

    const input=$("avatar-"+field);
    if(input)input.value=val;

    if(field==="glassesStyle"){
      const isGlasses=val!=="none";
      if($("avatar-glasses"))$("avatar-glasses").checked=isGlasses;
      if(isGlasses && $("avatar-glassesColor") && Number($("avatar-glassesColor").value)===0){
        // Default to clean charcoal/black frame (7) rather than green (0)
        $("avatar-glassesColor").value="7";
      }
    }
    if(field==="facialHair"&&val!=="none"){
      if($("avatar-gender")&&$("avatar-gender").value!=="male"){
        $("avatar-gender").value="male";
        if($("avatar-outfit")&&$("avatar-outfit").value==="salwar")$("avatar-outfit").value="shirt";
        if($("avatar-bottom")&&$("avatar-bottom").value==="leggings")$("avatar-bottom").value="jeans";
      }
    }

    pill.parentElement.querySelectorAll(".qt-pill, .qt-swatch").forEach(p=>p.classList.remove("active"));
    pill.classList.add("active");

    previewAvatarNow();
    visualEditor?.refresh(activeStudioTab);
    syncShapeOutputs();
  });

  container.appendChild(quicktune);
}

function applyMatchedPhoto(img,rawDataUrl){
  const faceDataUrl=cropFaceDataUrl(img)||rawDataUrl;
  const result=analyzePhotoForAvatar(img);
  const thumb=$("photo-matcher-thumb");
  const previewBox=$("photo-matcher-preview");
  const summaryEl=$("photo-matcher-summary");
  const chipsBox=$("photo-matcher-chips");

  if(thumb)thumb.src=faceDataUrl;
  if(previewBox)previewBox.classList.remove("hidden");

  const current=readAvatarEditor();
  if($("avatar-facePhoto"))$("avatar-facePhoto").value=faceDataUrl;

  const updateSettings={
    ...current,
    facePhoto:faceDataUrl,
    skin:result?result.skin:current.skin,
    hair:result?result.hair:current.hair
  };

  if(result?.facialHair&&result.facialHair!=="none"){
    updateSettings.facialHair=result.facialHair;
    updateSettings.gender="male";
    if(updateSettings.outfit==="salwar")updateSettings.outfit="shirt";
    if(updateSettings.bottom==="leggings")updateSettings.bottom="jeans";
  }

  if(result?.glasses){
    updateSettings.glasses=true;
    updateSettings.glassesStyle=result.glassesStyle||"rectangle";
    updateSettings.glassesColor=7; // Classic Charcoal / Black
  }else if(result&&!result.glasses){
    updateSettings.glasses=false;
    updateSettings.glassesStyle="none";
  }

  if(result?.hairstyle!==undefined){
    updateSettings.hairstyle=result.hairstyle;
  }

  if(result?.color!==undefined&&result.color>=0){
    updateSettings.color=result.color;
  }

  setAvatarEditor(updateSettings);
  previewAvatarNow();

  try{localStorage.setItem("vcf_ss_avatar_photo",faceDataUrl);}catch{}
  if(officeRuntime?.updateAvatarPhoto)officeRuntime.updateAvatarPhoto(faceDataUrl);

  if(chipsBox){
    renderPhotoQuickTune(chipsBox,updateSettings);
  }

  if(summaryEl)summaryEl.textContent="✨ Features auto-matched! Click any pill below to fine-tune beard, glasses, or hair in real-time.";
  if(typeof officeToast==="function")officeToast("✨ Voxel look-alike updated! Quick-tune ready.");
  else toast("✨ Voxel look-alike updated! Quick-tune ready.");
}

function setupPhotoAvatarMatcher(){
  const fileInput=$("avatar-photo-input");
  const previewBox=$("photo-matcher-preview");
  const thumb=$("photo-matcher-thumb");
  const chipsBox=$("photo-matcher-chips");
  const clearBtn=$("photo-matcher-clear");
  const summaryEl=$("photo-matcher-summary");
  if(!fileInput)return;

  // Restore existing photo if saved
  try{
    const existingPhoto=localStorage.getItem("vcf_ss_avatar_photo");
    if(existingPhoto&&thumb&&previewBox){
      thumb.src=existingPhoto;
      previewBox.classList.remove("hidden");
      if(summaryEl)summaryEl.textContent="✨ Photo badge active on your desk. Fine-tune your voxel features below:";
      if(chipsBox)renderPhotoQuickTune(chipsBox,readAvatarEditor());
    }
  }catch{}

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
    if($("avatar-facePhoto"))$("avatar-facePhoto").value="";
    try{localStorage.removeItem("vcf_ss_avatar_photo");}catch{}
    if(officeRuntime?.updateAvatarPhoto)officeRuntime.updateAvatarPhoto("");
    const current=readAvatarEditor();
    current.facePhoto="";
    setAvatarEditor(current);
    previewAvatarNow();
    if(typeof officeToast==="function")officeToast("Reverted to 3D voxel face.");
    else toast("Reverted to 3D voxel face.");
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
        gameUrl:"./games/voxel-racers/index.html",
        goal:"Complete 1 full lap or finish the monster race!",
        clue:"Your Secret Santa sits on the bright window side of the office!",
        completed:false
      },
      {
        id:"voxel-bike",
        title:"Voxel Bikes Redline",
        icon:"🏍️",
        gameUrl:"./games/voxel-bike/index.html",
        goal:"Complete the Redline motocross race course to the finish line!",
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
    const hudBadge=$("hud-quest-badge");
    if(hudBadge)hudBadge.textContent=`${completedCount}/${quest.tasks.length}`;

    const menuBadge=$("menu-quest-badge");
    if(menuBadge)menuBadge.textContent=`${completedCount}/${quest.tasks.length} Done`;

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
              ${t.completed?`<p class="task-clue-reveal" style="font-size:12px;color:#68d391;font-weight:600;margin:3px 0 0;">💡 Clue #${index+1}: "${t.clue}"</p>`:`<p style="font-size:11px;color:#e2e8f0;margin:2px 0 0;font-style:italic;">⚡ Verified automatically in Arcade Lounge</p>`}
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
        finaleStatus.textContent=`🔒 ${completedCount} of ${quest.tasks.length} clues unlocked. Beat the tasks in the Arcade to unlock clues!`;
        goTreeBtn.disabled=true;
      }
    }
  }

  const arcadeModal=$("arcade-modal");
  const arcadeIframe=$("arcade-iframe");
  const arcadeFullscreen=$("arcade-fullscreen-link");
  const arcadeStatEl=$("arcade-last-stat");

  function openArcade(gameId="voxel-racers"){
    quest.activeGame=gameId;
    document.querySelectorAll(".arcade-tab-btn").forEach(btn=>{
      btn.classList.toggle("active",btn.getAttribute("data-game")===gameId);
    });

    const url=gameId==="voxel-bike"
      ?"./games/voxel-bike/index.html"
      :"./games/voxel-racers/index.html";

    if(typeof arcadeModal?.showModal==="function")arcadeModal.showModal();
    else arcadeModal?.classList.remove("hidden");

    if(arcadeIframe){
      if(!arcadeIframe.src || !arcadeIframe.src.endsWith(url.replace("./",""))){
        arcadeIframe.src=url;
      }
    }
    if(arcadeFullscreen)arcadeFullscreen.href=url;
  }

  document.querySelectorAll(".arcade-tab-btn").forEach(tab=>{
    tab.addEventListener("click",()=>{
      const game=tab.getAttribute("data-game");
      openArcade(game);
    });
  });

  $("arcade-close-btn")?.addEventListener("click",()=>{
    arcadeModal.close();
  });
  $("arcade-reload-btn")?.addEventListener("click",()=>{
    if(arcadeIframe){
      const src=arcadeIframe.src;
      arcadeIframe.src="";
      setTimeout(()=>{ arcadeIframe.src=src; },60);
    }
  });

  function handleGameTelemetry(data){
    if(!data)return;
    const statEl=$("arcade-last-stat");
    if(data.type==="VOXEL_RACE_LAP"||data.type==="VOXEL_RACE_COMPLETED"){
      const lapTime=data.lapTime?Number(data.lapTime).toFixed(2)+"s":"";
      const bestLap=data.bestLap?Number(data.bestLap).toFixed(2)+"s":"";
      if(statEl){
        statEl.textContent=data.type==="VOXEL_RACE_COMPLETED"
          ?`🏁 Race Completed! Best Lap: ${bestLap || lapTime}`
          :`⚡ Lap ${data.lapNumber || 1} Finished! Time: ${lapTime}`;
      }
      const racerTask=quest.tasks.find(t=>t.id==="voxel-racers");
      if(racerTask&&!racerTask.completed){
        racerTask.completed=true;
        saveQuest();
        playFestiveChime("unlock");
        officeRuntime?.triggerCelebration?.();
        const msg=`🎉 MONSTER RACERS GOAL ACHIEVED!
💡 Clue Unlocked: "${racerTask.clue}"`;
        if(typeof officeToast==="function")officeToast(msg);
        else toast(msg);
      }
    }else if(data.type==="VOXEL_BIKE_COMPLETED"){
      if(statEl){
        statEl.textContent=`🏍️ Moto Race Finished! Time: ${data.resultTime || data.finishTimeText || "Completed"}`;
      }
      const bikeTask=quest.tasks.find(t=>t.id==="voxel-bike");
      if(bikeTask&&!bikeTask.completed){
        bikeTask.completed=true;
        saveQuest();
        playFestiveChime("unlock");
        officeRuntime?.triggerCelebration?.();
        const msg=`🎉 VOXEL BIKE GOAL ACHIEVED!
💡 Clue Unlocked: "${bikeTask.clue}"`;
        if(typeof officeToast==="function")officeToast(msg);
        else toast(msg);
      }
    }
  }

  // Same-origin postMessage listener
  window.addEventListener("message",e=>{
    if(e.data&&(e.data.type==="VOXEL_RACE_LAP"||e.data.type==="VOXEL_RACE_COMPLETED"||e.data.type==="VOXEL_BIKE_COMPLETED")){
      handleGameTelemetry(e.data);
    }
  });

  // Cross-storage listener fallback
  window.addEventListener("storage",e=>{
    if(e.key==="vcf_last_race_result"&&e.newValue){
      try{
        const val=JSON.parse(e.newValue);
        handleGameTelemetry(Object.assign({type:"VOXEL_RACE_COMPLETED"},val));
      }catch(_e){}
    }else if(e.key==="vcf_last_bike_result"&&e.newValue){
      try{
        const val=JSON.parse(e.newValue);
        handleGameTelemetry(Object.assign({type:"VOXEL_BIKE_COMPLETED"},val));
      }catch(_e){}
    }
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

    if(typeof workshopModal?.showModal==="function")workshopModal.showModal();
    else workshopModal?.classList.remove("hidden");
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
    toast(`🎮 Testing mode active! Previewing quest for ${quest.childName}.`);
    openQuestNotebook();
  });

  $("workshop-share-link-btn")?.addEventListener("click",async()=>{
    readWorkshopForm();
    saveQuest();
    const encoded=encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(quest)))));
    const fullUrl=`${location.origin}${location.pathname}?quest=${encoded}`;
    try{
      await navigator.clipboard.writeText(fullUrl);
      toast("📋 Recipient Quest Link copied to clipboard! Share it with your teammate.");
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
        cluesBox.innerHTML=`<p style="font-size:12px;color:#a0aec0;margin:0;">No clues unlocked yet! Visit the Retro Arcade Room to unlock your first clue.</p>`;
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

    if(typeof treeModal?.showModal==="function")treeModal.showModal();
    else treeModal?.classList.remove("hidden");
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

  // Top Bar "☰ Menu" & Options Dialog
  $("player-pause")?.addEventListener("click",()=>{
    christmasMusic.unlock();
    const moreDlg=$("more-menu-dialog");
    if(typeof moreDlg?.showModal==="function")moreDlg.showModal();
    else moreDlg?.classList.remove("hidden");
  });
  $("more-menu-close-btn")?.addEventListener("click",()=>$("more-menu-dialog")?.close());

  $("menu-item-quest")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    openQuestModal();
  });
  $("menu-item-santahub")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    const menu=$("player-menu");
    menu.classList.remove("hidden");
    $("notebook-scroll").scrollTop=0;
    officeRuntime?.setPaused(true);
    showPlayerTab("personal");
  });
  $("menu-item-tree")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.goToTree?.();
    setTimeout(openTreeGuessing,850);
  });
  $("menu-item-workshop")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    openWorkshop();
  });
  $("menu-item-mydesk")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.goToDesk?.();
  });
  $("menu-item-arcade")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.goToArcade?.();
  });
  $("menu-item-avatar")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    const menu=$("player-menu");
    menu.classList.remove("hidden");
    $("notebook-scroll").scrollTop=0;
    officeRuntime?.setPaused(true);
    showPlayerTab("character");
  });
  $("menu-item-party")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.toggleParty?.();
  });
  $("menu-item-time")?.addEventListener("click",()=>{
    $("more-menu-dialog")?.close();
    officeRuntime?.cycleTimeTheme?.();
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
    const chipsBox=$("photo-matcher-chips");
    const previewBox=$("photo-matcher-preview");
    if(chipsBox&&previewBox&&!previewBox.classList.contains("hidden")){
      renderPhotoQuickTune(chipsBox,readAvatarEditor());
    }
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
  const moreDlg=$("more-menu-dialog");
  if(typeof moreDlg?.showModal==="function")moreDlg.showModal();
  else moreDlg?.classList.remove("hidden");
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

// Horizontally Expandable / Collapsible Emotes Action Dock
const actionDock=$("office-action-dock");
const actionToggleBtn=$("action-toggle-btn");
const actionCollapseBtn=$("action-collapse-btn");

function toggleActionDock(expand){
  if(!actionDock)return;
  const isCurrentlyCollapsed=actionDock.classList.contains("collapsed");
  const shouldExpand=expand!==undefined?expand:isCurrentlyCollapsed;
  if(shouldExpand){
    actionDock.classList.remove("collapsed");
    actionDock.classList.add("expanded");
    actionToggleBtn?.setAttribute("aria-expanded","true");
  }else{
    actionDock.classList.remove("expanded");
    actionDock.classList.add("collapsed");
    actionToggleBtn?.setAttribute("aria-expanded","false");
  }
}

actionToggleBtn?.addEventListener("click",()=>{
  christmasMusic.unlock();
  toggleActionDock();
});

actionCollapseBtn?.addEventListener("click",(e)=>{
  e.stopPropagation();
  toggleActionDock(false);
});

// Demo / Guest Mode for Instant Play without invitation code
function loadDemoPlayer(){
  const demoPlayer={
    me:{
      id:"demo-guest",
      display_name:"Holiday Explorer",
      avatar:{
        gender:"neutral",
        outfit:"sweater-reindeer",
        bottom:"pants-dark",
        hairstyle:"curly",
        skin:"warm",
        hair:"dark-brown",
        height:1.0,
        build:1.0,
        footwear:"boots",
        bottomColor:"#2b2d42",
        shoeColor:"#1a1a1a",
        facialHair:"none",
        glassesStyle:"none",
        glassesColor:"#d90429",
        bindiStyle:"none",
        bindiColor:"#d90429"
      },
      wishlist:[
        {id:"w1",text:"Cozy Christmas fleece or knit sweater ❄️"},
        {id:"w2",text:"Artisan hot cocoa blend & ceramic mug ☕"},
        {id:"w3",text:"Mechanical keyboard desk pad & novelty keycap ⌨️"}
      ]
    },
    event:{
      id:"demo-holiday-event",
      title:"🎄 VCF Holiday Celebration Office",
      budget:500
    },
    myChild:{
      id:"colleague-sneha",
      name:"Sneha Rao",
      wishlist:[
        {id:"sw1",text:"Sci-Fi paperback novel or bookstore gift card 📚"},
        {id:"sw2",text:"Dark roasted gourmet coffee beans ☕"}
      ]
    },
    colleagues:[
      {id:"c1",name:"Arjun Sharma",desk_index:0,prop:"plant",avatar:{outfit:"sweater-snowflake",hairstyle:"short",skin:"medium"}},
      {id:"c2",name:"Sneha Rao",desk_index:2,prop:"coffee",avatar:{outfit:"sweater-reindeer",hairstyle:"ponytail",skin:"fair"}},
      {id:"c3",name:"Karthik Verma",desk_index:4,prop:"robot",avatar:{outfit:"suit-classic",hairstyle:"wavy",skin:"olive"}},
      {id:"c4",name:"Ananya Iyer",desk_index:7,prop:"lamp",avatar:{outfit:"cozy-scarf",hairstyle:"curly",skin:"warm"}}
    ],
    receivedTasks:[
      {
        id:"task-demo-1",
        title:"Office Warm-Up",
        date:new Date().toISOString().slice(0,10),
        status:"pending",
        details:"Visit the Retro Arcade Room and set a high score in Monster Racers!"
      }
    ],
    today:new Date().toISOString().slice(0,10),
    mystery:{
      hints:[
        "Your Secret Santa loves retro gaming and hot chocolate!",
        "Your Secret Santa sits on the bright window side of the office!"
      ]
    }
  };

  player=demoPlayer;
  $("welcome").classList.add("hidden");
  $("admin").classList.add("hidden");
  $("player").classList.remove("hidden");
  document.body.classList.add("office-playing");
  christmasMusic.enter();
  void enterOffice(player);

  $("player-greeting").textContent="✦ "+player.me.display_name;
  $("player-event-title").textContent=player.event.title;
  if($("hud-event-name"))$("hud-event-name").textContent=player.event.title;
  $("personal-name").textContent=player.me.display_name;
  $("personal-budget").textContent="Suggested gift budget: ₹"+player.event.budget.toLocaleString("en-IN");
  
  if(typeof officeToast==="function"){
    officeToast("✨ Welcome, Holiday Explorer! Walk around the 3D office or press ☰ Menu.");
  }else{
    toast("✨ Welcome, Holiday Explorer! Walk around the 3D office or press ☰ Menu.");
  }
}

$("demo-entry-btn")?.addEventListener("click",()=>{
  christmasMusic.unlock();
  loadDemoPlayer();
});


// Team Invitation & Share Hub Event Listeners
$("btn-copy-team-url")?.addEventListener("click",async()=>{
  const url=eventUrl();
  const ok=await copyTextWithFallback(url);
  if(ok)toast("📋 Team event link copied to clipboard!");
});

$("btn-copy-team-announcement")?.addEventListener("click",async()=>{
  const url=eventUrl();
  const title=event?.title||"Secret Santa";
  const announcement=`🎄 *${title} · Team Secret Santa 2027* 🎅\n\nHey Team! Our 3D Christmas office space is officially open!\n\n✨ Explore our virtual office in 3D\n🕹️ Race in the Retro Arcade Lounge\n📝 Fill out your ₹${event?.budget||500} gift wishlist\n\n👉 Join our Team Space here (1-Click):\n${url}\n\nSee you in the holiday break-room! 🎁`;
  const ok=await copyTextWithFallback(announcement);
  if(ok)toast("📢 Team Announcement copied! Ready to paste into Slack or WhatsApp.");
});

$("btn-toggle-bulk-add")?.addEventListener("click",()=>{
  const drawer=$("bulk-add-drawer");
  drawer?.classList.toggle("hidden");
  if(!drawer?.classList.contains("hidden")){
    $("bulk-add-names")?.focus();
  }
});

$("btn-cancel-bulk-add")?.addEventListener("click",()=>{
  $("bulk-add-drawer")?.classList.add("hidden");
  if($("bulk-add-names"))$("bulk-add-names").value="";
  if($("bulk-add-status"))$("bulk-add-status").textContent="";
});

$("btn-submit-bulk-add")?.addEventListener("click",run(async()=>{
  if(!event)return;
  const raw=$("bulk-add-names")?.value||"";
  const names=raw.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);
  if(!names.length){
    toast("Please enter at least one employee name.",true);
    return;
  }
  const statusEl=$("bulk-add-status");
  let added=0;
  for(let i=0;i<names.length;i++){
    const name=names[i];
    if(statusEl)statusEl.textContent=`Adding ${i+1} of ${names.length}: ${name}…`;
    try{
      await api("add_participant",{
        event_id:event.id,
        display_name:name,
        desk_key:""
      });
      added++;
    }catch(e){
      console.warn("Bulk add error for",name,e);
    }
  }
  $("bulk-add-drawer")?.classList.add("hidden");
  if($("bulk-add-names"))$("bulk-add-names").value="";
  if(statusEl)statusEl.textContent="";
  await openEvent(event);
  toast(`🎉 Successfully registered ${added} teammates!`);
}));

$("btn-copy-all-direct-links")?.addEventListener("click",async()=>{
  if(!event||!participants.length){
    toast("No participants registered yet.",true);
    return;
  }
  const base=eventUrl();
  const lines=participants
    .filter(p=>p.is_active)
    .map(p=>{
      const c=codes.get(p.id);
      return `• ${p.display_name}: ${base}${c?"&code="+c:""}`;
    });
  const text=`🎄 *${event.title} · Teammate Direct Login Links* 🎁\n\n`+lines.join("\n");
  const ok=await copyTextWithFallback(text);
  if(ok)toast("📋 All 1-click participant links copied to clipboard!");
});

async function init(){
  snowfall();
  // 1-Click Direct Link Auto-Login (?event=slug&code=1234)
  const directCode=PARAMS.get("code");
  if(EVENT_SLUG&&directCode&&/^[0-9]{4}$/.test(directCode)){
    const codeInput=$("entry-code");
    if(codeInput){
      codeInput.value=directCode;
      setTimeout(()=>{
        $("entry-form")?.dispatchEvent(new Event("submit",{cancelable:true}));
      },250);
    }
  }

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
