import * as THREE from "three";
import {facialHairShape} from "./facial-hair.js?v=face-refine-v4";

/**
 * Full-resolution sculpted voxel detailing shared by the player, every
 * coworker and the avatar studio.  No quality LOD and no distance impostors.
 *
 * Each detail is a real box voxel, but adjoining microvoxels are submitted as
 * a single InstancedMesh per articulated body part. This retains all geometry
 * without generating a draw call for each of the hundreds of small pieces.
 */
const detailCube=new THREE.BoxGeometry(1,1,1);
const finish=new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:.79,metalness:.025,flatShading:true
});
finish.userData.sharedVoxelMaterial=true;

function colorHex(hex,light=.0){
  const c=new THREE.Color(hex);
  if(light)c.offsetHSL(0,0,light);
  return c;
}
function voxelBrush(parent,name){
  const cells=[];
  function voxel(x,y,z,w,h,d,color,rx=0,ry=0,rz=0){
    if(w<=0||h<=0||d<=0)return;
    cells.push({x,y,z,w,h,d,color,rx,ry,rz});
  }
  function finishBrush(){
    if(!cells.length)return null;
    const mesh=new THREE.InstancedMesh(detailCube,finish,cells.length);
    const proxy=new THREE.Object3D(),tmpColor=new THREE.Color();
    for(let i=0;i<cells.length;i++){
      const c=cells[i];
      proxy.position.set(c.x,c.y,c.z);
      proxy.scale.set(c.w,c.h,c.d);
      proxy.rotation.set(c.rx,c.ry,c.rz);
      proxy.updateMatrix();
      mesh.setMatrixAt(i,proxy.matrix);
      mesh.setColorAt(i,tmpColor.set(c.color));
    }
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.name=name+" / "+cells.length+" fully modeled voxels";
    // Small detail should receive scene light but not cast thousands of tiny
    // expensive shadow-map triangles. The large character silhouette casts it.
    mesh.castShadow=false;
    mesh.receiveShadow=true;
    mesh.frustumCulled=false;
    parent.add(mesh);
    return mesh;
  }
  return {voxel,finish:finishBrush,count:()=>cells.length};
}
const seeded=(a,b)=>((a*73+b*41+a*b*17)%17)/16;

