/**
 * Christmas Office / Visual Overhaul 2
 *
 * Large, wide-camera-readable architectural silhouettes.  Geometry is
 * intentionally confined to perimeter walls, existing workstations and the
 * already-collidable presentation stage. No new floor-level obstacles.
 *
 * Materials are passed through the office's shared material cache and
 * primitive box/sphere geometry is already suitable for InstancedMesh.
 * Secret Santa desk clue props/coordinates are not changed here.
 */
const WOOD=0x956746, WALNUT=0x694d43, FOREST=0x28594d,
      PINE=0x34785d, GOLD=0xebc77c, CREAM=0xf9ead2, ROSE=0xaa4f60;
const glowMaterial=(mat,color,emissive)=>mat(color,{emissive:emissive||color,roughness:.28});
const tick=(twinkle,m)=>{if(twinkle)twinkle.push(m);return m;};

// A bold facade stretching over each office bay. Think premium fitted
// cabinetry plus softly lit Christmas display windows, rather than a flat
// 4m white wall. Everything sits directly in the removable EAST wall group.
export function buildArchitecturalBays(root,config,kit){
  const {left,right,front,bays,rowZ,viewWalls,partyStart,twinkle}=config;
  const {block,softBlock,ball,mat}=kit;
  const east=viewWalls.east;
  const palette=[
    {wall:0x49746a,inset:0x31554f,rail:0xc6a67f,light:0xffd98a},
    {wall:0x8d5e69,inset:0x693d4e,rail:0xd5b090,light:0xffe0b0},
    {wall:0x58758c,inset:0x3b556f,rail:0xd4c3a2,light:0xffd99f},
    {wall:0x9b775a,inset:0x6f5548,rail:0xe6c797,light:0xffe8b5}
  ];
  const x=right-.13;
  for(let row=0;row<bays;row++){
    const z=rowZ(row),theme=palette[row%palette.length];
    // Tall colored lower wall and a recessed contrasting feature panel.
    // x thickness extends into the old wall only, with no walkway blockage.
    softBlock(east,x,2.07,z,.105,2.90,4.06,theme.wall,.045,false);
    softBlock(east,x-.060,2.15,z,.052,2.42,3.40,theme.inset,.045,false);
    block(east,x-.111,3.35,z,.032,.085,3.68,theme.rail,false);
    block(east,x-.111,.94,z,.032,.070,3.65,theme.rail,false);
    // Wide vertical battens give each wall bay architectural rhythm.
    for(let n=0;n<6;n++){
      const zz=z-1.67+n*.67;
      block(east,x-.116,2.12,zz,.027,2.39,.053,theme.rail,false);
    }
    // Big high-contrast center medallion reads from the game's wide camera.
    const count=12;
    for(let n=0;n<count;n++){
      const t=Math.PI*2*n/count;
      const oy=2.42+Math.cos(t)*.46,oz=z+Math.sin(t)*.46;
      const bead=ball(east,x-.163,oy,oz,.14,
        n%3===0?0xe0d0a0:n%3===1?0x559e77:0xd8a08b,1);
      bead.castShadow=false;
    }
    const inner=ball(east,x-.19,2.42,z,.27,mat(0x2a5d53,{roughness:.48}),1);
    inner.scale.set(.26,1.16,1.16);inner.castShadow=false;
    const star=ball(east,x-.264,2.45,z,.125,glowMaterial(mat,theme.light,0x9b6236),1);
    star.scale.set(.25,1.2,1.2);star.castShadow=false;
    // Three large ornaments near one side; deliberate asymmetry helps
    // reduce identical repeated geometry in the main overview.
    const ornamentalZ=z+(row%2===0?-1.11:1.11);
    for(let n=0;n<3;n++){
      const decorative=ball(east,x-.165,1.77+n*.34,ornamentalZ,
        .105+(n===1?.028:0),
        n===1?CREAM:n===0?GOLD:0xc86270,1);
      decorative.scale.x=.60;decorative.castShadow=false;
    }
    // One warm inset sconce per bay: emissive mesh, not another actual
    // scene light per workstation (which would be expensive on mobile).
    for(const side of [-1,1]){
      const lamp=softBlock(east,x-.152,3.15,z+side*1.40,
        .035,.28,.13,glowMaterial(mat,theme.light,0xa96b33),.035,false);
      lamp.castShadow=false;
    }
  }

  // Large north-window bronze columns and a muted green wall plinth.
  // These are fixed to the NORTH cutaway group, not freestanding posts.
  const north=viewWalls.north;
  for(let n=0;n<6;n++){
    const xx=-7.76+n*1.75;
    softBlock(north,xx,2.30,front+.008,.16,3.02,.10,
      n%2?0xb6ab9b:0x9e8570,.052,false);
    block(north,xx,3.80,front+.024,.23,.07,.15,CREAM,false);
  }
  softBlock(north,-2.75,.45,front+.035,10.3,.36,.06,
    0x66816f,.055,false);

  // Strong central processional path (a recognizable emerald runner) with
  // broad golden edges. The earlier beige runner remains below as backing.
  const near=front+.46,far=partyStart-.48,L=far-near,cz=(near+far)/2;
  if(L>3){
    block(root,3.67,.048,cz,2.46,.018,L,FOREST,false);
    for(const side of [-1,1]){
      block(root,3.67+side*1.17,.059,cz,.075,.014,L-.10,GOLD,false);
      block(root,3.67+side*.99,.059,cz,.018,.014,L-.22,CREAM,false);
    }
    // Oversized gold compass stars are recognizable in an elevated view.
    for(let zz=near+3.0;zz<far-1.5;zz+=6.8){
      const stripe=block(root,3.67,.064,zz,.085,.018,1.18,
        0xe4c892,false);
      const cross=block(root,3.67,.065,zz,1.18,.018,.085,
        0xe4c892,false);
      stripe.rotation.y=Math.PI/4;cross.rotation.y=Math.PI/4;
      const dot=ball(root,3.67,.083,zz,.085,CREAM);
      dot.scale.y=.10;dot.castShadow=false;
    }
  }
  // This entrance feature is on the east wall, adjacent to the original
  // near-spawn Christmas tree, not standing in the user's path.
  const beaconZ=front+2.30;
  softBlock(east,right-.21,2.20,beaconZ,.14,2.5,1.52,
    WALNUT,.065,false);
  softBlock(east,right-.301,2.20,beaconZ,.052,2.15,1.16,
    FOREST,.052,false);
  for(let n=0;n<8;n++){
    const yy=1.38+n*.22;
    const orb=ball(east,right-.336,yy,
      beaconZ+Math.sin(n*.73)*.37,.09,
      glowMaterial(mat,n%2?0xffeac0:0xffb7a5,0xc27e4a),1);
    orb.castShadow=false;
  }
  return {featureBays:bays,lightingStrategy:"emissive per bay"};
}

