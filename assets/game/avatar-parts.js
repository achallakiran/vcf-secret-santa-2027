import * as THREE from "three";

/**
 * Art Hero v3 — sculpted storybook adults.
 *
 * Distinguishing features taken from the approved visual direction:
 * - a large but angular, stepped voxel head rather than a round toy sphere
 * - expressive square eye patches (high-contrast at in-game scale)
 * - chunky independently layered haircut silhouettes
 * - real depth to ears, cheeks, eyebrows and smile
 * - traditional/modern accessory choices without changing saved profile keys
 *
 * Every character, near and far, is generated with this same geometry.
 */
const shade=(hex,l)=>{
  const c=new THREE.Color(hex);c.offsetHSL(0,0,l);return c;
};
export function sculptHead(head,p,kit){
  const {part,orb,mat}=kit;
  const female=p.gender==="female",style=p.hairstyle%4;
  const skin=mat(p.skinHex,.76),skinLight=mat(shade(p.skinHex,.045),.78);
  const skinShade=mat(shade(p.skinHex,-.055),.82);
  const hair=mat(p.hairHex,.8),high=mat(shade(p.hairHex,.10),.74);
  const middle=mat(shade(p.hairHex,.035),.79),deep=mat(shade(p.hairHex,-.07),.85);
  const ink=mat(0x26202a,.68),white=mat(0xfff8ef,.42);
  const iris=mat(0x543b31,.58),brow=mat(shade(p.hairHex,-.018));
  const blush=mat(shade(p.skinHex,.10),.85),lips=mat(female?0xa65a60:0x965a4b,.7);
  const jewelry=mat(0xe5b56e,.31,.22);
  // A distinctly different character SILHOUETTE. Larger forehead and cheeks,
  // subtly narrowed jaw, plus bevels; not repeated flat boxes for a head.
  part(head,1.03,.76,.73,skin,0,.38,0,.18);
  part(head,.87,.29,.715,skin,0,.092,.016,.15);
  part(head,.78,.12,.68,skinLight,0,.017,.019,.09);
  for(const side of [-1,1]){
    part(head,.17,.25,.18,skin,side*.50,.286,-.055,.065);
    part(head,.052,.12,.063,skinShade,side*.572,.262,.018,.019);
    // Physically raised cheek caps, visible in three-quarter view.
    part(head,.225,.135,.066,skinLight,side*.337,.215,.359,.068);
    const cheek=orb(head,.070,blush,side*.335,.223,.404,.98,.50,.25);
    cheek.castShadow=false;
    if(female){
      const e=orb(head,.057,jewelry,side*.53,.140,.041,.64,.96,.53);
      e.castShadow=false;
      orb(head,.018,white,side*.542,.166,.076,.65,.7,.7).castShadow=false;
    }
  }
  // Large SQUARE eyes: dark lids, warm-white sclera, brown iris,
  // deep pupil and two sparkling rectangular reflections.
  for(const side of [-1,1]){
    const x=side*.225;
    part(head,.246,.190,.027,mat(0x55403a,.8),x,.390,.379,.051);
    part(head,.226,.171,.028,white,x,.383,.403,.043);
    part(head,.142,.154,.027,iris,x+.014,.381,.425,.044);
    part(head,.107,.151,.027,ink,x+.015,.378,.445,.029);
    const catchlight=part(head,.047,.051,.015,white,x-.026,.420,.465,.017);
    catchlight.castShadow=false;
    const glimmer=part(head,.022,.025,.013,white,x+.063,.347,.465,.009);
    glimmer.castShadow=false;
    const lid=part(head,.260,.038,.028,brow,x,.491,.398,.018);
    lid.rotation.z=side*-.078;
    const eyebrow=part(head,.235,.062,.06,brow,x,.558,.382,.023);
    eyebrow.rotation.z=-side*.135;
    if(female){
      const lash=part(head,.070,.028,.029,brow,x+side*.137,.467,.409,.008);
      lash.rotation.z=side*.33;
    }
  }
  // Little sculpted bridge and a genuinely curved smile.
  part(head,.11,.14,.09,skinLight,0,.277,.395,.047);
  orb(head,.050,skinLight,0,.246,.452,.7,.57,.48).castShadow=false;
  const smile=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.128,.167,.414),new THREE.Vector3(-.074,.130,.435),
    new THREE.Vector3(0,.119,.445),new THREE.Vector3(.074,.130,.435),
    new THREE.Vector3(.128,.167,.414)
  ]);
  const lipsGeometry=new THREE.TubeGeometry(smile,16,.015,5,false);
  const mouth=new THREE.Mesh(lipsGeometry,lips);mouth.castShadow=false;head.add(mouth);
  part(head,.14,.023,.019,mat(0xf5b0a0),0,.103,.436,.008).castShadow=false;
  for(const side of [-1,1])
    orb(head,.017,skinShade,side*.137,.171,.412,.75,.6,.6).castShadow=false;
  // Male styles differ in silhouette and beard. Beard is optional and tied
  // to the selected hair style, not forced onto every male employee.
  if(!female&&(style===1||style===3)){
    for(const side of [-1,1]){
      part(head,.11,.21,.074,deep,side*.39,.090,.266,.037);
      part(head,.22,.085,.065,deep,side*.20,-.043,.333,.039);
    }
    const left=part(head,.135,.056,.050,hair,-.080,.210,.419,.022);
    const right=part(head,.135,.056,.050,hair,.080,.210,.419,.022);
    left.rotation.z=-.12;right.rotation.z=.12;
    part(head,.26,.055,.070,deep,0,-.07,.309,.026);
  }
  // Hair is now constructed as a stepped crown with overlapping voxel
  // locks and *different length/volume silhouettes* for all four styles.
  const crown=part(head,1.12,.29,.82,deep,0,.779,-.042,.095);
  part(head,1.045,.17,.74,hair,0,.907,-.025,.068);
  for(const side of [-1,1]){
    part(head,.23,.33,.69,hair,side*.480,.640,-.012,.070);
    for(let j=0;j<3;j++){
      const lock=part(head,.192,.19+j*.026,.24,j%2?middle:high,
        side*(.39-j*.052),.778-j*.066,.320-j*.026,.043);
      lock.rotation.z=side*(.06+j*.055);
    }
  }
  const fringeCount=style===0?6:style===3?4:5;
  for(let j=0;j<fringeCount;j++){
    const x=(j-(fringeCount-1)/2)*(.79/fringeCount);
    const offset=(j*3+style)%3;
    const height=.17+offset*.035;
    const sweep=style===3?-.065:style===1?.064:.018;
    const lock=part(head,.195,height,.205,j%3===0?high:j%3===1?middle:hair,
      x+sweep,.777-offset*.022,.365,.038);
    lock.rotation.z=(j-(fringeCount-1)/2)*-.073;
  }
  if(style===0){
    // Smart short layered hair / rounded female bob.
    part(head,.82,.29,.24,deep,0,.460,-.378,.092);
    for(const side of [-1,1]){
      const end=female?.23:.14;
      part(head,.205,end,.32,hair,side*.468,.398,-.200,.067);
      part(head,.17,.13,.24,high,side*.45,.345,-.125,.042);
    }
  }else if(style===1){
    // Shoulder-length heavy curls, not a flat solid curtain.
    part(head,.86,.61,.25,deep,0,.310,-.39,.09);
    for(const side of [-1,1])for(let j=0;j<3;j++){
      const curl=part(head,.175,.32+j*.055,.30,j%2?middle:hair,
        side*(.40+j*.042),.398-j*.13,-.214-j*.055,.071);
      curl.rotation.z=side*(.02+j*.042);
      orb(head,.11,j%2?hair:high,side*(.417+j*.036),.210-j*.125,
        -.213-j*.05,.8,1,.79);
    }
  }else if(style===2){
    // Dramatic full-volume LONG hair reaching down toward upper back.
    part(head,.93,.85,.29,deep,0,.127,-.413,.083);
    for(const side of [-1,1]){
      for(let j=0;j<4;j++){
        const len=.74+j*.067;
        const strand=part(head,.182,len,.255,j%2?middle:hair,
          side*(.32+j*.067),.276-j*.048,-.237-j*.052,.061);
        strand.rotation.z=side*(j-1.5)*.039;
        part(head,.146,.16,.21,j%2?high:hair,
          side*(.31+j*.067),-.085-j*.055,-.255-j*.05,.046);
      }
    }
    for(let j=0;j<6;j++)
      part(head,.16,.15,.17,j%2?high:hair,(j-2.5)*.15,-.38,-.46,.049);
  }else{
    // Ponytail with a distinct swept-back crown and cascading locks.
    part(head,.86,.42,.29,deep,0,.48,-.385,.085);
    part(head,.36,.24,.33,middle,.315,.467,-.495,.083);
    part(head,.28,.12,.29,jewelry,.365,.406,-.51,.045);
    for(let j=0;j<5;j++){
      const tail=part(head,.242,.235,.30,j%2?hair:middle,
        .38+Math.sin(j*.8)*.065,.322-j*.19,-.52-j*.019,.085);
      tail.rotation.z=(j-1.5)*.076;
    }
  }
  if(p.glasses){
    const frame=mat(0x644c40,.39,.17);
    const lens=new THREE.MeshPhysicalMaterial({
      color:0xd5eef3,roughness:.12,metalness:0,transparent:true,
      opacity:.10,depthWrite:false
    });
    for(const x of [-.225,.225]){
      for(const y of [.51,.325])part(head,.269,.027,.046,frame,x,y,.484,.017);
      for(const xx of [-.134,.134])part(head,.030,.19,.043,frame,x+xx,.418,.481,.013);
      part(head,.22,.14,.007,lens,x,.415,.481,.029).castShadow=false;
    }
    part(head,.18,.031,.05,frame,0,.428,.491,.013);
    for(const side of [-1,1])
      part(head,.13,.032,.035,frame,side*.49,.445,.356,.015);
  }
  return head;
}