/** The face is expressive even at 3/4 view; more dimension, not just paint. */
export function sculptFaceVoxels(head,p){
  const b=voxelBrush(head,"Artisan eyes, lashes, smile and complexion");
  const skin=p.skinHex,deep=colorHex(skin,-.06),light=colorHex(skin,.075);
  const hair=p.hairHex,lip=p.gender==="female"?0xae6464:0x92604e;
  for(const side of [-1,1]){
    const cx=side*.225;
    // Stepped eye frame and prominent top lid. High-contrast sclera remains
    // large, retaining the cute expression of the agreed character references.
    for(let k=0;k<5;k++){
      const x=cx+(k-2)*.041;
      const y=.485+Math.sin(k/4*Math.PI)*.008;
      b.voxel(x,y,.420,.029,.008,.011,colorHex(skin,-.13));
    }
    for(let k=0;k<5;k++){
      const x=cx+(k-2)*.038;
      b.voxel(x,.317-(k===0||k===4?.010:0),.429,.039,.016,.025,deep);
    }
    // Small curved brow segments, with separately angled ends.
    for(let k=0;k<5;k++){
      const x=cx+(k-2)*.041;
      b.voxel(x,.548+Math.sin(k/4*Math.PI)*.014,.414,.029,.014,.016,
        colorHex(hair,.12));
    }
    // Outer eyelashes / creases and softly colored lower eyelid.
    for(let k=0;k<3;k++){
      b.voxel(cx+side*(.125+k*.014),.453-k*.023,.43,
        .028,.028,.028,hair,0,0,side*.22);
    }
    for(let k=0;k<3;k++){
      b.voxel(side*(.323+k*.026),.198+(k%2)*.024,.421,
        .026,.021,.020,colorHex(skin,.11));
    }
    // Ears with subtle helix/inset cuboids, rather than flat blocks.
    b.voxel(side*.568,.302,.053,.037,.074,.054,light);
    b.voxel(side*.592,.260,.092,.025,.031,.033,deep);
    // Corner of the smile and lower lip shape.
    b.voxel(side*.122,.157,.440,.027,.021,.024,lip);
  }
  // Little stepped bridge and nose highlight for profile readability.
  for(let k=0;k<4;k++)b.voxel(0,.286-k*.036,.463+k*.002,
    .045-.004*k,.035,.024,k%2?skin:light);
  for(let k=-2;k<=2;k++)b.voxel(k*.036,.095+Math.abs(k)*.009,.452,
    .036,.018,.024,colorHex(lip,k===0?.07:0));
  // Facial hair is selected independently of hairstyle. Draw distinct
  // patterned cheeks, jaw, moustache and isolated soul patches; the full
  // beard includes the moustache by definition.
  if(p.gender==="male"){
    const facial=facialHairShape(p.facialHair);
    const shadeHair=(r,c)=>colorHex(hair,seeded(r,c)*.13-.09);
    if(facial.cheeks>0){
      const rows=Math.max(2,Math.ceil(6*facial.cheeks));
      for(const sign of [-1,1])for(let row=0;row<rows;row++){
        for(let col=0;col<4;col++){
          const x=sign*(.345+col*.040),y=.25-row*.048,
            z=.41-col*.018;
          b.voxel(x,y,z,.032,.046,.026,shadeHair(row,col));
        }
      }
    }
    if(facial.sideburns>0){
      for(const sign of [-1,1])for(let row=0;row<Math.ceil(6*facial.sideburns);row++){
        b.voxel(sign*.474,.33-row*.049,.31,.045,.050,.026,
          shadeHair(row,sign));
      }
    }
    if(facial.jaw>0){
      for(let row=0;row<Math.ceil(3+3*facial.jaw);row++)
        for(let col=-7;col<=7;col++){
          const x=col*.048;
          const middleBias=Math.abs(x)<.14;
          if(facial.chin<.15&&middleBias&&row>1)continue;
          const y=.015-row*.039;
          b.voxel(x,y,.414-Math.abs(x)*.12,.049,.041,.027,
            shadeHair(row,col));
        }
    }
    if(facial.chin>0){
      const layers=Math.ceil(3+facial.chin*7);
      for(let row=0;row<layers;row++){
        const t=row/layers;
        const width=(facial.pointed?.19:.24)*(1-(facial.pointed?.79:.38)*t);
        for(let col=-3;col<=3;col++){
          const x=col*width/3,y=-.115-row*.045;
          b.voxel(x,y,.447-t*.05,.040+width/8,.052,.025,
            shadeHair(row,col));
        }
      }
    }
    if(facial.soul>0){
      for(let row=0;row<2;row++)for(let col=-1;col<=1;col++){
        b.voxel(col*.024,.064-row*.025,.485,.023,.028,.019,
          shadeHair(row,col));
      }
    }
    if(facial.moustache>0){
      for(const sign of [-1,1])for(let col=0;col<5;col++){
        const x=sign*(.027+col*.038);
        const y=.223-(col/5)*.019+(facial.handlebar?col*.009:0);
        b.voxel(x,y,.506-Math.max(0,col-3)*.012,.042,
          .030+.01*facial.moustache,.028,shadeHair(col,sign));
      }
    }
    if(facial.stubble>0){
      const total=Math.round(4+facial.stubble*12);
      const tint=colorHex(hair,.22);
      for(const sign of [-1,1])for(let row=0;row<total;row++){
        for(let col=0;col<8;col++){
          if((row*5+col*7)%4===0)continue;
          const x=sign*(.15+col*.042),y=.20-row*.025;
          if(y<-.11)continue;
          b.voxel(x,y,.422-Math.abs(x)*.12,
            .013,.015,.009,tint);
        }
      }
    }
  }
  return b.finish();
}

