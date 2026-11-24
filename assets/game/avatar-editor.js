import {SKIN_COLORS,HAIR_COLORS,OUTFIT_COLORS,FOOTWEAR_OPTIONS} from "./palette.js?v=custom-v1";
import {FACIAL_HAIR_OPTIONS,BINDI_STYLES,BINDI_COLORS,facialHairShape} from "./facial-hair.js?v=face-refine-v5";

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
      {field:"gender",id:"avatar-gender-options",items:[["female","Female"],["male","Male"]],portrait:true},
      {field:"skin",id:"avatar-skin-options",palette:SKIN_COLORS}
    ],
    hair:[
      {field:"hairstyle",id:"avatar-hairstyle-options",items:hairstyles.map((s,i)=>[i,s]),portrait:true},
      {field:"hair",id:"avatar-hair-options",palette:HAIR_COLORS},
      {field:"facialHair",id:"avatar-facialHair-options",items:FACIAL_HAIR_OPTIONS,iconOnly:true}
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
      {field:"glassesColor",id:"avatar-glassesColor-options",palette:OUTFIT_COLORS},
      {field:"bindiStyle",id:"avatar-bindiStyle-options",items:BINDI_STYLES,iconOnly:true},
      {field:"bindiColor",id:"avatar-bindiColor-options",palette:BINDI_COLORS}
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
    const bc=BINDI_COLORS[config.bindiColor]??BINDI_COLORS[0];
    const hex=v=>"#"+v.toString(16).padStart(6,"0");
    const ink=hex(field==="glassesStyle"?fc:field==="bindiStyle"?bc:hc);
    const start='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 76"><rect width="120" height="76" rx="12" fill="#fff4eb"/>';
    if(value==="none")return start+'<circle cx="60" cy="37" r="19" fill="none" stroke="#ad8295" stroke-width="4"/><path d="M46 51 74 23" stroke="#ad8295" stroke-width="4"/></svg>';
    if(field==="bindiStyle"){
      let art="";
      if(value==="small-round")art='<circle cx="60" cy="38" r="8"/>';
      if(value==="medium-round")art='<circle cx="60" cy="38" r="14"/>';
      if(value==="oval")art='<ellipse cx="60" cy="38" rx="10" ry="21"/>';
      if(value==="diamond")art='<rect x="47" y="25" width="26" height="26" transform="rotate(45 60 38)" rx="2"/>';
      if(value==="ornate")art='<circle cx="60" cy="38" r="12"/><circle cx="32" cy="38" r="5"/><circle cx="88" cy="38" r="5"/><circle cx="60" cy="14" r="4"/>';
      return start+'<g fill="'+ink+'">'+art+'</g></svg>';
    }
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
    const f=facialHairShape(value);
    let art="";
    if(f.sideburns){
      const y=8+10*Math.max(0,1-f.sideburns);
      art+='<path d="M16 '+y+' Q10 42 25 54 L34 42 Q23 27 26 '+y+' Z M104 '+y+' Q110 42 95 54 L86 42 Q97 27 94 '+y+' Z"/>';
    }
    if(f.cheeks){
      const depth=10+12*f.cheeks;
      art+='<path d="M24 22 L36 31 L44 '+(42+depth*.32)+' L32 '+(55+depth*.35)+' Q14 47 24 22 Z M96 22 L84 31 L76 '+(42+depth*.32)+' L88 '+(55+depth*.35)+' Q106 47 96 22 Z"/>';
    }
    if(f.jaw){
      art+='<path d="M29 49 Q60 '+(63+f.jaw*6)+' 91 49 L84 '+(49-f.jaw*5)+' Q60 '+(59+f.jaw*5)+' 36 '+(49-f.jaw*5)+' Z"/>';
    }
    if(f.chin){
      const extra=f.chin*17;
      const width=f.pointed?13:19;
      art+='<path d="M'+(60-width)+' 48 Q60 52 '+(60+width)+' 48 L'+(60+(f.pointed?4:width*.65))+' '+(51+extra)+' Q60 '+(61+extra)+' '+(60-(f.pointed?4:width*.65))+' '+(51+extra)+' Z"/>';
    }
    if(f.soul)art+='<path d="M54 39 L66 39 L63 51 L57 51 Z"/>';
    if(f.moustache){
      art+='<path d="M60 34 Q49 24 28 31 Q36 44 53 40 L60 36 Q67 44 84 40 Q94 31 92 '+(f.handlebar?23:31)+' Q71 24 60 34 Z"/>';
      if(f.handlebar)art+='<path d="M29 32 Q13 27 16 14 M91 32 Q107 27 104 14" stroke="'+ink+'" stroke-width="5" fill="none"/>';
    }
    if(f.stubble){
      art+='<path d="M24 25 Q20 44 36 53 Q60 68 84 53 Q100 44 96 25 L85 37 Q60 60 35 37 Z" opacity="'+(.28+f.stubble*.38)+'"/>';
      for(let j=0;j<Math.round(f.stubble*34);j++)art+='<circle cx="'+(27+(j*17)%67)+'" cy="'+(36+(j*13)%20)+'" r="1.0"/>';
    }
    return start+'<g fill="'+ink+'">'+art+'</g></svg>';
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
    const facialHairSection=document.getElementById("avatar-facialHair-section");
    if(facialHairSection)facialHairSection.classList.toggle("hidden",config.gender!=="male");
    for(const group of groups[activeTab]){
      if(group.field==="facialHair"&&config.gender!=="male")continue;
      const container=document.getElementById(group.id);if(!container)continue;
      container.replaceChildren();group.palette?swatches(container,group,config):cards(container,group,config);
    }
  }
  return {refresh,dispose(){generation++;pending=[];if(frame)cancelAnimationFrame(frame);}};
}
