import {SKIN_COLORS,HAIR_COLORS,OUTFIT_COLORS,FOOTWEAR_OPTIONS} from "./palette.js?v=custom-v1";

/** One 3D avatar factory for full model and style thumbnails.
 * Face accessories use isolated vector silhouettes, not full portrait thumbnails.
 */
export function createVisualAvatarEditor({read,choose,studio}){
  const hairstyles=[
    "Short classic","Layered medium","Long classic","Ponytail",
    "Short · left part","Short · right part","Short · middle part",
    "Medium · left part","Medium · right part","Medium · middle part",
    "Long · left part","Long · right part","Long · middle part",
    "Low fade","Textured quiff","Undercut","Spiky","Curly top","Slick back","Crew cut",
    "Bald / no hair","Long single choti","Extra-long choti","Double chotis"
  ];
  const groups={
    look:[
      {field:"gender",id:"avatar-gender-options",items:[["female","Female"],["male","Male"]]},
      {field:"skin",id:"avatar-skin-options",palette:SKIN_COLORS}
    ],
    hair:[
      {field:"hairstyle",id:"avatar-hairstyle-options",items:hairstyles.map((s,i)=>[i,s]),portrait:true},
      {field:"hair",id:"avatar-hair-options",palette:HAIR_COLORS},
      {field:"facialHair",id:"avatar-facialHair-options",items:[
        ["none","Clean shaven"],["stubble-light","Light stubble"],["stubble-full","Full face stubble"],
        ["stubble-heavy","Heavy stubble"],["beard-short","Short beard only"],
        ["beard-full","Full beard only"],["beard-ear","Full beard to ears"],
        ["moustache-pencil","Thin moustache"],["moustache-handlebar","Handlebar moustache"],
        ["combo-short","Short beard + moustache"],["combo-full","Full beard + moustache"],
        ["combo-ear","Full beard to ears + moustache"]],iconOnly:true}
    ],
    fashion:[
      {field:"outfit",id:"avatar-outfit-options",items:[
        ["salwar","Salwar suit"],["dress","Dress"],["shirt","Shirt"],
        ["tshirt","T-shirt"],["suit","Suit"],["sweater","Festive"],
        ["jacket","Denim jacket"],["bomber","Bomber jacket"],["blazer","Casual blazer"]]},
      {field:"bottom",id:"avatar-bottom-options",items:[
        ["jeans","Jeans"],["trousers","Trousers"],["leggings","Leggings"],["palazzo","Palazzo"]]},
      {field:"color",id:"avatar-color-options",palette:OUTFIT_COLORS},
      {field:"bottomColor",id:"avatar-bottomColor-options",palette:OUTFIT_COLORS,allowAuto:true}
    ],
    accessories:[
      {field:"glassesStyle",id:"avatar-glassesStyle-options",items:[
        ["none","No spectacles"],["round","Round"],["rectangle","Rectangle"],
        ["square","Square"],["aviator","Aviator"],["cat-eye","Cat-eye"]],iconOnly:true},
      {field:"glassesColor",id:"avatar-glassesColor-options",palette:OUTFIT_COLORS}
    ],
    footwear:[
      {field:"footwear",id:"avatar-footwear-options",items:FOOTWEAR_OPTIONS.map(x=>[x,
        ({auto:"Default",sneakers:"Sneakers",formal:"Formal",flats:"Flats",sandals:"Sandals"})[x]])},
      {field:"shoeColor",id:"avatar-shoeColor-options",palette:OUTFIT_COLORS,allowAuto:true}
    ],
    shape:[]
  };
  const cache=new Map(),maxCache=170;
  let pending=[],generation=0,frame=0,activeTab="look";
  const equal=(a,b)=>String(a)===String(b);
  function select(btn,on){btn.classList.toggle("selected",on);btn.setAttribute("aria-pressed",String(on));}
  function iconMarkup(field,value,config){
    const fc=OUTFIT_COLORS[config.glassesColor]??OUTFIT_COLORS[0];
    const hc=HAIR_COLORS[config.hair]??HAIR_COLORS[0];
    const ink="#"+(field==="glassesStyle"?fc:hc).toString(16).padStart(6,"0");
    const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 76"><rect width="120" height="76" rx="12" fill="#fff4eb"/>';
    if(value==="none")return start+'<circle cx="60" cy="38" r="19" fill="none" stroke="#ad8295" stroke-width="4"/><path d="M46 52 74 24" stroke="#ad8295" stroke-width="4"/></svg>';
    if(field==="glassesStyle"){
      let lenses="";
      for(const x of [17,69]){
        if(value==="round")lenses+='<circle cx="'+(x+17)+'" cy="37" r="16"/>';
        else if(value==="aviator")lenses+='<path d="M'+x+' 23 h34 v14 l-12 17 h-10 l-12-17 z"/>';
        else if(value==="cat-eye")lenses+='<path d="M'+x+' 22 l8 5 h26 v13 q-2 15-17 15 q-17-1-17-19 z"/>';
        else lenses+='<rect x="'+x+'" y="'+(value==="square"?19:25)+'" width="34" height="'+(value==="square"?34:24)+'" rx="'+(value==="square"?4:8)+'"/>';
      }
      return start+'<g stroke="'+ink+'" stroke-width="5" fill="none" stroke-linejoin="round">'+lenses+
        '<path d="M51 34 Q60 29 69 34 M17 32 H6 M103 32 H114"/></g></svg>';
    }
    let face="";
    const beard=value.startsWith("beard")||value.startsWith("combo");
    const stubble=value.startsWith("stubble");
    const moustache=value.startsWith("moustache")||value.startsWith("combo");
    if(beard){
      const full=value==="beard-full"||value==="combo-full"||value.endsWith("-ear");
      const ear=value.endsWith("-ear");
      face='<path d="M'+(ear?'13':'25')+' '+(ear?'12':'22')+' Q17 38 31 51 L43 '+(full?'67':'58')+' Q60 '+(full?'77':'65')+' 77 '+(full?'67':'58')+' L89 51 Q103 38 '+(ear?'107 12':'95 22')+' L83 44 Q60 56 37 44 Z" fill="'+ink+'"/>';
    }
    if(stubble){
      const thick=value==="stubble-heavy",dense=value!=="stubble-light";
      face+='<path d="M23 24 Q16 42 33 57 Q60 71 87 57 Q104 42 97 24 L85 44 Q60 58 35 44 Z" fill="'+ink+'" opacity="'+(thick?.75:dense?.49:.26)+'"/>';
      for(let i=0;i<(thick?44:dense?28:16);i++){
        const x=25+(i*17%70),y=30+(i*29%27);
        face+='<circle cx="'+x+'" cy="'+y+'" r="'+(thick?1.3:.9)+'" fill="'+ink+'" opacity=".65"/>';
      }
    }
    if(moustache){
      face+='<path d="M60 32 Q49 17 28 28 Q35 45 53 39 L60 34 Q67 45 85 39 Q92 30 94 '+(value==="moustache-handlebar"?'18':'28')+' Q72 18 60 32 Z" fill="'+ink+'"/>';
      if(value==="moustache-handlebar")face+='<path d="M28 28 Q12 24 15 12 M94 28 Q108 25 105 12" fill="none" stroke="'+ink+'" stroke-width="5" stroke-linecap="round"/>';
    }
    return start+face+'</svg>';
  }
  function swatches(parent,group,config){
    const values=group.allowAuto?[-1,...group.palette.map((_,i)=>i)]:group.palette.map((_,i)=>i);
    for(const v of values){
      const b=document.createElement("button");b.type="button";b.className="atelier-swatch";
      b.style.setProperty("--swatch",v<0?"#c9b7aa":"#"+group.palette[v].toString(16).padStart(6,"0"));
      b.setAttribute("aria-label",v<0?"Use default color":"Color "+(v+1));b.title=b.getAttribute("aria-label");
      if(v<0){b.classList.add("atelier-auto-color");b.textContent="A";}
      select(b,equal(config[group.field],v));
      const mark=document.createElement("span");mark.className="atelier-swatch-check";mark.textContent="✓";mark.setAttribute("aria-hidden","true");
      b.append(mark);b.addEventListener("click",()=>choose(group.field,v));parent.append(b);
    }
  }
  function enqueue(job){pending.push(job);if(!frame)frame=requestAnimationFrame(processOne);}
  function processOne(){
    frame=0;const widget=studio();if(!widget){pending=[];return;}
    const task=pending.shift();
    if(task&&task.generation===generation&&task.image.isConnected){
      let url=cache.get(task.key);
      if(!url){try{url=widget.thumbnail(task.config,task.portrait);if(url){cache.set(task.key,url);if(cache.size>maxCache)cache.delete(cache.keys().next().value);}}catch(e){console.warn("Avatar thumbnail unavailable",e);}}
      if(url){task.image.src=url;task.image.classList.add("ready");}
    }
    if(pending.length)frame=requestAnimationFrame(processOne);
  }
  function cards(parent,group,config){
    for(const [value,label] of group.items){
      const b=document.createElement("button");b.type="button";b.className="atelier-choice";
      b.setAttribute("aria-label",label);select(b,equal(config[group.field],value));
      const art=document.createElement("span");art.className="atelier-choice-art";
      const img=document.createElement("img");img.alt="";img.loading="eager";art.append(img);
      const loading=document.createElement("span");loading.className="atelier-thumb-pending";
      loading.textContent="✦";loading.setAttribute("aria-hidden","true");art.append(loading);
      const name=document.createElement("span");name.className="atelier-choice-label";name.textContent=label;
      const tick=document.createElement("span");tick.className="atelier-choice-selected";tick.textContent="✓";
      tick.setAttribute("aria-hidden","true");b.append(art,name,tick);
      b.addEventListener("click",()=>choose(group.field,value));parent.append(b);
      if(group.iconOnly){
        b.classList.add("atelier-accessory-only");
        img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(iconMarkup(group.field,value,config));
        img.classList.add("ready");continue;
      }
      const sample={...config,[group.field]:value},key=JSON.stringify([sample,!!group.portrait]);
      if(cache.has(key)){img.src=cache.get(key);img.classList.add("ready");}
      else if(studio())enqueue({image:img,key,config:sample,portrait:!!group.portrait,generation});
    }
  }
  function refresh(tab=activeTab){
    activeTab=Object.hasOwn(groups,tab)?tab:"look";generation++;pending=[];
    if(frame){cancelAnimationFrame(frame);frame=0;}
    const config=read();
    for(const group of groups[activeTab]){
      const container=document.getElementById(group.id);if(!container)continue;
      container.replaceChildren();group.palette?swatches(container,group,config):cards(container,group,config);
    }
  }
  return {refresh,dispose(){generation++;pending=[];if(frame)cancelAnimationFrame(frame);}};
}
