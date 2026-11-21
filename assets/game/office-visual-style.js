/**
 * VCF Christmas Office — visual art direction, Phase 1.
 *
 * Deterministic (seatIndex only), purely presentational and collider-free.
 * All accessories live on the workstation or on existing architectural walls.
 * None duplicates the nine physical objects referenced by Secret Santa clues.
 *
 * Keep the actual clue objects in office.js/decorateClueDesk and the
 * workstation positions in the participant's persistent office_seat_index.
 */
export const OFFICE_DESK_THEMES=Object.freeze([
  Object.freeze({name:"Evergreen",top:"maple",divider:"dividerSage",trim:0xb08b6b,
    ink:0x3b8269,accent:0xe0b96f,mat:0x547868,pattern:0}),
  Object.freeze({name:"Berry",top:"deskAsh",divider:"dividerRose",trim:0xba8b78,
    ink:0xb16e78,accent:0xf0d5a6,mat:0x986a75,pattern:1}),
  Object.freeze({name:"Winter Blue",top:"deskAsh",divider:"dividerSlate",trim:0x91a4b4,
    ink:0x668ca1,accent:0xffdcb4,mat:0x6a879a,pattern:2}),
  Object.freeze({name:"Walnut",top:"deskWalnut",divider:"dividerSand",trim:0xb99b75,
    ink:0x96704e,accent:0xe2c390,mat:0x8b7a6b,pattern:3}),
  Object.freeze({name:"Nordic",top:"maple",divider:"dividerSand",trim:0xc5ab8a,
    ink:0x769889,accent:0xf2ddbc,mat:0x91a9a0,pattern:4}),
  Object.freeze({name:"Holiday Red",top:"deskWalnut",divider:"dividerRose",trim:0xd8ad81,
    ink:0xb75567,accent:0xf1d38e,mat:0xc68c87,pattern:5})
]);

export function deskThemeForSeat(seatIndex){
  return OFFICE_DESK_THEMES[Math.abs(Math.trunc(seatIndex))%OFFICE_DESK_THEMES.length];
}

/**
 * Add distinct, readable desk dressing without changing gameplay geometry.
 * Desk surface is y=.76; both end partition edges are at local z=±1.69.
 * Real clue props occupy the far corner z=1.29, x=chairSide*.34. We
 * reserve that corner completely and avoid objects that resemble clue props.
 */
export function dressWorkstation(group,settings,kit){
  const {seatIndex,chairSide=1,finish}=settings;
  const {block,softBlock,ball,mat}=kit;
  const theme=deskThemeForSeat(seatIndex);
  const ink=mat(theme.ink,{roughness:.65});
  const gold=mat(theme.accent,{roughness:.48,metalness:.20});
  const left=chairSide;

  // A large leather/felt desk mat ties two monitors and the keyboard together
  // from the high, wide camera. No collider and no extra point light.
  softBlock(group,left*.210,.804,-.275,.44,.016,1.02,theme.mat,.065,false);
  block(group,left*.211,.818,-.275,.39,.004,.94,mat(theme.ink,{roughness:.91}),false);
  // Fine inlaid rails are easy to read from above even on a phone.
  for(const edge of [-1,1]){
    block(group,left*.407,.806,-.275+edge*.47,.015,.006,.076,gold,false);
  }

  // Personal wall panel: an office mood, not a hint. It lives on the inner
  // face of the long rear partition and stays below the partition cap.
  softBlock(group,-left*.441,1.160,-.68,.034,.36,.70,
    finish?.cabinet||0xf6e9de,.060,false);
  block(group,-left*.421,1.169,-.68,.012,.285,.58,ink,false);

  // Six different graphics produce distinct silhouettes and visual rhythm.
  // They deliberately avoid tiny trees, gifts, cups, fruit or live plants,
  // so the real clue props remain recognizable as intentional features.
  if(theme.pattern===0){
    for(let j=0;j<5;j++)
      block(group,-left*.405,1.065+j*.044,-.89+j*.105,
        .014,.015,.10,j%2?theme.accent:0xdce9d6,false);
  }else if(theme.pattern===1){
    for(const z of [-.88,-.67,-.46]){
      const bead=ball(group,-left*.400,1.20,z,.056,jewelMaterial(mat,theme.accent));
      bead.scale.set(.34,1.1,.83);bead.castShadow=false;
    }
  }else if(theme.pattern===2){
    for(let j=0;j<4;j++)
      block(group,-left*.408,1.073+j*.064,-.895+j*.12,
        .016,.025,.11,j%2?0xd2e4e7:0xe8bb9e,false);
  }else if(theme.pattern===3){
    for(let j=0;j<3;j++){
      const z=-.86+j*.18;
      block(group,-left*.403,1.128,z,.018,.19,.07,0xf1ddbc,false);
      block(group,-left*.397,1.19,z,.012,.044,.10,theme.accent,false);
    }
  }else if(theme.pattern===4){
    for(const z of [-.85,-.60,-.36]){
      const stripe=block(group,-left*.408,1.16,z,.015,.23,.055,0xe6efe4,false);
      stripe.rotation.x=z*.16;
    }
  }else{
    for(let j=0;j<4;j++){
      const z=-.95+j*.18;
      block(group,-left*.407,1.136,z,.014,.25,.043,j%2?0xffe7cb:0xf5c37d,false);
    }
  }

  // A small stationery holder and a flat notepad are non-clue objects.
  // They occupy the opposite end of the long desk (z<0), leaving coffee,
  // fruit, ornaments and the Christmas mini-tree corner untouched.
  softBlock(group,left*.26,.824,-1.19,.30,.026,.23,
    theme.ink,.055,false);
  block(group,left*.26,.841,-1.19,.236,.010,.174,0xfbf3e8,false);
  block(group,left*.26,.850,-1.14,.022,.006,.16,gold,false);
  // Colored vertical organizer against the divider; five unique palettes,
  // but with one consistent contemporary furniture language.
  const organizer=softBlock(group,-left*.288,.898,-1.28,.15,.22,.20,theme.ink,.08,false);
  organizer.castShadow=false;
  for(let i=0;i<3;i++){
    const tab=block(group,-left*.278,1.013,-1.345+i*.063,
      .105,.043,.028,i%2?theme.accent:0xf2e9df,false);
    tab.castShadow=false;
  }
  // Every second workstation has a subtle festive woven bunting anchored
  // to the top of the REAR screen, never hanging into the aisle.
  if(seatIndex%2===0){
    for(let i=0;i<6;i++){
      const z=-1.22+i*.47;
      const pennant=softBlock(group,-left*.457,1.417,z,.025,.12,.16,
        i%2?theme.accent:theme.ink,.035,false);
      pennant.rotation.x=i%2?.16:-.16;
    }
  }else{
    for(let i=0;i<5;i++){
      const z=-1.18+i*.52;
      const tiny=ball(group,-left*.451,1.426,z,.036,
        mat(i%2?0xffdfaa:0xf2afa0,{emissive:i%2?0x9a6931:0x9c4852}));
      tiny.castShadow=false;
    }
  }
  group.userData.deskTheme=theme.name;
}

