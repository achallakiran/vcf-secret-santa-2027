import * as THREE from "three";

/**
 * Contemporary Indian wardrobe detailing for the existing humanoid game rig.
 * Decorations are real shallow sculpted meshes (not painted colors), so every
 * outfit remains legible in the avatar studio and at office game distance.
 */
const GOLD=0xd6b477,IVORY=0xf4e4cd,PEARL=0xf7ebdd,INK=0x263a4a;
export function sculptWardrobe(hips,p,kit){
  const {part,orb,mat}=kit;
  const w=p.build||1,top=mat(p.colorHex),highlight=mat(0xf1d9ac,.53,.12);
  const bone=mat(IVORY),ink=mat(INK),gold=mat(GOLD,.45,.20);
  const trim=mat(p.outfit==="salwar"?0xe2ad78:0xf1d9be);
  const pearl=mat(PEARL,.38,.06),skin=mat(p.skinHex);
  const ageFriendly=mat(0xd1c8b4);
  // A tiny pin and employee pass: plausible office accessories, deliberately
  // no flags, iconic monuments, or unrequested cultural decorations.
  const badge=p.outfit!=="dress";
  if(badge){
    const strap=part(hips,.026,.49,.023,mat(0x4f8d80),-.07,.49,.273,.01);
    strap.rotation.z=-.18;
    part(hips,.15,.18,.036,pearl,-.13,.20,.285,.021);
    part(hips,.115,.035,.037,mat(0x649e8f),-.13,.259,.311,.011);
    part(hips,.095,.015,.018,ink,-.13,.195,.309,.008);
  }
  const shoulderDetail=(c)=>{for(const side of [-1,1]){
    part(hips,.095,.04,.038,c,side*.268,.678,.226,.014);
  }};
  if(p.outfit==="salwar"){
    const fabricEdge=mat(p.colorHex,.91,0);
    // 3D over-tunic with split side seams and a wide embroidered hem.
    for(const side of [-1,1]){
      const flap=part(hips,.13,.35,.55,fabricEdge,side*.319,-.23,-.002,.046);
      flap.rotation.z=side*.045;
      part(hips,.057,.43,.027,trim,side*.347,-.15,.286,.009);
      for(let row=0;row<4;row++){
        const y=.45-row*.145;
        orb(hips,.013,GOLD,side*.235,y,.288,1,.82,.46);
      }
    }
    part(hips,.74*w,.035,.60,gold,0,-.361,0,.012);
    part(hips,.72*w,.026,.61,highlight,0,-.412,0,.011);
    // V-shaped embroidered neck edge and descending decorative placket.
    for(const side of [-1,1]){
      const collar=part(hips,.19,.034,.031,gold,side*.105,.658,.279,.009);
      collar.rotation.z=side*.34;
    }
    for(let i=0;i<5;i++){
      orb(hips,.018,gold,0,.49-i*.105,.303,.82,1.02,.54);
      if(i%2===0)part(hips,.14,.02,.023,trim,0,.49-i*.105,.291,.007);
    }
    // Draped dupatta, with folds and a decorative border.
    const drape=part(hips,.23,.87,.12,mat(0xf5cfad,.82),-.31,.304,.306,.052);
    drape.rotation.z=-.095;
    for(let j=0;j<4;j++){
      const fold=part(hips,.027,.73,.028,mat(j%2?0xe3ab7d:0xffe7c8,.80),
        -.405+j*.055,.30,.377,.009);
      fold.rotation.z=-.097;
    }
    part(hips,.255,.053,.029,gold,-.351,-.169,.374,.018);
    shoulderDetail(gold);
  }else if(p.outfit==="suit"){
    // Tailored blazer: proper overlapping panels, angled lapels, pockets.
    const blazer=mat(0x31445d),blazerLight=mat(0x465c70);
    for(const side of [-1,1]){
      const panel=part(hips,.34,.57,.10,blazer,side*.169,.341,.234,.065);
      panel.rotation.z=-side*.035;
      const lapel=part(hips,.25,.41,.075,blazerLight,side*.158,.525,.307,.039);
      lapel.rotation.z=side*.28;
      part(hips,.19,.028,.028,gold,side*.238,.185,.301,.009);
      part(hips,.14,.029,.024,pearl,side*.218,.30,.315,.009);
    }
    // Shirt collar and tie stay centered between blazer panels.
    for(const side of [-1,1]){
      const collar=part(hips,.19,.15,.056,pearl,side*.105,.682,.293,.019);
      collar.rotation.z=side*.37;
    }
    part(hips,.085,.33,.04,mat(0x934955),0,.485,.344,.017);
    part(hips,.14,.08,.054,mat(0xb15f61),0,.333,.353,.022);
    for(const y of [.17,.295])orb(hips,.021,gold,.095,y,.353);
  }else if(p.outfit==="shirt"){
    // Crisp office shirt: placket, spread collar, French-seam sleeves.
    const border=mat(0xf2e3d0);
    for(const side of [-1,1]){
      const collar=part(hips,.19,.13,.061,border,side*.103,.708,.245,.023);
      collar.rotation.z=-side*.28;
      part(hips,.044,.17,.021,border,side*.32,.45,.222,.009);
      part(hips,.18,.025,.021,border,side*.22,.112,.233,.009);
    }
    part(hips,.031,.52,.03,border,0,.408,.238,.011);
    for(let j=0;j<5;j++)orb(hips,.016,0xd5bb9b,0,.584-j*.103,.266);
    // Chest pocket and a little pen at one edge.
    part(hips,.18,.19,.035,mat(p.colorHex),.193,.436,.255,.018);
    part(hips,.16,.024,.024,border,.193,.522,.273,.008);
    part(hips,.022,.15,.025,mat(0x5b8f93),.255,.476,.273,.008);
  }else if(p.outfit==="tshirt"){
    // Made-to-wear knit: ribbing at neck, short-sleeve cuff, motif.
    const seam=mat(0xece1d5);
    part(hips,.35,.070,.05,seam,0,.73,.221,.031);
    for(const side of [-1,1])part(hips,.19,.025,.030,seam,side*.385,.493,.233,.008);
    part(hips,.27,.19,.036,mat(0xf3dfac),0,.421,.251,.075);
    const emblem=part(hips,.12,.08,.032,mat(0x718a84),0,.425,.276,.016);
    emblem.rotation.z=-.12;
    part(hips,.53,.032,.027,seam,0,.034,.224,.012);
  }else if(p.outfit==="sweater"){
    // A knitted winter sweater with real surface ribs and winter motif.
    for(let i=0;i<8;i++){
      const y=.647-i*.071;
      part(hips,.62*w,.022,.026,mat(i%3===0?0xf4dabb:0xe4bc91),0,y,.246,.008);
    }
    for(const side of [-1,1])for(let j=0;j<5;j++){
      const mark=part(hips,.05,.034,.025,mat(j%2?0xf5e7d7:0xd77878),
        side*(.07+j*.043),.445,.275,.012);
      mark.rotation.z=side*.18;
    }
    const snow=mat(0xffffff);
    for(const x of [-.19,0,.19])for(const y of [.30,.40,.50]){
      orb(hips,.022,snow,x,y,.267,.8,.72,.40);
    }
    part(hips,.54,.083,.037,mat(0xf1ded2),0,.045,.240,.025);
    shoulderDetail(snow);
  }else if(p.outfit==="dress"){
    // A-line dress with constructed waist/bodice and draped skirt pleats.
    const edge=mat(p.colorHex,.68),lining=mat(0xf3d7bf);
    part(hips,.70,.09,.56,lining,0,.183,.037,.027);
    const skirt=part(hips,.85*w,.54,.55,edge,0,-.13,0,.13);
    for(const side of [-1,1]){
      part(hips,.045,.47,.033,lining,side*.374,-.160,.279,.011);
      const collar=part(hips,.17,.038,.025,lining,side*.105,.708,.251,.013);
      collar.rotation.z=side*.23;
    }
    for(let j=0;j<5;j++){
      const x=-.34+j*.17;
      part(hips,.022,.34,.028,j%2?lining:gold,x,-.20,.300,.009);
    }
    part(hips,.63,.045,.034,gold,0,-.395,.275,.011);
  }
}
