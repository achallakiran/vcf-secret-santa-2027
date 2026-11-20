import * as THREE from "three";

/**
 * Authored hybrid-voxel character sculpture, shared by the game and avatar studio.
 * Faces are designed for friendly Indian office adults: recognisable at both
 * portrait and over-the-shoulder gameplay distances. No downloaded models.
 */
function tune(hex,amount){
  const c=new THREE.Color(hex);
  c.offsetHSL(0,0,amount);
  return c;
}
export function sculptHead(head,p,kit){
  const {part,orb,mat}=kit;
  const female=p.gender==="female";
  const skin=mat(p.skinHex),hair=mat(p.hairHex),dark=mat(0x28252c);
  const eyelid=mat(0x47312b),white=mat(0xfff6ec),iris=mat(0x523a2e);
  const blush=mat(tune(p.skinHex,.085)),shadow=mat(tune(p.skinHex,-.08));
  const mouth=mat(female?0x9d4c56:0x81494a);
  const gold=mat(0xe6ba72,.35,.16);
  // Soft square head, narrower rounded chin and prominent little cheeks.
  part(head,.89,.77,.70,skin,0,.32,0,.17);
  part(head,.70,.23,.69,skin,0,.072,.012,.12);
  for(const side of [-1,1]){
    const ear=part(head,.14,.23,.18,skin,side*.45,.27,-.035,.075);
    part(head,.04,.11,.045,shadow,side*.505,.27,.06,.018);
    orb(head,.106,blush,side*.32,.222,.339,.83,.53,.21);
    if(female){
      orb(head,.049,gold,side*.465,.132,.035,.72,1.15,.55);
      orb(head,.022,white,side*.477,.129,.057,.56,.8,.32);
    }
  }
  // Two large expressive eyes. Wide sclera + dark iris + dual catchlights.
  // The upper eyelids sit in front of the white rather than being painted dots.
  for(const side of [-1,1]){
    const x=side*.190;
    orb(head,.123,white,x,.330,.354,1.02,.90,.35);
    orb(head,.092,iris,x+.014,.325,.389,.74,.94,.31);
    orb(head,.068,dark,x+.017,.320,.415,.88,1.03,.48);
    orb(head,.028,white,x-.021,.360,.445,.70,.89,.47);
    orb(head,.014,white,x+.047,.308,.442,.60,.64,.40);
    const upper=part(head,.229,.027,.027,eyelid,x,.430,.391,.012);
    upper.rotation.z=side*-.12;
    const eyebrow=part(head,.22,.045,.034,mat(p.hairHex),x,.501,.387,.018);
    eyebrow.rotation.z=-side*.13;
    if(female){
      const lash=part(head,.075,.027,.025,eyelid,x+side*.110,.412,.410,.009);
      lash.rotation.z=side*.28;
    }
  }
  // Faceted, short bridge; subtle highlights on nose and lower lip.
  orb(head,.062,skin,0,.228,.401,.72,.82,.75);
  orb(head,.033,blush,0,.214,.429,.71,.54,.42);
  const smilePoints=[
    new THREE.Vector3(-.112,.153,.384),
    new THREE.Vector3(-.062,.124,.407),
    new THREE.Vector3(0,.116,.417),
    new THREE.Vector3(.062,.124,.407),
    new THREE.Vector3(.112,.153,.384)
  ];
  const curve=new THREE.CatmullRomCurve3(smilePoints);
  const line=new THREE.Mesh(
    new THREE.TubeGeometry(curve,12,.012,4,false),mouth
  );
  line.castShadow=false;head.add(line);
  const lip=part(head,.145,.023,.018,mat(0xe8aaa0),0,.094,.403,.009);
  lip.castShadow=false;
  // More appealing asymmetry in the male face, without mandatory facial hair.
  if(!female && (p.hairstyle===1 || p.hairstyle===3)){
    const beard=mat(tune(p.hairHex,.035));
    for(const side of [-1,1]){
      part(head,.090,.24,.055,beard,side*.345,.055,.271,.037);
      part(head,.20,.065,.045,beard,side*.140,-.065,.341,.027);
    }
    const stacheL=part(head,.105,.046,.042,beard,-.065,.169,.402,.025);
    const stacheR=part(head,.105,.046,.042,beard,.065,.169,.402,.025);
    stacheL.rotation.z=.15;stacheR.rotation.z=-.15;
  }
  // Dense coiffure built from layered bevelled voxel locks, not a slab cap.
  part(head,.94,.23,.78,hair,0,.714,-.025,.11);
  part(head,.84,.15,.72,mat(tune(p.hairHex,.06)),0,.796,-.016,.06);
  for(const side of [-1,1]){
    part(head,.16,.31,.49,hair,side*.411,.560,-.055,.060);
    for(let k=0;k<3;k++){
      const lock=part(head,.155,.195,.17,k%2?hair:mat(tune(p.hairHex,.07)),
        side*(.322-k*.052),.695-k*.055,.310,.043);
      lock.rotation.z=side*(.13+k*.08);
    }
  }
  for(let i=0;i<6;i++){
    const x=-.354+i*.142;
    const fringe=part(head,.153,.155+(i%3)*.045,.16,
      i%3===0?mat(tune(p.hairHex,.08)):hair,
      x,.688-(i%2)*.037,.350,.044);
    fringe.rotation.z=(i-2.5)*-.08;
  }
  const hairBack=mat(tune(p.hairHex,-.025));
  // Every hairstyle has its own clearly readable side/back silhouette.
  if(p.hairstyle===0){
    part(head,.65,.25,.23,hairBack,0,.345,-.366,.10);
    if(female)for(const side of [-1,1]){
      part(head,.18,.35,.27,hair,side*.40,.285,-.180,.069);
      part(head,.16,.10,.24,mat(tune(p.hairHex,.08)),side*.396,.116,-.15,.047);
    }
  }else if(p.hairstyle===1){
    part(head,.80,.47,.25,hairBack,0,.265,-.38,.095);
    for(const side of [-1,1]){
      const section=part(head,.18,.47,.29,hair,side*.396,.245,-.21,.075);
      section.rotation.z=side*.075;
      part(head,.15,.21,.16,mat(tune(p.hairHex,.065)),side*.402,.02,-.25,.057);
    }
  }else if(p.hairstyle===2){
    part(head,.86,.80,.29,hairBack,0,.04,-.385,.11);
    for(const side of [-1,1]){
      for(let j=0;j<4;j++){
        const x=side*(.25+j*.052);
        const strand=part(head,.139,.66+j*.035,.23,j%2?hair:mat(tune(p.hairHex,.07)),
          x,.092-j*.034,-.215-j*.025,.056);
        strand.rotation.z=side*(j*.032);
      }
    }
    for(let i=0;i<5;i++)part(head,.15,.16,.13,hair,-.31+i*.155,-.340,-.40,.04);
  }else{
    part(head,.82,.34,.25,hairBack,0,.341,-.362,.11);
    const band=part(head,.25,.14,.16,mat(0xd9a579),.30,.325,-.43,.048);
    band.rotation.z=.25;
    for(let j=0;j<4;j++){
      const t=part(head,.185,.28,.22,j%2?hair:mat(tune(p.hairHex,.058)),
        .36+(j%2)*.055,.18-j*.17,-.49,.068);
      t.rotation.z=.14+j*.045;
    }
  }
  if(p.glasses){
    const frame=mat(p.hairHex===0x171921?0xa18a69:0x403e40,.36,.28);
    const lens=new THREE.MeshPhysicalMaterial({
      color:0xc2dce5,metalness:0,roughness:.12,
      transparent:true,opacity:.11,depthWrite:false
    });
    for(const x of [-.19,.19]){
      // Actual hollow angular rims with readable temples and bridge.
      for(const y of [.41,.248])part(head,.235,.021,.033,frame,x,y,.469,.008);
      for(const dx of [-.118,.118])part(head,.027,.157,.032,frame,x+dx,.329,.467,.010);
      part(head,.20,.12,.008,lens,x,.329,.464,.020);
    }
    part(head,.15,.024,.04,frame,0,.351,.471,.012);
    for(const side of [-1,1])part(head,.115,.025,.032,frame,side*.43,.365,.344,.01);
  }
  return head;
}

