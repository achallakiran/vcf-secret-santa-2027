import * as THREE from "three";
import {clothMaterial} from "./visual-materials.js?v=visual-atelier-v3";

/**
 * Contemporary Indian wardrobe detailing for the existing humanoid game rig.
 * Decorations are real shallow sculpted meshes (not painted colors), so every
 * outfit remains legible in the avatar studio and at office game distance.
 */
const GOLD=0xd6b477,IVORY=0xf4e4cd,PEARL=0xf7ebdd,INK=0x263a4a;
export function sculptWardrobe(hips,p,kit){
  const {part,orb,mat}=kit;
  const w=p.build||1,top=clothMaterial(p.outfit,p.colorHex),highlight=mat(0xf1d9ac,.53,.12);
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
  }else if(["jacket","bomber","blazer"].includes(p.outfit)){
    const bomber=p.outfit==="bomber",blazer=p.outfit==="blazer";
    // Three visibly DIFFERENT coat silhouettes, not shirt decorations.
    const jacketTrim=mat(bomber?0x313947:blazer?0xe8d6c0:0xc0d5df,.72);
    if(bomber){
      part(hips,.81,.31,.54,top,0,.50,-.004,.123);
      part(hips,.79,.12,.56,jacketTrim,0,.035,.02,.045);
      part(hips,.65,.13,.58,jacketTrim,0,.701,-.04,.056);
    }else if(blazer){
      for(const side of [-1,1]){
        const tail=part(hips,.36,.44,.54,top,side*.18,-.17,-.03,.071);
        tail.rotation.z=-side*.06;
        const openLapel=part(hips,.205,.54,.087,jacketTrim,side*.16,.47,.360,.037);
        openLapel.rotation.z=side*.31;
      }
      part(hips,.72,.055,.52,jacketTrim,0,-.38,-.04,.025);
    }else{
      // Denim jackets are cropped with a rigid, stepped yoke.
      part(hips,.82,.12,.54,top,0,.667,-.022,.038);
      part(hips,.80,.115,.56,jacketTrim,0,.065,-.022,.037);
      for(const side of [-1,1]){
        part(hips,.22,.22,.035,jacketTrim,side*.20,.445,.392,.012);
        part(hips,.19,.022,.047,mat(0xf6e3c4),side*.20,.544,.411,.008);
        for(let j=0;j<3;j++)orb(hips,.018,0xd4b07a,side*.13,.47-j*.16,.410);
      }
    }
    // Raised collars and actual front panels over the contrasting shirt.
    for(const side of [-1,1]){
      const flap=part(hips,.27,blazer?.50:bomber?.42:.48,.076,top,side*.172,.38,.302,.038);
      flap.rotation.z=side*(blazer?.08:.03);
      const lapel=part(hips,.13,blazer?.34:.24,.079,mat(blazer?0xf2e4d5:0xc9d7e2),side*.12,.55,.373,.028);
      lapel.rotation.z=side*(blazer?.31:.16);
      part(hips,.15,.14,.04,mat(bomber?0xe8be7d:0x9dc5d9),side*.225,.24,.367,.013);
      if(p.outfit==="jacket")for(let j=0;j<3;j++)orb(hips,.010,0xbdbdc1,side*.213,.54-j*.11,.373);
    }
    const closure=part(hips,.020,.46,.028,mat(0xdac7a2),0,.38,.386,.010);
    closure.rotation.z=bomber?.03:0;
    if(bomber)part(hips,.73,.065,.060,mat(0x414049),0,.045,.0,.028);
    if(blazer)for(const y of [.22,.32])orb(hips,.022,gold,0,y,.377);
  }else if(p.outfit==="suit"){
    // Tailored blazer: proper overlapping panels, angled lapels, pockets.
    const blazer=top,blazerLight=mat(new THREE.Color(p.colorHex).offsetHSL(0,0,.085));
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

  // Over-the-shoulder gameplay mostly sees the BACK of the character.
  // Different outfits therefore need identifiable back silhouettes and
  // constructed garment geometry—not just colorful front-facing details.
  const backDetail=mat(p.outfit==="suit"?0x52637c:
    p.outfit==="salwar"?0xf3c98f:
    p.outfit==="sweater"?0xffebcf:
    p.outfit==="dress"?0xefc4ad:0xe3c7a6,.79);
  if(p.outfit==="salwar"){
    // A long, layered salwar-kameez back with stepped border, side pleats
    // and flowing draped dupatta. Visible from follow camera.
    const backPanel=part(hips,.78*w,.69,.10,top,0,-.062,-.247,.072);
    part(hips,.80*w,.064,.099,backDetail,0,-.384,-.255,.017);
    for(const xx of [-.29,.29]){
      part(hips,.047,.63,.08,backDetail,xx,-.06,-.31,.025);
      for(let i=0;i<3;i++){
        const y=.28-i*.16;
        part(hips,.087,.033,.042,gold,xx,y,-.348,.016);
      }
    }
    // Dupatta hangs past the waist, with a broad embroidered edge.
    const draped=part(hips,.195,.89,.12,mat(0xf0cfac),-.24,.25,-.34,.063);
    draped.rotation.z=-.13;
    part(hips,.206,.06,.136,gold,-.30,-.13,-.35,.023);
    for(let j=0;j<4;j++)
      part(hips,.022,.77,.027,j%2?gold:backDetail,-.31+j*.045,.20,-.417,.01);
  }else if(["jacket","bomber","blazer"].includes(p.outfit)){
    const bomber=p.outfit==="bomber",blazer=p.outfit==="blazer";
    part(hips,.78*w,bomber?.60:blazer?.78:.57,.15,top,0,
      blazer?.23:.325,-.283,.071);
    // Readable silhouette from behind: bomber balloon hem, denim yoke,
    // and longer tailored blazer vents.
    if(bomber){
      part(hips,.82,.12,.20,mat(0x383e49),0,.045,-.32,.047);
      for(const side of [-1,1])part(hips,.18,.12,.065,mat(0x3e444b),side*.26,.58,-.36,.027);
    }else if(blazer){
      part(hips,.73,.37,.11,top,0,-.20,-.317,.052);
      for(const side of [-1,1]){
        part(hips,.055,.35,.034,mat(0xd9c9bb),side*.22,-.24,-.375,.014);
      }
    }else{
      part(hips,.76,.10,.12,mat(0xb3cbd9),0,.655,-.339,.031);
      for(const side of [-1,1])part(hips,.035,.47,.034,mat(0xc7d5df),
        side*.30,.32,-.357,.013);
    }
    part(hips,.66*w,.09,.107,mat(bomber?0x2d3a4b:blazer?0xcdbeb4:0x8eafbe),0,.052,-.28,.029);
    for(const side of [-1,1]){
      part(hips,.16,.06,.045,mat(0xd0c4b7),side*.25,.628,-.29,.016);
      if(!blazer)part(hips,.09,.18,.05,mat(0xa7bdc8),side*.20,.27,-.33,.023);
    }
  }else if(p.outfit==="suit"){
    // Proper jacket yoke, vents and shoulder pads distinguish suit from shirt.
    part(hips,.70*w,.34,.085,mat(0x40536b),0,.40,-.248,.07);
    part(hips,.12,.60,.04,backDetail,0,.33,-.287,.015);
    for(const side of [-1,1]){
      part(hips,.04,.31,.034,mat(0x35475d),side*.245,.12,-.30,.015);
      part(hips,.18,.07,.055,backDetail,side*.18,.635,-.272,.022);
    }
    part(hips,.72*w,.055,.085,mat(0x25364e),0,.035,-.272,.025);
  }else if(p.outfit==="dress"){
    // A much wider hem than an office shirt: visible A-line silhouette.
    part(hips,.79*w,.37,.085,top,0,-.15,-.29,.085);
    part(hips,.87*w,.077,.10,backDetail,0,-.38,-.295,.028);
    for(const xx of [-.28,0,.28])
      part(hips,.028,.33,.032,backDetail,xx,-.15,-.34,.011);
    part(hips,.57,.065,.09,gold,0,.15,-.255,.025);
  }else if(p.outfit==="sweater"){
    // Knitted back sweater motif, big enough to read at office distance.
    part(hips,.59*w,.055,.038,backDetail,0,.47,-.244,.017);
    part(hips,.63*w,.052,.04,backDetail,0,.24,-.245,.017);
    part(hips,.63*w,.052,.04,backDetail,0,.04,-.245,.017);
    for(let x=-2;x<=2;x++){
      const stripe=part(hips,.06,.24,.041,
        x%2?backDetail:mat(0xbb5865),x*.113,.34,-.271,.022);
      stripe.rotation.z=x*.16;
    }
  }else if(p.outfit==="shirt"){
    // Crisp back shoulder yoke, seam and cuffs.
    part(hips,.66*w,.12,.051,backDetail,0,.61,-.249,.038);
    part(hips,.02,.45,.033,backDetail,0,.39,-.252,.011);
    part(hips,.60*w,.042,.042,backDetail,0,.061,-.248,.016);
  }else if(p.outfit==="tshirt"){
    part(hips,.57*w,.065,.045,backDetail,0,.06,-.238,.024);
    part(hips,.29,.082,.048,backDetail,0,.68,-.237,.027);
    part(hips,.14,.15,.043,mat(0xe1c88b),0,.44,-.253,.045);
  }
}
