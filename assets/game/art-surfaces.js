import * as THREE from "three";

/**
 * Art director's room dressing: softly shaded tiles and warm, authored social
 * furniture. Objects remain off the main aisles and are not extra desks or
 * extra participant seats. None has a hidden UI/control function.
 */

let cachedTiles=null;
export function officeTileMaterial(){
  if(cachedTiles)return cachedTiles.material;
  const canvas=document.createElement("canvas");
  canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext("2d");
  const palette=["#eee3db","#f4ebe2","#ebdfd5","#f1e7de"];
  const step=128;
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const n=(row*3+col*7)%palette.length;
    const x=col*step,y=row*step;
    ctx.fillStyle=palette[n];ctx.fillRect(x,y,step,step);
    ctx.strokeStyle="#cdbcb3";ctx.lineWidth=3;ctx.strokeRect(x+.7,y+.7,step-1.4,step-1.4);
    ctx.fillStyle="rgba(255,255,255,.11)";
    ctx.fillRect(x+4,y+4,step-8,step-8);
    // Tiny tonal variation, stable and reproducible across users.
    for(let i=0;i<17;i++){
      const px=x+9+((i*29+col*13)%107),py=y+8+((i*43+row*17)%108);
      ctx.fillStyle=i%2?"rgba(132,102,92,.036)":"rgba(255,255,255,.075)";
      ctx.fillRect(px,py,1+(i%3),1+(i%2));
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  const material=new THREE.MeshStandardMaterial({
    map:texture,color:0xffffff,roughness:.38,metalness:.035
  });
  cachedTiles={material,texture};
  return material;
}
export function applyOfficeTileRepeat(material,width,length){
  const tile=material.map;
  if(!tile)return;
  // 512 pixels encode a 4 x 4 tile repeat of a little over 1 meter each.
  tile.repeat.set(width/4.4,length/4.4);
  tile.needsUpdate=true;
}

export function addOfficeLounge(root,config,kit){
  const {softBlock,block,ball,cyl,plant,mat}=kit;
  const {rowZ,bays,partyStart,colliders,room}=config;
  const wood=mat(0xc6a17c),linen=mat(0x8da8a0),cream=mat(0xf4e7d4),
        gold=mat(0xc8aa73),coral=mat(0xd98e87);
  // Collaboration nooks alternate with Christmas greenery along the east wall.
  // Center aisle x~=2.5 stays completely open; the user can still walk to stage.
  const proposed=[rowZ(Math.min(2,bays-1))+.30];
  for(let i=8;i<bays-1;i+=8)proposed.push(rowZ(i));
  for(let k=0;k<proposed.length;k++){
    const z=Math.min(partyStart-2.4,proposed[k]);
    const x=6.65;
    const g=new THREE.Group();g.position.set(x,0,z);root.add(g);
    // Tone-on-tone woven-style rug and refined two-seat sofa.
    block(g,-.08,.018,0,2.18,.024,2.86,k%2?0xe9d7cf:0xe3d4c4,false);
    block(g,-.08,.035,0,2.06,.015,2.72,k%2?0xf0e4d6:0xf5e9d8,false);
    softBlock(g,.40,.47,0,.65,.30,2.08,linen,.21);
    softBlock(g,.73,.81,0,.27,.84,2.19,linen,.19);
    for(const zz of [-.58,.58]){
      softBlock(g,.36,.65,zz,.50,.21,.76,k%2?0x98b39f:0xa9bfb1,.17);
      const cushion=softBlock(g,.51,.89,zz,.20,.35,.48,
        k%2?0xc9807e:0xe6c49c,.18);
      cushion.rotation.z=-.19;
    }
    for(const zz of [-.98,.98]){
      softBlock(g,.42,.65,zz,.57,.29,.19,0x9cb2a9,.09);
      block(g,.63,.17,zz,.11,.29,.10,0x97735b,false);
    }
    // Low round coffee table with vase, book and festive miniature.
    cyl(g,-.65,.43,.10,.42,.41,.065,0xbb9371,20);
    cyl(g,-.65,.235,.10,.055,.09,.36,0xb2a08c,12);
    cyl(g,-.65,.065,.10,.31,.28,.055,0x927766,18);
    const book=softBlock(g,-.83,.486,.18,.31,.038,.23,
      k%2?0xa65d62:0x648c79,.07);
    book.castShadow=false;
    cyl(g,-.48,.55,.04,.065,.075,.17,0xf3e4d4,12);
    for(let j=0;j<5;j++){
      const angle=j*Math.PI*2/5;
      const foliage=ball(g,-.48+Math.sin(angle)*.08,.67,.04+Math.cos(angle)*.08,
        .11,k%2?0x4c8a65:0x5a9577);
      foliage.scale.set(.7,.48,.8);
    }
    // Tall floor planter creates the leafy, lived-in look of reference art.
    plant(g,-.88,-1.35,.71);
    plant(g,.80,1.4,.56);
    colliders.push({x:x+.36,z,hx:.78,hz:1.18});
    colliders.push({x:x-.65,z:z+.1,hx:.54,hz:.53});
    // Do not put a table or bench across the default path x=2..4.
  }
}