/** Dense, layered stepped hair with silhouette depth from *every* camera. */
export function sculptHairVoxels(head,p){
  const b=voxelBrush(head,"Hundreds of layered hair voxels");
  const cut=Number(p.hairstyle)||0;
  if(cut===20)return null; // genuinely bald: no crown, fringe or hair pixels
  const style=cut<4?cut:cut<=6?0:cut<=9?1:cut<=12?2:cut>=21?3:0;
  const parting=cut>=4&&cut<=12?(cut-4)%3:-1,base=p.hairHex;
  const shades=[colorHex(base,-.10),colorHex(base,-.052),colorHex(base,0),
    colorHex(base,.055),colorHex(base,.095)];
  const pigment=(row,col)=>shades[(row*5+col*7+17)%shades.length];
  // Cropped cuts have their own stepped hair volumes. A high quiff,
  // asymmetric undercut, spiky silhouette, curly top and crew cut no longer
  // inherit the same back curtain and helmet-shaped fringe as medium cuts.
  if(cut>=13&&cut<=19){
    const height={13:.09,14:.32,15:.25,16:.26,17:.28,18:.11,19:.06}[cut];
    const thickness=cut===19?2:cut===13?3:5;
    for(let row=0;row<thickness;row++)for(let col=0;col<11;col++){
      const u=(col-5)/5,x=u*.492;
      const swept=cut===15?(1-u)*.062:cut===18?(1-u)*.035:0;
      const lift=cut===14?.115*(1-u*u):cut===16?.095*Math.abs(Math.sin(col*2.4)):
        cut===17?.085*Math.sin(col*1.7):0;
      const y=.94+row*.046+height*.23+lift;
      const z=-.32+row*.140+swept;
      if(cut===19&&Math.abs(u)>.75)continue;
      b.voxel(x,y,z,.084,.047,.137,pigment(row,col),0,0,
        cut===15?-.18:cut===18?-.32:cut===16?u*.22:0);
    }
    if(cut===17)for(let j=0;j<18;j++){
      const u=(j%6-2.5)/2.5,z=(Math.floor(j/6)-1)*.18;
      b.voxel(u*.38,1.052+.035*Math.sin(j*2.2),z,
        .11,.10,.12,pigment(j,4),0,0,Math.sin(j*1.5)*.20);
    }
    return b.finish();
  }
  // Crown: staggered tiles on a gently stepped dome. Visible across front,
  // rear and top; not a flat smooth helmet with a few lines.
  for(let row=0;row<5;row++){
    const y=.986+Math.sin((row+1)*Math.PI/7)*.038;
    for(let col=0;col<11;col++){
      const x=(col-5)*.094;
      const z=-.345+row*.153+((col+row)%2)*.013;
      const lift=.018*Math.cos(col*Math.PI/11);
      b.voxel(x,y+lift,z,.099,.060,.154,pigment(row,col));
    }
  }
  // Forehead fringe is organized as intersecting angular locks and staggered
  // ends. Stop above the large eye region so expressions remain readable.
  for(let col=0;col<10;col++){
    const x=(col-4.5)*.099;
    const delta=(col*7+style*3)%4;
    // Center/side parting removes the fringe along a visible scalp seam.
    if(parting>=0){
      const seam=parting===0?3:parting===1?8:6;
      if(Math.abs(col-seam)<=0)continue;
    }
    const y=.858-delta*.020+(cut>=13?.033:0);
    // Keep the eyebrow and upper eye region clear, even with short hair.
    if(cut>=13)continue;
    b.voxel(x,y,.382,.096,.084+delta*.011,.102,pigment(6,col),
      0,0,(col-4.5)*-.015);
    b.voxel(x,y-.047-delta*.006,.420,.063,.034,.033,pigment(7,col));
  }
  // Rounded-but-stepped side walls. Front visible locks frame the face but
  // never conceal the eyes or cheeks.
  for(const side of [-1,1]){
    for(let row=0;row<8;row++){
      const y=.90-row*.092;
      for(let col=0;col<4;col++){
        const z=-.31+col*.156;
        const x=side*(.535+((row+col)%3)*.013);
        const omit=(col===3&&row>4)||(col===2&&row>6)||(cut>=13&&row>3);
        if(omit)continue;
        b.voxel(x,y,z,.105,.107,.162,pigment(10+row,col+Math.round(side)),
          0,side*.035,side*.030);
      }
    }
  }
  // Back silhouette extends down past the head according to the chosen hair.
  // From follow camera this is the most important visual distinction.
  const end=cut>=13?.54:style===0?.33:style===1?-.24:style===2?-.70:-.10;
  const rows=Math.ceil((.80-end)/.092);
  if(style!==3){
    for(let row=0;row<rows;row++){
      const y=.79-row*.092;
      const widthFactor=style===2&&y<0?.97:1;
      for(let col=0;col<11;col++){
        const x=(col-5)*.091*widthFactor;
        const w=Math.abs(col-5);
        if(w>4&&style===0&&y<.53)continue;
        const z=-.542-((col*3+row*7)%4)*.016;
        const shift=style===1?Math.sin(row*.52+col*.55)*.016:
                    style===2?Math.sin(row*.34+col*.30)*.026:0;
        b.voxel(x+shift,y,z,.104,.096,.111,pigment(row,col),
          0,(col-5)*.008,(col-5)*.015);
      }
    }
  }
  // Long hair/shoulder-length side locks create volume in profile.
  if(style===1||style===2){
    const down=style===2?13:7;
    for(const side of [-1,1])for(let strand=0;strand<3;strand++){
      for(let row=0;row<down;row++){
        const y=.49-row*.098+strand*.035;
        const x=side*(.50+strand*.049+.012*Math.sin(row*.8+strand));
        const z=-.29+strand*.145-.03*Math.sin(row*.45);
        b.voxel(x,y,z,.122,.105,.140,pigment(row+11,strand));
      }
    }
    // Tailored, visibly separate ends rather than a perfectly square curtain.
    for(let col=0;col<10;col++){
      const x=(col-4.5)*.103;
      const y=end-.065-(col%3)*.042;
      b.voxel(x,y,-.58,.092,.105,.121,pigment(23,col));
    }
  }
  if(cut===3){
    // A dimensional gathered ponytail: knotted tie, overlaid braid segments,
    // alternating strand thickness and an expressive tapered tip.
    for(let row=0;row<12;row++){
      const y=.47-row*.11;
      const wobble=Math.sin(row*.64)*.06;
      const x=wobble;
      const z=-.60-row*.016;
      const narrow=1-row/23;
      b.voxel(x,y,z,.23*narrow,.132,.23*narrow,pigment(row,4),0,0,.08);
      b.voxel(x+.083*narrow,y+.020,z-.032,.10*narrow,.095,.13*narrow,
        pigment(row,5));
      b.voxel(x-.084*narrow,y-.018,z-.025,.11*narrow,.085,.14*narrow,
        pigment(row+4,2));
    }
    for(let k=0;k<7;k++)
      b.voxel(-.07+k*.022,.41,-.565-k*.012,.035,.075,.05,
        k%2?0xd8ab69:0xf0d49c);
  }
  if(cut>=21){
    // Micro-voxel plait highlights follow the articulated braid, with a
    // left/right crossover that distinguishes a choti from a straight tail.
    const twin=cut===23,count=cut===22?17:twin?12:14;
    for(const center of (twin?[-.34,.34]:[0])){
      const startZ=twin?-.48:-.58;
      for(let j=0;j<count;j++){
        const ratio=j/count,taper=Math.max(.40,1-ratio*.58);
        const x=center+Math.sin(j*1.13)*(twin?.035:.046);
        const y=.33-j*.104,z=startZ-.065-Math.sin(j*.45)*.014+.157*taper;
        for(const side of [-1,1]){
          b.voxel(x+side*.058*taper,y+(side===1?.024:-.024),
            z,.058*taper,.032,.030*taper,
            pigment(j+side+20,Math.abs(j+side)%9),0,0,side*(j%2?.22:-.22));
        }
      }
    }
  }
  return b.finish();
}

