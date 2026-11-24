import * as THREE from "three";
import {buildOffice,deskClueForSeat,CLUE_PROPS,decorateClueDesk} from "./office.js?v=gameplay-v2";
import {createAvatar,avatarFromPerson} from "./avatar.js?v=face-refine-v4-studio-qa-v1";
import {createOfficeLife} from "./office-life.js?v=studio-qa-v1";
import {playFestiveChime} from "./christmas-music.js?v=jingle-bells-v1";

/* A responsive office runtime. 3D art and camera are independent from the existing Supabase UI. */
const UP=new THREE.Vector3(0,1,0);
// Keep the elevated orbit, but center the actively controlled avatar rather
// than the middle of the potentially long office. It never loses its subject.
const PLAYER_CAMERA=Object.freeze({
  yaw:2.63,pitch:.60,distance:11.8,focusHeight:1.32,fov:50
});
const MODES={wide:{distance:PLAYER_CAMERA.distance,
  pitch:PLAYER_CAMERA.pitch,fov:PLAYER_CAMERA.fov}};
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
  function draw(text){
    // Repaint the same texture with a short greeting, without allocating
    // separate canvases for every colleague.
    const phrase=String(text||"Hello!").slice(0,36);
    context.clearRect(0,0,240,96);
    context.fillStyle="#fff8e9";context.fillRect(12,10,216,67);
    context.lineWidth=4;context.strokeStyle="#ba7d91";
    context.strokeRect(12,10,216,67);
    context.fillStyle="#65425d";
    context.textAlign="center";context.textBaseline="middle";
    context.font="bold 26px sans-serif";
    while(context.measureText(phrase).width>193&&
          Number.parseInt(context.font,10)>16){
      context.font="bold "+(Number.parseInt(context.font,10)-1)+"px sans-serif";
    }
    context.fillText(phrase,120,44,196);
  }
  draw("Hello!");
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
      draw(text);
      texture.needsUpdate=true;
      this.until=time+1.8;
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
  scene.background=new THREE.Color(0xe2e7ec);
  scene.fog=new THREE.Fog(0xe5eaee,55,165);
  // Indoor office balanced lighting: natural window sunlight by day,
  // cozy warm fluorescents, desk lamps, and glowing Christmas lights by night.
  const hemiLight=new THREE.HemisphereLight(0xfdf8f2,0xaeb2b8,1.45);
  scene.add(hemiLight);
  const coolFill=new THREE.DirectionalLight(0xa8d2e8,.70);
  coolFill.position.set(8,8,5);scene.add(coolFill);
  const sun=new THREE.DirectionalLight(0xfff2dc,2.20);
  sun.position.set(-7,12,-5);sun.target.position.set(0,0,9);
  const warmRim=new THREE.DirectionalLight(0xffdfbe,.40);
  warmRim.position.set(2,5,22);scene.add(warmRim);

  // Indoor office warm ambient & party lights for evening and night
  const aisleWarmLight=new THREE.PointLight(0xffb85c,0.15,24,1.2);
  aisleWarmLight.position.set(-0.8,3.4,8.0);
  scene.add(aisleWarmLight);

  const stagePartyLight=new THREE.PointLight(0xff8c44,0.25,28,1.1);
  stagePartyLight.position.set(-1.0,3.8,24.0);
  scene.add(stagePartyLight);

  const treeWarmLight=new THREE.PointLight(0xffc866,0.20,18,1.2);
  treeWarmLight.position.set(6.45,2.4,4.75);
  scene.add(treeWarmLight);

  const TIME_THEMES={
    day:{
      name:"Office Day",icon:"☀️",
      bg:0xe2e7ec,fog:0xe5eaee,
      hemiSky:0xfdf8f2,hemiGround:0xaeb2b8,hemiInt:1.45,
      sunColor:0xfff2dc,sunInt:2.20,
      fillColor:0xa8d2e8,fillInt:0.70,
      rimColor:0xffdfbe,rimInt:0.40,
      aisleInt:0.15,stageInt:0.25,treeInt:0.20,
      twinkleScale:0.65
    },
    evening:{
      name:"Dim Evening",icon:"🌇",
      bg:0x222a36,fog:0x283240,
      hemiSky:0xffd2a0,hemiGround:0x2c2622,hemiInt:1.05,
      sunColor:0xff8844,sunInt:1.20,
      fillColor:0xcc6688,fillInt:0.55,
      rimColor:0xffaa55,rimInt:0.85,
      aisleInt:1.45,stageInt:2.10,treeInt:1.35,
      twinkleScale:1.85
    },
    night:{
      name:"Christmas Night",icon:"🎄",
      bg:0x141a24,fog:0x18202c,
      hemiSky:0xffbe7a,hemiGround:0x1b1612,hemiInt:0.88,
      sunColor:0x48648c,sunInt:0.40,
      fillColor:0x3a2840,fillInt:0.45,
      rimColor:0xff9944,rimInt:1.15,
      aisleInt:2.35,stageInt:3.40,treeInt:2.25,
      twinkleScale:2.75
    }
  };
  const THEME_KEYS=["auto","day","evening","night"];
  let timeThemeMode="auto";
  let activeTwinkleScale=1.0;

  function getSystemTimeThemeKey(){
    const h=new Date().getHours();
    if(h>=7&&h<17)return "day";
    if(h>=17&&h<20)return "evening";
    return "night";
  }

  function applyTimeTheme(mode=timeThemeMode){
    timeThemeMode=mode;
    const effectiveKey=(mode==="auto")?getSystemTimeThemeKey():mode;
    const theme=TIME_THEMES[effectiveKey]||TIME_THEMES.day;

    scene.background.setHex(theme.bg);
    scene.fog.color.setHex(theme.fog);
    hemiLight.color.setHex(theme.hemiSky);
    hemiLight.groundColor.setHex(theme.hemiGround);
    hemiLight.intensity=theme.hemiInt;
    sun.color.setHex(theme.sunColor);
    sun.intensity=theme.sunInt;
    coolFill.color.setHex(theme.fillColor);
    coolFill.intensity=theme.fillInt;
    warmRim.color.setHex(theme.rimColor);
    warmRim.intensity=theme.rimInt;

    aisleWarmLight.intensity=theme.aisleInt;
    stagePartyLight.intensity=theme.stageInt;
    treeWarmLight.intensity=theme.treeInt;
    activeTwinkleScale=theme.twinkleScale||1.0;

    const btn=document.getElementById("hud-btn-time");
    if(btn){
      btn.innerHTML=`${theme.icon} <span>${theme.name}${mode==="auto"?" (Auto)":""}</span>`;
      btn.title=`Office Lighting: ${theme.name}${mode==="auto"?" (Auto - from system clock)":""} - Click to toggle`;
    }
  }

  function cycleTimeTheme(){
    const idx=THEME_KEYS.indexOf(timeThemeMode);
    const nextKey=THEME_KEYS[(idx+1)%THEME_KEYS.length];
    applyTimeTheme(nextKey);
    const themeName=nextKey==="auto"?`Auto (${TIME_THEMES[getSystemTimeThemeKey()].name})`:TIME_THEMES[nextKey].name;
    notice(`Office theme: ${themeName}`);
  }

  applyTimeTheme("auto");

  const CLUE_INFO={
    "apple":{icon:"🍎",title:"Fresh Red Apple"},
    "coffee":{icon:"☕",title:"Hot Coffee Mug"},
    "mini-tree":{icon:"🎄",title:"Mini Christmas Tree"},
    "gift":{icon:"🎁",title:"Festive Gift Box"},
    "succulent":{icon:"🪴",title:"Desktop Succulent"},
    "ornament":{icon:"🔮",title:"Holiday Bauble"},
    "books":{icon:"📚",title:"Holiday Notebooks"},
    "lantern":{icon:"🏮",title:"Cozy Holiday Lantern"},
    "candy-cane":{icon:"🍬",title:"Peppermint Candy Cane"}
  };

  let officeDesks=[];
  let activeDesk=null;

  function drawNameplate(canvas,deskInfo){
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,512,160);

    const r=24;
    ctx.beginPath();
    ctx.moveTo(r,0);
    ctx.lineTo(512-r,0);
    ctx.quadraticCurveTo(512,0,512,r);
    ctx.lineTo(512,160-r);
    ctx.quadraticCurveTo(512,160,512-r,160);
    ctx.lineTo(r,160);
    ctx.quadraticCurveTo(0,160,0,160-r);
    ctx.lineTo(0,r);
    ctx.quadraticCurveTo(0,0,r,0);
    ctx.closePath();

    if(deskInfo.isMe){
      let custom={};
      try{custom=JSON.parse(localStorage.getItem("vcf_ss_desk_custom")||"{}");}catch{}
      const themeKey=custom.theme||"emerald";
      const mottoText=custom.motto?.trim()||"⭐ YOUR WORKSPACE";
      const showBadge=custom.showBadge!==false;
      const photoUrl=localStorage.getItem("vcf_ss_avatar_photo");

      const THEMES={
        emerald:{bg1:"#144534",bg2:"#0a281e",border:"#f2c886",sub:"#f5d796",text:"#ffffff"},
        crimson:{bg1:"#541221",bg2:"#25050c",border:"#f4c776",sub:"#fbd49b",text:"#ffffff"},
        frost:{bg1:"#16324a",bg2:"#0b1a26",border:"#92d8f0",sub:"#b2e3f5",text:"#f5fcff"},
        walnut:{bg1:"#3f2416",bg2:"#1d0e07",border:"#e3aa68",sub:"#f2c89b",text:"#fff8f0"},
        midnight:{bg1:"#12163b",bg2:"#060817",border:"#c4a4f8",sub:"#d9c2fa",text:"#fbf8ff"}
      };
      const th=THEMES[themeKey]||THEMES.emerald;

      const grad=ctx.createLinearGradient(0,0,512,160);
      grad.addColorStop(0,th.bg1);
      grad.addColorStop(1,th.bg2);
      ctx.fillStyle=grad;
      ctx.fill();
      ctx.lineWidth=8;
      ctx.strokeStyle=th.border;
      ctx.stroke();

      ctx.fillStyle=th.sub;
      ctx.font="bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const dispMotto=mottoText.length>28?mottoText.slice(0,26)+"…":mottoText;
      ctx.fillText(dispMotto,28,42);

      ctx.fillStyle=th.text;
      ctx.font="bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const maxChars=showBadge?13:17;
      const displayName=deskInfo.ownerName.length>maxChars?deskInfo.ownerName.slice(0,maxChars-1)+"…":deskInfo.ownerName;
      ctx.fillText(displayName,28,92);

      ctx.fillStyle=th.sub;
      ctx.font="500 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${deskInfo.code} · ${deskInfo.clueMeta.icon} ${deskInfo.clueMeta.title}`,28,132);

      if(showBadge){
        const bx=432,by=80,br=46;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx,by,br,0,Math.PI*2);
        ctx.closePath();
        ctx.clip();

        if(photoUrl){
          const img=new Image();
          img.onload=()=>{
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx,by,br,0,Math.PI*2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img,bx-br,by-br,br*2,br*2);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(bx,by,br,0,Math.PI*2);
            ctx.lineWidth=5;
            ctx.strokeStyle=th.border;
            ctx.stroke();

            if(deskInfo.texture)deskInfo.texture.needsUpdate=true;
          };
          img.src=photoUrl;
          if(img.complete&&img.naturalWidth>0){
            ctx.drawImage(img,bx-br,by-br,br*2,br*2);
          }
        }else{
          ctx.fillStyle="#1c3a2c";
          ctx.fillRect(bx-br,by-br,br*2,br*2);
          ctx.fillStyle="#fcd890";
          ctx.font="bold 28px sans-serif";
          ctx.textAlign="center";
          ctx.textBaseline="middle";
          const initial=(deskInfo.ownerName||"U").trim().charAt(0).toUpperCase();
          ctx.fillText("🎅 "+initial,bx,by);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(bx,by,br,0,Math.PI*2);
        ctx.lineWidth=5;
        ctx.strokeStyle=th.border;
        ctx.stroke();
      }
    }else if(deskInfo.ownerName){
      const grad=ctx.createLinearGradient(0,0,512,160);
      grad.addColorStop(0,"#192f42");
      grad.addColorStop(1,"#0f1d2a");
      ctx.fillStyle=grad;
      ctx.fill();
      ctx.lineWidth=6;
      ctx.strokeStyle="#4d7aa6";
      ctx.stroke();

      ctx.fillStyle="#8fb6dc";
      ctx.font="bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("💼 COLLEAGUE DESK",28,42);

      ctx.fillStyle="#f5f9fc";
      ctx.font="bold 38px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      const displayName=deskInfo.ownerName.length>18?deskInfo.ownerName.slice(0,16)+"…":deskInfo.ownerName;
      ctx.fillText(displayName,28,92);

      ctx.fillStyle="#bad2e8";
      ctx.font="500 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${deskInfo.code} · Clue: ${deskInfo.clueMeta.icon} ${deskInfo.clueMeta.title}`,28,132);
    }else{
      ctx.fillStyle="#222c36";
      ctx.fill();
      ctx.lineWidth=4;
      ctx.strokeStyle="#415161";
      ctx.stroke();

      ctx.fillStyle="#c5d2de";
      ctx.font="bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${deskInfo.code} · Open Desk`,28,76);

      ctx.fillStyle="#7b91a3";
      ctx.font="500 23px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("Hot Desk · Available",28,120);
    }
  }

  function buildDeskNameplate(deskInfo){
    const canvas=document.createElement("canvas");
    canvas.width=512;
    canvas.height=160;
    deskInfo.canvas=canvas;

    drawNameplate(canvas,deskInfo);

    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    deskInfo.texture=texture;

    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});
    deskInfo.material=material;

    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.02,0.32),material);

    const plateGroup=new THREE.Group();
    mesh.position.y=0.22;
    plateGroup.add(mesh);

    const postMat=new THREE.MeshStandardMaterial({
      color:deskInfo.isMe?0xcaa35a:0x4a5d70,
      metalness:0.6,
      roughness:0.3
    });
    const post=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.24,8),postMat);
    post.position.y=0.10;
    plateGroup.add(post);

    deskInfo.redraw=()=>{
      drawNameplate(canvas,deskInfo);
      texture.needsUpdate=true;
    };

    return {plateGroup,texture,material};
  }

  let seatedDesk=null;
  let targetSitDesk=null;

  function updateDeskUI(){
    const actionBtn=document.getElementById("desk-card-action");
    const deskBtn=document.getElementById("hud-btn-mydesk");
    if(deskBtn){
      if(hero?.seated){
        deskBtn.innerHTML=`🚶 <span>Stand Up</span>`;
        deskBtn.title="Stand up from desk (or press WASD / move joystick)";
      }else{
        deskBtn.innerHTML=`⭐ <span>My Desk</span>`;
        deskBtn.title="Walk to your assigned desk";
      }
    }
    if(actionBtn&&activeDesk){
      if(hero?.seated&&seatedDesk===activeDesk){
        actionBtn.textContent="Stand Up 🚶";
        actionBtn.classList.add("btn-seated");
      }else{
        actionBtn.classList.remove("btn-seated");
        if(activeDesk.isMe){
          actionBtn.textContent="Sit at Desk";
        }else if(activeDesk.ownerName){
          actionBtn.textContent="Say Hello 👋";
        }else{
          actionBtn.textContent="Sit Here";
        }
      }
    }
  }

  function sitAtDesk(desk){
    if(!desk||!hero)return;
    if(hero.seated&&seatedDesk===desk)return;
    if(hero.seated){
      standUp(false);
    }
    const seat=desk.seat;
    const curDist=Math.hypot(hero.group.position.x-seat.position.x,hero.group.position.z-seat.position.z);
    if(curDist<=2.4){
      performSit(desk);
      return;
    }
    targetSitDesk=desk;
    const approachX=seat.position.x+seat.chairSide*0.55;
    const approachZ=seat.position.z;
    moveTo(approachX,approachZ,true);
    notice(`Walking to ${desk.isMe?"your desk":desk.code}... ⭐`);
  }

  function performSit(desk){
    if(!desk||!hero)return;
    targetSitDesk=null;
    path=[];
    clickMarker.group.visible=false;
    const seat=desk.seat;
    hero.group.position.set(seat.position.x,0,seat.position.z);
    hero.group.rotation.y=seat.facing;
    hero.seated=true;
    hero.setActivity("typing");
    seatedDesk=desk;
    activeDesk=desk;
    updateDeskUI();
    const deskCard=document.getElementById("desk-card");
    if(deskCard){
      deskCard.classList.remove("hidden");
    }
    playFestiveChime("sit");
    if(desk.isMe){
      notice(`⭐ Seated at your desk (${desk.code})! Working & typing... 💻`);
    }else if(desk.ownerName){
      notice(`🪑 Visiting ${desk.ownerName}'s desk (${desk.code}) · Clue: ${desk.clueMeta.icon} ${desk.clueMeta.title}`);
    }else{
      notice(`🪑 Seated at desk ${desk.code}`);
    }
  }

  function standUp(notify=true){
    if(!hero||!hero.seated)return;
    targetSitDesk=null;
    if(seatedDesk){
      hero.group.position.x+=seatedDesk.seat.chairSide*0.55;
    }
    hero.seated=false;
    hero.setActivity("idle");
    const wasMe=seatedDesk?.isMe;
    seatedDesk=null;
    updateDeskUI();
    if(notify){
      notice(wasMe?"Stood up from your desk.":"Stood up from desk.");
    }
  }

  function goToDesk(){
    if(hero?.seated&&seatedDesk?.isMe){
      standUp(true);
      return;
    }
    const myDesk=officeDesks.find(d=>d.isMe);
    if(!myDesk){
      notice("Could not locate your desk.");
      return;
    }
    sitAtDesk(myDesk);
  }

  const myDeskBtn=document.getElementById("hud-btn-mydesk");
  const timeBtn=document.getElementById("hud-btn-time");
  const partyBtn=document.getElementById("hud-btn-party");
  const deskCardActionBtn=document.getElementById("desk-card-action");
  const deskCardCustomizeBtn=document.getElementById("desk-card-customize");

  function onMyDeskClick(){goToDesk();}
  function onTimeClick(){cycleTimeTheme();}
  function onPartyClick(){togglePartyMode();}
  function onDeskCardCustomizeClick(){
    const customizerDialog=document.getElementById("desk-customizer-dialog");
    if(customizerDialog){
      if(typeof customizerDialog.showModal==="function")customizerDialog.showModal();
      else customizerDialog.classList.remove("hidden");
    }
  }
  function onDeskCardActionClick(){
    if(!activeDesk)return;
    if(hero?.seated&&seatedDesk===activeDesk){
      standUp(true);
      return;
    }
    if(activeDesk.ownerName&&!activeDesk.isMe){
      hero.play("hi",clock.elapsedTime);
      notice(`👋 Saying hi at ${activeDesk.ownerName}'s desk!`);
      return;
    }
    performSit(activeDesk);
  }

  myDeskBtn?.addEventListener("click",onMyDeskClick);
  timeBtn?.addEventListener("click",onTimeClick);
  partyBtn?.addEventListener("click",onPartyClick);
  deskCardActionBtn?.addEventListener("click",onDeskCardActionClick);
  deskCardCustomizeBtn?.addEventListener("click",onDeskCardCustomizeClick);
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
  let cameraYaw=PLAYER_CAMERA.yaw,
      cameraPitch=MODES.wide.pitch,targetCameraPitch=MODES.wide.pitch;
  let zoom=1;
  const lookAtPoint=new THREE.Vector3(0,1,0);
  const touchPointers=new Map();
  let pointerDownPoint=null,pointerDragged=false,pointerHadMultiTouch=false,pinchDistance=0;
  const clickMarker=spot(scene);
  const speech=makeGreetingBubble(scene);
  let officeLife=null;

  function createConfetti(scene){
    const COUNT=280;
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(COUNT*3);
    const col=new Float32Array(COUNT*3);
    const vel=new Float32Array(COUNT*3);
    const PALETTE=[
      [0.90,0.15,0.25],
      [0.15,0.80,0.45],
      [1.00,0.85,0.30],
      [0.98,0.98,1.00],
      [0.30,0.70,0.98],
      [0.92,0.40,0.75]
    ];
    for(let i=0;i<COUNT;i++){
      pos[i*3]=(Math.random()-0.5)*18;
      pos[i*3+1]=Math.random()*5+0.5;
      pos[i*3+2]=(Math.random()-0.5)*18;
      const c=PALETTE[Math.floor(Math.random()*PALETTE.length)];
      col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];
      vel[i*3]=(Math.random()-0.5)*0.5;
      vel[i*3+1]=-0.55-Math.random()*0.75;
      vel[i*3+2]=(Math.random()-0.5)*0.5;
    }
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    geo.setAttribute("color",new THREE.BufferAttribute(col,3));

    const flakeCanvas=document.createElement("canvas");
    flakeCanvas.width=16;flakeCanvas.height=16;
    const fctx=flakeCanvas.getContext("2d");
    fctx.fillStyle="#ffffff";
    fctx.fillRect(1,1,14,14);
    const flakeTex=new THREE.CanvasTexture(flakeCanvas);

    const mat=new THREE.PointsMaterial({
      size:0.18,
      vertexColors:true,
      map:flakeTex,
      transparent:true,
      opacity:0.92,
      depthWrite:false
    });
    const points=new THREE.Points(geo,mat);
    points.visible=false;
    scene.add(points);

    let active=false;
    return {
      points,
      get active(){return active;},
      start(){active=true;points.visible=true;},
      stop(){active=false;points.visible=false;},
      toggle(){
        active=!active;
        points.visible=active;
        return active;
      },
      update(dt){
        if(!active)return;
        const p=geo.attributes.position.array;
        const now=Date.now()*0.0025;
        for(let i=0;i<COUNT;i++){
          p[i*3]+=vel[i*3]*dt+Math.sin(now+i)*0.003;
          p[i*3+1]+=vel[i*3+1]*dt;
          p[i*3+2]+=vel[i*3+2]*dt+Math.cos(now+i)*0.003;
          if(p[i*3+1]<0.12){
            p[i*3+1]=4.8+Math.random()*1.5;
            p[i*3]=(Math.random()-0.5)*18;
            p[i*3+2]=(Math.random()-0.5)*18;
          }
        }
        geo.attributes.position.needsUpdate=true;
      }
    };
  }

  const confettiSystem=createConfetti(scene);
  let partyModeActive=false;

  function togglePartyMode(){
    partyModeActive=confettiSystem.toggle();
    const btn=document.getElementById("hud-btn-party");
    if(btn){
      btn.classList.toggle("hud-pill-active",partyModeActive);
      btn.innerHTML=partyModeActive?`🎉 <span>Party: ON</span>`:`🎉 <span>Party Mode</span>`;
    }
    if(partyModeActive){
      playFestiveChime("party");
      notice("🎉 Secret Santa Party Mode is ON! Confetti & celebration active! ✨");
    }else{
      notice("Party celebration paused 🎄");
    }
    return partyModeActive;
  }

  function customizeMyDesk(customSettings){
    try{
      localStorage.setItem("vcf_ss_desk_custom",JSON.stringify(customSettings));
    }catch{}
    const myDesk=officeDesks.find(d=>d.isMe);
    if(!myDesk)return;

    if(customSettings.prop){
      myDesk.clueKey=customSettings.prop;
      myDesk.clueMeta=CLUE_INFO[customSettings.prop]||{icon:"🎁",title:"Secret Santa Clue"};
      if(myDesk.deskGroup){
        const stands=myDesk.deskGroup.children.filter(c=>c.userData&&c.userData.isClueStand);
        stands.forEach(s=>myDesk.deskGroup.remove(s));
        decorateClueDesk(myDesk.deskGroup,myDesk.seatIndex,myDesk.seat.chairSide,customSettings.prop);
      }
    }

    if(myDesk.redraw){
      myDesk.redraw();
    }

    if(activeDesk&&activeDesk.isMe){
      const icon=document.getElementById("desk-card-icon");
      const title=document.getElementById("desk-card-title");
      const subtitle=document.getElementById("desk-card-subtitle");
      if(icon)icon.textContent=myDesk.clueMeta.icon;
      if(title)title.textContent=myDesk.ownerName+"'s Workspace";
      if(subtitle)subtitle.textContent=`${myDesk.code} · Clue Prop: ${myDesk.clueMeta.icon} ${myDesk.clueMeta.title}`;
    }

    notice("✨ Your workspace desk has been personalized!");
  }

  function updateAvatarPhoto(photoUrl){
    try{
      if(photoUrl) localStorage.setItem("vcf_ss_avatar_photo",photoUrl);
      else localStorage.removeItem("vcf_ss_avatar_photo");
    }catch{}
    const myDesk=officeDesks.find(d=>d.isMe);
    if(myDesk&&myDesk.redraw){
      myDesk.redraw();
    }
    if(hero&&hero.parameters){
      previewAvatar({...hero.parameters,facePhoto:photoUrl||""});
    }
  }

  function applyProfile(next){
    officeLife?.dispose();officeLife=null;
    for(const d of officeDesks){
      if(d.nameplateGroup&&d.deskGroup){
        d.deskGroup.remove(d.nameplateGroup);
        d.texture?.dispose();
        d.material?.dispose();
      }
    }
    officeDesks=[];

    const oldPos=hero?hero.group.position.clone():null;
    currentProfile=next;
    const allMembers=(next?.colleagues||[]).slice(0,150);
    const myId=next?.me?.id||"player";
    const myName=next?.me?.display_name||next?.me?.name||"You";

    let mySeatIndex=Number.isInteger(next?.me?.officeSeat)?next.me.officeSeat:-1;
    if(mySeatIndex===-1){
      const meInAll=allMembers.findIndex(p=>p.id===myId);
      if(meInAll!==-1){
        mySeatIndex=Number.isInteger(allMembers[meInAll].officeSeat)?allMembers[meInAll].officeSeat:meInAll;
      }else{
        mySeatIndex=allMembers.length;
      }
    }

    const total=Math.max(1,mySeatIndex+1,...allMembers.map((p,i)=>
      (Number.isInteger(p.officeSeat)?p.officeSeat:i)+1));
    const newBays=Math.max(4,Math.ceil(total/3));
    if(!office||newBays!==office.bays){
      if(office)scene.remove(office.root);
      office=buildOffice(total);scene.add(office.root);
      nav=new Navigation(office);
    }

    const roster=allMembers.map((p,index)=>({
      ...p,
      seatIndex:Number.isInteger(p.officeSeat)?p.officeSeat:(index>=mySeatIndex?index+1:index)
    })).filter(p=>p.id!==myId);

    for(const item of people){
      if(item.detailed){
        scene.remove(item.detailed.group);
        releaseCharacterMaterials(item.detailed);
      }
    }
    people=[];
    if(!hero){
      hero=createAvatar(avatarFromPerson({...next.me,id:myId,isMe:true}));
      hero.group.position.set(office.spawn.x,0,office.spawn.z);
      hero.group.rotation.y=Math.PI;
      scene.add(hero.group);
    }else{
      scene.remove(hero.group);
      hero=createAvatar(avatarFromPerson({...next.me,id:myId,isMe:true}));
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

    office.seats.forEach((seat,seatIdx)=>{
      const isMe=(seatIdx===mySeatIndex);
      const colleague=isMe?null:roster.find(p=>p.seatIndex===seatIdx);
      const ownerName=isMe?myName:(colleague?(colleague.name||colleague.display_name||"Colleague"):"");
      const ownerId=isMe?myId:(colleague?colleague.id:null);
      const clueKey=deskClueForSeat(seatIdx);
      const clueMeta=CLUE_INFO[clueKey]||{icon:"🎁",title:"Secret Santa Clue"};
      const code="D-"+String(seatIdx+1).padStart(2,"0");

      const deskInfo={
        seatIndex:seatIdx,
        code,
        isMe,
        ownerName,
        ownerId,
        colleague,
        clueKey,
        clueMeta,
        seat,
        deskPos:seat.deskPosition,
        chairPos:seat.position,
        deskGroup:seat.deskGroup
      };

      if(isMe&&seat.deskGroup){
        let custom={};
        try{custom=JSON.parse(localStorage.getItem("vcf_ss_desk_custom")||"{}");}catch{}
        if(custom.prop){
          deskInfo.clueKey=custom.prop;
          deskInfo.clueMeta=CLUE_INFO[custom.prop]||deskInfo.clueMeta;
          const stands=seat.deskGroup.children.filter(c=>c.userData&&c.userData.isClueStand);
          stands.forEach(s=>seat.deskGroup.remove(s));
          decorateClueDesk(seat.deskGroup,seatIdx,seat.chairSide,custom.prop);
        }
      }

      if(seat.deskGroup){
        const {plateGroup,texture,material}=buildDeskNameplate(deskInfo);
        plateGroup.position.set(-seat.chairSide*.485,1.44,0);
        seat.deskGroup.add(plateGroup);
        deskInfo.nameplateGroup=plateGroup;
        deskInfo.texture=texture;
        deskInfo.material=material;
      }

      officeDesks.push(deskInfo);
    });

    officeLife=createOfficeLife(people,hero,nav,(person,text,time)=>{
      speech.say(person,text,time);
      if(text)notice((person.name||"Friend")+" · "+text);
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
    cameraYaw=PLAYER_CAMERA.yaw;
    zoom=1;
    targetCameraPitch=PLAYER_CAMERA.pitch;
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
    // Follow the controlled character at every frame, from spawn onward.
    // Long offices and custom avatar appearances never alter the focal point.
    const focus=new THREE.Vector3(
      hero.group.position.x,
      hero.group.position.y+PLAYER_CAMERA.focusHeight,
      hero.group.position.z
    );
    // Portrait retains headroom without zooming back to the distant overview.
    const portraitScale=camera.aspect<.70?1.15:1;
    const distance=PLAYER_CAMERA.distance*zoom*portraitScale;
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
  function moveTo(x,z,keepSitTarget=false){
    if(hero?.seated) standUp(false);
    if(!keepSitTarget) targetSitDesk=null;
    const target={x,z};
    const next=nav.find({x:hero.group.position.x,z:hero.group.position.z},target);
    if(!next.length){notice("Can't reach there.");return;}
    path=next;
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
      if(hero?.seated) standUp(false);
      const time=clock.elapsedTime;
      const target=hit.detailed.group.position,origin=hero.group.position;
      officeLife?.reserveForPlayer(hit,time);
      const distance=Math.hypot(target.x-origin.x,target.z-origin.z);
      const GREETINGS=[
        "Hey! Loving the festive office vibes! 🎄",
        "Are you my Secret Santa? 🎅",
        "Don't forget to check my wishlist in the Santa Hub! 🎁",
        "Have you seen the clue prop on my desk? 💡",
        "Merry Christmas and Happy Holidays! ✨",
        "I'm so excited for the gift exchange! 🎉"
      ];
      const line=GREETINGS[Math.floor(Math.random()*GREETINGS.length)];
      if(distance<2.0){
        path=[];interactTarget=null;
        hero.play("hi",time);
        hit.detailed?.play("hi",time);
        speech.say(hit,line,time);
        notice(`${hit.name} · ${line}`);
        return;
      }
      const approach=officeLife?.findApproach(origin,target,hero,1.65);
      if(approach?.path?.length){
        path=approach.path;interactTarget=hit;
        clickMarker.group.visible=true;
        clickMarker.group.position.set(approach.end.x,0,approach.end.z);
        notice("Walking to "+hit.name);
      }else{
        interactTarget=null;
        notice("Can't reach "+hit.name);
      }
      return;
    }

    // Christmas Tree hits (Spawn tree & Party stage tree)
    const nearTreePos=new THREE.Vector3(6.45,1.5,4.75);
    const mainTreePos=new THREE.Vector3(0,2.5,office.partyStart+3.8);
    const dNear=ray.ray.distanceToPoint(nearTreePos);
    const dMain=ray.ray.distanceToPoint(mainTreePos);
    if(dNear<1.15||dMain<1.75){
      if(hero?.seated) standUp(false);
      const isMain=dMain<dNear;
      const targetPos=isMain?{x:0,z:office.partyStart+2.2}:{x:5.2,z:4.75};
      moveTo(targetPos.x,targetPos.z);
      notice("🎄 Walking to the Christmas Tree!");
      setTimeout(()=>{
        if(!hero)return;
        hero.play("cheer",clock.elapsedTime);
        notice("🎄 Merry Christmas! You visited the Christmas Tree! Jingle bells & holiday cheer! ⭐");
        window.dispatchEvent(new CustomEvent("christmastree:tap"));
      },1000);
      return;
    }

    // Retro Arcade Room & Console hits
    const arcX=office.arcadeStation?.x??1.20;
    const arcZ=office.arcadeStation?.z??(office.partyStart+11.55);
    const arcAppX=office.arcadeStation?.approachX??1.20;
    const arcAppZ=office.arcadeStation?.approachZ??(office.partyStart+9.55);
    const arcadePos=new THREE.Vector3(arcX,1.0,arcZ);
    if(ray.ray.distanceToPoint(arcadePos)<3.2){
      if(hero?.seated) standUp(false);
      moveTo(arcAppX,arcAppZ);
      notice("🕹️ Walking into the Retro Arcade Room!");
      setTimeout(()=>{
        if(!hero)return;
        hero.play("cheer",clock.elapsedTime);
        window.dispatchEvent(new CustomEvent("arcade:open"));
      },850);
      return;
    }

    // Secret Santa Stage Gift Table hits
    const stageGiftsPos=new THREE.Vector3(-3.2,0.8,office.partyStart+3.66);
    if(ray.ray.distanceToPoint(stageGiftsPos)<1.55){
      if(hero?.seated) standUp(false);
      moveTo(-3.2,office.partyStart+2.6);
      notice("🎁 Walking to the Secret Santa Gift Table!");
      setTimeout(()=>{
        if(!hero)return;
        hero.play("clap",clock.elapsedTime);
        notice("🎁 The Secret Santa Gift Table! Wrapped presents will be revealed here at the party!");
      },1000);
      return;
    }

    // Desk and Clue Prop hits
    let clickedDesk=null;
    let bestDeskDepth=Infinity;
    for(const d of officeDesks){
      const center=new THREE.Vector3(d.deskPos.x,1.0,d.deskPos.z);
      const depth=ray.ray.origin.distanceTo(center);
      const rayDist=ray.ray.distanceToPoint(center);
      if(rayDist<1.45&&depth<bestDeskDepth){
        clickedDesk=d;
        bestDeskDepth=depth;
      }
    }
    if(clickedDesk){
      sitAtDesk(clickedDesk);
      return;
    }
    const point=new THREE.Vector3();
    if(ray.ray.intersectPlane(ground,point)&&
       point.x>=office.room.left&&point.x<=office.room.right&&
       point.z>=office.room.front&&point.z<=office.room.back){
      if(hero?.seated) standUp(false);
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
  const activeKeys=new Set();
  function onKeyDown(e){
    if(paused)return;
    const tag=document.activeElement?.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
    if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowLeft","ArrowDown","ArrowRight"].includes(e.code)){
      activeKeys.add(e.code);
      e.preventDefault();
    }
  }
  function onKeyUp(e){
    activeKeys.delete(e.code);
  }
  window.addEventListener("keydown",onKeyDown);
  window.addEventListener("keyup",onKeyUp);

  const joystickVector={x:0,y:0};
  const joystickBase=document.getElementById("joystick-base");
  const joystickKnob=document.getElementById("joystick-knob");
  let joystickPointerId=null;

  function updateJoystickPos(clientX,clientY){
    if(!joystickBase||!joystickKnob)return;
    const rect=joystickBase.getBoundingClientRect();
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const rawDx=clientX-centerX;
    const rawDy=clientY-centerY;
    const dist=Math.hypot(rawDx,rawDy);
    const maxRadius=rect.width*0.38;
    const clampedDist=Math.min(dist,maxRadius);
    const angle=Math.atan2(rawDy,rawDx);
    const knobX=Math.cos(angle)*clampedDist;
    const knobY=Math.sin(angle)*clampedDist;

    joystickKnob.style.transition="none";
    joystickKnob.style.transform=`translate3d(${knobX}px,${knobY}px,0px)`;

    const normDist=clampedDist/maxRadius;
    joystickVector.x=Math.cos(angle)*normDist;
    joystickVector.y=Math.sin(angle)*normDist;
  }
  function onJoyDown(e){
    if(paused)return;
    e.stopPropagation();
    joystickPointerId=e.pointerId;
    joystickBase?.classList.add("active");
    try{joystickBase?.setPointerCapture(e.pointerId);}catch{}
    updateJoystickPos(e.clientX,e.clientY);
  }
  function onJoyMove(e){
    if(e.pointerId!==joystickPointerId)return;
    e.stopPropagation();
    updateJoystickPos(e.clientX,e.clientY);
  }
  function onJoyUp(e){
    if(e.pointerId!==joystickPointerId)return;
    e.stopPropagation();
    joystickPointerId=null;
    joystickBase?.classList.remove("active");
    joystickVector.x=0;
    joystickVector.y=0;
    if(joystickKnob){
      joystickKnob.style.transition="transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
      joystickKnob.style.transform="translate3d(0px,0px,0px)";
    }
  }

  if(joystickBase){
    joystickBase.addEventListener("pointerdown",onJoyDown);
    joystickBase.addEventListener("pointermove",onJoyMove);
    joystickBase.addEventListener("pointerup",onJoyUp);
    joystickBase.addEventListener("pointercancel",onJoyUp);
  }

  function render(){
    if(!running)return;
    requestId=requestAnimationFrame(render);
    const dt=Math.min(clock.getDelta(),.06),elapsed=clock.elapsedTime;
    // Character studio has its own renderer; avoid double WebGL work behind Pause.
    if(paused)return;
    confettiSystem?.update(dt);
    if(hero){
      let moving=false;
      const hasKeyInput=activeKeys.size>0;
      const hasJoyInput=joystickVector.x!==0||joystickVector.y!==0;
      if(hasKeyInput||hasJoyInput){
        if(hero.seated) standUp(false);
        path=[];
        interactTarget=null;
        targetSitDesk=null;
        clickMarker.group.visible=false;
        let inputX=0,inputZ=0;
        if(activeKeys.has("KeyW")||activeKeys.has("ArrowUp"))inputZ-=1;
        if(activeKeys.has("KeyS")||activeKeys.has("ArrowDown"))inputZ+=1;
        if(activeKeys.has("KeyA")||activeKeys.has("ArrowLeft"))inputX-=1;
        if(activeKeys.has("KeyD")||activeKeys.has("ArrowRight"))inputX+=1;

        if(hasJoyInput){
          inputX+=joystickVector.x;
          inputZ+=joystickVector.y;
        }

        if(inputX!==0||inputZ!==0){
          const rawMag=Math.hypot(inputX,inputZ);
          const mag=Math.min(1,rawMag);
          const dirX=inputX/rawMag,dirZ=inputZ/rawMag;
          const forwardX=-Math.sin(cameraYaw),forwardZ=-Math.cos(cameraYaw);
          const rightX=-forwardZ,rightZ=forwardX;
          const worldDirX=rightX*dirX+forwardX*(-dirZ);
          const worldDirZ=rightZ*dirX+forwardZ*(-dirZ);

          const step=dt*2.8*mag;
          const proposedX=hero.group.position.x+worldDirX*step;
          const proposedZ=hero.group.position.z+worldDirZ*step;

          const collides=nav.collision(proposedX,proposedZ);
          const tooClose=people.some(p=>{
            const n=p.detailed.group.position;
            return Math.hypot(n.x-proposedX,n.z-proposedZ)<.91;
          });

          if(!collides&&!tooClose){
            hero.group.position.x=proposedX;
            hero.group.position.z=proposedZ;
            const desired=Math.atan2(worldDirX,worldDirZ);
            hero.group.rotation.y+=Math.atan2(
              Math.sin(desired-hero.group.rotation.y),
              Math.cos(desired-hero.group.rotation.y))*Math.min(1,dt*10);
            moving=true;
          }
        }
      }
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
      if(targetSitDesk){
        const seatPos=targetSitDesk.seat.position;
        const distToChair=Math.hypot(hero.group.position.x-seatPos.x,hero.group.position.z-seatPos.z);
        if(distToChair<=1.8||path.length===0){
          performSit(targetSitDesk);
        }
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

      // Proximity Desk Card check
      if(officeDesks.length){
        let closestDesk=null;
        let closestDist=Infinity;
        const hPos=hero.group.position;
        for(const d of officeDesks){
          const dist=Math.hypot(hPos.x-d.deskPos.x,hPos.z-d.deskPos.z);
          if(dist<closestDist){
            closestDist=dist;
            closestDesk=d;
          }
        }
        const deskCard=document.getElementById("desk-card");
        if(deskCard){
          if(closestDesk&&closestDist<=2.6){
            if(activeDesk!==closestDesk){
              activeDesk=closestDesk;
              deskCard.classList.remove("hidden");
              const badge=document.getElementById("desk-card-badge");
              const icon=document.getElementById("desk-card-icon");
              const title=document.getElementById("desk-card-title");
              const subtitle=document.getElementById("desk-card-subtitle");
              const actionBtn=document.getElementById("desk-card-action");

              if(closestDesk.isMe){
                deskCard.classList.add("desk-card-me");
                if(badge)badge.textContent="⭐ YOUR DESK";
                if(icon)icon.textContent=closestDesk.clueMeta.icon;
                if(title)title.textContent=closestDesk.ownerName+"'s Workspace";
                if(subtitle)subtitle.textContent=`${closestDesk.code} · Clue Prop: ${closestDesk.clueMeta.icon} ${closestDesk.clueMeta.title}`;
                const custBtn=document.getElementById("desk-card-customize");
                if(custBtn)custBtn.classList.remove("hidden");
              }else if(closestDesk.ownerName){
                deskCard.classList.remove("desk-card-me");
                if(badge)badge.textContent="💼 COLLEAGUE DESK";
                if(icon)icon.textContent=closestDesk.clueMeta.icon;
                if(title)title.textContent=closestDesk.ownerName+"'s Desk";
                if(subtitle)subtitle.textContent=`${closestDesk.code} · Clue Prop: ${closestDesk.clueMeta.icon} ${closestDesk.clueMeta.title}`;
                const custBtn=document.getElementById("desk-card-customize");
                if(custBtn)custBtn.classList.add("hidden");
              }else{
                deskCard.classList.remove("desk-card-me");
                if(badge)badge.textContent="🪑 OPEN DESK";
                if(icon)icon.textContent="🪑";
                if(title)title.textContent=closestDesk.code+" · Open Desk";
                if(subtitle)subtitle.textContent="Unassigned Hot Desk";
                const custBtn=document.getElementById("desk-card-customize");
                if(custBtn)custBtn.classList.add("hidden");
              }

              if(actionBtn){
                if(hero?.seated&&seatedDesk===closestDesk){
                  actionBtn.textContent="Stand Up 🚶";
                  actionBtn.classList.add("btn-seated");
                }else{
                  actionBtn.classList.remove("btn-seated");
                  if(closestDesk.isMe){
                    actionBtn.textContent="Sit at Desk";
                  }else if(closestDesk.ownerName){
                    actionBtn.textContent="Say Hello 👋";
                  }else{
                    actionBtn.textContent="Sit Here";
                  }
                }
              }
            }
          }else if(closestDist>3.2&&(!hero||!hero.seated)){
            if(activeDesk){
              activeDesk=null;
              deskCard.classList.add("hidden");
            }
          }
        }
      }
      cameraPitch+=(targetCameraPitch-cameraPitch)*Math.min(1,dt*10);
      const goal=cameraGoal();
      // Smooth translation while always aiming at the CURRENT position of
      // the controlled avatar, never a delayed aim point.
      camera.position.lerp(goal.position,1-Math.exp(-dt*13));
      lookAtPoint.copy(goal.focus);
      camera.lookAt(lookAtPoint);
      updateCutawayWalls();
    }
    if(clickMarker.group.visible){
      clickMarker.ring.rotation.z+=dt*.55;
      clickMarker.group.scale.setScalar(.94+Math.sin(elapsed*4)*.065);
      if(path.length===0)clickMarker.group.visible=false;
    }
    for(let i=0;i<office.twinkle.length;i++){
      office.twinkle[i].material.emissiveIntensity=(.72+Math.sin(elapsed*2.5+i*1.8)*.35)*activeTwinkleScale;
    }
    renderer.render(scene,camera);
  }
  // Open close to the controlled avatar, centered from the first frame.
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
      if(hero.seated) standUp(false);
      targetSitDesk=null;
      // Perform immediately: clearing movement makes the selected animation
      // visible rather than being masked by walk motion.
      path=[];
      interactTarget=null;
      clickMarker.group.visible=false;
      hero.play(name,clock.elapsedTime);
      const responder=officeLife?.mimicNearby(name,clock.elapsedTime,5.4);
      selectedAction=name;
      const messages={hi:"Hello!",dance:"Let's dance!",clap:"Time to celebrate!",cheer:"Merry Christmas!"};
      // A nearby colleague will speak through their own bubble.
      if(!responder)notice(messages[name]);
      return true;
    },
    goHome(){
      if(hero)moveTo(office.spawn.x,office.spawn.z);
    },
    goToDesk,
    sitAtDesk,
    standUp,
    cycleTimeTheme,
    applyTimeTheme,
    setTimeTheme:applyTimeTheme,
    togglePartyMode,
    toggleParty:togglePartyMode,
    customizeMyDesk,
    updateAvatarPhoto,
    goToArcade(){
      if(hero?.seated) standUp(false);
      const arcAppX=office.arcadeStation?.approachX??1.20;
      const arcAppZ=office.arcadeStation?.approachZ??(office.partyStart+9.55);
      moveTo(arcAppX,arcAppZ);
      notice("🕹️ Entering the Retro Arcade Room!");
      setTimeout(()=>{
        if(!hero)return;
        hero.play("cheer",clock.elapsedTime);
        window.dispatchEvent(new CustomEvent("arcade:open"));
      },900);
    },
    goToTree(){
      if(hero?.seated) standUp(false);
      moveTo(3.1,office.partyStart+2.6);
      notice("🎄 Approaching the Christmas Tree!");
      setTimeout(()=>{
        if(!hero)return;
        hero.play("cheer",clock.elapsedTime);
        window.dispatchEvent(new CustomEvent("christmastree:tap"));
      },1000);
    },
    triggerCelebration(){
      if(!confettiSystem?.active){
        confettiSystem?.start();
      }
      playFestiveChime("victory");
    },
    dispose(){
      officeLife?.dispose();officeLife=null;
      speech.dispose();
      running=false;cancelAnimationFrame(requestId);observer?.disconnect();
      window.removeEventListener("resize",resize);
      window.removeEventListener("keydown",onKeyDown);
      window.removeEventListener("keyup",onKeyUp);
      myDeskBtn?.removeEventListener("click",onMyDeskClick);
      timeBtn?.removeEventListener("click",onTimeClick);
      deskCardActionBtn?.removeEventListener("click",onDeskCardActionClick);
      for(const d of officeDesks){
        d.texture?.dispose();
        d.material?.dispose();
      }
      if(joystickBase){
        joystickBase.removeEventListener("pointerdown",onJoyDown);
        joystickBase.removeEventListener("pointermove",onJoyMove);
        joystickBase.removeEventListener("pointerup",onJoyUp);
        joystickBase.removeEventListener("pointercancel",onJoyUp);
      }
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