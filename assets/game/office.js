import * as THREE from "three";
// Fully procedural office furniture, lights and festive scenery; no external models.
const boxGeo=new THREE.BoxGeometry(1,1,1);
const matCache=new Map();
const mat=(hex,opts={})=>{
  const key=hex+"|"+(opts.metalness||0)+"|"+(opts.roughness??.74)+"|"+(opts.emissive||0);
  if(!matCache.has(key))matCache.set(key,new THREE.MeshStandardMaterial({color:hex,roughness:opts.roughness??.74,metalness:opts.metalness??0,emissive:opts.emissive??0,emissiveIntensity:opts.emissive?0.9:0}));
  return matCache.get(key);
};
function block(parent,x,y,z,w,h,d,color,cast=true){
  const m=new THREE.Mesh(boxGeo,typeof color==="number"?mat(color):color);
  m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;
}
function ball(parent,x,y,z,r,color,detail=0){
  const m=new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail),typeof color==="number"?mat(color):color);
  m.position.set(x,y,z);m.castShadow=r>.2;parent.add(m);return m;
}
function cyl(parent,x,y,z,rTop,rBottom,height,color,segments=10){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments),mat(color));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function picture(parent,side,z,color){
  block(parent,side,2.35,z,.05,.64,.57,0x754d3f,false);
  block(parent,side+Math.sign(-side)*.03,2.35,z,.014,.51,.44,color,false);
}
function present(parent,x,z,size,seed){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const color=[0xd95d63,0x438d72,0xd3a35d,0x728dba][seed%4];
  block(g,0,size*.45,0,size,size*.9,size,color);
  block(g,0,size*.92,0,size*1.06,.11,size*1.06,0xf8e7bd);
  block(g,0,size*.54,0,size*.17,size*.9,size*1.1,0xeacf8c);
  block(g,0,size*.54,0,size*1.1,size*.9,size*.17,0xeacf8c);
  const bow=ball(g,-.12,size+0.09,0,.12,0xf4dba7);bow.scale.set(1.3,.6,1);
  const bow2=ball(g,.12,size+.09,0,.12,0xf4dba7);bow2.scale.set(1.3,.6,1);
}
function tree(parent,x,z,scale=1){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cyl(g,0,.25,0,.12,.18,.5,0x795b39);
  for(let tier=0;tier<5;tier++){
    const y=.72+tier*.48,base=1.28-tier*.18;
    const cone=new THREE.Mesh(new THREE.ConeGeometry(base,.95,7),mat(tier%2?0x296c4d:0x36845e));
    cone.position.y=y;cone.castShadow=true;g.add(cone);
    for(let i=0;i<7;i++){
      const a=i*2*Math.PI/7+tier*.48;
      const rr=base*.8;
      ball(g,Math.cos(a)*rr,y-.2,Math.sin(a)*rr,.1,i%3===0?0xe1c16a:i%3===1?0xce4e59:0x8ec2d0,1);
    }
  }
  const star=ball(g,0,3.10,0,.24,mat(0xffe4a1,{emissive:0xeeac48}),1);star.scale.set(.95,1.3,.42);
  const light=new THREE.PointLight(0xffb96a,2.5,7);light.position.set(0,2.15,0);g.add(light);
  for(let i=0;i<7;i++){const a=i*6.283/7;present(g,Math.cos(a)*1.1,Math.sin(a)*1.1,.28+i%3*.1,i);}
  return g;
}
function plant(parent,x,z,scale=1){
  const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  cyl(g,0,.27,0,.24,.17,.52,0xf4eddf);
  cyl(g,0,.49,0,.22,.24,.05,0xe0ccad);
  cyl(g,0,.76,0,.04,.06,.5,0x568363);
  for(let i=0;i<6;i++){
    const a=i*6.283/6;
    const leaf=ball(g,Math.sin(a)*.24,.87+(i%3)*.12,Math.cos(a)*.24,.22,0x4c9361);
    leaf.scale.set(1.05,.58,.75);
  }
  return g;
}
function wreath(parent,x,y,z,rot=0){
  const ring=new THREE.Group();ring.position.set(x,y,z);ring.rotation.y=rot;parent.add(ring);
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12;
    ball(ring,Math.cos(a)*.3,Math.sin(a)*.3,0,.15,i%4===0?0x3b9967:0x306c51);
    if(i%4===0)ball(ring,Math.cos(a)*.3,Math.sin(a)*.3,.13,.055,0xe66f68);
  }
  block(ring,0,-.33,.03,.27,.11,.08,0xc84e5c);
  return ring;
}
function garland(parent,z,x0,x1,y=3.5,twinkle=[]){
  const n=Math.max(8,Math.ceil((x1-x0)/.42));
  for(let i=0;i<=n;i++){
    const t=i/n,x=x0+t*(x1-x0),yy=y-.28*Math.sin(t*Math.PI);
    const orb=ball(parent,x,yy,z,.11,i%3?0x3c8154:0x28694a);
    orb.scale.set(1.2,.72,.82);
    if(i%3===0){
      const l=ball(parent,x,yy-.13,z+.02,.045,mat(i%2?0xfad177:0xffaca8,{emissive:0xe69847}),1);
      twinkle.push(l);
    }
  }
  for(const t of [.28,.66]){
    const x=x0+t*(x1-x0);
    block(parent,x,y-.25*Math.sin(t*Math.PI)-.12,z,.09,.27,.12,0xba4550);
    block(parent,x-.10,y-.25*Math.sin(t*Math.PI)-.08,z,.27,.09,.12,0xba4550);
  }
}
function chair(parent,x,z,face=1,variant=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=face;parent.add(g);
  const dark=variant%2?0x354351:0x405267;
  cyl(g,0,.30,0,.055,.05,.47,0x484c56);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;block(g,Math.cos(a)*.34,.095,Math.sin(a)*.34,.12,.05,.12,0x444b54);}
  block(g,0,.55,0,.53,.13,.47,dark);
  block(g,0,.97,-.21,.54,.75,.13,dark);
  block(g,-.28,.72,-.02,.075,.13,.4,0x5e6471);
  block(g,.28,.72,-.02,.075,.13,.4,0x5e6471);
  return g;
}
function workstation(parent,x,z,i,row,colliders){
  // Width of the desk is along the row (z): its LONG EDGE faces the seated employee.
  // W and R sit east of their desks and face WEST; L sits west and faces EAST.
  const chairSide=row==="L"?-1:1;
  const facing=row==="L"?Math.PI/2:-Math.PI/2;
  const left=-chairSide;
  const chairX=x+chairSide*.9;
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const oak=mat(0xc69d73),white=mat(0xf4f0e9);
  block(g,0,.76,0,.73,.075,1.52,oak);
  block(g,0,.38,-.66,.62,.68,.08,white);
  block(g,0,.38,.66,.62,.68,.08,white);
  block(g,0,.18,0,.52,.22,1.3,mat(0xeae5dc));
  block(g,0,1.1,0,.045,.52,1.42,row==="W"?0xefe5d7:0xe9d7bf,false);
  // Monitors face the employee (west/east), with long edge of desk fronting the chair.
  const screenX=-left*.13;
  block(g,screenX,.98,-.22,.09,.45,.62,0x343d48);
  block(g,screenX+left*.05,.99,-.22,.015,.37,.53,mat(i%3?0x6a9cae:0x568c88,{emissive:0x174459}),false);
  block(g,screenX,1.02,-.22,.03,.22,.23,0x1d5470,false);
  block(g,screenX,1.17,-.22,.035,.09,.12,0xb0c8d0,false);
  block(g,screenX,.83,-.22,.055,.10,.05,0x5b6674);
  block(g,left*.20,.81,-.27,.24,.018,.42,0xd0c8be,false);
  // Rich workstation clutter but no unsolicited cultural landmark artwork.
  block(g,.04,.83,.42,.28,.05,.23,0xf4d8ab);
  block(g,.04,.865,.42,.11,.016,.08,0xc4b49b);
  cyl(g,.21,.84,.33,.08,.07,.13,0xffffff,10);
  cyl(g,.21,.89,.33,.065,.06,.012,0xc66e62,10);
  if(i%3===0){
    cyl(g,-.18,.86,.5,.10,.08,.14,0xe9d7bc,8);
    for(let k=0;k<4;k++)ball(g,-.18+(k-1.5)*.05,.98,.5,.075,0x4a9b66);
  }else if(i%3===1){
    block(g,-.17,.85,.5,.23,.07,.30,0x5579a6);
    block(g,-.17,.9,.5,.19,.015,.27,0xe9e6d9);
  }else{
    block(g,-.15,.84,.51,.25,.04,.23,0xc76161);
    ball(g,-.15,.91,.51,.08,0x93ad65);
  }
  chair(parent,chairX,z,facing,i);
  colliders.push({x,z,hx:.58,hz:.85});
  colliders.push({x:chairX,z,hx:.33,hz:.37});
  return {position:{x:chairX,z:z-.08},facing,row,index:i};
}
function lamp(parent,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  block(g,0,3.76,0,.62,.19,1.6,0x343b41,false);
  block(g,0,3.65,0,.55,.06,1.5,mat(0xffe7b5,{emissive:0xffdfb9}),false);
  const pt=new THREE.PointLight(0xffdebb,1.4,6);
  pt.position.y=3.4;g.add(pt);return g;
}
function sign(parent,x,y,z,text){
  // Labels identify office areas, never place giant logos over gameplay.
  const can=document.createElement("canvas");can.width=420;can.height=140;
  const ctx=can.getContext("2d");ctx.fillStyle="#345d56";ctx.fillRect(0,0,420,140);
  ctx.fillStyle="#e8d6ac";ctx.font="bold 48px sans-serif";ctx.textAlign="center";
  ctx.fillText(text,210,86);
  const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;
  const p=new THREE.Mesh(new THREE.PlaneGeometry(3,1),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  p.position.set(x,y,z);parent.add(p);return p;
}
export function buildOffice(count=12){
  const bays=Math.max(4,Math.ceil(Math.min(150,Math.max(1,count))/3));
  const rowStart=1.45,step=1.86,rowEnd=rowStart+(bays-1)*step;
  const partyStart=rowEnd+4,back=partyStart+7;
  const width=16,left=-8,right=8,front=-3.65;
  const root=new THREE.Group(),colliders=[],seats=[],twinkle=[];
  // Subtle PBR flooring, tile grid lines and wall baseboards.
  block(root,0,-.13,(front+back)/2,width,.24,back-front,mat(0xe6d9d1,.25),false);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(width,back-front),mat(0xe3d7d1,{roughness:.32}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,.003,(front+back)/2);floor.receiveShadow=true;root.add(floor);
  const glines=new THREE.Group();root.add(glines);
  for(let x=left;x<=right+.001;x+=1.1)block(glines,x,.012,(front+back)/2,.012,.008,back-front,0xcfc2bf,false);
  for(let z=front;z<=back+.001;z+=1.1)block(glines,0,.012,z,width,.008,.012,0xcfc2bf,false);
  // Perimeter walls; window on north starts flush with west wall and ends just beyond island.
  block(root,left-.14,2.15,(front+back)/2,.23,4.3,back-front,0xf6eee7,false);
  block(root,right+.14,2.15,(front+back)/2,.23,4.3,back-front,0xf6eee7,false);
  block(root,0,2.15,back+.12,width,4.3,.26,0xf7f0e9,false);
  block(root,5.24,2.15,front-.10,5.52,4.3,.18,0xf4ede8,false);
  block(root,-2.6,3.87,front-.09,10.9,.64,.18,0xf4ede8,false);
  block(root,-2.6,.38,front-.09,10.9,.76,.2,0xe6d6cb,false);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(10.55,2.75),new THREE.MeshPhysicalMaterial({color:0xc6e8f2,metalness:.05,roughness:.07,transmission:.24,transparent:true,opacity:.47,side:THREE.DoubleSide}));
  glass.position.set(-2.72,2.24,front-.18);root.add(glass);
  // Outdoor skyline and trees visible through the single north window.
  for(let j=0;j<24;j++){
    const x=-8.1+j*.45,hh=1.0+(j*31%12)*.17;
    block(root,x,hh/2+.75,front-3.3-(j%3),.44,hh,.46,[0x94b9ce,0x8fa9c9,0xb0bcd1,0x85aeb1][j%4],false);
    if(j%3===0)ball(root,x,.72,front-1.8,1.05,0x7eaf87);
  }
  for(let x=-7.95;x<2.5;x+=1.72)block(root,x,2.28,front-.04,.075,3.25,.11,0x686d7a,false);
  block(root,-2.65,3.55,front-.025,10.7,.10,.15,0x656a73,false);
  block(root,-2.65,.79,front-.025,10.7,.10,.15,0x656a73,false);
  // Ceiling beams and long rectangular white/yellow lamp panels.
  for(let z=1;z<back-2;z+=7.3){
    block(root,0,4.05,z,width,.15,.22,0xe9e1d8,false);
    lamp(root,-4,z);lamp(root,1,z);lamp(root,6,z);
  }
  // Workstation bay repeated perpendicular to the north window.
  for(let i=0;i<bays;i++){
    const z=rowStart+i*step;
    seats.push(workstation(root,-7.1,z,i,"W",colliders));
    seats.push(workstation(root,-1.6,z,i,"L",colliders));
    seats.push(workstation(root,-.3,z,i,"R",colliders));
    // Low partitions along island spine.
    block(root,-.96,1.08,z,.08,.56,1.70,0xd9dfd8,false);
    if(i%3===0){
      plant(root,-4.6,z+.7,.48);plant(root,2.6,z+.6,.55);
    }
    if(i%5===0)wreath(root,-7.87,2.45,z,Math.PI/2);
  }
  // Ceiling garlands travel the north window and the central aisle.
  garland(root,front+.30,-7.6,2.6,3.45,twinkle);
  for(let z=4;z<partyStart;z+=8){
    garland(root,z,-7.2,7.2,3.58,twinkle);
  }
  // Small decorated tree near spawn; no obstruction to circulation.
  tree(root,6.55,4.75,.38);
  colliders.push({x:6.55,z:4.75,hx:.8,hz:.8});
  // South celebration area, moved naturally as seat count grows.
  const party=new THREE.Group();party.position.z=partyStart;root.add(party);
  block(party,0,.025,2.2,13,.025,7,0xe7d6c8,false);
  block(party,-2.9,.30,4.7,6,.55,1.9,0x9d5b52);
  block(party,-2.9,2.04,5.65,6,3.4,.14,0x9a4c4d,false);
  for(let i=0;i<5;i++){
    cyl(party,-5.6+i*1.34,1.45,5.3,.075,.075,2.35,0xe1b56b);
    ball(party,-5.6+i*1.34,2.75,5.3,.13,mat(0xffcb68,{emissive:0xf4c158}),1);
  }
  sign(party,-2.9,2.65,5.51,"SECRET SANTA");
  tree(party,4.55,3.35,1.03);
  colliders.push({x:4.55,z:partyStart+3.35,hx:1.5,hz:1.5});
  const rec=plant(party,6.9,6.0,1);plant(party,-6.7,6.0,1);
  for(let k=0;k<8;k++)present(party,2.7+(k%3)*.7,2.0+Math.floor(k/3)*.55,.25+(k%3)*.1,k);
  const lounge= new THREE.Group();party.add(lounge);
  for(let i=0;i<4;i++){
    const x=-5.2+i*2.1;
    block(lounge,x,.48,.8,1.3,.78,.46,[0xb68b7b,0x7e9a8f][i%2]);
    block(lounge,x,.8,1.1,1.3,.55,.15,[0xb68b7b,0x7e9a8f][i%2]);
  }
  plant(root,7.1,front+1,1.3);
  for(let k=0;k<3;k++)picture(root,7.94,3.06,front+5+k*5,[0xc6c6ad,0xb1c6cb,0xe3cdb2][k]);
  const spawn={x:4.2,z:Math.min(4.0,rowEnd-.3)};
  const rows=bays;
  return {root,colliders,seats,spawn,bays,room:{left,right,front,back},partyStart,twinkle};
}
