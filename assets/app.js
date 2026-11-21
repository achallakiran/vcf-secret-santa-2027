
"use strict";
import {createVisualAvatarEditor} from "./game/avatar-editor.js?v=face-refine-v4-studio-qa-v1";
import {createChristmasMusic} from "./game/christmas-music.js?v=jingle-bells-v1";
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
let avatarBaseline=null,avatarPreviewTimer=null;
let avatarStudio=null,avatarStudioLoading=null,activeStudioTab="look",visualEditor=null;
let adminEditingParticipant=null;
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
  player_login:"Verifying your invitation code",
  list_events:"Loading events",
  create_event:"Creating Christmas event",
  list_participants:"Loading participants",
  add_participant:"Registering participant and generating code",
  edit_participant:"Saving participant changes",
  rotate_code:"Generating a replacement invitation code",
  assign_pending:"Assigning Santas to participants who are waiting",
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
  if(busy&&ACTION_STEPS[action])showProgress(ACTION_STEPS[action],"Working with Supabase securely…");
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
  setSession(null);player=null;event=null;participants=[];assignments=[];events=[];codes.clear();
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
  $("signed-in-user").textContent="";
  if(!yes)$("event-workspace").classList.add("hidden");
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
    control.append(edit,rotate);tr.append(control);
    tbody.append(tr);
  }
}
function renderPairs(){
  const list=$("pair-list");list.replaceChildren();
  $("assignment-details").classList.toggle("hidden",!assignments.length);
  assignments.forEach(a=>list.append(node("div","",namesById(a.santa_id)+" → "+namesById(a.child_id))));
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
  officeNoticeTimer=setTimeout(()=>el.classList.add("hidden"),3300);
}
function avatarIdentity(info){
  const people=info.colleagues||[];
  return JSON.stringify({
    person:info.me?.id,avatar:info.me?.avatar,
    colleagues:people.map(p=>[p.id,p.name,p.avatar])
  });
}
function syncCameraButtons(){
  const active=officeRuntime?.mode||"three";
  document.querySelectorAll("[data-camera]").forEach(b=>b.classList.toggle("selected",b.dataset.camera===active));
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
    const module=await import("./game/main.js?v=face-refine-v4-studio-qa-v1");
    officeRuntime=module.mountOffice($("office-canvas"),info,officeToast);
    let cam=null;
    try{cam=localStorage.getItem("vcf-ss-office-camera");}catch{}
    officeRuntime.setCamera(["three","close","wide"].includes(cam)?cam:"three");
    officeKey=identity;
    avatarBaseline=officeRuntime.getAvatar();
    setAvatarEditor(avatarBaseline);
    syncCameraButtons();
    $("office-loading").classList.add("hidden");
    officeToast("Tap the floor to move. Tap the hand to perform a random cheerful action.");
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
$("avatar-view").addEventListener("click",()=>{
  if(adminEditingParticipant)return; // Admin never enters the game screen.
  clearTimeout(avatarPreviewTimer);
  previewAvatarNow();
  officeRuntime?.focusAvatar();
  closePlayerMenu();
  syncCameraButtons();
  officeToast("Inspect your avatar up close. Return to Pause to save this look.");
});
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
$("avatar-turn-left").addEventListener("click",()=>avatarStudio?.rotate(-Math.PI/5));
$("avatar-turn-right").addEventListener("click",()=>avatarStudio?.rotate(Math.PI/5));
$("avatar-zoom-out").addEventListener("click",()=>avatarStudio?.zoom(1.24));
$("avatar-zoom-in").addEventListener("click",()=>avatarStudio?.zoom(.81));
$("avatar-fit").addEventListener("click",()=>avatarStudio?.fit());
async function ensureAvatarStudio(){
  if(avatarStudio||avatarStudioLoading)return;
  const isVisible=()=>adminEditingParticipant?
    $("admin-avatar-dialog").open&&$("player-character").parentElement===$("admin-avatar-editor-host"):
    Boolean(officeRuntime&&player&&!$("player-menu").classList.contains("hidden")
      &&!$("player-character").classList.contains("hidden"));
  if(!isVisible())return;
  avatarStudioLoading=(async()=>{
    const module=await import("./game/studio.js?v=face-refine-v4-studio-qa-v1");
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
  const section=$("player-character"),parent=$("player-menu");
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
  $("player-hint-text").textContent=player.hint?"Daily office hint: "+player.hint:"Daily office clues will be available when the organizer publishes the office scene.";
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
  $("personal-name").textContent=player.me.display_name;
  const child=player.myChild;
  $("my-assignment-status").textContent=child?
    "🎁 You have a Secret Child! Use Reveal privately, check their wishes and prepare your gift. Tasks are optional.":
    "⏳ Waiting for the organizer's Santa draw. You can prepare your wishlist now; no tasks are required.";
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
  if(!player.receivedTasks.length)itemLine(incoming,"No optional challenges have been set. That is perfectly fine.");
  for(const t of player.receivedTasks){
    itemLine(incoming,niceDate(t.task_date)+" · "+(t.status==="completed"?"✓ ":"○ ")+t.task_text);
  }
  const label=$("child-name");
  label.textContent=child?(childVisible?privateChildLabel():"Identity hidden · tap Reveal"):"Awaiting assignment";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
  $("child-toggle").disabled=!child;
  const childWishes=$("child-wishlist");childWishes.replaceChildren();
  const myTasks=$("assigned-tasks");myTasks.replaceChildren();
  $("santa-message").disabled=!child;
  $("save-message").disabled=!child;
  $("gift-purchased").disabled=!child;
  $("task-form").querySelectorAll("input,button").forEach(x=>x.disabled=!child);
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
  if(!child.tasks.length)itemLine(myTasks,"No optional challenges. You can give a thoughtful gift without any tasks.");
  for(const task of child.tasks){
    const row=node("label","personal-item");
    const box=node("input");box.type="checkbox";box.checked=task.status==="completed";
    box.disabled=task.status==="cancelled";
    box.addEventListener("change",run(async()=>{
      await api("complete_task",{task_id:task.id,completed:box.checked});
      await loadPlayer();
    }));
    row.append(box,node("span","",niceDate(task.task_date)+" · "+task.task_text));
    myTasks.append(row);
  }
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
$("player-pause").addEventListener("click",()=>{
  christmasMusic.unlock();
  const menu=$("player-menu");
  if(!menu.classList.contains("hidden")){closePlayerMenu();return;}
  menu.classList.remove("hidden");
  officeRuntime?.setPaused(true);
  showPlayerTab("character");
  syncCameraButtons();
});
$("player-close").addEventListener("click",closePlayerMenu);
// One tap, one random action. No dropdown or action selection UI.
const OFFICE_ACTIONS=["hi","dance","clap","cheer"];
let lastOfficeAction=-1;
$("player-action").addEventListener("click",()=>{
  christmasMusic.unlock();
  if(!$("player-menu").classList.contains("hidden"))return;
  if(!officeRuntime){officeToast("Office is still loading.");return;}
  // Four actions are equally likely on the first press. Subsequent presses
  // randomly choose among the other three so the animation visibly changes.
  const available=OFFICE_ACTIONS.map((name,index)=>({name,index}))
    .filter(item=>item.index!==lastOfficeAction);
  const pick=available[Math.floor(Math.random()*available.length)];
  lastOfficeAction=pick.index;
  officeRuntime.playAction(pick.name);
});
document.querySelectorAll("[data-camera]").forEach(b=>b.addEventListener("click",()=>{
  const cam=b.dataset.camera;
  if(!["three","close","wide"].includes(cam))return;
  officeRuntime?.setCamera(cam);
  try{localStorage.setItem("vcf-ss-office-camera",cam);}catch{}
  syncCameraButtons();
}));
$("camera-reset").addEventListener("click",()=>{
  officeRuntime?.resetCameraOrbit();
  officeToast("Camera direction and zoom restored.");
});
$("player-tab-character").addEventListener("click",()=>showPlayerTab("character"));
$("player-tab-personal").addEventListener("click",()=>showPlayerTab("personal"));
$("refresh-personal").addEventListener("click",run(async()=>{
  await loadPlayer();
  toast("Your private Santa notebook is up to date.");
}));
$("player-sign-out").addEventListener("click",()=>{
  endSession();
  toast("Exited the office.");
});
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
  $("child-name").textContent=childVisible?privateChildLabel():"Identity hidden · tap Reveal";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
});
$("task-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  await api("add_task",{task_date:$("task-date").value,task_text:$("task-text").value});
  $("task-text").value="";
  await loadPlayer();toast("Optional task saved.");
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