function jewelMaterial(mat,hex){return mat(hex,{metalness:.24,roughness:.29});}

/**
 * An inviting carpeted "walk to the celebration" axis, more material rhythm
 * along the east wall and a warm arrival-zone inlay. All geometry lies flush
 * on the floor or against the existing wall: zero new navigation blockers.
 * No overhead bars or extra shadow-casting lights.
 */
export function dressOfficeArchitecture(root,config,kit){
  const {left,right,front,partyStart,bays,rowZ,viewWalls}=config;
  const {block,softBlock,ball,mat}=kit;
  const start=front+.60,end=partyStart-.95;
  const length=end-start,mid=(start+end)/2;
  if(length>0){
    // Lightweight carpet path, narrow enough to preserve the main floor
    // material around it. No collider and no opaque high object.
    const rug=mat(0xd5b9ab,{roughness:.95});
    const border=mat(0xf3e1ba,{roughness:.70,metalness:.11});
    block(root,3.67,.020,mid,2.22,.010,length,rug,false);
    for(const side of [-1,1]){
      block(root,3.67+side*1.04,.029,mid,.035,.010,length-.14,border,false);
      block(root,3.67+side*.91,.029,mid,.014,.006,length-.14,0xb77d79,false);
    }
    const num=Math.max(2,Math.ceil(length/5.9));
    for(let n=0;n<num;n++){
      const z=start+(n+.5)*length/num;
      // Simple woven gold snowflake inlaid into the walking surface.
      for(let spoke=0;spoke<4;spoke++){
        const line=block(root,3.67,.032,z,.032,.009,.44,
          spoke%2?0xefdebf:0xe2c49c,false);
        line.rotation.y=spoke*Math.PI/4;
      }
      const bead=ball(root,3.67,.045,z,.050,0xf9ecd0);
      bead.scale.y=.17;bead.castShadow=false;
    }
  }

  // Wall pilasters and rails produce shadowless architectural depth.
  // Attach to the cutaway wall group, never the main scene; a cutaway
  // continues to hide the complete wall instead of leaving floating bars.
  const east=viewWalls.east;
  for(let i=0;i<bays;i++){
    const z=rowZ(i),neutral=(i%4===0?0xceb7a4:0xe6d7c9);
    block(east,right-.024,1.95,z+2.68,.052,3.16,.085,neutral,false);
    block(east,right-.055,2.85,z+2.68,.022,.10,.38,
      i%2?0xc29e81:0x9eaa9d,false);
    // A faint lower panel avoids long, empty stretches of cream wall.
    softBlock(east,right-.030,.86,z+.45,.052,.85,2.24,
      i%3===0?0xf0e5d8:0xeae0d6,.042,false);
    block(east,right-.059,1.29,z+.45,.024,.028,2.20,0xcbac8c,false);
  }
  // North window framing, with subtle layered warm-bronze reveal trim.
  const north=viewWalls.north;
  for(let j=0;j<6;j++){
    const x=-7.93+j*1.76;
    block(north,x,2.24,front+.018,.06,2.82,.044,
      j%2?0x998f92:0xaa9c91,false);
  }
  block(north,-2.70,3.68,front+.035,10.7,.060,.090,0xc8aa87,false);
  // Fine material transition where the main aisle reaches the stage.
  const arrival=softBlock(root,3.70,.026,partyStart-1.10,2.5,.015,1.05,
    0xe2c09d,.12,false);
  arrival.castShadow=false;
  for(const sign of [-1,1])block(root,3.70+sign*1.17,.038,partyStart-1.10,
    .032,.010,.96,0xf6e2ac,false);
}