// The coworker side of each desk must look genuinely different (not simply
// a fabric recolor), while retaining the original .99m x 3.36m desktop,
// full side partitions, chair, colliders and fixed Santa clue prop.
export function sculptWorkstationSilhouette(group,settings,kit){
  const {seatIndex,chairSide=1,style}=settings;
  const {block,softBlock,ball,mat}=kit;
  const family=seatIndex%4,ink=style.ink,gold=style.accent;
  const rearX=-chairSide*.47;
  // Heavy, recognizable colored top cap and illuminated lower bead.
  // Wide enough to be seen from the high default view.
  softBlock(group,rearX,1.470,0,.107,.086,3.20,
    family===0?0x355e56:family===1?0x91596c:
      family===2?0x5c8291:0x9d775c,.070,false);
  block(group,rearX+chairSide*.014,1.434,0,.018,.022,3.15,
    mat(gold,{emissive:0x624624}),false);

  // The personal backboard has visibly different heights/edges.
  const silhouettes=[
    {height:.40,width:.79,z:-.93},
    {height:.61,width:.72,z:-1.00},
    {height:.45,width:.96,z:-.95},
    {height:.66,width:.86,z:-.98}
  ];
  const sh=silhouettes[family];
  softBlock(group,rearX+chairSide*.039,1.69,-.98,.071,sh.height,
    sh.width,ink,.065,false);
  block(group,rearX+chairSide*.087,1.69,-.98,.016,
    sh.height-.09,sh.width-.10,mat(family===2?0x386778:0xf2dcc1),false);
  // A distinctive central graphic in every raised screen.
  if(family===0){
    for(let i=0;i<4;i++)
      block(group,rearX+chairSide*.098,1.58+i*.13,-1.24+i*.17,
        .014,.041,.13,0xd2e9c8,false);
  }else if(family===1){
    for(const zz of [-1.19,-.98,-.77]){
      const dot=ball(group,rearX+chairSide*.111,1.67,zz,
        .085,mat(0xeccf9c,{roughness:.45}),1);
      dot.scale.x=.32;dot.castShadow=false;
    }
  }else if(family===2){
    for(let i=0;i<5;i++)
      block(group,rearX+chairSide*.109,1.53+i*.066,
        -1.26+i*.14,.020,.020,.17,0xa9cdd6,false);
  }else{
    for(let i=0;i<3;i++)
      softBlock(group,rearX+chairSide*.109,1.56+i*.14,-.98,
        .021,.065,.54,i%2?0xffe6bc:0xd6a58c,.04,false);
  }

  // Sculpted workstation edge architecture — these small vertical
  // column-like profiles make silhouette differences apparent.
  for(const sign of [-1,1]){
    const z=sign*1.645;
    softBlock(group,-chairSide*.464,1.12,z,.16,.67,.12,
      family%2?0xc5a48c:0xa8bbae,.060,false);
    block(group,-chairSide*.455,1.465,z,.19,.075,.17,gold,false);
  }
  // Large accent penant on the partition's OUTER face, behind the monitor.
  // Keep the actual physical clue prop at z=+1.29 completely clear.
  const accentZ=-.25;
  softBlock(group,-chairSide*.510,1.14,accentZ,.044,.38,.55,
    family===1?0xbb6575:family===2?0x6b9aab:
      family===3?0xa47f63:0x4d9674,.055,false);
  // Desk identity uses geometry, NOT labels on the gameplay HUD.
  return family;
}

