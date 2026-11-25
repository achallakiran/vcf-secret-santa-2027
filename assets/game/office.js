import * as THREE from "three";
import {decorateWorkstation,addWarmOfficeDetails} from "./environment-art.js?v=visual-sculpt-v3";
import {officeTileMaterial,applyOfficeTileRepeat,addOfficeLounge} from "./art-surfaces.js?v=visual-sculpt-v3";
import {getInteriorFinishes} from "./interior-finishes.js?v=visual-upgrade-p1";
import {deskThemeForSeat,dressWorkstation,dressOfficeArchitecture} from "./office-visual-style.js?v=visual-upgrade-p1";
import {buildArchitecturalBays,sculptWorkstationSilhouette,sculptCelebrationStage} from "./office-cinematic-design.js?v=grand-overhaul-v2";
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
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),typeof color==="number"?mat(color):color);
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
// Server and renderer use the same 12-item cycle, indexed by the stable
// participant seat in event creation order. Every clue names a visible mesh.
export const CLUE_PROPS=[
  "apple","coffee","mini-tree","gift","succulent","coffee",
  "apple","ornament","mini-tree","books","lantern","candy-cane"
];
export function deskClueForSeat(index){return CLUE_PROPS[index%CLUE_PROPS.length];}
export function decorateClueDesk(g,seatIndex,chairSide,customKind=null){
  const kind=customKind||deskClueForSeat(seatIndex);
  const stand=new THREE.Group();
  stand.name="clueStand";
  stand.userData.isClueStand=true;
  stand.userData.clueObject=kind;
  stand.userData.seatIndex=seatIndex;
  stand.userData.chairSide=chairSide;
  // Position prominently on the open desk surface in front of monitors
  stand.position.set(chairSide*.24,.80,.35);
  stand.scale.set(1.5,1.5,1.5);
  // Elegant walnut coaster base disc to highlight the festive prop
  cyl(stand,0,.012,0,.15,.15,.024,0xa07044,16);
  g.add(stand);
  const b=(x,y,z,w,h,d,c)=>block(stand,x,y,z,w,h,d,c,false);
  const ballPart=(x,y,z,r,c)=>ball(stand,x,y,z,r,c);
  const cup=(color=0xf3ddc7)=>{
    cyl(stand,0,.09,0,.105,.090,.18,color,12);
    cyl(stand,0,.187,0,.086,.086,.015,0x5b372d,12);
    b(.118,.10,0,.060,.027,.018,color);
    b(.143,.12,0,.018,.07,.021,color);
  };
  switch(kind){
    case "apple":{
      const fruit=ballPart(0,.145,0,.12,0xdf4048);
      fruit.scale.set(1,1.12,.93);
      b(0,.282,0,.021,.068,.020,0x79512c);
      const leaf=ballPart(.041,.295,0,.045,0x62ab5e);
      leaf.scale.set(1.1,.25,.60);
      break;
    }
    case "coffee": cup();break;
    case "mini-tree":{
      b(0,.055,0,.06,.11,.06,0x84613d);
      const green=[0x347a59,0x3c9061,0x50a26a];
      for(let level=0;level<3;level++){
        const y=.13+level*.095,w=.28-level*.07;
        b(0,y,0,w,.115,w,green[level]);
        b(0,y+.036,0,w*.79,.075,w*.79,green[level]);
      }
      ballPart(0,.425,0,.052,0xffcf67);
      ballPart(-.115,.19,.09,.026,0xd85b67);
      ballPart(.078,.29,-.08,.024,0xffdfa0);break;
    }
    case "gift":{
      b(0,.105,0,.27,.21,.26,0xb73554);
      b(0,.218,0,.295,.035,.28,0xffd587);
      b(0,.132,0,.052,.25,.275,0xeec888);
      b(0,.13,0,.275,.25,.046,0xeec888);break;
    }
    case "succulent":{
      cyl(stand,0,.075,0,.115,.10,.13,0xcba384,12);
      for(let n=0;n<7;n++){
        const phi=n*6.283/7;
        const leaf=ballPart(Math.sin(phi)*.06,.205+Math.cos(phi)*.025,Math.cos(phi)*.06,.065,n%2?0x418b65:0x5fa976);
        leaf.scale.set(.48,1.4,.55);
      }
      break;
    }
    case "ornament":{
      ballPart(0,.175,0,.125,0xffcf6d);
      b(0,.298,0,.065,.036,.065,0xb49a6a);
      ballPart(-.03,.19,.101,.025,0xffffff);
      ballPart(.068,.135,.072,.024,0xdf6071);break;
    }
    case "books":{
      for(let n=0;n<4;n++){
        const colors=[0x487e9a,0x9e576b,0x538872,0xcf9753];
        b(0,.028+n*.064,0,.27,.054,.37,colors[n]);
        b(0,.045+n*.064,.083,.20,.012,.22,0xf8e9d4);
      }
      break;
    }
    case "lantern":{
      b(0,.036,0,.20,.043,.18,0x5c4655);
      for(const dx of [-.09,.09])for(const dz of [-.079,.079])
        b(dx,.16,dz,.018,.235,.018,0x6e5962);
      b(0,.29,0,.23,.045,.21,0x845669);
      const light=ballPart(0,.158,0,.074,mat(0xffdb86,{emissive:0xe7ac52}));
      light.scale.set(.8,1.15,.7);
      break;
    }
    case "candy-cane":{
      b(0,.16,0,.064,.31,.06,0xfcf4e8);
      for(let j=0;j<5;j++)b(0,.047+j*.064,.035,.067,.032,.015,0xcb4960);
      b(.052,.305,0,.16,.057,.06,0xfcf4e8);
      b(.116,.261,0,.060,.15,.06,0xfcf4e8);
      b(.05,.335,.035,.068,.025,.014,0xcb4960);
      break;
    }
  }
  stand.userData.clueObject=kind;
}