/** Readable, genuinely modeled embroideries and seam details on clothes. */
export function sculptGarmentVoxels(hips,p){
  const b=voxelBrush(hips,"Fine voxel stitches, embroidery and tailored fabric");
  const outfit=p.outfit||"shirt",base=p.colorHex,light=colorHex(base,.16),
        dark=colorHex(base,-.13),subtle=colorHex(base,.07),
        trim=outfit==="salwar"?0xe6bd80:0xf2e4cf;
  const width=p.build||1;
  // Stitching on BOTH sides: visible to the follow camera and editor.
  for(const sign of [-1,1]){
    const z=sign>0?.322:-.304;
    const sideScale=sign>0?1:-1;
    for(const side of [-1,1]){
      const x=side*.31*width;
      for(let k=0;k<9;k++){
        const y=.610-k*.105;
        if(outfit==="tshirt"&&y<.06)continue;
        b.voxel(x,y,z,.024,.047,.026,k%3===0?light:subtle);
      }
      for(let k=0;k<7;k++){
        const y=-.35+(k%2)*.018,xh=side*(.31-k*.015)*width;
        b.voxel(xh,y,z,.031,.037,.029,k%2?light:dark);
      }
    }
    // Horizontal hem embroidery, tiny stitches with alternating heights.
    if(["salwar","dress","sweater"].includes(outfit)){
      for(let col=0;col<18;col++){
        const x=(col-8.5)*.044*width;
        const y=-.36+(col%3===0?.038:0);
        b.voxel(x,y,z,.038,.027,.033,col%4===0?trim:col%3===0?light:subtle);
      }
    }
    if(outfit==="salwar"){
      // Paired embroidered paisleys / leaves, precisely following tunic.
      for(const side of [-1,1])for(let motif=0;motif<3;motif++){
        const x=side*(.14+.045*(motif%2))*width;
        const y=.43-motif*.25;
        for(let row=-2;row<=2;row++){
          const xo=x+side*(Math.abs(row)*.021);
          b.voxel(xo,y+row*.029,z+.018*sign,.024,.030,.035,
            row===0?trim:light);
        }
        b.voxel(x,y,z+.028*sign,.042,.038,.037,trim);
      }
      // Dupatta braid edge on front and back with glinting diamond stitches.
      const x=sign>0?-.39:-.31;
      for(let k=0;k<18;k++){
        const y=.65-k*.053;
        b.voxel(x+.018*Math.sin(k*.47),y,sign>0?.40:-.427,
          .041,.061,.046,k%4===0?0xf3dbb1:k%2?0xe6b78d:trim);
      }
    }else if(outfit==="suit"){
      // Tailored pinstripe and double row seam stitching on front/back.
      for(const side of [-1,1])for(let col=0;col<3;col++){
        const x=side*(.16+col*.044)*width;
        for(let row=0;row<13;row++){
          const y=.62-row*.050;
          b.voxel(x,y,z,.014,.027,.018,col===0?light:subtle);
        }
      }
      for(const side of [-1,1])for(const yy of [.38,.23]){
        b.voxel(side*.25*width,yy,z+.02*sign,.04,.025,.031,trim);
      }
    }else if(outfit==="sweater"){
      // Readable stepped snowflake / knit motif across the chest and back.
      for(const x of [-.20,0,.20])for(const y of [.22,.39,.54]){
        const cx=x*width;
        for(let k=-2;k<=2;k++){
          b.voxel(cx+k*.027,y,z+.019*sign,.029,.026,.025,k===0?trim:light);
          b.voxel(cx,y+k*.027,z+.019*sign,.027,.030,.025,k===0?trim:light);
        }
      }
    }else if(outfit==="dress"){
      // Pleated A-line dress appears fuller, with edge highlights.
      for(let col=0;col<12;col++){
        const x=(col-5.5)*.068*width;
        for(let k=0;k<4;k++){
          b.voxel(x,-.12-k*.072,z+(col%2)*.013*sign,
            .034,.070,.037,col%3===0?trim:light);
        }
      }
    }else if(outfit==="shirt"){
      // Proper collar/cuff stitches and restrained vertical weave.
      for(let col=0;col<5;col++)for(let row=0;row<12;row++){
        const x=(col-2)*.11*width;
        b.voxel(x,.69-row*.045,z,.012,.026,.017,col%2?subtle:light);
      }
    }else if(outfit==="tshirt"){
      // Limited embroidered chest crest, not a flat printed triangle.
      for(let k=0;k<18;k++){
        const a=k*Math.PI*2/18,x=Math.cos(a)*.116,y=.42+Math.sin(a)*.10;
        b.voxel(x,y,z,.032,.034,.031,k%3?light:trim);
      }
    }
  }
  return b.finish();
}

