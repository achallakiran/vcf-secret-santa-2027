import * as THREE from "three";

/**
 * Festive office art pieces. All assets are generated here, with no network
 * images, no photographs and no copyrighted character models.
 */
const wallpaperCache=new Map(),canvases=[];
function wallpaper(index){
  const key=index%4;
  if(wallpaperCache.has(key))return wallpaperCache.get(key);
  const canvas=document.createElement("canvas");
  canvas.width=288;canvas.height=184;
  const cx=canvas.getContext("2d");
  const bases=[["#274e69","#6299b0"],["#283d5e","#637f9e"],["#245753","#75a28f"],["#55465f","#b79dba"]];
  const grd=cx.createLinearGradient(0,0,288,184);grd.addColorStop(0,bases[key][0]);grd.addColorStop(1,bases[key][1]);
  cx.fillStyle=grd;cx.fillRect(0,0,288,184);
  cx.globalAlpha=.19;
  for(let i=0;i<44;i++){
    const x=(i*197+key*41)%288,y=(i*67+key*23)%182;
    cx.fillStyle=i%5===0?"#fbdd9f":"#ffffff";cx.fillRect(x,y,i%3===0?3:2,2);
  }
  cx.globalAlpha=1;
  // Festive wallpaper: clean little 3D Christmas pine, not a wall painting.
  cx.fillStyle="#3a8b65";
  cx.beginPath();cx.moveTo(146,23);cx.lineTo(103,79);cx.lineTo(115,79);
  cx.lineTo(91,110);cx.lineTo(199,110);cx.lineTo(177,79);cx.lineTo(189,79);cx.closePath();cx.fill();
  cx.fillStyle="#26644b";
  cx.beginPath();cx.moveTo(146,34);cx.lineTo(105,95);cx.lineTo(189,95);cx.closePath();cx.fill();
  cx.fillStyle="#d4a66a";cx.fillRect(140,105,12,18);
  for(let i=0;i<11;i++){
    const x=112+(i*43)%75,y=61+(i*19)%43;
    cx.beginPath();cx.arc(x,y,3.5,0,Math.PI*2);
    cx.fillStyle=i%2===0?"#f8d088":"#e87070";cx.fill();
  }
  cx.fillStyle="#ffe6ac";cx.font="bold 16px sans-serif";cx.textAlign="center";cx.fillText("HAPPY HOLIDAYS",144,150);
  cx.fillStyle="#e9dff5";cx.font="11px sans-serif";cx.fillText("VCF OFFICE",144,167);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;wallpaperCache.set(key,texture);canvases.push(canvas);return texture;
}
export function decorateWorkstation(group,settings,kit){
  const {block,ball,cyl,mat}=kit;
  const {seatSide=1,index=0}=settings;
  const dark=mat(0x293642);
  const paper=mat(0xf3ede5),metal=mat(0xbbac9b);
  // Physical 3D monitor front, textured with original seasonal desktop art.
  const image=new THREE.Mesh(new THREE.PlaneGeometry(.49,.33),
    new THREE.MeshBasicMaterial({map:wallpaper(index),toneMapped:false}));
  image.position.set(seatSide*.179,.99,-.22);
  image.rotation.y=seatSide*Math.PI/2;
  image.renderOrder=2;group.add(image);
  const trim=block(group,seatSide*.190,1.174,-.219,.026,.028,.58,0x202c3d,false);
  const status=ball(group,seatSide*.196,1.18,.027,.017,mat(0x83e2ae,{emissive:0x1c8e64}),1);
  status.castShadow=false;
  // Slim sculpted display stand, rubber desk mat and charging connector.
  block(group,seatSide*.08,.802,-.24,.38,.012,.68,0xd6c7b5,false);
  block(group,seatSide*.12,.823,-.23,.27,.014,.49,0xf0e6d9,false);
  block(group,-seatSide*.09,.81,-.60,.10,.035,.17,0x9e9c94,false);
  // Ceramic pen cup with separate colored writing instruments.
  cyl(group,-seatSide*.15,.88,.54,.067,.057,.14,0xf3ddd0,12);
  for(let j=0;j<4;j++){
    const stem=block(group,-seatSide*.15+(j-1.5)*.023,1.00,.54,.018,.20,.018,
      [0xcf7760,0x5485a5,0x4b9473,0xe7ba72][j],false);
    stem.rotation.z=(j-1.5)*.13;
  }
  // Real stack of notebooks, sculpted paper edges and elastic band.
  if(index%3===0){
    for(let n=0;n<3;n++){
      block(group,seatSide*.015,.816+n*.023,.49,.27,.026,.35,
        n===2?0x6b8f84:n===1?0xf4e9d2:0xb96d65,false);
    }
    block(group,seatSide*.015,.888,.49,.025,.015,.37,0xd2be8a,false);
  }
  // Tiny decorative present or succulent, staggered to avoid mass repetition.
  if(index%4===1){
    cyl(group,seatSide*.06,.855,.55,.076,.063,.10,0xe4d2c1);
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5;
      const leaf=ball(group,seatSide*.06+Math.sin(a)*.056,.94+Math.cos(a)*.017,
        .55+Math.cos(a)*.05,.075,mat(j%2?0x69a783:0x46896b));
      leaf.scale.set(.58,1.03,.66);
    }
  }else if(index%4===3){
    block(group,seatSide*.025,.87,.56,.18,.16,.16,0xbf5965,false);
    block(group,seatSide*.025,.963,.56,.20,.04,.20,0xe6ca92,false);
    block(group,seatSide*.025,.884,.56,.031,.19,.19,0xf0dda5,false);
  }
}
const wallArtCache=new Map();
function wallPoster(type){
  const k=type%3;if(wallArtCache.has(k))return wallArtCache.get(k);
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=314;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle=["#e9e2d9","#d9e8dd","#eae0df"][k];ctx.fillRect(0,0,256,314);
  ctx.strokeStyle=["#946859","#456f62","#9a5b6e"][k];ctx.lineWidth=7;ctx.strokeRect(8,8,240,298);
  const designs=[
    ["WORK","TOGETHER","✧"],["JOYFUL","DAYS","❄"],["MERRY","& BRIGHT","✦"]
  ];
  const d=designs[k];
  ctx.fillStyle=["#704b4a","#4e746a","#945b6b"][k];ctx.textAlign="center";
  ctx.font="800 33px sans-serif";ctx.fillText(d[0],128,95);
  ctx.font="700 24px sans-serif";ctx.fillText(d[1],128,134);
  // Symmetric evergreen shapes as vector art, not monument or cultural motifs.
  ctx.fillStyle="#468568";
  for(let i=0;i<3;i++){
    const x=73+i*55,y=211-(i%2)*27;
    ctx.beginPath();ctx.moveTo(x,y-43);ctx.lineTo(x-20,y+15);ctx.lineTo(x+20,y+15);ctx.closePath();ctx.fill();
    ctx.fillStyle="#c58b68";ctx.fillRect(x-4,y+15,8,13);ctx.fillStyle="#468568";
  }
  ctx.fillStyle="#b66a63";ctx.font="20px sans-serif";ctx.fillText("· · ·",128,276);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  wallArtCache.set(k,tex);return tex;
}
export function addWarmOfficeDetails(root,geometry,kit){
  const {block,ball,mat}=kit;
  const {left,right,front,back,partyStart,viewWalls,twinkle}=geometry;
  const bronze=mat(0xc5a780,{roughness:.46,metalness:.22});
  const cream=mat(0xf6eddf);
  // Striped baseboards add crisp architectural rhythm without roof bars.
  for(const side of [-1,1]){
    const x=side>0?right-.03:left+.03;
    block(root,x,.15,(front+back)/2,.08,.29,back-front,0xd4c4b8,false);
    block(root,x,.32,(front+back)/2,.036,.034,back-front,0xf8f1e6,false);
  }
  // Hanging bulbs and garlands are deliberately confined to the *wall* only.
  for(let i=0;i<Math.min(28,Math.ceil((partyStart-front)/2.8));i++){
    const z=front+2+i*2.8;
    for(const side of [-1,1]){
      const x=side>0?right-.20:left+.20;
      const holder=block(root,x,3.10,z,.14,.24,.21,bronze,false);
      ball(root,x-side*.08,3.06,z,.095,mat(0xffd6a7,{emissive:0xa76d30}),1);
    }
  }
  // Custom office holiday prints; on the right wall, facing into the office.
  for(let i=0;i<Math.max(2,Math.floor((partyStart-front)/13));i++){
    const z=front+7.0+i*13;
    const backboard=block(viewWalls.east,right-.018,2.21,z,.075,1.22,.96,0xa78372,false);
    const image=new THREE.Mesh(new THREE.PlaneGeometry(.83,1.10),
      new THREE.MeshBasicMaterial({map:wallPoster(i),side:THREE.DoubleSide}));
    image.position.set(right-.067,2.21,z);
    image.rotation.y=-Math.PI/2;viewWalls.east.add(image);
  }
  // Ceiling stays clean and unobstructed as requested.
  return true;
}
