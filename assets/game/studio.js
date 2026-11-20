import * as THREE from "three";
import {createAvatar} from "./avatar.js?v=visual-qa-v1";

/** Dedicated procedural character studio: a rotatable, fully rendered model. */
export function mountAvatarStudio(host,appearance){
  if(!host)throw new Error("Avatar studio preview element is missing.");
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(38,1,.1,45);
  // Camera pose is derived from the ACTUAL avatar bounds, never fixed.
  // Full head, hair, shoes and pedestal must remain visible at any viewport.
  camera.fov=35;
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
  let zoom=1,fitDistance=6,fitTarget=new THREE.Vector3(0,1.65,0);
  let prevPinch=0;
  const touches=new Map();
  const createdMaterials=new Set();

  // Reserve room above the head for the title and below the shoes for the
  // rotation/zoom toolbar. The model always fits when the canvas resizes.
  function frameAvatar(){
    if(!model)return;
    orbit.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(orbit);
    if(bounds.isEmpty())return;
    const size=bounds.getSize(new THREE.Vector3());
    fitTarget=bounds.getCenter(new THREE.Vector3());
    const width=Math.max(host.clientWidth,1),height=Math.max(host.clientHeight,1);
    const reserved=height<390?92:112;
    const usableHeight=Math.max(150,height-reserved);
    const vfov=THREE.MathUtils.degToRad(camera.fov);
    const aspect=Math.max(.45,width/height);
    const vertical=(Math.max(size.y,2.7)+.18)/(2*Math.tan(vfov/2));
    const across=Math.max(size.x,size.z,1.5)+.20;
    const horizontal=across/(2*Math.tan(vfov/2)*aspect);
    fitDistance=Math.max(vertical*height/usableHeight,horizontal)*1.12;
    updateCameraPosition();
  }
  function updateCameraPosition(){
    const view=new THREE.Vector3(.29,.13,.95).normalize();
    camera.position.copy(fitTarget).addScaledVector(view,fitDistance*zoom);
    camera.lookAt(fitTarget);
    camera.updateProjectionMatrix();
  }
  function setZoom(next){
    zoom=THREE.MathUtils.clamp(next,.80,3.25);
    updateCameraPosition();
  }
  const swap=(props)=>{
    const firstModel=!model;
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
    // Keep the same camera while changing body dimensions. Re-fitting on
    // every slider event previously normalized away height/build differences.
    if(firstModel)frameAvatar();
    return model;
  };
  const touchDistance=()=>{
    const items=[...touches.values()];
    return items.length>=2?Math.hypot(items[0].x-items[1].x,items[0].y-items[1].y):0;
  };
  const pointerDown=e=>{
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    dragging=touches.size===1;
    lastX=e.clientX;
    prevPinch=touchDistance();
    lastActive=performance.now();
    renderer.domElement.setPointerCapture?.(e.pointerId);
    renderer.domElement.style.cursor=dragging?"grabbing":"zoom-out";
  };
  const pointerMove=e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(touches.size>=2){
      const next=touchDistance();
      if(prevPinch>0&&next>0)setZoom(zoom*prevPinch/next);
      prevPinch=next;
      dragging=false;
    }else if(dragging){
      const dx=e.clientX-lastX;
      lastX=e.clientX;
      targetAngle+=dx*.010;
    }
    lastActive=performance.now();
  };
  const pointerUp=e=>{
    touches.delete(e.pointerId);
    prevPinch=touchDistance();
    dragging=false;lastActive=performance.now();
    renderer.domElement.style.cursor="grab";
    try{renderer.domElement.releasePointerCapture?.(e.pointerId);}catch{}
  };
  const wheel=e=>{
    e.preventDefault();
    setZoom(zoom*Math.exp(e.deltaY*.0011));
    lastActive=performance.now();
  };
  renderer.domElement.addEventListener("pointerdown",pointerDown);
  renderer.domElement.addEventListener("pointermove",pointerMove);
  renderer.domElement.addEventListener("pointerup",pointerUp);
  renderer.domElement.addEventListener("pointercancel",pointerUp);
  renderer.domElement.addEventListener("wheel",wheel,{passive:false});
  let running=true,raf=0,clock=new THREE.Clock(),ro=null;
  function resize(){
    const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.45));
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    frameAvatar();
  }
  if(typeof ResizeObserver!=="undefined"){
    ro=new ResizeObserver(resize);ro.observe(host);
  }else window.addEventListener("resize",resize);
  // The SAME character factory powers option thumbnails. One reusable render
  // target avoids creating a WebGL renderer/context for each visual card.
  const thumbWidth=152,thumbHeight=180;
  const thumbTarget=new THREE.WebGLRenderTarget(thumbWidth,thumbHeight,{
    depthBuffer:true,samples:4
  });
  thumbTarget.texture.colorSpace=THREE.SRGBColorSpace;
  const thumbScene=new THREE.Scene();
  thumbScene.background=new THREE.Color(0xe8ddd5);
  thumbScene.add(new THREE.HemisphereLight(0xfff6ea,0xb9c2bf,2.7));
  const thumbKey=new THREE.DirectionalLight(0xffdfbe,3.3);
  thumbKey.position.set(-3,5,6);thumbScene.add(thumbKey);
  const thumbRim=new THREE.DirectionalLight(0xe9e3ee,1.15);
  thumbRim.position.set(3,2,-3);thumbScene.add(thumbRim);
  const thumbCamera=new THREE.PerspectiveCamera(35,thumbWidth/thumbHeight,.1,30);
  const pixels=new Uint8Array(thumbWidth*thumbHeight*4);
  const thumbCanvas=document.createElement("canvas");
  thumbCanvas.width=thumbWidth;thumbCanvas.height=thumbHeight;
  const thumbCtx=thumbCanvas.getContext("2d",{willReadFrequently:true});
  function thumbnail(props,portrait=false){
    if(!running||!thumbCtx)return "";
    const sample=createAvatar(props);
    thumbScene.add(sample.group);
    sample.update(0,false);
    sample.group.updateMatrixWorld(true);
    const tb=new THREE.Box3().setFromObject(sample.group);
    const center=tb.getCenter(new THREE.Vector3());
    const size=tb.getSize(new THREE.Vector3());
    thumbCamera.fov=portrait?36:38;
    if(portrait){
      // The previous formula centered a portrait relative to the FULL BODY
      // bounds, frequently cutting off the hairline, face, or both (especially
      // for chotis). Instead frame around the true head pivot and reserve
      // vertical space for its highest hair volume and both cheeks.
      const headWorld=sample.head.getWorldPosition(new THREE.Vector3());
      const headScale=sample.head.getWorldScale(new THREE.Vector3());
      const headBox=new THREE.Box3().setFromObject(sample.head);
      center.set(headWorld.x,headWorld.y+.38*headScale.y,headWorld.z);
      const top=Math.max(1,headBox.max.y-center.y);
      const bottom=Math.max(.72,center.y-headWorld.y+.24*headScale.y);
      const visibleHeight=Math.max(1.95,2*Math.max(top,bottom)+.30);
      const verticalDistance=visibleHeight/(2*Math.tan(THREE.MathUtils.degToRad(thumbCamera.fov)/2));
      const horizontalDistance=(Math.max(1.35,headBox.max.x-headBox.min.x)+.30)/
        (2*Math.tan(THREE.MathUtils.degToRad(thumbCamera.fov)/2)*(thumbWidth/thumbHeight));
      const dist=Math.max(verticalDistance,horizontalDistance)*1.12;
      thumbCamera.position.set(center.x+dist*.055,center.y+dist*.025,center.z+dist*.999);
    }else{
      const v=size.y/(2*Math.tan(THREE.MathUtils.degToRad(thumbCamera.fov)/2))*1.37;
      const h=Math.max(size.x,size.z)/(2*Math.tan(THREE.MathUtils.degToRad(thumbCamera.fov)/2)*(thumbWidth/thumbHeight))*1.32;
      const dist=Math.max(v,h);
      thumbCamera.position.set(center.x+dist*.13,center.y+dist*.07,center.z+dist*.99);
    }
    thumbCamera.lookAt(center);
    thumbCamera.updateProjectionMatrix();
    // Save the logical viewport before switching to the thumbnail target.
    // Restoring with canvas.width (physical pixels) was enlarging/cropping
    // the main character preview on high-DPI devices.
    const previous=renderer.getRenderTarget();
    const previousViewport=renderer.getViewport(new THREE.Vector4());
    try{
      renderer.setRenderTarget(thumbTarget);
      renderer.setViewport(0,0,thumbWidth,thumbHeight);
      renderer.render(thumbScene,thumbCamera);
      renderer.readRenderTargetPixels(thumbTarget,0,0,thumbWidth,thumbHeight,pixels);
      const image=thumbCtx.createImageData(thumbWidth,thumbHeight);
      const length=thumbWidth*4;
      for(let y=0;y<thumbHeight;y++){
        const from=(thumbHeight-1-y)*length,to=y*length;
        image.data.set(pixels.subarray(from,from+length),to);
      }
      thumbCtx.putImageData(image,0,0);
      return thumbCanvas.toDataURL("image/webp",.83);
    }finally{
      renderer.setRenderTarget(previous);
      renderer.setViewport(previousViewport);
      thumbScene.remove(sample.group);
      sample.group.traverse(obj=>{
        if(obj.isMesh){
          if(obj.geometry?.type==="TubeGeometry")obj.geometry.dispose();
          const values=Array.isArray(obj.material)?obj.material:[obj.material];
          values.forEach(m=>{if(m&&!m.userData?.sharedVoxelMaterial)m.dispose();});
        }
      });
    }
  }
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
    thumbnail,
    rotate(delta){targetAngle+=delta;lastActive=performance.now();},
    zoom(delta){setZoom(zoom*delta);lastActive=performance.now();},
    fit(){zoom=1;frameAvatar();lastActive=performance.now();},
    dispose(){
      running=false;cancelAnimationFrame(raf);ro?.disconnect();
      window.removeEventListener("resize",resize);
      renderer.domElement.removeEventListener("pointerdown",pointerDown);
      renderer.domElement.removeEventListener("pointermove",pointerMove);
      renderer.domElement.removeEventListener("pointerup",pointerUp);
      renderer.domElement.removeEventListener("pointercancel",pointerUp);
      renderer.domElement.removeEventListener("wheel",wheel);
      touches.clear();
      thumbTarget.dispose();
      renderer.dispose();
      host.replaceChildren();
    }
  };
}
