import * as THREE from "three";

/**
 * Procedural fabric finishes authored for the VCF game.
 * Uses actual color swatches, woven fiber and outfit-specific motifs instead
 * of flat solid-colored boxes. One PBR material per outfit/color combination
 * is shared by every fully detailed character.
 */
const fabricCache=new Map();
function variant(color,amount){
  const c=new THREE.Color(color);
  c.offsetHSL(0,0,amount);
  return c.getStyle();
}
export function clothMaterial(outfit,hex){
  const k=outfit+":"+hex;
  if(fabricCache.has(k))return fabricCache.get(k);
  const size=256,c=document.createElement("canvas");
  c.width=c.height=size;
  const g=c.getContext("2d");
  const dark=variant(hex,-.10),light=variant(hex,.10),
        middle=variant(hex,.035),highlight=variant(hex,.23);
  g.fillStyle=variant(hex,.015);g.fillRect(0,0,size,size);
  // Fine fibers generate depth under sunlight while staying matte.
  for(let y=0;y<size;y+=3){
    g.globalAlpha=.07;g.fillStyle=y%2?light:dark;g.fillRect(0,y,size,1);
  }
  for(let x=0;x<size;x+=5){
    g.globalAlpha=.05;g.fillStyle=x%2?light:middle;g.fillRect(x,0,1,size);
  }
  g.globalAlpha=1;
  if(outfit==="salwar"||outfit==="dress"){
    // Delicate repeated handloom-inspired leaves and geometric embroidery.
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const x=19+col*51+(row%2)*15,y=24+row*48;
      g.strokeStyle=outfit==="salwar"?highlight:middle;
      g.lineWidth=outfit==="salwar"?2.2:1.5;g.globalAlpha=.58;
      g.beginPath();g.moveTo(x,y-9);g.quadraticCurveTo(x+9,y,x,y+10);
      g.quadraticCurveTo(x-9,y,x,y-9);g.stroke();
      g.beginPath();g.moveTo(x-9,y);g.lineTo(x+9,y);
      g.moveTo(x,y-9);g.lineTo(x,y+10);g.stroke();
      g.globalAlpha=.56;g.fillStyle=outfit==="salwar"?highlight:light;
      g.fillRect(x-2,y-2,4,4);
    }
  }else if(outfit==="sweater"){
    for(let y=0;y<256;y+=24)for(let x=0;x<256;x+=24){
      g.lineWidth=2;g.strokeStyle=(x+y)%3===0?highlight:light;
      g.globalAlpha=.32;g.beginPath();
      g.moveTo(x+12,y+2);g.lineTo(x+21,y+12);g.lineTo(x+12,y+22);
      g.lineTo(x+3,y+12);g.closePath();g.stroke();
    }
  }else if(outfit==="shirt"||outfit==="suit"){
    for(let x=0;x<size;x+=16){
      g.globalAlpha=outfit==="suit"?.12:.16;
      g.fillStyle=highlight;g.fillRect(x,0,1,size);
      g.fillStyle=dark;g.fillRect(x+4,0,1,size);
    }
  }else if(outfit==="tshirt"){
    for(let y=0;y<size;y+=13)for(let x=0;x<size;x+=13){
      g.fillStyle=light;g.globalAlpha=.10;g.fillRect(x,y,2,2);
    }
  }
  g.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  tex.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({
    color:0xffffff,map:tex,roughness:outfit==="suit"?.8:.92,
    metalness:0,side:THREE.FrontSide
  });
  material.userData.sharedVoxelMaterial=true;
  fabricCache.set(k,material);
  return material;
}
