import * as THREE from "three";

/**
 * A tiny-draw-call companion to the detailed rigged game characters.
 *
 * All seated coworkers, including the farthest ones, get a cute expressive
 * three-dimensional face, layered hair and outfit-specific silhouettes.
 * Thousands of doll components are drawn with only THREE instanced meshes,
 * never hundreds of separate generic box-shaped placeholder avatars.
 *
 * The closest people are replaced by the fully rigged character model in
 * main.js; the same saved avatar appearance drives both representations.
 */
const SKINS=[0xf1c69e,0xddad84,0xbc805d,0x955d46,0x714331];
const HAIRS=[0x1a1419,0x2c201c,0x50342b,0x392323,0x171921];
const COLORS=[0x4c816c,0xc75b65,0x385883,0xd19d49,0x765e8d,0xe1ddd4];
const dark=0x272a36,white=0xfff5e9,gloss=0xffffff,blush=0xd99785,gold=0xe3c17e;
const skinAt=i=>SKINS[Math.max(0,Math.min(SKINS.length-1,Number(i)||0))];
const hairAt=i=>HAIRS[Math.max(0,Math.min(HAIRS.length-1,Number(i)||0))];
const clothAt=i=>COLORS[Math.max(0,Math.min(COLORS.length-1,Number(i)||0))];

function roundedCube(){
  const r=.135,shape=new THREE.Shape();
  shape.moveTo(-.5+r,-.5);shape.lineTo(.5-r,-.5);
  shape.quadraticCurveTo(.5,-.5,.5,-.5+r);
  shape.lineTo(.5,.5-r);shape.quadraticCurveTo(.5,.5,.5-r,.5);
  shape.lineTo(-.5+r,.5);shape.quadraticCurveTo(-.5,.5,-.5,.5-r);
  shape.lineTo(-.5,-.5+r);shape.quadraticCurveTo(-.5,-.5,-.5+r,-.5);
  const g=new THREE.ExtrudeGeometry(shape,{depth:.92,steps:1,bevelEnabled:true,
    bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:3});
  g.center();return g;
}
const GEOMETRIES={
  soft:roundedCube(),
  cube:new THREE.BoxGeometry(1,1,1),
  jewel:new THREE.IcosahedronGeometry(1,1)
};
const tmpP=new THREE.Vector3(),tmpS=new THREE.Vector3(),tmpE=new THREE.Euler();
const tmpQ=new THREE.Quaternion(),tmpLocal=new THREE.Matrix4();
const tmpWorld=new THREE.Matrix4(),tmpMatrix=new THREE.Matrix4();
const tempColor=new THREE.Color();

