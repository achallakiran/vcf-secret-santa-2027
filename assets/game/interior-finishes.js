import * as THREE from "three";

/**
 * Shared finish library for the real, playable office. Authored canvas
 * textures: wood veneer, tactile fabric, porcelain cabinetry and carpet.
 * No downloaded meshes/photos, and no character-quality downgrades.
 */
let finishes=null;
function randomSeed(seed){
  let n=seed>>>0;
  return ()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};
}
function texture(make,size=256){
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext("2d");
  make(ctx,size);
  const t=new THREE.CanvasTexture(canvas);
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=4;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  return t;
}
function wood(base,seed){
  return texture((ctx,n)=>{
    const rand=randomSeed(seed);
    ctx.fillStyle=base;ctx.fillRect(0,0,n,n);
    for(let y=0;y<n;y++){
      const waviness=Math.sin(y*.027)*.8+Math.sin(y*.14)*.3;
      const dark=rand()<.52;
      ctx.fillStyle=dark?"rgba(90,48,23,.085)":"rgba(255,245,221,.11)";
      ctx.fillRect(0,y+waviness,n,rand()<.78?1:2);
    }
    for(let i=0;i<14;i++){
      let x=rand()*n,y=rand()*n;
      ctx.strokeStyle=i%3?"rgba(102,52,23,.10)":"rgba(255,245,220,.25)";
      ctx.lineWidth=.6+rand()*1.4;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.bezierCurveTo(x+40,y+10,x+75,y-8,x+120,y+4);
      ctx.stroke();
    }
  });
}
function woven(base,seed){
  return texture((ctx,n)=>{
    const rand=randomSeed(seed);
    ctx.fillStyle=base;ctx.fillRect(0,0,n,n);
    for(let y=0;y<n;y+=3){
      ctx.strokeStyle=y%2?"rgba(255,255,255,.17)":"rgba(43,36,39,.11)";
      ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(n,y);ctx.stroke();
    }
    for(let x=0;x<n;x+=3){
      ctx.strokeStyle=x%2?"rgba(255,255,255,.08)":"rgba(32,30,33,.11)";
      ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,n);ctx.stroke();
    }
    for(let i=0;i<140;i++){
      const a=rand()*n,b=rand()*n;
      ctx.fillStyle=i%2?"rgba(250,240,220,.1)":"rgba(15,20,25,.09)";
      ctx.fillRect(a,b,1.5,1);
    }
  });
}
function porcelain(base,seed){
  return texture((ctx,n)=>{
    const rand=randomSeed(seed);
    ctx.fillStyle=base;ctx.fillRect(0,0,n,n);
    for(let i=0;i<340;i++){
      const x=rand()*n,y=rand()*n,a=rand();
      ctx.fillStyle=a>.5?"rgba(255,255,255,.22)":"rgba(120,95,82,.065)";
      ctx.fillRect(x,y,1+rand()*1.2,1);
    }
  });
}
function carpet(seed){
  return texture((ctx,n)=>{
    const rand=randomSeed(seed);
    ctx.fillStyle="#a45465";ctx.fillRect(0,0,n,n);
    ctx.lineWidth=2;ctx.strokeStyle="#e9c18c";
    ctx.strokeRect(14,14,n-28,n-28);
    ctx.lineWidth=5;ctx.strokeRect(24,24,n-48,n-48);
    ctx.lineWidth=1.5;ctx.strokeStyle="#f6e5c8";
    ctx.strokeRect(37,37,n-74,n-74);
    for(let j=0;j<12;j++){
      const x=49+(j*37)%170,y=47+(j*53)%170;
      ctx.strokeStyle=j%2?"rgba(255,227,188,.45)":"rgba(94,44,54,.30)";
      ctx.lineWidth=2;ctx.beginPath();
      ctx.moveTo(x,y-10);ctx.lineTo(x+10,y);ctx.lineTo(x,y+10);
      ctx.lineTo(x-10,y);ctx.closePath();ctx.stroke();
    }
    for(let i=0;i<800;i++){
      const x=rand()*n,y=rand()*n;
      ctx.fillStyle=i%2?"rgba(255,244,225,.060)":"rgba(61,32,53,.075)";
      ctx.fillRect(x,y,1,1);
    }
  });
}
export function getInteriorFinishes(){
  if(finishes)return finishes;
  const use=(map,roughness=.72,metalness=0)=>new THREE.MeshStandardMaterial({
    map,color:0xffffff,roughness,metalness
  });
  finishes={
    maple:use(wood("#cda47b",414),.59),
    walnut:use(wood("#a97856",117),.66),
    deskAsh:use(wood("#d8c5b2",712),.63),
    deskWalnut:use(wood("#986d56",1170),.66),
    cabinet:use(porcelain("#efe7df",25),.44),
    divider:use(woven("#e9d5be",170),.92),
    dividerSage:use(woven("#acc5b1",213),.95),
    dividerRose:use(woven("#d8b7b1",226),.95),
    dividerSlate:use(woven("#afbdc8",229),.95),
    dividerSand:use(woven("#e1cbb5",337),.95),
    chairInk:use(woven("#3f4d61",9),.97),
    chairTeal:use(woven("#506976",24),.97),
    cushion:use(woven("#b77577",12),.95),
    carpet:use(carpet(618),.96),
    trim:new THREE.MeshStandardMaterial({color:0xcba56f,roughness:.35,metalness:.60}),
    deskGlow:new THREE.MeshStandardMaterial({
      color:0xf3d5ac,roughness:.72,emissive:0xc18c54,emissiveIntensity:.28
    })
  };
  for(const material of Object.values(finishes)){
    material.userData.sharedOfficeMaterial=true;
  }
  return finishes;
}
