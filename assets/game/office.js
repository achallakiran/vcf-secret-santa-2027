import * as THREE from "three";
import {decorateWorkstation,addWarmOfficeDetails} from "./environment-art.js?v=visual-sculpt-v3";
import {officeTileMaterial,applyOfficeTileRepeat,addOfficeLounge} from "./art-surfaces.js?v=visual-sculpt-v3";
import {getInteriorFinishes} from "./interior-finishes.js?v=interior-art-v1";
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
  // A tall, full voxel STORYBOOK tree: volumetric branches, staggered
  // needle clusters, spiral ornaments, warm light pearls and sculpted star.
  // This intentionally changes the major silhouette, not only the decorations.
  const g=new THREE.Group();
  g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  const greens=[0x245f48,0x287452,0x3b8b62,0x2f7d57,0x3c9365,0x1d5946];
  const glow=[0xffdb90,0xfff0bd,0xf6bd79,0xfce8b1];
  const bauble=[0xc8545a,0xe9c17b,0xf0e3c3,0x94b9c0,0xc87583];
  cyl(g,0,.43,0,.17,.22,.87,0x866344);
  softBlock(g,0,.15,0,.62,.14,.62,0xe2cba9,.13);
  // Ten layered branch fans give a lush tapered shape without a cone.
  for(let tier=0;tier<9;tier++){
    const y=.65+tier*.345,reach=1.45-tier*.135;
    const r=Math.max(.33,reach),shade=greens[tier%greens.length];
    softBlock(g,0,y,0,r*1.74,.29,r*1.74,shade,.16);
    for(let j=0;j<8;j++){
      const a=j*Math.PI/4+(tier%2)*.22;
      const rx=Math.cos(a)*r*.80,rz=Math.sin(a)*r*.80;
      const tuft=softBlock(g,rx,y-.045,rz,.51+(8-tier)*.032,.21,
        .47+(8-tier)*.03,greens[(j+tier)%greens.length],.13);
      tuft.rotation.y=a;
      const outer=softBlock(g,Math.cos(a)*r*1.02,y-.09,Math.sin(a)*r*1.02,
        .36,.17,.36,greens[(j+2*tier+2)%greens.length],.09);
      outer.rotation.y=a;
    }
    // Real bright glass baubles, not dark circles merely painted on tree.
    for(let j=0;j<10;j++){
      const a=(j+tier*.28)*Math.PI*2/10;
      const rr=r*(.79+(j%2)*.15);
      const yy=y+.10+(j%3)*.035;
      const ornament=ball(g,Math.cos(a)*rr,yy,Math.sin(a)*rr,
        .08+(j%3)*.014,mat(bauble[(j+tier)%bauble.length],{roughness:.20,metalness:.18}),1);
      ornament.castShadow=false;
      if(j%2===0){
        const lamp=ball(g,Math.cos(a+.16)*rr,yy+.08,
          Math.sin(a+.16)*rr,.055,
          mat(glow[(j+tier)%glow.length],{emissive:0xf7bd65,roughness:.31}),1);
        lamp.castShadow=false;
      }
    }
    // Narrow gold zig-zag ribbon follows the stepped branches, visible on
    // the front of the tree from the office aisle.
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5+tier*.48;
      const strut=softBlock(g,Math.cos(a)*r*.84,y+.145,Math.sin(a)*r*.84,
        .18,.035,.30,0xf2c67c,.04,false);
      strut.rotation.y=a;
    }
  }
  // Five-point luminous gold star, with three-dimensional double layers.
  const starShape=new THREE.Shape();
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?.31:.145;
    if(!i)starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    else starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);
  }
  starShape.closePath();
  for(const depth of [0,.09]){
    const star=new THREE.Mesh(new THREE.ExtrudeGeometry(starShape,{
      depth:.075,steps:1,bevelEnabled:true,bevelSize:.027,
      bevelThickness:.03,bevelSegments:2
    }),mat(depth?0xffedaa:0xf6d07c,{emissive:0xc99335,metalness:.12,roughness:.32}));
    star.position.set(0,3.85,depth);star.castShadow=false;g.add(star);
  }
  const light=new THREE.PointLight(0xffc77b,1.55,5.5);
  light.position.set(0,2.45,.7);g.add(light);
  // The tree is a physical destination, grounded in a realistic gift pile.
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16,rr=.92+(i%4)*.19;
    present(g,Math.cos(a)*rr,Math.sin(a)*rr,.18+(i%5)*.06,i+51);
  }
  return g;
}
function plant(parent,x,z,scale=1){
  // Sculpted broad-leaf indoor greenery with varied angles, ceramic planter,
  // real soil surface and multiple stems. No distant image impostors.
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cyl(g,0,.23,0,.25,.20,.46,0xe8dfd5,16);
  cyl(g,0,.48,0,.275,.246,.065,0xf7ecdb,16);
  cyl(g,0,.50,0,.222,.218,.021,0x51453b,16);
  for(let i=0;i<11;i++){
    const a=i*Math.PI*2/11,ring=i%3,reach=.33+ring*.12;
    const yy=.73+((i*7)%5)*.10;
    const sx=Math.sin(a),sz=Math.cos(a);
    const stem=cyl(g,sx*.10,.70,sz*.10,.018,.025,.41,0x597c57,6);
    stem.rotation.z=sx*.30;stem.rotation.x=sz*-.28;
    const leaf=softBlock(g,sx*reach,yy,sz*reach,.17,.41,.28,
      [0x4e906b,0x327e62,0x64a37b,0x407459,0x78ad81][i%5],.11);
    leaf.rotation.y=a;leaf.rotation.z=sx*.34;leaf.rotation.x=sz*.27;
    const ridge=softBlock(g,sx*(reach+.025),yy,sz*(reach+.025),.029,.33,.033,
      i%2?0xa9c9a1:0x9aba88,.02,false);
    ridge.rotation.y=a;ridge.rotation.z=sx*.34;ridge.rotation.x=sz*.27;
  }
  for(let j=0;j<4;j++){
    const a=j*Math.PI/2+.35;
    const small=softBlock(g,Math.cos(a)*.16,.83,Math.sin(a)*.16,.11,.29,.17,
      0x5fa27a,.065);
    small.rotation.y=a;small.rotation.z=Math.sin(a)*.25;
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
  // Sculpted greenery, bows and warm lights *against the side walls only*.
  // None hangs over the main walking aisle or camera.
  const n=Math.max(8,Math.ceil((to-from)/.48));
  for(let i=0;i<=n;i++){
    const t=i/n,z=from+t*(to-from),yy=y-.16*Math.sin(t*Math.PI*3);
    const leaf=softBlock(parent,x,yy,z,.22,.14,.43,
      i%4===0?0x28694a:i%4===1?0x46885c:i%4===2?0x337e55:0x397653,.10,false);
    leaf.rotation.y=Math.sin(i*.55)*.25;
    if(i%3===0){
      const light=ball(parent,x+.055,yy-.085,z,.054,
        mat(i%2?0xffe59c:0xffc6a9,{emissive:i%2?0xdd9950:0x9e553f,roughness:.30}),1);
      light.castShadow=false;twinkle.push(light);
    }
    if(i>0&&i%13===0){
      const bowCenter=ball(parent,x+.095,yy-.13,z,.09,0xb74959);
      const wingA=softBlock(parent,x+.102,yy-.11,z-.19,.075,.19,.30,0xd6606b,.055);
      const wingB=softBlock(parent,x+.102,yy-.11,z+.19,.075,.19,.30,0xc34e60,.055);
      wingA.rotation.x=-.28;wingB.rotation.x=.28;
      const ribbonA=softBlock(parent,x+.102,yy-.27,z-.11,.050,.26,.12,0xd26771,.03);
      const ribbonB=softBlock(parent,x+.102,yy-.27,z+.11,.050,.27,.12,0xc84e62,.03);
      ribbonA.rotation.x=-.15;ribbonB.rotation.x=.15;
    }
  }
}
function chair(parent,x,z,face=1,variant=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face;parent.add(g);
  const finish=getInteriorFinishes();
  const dark=variant%2?finish.chairInk:finish.chairTeal;
  cyl(g,0,.30,0,.055,.05,.47,0x484c56);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;block(g,Math.cos(a)*.34,.095,Math.sin(a)*.34,.12,.05,.12,0x444b54);}
  // Rounded padded seat, curved-looking double cushion and visible headrest.
  softBlock(g,0,.55,0,.53,.13,.47,dark,.19);
  softBlock(g,0,.97,-.21,.54,.75,.13,dark,.19);
  softBlock(g,0,1.27,-.23,.44,.20,.16,0x566377,.18);
  softBlock(g,0,.97,-.125,.39,.49,.055,
    variant%2?finish.chairTeal:finish.chairInk,.11,false);
  // Continuous piping, curved upholstered lumbar band and satin chair arms.
  softBlock(g,0,.74,-.126,.35,.085,.064,finish.cushion,.07,false);
  for(const side of [-1,1]){
    block(g,side*.28,.724,-.09,.027,.025,.36,finish.trim,false);
  }
  block(g,-.28,.72,-.02,.075,.13,.4,0x5e6471);
  block(g,.28,.72,-.02,.075,.13,.4,0x5e6471);
  for(const side of [-1,1])ball(g,side*.35,.095,.08,.063,0x353c45);
  return g;
}
/**
 * Upholstered celebration lounge seating has the same material finish as
 * the workplace, but is kept off the central x=2..4 walking corridor.
 * Group is a decorative static object; its collider is added by caller.
 */