export function sculptSleeveVoxels(upper,lower,p,side){
  const sleeve=voxelBrush(upper,"Sculpted voxel shoulder and sleeve");
  const fabric=p.colorHex,highlight=colorHex(fabric,.13),shadow=colorHex(fabric,-.1);
  const long=["shirt","salwar","suit","sweater"].includes(p.outfit);
  for(let row=0;row<(long?6:4);row++){
    const y=-.018-row*.058;
    for(let col=0;col<5;col++){
      const z=-.145+col*.070;
      sleeve.voxel(side*.02,y,z,.029,.043,.059,
        row%3===0?highlight:col%2?fabric:shadow);
    }
  }
  sleeve.finish();
  const cuff=voxelBrush(lower,"Fine elbow, bracelet and cuff voxels");
  for(let col=0;col<9;col++){
    const a=col*Math.PI*2/9;
    cuff.voxel(Math.sin(a)*.105,-.222,Math.cos(a)*.135,
      .033,.046,.039,long?highlight:colorHex(p.skinHex,.085));
  }
  cuff.finish();
}

export function sculptShoeVoxels(pivot,p){
  const b=voxelBrush(pivot,"Layered shoe stitching and eyelets");
  const outfit=p.outfit||"shirt";
  const formal=p.footwear==="formal"||(p.footwear==="auto"&&outfit==="suit");
  const sandal=p.footwear==="sandals"||(p.footwear==="auto"&&outfit==="salwar");
  const shade=p.shoeHex??(formal?0x726056:sandal?0xd6ae7f:0xe9e6df);
  for(const side of [-1,1])for(let j=0;j<8;j++){
    const z=-.045+j*.057;
    b.voxel(side*.16,-.648,z,.027,.027,.059,shade);
  }
  if(!sandal)for(let j=0;j<5;j++){
    b.voxel(0,-.481,.022+j*.059,.137,.014,.021,
      p.shoeHex??(j%2?0xa3b1b5:0xf7f7f1));
  }
  for(let j=0;j<6;j++){
    b.voxel((j%2?1:-1)*.093,-.557,.025+j*.053,
      .025,.019,.023,p.shoeHex??(formal?0xc5b79d:sandal?0x9e6f54:0xffffff));
  }
  return b.finish();
}
