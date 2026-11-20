import * as THREE from "three";
import {buildOffice} from "./office.js?v=celebration-richness-v3";
import {createAvatar,avatarFromPerson} from "./avatar.js?v=celebration-richness-v3";

/* A responsive office runtime. 3D art and camera are independent from the existing Supabase UI. */
const UP=new THREE.Vector3(0,1,0);
// Camera stands near the window looking SOUTH toward the decorated stage.
// Previous positive-z follow camera looked north, hiding the entire celebration.
const MODES={
  three:{offset:[3.2,7.0,-5.25],look:[-1.25,1.10,5.7],fov:47},
  close:{offset:[1.70,3.65,-3.15],look:[-.50,1.25,2.4],fov:49},
  wide:{offset:[1.5,13.6,-6.25],look:[-1.3,.6,8.1],fov:45}
};
const TWO_PI=Math.PI*2;
function v2(x,z){return {x,z};}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function greetObject(name){return "👋 "+name;}
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
function spot(scene){
  const group=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.29,.028,6,28),new THREE.MeshBasicMaterial({color:0xf8c874,transparent:true,opacity:.92}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.055;group.add(ring);
  const inner=new THREE.Mesh(new THREE.RingGeometry(.04,.14,26),new THREE.MeshBasicMaterial({color:0xfff1c4,transparent:true,opacity:.8,side:THREE.DoubleSide}));
  inner.rotation.x=-Math.PI/2;inner.position.y=.055;group.add(inner);
  group.visible=false;scene.add(group);return {group,ring};
}
function fallbackAvatar(parent,x,z,heading,color){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=heading;parent.add(g);
  const make=(w,h,d,c,px,py,pz)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:.8}));
    m.position.set(px,py,pz);g.add(m);
  };
  make(.53,.55,.34,color,0,1.04,0);
  make(.54,.5,.48,0xb78768,0,1.62,.02);
  make(.61,.15,.50,0x30252b,0,1.92,.02);
  make(.25,.42,.29,0x3d4653,-.13,.56,0);
  make(.25,.42,.29,0x3d4653,.13,.56,0);
  make(.14,.42,.22,0xb78768,-.34,1.04,0);
  make(.14,.42,.22,0xb78768,.34,1.04,0);
  return g;
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
  renderer.toneMappingExposure=1.22;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xc7dfe9);
  scene.fog=new THREE.Fog(0xd2d8d8,38,115);
  scene.add(new THREE.HemisphereLight(0xd9ecff,0xefd1bc,2.35));
  const sun=new THREE.DirectionalLight(0xffe5cb,3.1);
  sun.position.set(-5,11,-6);sun.target.position.set(0,0,9);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-18;sun.shadow.camera.right=18;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;
  sun.shadow.camera.near=.5;sun.shadow.camera.far=70;
  sun.shadow.bias=-.001;
  scene.add(sun,sun.target);
  const camera=makeCamera(scene,renderer);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  let office,nav,hero,markers,currentProfile,people=[],mode="three",path=[],clock=new THREE.Clock(),
      running=true,paused=false,lastRefresh=0,requestId=0,selectedAction="hi",interactTarget=null;
  const clickMarker=spot(scene);
  function applyProfile(next){
    const oldPos=hero?hero.group.position.clone():null;
    currentProfile=next;
    const roster=(next?.colleagues||[]).filter(p=>p.id!==next?.me?.id).slice(0,149);
    const total=Math.max(1,roster.length+1);
    const newBays=Math.max(4,Math.ceil(total/3));
    if(!office || newBays!==office.bays){
      if(office)scene.remove(office.root);
      office=buildOffice(total);scene.add(office.root);
      nav=new Navigation(office);
    }
    // Remove old NPC groups before updating the roster (never remove the Scene itself).
    for(const item of people){
      if(item.detailed)scene.remove(item.detailed.group);
      if(item.placeholder)scene.remove(item.placeholder);
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
      const seat=office.seats[i+1]||office.seats[0];
      const ap=avatarFromPerson({id:p.id||p.name,name:p.name,avatar:p.avatar},i);
      const placeholder=fallbackAvatar(scene,seat.position.x,seat.position.z,seat.facing,[0x7f8e9e,0x598e7c,0xd37b6e,0xb69b62][i%4]);
      people.push({id:p.id,name:p.name||"Colleague",seat,appearance:ap,placeholder,detailed:null});
    });
    refreshNpcs();
  }
  function refreshNpcs(){
    if(!hero)return;
    const x=hero.group.position.x,z=hero.group.position.z;
    const distance=people.map((p,i)=>({p,i,d:(p.seat.position.x-x)**2+(p.seat.position.z-z)**2})).sort((a,b)=>a.d-b.d);
    const active=new Set(distance.slice(0,Math.min(20,people.length)).map(s=>s.i));
    people.forEach((p,i)=>{
      const yes=active.has(i);
      p.placeholder.visible=!yes;
      if(yes&&!p.detailed){
        p.detailed=createAvatar(p.appearance);
        p.detailed.group.position.set(p.seat.position.x,0,p.seat.position.z);
        p.detailed.group.rotation.y=p.seat.facing;
        p.detailed.seated=true;
        scene.add(p.detailed.group);
      }
      if(p.detailed)p.detailed.group.visible=yes;
    });
  }
  function setCamera(id){
    if(!MODES[id])return;
    mode=id;
    camera.fov=MODES[id].fov;camera.updateProjectionMatrix();
  }
  function moveTo(x,z){
    const target={x,z};
    const next=nav.find({x:hero.group.position.x,z:hero.group.position.z},target);
    if(!next.length){notice("That spot isn't reachable. Try another place on the floor.");return;}
    path=next;
    clickMarker.group.visible=true;clickMarker.group.position.set(next.at(-1).x,0,next.at(-1).z);
    interactTarget=null;
  }
  function handlePointer(evt){
    if(evt.button!==undefined&&evt.button!==0)return;
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=((evt.clientX-rect.left)/rect.width)*2-1,y=-((evt.clientY-rect.top)/rect.height)*2+1;
    pointer.set(x,y);ray.setFromCamera(pointer,camera);
    // Select workers via their approximate head location; no chat UI, just an animated greeting.
    let hit=null,best=Infinity;
    for(const p of people){
      const center=new THREE.Vector3(p.seat.position.x,1.5,p.seat.position.z);
      const dist=ray.ray.distanceToPoint(center);
      const depth=ray.ray.origin.distanceTo(center);
      if(dist<.53&&depth<best){best=depth;hit=p;}
    }
    if(hit){
      const dest={x:hit.seat.position.x+(hit.seat.facing<0?.62:-.62),z:hit.seat.position.z+.62};
      const way=nav.find({x:hero.group.position.x,z:hero.group.position.z},dest);
      if(way.length)path=way;
      interactTarget=hit;
      notice("Going to greet "+hit.name);
      return;
    }
    const pos=new THREE.Vector3();
    if(ray.ray.intersectPlane(ground,pos) && pos.x>=office.room.left&&pos.x<=office.room.right &&
      pos.z>=office.room.front&&pos.z<=office.room.back)moveTo(pos.x,pos.z);
  }
  renderer.domElement.addEventListener("pointerup",handlePointer);
  renderer.domElement.addEventListener("contextmenu",e=>e.preventDefault());
  renderer.domElement.style.touchAction="none";
  host.replaceChildren(renderer.domElement);
  const resize=()=>{
    const {w,h}=size();
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    const mobile=w<680;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.25:1.5));
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
        if(len<.11){path.shift();continue;}
        const step=Math.min(len,dt*2.8);
        hero.group.position.x+=dx/len*step;
        hero.group.position.z+=dz/len*step;
        const desired=Math.atan2(dx,dz);
        hero.group.rotation.y+=Math.atan2(Math.sin(desired-hero.group.rotation.y),Math.cos(desired-hero.group.rotation.y))*Math.min(1,dt*10);
        moving=true;break;
      }
      if(!moving&&interactTarget){
        hero.play("hi",elapsed);notice(greetObject(interactTarget.name));
        interactTarget.detailed?.play("hi",elapsed);interactTarget=null;
      }
      hero.update(elapsed,moving);
      if(elapsed-lastRefresh>.9){lastRefresh=elapsed;refreshNpcs();}
      for(const p of people){
        if(p.detailed?.group.visible)p.detailed.update(elapsed,false);
      }
      const cfg=MODES[mode],offset=new THREE.Vector3(...cfg.offset);
      const target=hero.group.position.clone();
      const aspectFactor=clamp(camera.aspect,.62,1.8);
      if(camera.aspect<.75){offset.z+=.45;offset.y+=1.65;offset.x-=1.25;}
      if(mode==="wide"&&office.bays>13)offset.y+=Math.min(7,office.bays*.17);
      const desired=target.clone().add(offset);
      camera.position.lerp(desired,Math.min(1,dt*4.3));
      const look=target.clone().add(new THREE.Vector3(...cfg.look));
      const lookPosition=new THREE.Vector3();
      camera.getWorldDirection(lookPosition);
      const goalView=new THREE.Vector3().subVectors(look,camera.position).normalize();
      const newLook=lookPosition.lerp(goalView,Math.min(1,dt*3.3));
      camera.lookAt(camera.position.clone().add(newLook));
      // Camera-safe roof decorations: hide only fixtures directly between the
      // active camera and the avatar. Restore them when the sightline clears.
      const sight=target.clone().add(new THREE.Vector3(0,1.25,0)).sub(camera.position);
      const lengthSquared=sight.lengthSq();
      for(const fixture of office.overhead||[]){
        const point=new THREE.Vector3(fixture.x,fixture.y,fixture.z);
        const rel=point.sub(camera.position);
        const t=lengthSquared>0?Math.max(0,Math.min(1,rel.dot(sight)/lengthSquared)):0;
        const projection=sight.clone().multiplyScalar(t);
        const distance=rel.sub(projection).length();
        fixture.object.visible=!(t>.07&&t<.91&&distance<fixture.radius);
      }
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
  // Establish the correct first frame immediately, without an initial
  // north-facing camera swing through the window and nearby walls.
  if(hero){
    camera.position.copy(hero.group.position).add(new THREE.Vector3(...MODES.three.offset));
    camera.lookAt(hero.group.position.clone().add(new THREE.Vector3(...MODES.three.look)));
  }
  const prevMode=mode;setCamera(prevMode);render();
  return {
    get mode(){return mode;},
    setCamera,
    setPaused(value){paused=!!value;},
    setProfile:applyProfile,
    getAvatar(){return hero?{...hero.parameters}:null;},
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
          values.forEach(m=>{if(m)materials.add(m);});
        }
      });
      for(const material of materials)material.dispose();
      hero=next;
      path=[];interactTarget=null;clickMarker.group.visible=false;
      return true;
    },
    focusAvatar(){
      if(!hero)return;
      setCamera("close");
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
      selectedAction=name;
      const messages={hi:"👋 Hello!",dance:"🕺 Time for a little dance!",clap:"👏 A round of applause!",cheer:"🎉 Merry Christmas!"};
      notice(messages[name]);
      return true;
    },
    goHome(){
      if(hero)moveTo(office.spawn.x,office.spawn.z);
    },
    dispose(){
      running=false;cancelAnimationFrame(requestId);observer?.disconnect();
      window.removeEventListener("resize",resize);
      renderer.domElement.removeEventListener("pointerup",handlePointer);
      renderer.dispose();host.replaceChildren();
    }
  };
}