import * as THREE from "three";
import {createAvatar,avatarFromPerson} from "./avatar.js?v=face-refine-v4-studio-qa-v1";

/**
 * Organizer-only cinematic Christmas reveal.
 * One lightweight WebGL context reused as the organizer cycles colleagues.
 * Materials/renderer are cleaned up when the dialog closes.
 */
export function mountCeremonyStage(host,person){
  if(!host)throw new Error("The stage canvas is missing.");
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(31,1,.1,55);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.setClearColor(0x000000,0);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText="display:block;width:100%;height:100%;touch-action:none;cursor:grab";
  host.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffead8,0x52466e,2.8));
  const key=new THREE.SpotLight(0xffe8c1,54,20,.63,.38,1.2);
  key.position.set(-2.7,7.5,5);key.target.position.set(0,1.35,0);
  scene.add(key,key.target);
  const left=new THREE.PointLight(0xff5881,5,11);left.position.set(-2.3,2.8,.5);scene.add(left);
  const right=new THREE.PointLight(0x66cbd7,4,10);right.position.set(2.1,3,-.7);scene.add(right);
  const rim=new THREE.DirectionalLight(0xffdc87,2.2);rim.position.set(1.1,4.7,-3);scene.add(rim);

  const stand=new THREE.Group();scene.add(stand);
  const gold=new THREE.MeshStandardMaterial({color:0xeacb83,metalness:.48,roughness:.28});
  const wood=new THREE.MeshStandardMaterial({color:0x513345,metalness:.16,roughness:.63});
  const velvet=new THREE.MeshStandardMaterial({color:0x3e3048,roughness:.94});
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(1.57,1.74,.30,52),wood);
  platform.position.y=.075;platform.receiveShadow=true;stand.add(platform);
  const rimRing=new THREE.Mesh(new THREE.TorusGeometry(1.60,.043,8,68),gold);
  rimRing.rotation.x=Math.PI/2;rimRing.position.y=.235;stand.add(rimRing);
  const podiumTop=new THREE.Mesh(new THREE.CylinderGeometry(1.40,1.48,.13,48),velvet);
  podiumTop.position.y=.262;stand.add(podiumTop);
  const footlightMaterial=new THREE.MeshBasicMaterial({color:0xffd985});
  const footlights=[];
  for(let i=0;i<18;i++){
    const phi=(i/18)*Math.PI*2;
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.037,8,8),footlightMaterial);
    bulb.position.set(Math.sin(phi)*1.61,.19,Math.cos(phi)*1.61);
    stand.add(bulb);footlights.push(bulb);
  }

  const orbit=new THREE.Group();orbit.position.y=.34;scene.add(orbit);
  let model=null,personInfo=null,confetti=[],animation=0,disposed=false,revealed=false,
      drag=false,lastX=0,angle=0,lastFrame=performance.now();
  const disposable=new Set();
  function clearAvatar(){
    if(!model)return;
    orbit.remove(model.group);
    model.group.traverse(obj=>{
      if(!obj.isMesh)return;
      // TubeGeometry is created per avatar; other meshes reuse shared
      // geometry caches owned by the avatar factory.
      if(obj.geometry?.type==="TubeGeometry")obj.geometry.dispose();
      for(const material of Array.isArray(obj.material)?obj.material:[obj.material]){
        if(material&&!material.userData?.sharedVoxelMaterial)
          disposable.add(material);
      }
    });
    for(const material of disposable)material.dispose();
    disposable.clear();model=null;
  }
  function setPerson(p){
    clearAvatar();
    personInfo=p;
    if(!p)return;
    model=createAvatar(avatarFromPerson({
      id:p.id,name:p.display_name,avatar:p.avatar
    }));
    orbit.add(model.group);
    angle=0;revealed=false;
    resetConfetti();
    fit();
  }
  function fit(){
    const w=Math.max(host.clientWidth||1,1),h=Math.max(host.clientHeight||1,1);
    renderer.setSize(w,h,false);
    camera.aspect=w/h;
    // Frame the participant's expressive face and jacket as a close-up
    // while retaining a suggestion of the glowing Christmas podium.
    const box=model?new THREE.Box3().setFromObject(model.group):new THREE.Box3();
    const top=box.isEmpty()?3.2:box.max.y+.34;
    const bottom=box.isEmpty()?.20:Math.max(.45,box.min.y+.75);
    const height=top-bottom,span=Math.max(height,2.25);
    const fov=THREE.MathUtils.degToRad(camera.fov);
    const distance=Math.max(span/(2*Math.tan(fov/2)),
      1.65/(2*Math.tan(fov/2)*Math.max(camera.aspect,.45)))*1.2;
    const target=new THREE.Vector3(0,Math.max(1.8,(top+bottom)/2)+.18,0);
    camera.position.set(.27*distance,target.y+.11*distance,.962*distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  const stars=new THREE.Group();scene.add(stars);
  const starGold=new THREE.MeshBasicMaterial({color:0xffe3a8,transparent:true,opacity:.68});
  const starWhite=new THREE.MeshBasicMaterial({color:0xf8f1e6,transparent:true,opacity:.73});
  const starGeo=new THREE.TetrahedronGeometry(.042,0);
  for(let i=0;i<42;i++){
    const p=new THREE.Mesh(starGeo,i%3?starGold:starWhite);
    const t=i*2.39996323,rad=2.2+(i%6)*.35;
    p.position.set(Math.sin(t)*rad,.9+(i%12)*.31,Math.cos(t)*rad-1.35);
    p.scale.setScalar(.55+(i%4)*.24);stars.add(p);
  }
  function resetConfetti(){
    confetti.forEach(p=>{scene.remove(p);p.geometry.dispose();p.material.dispose()});
    confetti=[];
  }
  function reveal(){
    revealed=true;
    resetConfetti();
    const palette=[0xffcf75,0xff698b,0x70d5a9,0xffffff,0x8abde8];
    for(let i=0;i<100;i++){
      const geo=new THREE.BoxGeometry(.036+(i%3)*.01,.09,.015);
      const mat=new THREE.MeshBasicMaterial({color:palette[i%palette.length],side:THREE.DoubleSide});
      const piece=new THREE.Mesh(geo,mat);
      piece.position.set((Math.sin(i*73.37))*2.6,3.4+(i%8)*.35,(Math.sin(i*17.92))*1.4);
      piece.userData.fall=.8+(i%7)*.24;
      piece.userData.spin=.5+(i%5)*.15;
      scene.add(piece);confetti.push(piece);
    }
  }
  function render(now){
    if(disposed)return;
    animation=requestAnimationFrame(render);
    if(host.getClientRects().length===0)return;
    const dt=Math.min(.06,(now-lastFrame)/1000);lastFrame=now;
    if(!drag)angle+=dt*.12;
    orbit.rotation.y+=((angle)-orbit.rotation.y)*Math.min(1,dt*6);
    model?.update(now*.001,false);
    key.intensity=52+Math.sin(now*.0016)*4;
    stars.rotation.y+=dt*.017;
    if(revealed){
      confetti.forEach(p=>{
        p.position.y-=dt*p.userData.fall;
        p.rotation.z+=dt*p.userData.spin;
        p.rotation.x+=dt*1.3;
        if(p.position.y<-.1)p.position.y=4;
      });
    }
    renderer.render(scene,camera);
  }
  function down(e){if(e.pointerType==="touch")return;drag=true;lastX=e.clientX;renderer.domElement.setPointerCapture?.(e.pointerId)}
  function move(e){if(!drag)return;angle+=(e.clientX-lastX)*.007;lastX=e.clientX;}
  function up(e){drag=false;try{renderer.domElement.releasePointerCapture?.(e.pointerId)}catch{}}
  renderer.domElement.addEventListener("pointerdown",down);
  renderer.domElement.addEventListener("pointermove",move);
  renderer.domElement.addEventListener("pointerup",up);
  renderer.domElement.addEventListener("pointercancel",up);
  let resizeObserver=null;
  if(typeof ResizeObserver!=="undefined"){resizeObserver=new ResizeObserver(()=>fit());resizeObserver.observe(host)}
  window.addEventListener("resize",fit);
  setPerson(person);
  animation=requestAnimationFrame(render);
  return {
    update:setPerson,
    reveal,
    dispose(){
      disposed=true;
      cancelAnimationFrame(animation);
      resizeObserver?.disconnect();window.removeEventListener("resize",fit);
      renderer.domElement.removeEventListener("pointerdown",down);
      renderer.domElement.removeEventListener("pointermove",move);
      renderer.domElement.removeEventListener("pointerup",up);
      renderer.domElement.removeEventListener("pointercancel",up);
      clearAvatar();resetConfetti();
      platform.geometry.dispose();rimRing.geometry.dispose();podiumTop.geometry.dispose();
      footlights.forEach(x=>x.geometry.dispose());
      starGeo.dispose();
      for(const material of [gold,wood,velvet,footlightMaterial,starGold,starWhite])material.dispose();
      renderer.dispose();host.replaceChildren();
    }
  };
}
