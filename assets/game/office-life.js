/**
 * Small social simulation for the actual roster (never generates demo people).
 * Coworkers type, snack, drink coffee, take short corridor walks, and visit
 * each other at desk edges. Body part animation is owned by avatar.js.
 *
 * Spatial rules: all conversational targets use a navigable 1.55m offset.
 * Moving actors yield to each other and to the player; the desk colliders are
 * respected by the same A* navigation used for player walking.
 */
const ACTIONS=["hi","dance","clap","cheer"];
const GREETING_DISTANCE=1.55;
const MIN_SEPARATION=.86;
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function angleTo(a,b){return Math.atan2(b.x-a.x,b.z-a.z);}
function face(actor,target){
  if(!actor||!target)return;
  actor.group.rotation.y=angleTo(actor.group.position,target.group.position);
}
function hash(value){
  let n=2166136261;
  for(const c of String(value)){n=Math.imul(n^c.charCodeAt(0),16777619);}
  return n>>>0;
}
function rngFor(person){let n=hash(person.id);return()=>((n=Math.imul(1664525,n)+1013904223>>>0)/4294967296);}
export function createOfficeLife(people,hero,nav,announce=()=>{}){
  const states=people.map((person,i)=>({
    person,mode:"desk",route:[],partner:null,until:1+i*.23,
    next:1.4+(i%7)*.61,pausedUntil:0,seed:rngFor(person),
    home:{...person.seat.position},stuck:0
  }));
  const lookup=new Map(states.map(s=>[s.person.id,s]));
  const proximityGreeted=new Map();
  let nextProximityScan=1.5,lastAmbientGreeting=-30;
  for(let i=0;i<states.length;i++){
    const actor=states[i].person.detailed;
    actor.seated=true;
    actor.setActivity(i%5===0?"coffee":i%7===0?"apple":"typing");
  }
  const roamLimit=Math.min(7,Math.max(2,Math.ceil(states.length/18)));
  const motions=new Set();
  const candidateAngles=[0,.45,-.45,.90,-.90,1.45,-1.45,Math.PI];
  function blockedByPeople(x,z,except,target=null,minDistance=MIN_SEPARATION){
    if(hero&&hero!==except){
      if(dist({x,z},hero.group.position)<minDistance)return true;
    }
    for(const st of states){
      if(st.person===except||st.person.detailed===except||
        st.person===target||st.person.detailed===target)continue;
      if(dist({x,z},st.person.detailed.group.position)<minDistance)return true;
    }
    return false;
  }
  function findApproach(origin,target,actor=null,standoff=GREETING_DISTANCE){
    if(!origin||!target)return null;
    const heading=Math.atan2(origin.z-target.z,origin.x-target.x);
    let best=null;
    for(const radius of [standoff,standoff+.38,standoff+.72]){
      for(const offset of candidateAngles){
        const a=heading+offset;
        const candidate={x:target.x+Math.cos(a)*radius,z:target.z+Math.sin(a)*radius};
        if(nav.collision(candidate.x,candidate.z))continue;
        if(blockedByPeople(candidate.x,candidate.z,actor,null,.82))continue;
        const path=nav.find(origin,candidate);
        if(!path.length)continue;
        const end=path[path.length-1];
        if(dist(end,target)<1.10)continue;
        const cost=path.length+Math.abs(offset)*.8+Math.abs(radius-standoff)*1.4;
        if(!best||cost<best.cost)best={path,end,cost};
      }
      if(best)break;
    }
    return best;
  }
  function setDeskActivity(st,time,activity){
    st.mode="desk";st.partner=null;st.route=[];st.stuck=0;
    st.person.detailed.seated=true;
    st.person.detailed.setActivity(activity);
    st.next=time+5+st.seed()*10;
    motions.delete(st);
  }
  function beginVisit(st,time){
    if(motions.size>=roamLimit)return false;
    const candidates=states.filter(t=>t!==st&&t.mode==="desk"&&
      dist(st.home,t.home)>2.6&&dist(st.home,t.home)<18&&t.next>time+1);
    if(!candidates.length)return false;
    const target=candidates[Math.floor(st.seed()*candidates.length)];
    const from=st.person.detailed.group.position;
    const approach=findApproach(from,target.person.detailed.group.position,
      st.person.detailed);
    if(!approach||approach.path.length<2)return false;
    st.mode="visiting";st.partner=target;st.route=approach.path;
    st.until=time+25;st.stuck=0;
    st.person.detailed.seated=false;
    st.person.detailed.setActivity("idle");
    // Reserve the receiving coworker so they don't start a different task
    // or walk away while their friend is en route to the desk.
    target.mode="awaitingVisit";
    target.partner=st;
    target.until=time+27;
    target.person.detailed.seated=true;
    target.person.detailed.setActivity("typing");
    motions.add(st);return true;
  }
  function moveAlong(st,dt){
    const actor=st.person.detailed;
    if(!st.route.length)return true;
    const goal=st.route[0],pos=actor.group.position;
    const d=dist(pos,goal);
    if(d<.15){st.route.shift();return st.route.length===0;}
    const travel=Math.min(d,dt*1.77);
    const next={x:pos.x+(goal.x-pos.x)/d*travel,
      z:pos.z+(goal.z-pos.z)/d*travel};
    const partner=st.partner?.person?.detailed;
    if(blockedByPeople(next.x,next.z,actor,partner,.88)){
      st.stuck+=dt;
      // A temporary crowd is safer than walking through a character.
      // Give up a visit if traffic stays blocked; try again later.
      if(st.stuck>3.5){
        st.route=[];return true;
      }
      return false;
    }
    st.stuck=0;
    pos.x=next.x;pos.z=next.z;
    const turn=angleTo({x:pos.x,z:pos.z},goal);
    actor.group.rotation.y+=Math.atan2(
      Math.sin(turn-actor.group.rotation.y),
      Math.cos(turn-actor.group.rotation.y))*Math.min(1,dt*9);
    return false;
  }
  function converseWith(st,other,time){
    const a=st.person.detailed,b=other.person.detailed;
    st.mode="talking";st.until=time+3.8;st.route=[];
    other.mode="responding";other.until=time+4.25;other.partner=st;
    a.seated=false;b.seated=false;
    a.setActivity("talk");b.setActivity("talk");
    face(a,b);face(b,a);
    a.play("hi",time);b.play("hi",time+.06);
    announce(other.person,"Hello!",time);
  }
  function resumeDesk(st,time){
    st.mode="desk";st.partner=null;st.route=[];
    st.person.detailed.group.position.set(st.home.x,0,st.home.z);
    st.person.detailed.group.rotation.y=st.person.seat.facing;
    setDeskActivity(st,time,st.seed()<.72?"typing":"coffee");
  }
  function update(time,dt){
    for(const st of states){
      const actor=st.person.detailed;
      let moving=false;
      if(st.mode==="visiting"||st.mode==="returning"){
        moving=!moveAlong(st,dt);
        if(!moving){
          if(st.mode==="visiting"&&st.partner?.mode==="awaitingVisit"&&dist(actor.group.position,st.partner.person.detailed.group.position)<2.75){
            converseWith(st,st.partner,time);
          }else if(st.mode==="returning"){
            resumeDesk(st,time);
          }else{
            st.mode="returning";
            st.partner=null;
            st.route=nav.find(actor.group.position,st.home);
            if(!st.route.length)resumeDesk(st,time);
          }
        }
      }else if(st.mode==="talking"&&time>=st.until){
        st.mode="returning";st.partner=null;st.route=nav.find(actor.group.position,st.home);
        actor.setActivity("idle");
        if(!st.route.length)resumeDesk(st,time);
      }else if((st.mode==="responding"||st.mode==="player"||
        st.mode==="awaiting"||st.mode==="awaitingVisit")&&time>=st.until){
        if(dist(actor.group.position,st.home)<.9)resumeDesk(st,time);
        else{
          st.mode="returning";st.partner=null;
          st.route=nav.find(actor.group.position,st.home);
          actor.setActivity("idle");
          if(!st.route.length)resumeDesk(st,time);
        }
      }else if(st.mode==="desk"&&time>=st.next){
        const r=st.seed();
        if(r>.65&&beginVisit(st,time)){
          // now walking away from their desk
        }else{
          setDeskActivity(st,time,r<.46?"typing":r<.72?"coffee":"apple");
        }
      }
      actor.update(time,moving);
    }
    // Crossing into conversational distance triggers an actual reciprocal
    // wave even before the player taps anyone. A cooldown prevents spam.
    if(time>=nextProximityScan){
      nextProximityScan=time+.8;
      const closest=states.filter(st=>
        st.mode==="desk"&&dist(st.person.detailed.group.position,hero.group.position)<3.75&&
        time-(proximityGreeted.get(st.person.id)??-100)>18)
        .sort((a,b)=>dist(a.person.detailed.group.position,hero.group.position)-
                     dist(b.person.detailed.group.position,hero.group.position));
      if(closest.length&&time-lastAmbientGreeting>7.5){
        const st=closest[0];
        proximityGreeted.set(st.person.id,time);
        lastAmbientGreeting=time;
        interruptForHero(st.person,"hi",time,false);
      }
    }
  }
  function reserveForPlayer(target,time){
    const st=lookup.get(target?.id);
    if(!st)return;
    motions.delete(st);
    // If another NPC is arriving, release that NPC's visit reservation.
    if(st.partner&&st.partner.mode==="visiting"){
      st.partner.route=[];
      st.partner.mode="returning";
      st.partner.route=nav.find(st.partner.person.detailed.group.position,st.partner.home);
    }
    st.mode="awaiting";st.route=[];st.partner=null;
    st.until=time+18;
    st.person.detailed.setActivity("idle");
    if(dist(st.person.detailed.group.position,hero.group.position)<4){
      // A colleague acknowledges being selected rather than freezing.
      st.person.detailed.seated=false;
      st.person.detailed.group.rotation.y=angleTo(st.person.detailed.group.position,hero.group.position);
      st.person.detailed.play("hi",time);
    }
  }
  function interruptForHero(target,action,time,facePlayer=true){
    const st=lookup.get(target?.id);if(!st)return;
    const actor=st.person.detailed;
    motions.delete(st);
    st.mode="player";st.partner=null;st.route=[];st.until=time+3.7;
    actor.seated=false;actor.setActivity("talk");
    face(actor,hero);
    if(facePlayer)face(hero,actor);
    const gesture=ACTIONS.includes(action)?action:"hi";
    actor.play(gesture,time+.02);
    const responses={hi:"Hi there!",dance:"Let's dance!",clap:"Bravo!",cheer:"Merry Christmas!"};
    announce(st.person,responses[gesture],time);
  }
  function mimicNearby(action,time,range=5.4){
    const candidates=states.filter(st=>
      dist(st.person.detailed.group.position,hero.group.position)<=range);
    if(!candidates.length)return null;
    candidates.sort((a,b)=>dist(a.person.detailed.group.position,hero.group.position)-
      dist(b.person.detailed.group.position,hero.group.position));
    // Nearby coworkers acknowledge the same action: one responds directly
    // while the next two can join without rotating the player repeatedly.
    for(const [i,st] of candidates.slice(0,3).entries()){
      interruptForHero(st.person,action,time,i===0);
      proximityGreeted.set(st.person.id,time);
    }
    lastAmbientGreeting=time;
    return candidates[0].person;
  }
  function dispose(){
    motions.clear();lookup.clear();proximityGreeted.clear();states.length=0;
  }
  return {update,findApproach,reserveForPlayer,interruptForHero,mimicNearby,dispose,
    get states(){return states;},minDistance:GREETING_DISTANCE};
}
