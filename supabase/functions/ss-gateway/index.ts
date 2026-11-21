
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Dedicated Secret Santa API. All credentials, identity checks, and database access
// remain server-side; clients receive only signed, role-scoped short-lived tokens.
const BASE = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const encoder = new TextEncoder();
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status,headers:CORS});
class ApiError extends Error {
  status:number;
  constructor(message:string, status=400){super(message);this.status=status;}
}
const fail = (message:string, status=400):never => {throw new ApiError(message,status);};
const string = (value:unknown, max=200) => typeof value==="string" ? value.trim().slice(0,max) : "";
const validId = (s:unknown):s is string => typeof s==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const isDate = (s:unknown):s is string => typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z"));
const q = encodeURIComponent;
const stamp = () => new Date().toISOString();
const randomCode = () => String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000));
function fromHex(s:string):Uint8Array{
  if(s.length%2 || !/^[0-9a-f]+$/i.test(s)) fail("Invalid verifier",500);
  return new Uint8Array(s.match(/.{2}/g)!.map(x=>parseInt(x,16)));
}
function toHex(b:Uint8Array):string {return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");}
function equal(a:Uint8Array,b:Uint8Array):boolean {
  if(a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
let cachedHmacKey:Promise<CryptoKey>|null=null;
async function hmac(s:string):Promise<string>{
  // Cache the same server-held HMAC key. The algorithm and fingerprints do
  // not change; this lets organizer-only legacy migration be bounded.
  if(!cachedHmacKey)cachedHmacKey=crypto.subtle.importKey("raw",encoder.encode(SERVICE),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC",
    await cachedHmacKey,encoder.encode(s))));
}
/**
 * The access verifier remains one-way. For organizer-only repeat display,
 * store a separate AES-GCM envelope with a random nonce, authenticated to
 * its event+participant identity. Encryption keys never leave this gateway.
 * Legacy codes created before this feature cannot be reconstructed.
 */
let cachedVaultKey:Promise<CryptoKey>|null=null;
function vaultKey():Promise<CryptoKey>{
  if(!cachedVaultKey)cachedVaultKey=(async()=>{
    const material=await crypto.subtle.digest("SHA-256",
      encoder.encode("vcf-ss-organizer-vault-v1|"+SERVICE));
    return crypto.subtle.importKey("raw",material,"AES-GCM",false,["encrypt","decrypt"]);
  })();
  return cachedVaultKey;
}
async function encryptOrganizerCode(eventId:string,participantId:string,code:string):Promise<string>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=await crypto.subtle.encrypt({
    name:"AES-GCM",iv,additionalData:encoder.encode("vcf-ss|"+eventId+"|"+participantId)
  },await vaultKey(),encoder.encode(code));
  return "v1:"+toHex(iv)+":"+toHex(new Uint8Array(data));
}
async function decryptOrganizerCode(eventId:string,participantId:string,vault:string):Promise<string>{
  const parts=/^v1:([a-f0-9]{24}):([a-f0-9]{40})$/i.exec(vault);
  if(!parts)fail("Unknown organizer code format.",500);
  const data=await crypto.subtle.decrypt({
    name:"AES-GCM",iv:fromHex(parts[1]),
    additionalData:encoder.encode("vcf-ss|"+eventId+"|"+participantId)
  },await vaultKey(),fromHex(parts[2]));
  const code=new TextDecoder().decode(data);
  if(!/^\d{4}$/.test(code))fail("Invalid organizer code.",500);
  return code;
}
async function persistOrganizerCode(eventId:string,participantId:string,code:string){
  const envelope=await encryptOrganizerCode(eventId,participantId,code);
  const updated=await db("ss_access_codes?select=participant_id&event_id=eq."+eventId+
    "&participant_id=eq."+participantId,"PATCH",{code_vault:envelope},true);
  if(!Array.isArray(updated)||updated.length!==1)
    fail("Invitation code was issued, but could not be retained for the organizer. Reissue it.",503);
}
async function pinHash(pin:string,saltHex:string,iterations:number):Promise<string>{
  const key=await crypto.subtle.importKey("raw",encoder.encode(pin),"PBKDF2",false,["deriveBits"]);
  const result=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromHex(saltHex),iterations,hash:"SHA-256"},key,256);
  return toHex(new Uint8Array(result));
}
function base64Url(raw:string):string {
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function unbase64Url(encoded:string):string {
  const base=encoded.replace(/-/g,"+").replace(/_/g,"/");
  return decodeURIComponent(escape(atob(base)));
}
async function signToken(payload:Record<string,unknown>):Promise<string>{
  const body=base64Url(JSON.stringify(payload));
  const sig=await hmac("vcf-ss-session-v1|"+body);
  return body+"."+sig;
}
async function unpackToken(bearer:string):Promise<Record<string,any>>{
  if(!bearer.startsWith("Bearer "))fail("Please enter your access code.",401);
  const token=bearer.slice(7);
  const match=/^([a-zA-Z0-9_-]{20,1100})\.([a-f0-9]{64})$/.exec(token);
  if(!match)fail("Invalid session. Please sign in again.",401);
  const expected=await hmac("vcf-ss-session-v1|"+match[1]);
  if(!equal(fromHex(expected),fromHex(match[2])))fail("Invalid session.",401);
  let claims:Record<string,any>;
  try{claims=JSON.parse(unbase64Url(match[1]));}catch{fail("Invalid session.",401);}
  if(claims.v!==1 || !Number.isInteger(claims.exp) || claims.exp < Date.now()/1000 || claims.exp > Date.now()/1000+15*86400){
    fail("Session expired. Please sign in again.",401);
  }
  return claims;
}
async function db(path:string,method="GET",body?:unknown,returnRows=false):Promise<any>{
  const response=await fetch(BASE+"/rest/v1/"+path,{
    method,
    headers:{
      apikey:SERVICE,Authorization:"Bearer "+SERVICE,
      "Content-Type":"application/json",
      ...(returnRows?{Prefer:"return=representation"}:{}),
    },
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  let data:any=null;
  const text=await response.text();
  if(text)try{data=JSON.parse(text);}catch{fail("Unexpected database response",502);}
  if(!response.ok) {
    if(response.status===409 || data?.code==="23505")fail("Duplicate value: try a new name, desk or code.",409);
    fail(data?.message||"Database request failed",400);
  }
  return data;
}
async function guard(key:string,success:boolean,limit=6,lock=1200,windowSec=900):Promise<{allowed:boolean; failures:number;locked_until:string|null}> {
  const result = await db("rpc/ss_auth_attempt","POST",{
    p_guard_key:key,p_success:success,p_failure_limit:limit,p_lock_seconds:lock,p_window_seconds:windowSec
  });
  // PostgREST serializes SETOF/RETURNS TABLE RPC results as an array.
  if(!Array.isArray(result)||!result.length)fail("Login limiter unavailable.",503);
  return result[0];
}
async function adminGuard(){
  const rows=await db("ss_auth_guard?select=guard_key,pin_salt_hex,pin_hash_hex,pbkdf2_iterations,token_version,locked_until&guard_key=eq.admin&limit=1");
  if(!rows?.length)fail("Admin credentials are not initialized.",503);
  return rows[0];
}
async function adminLogin(pin:unknown){
  const input=string(pin,12);
  if(!/^\d{4,12}$/.test(input))fail("Enter the administrator PIN.",401);
  const guardState=await adminGuard();
  if(guardState.locked_until && Date.parse(guardState.locked_until)>Date.now())fail("Too many attempts. Try again later.",429);
  const candidate=await pinHash(input,guardState.pin_salt_hex,guardState.pbkdf2_iterations);
  const ok=equal(fromHex(candidate),fromHex(guardState.pin_hash_hex));
  const result=await guard("admin",ok,5,1800,900);
  if(!result.allowed)fail("Too many attempts. Try again later.",429);
  if(!ok)fail("Incorrect admin PIN.",401);
  const token=await signToken({v:1,role:"admin",version:guardState.token_version,exp:Math.floor(Date.now()/1000)+8*3600});
  return {token,role:"admin",expires_in:8*3600};
}
async function eventBySlug(slug:unknown){
  const s=string(slug,80);
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(s))fail("Invalid invitation link.");
  const result=await db("ss_events?select=id,slug,title,status,timezone,assignments_locked_at&slug=eq."+q(s)+"&limit=1");
  if(!result?.length)fail("No Secret Santa event found for this invitation.",404);
  return result[0];
}
async function playerLogin(eventSlug:unknown,code:unknown){
  const event=await eventBySlug(eventSlug);
  const pin=string(code,4);
  if(!/^\d{4}$/.test(pin))fail("Enter your four-digit invitation code.",401);
  const key="event:"+event.id;
  const guards=await db("ss_auth_guard?select=locked_until&guard_key=eq."+q(key)+"&limit=1");
  if(guards?.[0]?.locked_until && Date.parse(guards[0].locked_until)>Date.now())fail("Too many attempts for this event. Try later.",429);
  const fingerprint=await hmac("vcf-ss-code|"+event.id+"|"+pin);
  const rows=await db("ss_access_codes?select=participant_id,rotated_at&event_id=eq."+event.id+"&code_fingerprint=eq."+fingerprint+"&limit=1");
  const row=rows?.[0];
  let participant:any=null;
  if(row){
    const players=await db("ss_participants?select=id,display_name,is_active&event_id=eq."+event.id+"&id=eq."+row.participant_id+"&limit=1");
    participant=players?.[0]?.is_active?players[0]:null;
  }
  const ok=!!participant;
  const attempt=await guard(key,ok,12,900,900);
  if(!attempt.allowed)fail("Too many attempts for this event. Try later.",429);
  if(!ok)fail("Invalid code. Please check your invitation.",401);
  const token=await signToken({
    v:1,role:"player",event_id:event.id,participant_id:participant.id,
    generation:row.rotated_at,exp:Math.floor(Date.now()/1000)+7*86400
  });
  return {token,role:"player",expires_in:7*86400,event:{slug:event.slug,title:event.title},player:{id:participant.id,display_name:participant.display_name}};
}
async function authorize(request:Request):Promise<Record<string,any>>{
  const user=await unpackToken(request.headers.get("Authorization")||"");
  if(user.role==="admin"){
    const state=await adminGuard();
    if(user.version!==state.token_version)fail("Admin PIN has changed. Please sign in again.",401);
    return user;
  }
  if(user.role==="player" && validId(user.event_id) && validId(user.participant_id)){
    const [codes,players]=await Promise.all([
      db("ss_access_codes?select=rotated_at&event_id=eq."+user.event_id+"&participant_id=eq."+user.participant_id+"&limit=1"),
      db("ss_participants?select=is_active&event_id=eq."+user.event_id+"&id=eq."+user.participant_id+"&limit=1"),
    ]);
    if(!codes?.length||codes[0].rotated_at!==user.generation||!players?.[0]?.is_active)
      fail("Your invitation has changed. Enter the latest code.",401);
    return user;
  }
  fail("Invalid session.",401);
}
async function fingerprint(eventId:string,code:string){return hmac("vcf-ss-code|"+eventId+"|"+code);}
async function ownerEvent(input:unknown){
  if(!validId(input))fail("Invalid event ID.");
  const list=await db("ss_events?select=id,slug,title,status,assignments_locked_at&"+"id=eq."+input+"&limit=1");
  if(!list.length)fail("Event not found.",404);
  return list[0];
}
function safeWishlist(raw:unknown){
  if(!Array.isArray(raw)||raw.length>25)fail("Wishlist must be a list of at most 25 wishes.");
  const ids=new Set<string>();
  return raw.map((item:any)=>{
    if(!item || !validId(item.id)||typeof item.text!=="string" || !item.text.trim() || item.text.trim().length>240 || ids.has(item.id))
      fail("Invalid wishlist item.");
    ids.add(item.id);return {id:item.id,text:item.text.trim()};
  });
}
function sanitizedAvatar(data:unknown){
  if(!data||typeof data!=="object"||Array.isArray(data))fail("Invalid avatar details.");
  const r=data as Record<string,unknown>;
  const strVal=(key:string,allowed:string[],fallback:string)=>{
    const v=r[key];return typeof v==="string"&&allowed.includes(v)?v:fallback;
  };
  const intVal=(key:string,max:number,fallback=0)=>{
    const v=Number(r[key]);return Number.isInteger(v)&&v>=0&&v<=max?v:fallback;
  };
  const numVal=(key:string,min:number,max:number,fallback:number)=>{
    const v=Number(r[key]);return Number.isFinite(v)&&v>=min&&v<=max?Math.round(v*100)/100:fallback;
  };
  return {
    schema_version:4,
    gender:strVal("gender",["male","female"],"male"),
    outfit:strVal("outfit",["shirt","tshirt","suit","salwar","dress","sweater","jacket","bomber","blazer"],"shirt"),
    bottom:strVal("bottom",["jeans","trousers","leggings","palazzo"],"jeans"),
    skin:intVal("skin",8),
    hair:intVal("hair",8),
    hairstyle:intVal("hairstyle",23),
    color:intVal("color",11),
    footwear:strVal("footwear",["auto","sneakers","formal","flats","sandals"],"auto"),
    bottomColor:intVal("bottomColor",11,-1),
    shoeColor:intVal("shoeColor",11,-1),
    facialHair:strVal("facialHair",["none","moustache-classic","moustache-pencil","moustache-handlebar","soul-patch","beard-goatee","beard-anchor","beard-balbo","beard-vandyke","beard-short","beard-tight","beard-boxed","beard-full","beard-ear","beard-lumberjack","beard-viking","combo-short","combo-full","combo-ear","stubble-light","stubble-full","stubble-heavy"],"none"),
    bindiStyle:strVal("bindiStyle",["none","small-round","medium-round","oval","diamond","ornate"],"none"),
    bindiColor:intVal("bindiColor",7),
    glassesStyle:strVal("glassesStyle",["none","round","rectangle","square","aviator","cat-eye"],r.glasses===true?"rectangle":"none"),
    glassesColor:intVal("glassesColor",11),
    glasses:r.glassesStyle!==undefined?r.glassesStyle!=="none":r.glasses===true,
    height:numVal("height",.80,1.30,1),
    build:numVal("build",.65,1.55,1)
  };
}
function today(tz:string){
  try{return new Intl.DateTimeFormat("sv-SE",{timeZone:tz||"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
  catch{return new Date().toISOString().slice(0,10);}
}
async function dashboard(claims:any){
  const eventId=claims.event_id,pid=claims.participant_id;
  const [event,roster,priv,asSanta,asChild]=await Promise.all([
    db("ss_events?select=id,slug,title,status,timezone,gift_budget_recommendation_inr&"+"id=eq."+eventId+"&limit=1"),
    db("ss_participants?select=id,display_name,desk_key,avatar,avatar_version&event_id=eq."+eventId+"&is_active=eq.true&order=created_at.asc"),
    db("ss_participant_private?select=wishlist,wishlist_version&participant_id=eq."+pid+"&event_id=eq."+eventId+"&limit=1"),
    db("ss_assignments?select=id,child_id,santa_message,gift_purchased&event_id=eq."+eventId+"&santa_id=eq."+pid+"&limit=1"),
    db("ss_assignments?select=id&event_id=eq."+eventId+"&child_id=eq."+pid+"&limit=1")
  ]);
  const eventObj=event[0];if(!eventObj)fail("Event not found.",404);
  const isMine=roster.find((p:any)=>p.id===pid);if(!isMine)fail("Participant missing.",404);
  const outgoing=asSanta[0]||null;
  const incoming=asChild[0]||null;
  const date=today(eventObj.timezone);
  const [ownChildWishlist,ownTasks,receivedTasks,day]=await Promise.all([
    outgoing?db("ss_participant_private?select=wishlist&participant_id=eq."+outgoing.child_id+"&event_id=eq."+eventId+"&limit=1"):Promise.resolve([]),
    outgoing?db("ss_santa_tasks?select=id,task_date,task_text,status&assignment_id=eq."+outgoing.id+"&event_id=eq."+eventId+"&order=task_date.asc"):Promise.resolve([]),
    incoming?db("ss_santa_tasks?select=id,task_date,task_text,status&assignment_id=eq."+incoming.id+"&event_id=eq."+eventId+"&task_date=lte."+date+"&order=task_date.asc"):Promise.resolve([]),
    db("ss_event_days?select=id,scene,office_date&event_id=eq."+eventId+"&office_date=eq."+date+"&status=eq.published&limit=1")
  ]);
  let hint=null;
  if(day.length){
    const h=await db("ss_daily_hints?select=clue_text&event_day_id=eq."+day[0].id+"&recipient_id=eq."+pid+"&limit=1");
    hint=h?.[0]?.clue_text||null;
  }
  return {
    event:{title:eventObj.title,slug:eventObj.slug,status:eventObj.status,timezone:eventObj.timezone,budget:eventObj.gift_budget_recommendation_inr},
    me:{id:pid,display_name:isMine.display_name,avatar:isMine.avatar,avatar_version:isMine.avatar_version||1,wishlist:priv[0]?.wishlist||[],wishlist_version:priv[0]?.wishlist_version||1},
    colleagues:roster.map((p:any)=>({id:p.id,name:p.display_name,desk_key:p.desk_key,avatar:p.avatar})),
    myChild:outgoing?{id:outgoing.child_id,name:roster.find((p:any)=>p.id===outgoing.child_id)?.display_name||"Secret Child",wishlist:ownChildWishlist?.[0]?.wishlist||[],gift_purchased:outgoing.gift_purchased,message:outgoing.santa_message||"",tasks:ownTasks}:null,
    receivedTasks,office:day?.[0]?.scene||null,hint,today:date
  };
}
/**
 * One-time compatibility for the first generation of issued codes.
 * They were saved only as event-specific HMAC verifiers. The original
 * generator uses a 4-digit range 1000..9999; an AUTHENTICATED ORGANIZER
 * may reconstruct the 9000 possibilities inside the server, then encrypt
 * recovered values in the new organizer-only vault. Previously shared
 * participant codes stay valid; we never silently rotate them.
 */
async function recoverLegacyOrganizerCodes(eventId:string,issued:any[],
  codes:Record<string,string>){
  const legacy=new Map<string,string>();
  for(const row of issued)
    if(!row.code_vault && typeof row.code_fingerprint==="string")
      legacy.set(row.code_fingerprint,row.participant_id);
  if(!legacy.size)return;
  const found:{id:string;code:string}[]=[];
  const prefix="vcf-ss-code|"+eventId+"|";
  for(let start=1000;start<10000 && legacy.size;start+=150){
    const guesses=Array.from({length:Math.min(150,10000-start)},
      (_,i)=>String(start+i));
    const fingerprints=await Promise.all(guesses.map(code=>hmac(prefix+code)));
    for(let i=0;i<guesses.length;i++){
      const id=legacy.get(fingerprints[i]);
      if(!id)continue;
      codes[id]=guesses[i];
      found.push({id,code:guesses[i]});
      legacy.delete(fingerprints[i]);
    }
  }
  // Persist recovered codes encrypted; never return/store the HMAC key.
  for(let k=0;k<found.length;k+=12){
    await Promise.all(found.slice(k,k+12).map(async({id,code})=>{
      try{await persistOrganizerCode(eventId,id,code);}
      catch{console.warn("An existing organizer code could not be vaulted.");}
    }));
  }
}
async function adminAction(action:string,data:any){
  if(action==="list_events"){
    const events=await db("ss_events?select=id,slug,title,status,starts_on,ends_on,reveal_at,assignments_locked_at,created_at&order=created_at.desc&limit=100");
    return {events};
  }
  if(action==="create_event"){
    const name=string(data.title,160);
    if(name.length<3)fail("Please enter a longer event title.");
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)+"-"+crypto.randomUUID().slice(0,6);
    const row=await db("ss_events","POST",{
      title:name,slug,timezone:"Asia/Kolkata",
      gift_budget_recommendation_inr:500,
      rules:{budget_note:"We recommend keeping your gift within ₹500. Choose something thoughtful, and share warm wishes.",tasks_optional:true},
      office_layout:{version:1,far_end_window:true,walls:"white",workstation_banks:["single-sided-wall-row","double-sided-island"],spawn:"christmas-tree"}
    },true);
    return {event:row[0]};
  }
  if(action==="change_admin_pin"){
    const current=string(data.current_pin,12);
    const next=string(data.new_pin,12);
    if(!/^\d{4,12}$/.test(next))fail("New PIN must contain 4–12 digits.");
    if(current===next)fail("Choose a different PIN.");
    const row=await adminGuard();
    const prior=await pinHash(current,row.pin_salt_hex,row.pbkdf2_iterations);
    if(!equal(fromHex(prior),fromHex(row.pin_hash_hex)))fail("Current PIN is incorrect.",401);
    const salt=toHex(crypto.getRandomValues(new Uint8Array(16)));
    const derived=await pinHash(next,salt,210000);
    const updated=await db("ss_auth_guard?guard_key=eq.admin&token_version=eq."+row.token_version,"PATCH",{
      pin_salt_hex:salt,pin_hash_hex:derived,pbkdf2_iterations:210000,token_version:row.token_version+1,
      failures:0,locked_until:null,updated_at:stamp()
    },true);
    if(updated.length!==1)fail("PIN changed elsewhere; please sign in again.",409);
    return {token:await signToken({v:1,role:"admin",version:row.token_version+1,exp:Math.floor(Date.now()/1000)+8*3600}),role:"admin",expires_in:8*3600};
  }
  const event=await ownerEvent(data.event_id);
  if(action==="list_participants"){
    const [roster,pairs,issued]=await Promise.all([
      db("ss_participants?select=id,display_name,desk_key,is_active,avatar,avatar_version,created_at&event_id=eq."+event.id+"&order=created_at.asc"),
      db("ss_assignments?select=id,santa_id,child_id&event_id=eq."+event.id),
      db("ss_access_codes?select=participant_id,code_fingerprint,code_vault&event_id=eq."+event.id)
    ]);
    const codes:Record<string,string>={};
    for(const row of issued){
      if(!row.code_vault)continue; // Old codes are HMAC-only, not reversible.
      try{
        const code=await decryptOrganizerCode(event.id,row.participant_id,row.code_vault);
        if(await fingerprint(event.id,code)===row.code_fingerprint)
          codes[row.participant_id]=code;
      }catch(e){console.warn("Unreadable organizer code envelope for one participant.");}
    }
    if(issued.some(row=>!row.code_vault)){
      try{await recoverLegacyOrganizerCodes(event.id,issued,codes);}
      catch{console.warn("Some legacy invitation codes could not be recovered.");}
    }
    return {event,participants:roster,assignments:pairs,codes};
  }
  if(action==="add_participant"){
    if(event.assignments_locked_at)fail("Assignments locked; participant registration is closed.");
    const name=string(data.display_name,160);
    const desk=string(data.desk_key,30);
    if(!name)fail("Employee name required.");
    // Phone numbers are deliberately never accepted or persisted by this endpoint.
    for(let i=0;i<10;i++){
      const code=randomCode();
      try{
        const id=await db("rpc/ss_register_participant","POST",{
          p_event_id:event.id,p_display_name:name,p_desk_key:desk||null,
          p_code_fingerprint:await fingerprint(event.id,code)
        });
        await persistOrganizerCode(event.id,id,code);
        return {id,code};
      }catch(e){
        const msg=String(e);
        if(!msg.includes("Duplicate value"))throw e;
      }
    }
    fail("No unique code could be generated.");
  }
  if(action==="admin_save_avatar"){
    // Organizer identity was verified before adminAction. Updates are scoped
    // to the current event and reject stale versions just like player saves.
    if(!validId(data.participant_id))fail("Invalid participant.",400);
    const version=Number(data.version);
    if(!Number.isInteger(version)||version<1)fail("Reload this participant before saving.",400);
    const avatar=sanitizedAvatar(data.avatar);
    const updated=await db("ss_participants?id=eq."+data.participant_id+
      "&event_id=eq."+event.id+"&avatar_version=eq."+version,
      "PATCH",{avatar,avatar_version:version+1,updated_at:stamp()},true);
    if(updated?.length!==1)fail("Avatar was changed elsewhere. Reload this participant.",409);
    return {avatar,version:version+1};
  }
  if(action==="edit_participant"){
    if(event.assignments_locked_at)fail("The roster is locked.");
    if(!validId(data.participant_id))fail("Invalid participant.");
    const name=string(data.display_name,160),desk=string(data.desk_key,30);
    if(!name)fail("Name required.");
    const updated=await db("ss_participants?id=eq."+data.participant_id+"&event_id=eq."+event.id,"PATCH",{
      display_name:name,desk_key:desk||null,is_active:!!data.is_active,updated_at:stamp()
    },true);
    if(!updated?.length)fail("Participant not found.",404);
    return {ok:true};
  }
  if(action==="rotate_code"){
    if(!validId(data.participant_id))fail("Invalid participant.");
    for(let i=0;i<10;i++){
      const code=randomCode();
      try{
        await db("rpc/ss_rotate_access_code","POST",{
          p_event_id:event.id,p_participant_id:data.participant_id,p_new_fingerprint:await fingerprint(event.id,code)
        });
        await persistOrganizerCode(event.id,data.participant_id,code);
        return {code};
      }catch(e){
        if(!String(e).includes("Duplicate value"))throw e;
      }
    }
    fail("No unique code could be generated.");
  }
  if(action==="lock_assignments"){
    const assigned=await db("rpc/ss_lock_assignments","POST",{p_event_id:event.id});
    return {assigned};
  }
  fail("Unsupported organizer action.");
}
async function playerAction(action:string,claims:any,data:any){
  const eventId=claims.event_id,pid=claims.participant_id;
  if(action==="player_dashboard")return dashboard(claims);
  if(action==="save_avatar"){
    const avatar=sanitizedAvatar(data.avatar);
    const version=Number(data.version);
    if(!Number.isInteger(version)||version<1)fail("Please reload your avatar before saving.");
    const result=await db("ss_participants?id=eq."+pid+"&event_id=eq."+eventId+"&is_active=eq.true&avatar_version=eq."+version,"PATCH",{
      avatar,avatar_version:version+1,updated_at:stamp()
    },true);
    if(!result?.length)fail("Your avatar changed on another device. Refresh and try again.",409);
    return {avatar,version:version+1};
  }
  if(action==="save_wishlist"){
    const items=safeWishlist(data.items);
    const version=Number(data.version);
    if(!Number.isInteger(version)||version<1)fail("Please reload your wishlist.");
    const updated=await db("ss_participant_private?participant_id=eq."+pid+"&event_id=eq."+eventId+"&wishlist_version=eq."+version,"PATCH",{
      wishlist:items,wishlist_version:version+1,updated_at:stamp()
    },true);
    if(!updated.length)fail("Your wishlist changed on another device. Refresh and try again.",409);
    return {wishlist:items,version:version+1};
  }
  const rows=await db("ss_assignments?select=id,child_id&event_id=eq."+eventId+"&santa_id=eq."+pid+"&limit=1");
  const assignment=rows[0];
  if(!assignment)fail("Assignments haven't been generated yet.");
  if(action==="add_task"){
    const eventRow=await db("ss_events?select=timezone&"+"id=eq."+eventId+"&limit=1");
    const date=string(data.task_date,10);
    if(!isDate(date)||date<today(eventRow?.[0]?.timezone||"Asia/Kolkata"))fail("Choose today or a future date.");
    const text=string(data.task_text,1000);
    if(!text || text.length<3)fail("Enter a meaningful task.");
    const row=await db("ss_santa_tasks","POST",{event_id:eventId,assignment_id:assignment.id,task_date:date,task_text:text},true);
    return {task:{id:row[0].id,task_date:row[0].task_date,task_text:row[0].task_text,status:row[0].status}};
  }
  if(action==="complete_task"){
    if(!validId(data.task_id))fail("Invalid task.");
    const completed=!!data.completed;
    const result=await db("ss_santa_tasks?id=eq."+data.task_id+"&event_id=eq."+eventId+"&assignment_id=eq."+assignment.id+"&status=neq.cancelled","PATCH",{
      status:completed?"completed":"pending",completed_at:completed?stamp():null,updated_at:stamp()
    },true);
    if(!result.length)fail("Task unavailable.",404);
    return {task:{id:result[0].id,status:result[0].status}};
  }
  if(action==="save_message"){
    const message=string(data.message,5000);
    await db("ss_assignments?id=eq."+assignment.id+"&event_id=eq."+eventId,"PATCH",{
      santa_message:message||null,message_updated_at:stamp(),updated_at:stamp()
    });
    return {ok:true};
  }
  if(action==="gift_status"){
    const purchased=!!data.purchased;
    await db("ss_assignments?id=eq."+assignment.id+"&event_id=eq."+eventId,"PATCH",{
      gift_purchased:purchased,gift_purchased_at:purchased?stamp():null,updated_at:stamp()
    });
    return {ok:true};
  }
  fail("Unsupported player action.");
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST")return json({error:"Use POST"},405);
  try{
    const input=await req.json();
    if(!input || typeof input!=="object")fail("Invalid request");
    const action=string(input.action,48);
    if(action==="admin_login")return json(await adminLogin(input.pin));
    if(action==="player_login")return json(await playerLogin(input.event_slug,input.code));
    if(action==="event_info"){
      const e=await eventBySlug(input.event_slug);
      return json({event:{title:e.title,slug:e.slug}});
    }
    const claims=await authorize(req);
    if(claims.role==="admin")return json(await adminAction(action,input));
    if(claims.role==="player")return json(await playerAction(action,claims,input));
    fail("Unauthorized",403);
  }catch(error){
    const err=error as any;
    return json({error:err instanceof Error?err.message:"Unexpected error"},err instanceof ApiError?err.status:500);
  }
});
