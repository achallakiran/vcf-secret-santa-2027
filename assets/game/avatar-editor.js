import {SKIN_COLORS,HAIR_COLORS,OUTFIT_COLORS,FOOTWEAR_OPTIONS} from "./palette.js?v=visual-atelier-v3";

/**
 * Accessible thumbnail-based character selection, no user-facing dropdowns.
 * Every option image is rendered by the SAME full-resolution character factory
 * as the player's in-game model (see studio.thumbnail).
 */
export function createVisualAvatarEditor({read,choose,studio}){
  const groups={
    look:[
      {field:"gender",id:"avatar-gender-options",items:[["female","Female"],["male","Male"]],portrait:false},
      {field:"skin",id:"avatar-skin-options",palette:SKIN_COLORS}
    ],
    hair:[
      {field:"hairstyle",id:"avatar-hairstyle-options",items:[[0,"Short"],[1,"Layered"],[2,"Long"],[3,"Ponytail"]],portrait:true},
      {field:"hair",id:"avatar-hair-options",palette:HAIR_COLORS}
    ],
    fashion:[
      {field:"outfit",id:"avatar-outfit-options",items:[
        ["salwar","Salwar suit"],["dress","Dress"],["shirt","Shirt"],
        ["tshirt","T-shirt"],["suit","Suit"],["sweater","Festive"]],portrait:false},
      {field:"bottom",id:"avatar-bottom-options",items:[
        ["jeans","Jeans"],["trousers","Trousers"],["leggings","Leggings"],["palazzo","Palazzo"]],portrait:false},
      {field:"color",id:"avatar-color-options",palette:OUTFIT_COLORS}
    ],
    accessories:[
      {field:"glasses",id:"avatar-glasses-options",items:[[false,"No glasses"],[true,"Spectacles"]],portrait:true}
    ],
    footwear:[
      {field:"footwear",id:"avatar-footwear-options",items:FOOTWEAR_OPTIONS.map(x=>[x,
        ({auto:"Default",sneakers:"Sneakers",formal:"Formal",flats:"Flats",sandals:"Sandals"})[x]])}
    ],
    shape:[]
  };
  let generation=0,frame=0,pending=[],activeTab="look";
  const cache=new Map(),maxCache=140;
  function equal(x,y){return String(x)===String(y);}
  function writeSelected(el,selected){
    el.classList.toggle("selected",selected);
    el.setAttribute("aria-pressed",String(selected));
  }
  function buildSwatches(container,group,config){
    group.palette.forEach((hex,i)=>{
      const btn=document.createElement("button");btn.type="button";
      btn.className="atelier-swatch";
      const css="#"+hex.toString(16).padStart(6,"0");
      btn.style.setProperty("--swatch",css);
      btn.setAttribute("aria-label","Color "+(i+1));
      btn.title="Color "+(i+1);
      writeSelected(btn,equal(config[group.field],i));
      const mark=document.createElement("span");mark.className="atelier-swatch-check";
      mark.textContent="✓";mark.setAttribute("aria-hidden","true");btn.append(mark);
      btn.addEventListener("click",()=>choose(group.field,i));
      container.append(btn);
    });
  }
  function enqueue(job){
    pending.push(job);
    if(!frame)frame=requestAnimationFrame(processOne);
  }
  function processOne(){
    frame=0;
    const widget=studio();
    if(!widget){pending=[];return;}
    const task=pending.shift();
    if(task && task.generation===generation && task.image.isConnected){
      let img=cache.get(task.key);
      if(!img){
        try{img=widget.thumbnail(task.config,task.portrait);
          if(img){
            cache.set(task.key,img);
            if(cache.size>maxCache)cache.delete(cache.keys().next().value);
          }
        }catch(error){console.warn("Thumbnail render skipped:",error);}
      }
      if(img){task.image.src=img;task.image.classList.add("ready");}
    }
    if(pending.length)frame=requestAnimationFrame(processOne);
  }
  function buildCards(container,group,config){
    for(const [value,label] of group.items){
      const btn=document.createElement("button");
      btn.type="button";btn.className="atelier-choice";
      btn.setAttribute("aria-label",label);
      writeSelected(btn,equal(config[group.field],value));
      const art=document.createElement("span");art.className="atelier-choice-art";
      const image=document.createElement("img");
      image.alt="";image.loading="eager";
      art.append(image);
      const sparkle=document.createElement("span");sparkle.className="atelier-thumb-pending";
      sparkle.textContent="✦";sparkle.setAttribute("aria-hidden","true");art.append(sparkle);
      const name=document.createElement("span");name.className="atelier-choice-label";name.textContent=label;
      const checked=document.createElement("span");checked.className="atelier-choice-selected";
      checked.textContent="✓";checked.setAttribute("aria-hidden","true");
      btn.append(art,name,checked);
      btn.addEventListener("click",()=>choose(group.field,value));
      container.append(btn);
      const thumbConfig={...config,[group.field]:value};
      const key=JSON.stringify([thumbConfig,!!group.portrait]);
      if(cache.has(key)){image.src=cache.get(key);image.classList.add("ready");}
      else if(studio())enqueue({image,key,config:thumbConfig,portrait:!!group.portrait,generation});
    }
  }
  function refresh(tab=activeTab){
    activeTab=Object.hasOwn(groups,tab)?tab:"look";
    generation++;
    pending=[];
    if(frame){cancelAnimationFrame(frame);frame=0;}
    const config=read();
    for(const group of groups[activeTab]){
      const container=document.getElementById(group.id);
      if(!container)continue;
      container.replaceChildren();
      if(group.palette)buildSwatches(container,group,config);
      else buildCards(container,group,config);
    }
  }
  return {refresh,dispose(){
    generation++;pending=[];if(frame)cancelAnimationFrame(frame);
  }};
}