function workstation(parent,x,z,i,row,colliders){
  // Width of the desk is along the row (z): its LONG EDGE faces the seated employee.
  // W and R sit east of their desks and face WEST; L sits west and faces EAST.
  const chairSide=row==="L"?-1:1;
  const facing=row==="L"?Math.PI/2:-Math.PI/2;
  const left=-chairSide;
  const chairX=x+chairSide*1.13;
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const finish=getInteriorFinishes();
  const seatIndex=i*3+({W:0,L:1,R:2}[row]||0);
  const style=deskThemeForSeat(seatIndex);
  const oak=finish[style.top],white=finish.cabinet;
  // Three times the old tabletop AREA (0.73×1.52 -> 0.99×3.36).
  // Long axis follows workstation row, leaving real personal work space.
  softBlock(g,0,.76,0,.99,.075,3.36,oak,.12);
  // A walnut edge with a satin metallic inlay makes the desk read as
  // contemporary modular office furniture rather than stacked boxes.
  block(g,chairSide*.475,.735,0,.017,.028,3.32,0xd6be9c,false);
  block(g,-chairSide*.475,.737,0,.014,.028,3.31,0x9b775e,false);
  softBlock(g,0,.38,-1.42,.78,.68,.16,white,.09);
  softBlock(g,0,.38,1.42,.78,.68,.16,white,.09);
  // Recessed cabinet drawers with real metallic handles and panel seams.
  for(const z of [-1.42,1.42]){
    for(let level=0;level<3;level++){
      softBlock(g,chairSide*.406,.24+level*.21,z,.031,.165,.49,
        finish.cabinet,.04,false);
      block(g,chairSide*.44,.25+level*.21,z,.025,.024,.21,
        finish.trim,false);
    }
  }
  block(g,0,.18,0,.69,.22,3.04,mat(0xeae5dc));
  // Full privacy partitions on BOTH desk ends plus a rear divider.
  // Ends sit beyond the new top, rather than slicing through the work area.
  softBlock(g,-chairSide*.485,1.11,0,.052,.65,3.31,finish[style.divider],.045,false);
  for(const side of [-1,1]){
    softBlock(g,0,1.10,side*1.69,1.02,.63,.07,finish[style.divider],.04,false);
    block(g,0,1.43,side*1.69,.99,.023,.086,finish.trim,false);
  }
  // Warm desk-edge accent is an emissive trim, never a point light per desk.
  block(g,chairSide*.485,.713,0,.016,.025,3.28,finish.deskGlow,false);
  // Monitors face the employee (west/east), with long edge of desk fronting the chair.
  const screenX=-left*.19;
  block(g,screenX,.98,-.22,.09,.45,.62,0x343d48);
  block(g,screenX+left*.05,.99,-.22,.015,.37,.53,
    mat(style.ink,{emissive:0x163a42,roughness:.22}),false);
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
  // Three monitor configurations: landscape pair, portrait companion or
  // low-profile secondary display. All retain the same workstation footprint.
  const displayMode=seatIndex%3,secondTall=displayMode===1,
        secondLow=displayMode===2;
  const screenHeight=secondTall?.60:secondLow?.27:.44,
        screenWidth=secondTall?.41:secondLow?.72:.64;
  const screenY=.78+screenHeight/2+.04;
  block(g,screenX,screenY,.83,.09,screenHeight,screenWidth,0x343d48);
  block(g,screenX+left*.051,screenY,.83,.015,screenHeight-.08,screenWidth-.11,
    mat(style.ink,{emissive:0x163b41,roughness:.31}),false);
  block(g,screenX,.81,.83,.055,.08,.055,0x53606c);
  block(g,chairSide*.16,.818,-1.12,.30,.032,.38,0xa1b4bf,false);
  for(let sheet=0;sheet<3;sheet++)
    block(g,chairSide*.16,.842+sheet*.014,-1.12,.23,.012,.31,0xf9f3e5,false);
  cyl(g,-chairSide*.13,.84,1.28,.09,.10,.085,0xd6b77e,10);
  const lampNeck=cyl(g,-chairSide*.13,1.01,1.28,.020,.020,.29,0x847c70,8);
  lampNeck.rotation.z=.21;
  ball(g,-chairSide*.08,1.18,1.26,.09,mat(0xffe6b8,{emissive:0xe0ac6b}),1);
  decorateWorkstation(g,{seatSide:chairSide,index:seatIndex}, {block,ball,cyl,mat});
  // Art direction lives in a reusable appearance layer and never moves the
  // Santa hint prop in the far desk corner at z=1.29.
  dressWorkstation(g,{seatIndex,chairSide,finish},{block,softBlock,ball,mat});
  sculptWorkstationSilhouette(g,{seatIndex,chairSide,style},{block,softBlock,ball,mat});
  decorateClueDesk(g,seatIndex,chairSide);
  chair(parent,chairX,z,facing,seatIndex);
  colliders.push({x,z,hx:.57,hz:1.79});
  colliders.push({x:chairX,z,hx:.36,hz:.43});
  return {position:{x:chairX,z:z-.08},facing,row,index:i,deskGroup:g,deskPosition:{x,z},seatIndex,chairSide};
}
function neonSign(parent,x,y,z,text,subtext="VOXEL RACERS & BIKES"){
  const group=new THREE.Group();
  group.position.set(x,y,z);
  parent.add(group);

  // 3D Marquee enclosure chassis (3.80m x 1.15m x 0.28m)
  block(group,0,0,0,3.80,1.15,0.28,0x0c111e,false);
  // Outer glowing neon borders
  block(group,0,0.59,0,3.86,0.06,0.30,0x00f0ff);
  block(group,0,-0.59,0,3.86,0.06,0.30,0x00f0ff);
  block(group,-1.91,0,0,0.06,1.22,0.30,0xff007f);
  block(group,1.91,0,0,0.06,1.22,0.30,0xff007f);

  // Front Canvas (Faces party stage / approaching players from -Z)
  const canF=document.createElement("canvas");
  canF.width=1024;
  canF.height=320;
  const ctxF=canF.getContext("2d");
  const gradF=ctxF.createLinearGradient(0,0,0,320);
  gradF.addColorStop(0,"#0b101e");
  gradF.addColorStop(0.5,"#141b30");
  gradF.addColorStop(1,"#080c18");
  ctxF.fillStyle=gradF;
  ctxF.fillRect(0,0,1024,320);

  ctxF.strokeStyle="#00f0ff";
  ctxF.lineWidth=10;
  ctxF.strokeRect(14,14,996,292);

  ctxF.strokeStyle="#ff007f";
  ctxF.lineWidth=4;
  ctxF.strokeRect(26,26,972,268);

  ctxF.fillStyle="#ffea00";
  for(const [cx,cy] of [[38,38],[986,38],[38,282],[986,282]]){
    ctxF.beginPath();ctxF.arc(cx,cy,8,0,Math.PI*2);ctxF.fill();
  }

  ctxF.shadowColor="#00f0ff";
  ctxF.shadowBlur=18;
  ctxF.fillStyle="#ffffff";
  ctxF.font="900 66px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctxF.textAlign="center";
  ctxF.fillText("🕹️ RETRO ARCADE",512,116);

  ctxF.shadowColor="#ff007f";
  ctxF.shadowBlur=14;
  ctxF.fillStyle="#ff3b94";
  ctxF.font="bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctxF.fillText(subtext,512,182);

  ctxF.shadowColor="#00ffcc";
  ctxF.shadowBlur=10;
  ctxF.fillStyle="#00f0ff";
  ctxF.font="800 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctxF.fillText("▼  FREE PLAY · STEP INSIDE TO RACE  ▼",512,250);

  const texF=new THREE.CanvasTexture(canF);
  texF.colorSpace=THREE.SRGBColorSpace;
  const meshF=new THREE.Mesh(new THREE.PlaneGeometry(3.72,1.08),new THREE.MeshBasicMaterial({map:texF}));
  meshF.position.set(0,0,-0.145);
  meshF.rotation.y=Math.PI; // Face south towards approaching office players
  group.add(meshF);

  // Rear Canvas (Faces arcade interior / exiting players)
  const canB=document.createElement("canvas");
  canB.width=1024;
  canB.height=320;
  const ctxB=canB.getContext("2d");
  const gradB=ctxB.createLinearGradient(0,0,0,320);
  gradB.addColorStop(0,"#0b101e");
  gradB.addColorStop(0.5,"#141b30");
  gradB.addColorStop(1,"#080c18");
  ctxB.fillStyle=gradB;
  ctxB.fillRect(0,0,1024,320);

  ctxB.strokeStyle="#ff007f";
  ctxB.lineWidth=8;
  ctxB.strokeRect(14,14,996,292);

  ctxB.shadowColor="#00ffcc";
  ctxB.shadowBlur=16;
  ctxB.fillStyle="#00f0ff";
  ctxB.font="900 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctxB.textAlign="center";
  ctxB.fillText("◀ OFFICE CELEBRATION",512,130);

  ctxB.shadowColor="#f59e0b";
  ctxB.shadowBlur=12;
  ctxB.fillStyle="#fbbf24";
  ctxB.font="bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctxB.fillText("🎄 CHRISTMAS STAGE & DESKS",512,215);

  const texB=new THREE.CanvasTexture(canB);
  texB.colorSpace=THREE.SRGBColorSpace;
  const meshB=new THREE.Mesh(new THREE.PlaneGeometry(3.72,1.08),new THREE.MeshBasicMaterial({map:texB}));
  meshB.position.set(0,0,0.145); // Face north towards arcade interior
  group.add(meshB);

  const signGlow=new THREE.PointLight(0x00f0ff,1.2,4.5);
  signGlow.position.set(0,-0.65,0);
  group.add(signGlow);

  return group;
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
function batchOfficeStaticGeometry(root,twinkle,viewWalls,arcadeRoom){
  if(!root.updateMatrixWorld||!THREE.InstancedMesh)return 0;
  root.updateMatrixWorld(true);
  const protectedObjects=new Set(twinkle);
  // Removable cutaway walls must stay separate from instanced static geometry.
  for(const wall of Object.values(viewWalls))wall.traverse(o=>protectedObjects.add(o));
  if(arcadeRoom)arcadeRoom.traverse(o=>protectedObjects.add(o));
  const groups=new Map(),inv=root.matrixWorld.clone().invert();
  root.traverse(object=>{
    if(!object.isMesh||protectedObjects.has(object))return;
    if(object.userData?.isClueStand||object.parent?.userData?.isClueStand||object.parent?.parent?.userData?.isClueStand)return;
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
  // Wall decoration is kept in its owning removable wall group. Batch it
  // independently so the game's wide-camera cutaway still hides the entire
  // wall, while dozens of new architectural battens do not consume dozens
  // of draw calls on phones. Twinkling bulbs remain independent.
  for(const [side,wall] of Object.entries(viewWalls)){
    const wallGroups=new Map(),wallInverse=wall.matrixWorld.clone().invert();
    wall.traverse(object=>{
      if(!object.isMesh||protectedObjects.has(object))return;
      if(!object.geometry?.userData?.officeInstancing)return;
      if(!object.material?.isMeshStandardMaterial)return;
      const position=new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
      const chunk=Math.floor(position.z/15);
      const key=object.geometry.uuid+":"+object.material.uuid+":"+chunk+
        ":"+(object.castShadow?1:0)+":"+(object.receiveShadow?1:0);
      if(!wallGroups.has(key))wallGroups.set(key,[]);
      wallGroups.get(key).push(object);
    });
    for(const objects of wallGroups.values()){
      if(objects.length<3)continue;
      const first=objects[0];
      const mesh=new THREE.InstancedMesh(first.geometry,first.material,objects.length);
      mesh.castShadow=first.castShadow;
      mesh.receiveShadow=first.receiveShadow;
      mesh.name="Cutaway "+side+" details x"+objects.length;
      const matrix=new THREE.Matrix4();
      objects.forEach((object,i)=>{
        matrix.multiplyMatrices(wallInverse,object.matrixWorld);
        mesh.setMatrixAt(i,matrix);
        object.parent.remove(object);
      });
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere?.();
      wall.add(mesh);
      batches++;
    }
  }
  return batches;
}
export function buildOffice(count=12){
  const bays=Math.max(4,Math.ceil(Math.min(150,Math.max(1,count))/3));
  // Generous aisle between full-sized workstations for walking and NPC social interaction.
  // Every fourth row also creates an additional cross-passage.
  const rowStart=2.3,step=6.80,passageGap=3.2; // 3.44 m between 3.36 m desk tops; wider cross passages
  const rowZ=i=>rowStart+i*step+Math.floor(i/4)*passageGap;
  const rowEnd=rowZ(bays-1);
  const passageCenters=[];
  for(let group=1;group<=Math.floor(bays/4);group++){
    const last=rowZ(group*4-1);
    const next=group*4<bays?rowZ(group*4):last+step+passageGap;
    passageCenters.push((last+next)/2);
  }
  // A clearly visible but separate decorated zone starts after the last desks.
  const partyStart=rowEnd+4.35,partyEnd=partyStart+7.35;
  const arcadeStart=partyEnd,arcadeDepth=12.5;
  const back=arcadeStart+arcadeDepth;
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
  // No modeled city/towers outside the north window. They clashed with the
  // detailed hybrid-voxel office art direction and were hard to read from
  // the elevated gameplay camera. The existing glass and window mullions
  // remain, opening onto the neutral winter sky backdrop of the scene.
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
    seats.push(workstation(root,-1.65,z,i,"L",colliders));
    seats.push(workstation(root,-.25,z,i,"R",colliders));
    // Individual desks already carry rear and both side partitions.
    if(i%3===0){
      plant(root,-4.6,z+2.1,.48);plant(root,2.6,z+2.1,.55);
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
  tree(party,5.60,2.80,1.07);
  colliders.push({x:5.60,z:partyStart+2.80,hx:1.62,hz:1.55});
  for(let k=0;k<24;k++){
    const layer=Math.floor(k/8),arc=(k%8)/8*Math.PI*2;
    const radius=1.45+layer*.33;
    const x=5.60+Math.cos(arc)*radius,z=2.80+Math.sin(arc)*radius;
    const scale=.20+((k*7)%5)*.075;
    present(party,x,z,scale,k+9);
  }
  // The party wall uses warm ribbed timber and built-in display niches,
  // positioned well away from the central arcade archway corridor.
  const wood=getInteriorFinishes().walnut;
  for(const cx of [-6.65,-5.20,5.20,6.85]){
    softBlock(party,cx,2.25,7.02,.77,3.25,.18,
      getInteriorFinishes().divider,.12,false);
    for(let j=0;j<7;j++){
      const stripe=block(party,cx-.29+j*.096,2.25,6.88,
        .045,3.13,.055,wood,false);
      stripe.castShadow=false;
    }
    block(party,cx,3.91,6.81,.70,.09,.13,
      getInteriorFinishes().trim,false);
    block(party,cx,.64,6.81,.70,.08,.13,
      getInteriorFinishes().trim,false);
  }
  // Festive framed boards on outer walls, clear of central access
  for(const x of [-5.45,6.65]){
    const plaque=softBlock(party,x,2.45,6.82,.73,1.02,.075,
      getInteriorFinishes().cabinet,.11,false);
    block(party,x,2.46,6.76,.59,.87,.045,0x3b705c,false);
    for(const yy of [2.72,2.45,2.18]){
      const lamp=ball(party,x,yy,6.704,.078,
        mat(yy>2.6?0xffe9a8:yy>2.3?0xd1636d:0xf4dba5,
          {emissive:yy>2.6?0xbe854a:0}),1);
      lamp.castShadow=false;
    }
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

  // Present table beside the stage (positioned safely at x: -1.40, z: 3.80)
  const giftTable=new THREE.Group();giftTable.position.set(-1.40,0,3.80);party.add(giftTable);
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
  // 🎄 Festive Refreshment & Cookie Bar in the party room
  const cookieBar=new THREE.Group();
  cookieBar.position.set(-6.35,0,2.55);
  cookieBar.rotation.y=Math.PI/2;
  party.add(cookieBar);
  block(cookieBar,0,.48,0,.68,.96,1.82,0xbba38e);
  block(cookieBar,0,.97,0,.74,.08,1.88,0xf7ede2);
  for(let ci=-2;ci<=2;ci++){
    cyl(cookieBar,0,1.02,ci*.32,.10,.10,.03,0xd2a679);
    ball(cookieBar,0,1.05,ci*.32,.04,0xb84b54);
  }
  colliders.push({x:-6.35,z:partyStart+2.55,hx:.55,hz:1.05});

  // =========================================================================
  // 🕹️ DEDICATED 3D RETRO ARCADE & RACING LOUNGE (SEPARATE ROOM)
  // Positioned past the party stage through the illuminated synthwave archway.
  // Spacious 15.8m x 12.4m room with giant deluxe arcade cabinets facing the camera,
  // ultra-clear glowing marquee text, deluxe pinball, hollow glass vending machine,
  // neon air hockey, and championship leaderboard.
  // =========================================================================

  // --- Archway Portal Header Sign (Party Stage side) ---
  neonSign(party,1.00,3.82,7.17,"🕹️ RETRO ARCADE","VOXEL RACERS & MOTORBIKES");

  // Portal Archway Colliders
  colliders.push({x:-4.50,z:arcadeStart,hx:3.90,hz:.25});
  colliders.push({x:5.30,z:arcadeStart,hx:2.70,hz:.25});

  // --- Dedicated Retro Arcade Lounge Group ---
  const arcadeRoom=new THREE.Group();
  arcadeRoom.position.z=arcadeStart;
  root.add(arcadeRoom);

  // --- Vibrant Retro Arcade Cyber Floor (Spacious 15.8m x 12.4m) ---
  // Rich lighter synthwave indigo base material for great reflectivity and brightness
  block(arcadeRoom,0,.024,6.25,15.80,.03,12.40,0x243450,false);

  // High-Contrast Neon Cyber Grid Lines
  for(let gx=-6;gx<=6;gx+=2){
    block(arcadeRoom,gx,.039,6.25,.04,.008,12.30,0x00e5ff,false);
  }
  for(let gz=1;gz<=11;gz+=2){
    block(arcadeRoom,0,.039,gz,15.60,.008,.04,0xff007f,false);
  }

  // Classic 90s Retro Arcade Carpet Medallions at Grid Intersections
  const carpetColors=[0x00e5ff,0xff007f,0xffea00,0x00ff88,0xaa00ff];
  let cColorIdx=0;
  for(let gx=-6;gx<=6;gx+=2){
    for(let gz=1;gz<=11;gz+=2){
      const dia=block(arcadeRoom,gx,.041,gz,.24,.006,.24,carpetColors[(cColorIdx++)%carpetColors.length],false);
      dia.rotation.y=Math.PI/4;
    }
  }

  // Glowing Baseboard Perimeter Trims
  block(arcadeRoom,-7.80,.08,6.25,.06,.12,12.30,0x00f0ff,false);
  block(arcadeRoom,7.80,.08,6.25,.06,.12,12.30,0xff007f,false);
  block(arcadeRoom,0,.08,12.38,15.60,.12,.06,0x00f0ff,false);
  block(arcadeRoom,0,4.22,12.38,15.60,.08,.08,0xff007f,false);

  // Modern Clean Slate-Blue Walls (Bright, Warm, High-Visibility)
  block(arcadeRoom,0,2.15,12.45,15.80,4.30,.28,0x32425e,false); // North back wall
  block(arcadeRoom,-7.85,2.15,6.25,.28,4.30,12.40,0x32425e,false); // West wall
  block(arcadeRoom,7.85,2.15,6.25,.28,4.30,12.40,0x32425e,false); // East wall

  // --- Vibrant Overhead Retro Arcade Illumination ---
  // High-intensity Hemispheric Fill Light so the entire room is bright and clear
  arcadeRoom.add(new THREE.HemisphereLight(0xb4d8ff,0x42385c,2.6));

  // Dedicated Directional Sun for crisp highlights and depth
  const arcSun=new THREE.DirectionalLight(0xfffaec,2.4);
  arcSun.position.set(0,8.0,4.0);
  arcadeRoom.add(arcSun);

  // Ambient room wash
  const arcAmbient=new THREE.PointLight(0x4a72a8,2.6,28.0,1.0);
  arcAmbient.position.set(0,3.6,6.2);
  arcadeRoom.add(arcAmbient);

  // 4 Overhead Industrial Synthwave Luminaires
  const ARC_LAMPS=[
    {x:-4.20,z:3.80,color:0x00f0ff,glow:0x00e5ff},
    {x:4.20,z:3.80,color:0xff00aa,glow:0xff007f},
    {x:-4.20,z:8.40,color:0xffea00,glow:0xffd700},
    {x:4.20,z:8.40,color:0x00ffcc,glow:0x00f0ff}
  ];
  ARC_LAMPS.forEach((lamp)=>{
    block(arcadeRoom,lamp.x,3.88,lamp.z,2.80,.10,.18,0x1b202c,false);
    block(arcadeRoom,lamp.x,3.82,lamp.z,2.60,.06,.06,lamp.glow,false);
    cyl(arcadeRoom,lamp.x-1.1,4.08,lamp.z,.01,.01,.40,0x94a3b8);
    cyl(arcadeRoom,lamp.x+1.1,4.08,lamp.z,.01,.01,.40,0x94a3b8);
    const pl=new THREE.PointLight(lamp.color,3.6,16.0,1.0);
    pl.position.set(lamp.x,3.60,lamp.z);
    arcadeRoom.add(pl);
  });

  // Center Skylight / Dais Downlight
  const daisDownlight=new THREE.PointLight(0xffffff,3.0,15.0,1.0);
  daisDownlight.position.set(0,3.90,5.20);
  arcadeRoom.add(daisDownlight);

  // =========================================================================
  // 1) NORTH WALL: 4 TOWERING DELUXE ARCADE CABINETS FACING SOUTH TO CAMERA
  // =========================================================================
  // Extra-large deluxe proportions (1.45m wide, 3.00m tall, 1.25m deep) with 1024x256
  // ultra-crisp marquees (80px bold fonts) and high-visibility 1024x768 screens.
  // Rotated Math.PI so they face SOUTH directly towards entering players and camera!
  const CAB_DEFS=[
    {
      id:"racers",
      title:"VOXEL RACERS",
      subtitle:"🏎️ TURBO GRAND PRIX 🏎️",
      themeColor:0x00f0ff,
      trimColor:0xff0055,
      x:-5.10,
      drawMarquee:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,w,h);
        bg.addColorStop(0,"#050e20");
        bg.addColorStop(0.5,"#002b4d");
        bg.addColorStop(1,"#050e20");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="#00f0ff";
        ctx.lineWidth=10;
        ctx.strokeRect(8,8,w-16,h-16);
        ctx.strokeStyle="#ff0055";
        ctx.lineWidth=4;
        ctx.strokeRect(18,18,w-36,h-36);
        ctx.textAlign="center";
        ctx.shadowColor="#00f0ff";
        ctx.shadowBlur=28;
        ctx.fillStyle="#ffffff";
        ctx.font="900 80px -apple-system, BlinkMacSystemFont, 'Impact', 'Arial Black', sans-serif";
        ctx.fillText("VOXEL RACERS",w/2,106);
        ctx.fillStyle="#00e5ff";
        ctx.font="bold 36px 'Courier New', monospace";
        ctx.shadowColor="#00e5ff";
        ctx.shadowBlur=14;
        ctx.fillText("🏎️ TURBO GRAND PRIX 3D 🏎️",w/2,185);
      },
      drawScreen:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,"#0a0826");
        bg.addColorStop(0.4,"#2a0845");
        bg.addColorStop(0.42,"#ff007f");
        bg.addColorStop(1,"#1b003a");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle="#00f0ff";
        ctx.beginPath();
        ctx.arc(w/2,h*0.36,95,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="#ff00aa";
        ctx.lineWidth=4;
        for(let y=h*0.42;y<h;y+=32){
          ctx.beginPath();
          ctx.moveTo(0,y);
          ctx.lineTo(w,y);
          ctx.stroke();
        }
        for(let x=60;x<w;x+=130){
          ctx.beginPath();
          ctx.moveTo(x,h);
          ctx.lineTo(w/2,h*0.42);
          ctx.stroke();
        }
        ctx.fillStyle="#ffea00";
        ctx.beginPath();
        ctx.moveTo(w/2,h*0.48);
        ctx.lineTo(w/2-70,h*0.82);
        ctx.lineTo(w/2+70,h*0.82);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle="#00f0ff";
        ctx.font="900 60px 'Impact', sans-serif";
        ctx.textAlign="center";
        ctx.shadowColor="#00f0ff";
        ctx.shadowBlur=18;
        ctx.fillText("1ST PLACE",w/2,h*0.22);
        ctx.fillStyle="#ffffff";
        ctx.font="bold 44px monospace";
        ctx.shadowColor="#ffea00";
        ctx.shadowBlur=12;
        ctx.fillText("LAP 1/3  ·  0:41.82",w/2,h*0.94);
      }
    },
    {
      id:"bikes",
      title:"REDLINE BIKES",
      subtitle:"🏍️ NITRO MOTOCROSS 🏍️",
      themeColor:0xffea00,
      trimColor:0xff2200,
      x:-1.70,
      drawMarquee:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,w,h);
        bg.addColorStop(0,"#2b0d00");
        bg.addColorStop(0.5,"#662200");
        bg.addColorStop(1,"#2b0d00");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="#ffea00";
        ctx.lineWidth=10;
        ctx.strokeRect(8,8,w-16,h-16);
        ctx.strokeStyle="#ff2200";
        ctx.lineWidth=4;
        ctx.strokeRect(18,18,w-36,h-36);
        ctx.textAlign="center";
        ctx.shadowColor="#ffea00";
        ctx.shadowBlur=28;
        ctx.fillStyle="#ffffff";
        ctx.font="900 80px -apple-system, BlinkMacSystemFont, 'Impact', 'Arial Black', sans-serif";
        ctx.fillText("REDLINE BIKES",w/2,106);
        ctx.fillStyle="#ffdd00";
        ctx.font="bold 36px 'Courier New', monospace";
        ctx.shadowColor="#ff2200";
        ctx.shadowBlur=14;
        ctx.fillText("🏍️ NITRO MOTOCROSS 3D 🏍️",w/2,185);
      },
      drawScreen:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,"#150025");
        bg.addColorStop(0.5,"#3b003a");
        bg.addColorStop(0.52,"#ff5500");
        bg.addColorStop(1,"#1a0500");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="#ffea00";
        ctx.lineWidth=4;
        for(let y=h*0.52;y<h;y+=28){
          ctx.beginPath();
          ctx.moveTo(0,y);
          ctx.lineTo(w,y);
          ctx.stroke();
        }
        ctx.fillStyle="#00ffcc";
        ctx.beginPath();
        ctx.arc(w/2,h*0.72,55,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle="#ffffff";
        ctx.font="900 62px 'Impact', sans-serif";
        ctx.textAlign="center";
        ctx.shadowColor="#ff5500";
        ctx.shadowBlur=20;
        ctx.fillText("SPEED 224 KM/H",w/2,h*0.25);
        ctx.fillStyle="#ffea00";
        ctx.font="bold 44px monospace";
        ctx.shadowColor="#ffea00";
        ctx.shadowBlur=12;
        ctx.fillText("NITRO READY! [SHIFT]",w/2,h*0.94);
      }
    },
    {
      id:"strike",
      title:"CYBER STRIKE",
      subtitle:"🚀 RETRO SPACE FIGHTER 🚀",
      themeColor:0xff00aa,
      trimColor:0x00f0ff,
      x:1.70,
      drawMarquee:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,w,h);
        bg.addColorStop(0,"#1a0020");
        bg.addColorStop(0.5,"#420040");
        bg.addColorStop(1,"#1a0020");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="#ff00aa";
        ctx.lineWidth=10;
        ctx.strokeRect(8,8,w-16,h-16);
        ctx.strokeStyle="#00f0ff";
        ctx.lineWidth=4;
        ctx.strokeRect(18,18,w-36,h-36);
        ctx.textAlign="center";
        ctx.shadowColor="#ff00aa";
        ctx.shadowBlur=28;
        ctx.fillStyle="#ffffff";
        ctx.font="900 80px -apple-system, BlinkMacSystemFont, 'Impact', 'Arial Black', sans-serif";
        ctx.fillText("CYBER STRIKE",w/2,106);
        ctx.fillStyle="#ff3b94";
        ctx.font="bold 36px 'Courier New', monospace";
        ctx.shadowColor="#00f0ff";
        ctx.shadowBlur=14;
        ctx.fillText("🚀 RETRO SPACE FIGHTER 🚀",w/2,185);
      },
      drawScreen:(ctx,w,h)=>{
        ctx.fillStyle="#040212";
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle="#ffffff";
        for(let i=0;i<90;i++){
          const sx=(i*73)%w,sy=(i*97)%h,sz=(i%3)+1;
          ctx.fillRect(sx,sy,sz,sz);
        }
        ctx.fillStyle="#ff007f";
        ctx.beginPath();
        ctx.moveTo(w/2,h*0.42);
        ctx.lineTo(w/2-55,h*0.62);
        ctx.lineTo(w/2+55,h*0.62);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle="#00f0ff";
        ctx.fillRect(w/2-8,h*0.28,16,50);
        ctx.fillStyle="#ffea00";
        ctx.font="900 62px 'Impact', sans-serif";
        ctx.textAlign="center";
        ctx.shadowColor="#ff00aa";
        ctx.shadowBlur=18;
        ctx.fillText("SCORE 098,450",w/2,h*0.22);
        ctx.fillStyle="#00ff88";
        ctx.font="bold 42px monospace";
        ctx.shadowColor="#00ff88";
        ctx.shadowBlur=12;
        ctx.fillText("SHIELDS 100% · LIVES 3",w/2,h*0.94);
      }
    },
    {
      id:"hopper",
      title:"PIXEL HOPPER",
      subtitle:"❄️ CHRISTMAS ARCADE ❄️",
      themeColor:0x00ff88,
      trimColor:0xffea00,
      x:5.10,
      drawMarquee:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,w,h);
        bg.addColorStop(0,"#001a10");
        bg.addColorStop(0.5,"#003820");
        bg.addColorStop(1,"#001a10");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle="#00ff88";
        ctx.lineWidth=10;
        ctx.strokeRect(8,8,w-16,h-16);
        ctx.strokeStyle="#ffea00";
        ctx.lineWidth=4;
        ctx.strokeRect(18,18,w-36,h-36);
        ctx.textAlign="center";
        ctx.shadowColor="#00ff88";
        ctx.shadowBlur=28;
        ctx.fillStyle="#ffffff";
        ctx.font="900 80px -apple-system, BlinkMacSystemFont, 'Impact', 'Arial Black', sans-serif";
        ctx.fillText("PIXEL HOPPER",w/2,106);
        ctx.fillStyle="#00ffaa";
        ctx.font="bold 36px 'Courier New', monospace";
        ctx.shadowColor="#ffea00";
        ctx.shadowBlur=14;
        ctx.fillText("❄️ CHRISTMAS SPECIAL ❄️",w/2,185);
      },
      drawScreen:(ctx,w,h)=>{
        const bg=ctx.createLinearGradient(0,0,0,h);
        bg.addColorStop(0,"#021820");
        bg.addColorStop(0.6,"#033038");
        bg.addColorStop(1,"#011218");
        ctx.fillStyle=bg;
        ctx.fillRect(0,0,w,h);
        for(let row=0;row<5;row++){
          const ry=h*0.25+row*95;
          ctx.fillStyle=row%2===0?"#005540":"#003850";
          ctx.fillRect(0,ry,w,75);
          ctx.fillStyle="#ffea00";
          const rx=((row*140)+180)%w;
          ctx.fillRect(rx,ry+18,70,40);
        }
        ctx.fillStyle="#00ff88";
        ctx.beginPath();
        ctx.arc(w/2,h*0.78,38,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle="#ffffff";
        ctx.font="900 62px 'Impact', sans-serif";
        ctx.textAlign="center";
        ctx.shadowColor="#00ff88";
        ctx.shadowBlur=18;
        ctx.fillText("STAGE 04 / 10",w/2,h*0.18);
        ctx.fillStyle="#ffea00";
        ctx.font="bold 42px monospace";
        ctx.shadowColor="#ffea00";
        ctx.shadowBlur=12;
        ctx.fillText("COINS: 32  ·  BONUS: x2",w/2,h*0.94);
      }
    }
  ];

  CAB_DEFS.forEach((cd)=>{
    const cab=new THREE.Group();
    cab.position.set(cd.x,0,11.20);
    // Face SOUTH towards the incoming aisle and player camera!
    cab.rotation.y=Math.PI;
    arcadeRoom.add(cab);

    // Deluxe Heavy Arcade Cabinet Chassis Frame (1.45m wide x 3.00m tall x 1.25m deep)
    block(cab,0,1.50,0,1.45,3.00,1.25,0x101522);
    // Luminous Cyber Side Wings & Edge Bevels
    block(cab,-.74,1.50,0,.08,3.00,1.28,cd.themeColor);
    block(cab,.74,1.50,0,.08,3.00,1.28,cd.themeColor);
    // Outer Neon Outline Ribbons
    block(cab,-.77,1.50,-.62,.04,2.96,.04,cd.trimColor);
    block(cab,.77,1.50,-.62,.04,2.96,.04,cd.trimColor);
    block(cab,-.77,1.50,.62,.04,2.96,.04,cd.trimColor);
    block(cab,.77,1.50,.62,.04,2.96,.04,cd.trimColor);

    // Giant 1024x256 Lit Header Marquee
    const canM=document.createElement("canvas");
    canM.width=1024;
    canM.height=256;
    const ctxM=canM.getContext("2d");
    cd.drawMarquee(ctxM,1024,256);
    const texM=new THREE.CanvasTexture(canM);
    texM.colorSpace=THREE.SRGBColorSpace;
    texM.needsUpdate=true;
    const geoM=new THREE.PlaneGeometry(1.36,.48);
    const matM=new THREE.MeshBasicMaterial({map:texM});
    const meshM=new THREE.Mesh(geoM,matM);
    meshM.position.set(0,2.54,.54);
    meshM.rotation.x=.18;
    cab.add(meshM);

    // High-Resolution 1024x768 CRT Arcade Screen Display
    const canS=document.createElement("canvas");
    canS.width=1024;
    canS.height=768;
    const ctxS=canS.getContext("2d");
    cd.drawScreen(ctxS,1024,768);
    const texS=new THREE.CanvasTexture(canS);
    texS.colorSpace=THREE.SRGBColorSpace;
    texS.needsUpdate=true;
    const geoS=new THREE.PlaneGeometry(1.22,.84);
    const matS=new THREE.MeshBasicMaterial({map:texS});
    const meshS=new THREE.Mesh(geoS,matS);
    meshS.position.set(0,1.76,.46);
    meshS.rotation.x=-.26;
    cab.add(meshS);

    // Slanted Deluxe Control Deck
    const cDeck=block(cab,0,1.22,.56,1.32,.14,.52,0x1a2130);
    cDeck.rotation.x=.18;

    // Dual Chrome Joysticks with Glowing Ball Tops
    cyl(cab,-.34,1.32,.54,.024,.024,.15,0xd0d8e0);
    ball(cab,-.34,1.42,.54,.065,cd.themeColor);
    cyl(cab,.34,1.32,.54,.024,.024,.15,0xd0d8e0);
    ball(cab,.34,1.42,.54,.065,cd.trimColor);

    // Colorful Action Buttons
    [-.48,-.34,-.20].forEach((bx,i)=>{
      cyl(cab,bx,1.29,.62,.032,.032,.03,[0xff0044,0x00e5ff,0xffea00][i]);
    });
    [.20,.34,.48].forEach((bx,i)=>{
      cyl(cab,bx,1.29,.62,.032,.032,.03,[0x00ff88,0xffffff,0xaa00ff][i]);
    });
    // 1P & 2P Start buttons
    cyl(cab,-.09,1.31,.42,.022,.022,.028,0xffffff);
    cyl(cab,.09,1.31,.42,.022,.022,.028,0xffffff);

    // Lower Coin Door with Dual Glowing Orange 25¢ Inserts
    block(cab,0,.60,.60,.74,.76,.04,0x0a0d14);
    block(cab,-.16,.72,.63,.08,.11,.02,0xff6600);
    block(cab,.16,.72,.63,.08,.11,.02,0xff6600);
    block(cab,-.16,.50,.63,.11,.12,.03,0x222a38);
    block(cab,.16,.50,.63,.11,.12,.03,0x222a38);

    // Matching Chrome Swivel Bar Stool in front of cabinet (facing cabinet)
    const stool=new THREE.Group();
    stool.position.set(cd.x,0,9.85);
    arcadeRoom.add(stool);
    cyl(stool,0,.02,0,.36,.36,.04,0xd0d8e0,18);
    cyl(stool,0,.42,0,.038,.038,.82,0xd0d8e0,14);
    cyl(stool,0,.26,0,.24,.24,.03,0xd0d8e0,18);
    cyl(stool,0,.82,0,.30,.30,.12,cd.themeColor,18);
    ball(stool,0,.88,0,.29,cd.trimColor);

    // Dedicated Machine Downlight
    const cLight=new THREE.PointLight(cd.themeColor,3.4,9.0,1.0);
    cLight.position.set(cd.x,3.4,10.40);
    arcadeRoom.add(cLight);
  });

  // =========================================================================
  // 2) NORTH WALL HEADER: GIANT CHAMPIONSHIP LEADERBOARD (y: 3.55, z: 12.35)
  // =========================================================================
  const canBoard=document.createElement("canvas");
  canBoard.width=2048;
  canBoard.height=512;
  const ctxBoard=canBoard.getContext("2d");
  const bgGrad=ctxBoard.createLinearGradient(0,0,0,512);
  bgGrad.addColorStop(0,"#090f1d");
  bgGrad.addColorStop(1,"#04070d");
  ctxBoard.fillStyle=bgGrad;
  ctxBoard.fillRect(0,0,2048,512);
  ctxBoard.strokeStyle="#00f0ff";
  ctxBoard.lineWidth=14;
  ctxBoard.strokeRect(12,12,2024,488);
  ctxBoard.strokeStyle="#ff007f";
  ctxBoard.lineWidth=5;
  ctxBoard.strokeRect(26,26,1996,460);

  ctxBoard.shadowColor="#00f0ff";
  ctxBoard.shadowBlur=28;
  ctxBoard.fillStyle="#ffffff";
  ctxBoard.font="900 68px -apple-system, BlinkMacSystemFont, 'Impact', 'Segoe UI', sans-serif";
  ctxBoard.textAlign="center";
  ctxBoard.fillText("🏆 RETRO ARCADE CHAMPIONSHIP 🏆",1024,96);

  ctxBoard.font="bold 40px 'Courier New', monospace";
  ctxBoard.textAlign="left";
  const scores=[
    {rank:"1ST",name:"SANTA SPEEDSTER",time:"0:41.82",game:"VOXEL RACERS",color:"#00f0ff"},
    {rank:"2ND",name:"HOLIDAY ELX",time:"0:44.20",game:"REDLINE BIKES",color:"#fbbf24"},
    {rank:"3RD",name:"RUDOLPH DRIFT",time:"0:46.05",game:"VOXEL RACERS",color:"#ff3b94"},
    {rank:"4TH",name:"CYBER FROST",time:"0:47.38",game:"VOXEL RACERS",color:"#00ff88"}
  ];
  scores.forEach((s,idx)=>{
    const yy=176+idx*74;
    ctxBoard.fillStyle=s.color;
    ctxBoard.shadowColor=s.color;
    ctxBoard.shadowBlur=14;
    ctxBoard.fillText(`${s.rank}  ${s.name.padEnd(18)}  ${s.time}  [${s.game}]`,140,yy);
  });
  const texBoard=new THREE.CanvasTexture(canBoard);
  texBoard.colorSpace=THREE.SRGBColorSpace;
  texBoard.needsUpdate=true;
  const boardMesh=new THREE.Mesh(new THREE.PlaneGeometry(8.20,2.05),new THREE.MeshBasicMaterial({map:texBoard,side:THREE.DoubleSide}));
  boardMesh.position.set(0,3.55,12.35);
  boardMesh.rotation.y=Math.PI; // Face south directly towards entering players
  arcadeRoom.add(boardMesh);

  // =========================================================================
  // 3) EAST WALL: HOLLOW GLASS VENDING MACHINE & NEON AIR HOCKEY (x: 6.20)
  // =========================================================================

  // --- 3A) DELUXE GLASS-FRONT ILLUMINATED VENDING MACHINE (x: 6.20, z: 4.80) ---
  const soda=new THREE.Group();
  soda.position.set(6.20,0,4.80);
  soda.rotation.y=-Math.PI/2;
  arcadeRoom.add(soda);

  // Outer cabinet chassis frame - HOLLOW SHELL
  block(soda,0,1.48,-.58,1.85,2.95,.08,0x161c28); // Back
  block(soda,-.90,1.48,0,.08,2.95,1.15,0x161c28); // Left
  block(soda,.90,1.48,0,.08,2.95,1.15,0x161c28);  // Right
  block(soda,0,2.91,0,1.85,.10,1.15,0x161c28);   // Top roof
  block(soda,0,.26,0,1.85,.52,1.15,0x161c28);    // Base pedestal

  // Illuminated Marquee Sign at Top (1024x240)
  const canSod=document.createElement("canvas");
  canSod.width=1024;
  canSod.height=240;
  const ctxSod=canSod.getContext("2d");
  const sodGrad=ctxSod.createLinearGradient(0,0,1024,0);
  sodGrad.addColorStop(0,"#051c2c");
  sodGrad.addColorStop(0.5,"#005580");
  sodGrad.addColorStop(1,"#051c2c");
  ctxSod.fillStyle=sodGrad;
  ctxSod.fillRect(0,0,1024,240);
  ctxSod.strokeStyle="#00f0ff";
  ctxSod.lineWidth=10;
  ctxSod.strokeRect(8,8,1008,224);
  ctxSod.shadowColor="#00f0ff";
  ctxSod.shadowBlur=20;
  ctxSod.fillStyle="#ffffff";
  ctxSod.font="900 72px -apple-system, BlinkMacSystemFont, 'Impact', sans-serif";
  ctxSod.textAlign="center";
  ctxSod.fillText("⚡ REFRESH & SNACKS ⚡",512,105);
  ctxSod.fillStyle="#ffea00";
  ctxSod.font="bold 38px monospace";
  ctxSod.shadowColor="#ffea00";
  ctxSod.shadowBlur=12;
  ctxSod.fillText("COLD DRINKS · POWER SNACKS",512,185);
  const texSod=new THREE.CanvasTexture(canSod);
  texSod.colorSpace=THREE.SRGBColorSpace;
  texSod.needsUpdate=true;
  const sodSignMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.68,.40),new THREE.MeshBasicMaterial({map:texSod}));
  sodSignMesh.position.set(-.10,2.65,.58);
  soda.add(sodSignMesh);

  // Interior cavity backlight
  const sodaLight=new THREE.PointLight(0xffffff,2.8,4.5,1.0);
  sodaLight.position.set(-.28,1.70,.10);
  soda.add(sodaLight);

  // Clear Transparent Glass Front Window
  const glassMat=new THREE.MeshStandardMaterial({
    color:0xd8f0ff,
    transparent:true,
    opacity:0.35,
    roughness:0.05,
    metalness:0.1
  });
  const glassMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.10,1.95),glassMat);
  glassMesh.position.set(-.30,1.60,.57);
  soda.add(glassMesh);

  // 4 Shelves inside the clear glass compartment
  const SHELF_Y=[.82,1.26,1.70,2.14];
  SHELF_Y.forEach((sy,sIdx)=>{
    block(soda,-.30,sy,0,1.08,.025,.88,0xd8e0e8);
    block(soda,-.30,sy+.018,.45,1.08,.012,.02,0x00f0ff);
    if(sIdx<=1){
      const canColors=[0xff2244,0x00f0ff,0xffea00,0x00ff66,0xaa00ff];
      for(let ci=-3;ci<=3;ci++){
        const canCol=canColors[(ci+4+sIdx)%canColors.length];
        cyl(soda,-.30+ci*.13,sy+.14,-.15,.036,.036,.18,canCol,12);
        cyl(soda,-.30+ci*.13,sy+.14,.18,.036,.036,.18,canCol,12);
      }
    }else{
      const snackColors=[0xff9900,0x00c853,0xd50000,0x2979ff];
      for(let bi=-2;bi<=2;bi++){
        const snkCol=snackColors[(bi+3)%snackColors.length];
        block(soda,-.30+bi*.18,sy+.14,-.10,.12,.18,.14,snkCol);
        block(soda,-.30+bi*.18,sy+.14,.20,.12,.18,.14,snkCol);
      }
    }
  });

  // Right Side Interface Column
  block(soda,.58,1.60,.50,.50,2.05,.12,0x101522);
  // Numeric keypad with glowing buttons
  block(soda,.58,2.02,.57,.30,.32,.02,0x05070a);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const kx=.48+col*.10,ky=2.12-row*.065;
    block(soda,kx,ky,.585,.06,.045,.015,0x405060);
  }
  // Coin Drop Slot with Chrome Bezel & Red Coin Return
  block(soda,.58,1.40,.56,.16,.10,.025,0x222a38);
  block(soda,.58,1.41,.575,.06,.012,.012,0x05070a);
  cyl(soda,.63,1.36,.58,.02,.02,.02,0xff2244);
  // Dollar Bill Validator with Soft Green LED Light
  block(soda,.58,1.16,.56,.26,.12,.025,0x161e2a);
  block(soda,.58,1.16,.575,.20,.02,.012,0x00ff66);
  // Coin Return Cup
  block(soda,.58,.82,.56,.24,.22,.08,0x080b12);

  // Bottom Dispenser Bin with Stainless Push Door Flap
  block(soda,-.30,.30,.40,1.06,.36,.34,0x080b12);
  block(soda,-.30,.30,.56,1.00,.32,.04,0x222a36);
  cyl(soda,-.30,.40,.59,.014,.014,.72,0xd0d8e2); // Silver handle

  // --- 3B) DELUXE NEON AIR HOCKEY TABLE (x: 6.20, z: 8.50) ---
  const ah=new THREE.Group();
  ah.position.set(6.20,0,8.50);
  ah.rotation.y=-Math.PI/2;
  arcadeRoom.add(ah);

  // Table legs and chassis (1.85m wide, 3.10m long, 0.90m tall)
  block(ah,0,.45,0,1.85,.90,3.10,0x141a26);
  block(ah,-.92,.88,0,.06,.16,3.12,0x00f0ff);
  block(ah,.92,.88,0,.06,.16,3.12,0x00f0ff);
  block(ah,0,.88,-1.56,1.90,.16,.06,0xff0055);
  block(ah,0,.88,1.56,1.90,.16,.06,0xff0055);

  // Ice-smooth cyan illuminated playfield
  block(ah,0,.92,0,1.75,.025,2.98,0x0a2236);
  cyl(ah,0,.935,0,.38,.38,.006,0x00f0ff,24); // Center face-off circle
  block(ah,0,.935,0,1.75,.006,.04,0xff0044); // Center dividing line

  // Goal slots
  block(ah,0,.925,-1.38,.60,.025,.14,0x050810);
  block(ah,0,.925,1.38,.60,.025,.14,0x050810);

  // Dual Ergonomic Strikers & Glowing Puck
  cyl(ah,-.32,.96,-.80,.07,.095,.06,0x00f0ff);
  cyl(ah,-.32,1.02,-.80,.028,.028,.06,0xffffff);
  cyl(ah,.32,.96,.80,.07,.095,.06,0xff0044);
  cyl(ah,.32,1.02,.80,.028,.028,.06,0xffffff);
  cyl(ah,.12,.94,.18,.06,.06,.02,0xff2244,16); // Puck

  // Overhead Score Archway
  cyl(ah,-.88,1.45,0,.028,.028,1.05,0x94a3b8);
  cyl(ah,.88,1.45,0,.028,.028,1.05,0x94a3b8);
  block(ah,0,1.95,0,1.82,.04,.04,0x94a3b8);
  block(ah,0,1.90,0,.70,.22,.15,0x0c1018);
  block(ah,0,1.90,.08,.62,.14,.015,0xff2244); // Score display

  // =========================================================================
  // 4) WEST WALL: PINBALL MACHINES & VIP GAMER CHILLOUT LOUNGE (x: -6.20)
  // =========================================================================

  // --- 4A) DELUXE ILLUMINATED PINBALL MACHINES (x: -6.20, z: 3.80 & 5.80) ---
  const PB_DEFS=[
    {title:"GALAXY PINBALL DX",score:"5,420,800",color:0x00f0ff,accent:0xffea00},
    {title:"SANTA'S MULTIBALL",score:"6,810,250",color:0xff0055,accent:0x00ff88}
  ];
  PB_DEFS.forEach((pbd,pIdx)=>{
    const pz=3.80+pIdx*2.00;
    const pb=new THREE.Group();
    pb.position.set(-6.20,0,pz);
    pb.rotation.y=Math.PI/2;
    arcadeRoom.add(pb);

    // Chrome legs
    for(const lx of [-.36,.36])for(const lz of [-.80,.80]){
      cyl(pb,lx,.40,lz,.030,.022,.80,0xd0d8e0,8);
    }

    // Sloped wooden cabinet body (0.88m wide x 1.75m long)
    const pbBody=block(pb,0,.86,0,.88,.46,1.75,0x161c28);
    pbBody.rotation.x=.12;
    // Playfield glass cover
    const pbGlass=block(pb,0,1.06,.05,.80,.035,1.55,pbd.color);
    pbGlass.rotation.x=.12;

    // Interior 3D bumpers & flippers under glass
    cyl(pb,-.16,1.06,-.20,.065,.065,.05,0xff0055,12);
    cyl(pb,.16,1.06,-.20,.065,.065,.05,0x00f0ff,12);
    cyl(pb,0,1.02,.08,.065,.065,.05,0xffea00,12);

    // Backbox Header Tower with High-Res Lit Backglass (1024x640)
    const bb=block(pb,0,1.86,-.82,.88,.94,.28,0x161c28);
    bb.rotation.x=-.05;

    const canPB=document.createElement("canvas");
    canPB.width=1024;
    canPB.height=640;
    const ctxPB=canPB.getContext("2d");
    const pbGrad=ctxPB.createLinearGradient(0,0,1024,640);
    pbGrad.addColorStop(0,"#050814");
    pbGrad.addColorStop(0.5,"#200830");
    pbGrad.addColorStop(1,"#050814");
    ctxPB.fillStyle=pbGrad;
    ctxPB.fillRect(0,0,1024,640);
    ctxPB.strokeStyle=pbd.accent===0xffea00?"#ffea00":"#00ff88";
    ctxPB.lineWidth=10;
    ctxPB.strokeRect(12,12,1000,616);
    ctxPB.shadowColor="#00f0ff";
    ctxPB.shadowBlur=24;
    ctxPB.fillStyle="#ffffff";
    ctxPB.font="900 68px 'Impact', sans-serif";
    ctxPB.textAlign="center";
    ctxPB.fillText(pbd.title,512,140);
    ctxPB.fillStyle="#ff0055";
    ctxPB.font="bold 42px monospace";
    ctxPB.fillText("★ MULTIBALL FEVER ★",512,230);
    ctxPB.fillStyle="#000000";
    ctxPB.fillRect(160,320,704,180);
    ctxPB.strokeStyle="#ffea00";
    ctxPB.lineWidth=4;
    ctxPB.strokeRect(160,320,704,180);
    ctxPB.fillStyle="#ff3300";
    ctxPB.font="900 76px 'Courier New', monospace";
    ctxPB.shadowColor="#ff3300";
    ctxPB.shadowBlur=18;
    ctxPB.fillText(pbd.score,512,435);
    ctxPB.fillStyle="#00f0ff";
    ctxPB.font="bold 34px monospace";
    ctxPB.shadowBlur=8;
    ctxPB.fillText("INSERT COIN · PLAY 1 OR 2 PLAYERS",512,565);

    const texPB=new THREE.CanvasTexture(canPB);
    texPB.colorSpace=THREE.SRGBColorSpace;
    texPB.needsUpdate=true;
    const bgMesh=new THREE.Mesh(new THREE.PlaneGeometry(.80,.86),new THREE.MeshBasicMaterial({map:texPB}));
    bgMesh.position.set(0,1.86,-.67);
    bgMesh.rotation.x=-.05;
    pb.add(bgMesh);
  });

  // --- 4B) VIP GAMER CHILLOUT LOUNGE (x: -5.80, z: 8.80) ---
  const gamerLounge=new THREE.Group();
  gamerLounge.position.set(-5.80,0,8.80);
  gamerLounge.rotation.y=Math.PI/2;
  arcadeRoom.add(gamerLounge);

  // Modern synthwave sectional sofa
  block(gamerLounge,0,.30,0,3.60,.48,1.10,0x141b29); // Base
  block(gamerLounge,0,.68,-.46,3.60,.68,.34,0x1e273a); // Backrest
  // L-extension wing
  block(gamerLounge,-1.45,.30,.75,1.10,.48,1.60,0x141b29);
  block(gamerLounge,-1.82,.68,.75,.34,.68,1.60,0x1e273a);
  // Neon accent throw pillows
  block(gamerLounge,-1.40,.68,.34,.42,.32,.16,0x00f0ff);
  block(gamerLounge,0,.68,.34,.42,.32,.16,0xff007f);
  block(gamerLounge,1.40,.68,.34,.42,.32,.16,0xffea00);

  // Low frosted glass cocktail table
  block(gamerLounge,-.45,.32,-.70,1.30,.54,.82,0x161e2c);
  block(gamerLounge,-.45,.60,-.70,1.36,.025,.88,0x80d8ff); // Glass top
  // Soda cans & pizza box on table
  cyl(gamerLounge,-.75,.70,-.70,.04,.04,.14,0xd32f2f);
  cyl(gamerLounge,-.60,.70,-.58,.04,.04,.14,0x00e5ff);
  block(gamerLounge,-.18,.66,-.70,.44,.07,.44,0xd2a679); // Pizza box

  // =========================================================================
  // 5) CENTER INTERACTIVE TELEMETRY DAIS & FLOATING TROPHY HOLOGRAM (x: 0, z: 5.20)
  // =========================================================================
  const dais=new THREE.Group();
  dais.position.set(0,0,5.20);
  arcadeRoom.add(dais);

  // Triple concentric glowing floor rings
  cyl(dais,0,.04,0,1.80,1.80,.07,0x00f0ff,28);
  cyl(dais,0,.05,0,1.40,1.40,.06,0xff007f,28);
  cyl(dais,0,.06,0,1.00,1.00,.06,0xffea00,24);

  // High-tech holographic telemetry pedestal
  cyl(dais,0,.48,0,.40,.34,.90,0x1b2334,16);
  block(dais,0,.95,0,.60,.07,.60,0x00f0ff);

  // Floating 3D Golden Arcade Trophy & Joystick Hologram
  cyl(dais,0,1.25,0,.07,.14,.38,0xffd700,12);
  cyl(dais,0,1.50,0,.20,.09,.26,0xffd700,16);
  ball(dais,0,1.66,0,.07,0xffea00);
  // Side handles
  block(dais,-.25,1.50,0,.035,.20,.035,0xffd700);
  block(dais,.25,1.50,0,.035,.20,.035,0xffd700);

  // =========================================================================
  // 6) UPDATED COLLIDERS: SPACIOUS ROOM & FULLY PROTECTED BOUNDARIES
  // =========================================================================
  // Room perimeter wall colliders
  colliders.push({x:-7.85,z:arcadeStart+6.25,hx:.30,hz:6.25});
  colliders.push({x:7.85,z:arcadeStart+6.25,hx:.30,hz:6.25});
  colliders.push({x:0,z:arcadeStart+12.45,hx:7.85,hz:.30});

  // Equipment colliders (North cabinets, East vending & air hockey, West pinball & lounge, Center dais)
  colliders.push({x:0,z:arcadeStart+11.20,hx:6.80,hz:1.10});      // North 4 giant arcade cabinets row
  colliders.push({x:6.20,z:arcadeStart+4.80,hx:1.20,hz:1.10});    // East vending machine
  colliders.push({x:6.20,z:arcadeStart+8.50,hx:1.20,hz:1.70});    // East air hockey table
  colliders.push({x:-6.20,z:arcadeStart+4.80,hx:1.20,hz:2.10});   // West pinball machines row
  colliders.push({x:-5.80,z:arcadeStart+8.80,hx:1.30,hz:2.10});   // West VIP Gamer Lounge
  colliders.push({x:0,z:arcadeStart+5.20,hx:1.00,hz:1.00});       // Center telemetry dais

  // Stage & party colliders
  colliders.push({x:-3.23,z:partyStart+5.03,hx:3.48,hz:1.15});
  colliders.push({x:-3.2,z:partyStart+3.66,hx:2.40,hz:.67});
  colliders.push({x:-1.40,z:partyStart+3.80,hx:1.20,hz:.60});
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

  // Wall/floor visual dressing never changes seats, clues or walkable space.
  dressOfficeArchitecture(root,{left,right,front,partyStart,bays,rowZ,viewWalls},
    {softBlock,block,ball,mat});
  // Major high-contrast feature walls, green/gold promenade and sculpted
  // Christmas stage. All are presentational and leave nav colliders untouched.
  buildArchitecturalBays(root,{left,right,front,partyStart,bays,rowZ,viewWalls,twinkle},
    {softBlock,block,ball,mat});
  sculptCelebrationStage(party,{twinkle},{softBlock,block,ball,mat});
  const optimizedBatches=batchOfficeStaticGeometry(root,twinkle,viewWalls,arcadeRoom);
  return {root,colliders,seats,spawn,bays,optimizedBatches,
    arcadeStation:{x:0,z:arcadeStart+10.00,approachX:0,approachZ:arcadeStart+3.00,roomZ:arcadeStart},
    // Structural wall passages are not additional explorable rooms.
    room:{left,right,front,back},
    partyStart,twinkle,viewWalls,passageCenters,rowZ,deskPitch:step,passageGap};
}