// Deliberately substantial holiday presentation architecture located on
// the ALREADY COLLIDABLE podium and back wall. The admin stage (its own 3D
// scene) is separate; this decorative installation never controls reveals.
export function sculptCelebrationStage(party,config,kit){
  const {twinkle}=config;
  const {block,softBlock,ball,mat}=kit;
  const archGold=mat(0xf1ce88,{metalness:.35,roughness:.35});
  const deepWine=mat(0x7f2747,{roughness:.94});
  const mint=mat(0x2e7661,{roughness:.80});
  // A large gold stage portal with three-layer fascia.
  for(const x of [-6.41,-.06]){
    softBlock(party,x,2.43,5.50,.29,3.44,.26,archGold,.11,false);
    softBlock(party,x,2.40,5.30,.15,3.10,.12,deepWine,.06,false);
    for(let y=1.06;y<3.83;y+=.45){
      const orb=ball(party,x,y,5.26,.085,
        glowMaterial(mat,0xffdf9c,0xc58338),1);
      orb.castShadow=false;tick(twinkle,orb);
    }
  }
  softBlock(party,-3.23,4.10,5.44,6.98,.37,.29,
    archGold,.13,false);
  softBlock(party,-3.23,4.05,5.30,6.51,.20,.13,
    deepWine,.07,false);
  for(let n=0;n<17;n++){
    const x=-6.24+n*.375;
    const lit=ball(party,x,4.02,5.205,.091,
      glowMaterial(mat,n%3?0xffe9b6:0xffbca4,n%3?0xc68a39:0xb45e49),1);
    lit.castShadow=false;tick(twinkle,lit);
  }
  // Rich flowing-ish voxel curtains, framing rather than covering the avatar.
  for(const side of [-1,1]){
    const x=side===-1?-5.83:-.63;
    for(let fold=0;fold<5;fold++){
      const xx=x+fold*.18,yy=2.50-fold*.075;
      softBlock(party,xx,yy,5.35,.17,2.59-fold*.08,.15,
        fold%2?0x88324b:0xb14a62,.08,false);
    }
    block(party,x+.33,2.25,5.21,.58,.12,.12,
      mat(0xf0c983,{metalness:.25}),false);
  }
  // Deep green stepped presentation trims give a visibly bigger stage.
  softBlock(party,-3.23,.78,3.94,5.96,.14,.18,
    mint,.072,false);
  block(party,-3.23,.84,3.92,5.87,.047,.09,
    0xebcd90,false);
  // Big inset alcoves and oversized decorative gold medallions on the
  // outer celebration walls, kept well clear of the central arcade portal.
  for(const x of [-6.40,6.20]){
    softBlock(party,x,2.35,6.77,1.66,2.95,.13,
      0x765d55,.13,false);
    softBlock(party,x,2.38,6.68,1.46,2.75,.08,
      FOREST,.10,false);
    softBlock(party,x,2.40,6.57,1.27,2.38,.05,
      0x466f5c,.09,false);
    for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10;
      const lamp=ball(party,x+Math.sin(a)*.49,
        2.43+Math.cos(a)*.78,6.50,.12,
        i%2?0xffd68c:0xf3aca1,1);
      lamp.castShadow=false;
    }
    const jewel=ball(party,x,2.47,6.46,.33,
      mat(0xffdc98,{emissive:0xb7863f,roughness:.27}),1);
    jewel.scale.set(1.04,1.20,.27);jewel.castShadow=false;
  }
  // The large Christmas tree already has a beautiful silhouette; support it
  // with a prominent readable floor medallion and red/green nested geometry.
  for(let n=0;n<20;n++){
    const t=n*Math.PI*2/20;
    const x=5.60+Math.cos(t)*2.05,z=2.80+Math.sin(t)*2.05;
    const flake=ball(party,x,.079,z,.072,
      n%2?0xeac37d:0xf8ecd1,1);
    flake.scale.y=.11;flake.castShadow=false;
  }
  // A broad lit crown at the rear of the tree brings the festive display
  // into the wide camera without adding real point lights.
  for(let i=0;i<6;i++){
    const t=i/5,xx=3.01+t*3.40;
    const lamp=ball(party,xx,3.90+Math.sin(t*Math.PI)*.17,
      6.35,.14,glowMaterial(mat,i%2?0xffd88c:0xffbba5,0xd19c5e),1);
    lamp.castShadow=false;tick(twinkle,lamp);
  }
  return {stagePortal:true};
}
