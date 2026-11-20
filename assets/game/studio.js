import * as THREE from "three";
import {createAvatar} from "./avatar.js?v=art-hero-v1";

/** Dedicated procedural character studio: a rotatable, fully rendered model. */
export function mountAvatarStudio(host,appearance){
  if(!host)throw new Error("Avatar studio preview element is missing.");
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,45);
  camera.position.set(2.5,2.42,4.95);
  camera.lookAt(0,1.15,0);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none;cursor:grab";
  host.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xd4ecfa,0xc79b86,2.8));
  const key=new THREE.DirectionalLight(0xffecd9,3.5);
  key.position.set(-3,6,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;
  scene.add(key);
  const rim=new THREE.DirectionalLight(0xa5cddb,1.9);rim.position.set(3.3,4.5,-3.7);scene.add(rim);
  const fill=new THREE.PointLight(0xffc78e,1.45,9);fill.position.set(2.2,2.2,3.4);scene.add(fill);
  const wood=new THREE.MeshStandardMaterial({color:0x7c5149,roughness:.5});
  const gold=new THREE.MeshStandardMaterial({color:0xdeb982,roughness:.26,metalness:.48});
  const pedestal=new THREE.Group();scene.add(pedestal);
  for(const [y,radius,height,material] of [
    [.045,1.35,.09,wood],[.12,1.25,.09,gold],[.23,1.22,.21,wood],[.34,1.24,.04,gold]
  ]){
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,48),material);
    mesh.position.y=y;mesh.receiveShadow=true;pedestal.add(mesh);
  }
  const base=new THREE.Mesh(new THREE.CircleGeometry(3.2,60),
    new THREE.MeshStandardMaterial({color:0x1b2e29,roughness:.82}));
  base.rotation.x=-Math.PI/2;base.position.y=-.08;base.receiveShadow=true;scene.add(base);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.35,.015,8,56),
    new THREE.MeshBasicMaterial({color:0xf5d49b,transparent:true,opacity:.57,depthWrite:false}));
  halo.position.set(0,1.75,-.73);scene.add(halo);
  const sparks=[];
  for(let i=0;i<16;i++){
    const angle=i*Math.PI*2/16;
    const dot=new THREE.Mesh(new THREE.IcosahedronGeometry(.02+(i%4)*.007,0),
      new THREE.MeshBasicMaterial({color:i%3===0?0xffe4aa:0xcfe1d9,transparent:true,opacity:.52}));
    dot.position.set(Math.cos(angle)*1.6,1.8+Math.sin(angle)*1.32,-.9);
    scene.add(dot);sparks.push(dot);
  }
  const orbit=new THREE.Group();
  orbit.position.y=.365;scene.add(orbit);
  let model=null,dragging=false,lastX=0,angle=-.16,targetAngle=-.16,lastActive=performance.now();
  const createdMaterials=new Set();
  const swap=(props)=>{
    if(model){
      orbit.remove(model.group);
      // Geometries are authored and cached in avatar.js. Only bespoke per-model
      // materials are disposed when the model is replaced.
      model.group.traverse(obj=>{
        if(obj.isMesh){
          const m=Array.isArray(obj.material)?obj.material:[obj.material];
          m.forEach(v=>{if(v&&!v.userData?.sharedVoxelMaterial)createdMaterials.add(v);});
        }
      });
      for(const m of createdMaterials)m.dispose();
      createdMaterials.clear();
    }
    model=createAvatar(props);
    orbit.add(model.group);
    return model;
  };
  const pointerDown=e=>{
    dragging=true;lastX=e.clientX;lastActive=performance.now();
    renderer.domElement.setPointerCapture?.(e.pointerId);
    renderer.domElement.style.cursor="grabbing";
  };
  const pointerMove=e=>{
    if(!dragging)return;
    const dx=e.clientX-lastX;
    lastX=e.clientX;
    targetAngle+=dx*.010;
    lastActive=performance.now();
  };
  const pointerUp=e=>{
    dragging=false;lastActive=performance.now();
    renderer.domElement.style.cursor="grab";
    try{renderer.domElement.releasePointerCapture?.(e.pointerId);}catch{}
  };
  renderer.domElement.addEventListener("pointerdown",pointerDown);
  renderer.domElement.addEventListener("pointermove",pointerMove);
  renderer.domElement.addEventListener("pointerup",pointerUp);
  renderer.domElement.addEventListener("pointercancel",pointerUp);
  let running=true,raf=0,clock=new THREE.Clock(),ro=null;
  function resize(){
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.45));
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  if(typeof ResizeObserver!=="undefined"){
    ro=new ResizeObserver(resize);ro.observe(host);
  }else window.addEventListener("resize",resize);
  swap(appearance);
  resize();
  function draw(){
    if(!running)return;
    raf=requestAnimationFrame(draw);
    const dt=Math.min(clock.getDelta(),.06),t=clock.elapsedTime;
    if(host.getClientRects().length===0||host.clientWidth<10)return;
    if(!dragging&&performance.now()-lastActive>5000)targetAngle+=dt*.10;
    angle+=(targetAngle-angle)*Math.min(1,dt*9);
    orbit.rotation.y=angle;
    model?.update(t,false);
    halo.rotation.z=Math.sin(t*.32)*.05;
    sparks.forEach((p,i)=>p.material.opacity=.40+.25*Math.sin(t*1.6+i*.8));
    renderer.render(scene,camera);
  }
  draw();
  return {
    update:swap,
    rotate(delta){targetAngle+=delta;lastActive=performance.now();},
    dispose(){
      running=false;cancelAnimationFrame(raf);ro?.disconnect();
      window.removeEventListener("resize",resize);
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointermove",pointerMove);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      renderer.domElement.removeEventListener("pointercancel",pointerUp);
      renderer.dispose();
      host.replaceChildren();
    }
  };
}
