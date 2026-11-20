import * as THREE from "three";

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
    for(let k=0;k<7;k++){
      const x=cx+(k-3)*.035;
      const y=.477+Math.sin(k/6*Math.PI)*.010;
      b.voxel(x,y,.433,.038,.020,.026,hair);
    }
    for(let k=0;k<5;k++){
      const x=cx+(k-2)*.038;
      b.voxel(x,.317-(k===0||k===4?.010:0),.429,.039,.016,.025,deep);
    }
    // Small curved brow segments, with separately angled ends.
    for(let k=0;k<6;k++){
      const x=cx+(k-2.5)*.038;
      b.voxel(x,.548+Math.sin(k/5*Math.PI)*.026,.423,.035,.040,.024,
        colorHex(hair,k%3===0?.07:0));
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
  // An adult beard is modeled as fine voxel clumps around the lower jaw,
  // never pasted over the mouth.
  if(p.gender==="male"&&(p.hairstyle===1||p.hairstyle===3)){
    for(let row=0;row<4;row++)for(let col=-5;col<=5;col++){
      if(Math.abs(col)<3&&row>1)continue;
      const x=col*.067, y=.048-row*.035;
      b.voxel(x,y,.36+(.03-Math.abs(col)*.02),
        .065,.046,.042,colorHex(hair,seeded(row,col)+.04-.08));
    }
  }
  return b.finish();
}

/** Dense, layered stepped hair with silhouette depth from *every* camera. */
export function sculptHairVoxels(head,p){
  const b=voxelBrush(head,"Hundreds of layered hair voxels");
  const style=((Number(p.hairstyle)||0)%4+4)%4,base=p.hairHex;
  const shades=[colorHex(base,-.10),colorHex(base,-.052),colorHex(base,0),
    colorHex(base,.055),colorHex(base,.095)];
  const pigment=(row,col)=>shades[(row*5+col*7+17)%shades.length];
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
  for(let col=0;col<12;col++){
    const x=(col-5.5)*.086;
    const delta=(col*7+style*3)%4;
    const y=.784-delta*.034;
    b.voxel(x,y,.449,.092,.166+delta*.019,.128,pigment(6,col),
      0,0,(col-5.5)*-.022);
    b.voxel(x,y-.085-delta*.012,.499,.071,.052,.055,pigment(7,col));
  }
  // Rounded-but-stepped side walls. Front visible locks frame the face but
  // never conceal the eyes or cheeks.
  for(const side of [-1,1]){
    for(let row=0;row<8;row++){
      const y=.90-row*.092;
      for(let col=0;col<4;col++){
        const z=-.31+col*.156;
        const x=side*(.535+((row+col)%3)*.013);
        const omit=(col===3&&row>4)||(col===2&&row>6);
        if(omit)continue;
        b.voxel(x,y,z,.105,.107,.162,pigment(10+row,col+Math.round(side)),
          0,side*.035,side*.030);
      }
    }
  }
  // Back silhouette extends down past the head according to the chosen hair.
  // From follow camera this is the most important visual distinction.
  const end=style===0?.33:style===1?-.24:style===2?-.70:-.10;
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
  if(style===3){
    // A dimensional gathered ponytail: knotted tie, overlaid braid segments,
    // alternating strand thickness and an expressive tapered tip.
    for(let row=0;row<12;row++){
      const y=.47-row*.11;
      const wobble=Math.sin(row*.64)*.06;
      const x=.35+wobble;
      const z=-.60-row*.016;
      const narrow=1-row/23;
      b.voxel(x,y,z,.23*narrow,.132,.23*narrow,pigment(row,4),0,0,.08);
      b.voxel(x+.083*narrow,y+.020,z-.032,.10*narrow,.095,.13*narrow,
        pigment(row,5));
      b.voxel(x-.084*narrow,y-.018,z-.025,.11*narrow,.085,.14*narrow,
        pigment(row+4,2));
    }
    for(let k=0;k<7;k++)
      b.voxel(.29+k*.022,.41,-.565-k*.012,.035,.075,.05,
        k%2?0xd8ab69:0xf0d49c);
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
  const shade=formal?0x726056:sandal?0xd6ae7f:0xe9e6df;
  for(const side of [-1,1])for(let j=0;j<8;j++){
    const z=-.045+j*.057;
    b.voxel(side*.16,-.648,z,.027,.027,.059,shade);
  }
  if(!sandal)for(let j=0;j<5;j++){
    b.voxel(0,-.481,.022+j*.059,.137,.014,.021,
      j%2?0xa3b1b5:0xf7f7f1);
  }
  for(let j=0;j<6;j++){
    b.voxel((j%2?1:-1)*.093,-.557,.025+j*.053,
      .025,.019,.023,formal?0xc5b79d:sandal?0x9e6f54:0xffffff);
  }
  return b.finish();
}