/** Detailed sculpted footwear kept on the original animated leg pivots. */
export function sculptFoot(pivot,p,kit){
  const {part,orb,mat}=kit;
  const ethnic=p.outfit==="salwar",formal=p.outfit==="suit";
  const sneaker=!ethnic&&!formal&&p.outfit!=="dress";
  const sole=mat(sneaker?0xf4f0e9:formal?0x343033:0x9e624b,.69);
  const upper=mat(ethnic?0xb26f56:formal?0x4c3b36:p.outfit==="dress"?0xb36e6a:0xe1e0d8,.73);
  const trim=mat(ethnic?0xe9c38b:formal?0xb6a084:0xf8f8f0,.52);
  // Chunky shaped shoe, visibly squared toe and proper little outsole.
  part(pivot,.305,.147,.45,upper,0,-.552,.132,.082);
  part(pivot,.341,.089,.51,sole,0,-.645,.148,.047);
  part(pivot,.34,.065,.22,upper,0,-.542,.311,.048);
  part(pivot,.338,.025,.52,trim,0,-.675,.147,.016);
  if(sneaker){
    for(let j=0;j<3;j++)
      part(pivot,.158,.018,.026,trim,0,-.488,.065+j*.072,.009);
    part(pivot,.329,.034,.035,mat(0x8796a1),0,-.634,-.098,.011);
  }else if(formal){
    part(pivot,.295,.038,.19,trim,0,-.523,.20,.020);
  }else{
    part(pivot,.32,.045,.10,trim,0,-.524,.014,.020);
    for(const xx of [-.108,.108])
      orb(pivot,.020,0xe6bd81,xx,-.538,.313,.85,.73,.6);
  }
}