/** Distinct soles, uppers and straps; positioned on the existing leg pivots. */
export function sculptFoot(pivot,p,kit){
  const {part,mat,orb}=kit;
  const salwar=p.outfit==="salwar",formal=p.outfit==="suit",
        dress=p.outfit==="dress",sneaker=!salwar&&!formal&&!dress;
  const sole=mat(sneaker?0xf1eee6:formal?0x343238:0x9b5746);
  const upper=mat(salwar?0xa55f4b:formal?0x493a33:dress?0xa26266:0xd9d8ce);
  const trim=mat(salwar?0xdfae78:formal?0x9c8064:0xffffff);
  // Foot faces the same +Z as the character.
  part(pivot,.296,.125,.44,upper,0,-.566,.107,.056);
  part(pivot,.319,.09,.50,sole,0,-.650,.121,.038);
  part(pivot,.305,.055,.17,trim,0,-.576,.339,.036);
  if(sneaker){
    for(let j=0;j<3;j++)part(pivot,.155,.014,.025,trim,0,-.494,.058+j*.085,.007);
    part(pivot,.305,.025,.032,mat(0x748694),0,-.629,-.098,.008);
  }else if(formal){
    part(pivot,.292,.033,.20,mat(0x665046),0,-.514,.205,.018);
  }else{
    part(pivot,.31,.035,.09,trim,0,-.525,.012,.014);
    for(const x of [-.105,.105])orb(pivot,.016,0xdfbd7f,x,-.534,.31);
  }
}
