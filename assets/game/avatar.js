import * as THREE from "three";
import {sculptHead,sculptFoot} from "./avatar-parts.js?v=avatar-expanded-v2";
import {sculptWardrobe} from "./wardrobe.js?v=avatar-expanded-v1";
import {SKIN_COLORS as SKINS,HAIR_COLORS as HAIR,OUTFIT_COLORS as COLORS,FOOTWEAR_OPTIONS} from "./palette.js?v=visual-atelier-v3";
import {clothMaterial} from "./visual-materials.js?v=visual-atelier-v3";
import {sculptFaceVoxels,sculptHairVoxels,sculptGarmentVoxels,sculptSleeveVoxels,sculptShoeVoxels} from "./artisan-voxels.js?v=avatar-expanded-v1";
/**
 * Hybrid voxel adults with modular, richly sculpted faces and contemporary Indian garments. No external or unverified character assets.
 * The body is rigged with real limb pivots and features layered face and hair meshes.
 */
const shared=new Map();
const contactGeometry=new THREE.CircleGeometry(1,28);
const shadowMaterials=[
  new THREE.MeshBasicMaterial({color:0x33483e,opacity:.095,transparent:true,depthWrite:false}),
  new THREE.MeshBasicMaterial({color:0x243e35,opacity:.10,transparent:true,depthWrite:false})
];
for(const material of shadowMaterials)material.userData.sharedVoxelMaterial=true;
// One stable set of sculpting materials across all locally rendered characters.
const materialCache=new Map();
function mat(color,roughness=.76,metalness=0){
  const hex=color?.isColor?color.getHex():color;
  const id=[hex,roughness,metalness].join(":");
  if(!materialCache.has(id)){
    const m=new THREE.MeshStandardMaterial({color:hex,roughness,metalness});
    m.userData.sharedVoxelMaterial=true;
    materialCache.set(id,m);
  }
  return materialCache.get(id);
}
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
const sphereGeometries=new Map();
function orb(parent,r,color,x,y,z,sx=1,sy=1,sz=1){
  // Reuse sphere geometry across generated avatars and live editor updates.
  const key=r.toFixed(4);
  if(!sphereGeometries.has(key))sphereGeometries.set(key,new THREE.IcosahedronGeometry(r,1));
  const mesh=new THREE.Mesh(sphereGeometries.get(key),typeof color==="number"?mat(color):color);
  mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=r>.11;parent.add(mesh);return mesh;
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
    hairstyle:Math.abs(Number(n.hairstyle)||0)%20,
    outfit:["shirt","tshirt","suit","salwar","dress","sweater","jacket","bomber","blazer"].includes(n.outfit)?n.outfit:"shirt",
    bottom:["jeans","trousers","leggings","palazzo"].includes(n.bottom)?n.bottom:"jeans",
    color:Number.isInteger(n.color)?Math.abs(n.color)%COLORS.length:0,
    bottomColor:Number.isInteger(n.bottomColor)&&n.bottomColor>=0?n.bottomColor%COLORS.length:-1,
    shoeColor:Number.isInteger(n.shoeColor)&&n.shoeColor>=0?n.shoeColor%COLORS.length:-1,
    facialHair:["none","beard-short","beard-full","moustache-pencil","moustache-handlebar","combo-short","combo-full"].includes(n.facialHair)?
      n.facialHair:(n.gender!=="female"&&[1,3].includes(n.hairstyle)?"combo-short":"none"),
    glassesStyle:["none","round","rectangle","square","aviator","cat-eye"].includes(n.glassesStyle)?n.glassesStyle:(n.glasses?"rectangle":"none"),
    glassesColor:Number.isInteger(n.glassesColor)?Math.abs(n.glassesColor)%COLORS.length:0,
    footwear:FOOTWEAR_OPTIONS.includes(n.footwear)?n.footwear:"auto",
    glasses:!!n.glasses||n.glassesStyle&&n.glassesStyle!=="none",
    height:Math.min(1.16,Math.max(.86,Number(n.height)||1)),
    build:Math.min(1.2,Math.max(.83,Number(n.build)||1))
  };
}
export function createAvatar(input={},mini=false){
  const p=resolve(input),root=new THREE.Group(),body=new THREE.Group();
  root.add(body);
  // Ground the procedural shoes on the floor rather than leaving a visible
  // gap under the model. Small contact shadows add the toy-figurine weight.
  body.position.y=-.17;
  for(let i=0;i<2;i++){
    const shadow=new THREE.Mesh(contactGeometry,shadowMaterials[i]);
    shadow.rotation.x=-Math.PI/2;
    shadow.position.set(0,.018+i*.003,.08);
    shadow.scale.set(.62+i*.20,.40+i*.12,1);
    shadow.renderOrder=1;
    root.add(shadow);
  }
  const skin=mat(SKINS[p.skin],.82),hair=mat(HAIR[p.hair],.80),
        cloth=clothMaterial(p.outfit,COLORS[p.color]),dark=mat(0x272b3a),white=mat(0xfff4df);
  const accent=mat(p.outfit==="salwar"?0xebbf87:0xe8d7b8);
  const width=p.build, feminine=p.gender==="female";
  const isEthnic=p.outfit==="salwar";
  const top=cloth;
  const bottomColors={jeans:0x375476,trousers:0x394352,leggings:0x433c53,palazzo:0xe0c9af};
  const defaultBottom=isEthnic?(p.bottom==="leggings"?0xf1dfc3:0xe9d3be):
    p.outfit==="dress"?COLORS[p.color]:p.outfit==="suit"?new THREE.Color(COLORS[p.color]).offsetHSL(0,0,-.10):bottomColors[p.bottom];
  const bottom=p.bottomColor>=0?mat(COLORS[p.bottomColor]):p.outfit==="dress"?cloth:mat(defaultBottom);
  // Lifts the whole avatar off its animation pivots.
  const hips=new THREE.Group();hips.position.y=1.04;body.add(hips);
  // Rebalanced to a cute miniature adult: broad, sculpted upper silhouette,
  // short torso and substantially larger head relative to shoulder width.
  const pelvis=part(hips,.56*width,.36,.41,bottom,0,-.15,0,.13);
  const torso=part(hips,(feminine?.69:.78)*width,.69,.46,top,0,.38,0,.15);
  const waist=part(hips,(feminine?.56:.65)*width,.20,.46,top,0,.055,.01,.10);
  if(feminine)part(hips,.60*width,.10,.47,top,0,.01,.01,.055);
  // Subtle neckline shadow gives garment depth from the overhead camera.
  part(hips,.23,.055,.20,mat(0xe0ad8b,.84),0,.754,.065,.018);
  if(isEthnic){
    // Sculpted salwar suit with a longer hem, embroidered placket and draped dupatta.
    part(hips,.77*width,.60,.55,top,0,-.07,0,.115);
    part(hips,.72*width,.095,.58,accent,0,-.34,.005,.025);
    for(let j=0;j<4;j++){
      part(hips,.020,.085,.032,accent,0,.48-j*.13,.289,.01);
      const bead=orb(hips,.018,0xf4d4a0,0,.50-j*.13,.313,.8,.8,.7);
      bead.castShadow=false;
    }
    for(const x of [-.29,.29])part(hips,.048,.43,.039,accent,x,-.07,.291,.013);
    const dupatta=part(hips,.14,.86,.10,accent,-.29,.29,.31,.045);
    dupatta.rotation.z=-.11;
    part(hips,.23,.06,.07,mat(0xe1a66c),-.29,-.17,.34,.018);
  }else if(["jacket","bomber","blazer"].includes(p.outfit)){
    // Coat geometry layered over the rigged torso. Each outerwear piece has an
    // independent color and distinct collar/front silhouette.
    const bomber=p.outfit==="bomber",blazer=p.outfit==="blazer";
    for(const side of [-1,1]){
      const panel=part(hips,.33,blazer?.61:bomber?.56:.62,.125,top,side*.17,.36,.248,.065);
      panel.rotation.z=side*(blazer?.055:.015);
      part(hips,.16,blazer?.39:.28,.070,blazer?mat(0xdfd0be):accent,side*.13,.52,.328,.036).rotation.z=side*.22;
      part(hips,.18,.04,.032,accent,side*.20,.19,.324,.012);
    }
    part(hips,.024,.49,.046,mat(bomber?0xd7ba89:0xd9d7cb),0,.38,.323,.012);
    if(bomber){
      part(hips,.74,.12,.53,mat(0x403b4c),0,.035,.02,.047);
      for(const side of [-1,1])part(hips,.18,.10,.15,mat(0x403b4c),side*.31,.64,.09,.032);
    }else if(p.outfit==="jacket"){
      for(const side of [-1,1])part(hips,.16,.18,.038,mat(0xc5d6df),side*.195,.48,.335,.012);
    }
  }else if(p.outfit==="suit"){
    part(hips,.22,.55,.025,white,0,.38,.228);
    part(hips,.075,.33,.032,mat(0xb4554b),0,.44,.257);
    for(const side of [-1,1]){
      const lapel=part(hips,.205,.42,.052,mat(0x44526c),side*.18,.49,.264,.032);
      lapel.rotation.z=side*.20;
      part(hips,.09,.035,.025,accent,side*.245,.22,.288,.012);
    }
    for(let j=0;j<2;j++)orb(hips,.016,0xc5ae8a,0,.23-j*.11,.294);
  }else if(p.outfit==="shirt"){
    part(hips,.13,.36,.02,white,0,.41,.228);
    part(hips,.21,.09,.025,mat(0xebdfd0),0,.7,.245);
    for(let i=0;i<3;i++)orb(hips,.018,0x755d4c,0,.53-i*.12,.252);
  }else if(p.outfit==="tshirt"){
    part(hips,.27,.055,.035,mat(0xf5eadb),0,.70,.238,.035);
    const emblem=part(hips,.20,.15,.02,mat(0xf7e2a4),0,.43,.249,.05);
    emblem.rotation.z=.07;
    part(hips,.10,.03,.025,mat(0x42697f),0,.41,.271,.008);
  }else if(p.outfit==="sweater"){
    for(let i=0;i<4;i++){
      const t=part(hips,.61,.026,.025,mat(i%2?0xffeadc:0xd85d5d),0,.48-i*.085,.229,.01);
      if(i===0)t.scale.x=.78;
    }
  }else if(p.outfit==="dress"){
    part(hips,.76,.49,.48,top,0,-.08,0,.11);
    part(hips,.81,.11,.52,accent,0,-.30,0,.035);
    part(hips,.6,.04,.036,mat(0xe8cba6),0,.09,.275);
    for(const side of [-1,1])part(hips,.034,.25,.024,accent,side*.29,-.06,.269,.012);
  }
  // Premium garment overlays preserve the known animation skeleton and save schema.
  const sculptParams={...p,skinHex:SKINS[p.skin],hairHex:HAIR[p.hair],colorHex:COLORS[p.color],shoeHex:p.shoeColor>=0?COLORS[p.shoeColor]:null,bottomHex:p.bottomColor>=0?COLORS[p.bottomColor]:null,glassesHex:COLORS[p.glassesColor]};
  const kit={part,orb,mat};
  sculptWardrobe(hips,sculptParams,kit);
  // Dense 3D microvoxel stitchwork on the complete garment, front AND back.
  sculptGarmentVoxels(hips,sculptParams);
  // The original rig is kept; only visible face/hair/eyes are resculpted.
  part(hips,.20,.17,.21,skin,0,.83,0,.056);
  const headPivot=new THREE.Group();headPivot.position.set(0,.96,.01);
  headPivot.scale.setScalar(1.08);hips.add(headPivot);
  sculptHead(headPivot,sculptParams,kit);
  // Real modeled voxels sculpt the expressive face and stepped full-volume hair.
  sculptFaceVoxels(headPivot,sculptParams);
  sculptHairVoxels(headPivot,sculptParams);
  // Seams, embroidered cuffs and a miniature pocket create believable
  // contemporary garments when seen close-up in the 3D avatar studio.
  if(!isEthnic&&p.outfit!=="dress"){
    for(const side of [-1,1]){
      part(hips,.11,.035,.032,accent,side*.225,.015,.242,.009);
    }
  }
  // Animated shoulder and elbow joints. Both arms attach to torso.
  function arm(side){
    const pivot=new THREE.Group();pivot.position.set(side*.39*width,.64,0);hips.add(pivot);
    const sleeveLong=["suit","shirt","salwar","sweater","jacket","bomber","blazer"].includes(p.outfit);
    const sleeve=part(pivot,(sleeveLong?.256:.245)*width,sleeveLong?.365:.245,
      .32,top,side*.018,-.17,0,.11);
    const seam=part(pivot,.254*width,.055,.335,
      sleeveLong?accent:mat(0xe7d4c4),side*.018,sleeveLong?-.348:-.27,0,.02);
    const lower=new THREE.Group();lower.position.y=-.36;pivot.add(lower);
    if(sleeveLong){
      part(lower,.19,.19,.25,top,0,-.09,0,.06);
      part(lower,.216,.055,.27,accent,0,-.21,0,.025);
      part(lower,.21,.125,.27,skin,0,-.302,.02,.077);
    }else part(lower,.18,.25,.24,skin,0,-.13,0,.085);
    // Independently articulated wrist/palm/fingers; the wave happens beside
    // the head rather than by swinging a rigid arm through the face.
    const wrist=new THREE.Group();wrist.position.set(0,-.308,.04);lower.add(wrist);
    part(wrist,.235,.18,.266,skin,0,0,0,.088);
    for(const finger of [-1,0,1])
      part(wrist,.065,.105,.085,skin,finger*.068,-.102,.075,.032);
    part(wrist,.077,.13,.11,skin,side*.126,0,.04,.036).rotation.z=side*.26;
    // Details stay attached to the upper arm and bending elbow as they animate.
    sculptSleeveVoxels(pivot,lower,sculptParams,side);
    return {pivot,lower,wrist};
  }
  const left=arm(-1),right=arm(1);
  // Small real 3D props, rigged to the moving wrist. Only the active
  // eat/drink prop is visible, avoiding per-frame geometry creation.
  const coffeeProp=new THREE.Group();
  coffeeProp.position.set(.03,-.12,.13);
  const mugMat=mat(0xf0eee9,.63),drinkMat=mat(0x754b35,.92);
  const mug=new THREE.Mesh(new THREE.CylinderGeometry(.108,.094,.20,10),mugMat);
  mug.position.y=.09;coffeeProp.add(mug);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.105,.016,6,16),mat(0xd4b27d,.42));
  rim.rotation.x=Math.PI/2;rim.position.y=.195;coffeeProp.add(rim);
  const drinkSurface=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.008,10),drinkMat);
  drinkSurface.position.y=.195;coffeeProp.add(drinkSurface);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.065,.019,6,12),mugMat);
  handle.position.set(.137,.11,0);coffeeProp.add(handle);
  const appleProp=new THREE.Group();appleProp.position.set(.01,-.11,.13);
  const apple=new THREE.Mesh(new THREE.SphereGeometry(.125,10,8),mat(0xd1494e,.70));
  apple.scale.set(.96,.92,.98);apple.position.y=.105;appleProp.add(apple);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.015,.065,5),mat(0x58432c));
  stem.position.y=.247;appleProp.add(stem);
  const leaf=new THREE.Mesh(new THREE.BoxGeometry(.11,.024,.055),mat(0x438b54));
  leaf.position.set(.047,.25,0);leaf.rotation.z=.35;appleProp.add(leaf);
  right.wrist.add(coffeeProp,appleProp);coffeeProp.visible=appleProp.visible=false;
  function leg(side){
    const pivot=new THREE.Group();pivot.position.set(side*.17,-.18,0);hips.add(pivot);
    const loose=p.bottom==="palazzo"||p.outfit==="salwar"&&p.bottom!=="leggings";
    const tight=p.bottom==="leggings";
    const legWidth=(loose?.31:tight?.205:.245)*width;
    part(pivot,legWidth,.54,loose?.37:.32,bottom,0,-.255,0,.10);
    // Garment geometry extends right around the leg rather than acting as a
    // front-only decal. Trouser break above the shoe is individually modeled.
    const cuff=part(pivot,legWidth+.027,.083,loose?.385:.345,
      p.outfit==="salwar"?accent:bottom,0,-.50,0,.034);
    if(loose)part(pivot,legWidth+.06,.048,.40,accent,0,-.534,0,.02);
    // Jeans/trouser texture: slim vertical seam and fabric cuff.
    if(!loose){
      part(pivot,.014,.36,.02,mat(0x627589),side*.08,-.29,.163,.007);
      part(pivot,legWidth+.018,.05,.325,mat(0x5a6670),0,-.49,0,.018);
    }
    sculptFoot(pivot,sculptParams,kit);
    sculptShoeVoxels(pivot,sculptParams);
    return pivot;
  }
  const lLeg=leg(-1),rLeg=leg(1);
  const data={group:root,parameters:p,head:headPivot,hips,left,right,lLeg,rLeg,action:"",actionStart:0,actionDuration:0,seated:false,activity:"idle"};
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
    left.lower.rotation.z=0;right.lower.rotation.z=0;
    left.wrist.rotation.z=0;right.wrist.rotation.z=0;
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
    coffeeProp.visible=data.activity==="coffee"&&!moving&&!actionActive;
    appleProp.visible=data.activity==="apple"&&!moving&&!actionActive;
    // Autonomous office routines use the same articulated skeleton as
    // player animations. NPCs type, sip coffee, eat apples and converse.
    if(!moving&&!actionActive){
      const beat=Math.sin(time*8),slow=Math.sin(time*2.9);
      if(data.activity==="typing"){
        left.pivot.rotation.x=-.84+beat*.10;
        right.pivot.rotation.x=-.86-beat*.10;
        left.pivot.rotation.z=.14;right.pivot.rotation.z=-.14;
        left.lower.rotation.x=-.63+beat*.07;
        right.lower.rotation.x=-.63-beat*.07;
        left.wrist.rotation.z=beat*.09;
        right.wrist.rotation.z=-beat*.09;
        headPivot.rotation.x=.15+Math.sin(time*.7)*.025;
      }else if(data.activity==="coffee"||data.activity==="apple"){
        right.pivot.rotation.x=-1.02+slow*.13;
        right.pivot.rotation.z=-.58;
        right.lower.rotation.x=-1.15+slow*.15;
        right.wrist.rotation.z=-.15;
        headPivot.rotation.x=-.03+slow*.028;
      }else if(data.activity==="talk"){
        left.pivot.rotation.x=-.25+Math.sin(time*3.4)*.23;
        left.pivot.rotation.z=.33+Math.sin(time*2.4)*.18;
        right.pivot.rotation.x=-.31+Math.sin(time*2.8)*.2;
        right.pivot.rotation.z=-.18;
        headPivot.rotation.y=Math.sin(time*2.1)*.08;
      }
    }
    if(actionActive){
      coffeeProp.visible=false;appleProp.visible=false;
      const wave=Math.sin(motion*12);
      if(data.action==="hi"){
        // Positive shoulder Z raises the RIGHT arm OUTWARDS. Negative Z
        // previously put the hand behind the face when viewed from the front.
        const phase=Math.min(1,motion/.30,(data.actionDuration-motion)/.27);
        const ease=Math.sin(Math.max(0,Math.min(1,phase))*Math.PI/2);
        right.pivot.rotation.z=.07+(2.14-.07)*ease;
        right.pivot.rotation.x=-.24*ease;
        right.lower.rotation.z=.53*ease;
        right.lower.rotation.x=-.17*ease;
        right.wrist.rotation.z=wave*.31*ease;
        headPivot.rotation.z=-.035*ease;
      }else if(data.action==="dance"){
        hips.rotation.z=Math.sin(motion*9)*.17;
        hips.position.y+=Math.abs(Math.sin(motion*9))*.1;
        lLeg.rotation.x=Math.sin(motion*9)*.48;rLeg.rotation.x=-lLeg.rotation.x;
        left.pivot.rotation.z=-1.05+Math.sin(motion*9)*.55;
        right.pivot.rotation.z=1.05+Math.sin(motion*9+2)*.55;
        headPivot.rotation.z=Math.sin(motion*9)*.13;
      }else if(data.action==="clap"){
        // Raise forearms INWARD in front of the chest. The previous shoulder
        // signs extended both arms away from one another, so no clap occurred.
        const together=Math.pow(Math.abs(wave),.7);
        left.pivot.rotation.z=1.04+together*.17;
        right.pivot.rotation.z=-1.04-together*.17;
        left.pivot.rotation.x=-.90;
        right.pivot.rotation.x=-.90;
        left.lower.rotation.z=-.30+together*.12;
        right.lower.rotation.z=.30-together*.12;
        left.wrist.rotation.z=.10;
        right.wrist.rotation.z=-.10;
      }else if(data.action==="cheer"){
        left.pivot.rotation.z=-2.5+wave*.18;right.pivot.rotation.z=2.5-wave*.18;
        hips.position.y+=Math.abs(wave)*.08;
      }
    }else data.action="";
  };
  data.setActivity=name=>{data.activity=["idle","typing","coffee","apple","talk"].includes(name)?name:"idle";};
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
    bottom:["jeans","trousers","leggings","palazzo"][(hash>>>11)%4],
    height:.91+((hash>>>23)%16)/100,build:.9+((hash>>>27)%22)/100
  };
  return resolve({...fallback,...(person.avatar&&typeof person.avatar==="object"?person.avatar:{})});
}
