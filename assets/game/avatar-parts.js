import * as THREE from "three";
import {facialHairShape} from "./facial-hair.js?v=face-refine-v4";

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
// Reuse eyeglass rim and lens geometry for all participants and option previews.
const eyewearGeometry=new Map();
function frameGeometry(kind,r){
  const key=kind+":"+r;
  if(!eyewearGeometry.has(key))eyewearGeometry.set(key,
    kind==="rim"?new THREE.TorusGeometry(r,.018,5,20):new THREE.CircleGeometry(r,20));
  return eyewearGeometry.get(key);
}
const shade=(hex,l)=>{
  const c=new THREE.Color(hex);c.offsetHSL(0,0,l);return c;
};
export function sculptHead(head,p,kit){
  const {part,orb,mat}=kit;
  const female=p.gender==="female",cut=Number(p.hairstyle)||0;
  const style=cut<4?cut:cut<=6?0:cut<=9?1:cut<=12?2:cut>=21?3:0;
  const parting=cut>=4&&cut<=12?(cut-4)%3: -1; // 0 left, 1 right, 2 middle
  const faded=cut>=13,shortSides=cut===13||cut===15||cut===19;
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
    part(head,.237,.170,.023,skinShade,x,.390,.379,.042);
    part(head,.226,.171,.028,white,x,.383,.403,.043);
    part(head,.142,.154,.027,iris,x+.014,.381,.425,.044);
    part(head,.107,.151,.027,ink,x+.015,.378,.445,.029);
    const catchlight=part(head,.047,.051,.015,white,x-.026,.420,.465,.017);
    catchlight.castShadow=false;
    const glimmer=part(head,.022,.025,.013,white,x+.063,.347,.465,.009);
    glimmer.castShadow=false;
    // Eyebrows are fine individual strands instead of oversized dark blocks.
    for(let j=0;j<4;j++){
      const strand=part(head,.039,.010,.014,mat(shade(p.hairHex,.21)),
        x+(j-1.5)*.046,.544+Math.sin(j*Math.PI/3)*.009,.395,.004);
      strand.rotation.z=-side*.06;
    }
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
  // Distinct cheek/jaw/chin/moustache components, independent of hairstyle.
  if(!female){
    const beard=facialHairShape(p.facialHair);
    if(beard.sideburns)for(const sign of [-1,1]){
      part(head,.13,.15+.17*beard.sideburns,.10,deep,sign*.465,
        .23-.04*beard.sideburns,.20,.031);
    }
    if(beard.cheeks)for(const sign of [-1,1]){
      const cheek=part(head,.11+.065*beard.cheeks,.09+.21*beard.cheeks,.092,deep,
        sign*.39,.115,.366,.034);cheek.rotation.z=sign*.08;
      part(head,.10,.045+.065*beard.cheeks,.050,hair,sign*.327,-.016,.389,.020);
    }
    if(beard.jaw)for(const sign of [-1,1]){
      part(head,.19,.07+.10*beard.jaw,.089,deep,sign*.23,-.06,.375,.033);
      part(head,.14,.04+.04*beard.jaw,.056,hair,sign*.345,-.052,.335,.022);
    }
    if(beard.chin){
      const length=beard.chin,extra=Math.max(0,length-1);
      const core=part(head,.27+.18*Math.min(1,length),.085+.20*length,.127,deep,
        0,-.10-.050*extra,.386,.040);
      if(beard.pointed)core.scale.x=.74;
      part(head,.19,.06+.15*extra,.071,hair,0,-.173-.099*extra,.449,.025);
      if(extra>.10){
        const tip=part(head,beard.pointed?.15:.245,.09+.25*extra,.14,
          hair,0,-.265-.18*extra,.357,.040);
        if(beard.pointed)tip.scale.x=.77;
      }
    }
    if(beard.soul){
      part(head,.060+.032*beard.soul,.042+.032*beard.soul,.028,hair,
        0,.060,.467,.014);
    }
    if(beard.moustache){
      for(const sign of [-1,1]){
        const whisker=part(head,.12+.02*beard.moustache,.045+.026*beard.moustache,
          .058,hair,sign*.085,.208,.480,.019);
        whisker.rotation.z=sign*(beard.handlebar?.25:.09);
        if(beard.handlebar){
          const curl=part(head,.075,.035,.042,hair,sign*.211,.229,.459,.014);
          curl.rotation.z=sign*.60;
        }
      }
    }
    if(beard.stubble){
      const tint=mat(shade(p.hairHex,.24));
      for(const sign of [-1,1]){
        part(head,.08+.054*beard.stubble,.12+.08*beard.stubble,.020,
          tint,sign*.415,.075,.354,.014);
      }
      part(head,.27,.024+.036*beard.stubble,.018,tint,0,-.069,.399,.009);
    }
  }
  // A selectable 3D bindi, with its own color and geometric shape.
  if(p.bindiStyle&&p.bindiStyle!=="none"){
    const jewel=mat(p.bindiHex??0xaa2439,.36,.05),s=p.bindiStyle;
    if(s==="small-round")orb(head,.031,jewel,0,.644,.402,1,1,.5).castShadow=false;
    else if(s==="medium-round")orb(head,.048,jewel,0,.644,.405,1,1,.5).castShadow=false;
    else if(s==="oval")orb(head,.038,jewel,0,.644,.406,.78,1.72,.48).castShadow=false;
    else if(s==="diamond"){
      const diamond=part(head,.072,.072,.019,jewel,0,.646,.405,.008);
      diamond.rotation.z=Math.PI/4;
    }else if(s==="ornate"){
      orb(head,.037,jewel,0,.644,.406,.95,1.32,.45).castShadow=false;
      for(const dx of [-.062,.062])orb(head,.016,jewel,dx,.644,.406,1,1,.45).castShadow=false;
      orb(head,.013,mat(0xeacc84),0,.704,.407,1,1,.45).castShadow=false;
    }
  }
  // Completely bald is a real hair-free head, not a skin-colored hair mesh.
  if(cut!==20){
  // Hair is now constructed as a stepped crown with overlapping voxel
  // locks and *different length/volume silhouettes* for all four styles.
  const crown=part(head,cut>=13&&cut<20?1.08:1.12,cut>=13&&cut<20?.20:.29,.82,deep,0,.805,-.042,.082);
  part(head,1.045,.17,.74,hair,0,.907,-.025,.068);
  for(const side of [-1,1]){
    part(head,.23,.33,.69,hair,side*.480,.640,-.012,.070);
    for(let j=0;j<3;j++){
      const lock=part(head,.192,.19+j*.026,.24,j%2?middle:high,
        side*(.39-j*.052),.778-j*.066,.320-j*.026,.043);
      lock.rotation.z=side*(.06+j*.055);
    }
  }
  const fringeCount=parting>=0||cut>=13?0:style===0?5:style===3?4:5;
  for(let j=0;j<fringeCount;j++){
    const x=(j-(fringeCount-1)/2)*(.79/fringeCount);
    const offset=(j*3+style)%3;
    const height=.17+offset*.035;
    const sweep=parting===0?.12:parting===1?-.12:parting===2?((j-(fringeCount-1)/2)>0?.10:-.10):style===3?-.065:style===1?.064:.018;
    const lock=part(head,.164,height*.76,.144,j%3===0?high:j%3===1?middle:hair,
      x+sweep,.810-offset*.018,.328,.034);
    lock.rotation.z=(j-(fringeCount-1)/2)*-.073+(parting===0?-.20:parting===1?.20:0);
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
  }else if(cut===3){
    // A centered ponytail is gathered at the occipital middle, not one side.
    part(head,.86,.42,.29,deep,0,.48,-.385,.085);
    part(head,.38,.23,.31,middle,0,.467,-.495,.083);
    part(head,.27,.12,.29,jewelry,0,.408,-.53,.045);
    for(let j=0;j<7;j++){
      const tail=part(head,.235,.215,.29,j%2?hair:middle,
        Math.sin(j*.8)*.045,.32-j*.17,-.57-j*.021,.076);
      tail.rotation.z=Math.sin(j*.8)*.085;
    }
  }else if(cut>=21){
    // Indian choti/plait: swept-back roots and a distinctly interwoven
    // three-strand braid behind the head. 21/22 are central, 23 is twin.
    part(head,.88,.32,.29,deep,0,.52,-.39,.083);
    const twin=cut===23;
    const count=cut===22?17:twin?12:14;
    for(const center of (twin?[-.34,.34]:[0])){
      const startZ=twin?-.48:-.58;
      part(head,twin?.27:.36,.22,.24,deep,center,.41,startZ,.052);
      for(let j=0;j<count;j++){
        const ratio=j/count,taper=Math.max(.40,1-ratio*.58);
        const wave=Math.sin(j*1.13)*(twin?.035:.046);
        const x=center+wave,y=.33-j*.104,z=startZ-.065-Math.sin(j*.45)*.014;
        part(head,.225*taper,.132,.25*taper,j%2?middle:hair,x,y,z,.045);
        const strand=part(head,.133*taper,.114,.136*taper,j%2?high:deep,
          x+(j%2?-.079:.079)*taper,y+.021,z+.095*taper,.029);
        strand.rotation.z=(j%2?.27:-.27);
      }
      const tip=.33-count*.104;
      part(head,.18,.08,.21,mat(0xd5a75f,.48,.12),center,tip,startZ-.06,.026);
      part(head,.12,.18,.15,hair,center,tip-.12,startZ-.06,.038);
    }
  }
  // Visible three-dimensional scalp part, sweeping locks and short tapered sides.
  if(parting>=0){
    const partX=parting===0?-.22:parting===1?.22:0;
    for(let j=0;j<8;j++){
      const z=-.29+j*.094;
      part(head,.023,.024,.074,mat(shade(p.skinHex,-.08)),partX,.936-j*.003,z,.009);
    }
    for(let j=0;j<6;j++){
      const start=parting===0?-.16:parting===1?.16:(j%2?-.07:.07);
      const direction=parting===0?1:parting===1?-1:j%2?1:-1;
      const lock=part(head,.16,.095,.26,j%2?high:hair,start+direction*(.06+j*.105),
        .882-j*.014,.30-j*.016,.035);
      lock.rotation.z=direction*.16;
    }
  }
  if(faded&&cut!==20){
    const sides=cut===14||cut===16?0.73:0.43;
    for(const sign of [-1,1]){
      // A close crop overlays long side locks and creates a pronounced fade.
      part(head,.071,.40,.58,mat(shade(p.skinHex,-.04)),sign*.552,.51,-.025,.032);
      for(let j=0;j<4;j++)part(head,.09,.08,.48,j%2?middle:deep,sign*.552,.62-j*.075,-.04,.020)
        .scale.set(1,sides+(3-j)*.05,1);
    }
    if(cut===14||cut===15||cut===18){
      for(let j=0;j<6;j++){
        const q=part(head,.15,.19,.24,j%2?high:hair,(j-2.5)*.14,.995,.25,.045);
        q.rotation.z=cut===18?-.43:cut===15?.4:.14;
      }
    }else if(cut===16||cut===17){
      for(let j=0;j<7;j++){
        const q=part(head,.13,.21,.16,j%2?deep:high,(j-3)*.135,1.01,
          .21+Math.sin(j*2)*.075,.043);
        q.rotation.z=cut===16?(j-3)*.13:Math.sin(j*1.8)*.22;
      }
    }
  }
  } // Hair finished; bald heads skip the entire scalp/hair sculpture.
  if(p.glassesStyle&&p.glassesStyle!=="none"){
    const kind=p.glassesStyle,frame=mat(p.glassesHex??0x644c40,.39,.17);
    const lens=new THREE.MeshPhysicalMaterial({color:0xd5eef3,roughness:.12,metalness:0,transparent:true,opacity:.09,depthWrite:false});
    for(const x of [-.225,.225]){
      if(kind==="round"||kind==="aviator"){
        const radius=kind==="round"?.145:.161;
        const ring=new THREE.Mesh(frameGeometry("rim",radius),frame);
        ring.position.set(x,.415,.492);ring.scale.y=kind==="aviator"?1.14:1;
        head.add(ring);
        const glass=new THREE.Mesh(frameGeometry("lens",radius-.019),lens);
        glass.position.set(x,.415,.488);glass.scale.y=kind==="aviator"?1.14:1;
        head.add(glass);
      }else{
        const wide=kind==="cat-eye"?.30:.272;
        const high=kind==="square"?.29:kind==="cat-eye"?.225:.20;
        for(const dy of [-1,1]){
          const top=part(head,wide,.027,.044,frame,x,.415+dy*high/2,.487,.012);
          top.rotation.z=kind==="cat-eye"?dy*(x<0?.16:-.16):0;
        }
        for(const sign of [-1,1])part(head,.029,high,.044,frame,x+sign*wide/2,.415,.487,.012);
        part(head,wide-.046,high-.03,.007,lens,x,.415,.486,.011).castShadow=false;
      }
    }
    part(head,.17,.028,.05,frame,0,.432,.496,.012);
    for(const sign of [-1,1])part(head,.14,.03,.043,frame,sign*.49,.438,.37,.012);
  }
  return head;
}

