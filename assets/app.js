
"use strict";
import {createVisualAvatarEditor} from "./game/avatar-editor.js?v=visual-atelier-v3";
const GATEWAY="https://fwrievuhudjkeffmszqf.supabase.co/functions/v1/ss-gateway";
const PUBLIC_KEY="sb_publishable_SJo2kgXdHNFZI65iAvQmxw_q56zuVLO";
const PARAMS=new URLSearchParams(location.search);
const ADMIN=PARAMS.has("admin");
const PREVIEW=!ADMIN&&PARAMS.has("preview");
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
  lock_assignments:"Assigning each Santa to a Child",
  change_admin_pin:"Updating administrator PIN",
  player_dashboard:"Loading personal dashboard",
  save_wishlist:"Saving wishlist",
  add_task:"Assigning a dated task",
  complete_task:"Updating task completion",
  gift_status:"Updating gift-purchase status",
  save_message:"Saving Santa's private message",
  save_avatar:"Saving your voxel character"
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
  document.body.classList.remove("office-playing");
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
  $("signed-in-user").textContent=yes?"Organizer unlocked · no email required":"";
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
function namesById(id){return participants.find(p=>p.id===id)?.display_name||"Unknown";}
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
  if(event){
    const current=events.find(e=>e.id===event.id);
    if(current)await openEvent(current);
    else{$("event-workspace").classList.add("hidden");event=null;}
  }
}
async function openEvent(e){
  const result=await api("list_participants",{event_id:e.id});
  event={...e,...result.event};
  participants=result.participants||[];
  assignments=result.assignments||[];
  $("workspace-title").textContent=event.title;
  $("workspace-slug").textContent=eventUrl();
  $("workspace-open-link").href=eventUrl();
  $("workspace-state").textContent=event.assignments_locked_at?"LOCKED":"OPEN";
  $("people-count").textContent=participants.length;
  $("assignment-count").textContent=assignments.length;
  $("invite-count").textContent=codes.size;
  $("event-workspace").classList.remove("hidden");
  const locked=!!event.assignments_locked_at;
  $("participant-form").querySelectorAll("input,button").forEach(el=>el.disabled=locked);
  $("assign-btn").disabled=locked||participants.filter(p=>p.is_active).length<2;
  renderPeople();renderPairs();
}
function renderPeople(){
  const tbody=$("participant-rows");tbody.replaceChildren();
  if(!participants.length){
    const tr=node("tr"),td=node("td","muted","Add the first colleague above.");
    td.colSpan=5;tr.append(td);tbody.append(tr);
  }
  for(const p of participants){
    const tr=node("tr");
    tr.append(node("td","",p.display_name+(p.is_active?"":" (inactive)")));
    tr.append(node("td","",p.desk_key||"—"));
    const codeCell=node("td");codeCell.append(node("code","",codes.get(p.id)||"••••"));tr.append(codeCell);
    const shareCell=node("td");
    const whatsapp=button("WhatsApp ↗",()=>{
      try{openInvitation(p);}catch(error){toast(error.message,true);}
    });
    whatsapp.disabled=!codes.has(p.id);
    const copy=button("Copy",run(async()=>{
      const copied=await copyTextWithFallback(shareText(p));
      if(copied)toast("Invitation copied.");
    }));
    copy.disabled=!codes.has(p.id);
    const openLink=node("a","small-outline link-action","Open player ↗");
    openLink.href=eventUrl();
    openLink.target="_blank";
    openLink.rel="noopener noreferrer";
    shareCell.append(whatsapp,copy,openLink);tr.append(shareCell);
    const controls=node("td");
    const edit=button("Edit",run(async()=>{
      const display_name=prompt("Employee name",p.display_name);
      if(display_name===null)return;
      const desk_key=prompt("Desk code or blank",p.desk_key||"");
      if(desk_key===null)return;
      await api("edit_participant",{event_id:event.id,participant_id:p.id,display_name,desk_key,is_active:p.is_active});
      await openEvent(event);toast("Participant updated.");
    }));
    edit.disabled=!!event.assignments_locked_at;
    const rotate=button("New code",run(async()=>{
      if(!confirm("Replace the code for "+p.display_name+"? The previous code will stop working."))return;
      const updated=await api("rotate_code",{event_id:event.id,participant_id:p.id});
      codes.set(p.id,updated.code);
      await openEvent(event);toast("New private code generated.");
    }));
    controls.append(edit,rotate);tr.append(controls);tbody.append(tr);
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
    const module=await import("./game/main.js?v=environment-polish-v1");
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
function demoData(){
  const names=["Aditi","Rohan","Neha","Arjun","Priya","Farhan","Meera","Karthik","Divya","Sneha","Siddharth","Ananya","Vivek","Tara","Rahul","Ishita","Krishna"];
  const colleagues=names.map((name,i)=>({
    id:"demo-colleague-"+i,name,desk_key:"D-"+String(i+1).padStart(2,"0")
  }));
  return {
    preview:true,
    event:{title:"VCF Christmas Office · Visual Preview",slug:"visual-preview",status:"demo",budget:500},
    me:{id:"demo-player",display_name:"Guest explorer",avatar:{gender:"female",outfit:"salwar",skin:2,color:1,hairstyle:1},avatar_version:1,wishlist:[],wishlist_version:1},
    colleagues,receivedTasks:[],myChild:null,hint:null,today:new Date().toLocaleDateString("en-CA")
  };
}

const AVATAR_FIELDS=["gender","outfit","bottom","hairstyle","skin","hair","height","build","footwear"];
function readAvatarEditor(){
  const result={schema_version:2};
  for(const field of AVATAR_FIELDS){
    const input=$("avatar-"+field);
    result[field]=["skin","hair","hairstyle"].includes(field)?Number(input.value):
      ["height","build"].includes(field)?Number(input.value):input.value;
  }
  result.color=Number($("avatar-color").value);
  result.glasses=$("avatar-glasses").checked;
  return result;
}
function setAvatarEditor(values){
  const avatar=values&&typeof values==="object"?values:{};
  const defaults={gender:"female",outfit:"salwar",bottom:"leggings",hairstyle:2,skin:2,hair:0,color:1,height:1,build:1,footwear:"auto",glasses:false};
  const settings={...defaults,...avatar};
  for(const field of AVATAR_FIELDS){
    const el=$("avatar-"+field);
    el.value=String(settings[field]);
  }
  $("avatar-color").value=String(settings.color);
  $("avatar-glasses").checked=!!settings.glasses;
  $("avatar-height-out").textContent=Math.round(Number(settings.height)*100)+"%";
  $("avatar-build-out").textContent=Math.round(Number(settings.build)*100)+"%";
  $("avatar-preview-status").textContent=player?.preview?
    "Visual preview: customize freely. Saving is available after participant login.":
    "Your changes preview immediately. Save when you are happy with your look.";
  $("avatar-save").disabled=!!player?.preview;
  avatarStudio?.update(settings);
  visualEditor?.refresh(activeStudioTab);
}
function previewAvatarNow(){
  if(!officeRuntime)return;
  const data=readAvatarEditor();
  officeRuntime.previewAvatar(data);
  avatarStudio?.update(data);
  $("avatar-height-out").textContent=Math.round(Number(data.height)*100)+"%";
  $("avatar-build-out").textContent=Math.round(Number(data.build)*100)+"%";
  $("avatar-preview-status").textContent="Unsaved changes are visible on your 3D character.";
}
function previewAvatarSoon(){
  clearTimeout(avatarPreviewTimer);
  $("avatar-height-out").textContent=Math.round(Number($("avatar-height").value)*100)+"%";
  $("avatar-build-out").textContent=Math.round(Number($("avatar-build").value)*100)+"%";
  avatarPreviewTimer=setTimeout(previewAvatarNow,95);
}
for(const field of AVATAR_FIELDS){
  $("avatar-"+field).addEventListener("input",previewAvatarSoon);
}
$("avatar-glasses").addEventListener("change",previewAvatarSoon);
// Actual 3D outfit/hair/accessory cards, swatches and two character portraits.
// Hidden inputs keep the established save payload and version-check behavior.
visualEditor=createVisualAvatarEditor({
  read:readAvatarEditor,
  studio:()=>avatarStudio,
  choose:(field,value)=>{
    if(field==="glasses")$("avatar-glasses").checked=!!value;
    else $("avatar-"+field).value=String(value);
    visualEditor.refresh(activeStudioTab);
    previewAvatarSoon();
  }
});
visualEditor.refresh(activeStudioTab);
$("avatar-view").addEventListener("click",()=>{
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
  officeRuntime?.previewAvatar(avatarBaseline);
  avatarStudio?.update(avatarBaseline);
  officeToast("Restored the last saved appearance.");
});
$("avatar-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  clearTimeout(avatarPreviewTimer);
  if(player?.preview)throw Error("Sign in as a participant to save your avatar.");
  if(!player?.me?.id)throw Error("Please enter the office using your invitation code.");
  const avatar=readAvatarEditor();
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
  const titles={look:"Face & colors",hair:"Hairstyles",fashion:"Outfit & fashion",
    accessories:"Accessories",footwear:"Footwear",shape:"Height & build"};
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
  if(avatarStudio||avatarStudioLoading||!officeRuntime||!player)return;
  if($("player-menu").classList.contains("hidden")||$("player-character").classList.contains("hidden"))return;
  avatarStudioLoading=(async()=>{
    const module=await import("./game/studio.js?v=avatar-fit-v4");
    if($("player-menu").classList.contains("hidden")||$("player-character").classList.contains("hidden"))return;
    avatarStudio=module.mountAvatarStudio($("avatar-studio-canvas"),readAvatarEditor());
    visualEditor?.refresh(activeStudioTab);
  })();
  try{await avatarStudioLoading;}
  catch(err){officeToast("3D avatar preview unavailable. The office character can still be customized.");console.error(err);}
  finally{avatarStudioLoading=null;}
}
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
  player=await api("player_dashboard");
  $("player-hint-text").textContent=player.hint?"Daily office hint: "+player.hint:"Daily office clues will be available when the organizer publishes the office scene.";
  $("welcome").classList.add("hidden");
  $("admin").classList.add("hidden");
  $("player").classList.remove("hidden");
  document.body.classList.add("office-playing");
  void enterOffice(player);
  $("player-greeting").textContent="✦ "+player.me.display_name;
  $("player-event-title").textContent=player.event.title;
  $("personal-name").textContent=player.me.display_name;
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
  if(!player.receivedTasks.length)itemLine(incoming,"No tasks from your anonymous Santa yet.");
  for(const t of player.receivedTasks){
    itemLine(incoming,niceDate(t.task_date)+" · "+(t.status==="completed"?"✓ ":"○ ")+t.task_text);
  }
  const child=player.myChild;
  const label=$("child-name");
  label.textContent=child&&childVisible?child.name:"Name hidden";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
  $("child-toggle").disabled=!child;
  const childWishes=$("child-wishlist");childWishes.replaceChildren();
  const myTasks=$("assigned-tasks");myTasks.replaceChildren();
  $("santa-message").disabled=!child;
  $("save-message").disabled=!child;
  $("gift-purchased").disabled=!child;
  $("task-form").querySelectorAll("input,button").forEach(x=>x.disabled=!child);
  if(!child){
    itemLine(childWishes,"Santa–Child assignments are not yet published.");
    itemLine(myTasks,"The organizer hasn't generated assignments yet.");
    $("santa-message").value="";
    $("gift-purchased").checked=false;
    return;
  }
  if(!child.wishlist.length)itemLine(childWishes,"Your Child hasn't added wishes yet.");
  else child.wishlist.forEach(w=>itemLine(childWishes,w.text));
  $("santa-message").value=child.message||"";
  $("gift-purchased").checked=!!child.gift_purchased;
  if(!child.tasks.length)itemLine(myTasks,"You haven't assigned any tasks.");
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

const transientInvite={participantId:null};
function openInvitation(person,number="",country="91"){
  if(!codes.has(person.id))throw Error("Generate a new invitation code before sharing.");
  const dialog=$("invite-dialog");
  transientInvite.participantId=person.id; // Only the participant ID is kept; never the phone number.
  $("invite-person-name").textContent="Invitation for "+person.display_name;
  $("invite-country").value=country;
  $("invite-phone").value=number;
  updateWhatsAppLink();
  if(!dialog.open)dialog.showModal();
}
function closeInvitation(){
  const dialog=$("invite-dialog");
  $("invite-form").reset();
  $("invite-phone").value="";
  transientInvite.participantId=null;
  clearWhatsAppLink();
  if(dialog.open)dialog.close();
}
function targetInvitation(){
  const person=participants.find(p=>p.id===transientInvite.participantId);
  if(!person)throw Error("This invitation is no longer available. Open it again.");
  return person;
}
function readTemporaryPhone(){
  const number=$("invite-phone").value.replace(/\D/g,"");
  const country=$("invite-country").value;
  if(!/^[0-9]{10}$/.test(number))throw Error("Enter a 10-digit phone number without the country code.");
  if(!["91","1","44","971","65"].includes(country))throw Error("Select a country code.");
  return country+number;
}

function clearWhatsAppLink(){
  const a=$("invite-open-link");
  a.removeAttribute("href");a.classList.add("is-disabled");
  a.setAttribute("aria-disabled","true");a.tabIndex=-1;
  $("invite-link-status").textContent="Enter ten digits to enable WhatsApp.";
}
function updateWhatsAppLink(){
  try{
    const person=targetInvitation();
    const number=readTemporaryPhone();
    const href="https://wa.me/"+number+"?text="+encodeURIComponent(shareText(person));
    const a=$("invite-open-link");
    a.href=href;a.tabIndex=0;
    a.classList.remove("is-disabled");a.setAttribute("aria-disabled","false");
    $("invite-link-status").textContent="Ready — tap Open WhatsApp to open the invitation.";
  }catch{clearWhatsAppLink();}
}
$("invite-country").addEventListener("change",updateWhatsAppLink);
$("invite-open-link").addEventListener("click",e=>{
  if(!$("invite-open-link").href||$("invite-open-link").classList.contains("is-disabled")){
    e.preventDefault();toast("Enter a valid ten-digit number first.",true);return;
  }
  // Let native browser link navigation begin before the temporary number is cleared.
  setTimeout(closeInvitation,250);
});
$("workspace-copy-link").addEventListener("click",run(async()=>{
  if(!event)throw Error("Choose an event first.");
  const link=eventUrl();
  const copied=await copyTextWithFallback(link);
  if(copied)toast("Event URL copied. Send it to your colleagues.");
}));

$("participant-phone").addEventListener("input",e=>{
  e.target.value=e.target.value.replace(/\D/g,"").slice(0,10);
});
$("invite-phone").addEventListener("input",e=>{
  e.target.value=e.target.value.replace(/\D/g,"").slice(0,10);
  updateWhatsAppLink();
});
$("invite-cancel").addEventListener("click",closeInvitation);
$("invite-dialog").addEventListener("close",()=>{
  $("invite-phone").value="";
  transientInvite.participantId=null;
  clearWhatsAppLink();
});
$("invite-form").addEventListener("submit",e=>{
  e.preventDefault();
  // WhatsApp opens through the native anchor, not window.open() popup.
  updateWhatsAppLink();
  if($("invite-open-link").classList.contains("is-disabled")){
    toast("Enter a valid ten-digit number.",true);
  }
});
$("invite-copy").addEventListener("click",run(async()=>{
  const person=targetInvitation();
  const copied=await copyTextWithFallback(shareText(person));
  if(copied)toast("Invitation copied; no number was saved.");
  closeInvitation();
}));

$("entry-code").addEventListener("input",e=>{
  e.target.value=e.target.value.replace(/\D/g,"").slice(0,4);
});
$("entry-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  if(!EVENT_SLUG)throw Error("Use the event-specific invitation link sent by your organizer.");
  const result=await api("player_login",{event_slug:EVENT_SLUG,code:$("entry-code").value});
  setSession(result);
  $("entry-code").value="";
  await loadPlayer();
}));
$("auth-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  const result=await api("admin_login",{pin:$("admin-pin").value});
  setSession(result);$("admin-pin").value="";
  await loadEvents();toast("Organizer console unlocked.");
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
  // Collect a local, optional contact only for sharing. Never send it to Supabase.
  const phone=$("participant-phone").value.replace(/\D/g,"");
  const country=$("participant-country").value;
  if(phone && !/^[0-9]{10}$/.test(phone))throw Error("Please enter a 10-digit phone number, without the country code.");
  const result=await api("add_participant",{
    event_id:event.id,display_name:$("participant-name").value,
    desk_key:$("participant-desk").value.trim()
  });
  codes.set(result.id,result.code);
  const personName=$("participant-name").value.trim();
  $("participant-form").reset();
  await openEvent(event);
  toast("Participant registered. Share their code privately.");
  if(phone){
    openInvitation({id:result.id,display_name:personName},phone,country);
  }
}));
$("assign-btn").addEventListener("click",run(async()=>{
  if(!event||!confirm("Lock Santa–Child assignments? You cannot change the roster afterward."))return;
  const res=await api("lock_assignments",{event_id:event.id});
  await loadEvents();
  toast(res.assigned+" Secret Santa pairs created.");
}));
$("player-pause").addEventListener("click",()=>{
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
$("player-sign-out").addEventListener("click",()=>{
  endSession();
  if(PREVIEW)history.replaceState(null,"",location.pathname);
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
  $("child-name").textContent=childVisible?player.myChild.name:"Name hidden";
  $("child-toggle").textContent=childVisible?"◉ Hide":"◉ Reveal";
});
$("task-form").addEventListener("submit",run(async e=>{
  e.preventDefault();
  await api("add_task",{task_date:$("task-date").value,task_text:$("task-text").value});
  $("task-text").value="";
  await loadPlayer();toast("Task assigned.");
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
  if(PREVIEW){
    player=demoData();
    $("welcome").classList.add("hidden");
    $("player").classList.remove("hidden");
    document.body.classList.add("office-playing");
    $("player-greeting").textContent="✦ Visual preview";
    $("player-event-title").textContent=player.event.title;
    $("personal-name").textContent=player.me.display_name;
    $("player-hint-text").textContent="Preview-only mode: no Supabase account or private participant information is used.";
    for(const id of ["wishlist-form","task-form"]){
      $(id).querySelectorAll("input,button").forEach(x=>x.disabled=true);
    }
    for(const id of ["child-toggle","save-message","gift-purchased"])$(id).disabled=true;
    await enterOffice(player);
    return;
  }
  if(EVENT_SLUG&&!ADMIN){
    try{
      const result=await api("event_info",{event_slug:EVENT_SLUG});
      $("entry-event").textContent=result.event.title;
    }catch(e){$("entry-event").textContent=e.message;}
  }
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
