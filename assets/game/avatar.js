import * as THREE from "three";
/**
 * Authored procedural mini-voxel adults. No external or unverified character assets.
 * The body is rigged with real limb pivots and features layered face and hair meshes.
 */
const SKINS=[0xf1c69e,0xddad84,0xbc805d,0x955d46,0x714331];
const HAIR=[0x1a1419,0x2c201c,0x50342b,0x392323,0x171921];
const COLORS=[0x4c816c,0xc75b65,0x385883,0xd19d49,0x765e8d,0xe1ddd4];
const shared=new Map();
function mat(color,roughness=.76,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
function roundedBox(w,h,d,r=.075,steps=2){
  const key=[w,h,d,r,steps].join(":");
  if(shared.has(key))return shared.get(key);
  const shape=new THREE.Shape();
  const x=-w/2,y=-h/2;const k=Math.min(r,w/2-.001,h/2-.001);
  shape.moveTo(x+k,y);shape.lineTo(x+w-k,y);shape.quadraticCurveTo(x+w,y,x+w,y+k);
  shape.lineTo(x+w,y+h-k);shape.quadraticCurveTo(x+w,y+h,x+w-k,y+h);
  shape.lineTo(x+k,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-k);
  shape.lineTo(x,y+k);shape.quadraticCurveTo(x,y,x+k,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.005,d-2*Math.min(.04,k*.45)),steps:1,bevelEnabled:true,bevelSegments:steps,curveSegments:3,bevelSize:Math.min(.04,k*.45),bevelThickness:Math.min(.04,k*.45)});
  g.center();shared.set(key,g);return g;
}
function part(parent,w,h,d,color,x,y,z,r=.055){
  const mesh=new THREE.Mesh(roundedBox(w,h,d,r),typeof color==="number"?mat(color):color);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function orb(parent,r,color,x,y,z,sx=1,sy=1,sz=1){
  const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),typeof color==="number"?mat(color):color);
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function ellipse(parent,w,h,color,x,y,z){
  return part(parent,w,h,.014,color,x,y,z,.04);
}
function resolve(opts={}){
  const n=typeof opts==="object" && opts ? opts:{};
  return {
    gender:n.gender==="female"?"female":"male",
    skin:Math.abs(Number(n.skin)||0)%SKINS.length,
    hair:Math.abs(Number(n.hair)||0)%HAIR.length,
    hairstyle:Math.abs(Number(n.hairstyle)||0)%4,
    outfit:["shirt","tshirt","suit","salwar","dress","sweater"].includes(n.outfit)?n.outfit:"shirt",
    color:Number.isInteger(n.color)?n.color%COLORS.length:0,
    glasses:!!n.glasses,
    height:Math.min(1.16,Math.max(.86,Number(n.height)||1)),
    build:Math.min(1.2,Math.max(.83,Number(n.build)||1))
  };
}
export function createAvatar(input={},mini=false){
  const p=resolve(input),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const skin=mat(SKINS[p.skin]),hair=mat(HAIR[p.hair]),cloth=mat(COLORS[p.color]),dark=mat(0x272b3a),white=mat(0xfff4df);
  const accent=mat(p.outfit==="salwar"?0xebbf87:0xe8d7b8);
  const width=p.build, feminine=p.gender==="female";
  const isEthnic=p.outfit==="salwar";
  const top=p.outfit==="suit"?mat(0x2d3d59):cloth;
  const bottom=isEthnic?mat(0xf1dfc3):p.outfit==="dress"?cloth:mat(p.outfit==="suit"?0x24324b:0x35465b);
  // Lifts the whole avatar off its animation pivots.
  const hips=new THREE.Group();hips.position.y=1.04;body.add(hips);
  const pelvis=part(hips,.55*width,.32,.38,bottom,0,-.12,0);
  const torso=part(hips,.68*width,.72,.43,top,0,.37,0,.115);
  if(feminine){part(hips,.54*width,.11,.43,top,0,.01,.01);}
  if(isEthnic){
    const tunic=part(hips,.72*width,.49,.51,top,0,-.025,0,.10);
    part(hips,.36,.05,.02,accent,0,.18,.278);
    part(hips,.63,.035,.03,accent,0,-.235,.279);
    const dupatta=part(hips,.12,.69,.08,accent,-.24,.37,.26,.04);dupatta.rotation.z=-.1;
  }else if(p.outfit==="suit"){
    part(hips,.22,.55,.025,white,0,.38,.228);
    part(hips,.075,.33,.032,mat(0xb4554b),0,.44,.257);
    part(hips,.32,.08,.035,top,0,.07,.26);
  }else if(p.outfit==="shirt"){
    part(hips,.13,.36,.02,white,0,.41,.228);
    part(hips,.21,.09,.025,mat(0xebdfd0),0,.7,.245);
    for(let i=0;i<3;i++)orb(hips,.018,0x755d4c,0,.53-i*.12,.252);
  }else if(p.outfit==="sweater"){
    for(let i=0;i<4;i++){
      const t=part(hips,.61,.026,.025,mat(i%2?0xffeadc:0xd85d5d),0,.48-i*.085,.229,.01);
      if(i===0)t.scale.x=.78;
    }
  }else if(p.outfit==="dress"){
    part(hips,.73,.45,.47,top,0,-.065,0,.12);
    part(hips,.6,.04,.036,mat(0xe8cba6),0,.09,.275);
  }
  // Neck and expressive oversized head.
  part(hips,.22,.19,.22,skin,0,.82,0,.055);
  const headPivot=new THREE.Group();headPivot.position.set(0,.93,0);hips.add(headPivot);
  part(headPivot,.79,.73,.68,skin,0,.28,0,.17);
  orb(headPivot,.12,skin,-.414,.25,.015,.60,1,.65);
  orb(headPivot,.12,skin,.414,.25,.015,.60,1,.65);
  // Hair volume: layered brows, chunky locks, occasional bangs and ponytail.
  part(headPivot,.86,.2,.75,hair,0,.66,-.025,.10);
  part(headPivot,.83,.17,.76,hair,0,.58,-.035,.12);
  part(headPivot,.19,.30,.70,hair,-.37,.48,-.015,.07);
  part(headPivot,.19,.30,.70,hair,.37,.48,-.015,.07);
  for(let i=0;i<4;i++){
    const x=-.30+i*.20;
    const lock=part(headPivot,.20,.12,.18,hair,x,.58,.315,.035);
    lock.rotation.z=[.12,-.10,.08,-.16][i];
  }
  if(feminine || p.hairstyle===2){
    part(headPivot,.18,.52,.40,hair,-.39,.16,-.16,.075);
    part(headPivot,.18,.53,.40,hair,.39,.16,-.16,.075);
    part(headPivot,.54,.40,.20,hair,0,.12,-.36,.13);
    if(p.hairstyle===1||p.hairstyle===3){
      orb(headPivot,.20,hair,.42,.23,-.33,.75,1.45,.8);
      part(headPivot,.14,.34,.13,mat(0xcaa076),.45,.06,-.37,.04);
    }
  }else if(p.hairstyle===1){
    for(let i=0;i<4;i++)part(headPivot,.16,.18,.22,hair,-.26+i*.17,.78,-.09,.05);
  }
  const eyes=mat(0x20212c),shine=mat(0xffffff),lips=mat(0xab5860),brow=mat(HAIR[p.hair]);
  for(const x of [-.17,.17]){
    orb(headPivot,.071,eyes,x,.30,.349,.73,1.05,.45);
    orb(headPivot,.018,shine,x-.015,.33,.393,.8,1,.4);
    ellipse(headPivot,.15,.029,brow,x,.435,.351);
    if(feminine){part(headPivot,.046,.018,.025,brow,x+Math.sign(x)*.065,.356,.377,.009);}
    orb(headPivot,.091,0xeaaa89,x*1.35,.18,.34,.9,.55,.24);
  }
  orb(headPivot,.047,skin,0,.205,.378,.7,.75,.58);
  ellipse(headPivot,.18,.035,lips,0,.105,.354);
  if(p.glasses){
    for(const x of [-.17,.17]){
      const rim=part(headPivot,.195,.16,.035,dark,x,.305,.367,.05);
      part(headPivot,.154,.12,.044,mat(0xc4d8e3,.2,.1),x,.305,.38,.035);
    }
    part(headPivot,.12,.035,.035,dark,0,.33,.387,.012);
    part(headPivot,.12,.025,.035,dark,.34,.32,.28,.012);
    part(headPivot,.12,.025,.035,dark,-.34,.32,.28,.012);
  }
  // Neckline, patterned garment details and ID badge give a modern office identity.
  part(hips,.28,.055,.04,accent,0,.735,.225,.025);
  if(p.outfit==="shirt"||p.outfit==="tshirt"){
    part(hips,.045,.28,.03,accent,.08,.4,.255,.015);
  }
  const lanyard=part(hips,.027,.48,.024,mat(0xd5bb75),.02,.44,.24,.01);
  lanyard.rotation.z=.21;
  part(hips,.20,.17,.035,white,.10,.18,.26,.02);
  part(hips,.13,.035,.04,mat(0x65908b),.10,.20,.282,.01);
  // Animated shoulder and elbow joints. Both arms attach to torso.
  function arm(side){
    const pivot=new THREE.Group();pivot.position.set(side*.39*width,.64,0);hips.add(pivot);
    const sleeve=part(pivot,.23*width,.32,.31,top,side*.018,-.17,0,.08);
    const lower=new THREE.Group();lower.position.y=-.36;pivot.add(lower);
    part(lower,.18,.25,.24,skin,0,-.11,0,.055);
    part(lower,.22,.13,.26,skin,0,-.29,.035,.055);
    return {pivot,lower};
  }
  const left=arm(-1),right=arm(1);
  function leg(side){
    const pivot=new THREE.Group();pivot.position.set(side*.17,-.18,0);hips.add(pivot);
    part(pivot,.245*width,.53,.31,bottom,0,-.255,0,.055);
    part(pivot,.28,.13,.42,mat(0xd6d1c7),0,-.55,.10,.04);
    part(pivot,.29,.105,.43,mat(0xffffff),0,-.615,.12,.04);
    return pivot;
  }
  const lLeg=leg(-1),rLeg=leg(1);
  const data={group:root,parameters:p,head:headPivot,hips,left,right,lLeg,rLeg,action:"",actionStart:0,actionDuration:0,seated:false};
  data.update=(time,moving=false)=>{
    const actionActive=data.action&&time-data.actionStart<data.actionDuration;
    const motion=time-data.actionStart;
    const gait=moving?Math.sin(time*10)*.62:0;
    lLeg.rotation.x=gait;
    rLeg.rotation.x=-gait;
    left.pivot.rotation.x=-gait*.6;
    right.pivot.rotation.x=gait*.6;
    left.pivot.rotation.z=-.07;right.pivot.rotation.z=.07;
    left.lower.rotation.x=0;right.lower.rotation.x=0;
    hips.position.y=1.04+(moving?Math.abs(Math.sin(time*10))*.035:Math.sin(time*2)*.012);
    hips.rotation.z=0;
    headPivot.rotation.y=Math.sin(time*1.4)*.028;
    headPivot.rotation.x=0;
    if(data.seated){
      hips.position.y=.77;
      lLeg.rotation.x=-1.32;rLeg.rotation.x=-1.32;
      left.pivot.rotation.x=-.7;right.pivot.rotation.x=-.7;
      left.lower.rotation.x=-.9;right.lower.rotation.x=-.9;
      headPivot.rotation.x=.06;
    }
    if(actionActive){
      const wave=Math.sin(motion*12);
      if(data.action==="hi"){
        right.pivot.rotation.z=-2.75;right.pivot.rotation.x=-.15;
        right.lower.rotation.z=-.26+wave*.37;
      }else if(data.action==="dance"){
        hips.rotation.z=Math.sin(motion*9)*.17;
        hips.position.y+=Math.abs(Math.sin(motion*9))*.1;
        lLeg.rotation.x=Math.sin(motion*9)*.48;rLeg.rotation.x=-lLeg.rotation.x;
        left.pivot.rotation.z=-1.05+Math.sin(motion*9)*.55;
        right.pivot.rotation.z=1.05+Math.sin(motion*9+2)*.55;
        headPivot.rotation.z=Math.sin(motion*9)*.13;
      }else if(data.action==="clap"){
        left.pivot.rotation.z=-1.1;right.pivot.rotation.z=1.1;
        left.pivot.rotation.x=-1.05+Math.abs(wave)*.3;
        right.pivot.rotation.x=-1.05+Math.abs(wave)*.3;
        left.lower.rotation.z=-.48+wave*.23;right.lower.rotation.z=.48-wave*.23;
      }else if(data.action==="cheer"){
        left.pivot.rotation.z=-2.5+wave*.18;right.pivot.rotation.z=2.5-wave*.18;
        hips.position.y+=Math.abs(wave)*.08;
      }
    }else data.action="";
  };
  data.play=(name,time)=>{
    if(!["hi","dance","clap","cheer"].includes(name))return;
    data.action=name;data.actionStart=time;data.actionDuration=name==="dance"?3.7:2.2;
    data.seated=false;
  };
  const scale=p.height*(mini?.9:1);
  root.scale.setScalar(scale);
  root.userData.avatar=data;
  root.traverse(obj=>{obj.userData.avatarRoot=data;});
  return data;
}
export function avatarFromPerson(person,i=0){
  // Deterministic appearance: stable across refreshes and identical on all clients.
  let hash=2166136261;
  const str=person.id||person.name||String(i);
  for(let k=0;k<str.length;k++){hash^=str.charCodeAt(k);hash=Math.imul(hash,16777619);}
  hash>>>=0;
  const presets=["shirt","suit","salwar","sweater","tshirt","dress"];
  const fallback={
    gender:(hash%2)?"female":"male",
    skin:(hash>>>3)%5,hair:(hash>>>9)%5,hairstyle:(hash>>>12)%4,
    color:(hash>>>15)%6,glasses:((hash>>>17)&3)===1,
    outfit:presets[(hash>>>19)%presets.length],
    height:.91+((hash>>>23)%16)/100,build:.9+((hash>>>27)%22)/100
  };
  return resolve({...fallback,...(person.avatar&&typeof person.avatar==="object"?person.avatar:{})});
}