function celebrationSofa(parent,x,z,mirror=false){
  const finish=getInteriorFinishes(),g=new THREE.Group();
  g.position.set(x,0,z);parent.add(g);
  if(mirror)g.rotation.y=Math.PI;
  // Sculpted 2-person seat with curved back, thick arms and loose pillows.
  softBlock(g,0,.43,0,.77,.18,2.35,finish.chairTeal,.18);
  softBlock(g,-.42,.82,0,.21,.85,2.48,finish.chairTeal,.18);
  for(const zz of [-.57,.57]){
    softBlock(g,.04,.54,zz,.66,.24,1.02,finish.chairTeal,.16);
    const cushion=softBlock(g,-.28,.94,zz,.18,.42,.55,
      zz>0?finish.cushion:finish.divider,.13);
    cushion.rotation.z=-.21;
  }
  for(const zz of [-1.20,1.20]){
    softBlock(g,-.02,.66,zz,.84,.40,.22,finish.chairInk,.13);
    softBlock(g,-.02,.81,zz,.65,.07,.20,finish.chairTeal,.06);
    block(g,-.21,.15,zz,.16,.28,.13,finish.walnut,false);
  }
  for(const zz of [-.86,.86]){
    block(g,.19,.16,zz,.10,.28,.10,finish.walnut,false);
  }
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
  const finish=getInteriorFinishes();
  const oak=finish.maple,white=finish.cabinet;
  softBlock(g,0,.76,0,.73,.075,1.52,oak,.12);
  // A walnut edge with a satin metallic inlay makes the desk read as
  // contemporary modular office furniture rather than stacked boxes.
  block(g,chairSide*.34,.735,0,.017,.028,1.50,0xd6be9c,false);
  block(g,-chairSide*.34,.737,0,.014,.028,1.49,0x9b775e,false);
  softBlock(g,0,.38,-.66,.62,.68,.08,white,.09);
  softBlock(g,0,.38,.66,.62,.68,.08,white,.09);
  // Recessed cabinet drawers with real metallic handles and panel seams.
  for(const z of [-.64,.64]){
    for(let level=0;level<3;level++){
      softBlock(g,chairSide*.317,.24+level*.21,z,.031,.165,.49,
        finish.cabinet,.04,false);
      block(g,chairSide*.34,.25+level*.21,z,.025,.024,.21,
        finish.trim,false);
    }
  }
  block(g,0,.18,0,.52,.22,1.3,mat(0xeae5dc));
  softBlock(g,0,1.1,0,.045,.52,1.42,finish.divider,.12,false);
  // Warm desk-edge accent is an emissive trim, never a point light per desk.
  block(g,chairSide*.335,.713,0,.016,.025,1.40,finish.deskGlow,false);
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
  const tileMaterial=officeTileMaterial();
  applyOfficeTileRepeat(tileMaterial,width,back-front);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(width,back-front),tileMaterial);
  floor.rotation.x=-Math.PI/2;
  floor.position.set(0,.009,(front+back)/2);
  floor.receiveShadow=true;root.add(floor);
  // Grout is drawn into the tile texture rather than using hundreds of
  // shadow-fighting grid bars over the walking surface.
  // Perimeter walls; window on north starts flush with west wall and ends just beyond island.
  westWallPassages(viewWalls.west,left,front,back,passageCenters);
  block(viewWalls.east,right+.14,2.15,(front+back)/2,.23,4.3,back-front,0xf6eee7,false);
  block(viewWalls.south,0,2.15,back+.12,width,4.3,.26,0xf7f0e9,false);
  block(viewWalls.north,5.24,2.15,front-.10,5.52,4.3,.18,0xf4ede8,false);
  block(viewWalls.north,-2.6,3.87,front-.09,10.9,.64,.18,0xf4ede8,false);
  block(viewWalls.north,-2.6,.38,front-.09,10.9,.76,.2,0xe6d6cb,false);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(10.55,2.75),new THREE.MeshPhysicalMaterial({color:0xc6e8f2,metalness:.05,roughness:.07,transmission:.24,transparent:true,opacity:.47,side:THREE.DoubleSide}));
  glass.position.set(-2.72,2.24,front-.18);viewWalls.north.add(glass);
  // Layered low-poly city skyline viewed through the finite office window:
  // pastel towers with realistic window rhythm, treetops and warm sunlight.
  // Kept outside the navigable office as pure environment art.
  for(let j=0;j<19;j++){
    const x=-8.05+j*.57,hh=1.25+((j*37)%11)*.22;
    const z=front-3.55-(j%4)*.55;
    const w=.48+(j%3)*.14;
    const shell=[0xa1b8c7,0x8ca9bd,0xb1c0ce,0x93b6ba,0xa2adb8][j%5];
    block(root,x,hh/2+.52,z,w,hh,.46,shell,false);
    for(let row=0;row<Math.floor(hh/.33);row++){
      const wy=.68+row*.33;
      for(const side of [-1,1]){
        block(root,x+side*w*.22,wy,z+.247,.08,.12,.015,
          (j+row)%4===0?0xe6d3ab:0x6f93aa,false);
      }
    }
    if(j%3===0){
      const tx=x+.12;
      cyl(root,tx,.65,front-1.75,.085,.09,.6,0x876f59);
      for(let k=0;k<4;k++){
        const foliage=ball(root,tx+(k-1.5)*.2,1.2+(k%2)*.12,
          front-1.8,.39,(k+j)%2?0x6aa77b:0x83b98d);
        foliage.scale.set(1.03,.76,.76);
      }
    }
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
  block(party,0,.07,3.15,12.9,.02,6.12,getInteriorFinishes().carpet,false);
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
  // Layered festive frame around the backdrop; all at the far stage,
  // never hanging over the walking camera.
  for(let j=0;j<15;j++){
    const x=-6.42+j*.455;
    const ornament=ball(party,x,3.83,5.65,.09,
      mat(j%3===0?0xd45a67:j%3===1?0xf7d991:0x3d956b,
        {emissive:j%3===1?0x735023:0}),1);
    ornament.castShadow=false;
  }
  for(const x of [-6.52,.04]){
    for(let j=0;j<15;j++){
      const y=.99+j*.18;
      const bulb=ball(party,x,y,5.69,.052,mat(j%2?0xffe8b2:0xfaaf93,
        {emissive:0x8d5d28}),1);
      bulb.castShadow=false;
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
  // Two upholstered visitor sofas, a coffee table and seasonal greenery.
  // They face the celebration but never occupy the central access route.
  celebrationSofa(party,-6.25,.96);
  celebrationSofa(party,6.40,.80,true);
  colliders.push({x:-6.25,z:partyStart+.96,hx:.60,hz:1.38});
  colliders.push({x:6.40,z:partyStart+.80,hx:.60,hz:1.38});
  const table=new THREE.Group();
  table.position.set(-4.85,0,1.15);party.add(table);
  cyl(table,0,.39,0,.42,.43,.085,getInteriorFinishes().walnut,20);
  cyl(table,0,.22,0,.10,.13,.31,0x9b7969,12);
  cyl(table,0,.066,0,.29,.29,.066,0x91765e,20);
  cyl(table,.12,.48,.09,.07,.06,.13,0xf1e5d5,12);
  for(let b=0;b<4;b++){
    const a=b*Math.PI/2,petal=ball(table,-.10+Math.cos(a)*.08,.50,.02+Math.sin(a)*.08,
      .055,b%2?0xd66e70:0xeabb87);
    petal.castShadow=false;
  }
  colliders.push({x:-4.85,z:partyStart+1.15,hx:.49,hz:.49});
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
  addOfficeLounge(root,{rowZ,bays,partyStart,colliders,room:{left,right,front,back}},
    {softBlock,block,ball,cyl,plant,mat});
  const optimizedBatches=batchOfficeStaticGeometry(root,twinkle,viewWalls);
  return {root,colliders,seats,spawn,bays,optimizedBatches,
    // Structural wall passages are not additional explorable rooms.
    room:{left,right,front,back},
    partyStart,twinkle,viewWalls,passageCenters,rowZ,deskPitch:step,passageGap};
}