function descriptors(p){
  const out=[],skin=skinAt(p.skin),hair=hairAt(p.hair),
        primary=p.outfit==="suit"?0x344760:clothAt(p.color),
        pants=p.outfit==="salwar"?(p.bottom==="leggings"?0xf3e2d0:0xf3dfc8):
              p.outfit==="suit"?0x28374b:
              p.bottom==="jeans"?0x355475:
              p.bottom==="palazzo"?0xe1cbb9:
              p.bottom==="leggings"?0x3b3c4e:0x435061,
        feminine=p.gender==="female";
  const add=(shape,x,y,z,w,h,d,color,rot=0)=>{
    out.push({shape,x,y,z,w,h,d,color,rot});
  };
  const soft=(...v)=>add("soft",...v),cube=(...v)=>add("cube",...v);
  const jewel=(x,y,z,r,col,sx=1,sy=1,sz=1)=>{
    add("jewel",x,y,z,r*sx,r*sy,r*sz,col);
  };
  // Rounded footwear and naturally seated legs.
  for(const side of [-1,1]){
    const shoeColor=p.outfit==="suit"?0x403b39:
      p.outfit==="salwar"?0x986b54:0xf1ebe2;
    soft(side*.18,.11,.26,.30,.12,.46,shoeColor);
    soft(side*.18,.075,.29,.31,.054,.48,p.outfit==="suit"?0x272931:0xf9f8f2);
    soft(side*.17,.44,.19,p.bottom==="palazzo"?.30:.25,.50,.33,pants);
    cube(side*.17,.25,.37,.24,.10,.34,pants);
  }
  soft(0,.64,0,.56,.30,.43,pants);
  // Wider shoulders and smaller limbs establish the friendly chibi silhouette.
  const torsoW=(feminine?.70:.77)*Number(p.build||1);
  soft(0,1.05,0,torsoW,.70,.50,primary);
  if(p.outfit==="dress"||p.outfit==="salwar"){
    soft(0,.83,0,p.outfit==="dress"?.82:.79,.50,.57,primary);
    cube(0,.60,.03,.76,.06,.56,0xeac18a);
    for(const side of [-1,1]){
      cube(side*.32,.84,.299,.042,.32,.028,0xf6d3a9);
    }
  }
  if(p.outfit==="salwar"){
    soft(-.31,1.02,.30,.155,.73,.11,0xe9b884,-.06);
    cube(-.30,.74,.37,.16,.035,.14,gold);
    for(let i=0;i<4;i++)jewel(0,1.30-i*.13,.267,.017,gold);
  }else if(p.outfit==="suit"){
    cube(0,1.12,.258,.23,.49,.035,white);
    soft(-.14,1.20,.302,.25,.38,.07,0x556880,.25);
    soft(.14,1.20,.302,.25,.38,.07,0x556880,-.25);
    cube(0,1.21,.335,.07,.33,.025,0xad6570);
  }else if(p.outfit==="shirt"){
    cube(0,1.12,.269,.025,.47,.026,0xf3e1d0);
    for(let i=0;i<3;i++)jewel(0,1.22-i*.12,.291,.017,0xd4b896);
    soft(0,1.40,.15,.27,.09,.22,0xe7d5c7);
  }else if(p.outfit==="sweater"){
    for(let i=0;i<4;i++)cube(0,1.0+i*.13,.27,.60,.031,.024,
      i%2?0xf0d6a6:0xd77a7d);
  }else if(p.outfit==="tshirt"){
    soft(0,1.16,.269,.24,.18,.025,0xe6c89d);
    cube(0,1.14,.29,.10,.05,.02,0x648785);
  }else if(p.outfit==="dress"){
    cube(0,.79,.29,.75,.04,.034,gold);
  }
  for(const side of [-1,1]){
    soft(side*(torsoW/2+.08),1.10,.025,.25,.37,.31,primary,
      side*.09);
    soft(side*(torsoW/2+.07),.86,.16,.19,.25,.24,skin);
    jewel(side*(torsoW/2+.07),.73,.17,.12,skin,.78,1,.8);
  }
  // Badge and understated lanyard; same motif as full-res person.
  cube(-.10,1.01,.295,.015,.32,.018,0xdbbb72,-.16);
  soft(-.14,.93,.309,.15,.15,.023,white);
  cube(-.14,.975,.334,.12,.028,.014,0x59958a);
  soft(0,1.46,0,.22,.20,.21,skin);
  // A much larger and softer toy-like head; half of its value is the
  // recognizable big-haired silhouette seen from behind the character.
  soft(0,1.84,-.01,.85,.74,.70,skin);
  soft(0,1.57,.015,.69,.20,.65,skin);
  for(const side of [-1,1]){
    soft(side*.435,1.80,0,.13,.22,.19,skin);
    jewel(side*.315,1.735,.35,.095,blush,1,.55,.23);
    // Expressive enlarged eye design: sclera, dark iris and catchlights.
    jewel(side*.18,1.875,.371,.100,white,.98,.99,.35);
    jewel(side*.18+.014,1.872,.396,.077,0x4a3b37,.85,.96,.48);
    jewel(side*.18+.018,1.873,.437,.049,0x252331,1,1,.45);
    jewel(side*.18-.026,1.912,.451,.027,gloss,.7,.8,.47);
    cube(side*.18,2.013,.383,.20,.043,.035,hair,-side*.09);
  }
  jewel(0,1.758,.407,.050,skin,.80,.83,.65);
  soft(0,1.665,.389,.17,.027,.025,feminine?0x995463:0x8f5e55);
  for(const side of [-1,1])jewel(side*.08,1.681,.401,.022,0xac5f60);
  if(p.glasses){
    const frame=0x51413d;
    for(const side of [-1,1]){
      const x=side*.18;
      cube(x,1.976,.439,.226,.024,.033,frame);
      cube(x,1.803,.439,.226,.024,.033,frame);
      for(const dx of [-.112,.112])
        cube(x+dx,1.89,.436,.025,.176,.031,frame);
    }
    cube(0,1.913,.450,.137,.026,.03,frame);
  }
  // More sculpted, readable cap and hair locks at all distances.
  soft(0,2.224,-.045,.91,.24,.79,hair);
  soft(0,2.12,-.33,.84,.22,.23,hair);
  for(let j=0;j<5;j++){
    const x=(j-2)*.168;
    soft(x,2.148-(j%2)*.035,.33,.19,.16,.18,hair,(j-2)*-.035);
  }
  for(const side of [-1,1]){
    soft(side*.396,2.066,-.05,.165,.32,.54,hair);
    if(p.hairstyle===0&&feminine)
      soft(side*.405,1.755,-.16,.18,.35,.29,hair,side*.09);
  }
  if(p.hairstyle===1){
    soft(0,1.915,-.4,.78,.42,.28,hair);
    for(const side of [-1,1])
      soft(side*.405,1.77,-.24,.18,.44,.28,hair);
  }else if(p.hairstyle===2){
    soft(0,1.65,-.40,.83,.83,.28,hair);
    for(const side of [-1,1])for(let j=0;j<2;j++)
      soft(side*(.32+j*.07),1.62-j*.11,-.23-j*.06,
        .145,.81,.26,hair,side*j*.04);
  }else if(p.hairstyle===3){
    soft(0,1.98,-.42,.77,.36,.26,hair);
    soft(.30,1.78,-.49,.24,.38,.26,hair);
    for(let j=0;j<3;j++)
      soft(.35,1.53-j*.145,-.52,.19,.26,.23,hair,.10);
    cube(.35,1.83,-.45,.25,.05,.21,gold);
  }
  // Earrings and festive outfits are small but still actually 3D.
  if(feminine)for(const side of [-1,1])
    jewel(side*.463,1.66,.048,.049,gold,.8,1.1,.53);
  if(!feminine&&p.hairstyle===1){
    for(const side of [-1,1])
      soft(side*.31,1.59,.25,.09,.16,.09,hair);
    soft(0,1.63,.386,.22,.045,.06,hair);
  }
  return out;
}