/** Detailed sculpted footwear kept on the original animated leg pivots. */
export function sculptFoot(pivot,p,kit){
  const {part,orb,mat}=kit;
  const auto=p.outfit==="salwar"?"sandals":p.outfit==="suit"?"formal":
    p.outfit==="dress"?"flats":"sneakers";
  const style=["auto","sneakers","formal","flats","sandals"].includes(p.footwear)?
    (p.footwear==="auto"?auto:p.footwear):auto;
  const sneaker=style==="sneakers",formal=style==="formal",flat=style==="flats";
  const sandal=style==="sandals";
  const sole=mat(p.shoeHex??(sneaker?0xf4f0e9:formal?0x343033:flat?0x8c5855:0x9e624b),.69);
  const upper=mat(p.shoeHex??(sneaker?0xe1e0d8:formal?0x4c3b36:flat?0xb36e6a:0xb26f56),.73);
  const trim=mat(sneaker?0xf9f6ef:formal?0xb6a084:flat?0xe8c1a8:0xe9c38b,.52);
  // All footwear shares the same foot pivot for consistent animation.
  part(pivot,.305,flat?.09:sandal?.085:.147,.45,upper,0,-.552,.132,.072);
  part(pivot,.34,.085,.51,sole,0,-.645,.148,.047);
  if(!sandal)part(pivot,.34,.055,.22,upper,0,-.542,.311,.039);
  part(pivot,.338,.025,.52,trim,0,-.675,.147,.016);
  if(sneaker){
    for(let j=0;j<3;j++)part(pivot,.158,.018,.026,trim,0,-.488,.065+j*.072,.009);
    part(pivot,.329,.034,.035,mat(0x8796a1),0,-.634,-.098,.011);
  }else if(formal){
    part(pivot,.295,.038,.19,trim,0,-.523,.20,.020);
  }else if(flat){
    const strap=part(pivot,.31,.046,.14,trim,0,-.534,.06,.019);
    strap.rotation.z=.10;
    part(pivot,.32,.042,.07,upper,0,-.51,.22,.027);
  }else{
    // Sandals have an exposed top and visibly separated crossing straps.
    const exposed=mat(p.skinHex,.83);
    part(pivot,.275,.055,.37,exposed,0,-.565,.15,.028);
    for(const z of [.05,.22]){
      const strap=part(pivot,.30,.047,.075,upper,0,-.526,z,.025);
      strap.rotation.z=z===.05?.14:-.14;
    }
    for(const x of [-.10,.10])orb(pivot,.021,0xe6bd81,x,-.535,.315,.85,.73,.6);
  }
}
