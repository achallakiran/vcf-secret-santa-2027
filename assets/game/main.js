import * as THREE from "three";
import {buildOffice} from "./office.js?v=no-skyline-v1";
import {createAvatar,avatarFromPerson} from "./avatar.js?v=face-refine-v4-studio-qa-v1";
import {createOfficeLife} from "./office-life.js?v=studio-qa-v1";

/* A responsive office runtime. 3D art and camera are independent from the existing Supabase UI. */
const UP=new THREE.Vector3(0,1,0);
// One slightly closer, lower overview: same visual language and orientation as
// the approved After preview, with a small additional zoom toward the character and nearby desks.
const AFTER_OVERVIEW=Object.freeze({
  yaw:2.63,pitch:.66,distance:38,focusX:0,focusY:1.4,focusZ:12.7
});
const MODES={wide:{distance:AFTER_OVERVIEW.distance,
  pitch:AFTER_OVERVIEW.pitch,fov:50}};
const TWO_PI=Math.PI*2;
function v2(x,z){return {x,z};}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function greetObject(name){return "👋 "+name;}
function releaseCharacterMaterials(avatar){
  if(!avatar?.group)return;
  // Shared sculpture geometry and cached finishes belong to the art factory;
  // only per-character extras (for example transparent lenses) are disposable.
  const owned=new Set();
  avatar.group.traverse(obj=>{
    if(!obj.isMesh)return;
    for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
      if(material&&!material.userData?.sharedVoxelMaterial)owned.add(material);
    }
  });
  owned.forEach(material=>material.dispose());
}
class MinHeap{
  constructor(){this.data=[];}
  push(n){const a=this.data;a.push(n);let i=a.length-1;while(i>0){let p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p;}a[i]=n;}
  pop(){
    const a=this.data,first=a[0],end=a.pop();
    if(a.length){
      let i=0;
      while(i*2+1<a.length){
        let c=i*2+1;
        if(c+1<a.length && a[c+1].f<a[c].f)c++;
        if(a[c].f>=end.f)break;
        a[i]=a[c];i=c;
      }
      a[i]=end;
    }
    return first;
  }
  get size(){return this.data.length;}
}
class Navigation{
  constructor(office){
    this.office=office;this.cell=.48;
    this.nx=Math.floor((office.room.right-office.room.left)/this.cell);
    this.nz=Math.floor((office.room.back-office.room.front)/this.cell);
    this.blocked=new Uint8Array(this.nx*this.nz);
    for(let z=0;z<this.nz;z++)for(let x=0;x<this.nx;x++){
      const p=this.world(x,z);const n=this.index(x,z);
      this.blocked[n]=this.collision(p.x,p.z)?1:0;
    }
  }
  index(x,z){return z*this.nx+x;}
  inBounds(x,z){return x>=0&&z>=0&&x<this.nx&&z<this.nz;}
  world(x,z){return v2(this.office.room.left+(x+.5)*this.cell,this.office.room.front+(z+.5)*this.cell);}
  cellAt(x,z){return {x:Math.floor((x-this.office.room.left)/this.cell),z:Math.floor((z-this.office.room.front)/this.cell)};}
  collision(x,z){
    const r=this.office.room;
    if(x<r.left+.35||x>r.right-.35||
      z<r.front+.34||z>r.back-.35)return true;
    // Passage mouths are dark non-playable blackboxes. Navigation never
    // crosses the west wall or enters a room beyond it.
    for(const c of this.office.colliders){
      if(Math.abs(x-c.x)<c.hx+.25 && Math.abs(z-c.z)<c.hz+.25)return true;
    }
    return false;
  }
  free(x,z){return this.inBounds(x,z)&&!this.blocked[this.index(x,z)];}
  nearest(x,z){
    let p=this.cellAt(x,z);
    if(this.free(p.x,p.z))return p;
    for(let r=1;r<16;r++){
      let closest=null,dist=Infinity;
      for(let zz=-r;zz<=r;zz++)for(let xx=-r;xx<=r;xx++){
        const tx=p.x+xx,tz=p.z+zz;
        if(!this.free(tx,tz))continue;
        const d=xx*xx+zz*zz;
        if(d<dist){dist=d;closest={x:tx,z:tz};}
      }
      if(closest)return closest;
    }
    return null;
  }
  find(start,end){
    const a=this.nearest(start.x,start.z),b=this.nearest(end.x,end.z);
    if(!a||!b)return [];
    const total=this.nx*this.nz,g=new Float32Array(total),parent=new Int32Array(total),closed=new Uint8Array(total);
    g.fill(Infinity);parent.fill(-1);
    const source=this.index(a.x,a.z),goal=this.index(b.x,b.z),heap=new MinHeap();
    g[source]=0;heap.push({i:source,f:0});
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    while(heap.size){
      const item=heap.pop(),cur=item.i;if(closed[cur])continue;
      closed[cur]=1;if(cur===goal)break;
      const z=Math.floor(cur/this.nx),x=cur-z*this.nx;
      for(const [dx,dz] of dirs){
        const xx=x+dx,zz=z+dz;
        if(!this.free(xx,zz))continue;
        if(dx&&dz&&(!this.free(x+dx,z)||!this.free(x,z+dz)))continue;
        const next=this.index(xx,zz),cost=g[cur]+(dx&&dz?1.4142:1);
        if(cost<g[next]){
          g[next]=cost;parent[next]=cur;
          const h=Math.hypot(xx-b.x,zz-b.z);
          heap.push({i:next,f:cost+h});
        }
      }
    }
    if(source!==goal&&parent[goal]===-1)return [];
    const reverse=[];let k=goal,safety=0;
    do{
      const x=k%this.nx,z=Math.floor(k/this.nx);
      reverse.push(this.world(x,z));k=parent[k];safety++;
    }while(k!==-1&&k!==source&&safety<total);
    reverse.reverse();
    return reverse;
  }
}
function makeGreetingBubble(scene){
  // One reusable camera-facing speech sprite for greetings. It does not
  // allocate a texture for each coworker in a 150-person event.
  const canvas=document.createElement("canvas");canvas.width=240;canvas.height=96;
  const context=canvas.getContext("2d");
  context.fillStyle="#fff8e9";context.fillRect(12,10,216,67);
  context.lineWidth=5;context.strokeStyle="#ba7d91";
  context.strokeRect(12,10,216,67);
  context.font="bold 35px sans-serif";context.fillStyle="#65425d";
  context.textAlign="center";context.textBaseline="middle";
  context.fillText("Hello! 👋",120,43);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,
    depthTest:false,depthWrite:false});
  const sprite=new THREE.Sprite(material);
  sprite.scale.set(1.55,.62,1);sprite.renderOrder=15;sprite.visible=false;
  scene.add(sprite);
  return {sprite,material,texture,target:null,until:0,
    say(person,text,time){
      this.target=person?.detailed?.group||person?.group||null;
      this.until=time+2.35;
      sprite.visible=!!this.target;
    },
    update(time){
      sprite.visible=!!this.target&&time<this.until;
      if(sprite.visible){
        sprite.position.copy(this.target.position);
        sprite.position.y+=3.16;
      }
    },
    dispose(){scene.remove(sprite);texture.dispose();material.dispose();}
  };
}
function spot(scene){
  const group=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.29,.028,6,28),new THREE.MeshBasicMaterial({color:0xf8c874,transparent:true,opacity:.92}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.055;group.add(ring);
  const inner=new THREE.Mesh(new THREE.RingGeometry(.04,.14,26),new THREE.MeshBasicMaterial({color:0xfff1c4,transparent:true,opacity:.8,side:THREE.DoubleSide}));
  inner.rotation.x=-Math.PI/2;inner.position.y=.055;group.add(inner);
  group.visible=false;scene.add(group);return {group,ring};
}
function makeCamera(scene,renderer){
  const camera=new THREE.PerspectiveCamera(43,1,.06,400);
  camera.position.set(4.0,8.2,16);
  return camera;
}
export function mountOffice(host,profile,notice=()=>{}){
  if(!host)throw Error("Office canvas container was not found.");
  const size=()=>({w:Math.max(1,host.clientWidth),h:Math.max(1,host.clientHeight)});
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  // Balanced storybook lighting: readable characters, nuanced shadow depth,
  // saturated Christmas installations and genuinely warm festive highlights.
  renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xe5e5df);
  scene.fog=new THREE.Fog(0xe8e4dc,55,165);
  // Larger tonal separation than the original almost-flat flood lighting.
  scene.add(new THREE.HemisphereLight(0xf7efe7,0xa8a29a,1.46));
  const coolFill=new THREE.DirectionalLight(0x9ccee2,.72);
  coolFill.position.set(8,8,5);scene.add(coolFill);
  const sun=new THREE.DirectionalLight(0xffd4a1,2.22);
  sun.position.set(-7,12,-5);sun.target.position.set(0,0,9);
  const warmRim=new THREE.DirectionalLight(0xffcfa2,.45);
  warmRim.position.set(2,5,22);scene.add(warmRim);
  sun.castShadow=true;
  sun.shadow.mapSize.set(window.innerWidth<760?1024:2048,window.innerWidth<760?1024:2048);
  sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=70;
  sun.shadow.bias=-.0007;
  sun.shadow.normalBias=.024;
  scene.add(sun,sun.target);
  const camera=makeCamera(scene,renderer);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let office,nav,hero,markers,currentProfile,people=[],mode="wide",path=[],clock=new THREE.Clock(),
      running=true,paused=false,lastRefresh=0,requestId=0,selectedAction="hi",interactTarget=null;
  let cameraYaw=AFTER_OVERVIEW.yaw,
      cameraPitch=MODES.wide.pitch,targetCameraPitch=MODES.wide.pitch;
  let zoom=1,manualOrbit=false,cameraTravelEnabled=false;
  const lookAtPoint=new THREE.Vector3(0,1,0);
  const touchPointers=new Map();
  let pointerDownPoint=null,pointerDragged=false,pointerHadMultiTouch=false,pinchDistance=0;
  const clickMarker=spot(scene);
  const speech=makeGreetingBubble(scene);
  let officeLife=null;
  function applyProfile(next){
    officeLife?.dispose();officeLife=null;
    const oldPos=hero?hero.group.position.clone():null;
    currentProfile=next;
    // Stable roster-index seating; filtering out the viewer must never shift
    // other colleagues' physical workstations or their hint objects.
    const allMembers=(next?.colleagues||[]).slice(0,150);
    const roster=allMembers.map((p,index)=>({
      ...p,seatIndex:Number.isInteger(p.officeSeat)?p.officeSeat:index
    })).filter(p=>p.id!==next?.me?.id);
    // Empty desk slots left by deleted participants stay empty: no colleague
    // moves and previously issued physical-desk clues remain truthful.
    const total=Math.max(1,...allMembers.map((p,i)=>
      (Number.isInteger(p.officeSeat)?p.officeSeat:i)+1));
    const newBays=Math.max(4,Math.ceil(total/3));
    if(!office || newBays!==office.bays){
      if(office)scene.remove(office.root);
      office=buildOffice(total);scene.add(office.root);
      nav=new Navigation(office);
    }
    // Every colleague is a fully sculpted, articulated avatar. No low-detail
    // substitutes, impostors, or distance-dependent replacement models.
    for(const item of people){
      if(item.detailed){
        scene.remove(item.detailed.group);
        releaseCharacterMaterials(item.detailed);
      }
    }
    people=[];
    if(!hero){
      hero=createAvatar(avatarFromPerson({...next.me,id:next.me.id||"player"}));
      hero.group.position.set(office.spawn.x,0,office.spawn.z);
      hero.group.rotation.y=Math.PI;
      scene.add(hero.group);
    }else{
      scene.remove(hero.group);
      hero=createAvatar(avatarFromPerson({...next.me,id:next.me.id||"player"}));
      hero.group.position.copy(oldPos||new THREE.Vector3(office.spawn.x,0,office.spawn.z));
      hero.group.position.x=clamp(hero.group.position.x,office.room.left+.4,office.room.right-.4);
      hero.group.position.z=clamp(hero.group.position.z,office.room.front+.4,office.room.back-.4);
      scene.add(hero.group);
    }
    roster.forEach((p,i)=>{
      const seat=office.seats[p.seatIndex]||office.seats[0];
      const appearance=avatarFromPerson({id:p.id||p.name,name:p.name,avatar:p.avatar},i);
      const detailed=createAvatar(appearance);
      detailed.group.position.set(seat.position.x,0,seat.position.z);
      detailed.group.rotation.y=seat.facing;
      detailed.seated=true;
      scene.add(detailed.group);
      people.push({id:p.id,name:p.name||"Colleague",seat,appearance,detailed});
    });
    officeLife=createOfficeLife(people,hero,nav,(person,text,time)=>{
      speech.say(person,text,time);
      if(text)notice("👋 "+(person.name||"Colleague")+": "+text);
    });
  }
  function setCamera(){
    // Older callers are supported, but no alternate preset is available.
    mode="wide";
    targetCameraPitch=MODES.wide.pitch;
    camera.fov=MODES.wide.fov;
    camera.updateProjectionMatrix();
  }
  function resetCameraOrbit(){
    cameraYaw=AFTER_OVERVIEW.yaw;
    manualOrbit=false;
    zoom=1;
    cameraTravelEnabled=false;
    targetCameraPitch=AFTER_OVERVIEW.pitch;
  }
  function updateCutawayWalls(){
    if(!office?.viewWalls)return;
    const {room,viewWalls}=office;
    // A wall obscuring the active camera is cut away as a complete unit.
    // There is no transparent/opaque bar switching and no flicker per fixture.
    viewWalls.west.visible=camera.position.x>room.left+.35;
    viewWalls.east.visible=camera.position.x<room.right-.35;
    viewWalls.north.visible=camera.position.z>room.front+.35;
    viewWalls.south.visible=camera.position.z<room.back-.35;
  }
  function cameraGoal(){
    // Keep the approved wide After-style composition, 12% closer and lower.
    // Larger offices extend that view without a separate camera preset.
    const extraBays=Math.max(0,office.bays-4);
    const distanceBase=AFTER_OVERVIEW.distance+extraBays*3.75;
    const portraitScale=camera.aspect<.70?1.17:1;
    const distance=distanceBase*zoom*portraitScale;
    const focus=new THREE.Vector3(
      AFTER_OVERVIEW.focusX,
      AFTER_OVERVIEW.focusY,
      AFTER_OVERVIEW.focusZ+extraBays*3.4
    );
    // Stay in the broad office composition when it first opens. Once the
    // player chooses a distant walking destination, pan the same overview
    // only enough to retain visibility of their character.
    if(cameraTravelEnabled&&hero){
      const dx=hero.group.position.x-focus.x;
      const dz=hero.group.position.z-focus.z;
      const marginX=camera.aspect<.70?4.5:6.5;
      const marginZ=camera.aspect<.70?8.5:12;
      focus.x+=Math.sign(dx)*Math.max(0,Math.abs(dx)-marginX)*.82;
      focus.z+=Math.sign(dz)*Math.max(0,Math.abs(dz)-marginZ)*.82;
    }
    const cos=Math.cos(cameraPitch);
    return {
      focus,
      position:new THREE.Vector3(
        focus.x+Math.sin(cameraYaw)*distance*cos,
        focus.y+Math.sin(cameraPitch)*distance,
        focus.z+Math.cos(cameraYaw)*distance*cos
      )
    };
  }
  function moveTo(x,z){
    const target={x,z};
    const next=nav.find({x:hero.group.position.x,z:hero.group.position.z},target);
    if(!next.length){notice("That spot isn't reachable. Try another place on the floor.");return;}
    path=next;
    cameraTravelEnabled=true;
    clickMarker.group.visible=true;clickMarker.group.position.set(next.at(-1).x,0,next.at(-1).z);
    interactTarget=null;
  }
  function handleTap(evt){
    if(!hero||!office||paused)return;
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=((evt.clientX-rect.left)/rect.width)*2-1;
    const y=-((evt.clientY-rect.top)/rect.height)*2+1;
    pointer.set(x,y);ray.setFromCamera(pointer,camera);
    // Coworker hits use an avatar-sized selection radius.
    let hit=null,best=Infinity;
    for(const p of people){
      const position=p.detailed.group.position;
      const center=new THREE.Vector3(position.x,1.48,position.z);
      const depth=ray.ray.origin.distanceTo(center);
      if(ray.ray.distanceToPoint(center)<.65&&depth<best){hit=p;best=depth;}
    }
    if(hit){
      const time=clock.elapsedTime;
      const target=hit.detailed.group.position,origin=hero.group.position;
      officeLife?.reserveForPlayer(hit,time);
      const distance=Math.hypot(target.x-origin.x,target.z-origin.z);
      if(distance<2.0){
        path=[];interactTarget=null;
        hero.play("hi",time);
        officeLife?.interruptForHero(hit,"hi",time);
        return;
      }
      const approach=officeLife?.findApproach(origin,target,hero,1.65);
      if(approach?.path?.length){
        path=approach.path;interactTarget=hit;
        cameraTravelEnabled=true;
        clickMarker.group.visible=true;
        clickMarker.group.position.set(approach.end.x,0,approach.end.z);
        notice("Going to greet "+hit.name);
      }else{
        interactTarget=null;
        notice("Can't approach "+hit.name+" safely from here.");
      }
      return;
    }
    const point=new THREE.Vector3();
    if(ray.ray.intersectPlane(ground,point)&&
       point.x>=office.room.left&&point.x<=office.room.right&&
       point.z>=office.room.front&&point.z<=office.room.back){
      moveTo(point.x,point.z);
    }
  }
  // One finger/mouse drag rotates camera, vertical drag tilts it.
  // A short undragged tap walks. Two fingers pinch to zoom. No joystick/HUD.
  const canvas=renderer.domElement;
  function down(evt){
    if(paused||evt.button!==undefined&&evt.button!==0)return;
    touchPointers.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
    if(touchPointers.size===1){
      pointerDownPoint={id:evt.pointerId,x:evt.clientX,y:evt.clientY,
        when:performance.now()};
      pointerDragged=false;pointerHadMultiTouch=false;
    }else{
      pointerHadMultiTouch=true;pointerDragged=true;pointerDownPoint=null;
      const ps=[...touchPointers.values()];
      pinchDistance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)||1;
    }
    try{canvas.setPointerCapture(evt.pointerId)}catch{}
  }
  function move(evt){
    if(!touchPointers.has(evt.pointerId))return;
    const prev=touchPointers.get(evt.pointerId);
    const dx=evt.clientX-prev.x,dy=evt.clientY-prev.y;
    touchPointers.set(evt.pointerId,{x:evt.clientX,y:evt.clientY});
    if(touchPointers.size>=2){
      const ps=[...touchPointers.values()];
      const nextDistance=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)||1;
      zoom=clamp(zoom*pinchDistance/nextDistance,.60,1.75);
      pinchDistance=nextDistance;
      pointerHadMultiTouch=true;pointerDragged=true;return;
    }
    if(pointerDownPoint&&
       Math.hypot(evt.clientX-pointerDownPoint.x,evt.clientY-pointerDownPoint.y)>7){
      pointerDragged=true;
    }
    if(!pointerDragged)return;
    cameraYaw-=dx*.0075;
    targetCameraPitch=clamp(targetCameraPitch+dy*.0058,.34,1.31);
    manualOrbit=true;
  }
  function up(evt){
    const tracked=touchPointers.has(evt.pointerId);
    touchPointers.delete(evt.pointerId);
    if(!tracked)return;
    const qualifies=pointerDownPoint?.id===evt.pointerId&&
      !pointerDragged&&!pointerHadMultiTouch&&
      Math.hypot(evt.clientX-pointerDownPoint.x,evt.clientY-pointerDownPoint.y)<9;
    if(touchPointers.size===0){
      if(qualifies)handleTap(evt);
      pointerDownPoint=null;pinchDistance=0;
      pointerDragged=false;pointerHadMultiTouch=false;
    }else if(touchPointers.size===1){
      pointerDownPoint=null;pointerDragged=true;pointerHadMultiTouch=true;
    }
  }
  function cancel(evt){touchPointers.delete(evt.pointerId);pointerDownPoint=null;
    pointerDragged=true;pointerHadMultiTouch=true;}
  function wheel(evt){
    if(paused)return;
    evt.preventDefault();
    zoom=clamp(zoom*Math.exp(evt.deltaY*.0011),.60,1.75);
  }
  canvas.addEventListener("pointerdown",down);
  canvas.addEventListener("pointermove",move);
  canvas.addEventListener("pointerup",up);
  canvas.addEventListener("pointercancel",cancel);
  canvas.addEventListener("wheel",wheel,{passive:false});
  canvas.addEventListener("contextmenu",e=>e.preventDefault());
  canvas.style.touchAction="none";
  host.replaceChildren(renderer.domElement);
  // Stable CSS-pixel viewport, independent of phone browser toolbar motion.
  // Set DPR BEFORE setSize: doing it afterward leaves the framebuffer sized
  // for the previous DPR until a second layout and can shift gameplay.
  let lastWidth=0,lastHeight=0,lastDpr=0;
  const resize=()=>{
    const {w,h}=size();
    const width=Math.max(1,Math.round(w)),height=Math.max(1,Math.round(h));
    const mobile=window.matchMedia("(pointer:coarse)").matches||width<700;
    const dpr=Math.min(window.devicePixelRatio||1,mobile?1.25:1.5);
    if(width===lastWidth&&height===lastHeight&&dpr===lastDpr)return;
    lastWidth=width;lastHeight=height;lastDpr=dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  };
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(resize):null;
  observer?.observe(host);
  window.addEventListener("resize",resize);
  applyProfile(profile);resize();
  const start=clock.getElapsedTime();
  function render(){
    if(!running)return;
    requestId=requestAnimationFrame(render);
    const dt=Math.min(clock.getDelta(),.06),elapsed=clock.elapsedTime;
    // Character studio has its own renderer; avoid double WebGL work behind Pause.
    if(paused)return;
    if(hero){
      let moving=false;
      while(path.length){
        const goal=path[0];
        const dx=goal.x-hero.group.position.x,dz=goal.z-hero.group.position.z;
        const len=Math.hypot(dx,dz);
        if(len<.12){path.shift();continue;}
        const step=Math.min(len,dt*2.8);
        const proposedX=hero.group.position.x+dx/len*step;
        const proposedZ=hero.group.position.z+dz/len*step;
        const tooClose=people.some(p=>{
          const n=p.detailed.group.position;
          return Math.hypot(n.x-proposedX,n.z-proposedZ)<.91;
        });
        if(tooClose){
          // Never walk through a colleague. End within a safe social
          // radius of a greeting target, or stop before a moving NPC.
          path=[];clickMarker.group.visible=false;
          if(!interactTarget)notice("A colleague is passing. Try another path.");
          break;
        }
        hero.group.position.x=proposedX;
        hero.group.position.z=proposedZ;
        const desired=Math.atan2(dx,dz);
        hero.group.rotation.y+=Math.atan2(
          Math.sin(desired-hero.group.rotation.y),
          Math.cos(desired-hero.group.rotation.y))*Math.min(1,dt*10);
        moving=true;break;
      }
      if(interactTarget){
        const other=interactTarget.detailed.group.position;
        const distance=Math.hypot(
          other.x-hero.group.position.x,other.z-hero.group.position.z);
        // The social exchange happens only once everyone has stopped
        // at least one full body width away from the other character.
        if(distance<=2.05&&distance>=.91){
          path=[];clickMarker.group.visible=false;
          hero.play("hi",elapsed);
          officeLife?.interruptForHero(interactTarget,"hi",elapsed);
          interactTarget=null;moving=false;
        }else if(!moving&&!path.length){
          interactTarget=null;
        }
      }
      hero.update(elapsed,moving);
      officeLife?.update(elapsed,dt);
      speech.update(elapsed);
      cameraPitch+=(targetCameraPitch-cameraPitch)*Math.min(1,dt*10);
      const goal=cameraGoal();
      camera.position.lerp(goal.position,Math.min(1,dt*10));
      lookAtPoint.lerp(goal.focus,Math.min(1,dt*12));
      camera.lookAt(lookAtPoint);
      updateCutawayWalls();
    }
    if(clickMarker.group.visible){
      clickMarker.ring.rotation.z+=dt*.55;
      clickMarker.group.scale.setScalar(.94+Math.sin(elapsed*4)*.065);
      if(path.length===0)clickMarker.group.visible=false;
    }
    for(let i=0;i<office.twinkle.length;i++){
      office.twinkle[i].material.emissiveIntensity=.72+Math.sin(elapsed*2.5+i*1.8)*.35;
    }
    renderer.render(scene,camera);
  }
  // Open in the approved wide office composition, now modestly closer.
  if(hero){
    cameraPitch=targetCameraPitch=MODES[mode].pitch;
    const goal=cameraGoal();
    camera.position.copy(goal.position);
    lookAtPoint.copy(goal.focus);
    camera.lookAt(lookAtPoint);
    updateCutawayWalls();
  }
  setCamera();render();
  return {
    get mode(){return mode;},
    setCamera,
    resetCameraOrbit,
    setPaused(value){paused=!!value;},
    setProfile:applyProfile,
    getAvatar(){return hero?{...hero.parameters}:null;},
    setBodyShape(height,build){hero?.setBodyShape(height,build);},
    previewAvatar(appearance){
      if(!hero||!appearance)return false;
      const previous=hero;
      const lastPosition=previous.group.position.clone();
      const lastRotation=previous.group.rotation.y;
      const next=createAvatar(appearance);
      next.group.position.copy(lastPosition);
      next.group.rotation.y=lastRotation;
      scene.remove(previous.group);
      scene.add(next.group);
      // The geometries are shared/cacheable across avatars; dispose only each
      // old per-character material after the preview geometry is replaced.
      const materials=new Set();
      previous.group.traverse(obj=>{
        if(obj.isMesh){
          const values=Array.isArray(obj.material)?obj.material:[obj.material];
          values.forEach(m=>{if(m&&!m.userData?.sharedVoxelMaterial)materials.add(m);});
        }
      });
      for(const material of materials)material.dispose();
      hero=next;
      path=[];interactTarget=null;clickMarker.group.visible=false;
      return true;
    },
    focusAvatar(){
      if(!hero)return;
      setCamera();
      // Rotate towards the active camera only while inspecting the appearance.
      const dx=camera.position.x-hero.group.position.x;
      const dz=camera.position.z-hero.group.position.z;
      hero.group.rotation.y=Math.atan2(dx,dz);
    },
    playAction(name){
      if(!hero||!["hi","dance","clap","cheer"].includes(name))return false;
      // Perform immediately: clearing movement makes the selected animation
      // visible rather than being masked by walk motion.
      path=[];
      interactTarget=null;
      clickMarker.group.visible=false;
      hero.play(name,clock.elapsedTime);
      const responder=officeLife?.mimicNearby(name,clock.elapsedTime,5.4);
      selectedAction=name;
      const messages={hi:"👋 Hello!",dance:"🕺 Time for a little dance!",clap:"👏 A round of applause!",cheer:"🎉 Merry Christmas!"};
      notice(responder?messages[name]+" "+responder.name+" and coworkers respond!":
        messages[name]+" Move closer to a coworker to get a response.");
      return true;
    },
    goHome(){
      if(hero)moveTo(office.spawn.x,office.spawn.z);
    },
    dispose(){
      officeLife?.dispose();officeLife=null;
      speech.dispose();
      running=false;cancelAnimationFrame(requestId);observer?.disconnect();
      window.removeEventListener("resize",resize);
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);
      canvas.removeEventListener("pointercancel",cancel);
      canvas.removeEventListener("wheel",wheel);
      for(const p of people)if(p.detailed)releaseCharacterMaterials(p.detailed);
      renderer.dispose();host.replaceChildren();
    }
  };
}