export function createInstancedCrowd(people){
  const group=new THREE.Group();
  group.name="Expressive seated voxel coworkers (instanced)";
  const byType={soft:[],cube:[],jewel:[]};
  const source=people||[];
  for(let i=0;i<source.length;i++){
    const person=source[i],p=person.appearance||{},seat=person.seat;
    if(!seat)continue;
    const root=new THREE.Matrix4().makeRotationY(seat.facing);
    root.setPosition(seat.position.x,0,seat.position.z);
    const height=Math.max(.86,Math.min(1.16,Number(p.height)||1));
    for(const obj of descriptors(p)){
      tmpP.set(obj.x*height,obj.y*height,obj.z*height);
      tmpE.set(0,0,obj.rot||0);
      tmpQ.setFromEuler(tmpE);
      tmpS.set(obj.w*height,obj.h*height,obj.d*height);
      tmpLocal.compose(tmpP,tmpQ,tmpS);
      tmpMatrix.multiplyMatrices(root,tmpLocal);
      byType[obj.shape].push({owner:i,matrix:tmpMatrix.clone(),color:obj.color});
    }
  }
  const meshes=[],invisible=new THREE.Matrix4().makeScale(.00001,.00001,.00001);
  for(const kind of Object.keys(byType)){
    const parts=byType[kind];if(!parts.length)continue;
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.79,metalness:0,
      flatShading:kind==="jewel"});
    const mesh=new THREE.InstancedMesh(GEOMETRIES[kind],material,parts.length);
    mesh.name="Crowd "+kind+" · "+parts.length+" voxels";
    mesh.castShadow=false;
    mesh.receiveShadow=true;
    mesh.frustumCulled=false; // never cull the whole crowd because one wing is out of view
    for(let i=0;i<parts.length;i++){
      mesh.setMatrixAt(i,parts[i].matrix);
      mesh.setColorAt(i,tempColor.setHex(parts[i].color));
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    group.add(mesh);meshes.push({mesh,parts});
  }
  let activeKey="";
  const setDetailed=(indices)=>{
    const active=indices instanceof Set?indices:new Set(indices);
    const key=[...active].sort((a,b)=>a-b).join(",");
    if(key===activeKey)return;
    activeKey=key;
    for(const {mesh,parts} of meshes){
      for(let i=0;i<parts.length;i++){
        const part=parts[i];
        mesh.setMatrixAt(i,active.has(part.owner)?invisible:part.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    }
  };
  const dispose=()=>{
    for(const {mesh} of meshes){
      group.remove(mesh);mesh.material.dispose();mesh.dispose?.();
    }
  };
  return {group,setDetailed,dispose,count:source.length,
    voxelParts:Object.values(byType).reduce((sum,arr)=>sum+arr.length,0),
    drawBatches:meshes.length};
}
