import * as THREE from "three";
import {decorateWorkstation,addWarmOfficeDetails} from "./environment-art.js";
// Fully procedural office furniture, lights and festive scenery; no external models.
const boxGeo=new THREE.BoxGeometry(1,1,1);
boxGeo.userData.officeInstancing=true;
const cachedBallGeometries=new Map();
const matCache=new Map();
const mat=(hex,opts={})=>{
  const key=hex+"|"+(opts.metalness||0)+"|"+(opts.roughness??.74)+"|"+(opts.emissive||0);
  if(!matCache.has(key))matCache.set(key,new THREE.MeshStandardMaterial({color:hex,roughness:opts.roughness??.74,metalness:opts.metalness??0,emissive:opts.emissive??0,emissiveIntensity:opts.emissive?0.9:0}));
  return matCache.get(key);
};
function block(parent,x,y,z,w,h,d,color,cast=true){
  const m=new THREE.Mesh(boxGeo,typeof color==="number"?mat(color):color);
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
const beveledGeometryCache=new Map();
function softBlock(parent,x,y,z,w,h,d,color,rounding=.115,cast=true){
  // A beveled block is still authored voxel geometry. Shared across desks
  // and chairs so the more polished silhouette costs few extra draw calls.
  const radius=Math.min(.21,Math.max(.03,rounding)),key=radius.toFixed(3);
  if(!beveledGeometryCache.has(key)){
    const shape=new THREE.Shape(),r=radius;
    shape.moveTo(-.5+r,-.5);
    shape.lineTo(.5-r,-.5);shape.quadraticCurveTo(.5,-.5,.5,-.5+r);
    shape.lineTo(.5,.5-r);shape.quadraticCurveTo(.5,.5,.5-r,.5);
    shape.lineTo(-.5+r,.5);shape.quadraticCurveTo(-.5,.5,-.5,.5-r);
    shape.lineTo(-.5,-.5+r);shape.quadraticCurveTo(-.5,-.5,-.5+r,-.5);
    const bevel=Math.min(.042,r*.34);
    const geometry=new THREE.ExtrudeGeometry(shape,{
      depth:1-2*bevel,steps:1,curveSegments:3,
      bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2
    });
    geometry.center();geometry.userData.officeInstancing=true;
    beveledGeometryCache.set(key,geometry);
  }
  const m=new THREE.Mesh(beveledGeometryCache.get(key),typeof color==="number"?mat(color):color);
  m.position.set(x,y,z);m.scale.set(w,h,d);
  m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function ball(parent,x,y,z,r,color,detail=0){
  const key=r.toFixed(4)+":"+detail;
  if(!cachedBallGeometries.has(key)){
    const geometry=new THREE.IcosahedronGeometry(r,detail);
    geometry.userData.officeInstancing=true;
    cachedBallGeometries.set(key,geometry);
  }
  const m=new THREE.Mesh(cachedBallGeometries.get(key),typeof color==="number"?mat(color):color);
  m.position.set(x,y,z);m.castShadow=r>.2;parent.add(m);return m;
}
function cyl(parent,x,y,z,rTop,rBottom,height,color,segments=10){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),mat(color));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function picture(parent,side,z,color){
  block(parent,side,2.35,z,.05,.64,.57,0x754d3f,false);
  block(parent,side+Math.sign(-side)*.03,2.35,z,.014,.51,.44,color,false);
}
function present(parent,x,z,size,seed){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const color=[0xd95d63,0x438d72,0xd3a35d,0x728dba][seed%4];
  block(g,0,size*.45,0,size,size*.9,size,color);
  block(g,0,size*.92,0,size*1.06,.11,size*1.06,0xf8e7bd);
  block(g,0,size*.54,0,size*.17,size*.9,size*1.1,0xeacf8c);
  block(g,0,size*.54,0,size*1.1,size*.9,size*.17,0xeacf8c);
  const bow=ball(g,-.12,size+0.09,0,.12,0xf4dba7);bow.scale.set(1.3,.6,1);
  const bow2=ball(g,.12,size+.09,0,.12,0xf4dba7);bow2.scale.set(1.3,.6,1);
}
function tree(parent,x,z,scale=1){
  // Detailed stepped voxel evergreen rather than a single low-poly cone.
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  const leaf=[0x276a4c,0x2e7b53,0x34865d,0x245e45];
  cyl(g,0,.27,0,.15,.19,.54,0x76533d);
  for(let tier=0;tier<6;tier++){
    const y=.69+tier*.44,reach=1.24-tier*.17;
    const green=leaf[tier%leaf.length];
    block(g,0,y,0,reach*1.63,.43,reach*1.63,green);
    block(g,0,y-.10,0,reach*1.98,.20,reach*1.22,green);
    block(g,0,y-.10,0,reach*1.22,.20,reach*1.98,green);
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4+tier*.24,rr=reach*.77;
      const ornament=ball(g,Math.cos(angle)*rr,y-.10+((i%2)*.11),Math.sin(angle)*rr,.082+(i%3)*.01,
        i%4===0?mat(0xf9cd73,{emissive:0x7e480d}):
        i%4===1?0xdf666b:i%4===2?0x91b9c7:0xffebc6,1);
      ornament.castShadow=false;
    }
    // Gold ribbon crosses the foliage and is visible from every camera angle.
    if(tier%2===0){
      block(g,0,y+.09,reach*.72,reach*1.5,.034,.035,mat(0xf1c978,{metalness:.15}),false);
      block(g,reach*.72,y+.09,0,.035,.034,reach*1.5,mat(0xf1c978,{metalness:.15}),false);
    }
  }
  // 5-point star in the front-facing plane, with a warm emissive center.
  const outline=new THREE.Shape();
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?.27:.12;
    const px=Math.cos(a)*r,py=Math.sin(a)*r;
    if(i===0)outline.moveTo(px,py);else outline.lineTo(px,py);
  }
  outline.closePath();
  const star=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{
    depth:.09,bevelEnabled:true,bevelThickness:.035,bevelSize:.025,bevelSegments:2,steps:1
  }),mat(0xffdd83,{emissive:0xd39b46,metalness:.13}));
  star.position.set(0,3.25,0);star.castShadow=false;g.add(star);
  const light=new THREE.PointLight(0xffbc6d,1.7,6.5);light.position.set(0,2.2,.4);g.add(light);
  for(let i=0;i<12;i++){
    const angle=i*Math.PI*2/12,rad=1.0+(i%3)*.15;
    present(g,Math.cos(angle)*rad,Math.sin(angle)*rad,.21+(i%3)*.10,i);
  }
  return g;
}
function plant(parent,x,z,scale=1){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cyl(g,0,.27,0,.24,.17,.52,0xf4eddf);
  cyl(g,0,.49,0,.22,.24,.05,0xe0ccad);
  cyl(g,0,.76,0,.04,.06,.5,0x568363);
  for(let i=0;i<6;i++){
    const a=i*6.283/6;
    const leaf=ball(g,Math.sin(a)*.24,.87+(i%3)*.12,Math.cos(a)*.24,.22,0x4c9361);
    leaf.scale.set(1.05,.58,.75);
  }
  return g;
}
function wreath(parent,x,y,z,rot=0){
  const ring=new THREE.Group();ring.position.set(x,y,z);ring.rotation.y=rot;parent.add(ring);
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    ball(ring,Math.cos(a)*.3,Math.sin(a)*.3,0,.15,i%4===0?0x3b9967:0x306c51);
    if(i%4===0)ball(ring,Math.cos(a)*.3,Math.sin(a)*.3,.13,.055,0xe66f68);
  }
  block(ring,0,-.33,.03,.27,.11,.08,0xc84e5c);
  return ring;
}
function garland(parent,z,x0,x1,y=3.5,twinkle=[]){
  const n=Math.max(8,Math.ceil((x1-x0)/.42));
  for(let i=0;i<=n;i++){
    const t=i/n,x=x0+t*(x1-x0),yy=y-.28*Math.sin(t*Math.PI);
    const orb=ball(parent,x,yy,z,.11,i%3?0x3c8154:0x28694a);
    orb.scale.set(1.2,.72,.82);
    if(i%3===0){
      const l=ball(parent,x,yy-.13,z+.02,.045,mat(i%2?0xfad177:0xffaca8,{emissive:0xe69847}),1);
      twinkle.push(l);
    }
  }
  for(const t of [.28,.66]){
    const x=x0+t*(x1-x0);
    block(parent,x,y-.25*Math.sin(t*Math.PI)-.12,z,.09,.27,.12,0xba4550);
    block(parent,x-.10,y-.25*Math.sin(t*Math.PI)-.08,z,.27,.09,.12,0xba4550);
  }
}
/**
 * Real breaks in the west perimeter wall: a door after every fourth
 * single-sided workstation, including after the last bay of a full group.
 * Openings have frames, lintels and a shallow lit room glimpse beyond.
 * The hall remains the playable footprint until adjacent rooms are built.
 */
/**
 * A plain structural passage every four workstation bays. It is intentionally
 * a dark NON-PLAYABLE blackbox: no door leaves, handles, little rooms or alcoves.
 * The wall is physically interrupted, while the A* grid stays inside the hall.
 */
function westWallPassages(parent,left,front,back,passageCenters){
  const width=2.05, half=width/2, wallX=left-.14;
  let start=front;
  for(const center of passageCenters){
    const from=center-half,to=center+half;
    if(from>start)block(parent,wallX,2.15,(from+start)/2,.23,4.3,from-start,0xf7eee9,false);
    // A dark unlit void set just beyond the open wall line, without any modeled room.
    block(parent,left-.54,1.48,center,.035,2.95,width+.08,
      new THREE.MeshBasicMaterial({color:0x07080a,side:THREE.DoubleSide}),false);
    // Plain wall return edges, not a door frame.
    block(parent,wallX,3.62,center,.23,1.36,width,0xf7eee9,false);
    block(parent,wallX+.02,1.47,from-.06,.24,2.94,.12,0xf7eee9,false);
    block(parent,wallX+.02,1.47,to+.06,.24,2.94,.12,0xf7eee9,false);
    start=to;
  }
  if(back>start)block(parent,wallX,2.15,(start+back)/2,.23,4.3,back-start,0xf7eee9,false);
}
function wallGarland(parent,x,from,to,y=3.75,twinkle=[]){
  const n=Math.max(8,Math.ceil((to-from)/.55));
  for(let i=0;i<=n;i++){
    const t=i/n,z=from+t*(to-from),yy=y-.14*Math.sin(t*Math.PI*3);
    const leaf=ball(parent,x,yy,z,.095,i%3?0x32754e:0x478a5a);
    leaf.scale.set(.7,.75,1.35);
    if(i%4===0){
      const light=ball(parent,x+.06,yy-.08,z,.05,mat(i%2?0xffd981:0xffa6a0,{emissive:0xe8a74d}),1);
      twinkle.push(light);
    }
  }
}
function chair(parent,x,z,face=1,variant=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face;parent.add(g);
  const dark=variant%2?0x354351:0x405267;
  cyl(g,0,.30,0,.055,.05,.47,0x484c56);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;block(g,Math.cos(a)*.34,.095,Math.sin(a)*.34,.12,.05,.12,0x444b54);}
  // Rounded padded seat, curved-looking double cushion and visible headrest.
  softBlock(g,0,.55,0,.53,.13,.47,dark,.19);
  softBlock(g,0,.97,-.21,.54,.75,.13,dark,.19);
  softBlock(g,0,1.27,-.23,.44,.20,.16,0x566377,.18);
  softBlock(g,0,.97,-.125,.39,.49,.055,variant%2?0x475766:0x50667a,.11,false);
  block(g,-.28,.72,-.02,.075,.13,.4,0x5e6471);
  block(g,.28,.72,-.02,.075,.13,.4,0x5e6471);
  for(const side of [-1,1])ball(g,side*.35,.095,.08,.063,0x353c45);
  return g;
}
function workstation(parent,x,z,i,row,colliders){
  // Width of the desk is along the row (z): its LONG EDGE faces the seated employee.
  // W and R sit east of their desks and face WEST; L sits west and faces EAST.
  const chairSide=row==="L"?-1:1;
  const facing=row==="L"?Math.PI/2:-Math.PI/2;
  const left=-chairSide;
  const chairX=x+chairSide*.9;
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const oak=mat(0xc69d73),white=mat(0xf4f0e9);
  softBlock(g,0,.76,0,.73,.075,1.52,oak,.12);
  // A walnut edge with a satin metallic inlay makes the desk read as
  // contemporary modular office furniture rather than stacked boxes.
  block(g,chairSide*.34,.735,0,.017,.028,1.50,0xd6be9c,false);
  block(g,-chairSide*.34,.737,0,.014,.028,1.49,0x9b775e,false);
  softBlock(g,0,.38,-.66,.62,.68,.08,white,.09);
  softBlock(g,0,.38,.66,.62,.68,.08,white,.09);
  block(g,0,.18,0,.52,.22,1.3,mat(0xeae5dc));
  softBlock(g,0,1.1,0,.045,.52,1.42,row==="W"?0xefe5d7:0xe9d7bf,.12,false);
  // Monitors face the employee (west/east), with long edge of desk fronting the chair.
  const screenX=-left*.13;
  block(g,screenX,.98,-.22,.09,.45,.62,0x343d48);
  block(g,screenX+left*.05,.99,-.22,.015,.37,.53,mat(i%3?0x6a9cae:0x568c88,{emissive:0x174459}),false);
  block(g,screenX,1.02,-.22,.03,.22,.23,0x1d5470,false);
  block(g,screenX,1.17,-.22,.035,.09,.12,0xb0c8d0,false);
  block(g,screenX,.83,-.22,.055,.10,.05,0x5b6674);
  block(g,left*.20,.81,-.27,.24,.018,.42,0xd0c8be,false);
  // Tiny sculpted keyboard keys and mouse, all aligned with the long desk edge.
  for(let key=0;key<7;key++){
    block(g,left*.21,.832,-.44+key*.048,.13,.008,.030,
      key%3?0xeeeae4:0xbec6c3,false);
  }
  const mouse=ball(g,left*.23,.827,.02,.045,0xe4e8e3);
  mouse.scale.set(.55,.26,.83);mouse.castShadow=false;
  block(g,left*.19,.828,.02,.07,.008,.14,0xf5eddf,false);
  // Rich workstation clutter but no unsolicited cultural landmark artwork.
  block(g,.04,.83,.42,.28,.05,.23,0xf4d8ab);
  block(g,.04,.865,.42,.11,.016,.08,0xc4b49b);
  // Festive micro-accessory beside the everyday stationery.
  if(i%4===0){
    block(g,.13,.86,.52,.14,.14,.12,0xcf5c62);
    block(g,.13,.95,.52,.15,.03,.14,0xf1cf85);
    block(g,.13,.88,.52,.025,.16,.14,0xeed5ac);
  }else if(i%4===2){
    block(g,.13,.835,.53,.17,.04,.15,0x4d8870);
    ball(g,.13,.88,.53,.06,mat(0xffd88a,{emissive:0xb68223}));
  }
  cyl(g,.21,.84,.33,.08,.07,.13,0xffffff,10);
  cyl(g,.21,.89,.33,.065,.06,.012,0xc66e62,10);
  if(i%3===0){
    cyl(g,-.18,.86,.5,.10,.08,.14,0xe9d7bc,8);
    for(let k=0;k<4;k++)ball(g,-.18+(k-1.5)*.05,.98,.5,.075,0x4a9b66);
  }else if(i%3===1){
    block(g,-.17,.85,.5,.23,.07,.30,0x5579a6);
    block(g,-.17,.9,.5,.19,.015,.27,0xe9e6d9);
  }else{
    block(g,-.15,.84,.51,.25,.04,.23,0xc76161);
    ball(g,-.15,.91,.51,.08,0x93ad65);
  }
  decorateWorkstation(g,{seatSide:chairSide,index:i*3+({W:0,L:1,R:2}[row]||0)}, {block,ball,cyl,mat});
  chair(parent,chairX,z,facing,i);
  colliders.push({x,z,hx:.58,hz:.85});
  colliders.push({x:chairX,z,hx:.33,hz:.37});
  return {position:{x:chairX,z:z-.08},facing,row,index:i};
}
function sign(parent,x,y,z,text){
  // Labels identify office areas, never place giant logos over gameplay.
  const can=document.createElement("canvas");can.width=420;can.height=140;
  const ctx=can.getContext("2d");ctx.fillStyle="#345d56";ctx.fillRect(0,0,420,140);
  ctx.fillStyle="#e8d6ac";ctx.font="bold 48px sans-serif";ctx.textAlign="center";
  ctx.fillText(text,210,86);
  const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;
  const p=new THREE.Mesh(new THREE.PlaneGeometry(3,1),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  p.position.set(x,y,z);
  p.rotation.y=Math.PI; // readable from the window-side entrance camera
  parent.add(p);return p;
}
/**
 * Merge repeated, stationary voxel boxes and bulbs into small, spatially
 * chunked InstancedMeshes. This preserves independently placed props and
 * their varied materials while dramatically reducing draw calls on phones.
 * Animated bulbs and camera-aware fixtures are deliberately excluded.
 */
function batchOfficeStaticGeometry(root,twinkle,viewWalls){
  if(!root.updateMatrixWorld||!THREE.InstancedMesh)return 0;
  root.updateMatrixWorld(true);
  const protectedObjects=new Set(twinkle);
  // Removable cutaway walls must stay separate from instanced static geometry.
  for(const wall of Object.values(viewWalls))wall.traverse(o=>protectedObjects.add(o));
  const groups=new Map(),inv=root.matrixWorld.clone().invert();
  root.traverse(object=>{
    if(!object.isMesh||protectedObjects.has(object))return;
    if(!object.geometry?.userData?.officeInstancing)return;
    if(!object.material?.isMeshStandardMaterial)return;
    const position=new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
    const chunk=Math.floor(position.z/9);
    const key=object.geometry.uuid+":"+object.material.uuid+":"+chunk+
      ":"+(object.castShadow?1:0)+":"+(object.receiveShadow?1:0);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(object);
  });
  let batches=0;
  for(const objects of groups.values()){
    if(objects.length<3)continue;
    const first=objects[0],mesh=new THREE.InstancedMesh(first.geometry,first.material,objects.length);
    mesh.castShadow=first.castShadow;
    mesh.receiveShadow=first.receiveShadow;
    mesh.name="Static holiday geometry x"+objects.length;
    const matrix=new THREE.Matrix4();
    objects.forEach((object,i)=>{
      matrix.multiplyMatrices(inv,object.matrixWorld);
      mesh.setMatrixAt(i,matrix);
      object.parent.remove(object);
    });
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere?.();
    root.add(mesh);
    batches++;
  }
  return batches;
}
export function buildOffice(count=12){
  const bays=Math.max(4,Math.ceil(Math.min(150,Math.max(1,count))/3));
  // 2.42 m workstation pitch leaves ~0.90 m free between 1.52 m desk tops.
  // Every fourth wall-facing desk gets an extra cross-passage gap.
  const rowStart=1.45,step=2.42,passageGap=2.15;
  const rowZ=i=>rowStart+i*step+Math.floor(i/4)*passageGap;
  const rowEnd=rowZ(bays-1);
  const passageCenters=[];
  for(let group=1;group<=Math.floor(bays/4);group++){
    const last=rowZ(group*4-1);
    const next=group*4<bays?rowZ(group*4):last+step+passageGap;
    passageCenters.push((last+next)/2);
  }
  // A clearly visible but separate decorated zone starts after the last desks.
  const partyStart=rowEnd+3.35,back=partyStart+7.35;
  const width=16,left=-8,right=8,front=-3.65;
  const root=new THREE.Group(),colliders=[],seats=[],twinkle=[];
  // Separate perimeter surfaces: cameras can create an architectural cutaway
  // without hiding the office furniture or flickering individual ceiling bars.
  const viewWalls={
    north:new THREE.Group(),south:new THREE.Group(),
    east:new THREE.Group(),west:new THREE.Group()
  };
  Object.entries(viewWalls).forEach(([side,wall])=>{
    wall.name="Cutaway "+side+" wall";
    root.add(wall);
  });
  // Subtle PBR flooring, tile grid lines and wall baseboards.
  block(root,0,-.13,(front+back)/2,width,.24,back-front,mat(0xe6d9d1,.25),false);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(width,back-front),mat(0xe3d7d1,{roughness:.32}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,.003,(front+back)/2);floor.receiveShadow=true;root.add(floor);
  const glines=new THREE.Group();root.add(glines);
  for(let x=left;x<=right+.001;x+=1.1)block(glines,x,.012,(front+back)/2,.012,.008,back-front,0xcfc2bf,false);
  for(let z=front;z<=back+.001;z+=1.1)block(glines,0,.012,z,width,.008,.012,0xcfc2bf,false);
  // Perimeter walls; window on north starts flush with west wall and ends just beyond island.
  westWallPassages(viewWalls.west,left,front,back,passageCenters);
  block(viewWalls.east,right+.14,2.15,(front+back)/2,.23,4.3,back-front,0xf6eee7,false);
  block(viewWalls.south,0,2.15,back+.12,width,4.3,.26,0xf7f0e9,false);
  block(viewWalls.north,5.24,2.15,front-.10,5.52,4.3,.18,0xf4ede8,false);
  block(viewWalls.north,-2.6,3.87,front-.09,10.9,.64,.18,0xf4ede8,false);
  block(viewWalls.north,-2.6,.38,front-.09,10.9,.76,.2,0xe6d6cb,false);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(10.55,2.75),new THREE.MeshPhysicalMaterial({color:0xc6e8f2,metalness:.05,roughness:.07,transmission:.24,transparent:true,opacity:.47,side:THREE.DoubleSide}));
  glass.position.set(-2.72,2.24,front-.18);viewWalls.north.add(glass);
  // Outdoor skyline and trees visible through the single north window.
  for(let j=0;j<24;j++){
    const x=-8.1+j*.45,hh=1.0+(j*31%12)*.17;
    block(root,x,hh/2+.75,front-3.3-(j%3),.44,hh,.46,[0x94b9ce,0x8fa9c9,0xb0bcd1,0x85aeb1][j%4],false);
    if(j%3===0)ball(root,x,.72,front-1.8,1.05,0x7eaf87);
  }
  for(let x=-7.95;x<2.5;x+=1.72)block(viewWalls.north,x,2.28,front-.04,.075,3.25,.11,0x686d7a,false);
  block(viewWalls.north,-2.65,3.55,front-.025,10.7,.10,.15,0x656a73,false);
  block(viewWalls.north,-2.65,.79,front-.025,10.7,.10,.15,0x656a73,false);
  // Absolutely no overhead bars, suspended strips or fixtures over gameplay.
  // Small sconces remain on perimeter walls; never hide/show overhead objects.
  for(let z=3.4;z<Math.min(back-3,48);z+=11){
    for(const side of [-1,1]){
      const wall=side>0?viewWalls.east:viewWalls.west;
      const x=side>0?right-.05:left+.05;
      const plate=block(wall,x,3.08,z,.07,.25,.21,0xc5ac85,false);
      const lampBulb=ball(wall,x-side*.12,3.08,z,.105,
        mat(0xffe6b5,{emissive:0xf0af51}),1);
      lampBulb.castShadow=false;
      if(z<26&&side>0){
        const glow=new THREE.PointLight(0xffd4a2,.75,5);
        glow.position.set(x-side*.5,2.85,z);root.add(glow);
      }
    }
  }
  // Workstation bay repeated perpendicular to the north window.
  for(let i=0;i<bays;i++){
    const z=rowZ(i);
    seats.push(workstation(root,-7.1,z,i,"W",colliders));
    seats.push(workstation(root,-1.6,z,i,"L",colliders));
    seats.push(workstation(root,-.3,z,i,"R",colliders));
    // Low partitions along island spine.
    block(root,-.96,1.08,z,.08,.56,1.70,0xd9dfd8,false);
    if(i%3===0){
      plant(root,-4.6,z+.7,.48);plant(root,2.6,z+.6,.55);
    }
    if(i%5===0)wreath(root,-7.87,2.45,z,Math.PI/2);
  }
  // Decorate along perimeter walls only, rather than dangling a curtain of
  // garlands across the character and hiding the scene in front of the camera.
  garland(root,front+.30,-7.6,2.6,3.85,twinkle);
  wallGarland(root,-7.74,front+1,partyStart+2,3.79,twinkle);
  wallGarland(root,7.71,front+1,partyStart+2,3.78,twinkle);
  // Small decorated tree near spawn; no obstruction to circulation.
  tree(root,6.45,4.75,.64);
  colliders.push({x:6.45,z:4.75,hx:1.00,hz:1.05});
  for(let i=0;i<5;i++)present(root,5.55+(i%2)*.45,4.1+Math.floor(i/2)*.41,.17+(i%3)*.07,i+70);
  // CHRISTMAS CELEBRATION — visible from the camera down the central aisle.
  // Southern end remains a distinct destination while the hall extends with bays.
  // A warm rug and many 3D gifts make it unmistakable even from a distance.
  const party=new THREE.Group();party.position.z=partyStart;root.add(party);
  block(party,0,.022,3.2,14.4,.04,7.1,0xbba38e,false);
  block(party,0,.054,3.15,13.5,.024,6.6,0x923f52,false);
  block(party,0,.07,3.15,12.9,.02,6.12,0xc87072,false);
  for(let i=0;i<8;i++){
    const zz=.66+i*.78;
    block(party,-6.25,.079,zz,.055,.008,.35,0xf1d99a,false);
    block(party,6.25,.079,zz,.055,.008,.35,0xf1d99a,false);
  }
  // Reveal stage and premium Christmas red/green/cream backdrop.
  block(party,-3.23,.34,4.85,6.65,.58,2.12,0x98545a);
  block(party,-3.23,.65,4.85,6.7,.11,2.16,0xf2c886);
  block(party,-3.23,2.11,6.03,6.9,3.46,.18,0x2e614d,false);
  block(party,-3.23,2.2,5.91,6.25,2.98,.12,0x874751,false);
  block(party,-3.23,3.66,5.83,6.8,.18,.16,0xe8c37b,false);
  block(party,-3.23,.81,5.83,6.75,.10,.16,0xe8c37b,false);
  // Soft backdrop pleats and oversized red bows.
  for(let i=0;i<11;i++){
    const x=-6.23+i*.60;
    block(party,x,2.2,5.76,.045,2.69,.034,i%2?0x9d5262:0xb05e6d,false);
    if(i%2===0){
      const l=ball(party,x,3.41,5.69,.065,mat(0xffe2a1,{emissive:0x9a611b}),1);
      l.castShadow=false;twinkle.push(l);
    }
  }
  sign(party,-3.23,2.68,5.64,"SECRET SANTA");
  for(const x of [-6.14,-.26]){
    cyl(party,x,1.26,5.15,.08,.1,2.45,0xe2c282);
    const star=ball(party,x,2.63,5.15,.18,mat(0xffe8aa,{emissive:0xc18d37}),1);
    star.scale.set(1.1,1.25,.35);
  }
  // Low stepped podium with an intentional interaction space in front.
  block(party,-3.2,.17,3.48,4.5,.31,.67,0xb97b68);
  block(party,-3.2,.37,3.82,3.65,.38,.60,0xdeac7e);
  block(party,-3.2,.65,4.18,2.6,.26,.58,0xefc995);
  // Large star-topped tree and a generous mound of wrapped presents.
  tree(party,4.45,3.22,1.07);
  colliders.push({x:4.45,z:partyStart+3.22,hx:1.62,hz:1.55});
  for(let k=0;k<24;k++){
    const layer=Math.floor(k/8),arc=(k%8)/8*Math.PI*2;
    const radius=1.45+layer*.33;
    const x=4.45+Math.cos(arc)*radius,z=3.22+Math.sin(arc)*radius;
    const scale=.20+((k*7)%5)*.075;
    present(party,x,z,scale,k+9);
  }
  // A friendly festive snowman, stocking displays and present table.
  const snowman=new THREE.Group();snowman.position.set(6.67,0,5.37);party.add(snowman);
  ball(snowman,0,.55,0,.56,0xf4f1ec,1);
  ball(snowman,0,1.31,0,.40,0xffffff,1);
  ball(snowman,0,1.72,0,.32,0xfffaf2,1);
  for(const x of [-.13,.13])ball(snowman,x,1.81,.27,.037,0x253443);
  block(snowman,0,1.98,0,.44,.13,.49,0x2e3644);
  cyl(snowman,0,2.19,0,.20,.17,.33,0x28313f);
  ball(snowman,0,1.64,.33,.074,0xef9959);
  for(const y of [.63,1.05,1.31])ball(snowman,0,y,.4,.045,0x3b4450);
  block(snowman,0,1.37,.27,.62,.1,.30,0xb74f56);
  const giftTable=new THREE.Group();giftTable.position.set(.15,0,4.75);party.add(giftTable);
  block(giftTable,0,.76,0,2.25,.14,.83,0xcb9a73);
  for(const x of [-.91,.91])for(const z of [-.29,.29])block(giftTable,x,.39,z,.12,.72,.1,0xe5d7c4);
  for(let i=0;i<5;i++)present(giftTable,-.78+i*.39,0,.21+(i%2)*.09,i+40);
  // Real 3D celebration lighting, wreaths and potted holiday greenery.
  for(const x of [-5.62,-.85,2.2,6.7]){
    const glow=new THREE.PointLight(0xffbe77,.9,4.1);
    glow.position.set(x,3.45,partyStart+4.7);root.add(glow);
  }
  plant(party,6.75,.9,.75);plant(party,-6.85,5.35,.92);
  for(const x of [-6.7,6.7])wreath(party,x,2.30,6.15,x<0?Math.PI/2:-Math.PI/2);
  // Treat stage, gift-table and snowman as real solid objects. The carpet
  // remains walkable and the player can approach the stage for the ceremony.
  colliders.push({x:-3.23,z:partyStart+5.03,hx:3.48,hz:1.15});
  colliders.push({x:-3.2,z:partyStart+3.66,hx:2.40,hz:.67});
  colliders.push({x:.15,z:partyStart+4.75,hx:1.23,hz:.61});
  colliders.push({x:6.67,z:partyStart+5.37,hx:.53,hz:.59});
  // The near-spawn tree is a visual teaser, without replacing the main tree.
  plant(root,7.1,front+1,1.3);
  for(let k=0;k<3;k++)picture(root,7.94,3.06,front+5+k*5,[0xc6c6ad,0xb1c6cb,0xe3cdb2][k]);
  const spawn={x:4.2,z:Math.min(4.0,rowEnd-.3)};
  const rows=bays;
  addWarmOfficeDetails(root,{
    left,right,front,back,partyStart,viewWalls,twinkle
  },{block,ball,cyl,mat});
  const optimizedBatches=batchOfficeStaticGeometry(root,twinkle,viewWalls);
  return {root,colliders,seats,spawn,bays,optimizedBatches,
    // Structural wall passages are not additional explorable rooms.
    room:{left,right,front,back},
    partyStart,twinkle,viewWalls,passageCenters,rowZ,deskPitch:step,passageGap};
}
