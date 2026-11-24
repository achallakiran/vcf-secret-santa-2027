export const BINDI_STYLES=Object.freeze([
  ["none","No bindi"],["small-round","Small round"],["medium-round","Classic round"],
  ["oval","Long oval"],["diamond","Diamond"],["ornate","Decorative"]
]);
export const BINDI_COLORS=Object.freeze([
  0xb2273d,0x7e1830,0x242128,0x34764f,0x365ba4,0xd9a92e,
  0xf2ece2,0x8b508d
]);

/** Shared, declarative facial-hair vocabulary.
 * Used by both the modeled meshes and fine microvoxels, so the option label,
 * silhouette and saved value always describe the same style. */
export const FACIAL_HAIR_OPTIONS=Object.freeze([
  ["none","Clean shaven"],
  ["moustache-classic","Classic moustache"],
  ["moustache-pencil","Pencil moustache"],
  ["moustache-handlebar","Handlebar moustache"],
  ["soul-patch","Soul patch"],
  ["beard-goatee","Goatee"],
  ["beard-anchor","Anchor beard"],
  ["beard-balbo","Balbo beard"],
  ["beard-vandyke","Van Dyke beard"],
  ["beard-short","Short beard only"],
  ["beard-tight","Tight beard + moustache"],
  ["beard-boxed","Short boxed beard"],
  ["beard-full","Full beard + moustache"],
  ["beard-ear","Full beard to ears"],
  ["beard-lumberjack","Lumberjack beard"],
  ["beard-viking","Viking beard"],
  ["combo-short","Short beard + moustache"],
  ["combo-full","Full beard + moustache"],
  ["combo-ear","Full beard to ears + moustache"],
  ["stubble-light","Light stubble"],
  ["stubble-full","Full-face stubble"],
  ["stubble-heavy","Heavy stubble"]
]);
const BASE={cheeks:0,jaw:0,chin:0,moustache:0,soul:0,sideburns:0,pointed:false,separated:false,stubble:0,handlebar:false};
const STYLES={
  none:{},
  "moustache-classic":{moustache:1},
  "moustache-pencil":{moustache:.60},
  "moustache-handlebar":{moustache:1.22,handlebar:true},
  "soul-patch":{soul:1},
  "beard-goatee":{chin:.45,soul:.40},
  "beard-anchor":{jaw:.28,chin:.48,moustache:.85,pointed:true},
  "beard-balbo":{jaw:.12,chin:.48,moustache:.90,separated:true},
  "beard-vandyke":{chin:.55,soul:.35,moustache:.95,pointed:true,separated:true},
  "beard-short":{cheeks:.20,jaw:.48,chin:.22},
  "beard-tight":{cheeks:.32,jaw:.56,chin:.24,moustache:.80,sideburns:.38},
  "beard-boxed":{cheeks:.48,jaw:.68,chin:.32,moustache:.90,sideburns:.52},
  "beard-full":{cheeks:.75,jaw:.85,chin:.50,moustache:.95,sideburns:.75},
  "beard-ear":{cheeks:.75,jaw:.85,chin:.55,moustache:.95,sideburns:1.1},
  "beard-lumberjack":{cheeks:.90,jaw:1.02,chin:1.35,moustache:1.05,sideburns:1.0},
  "beard-viking":{cheeks:.95,jaw:1.05,chin:1.75,moustache:1.12,sideburns:1.0,pointed:true},
  "combo-short":{cheeks:.25,jaw:.50,chin:.24,moustache:.85},
  "combo-full":{cheeks:.75,jaw:.85,chin:.50,moustache:.95,sideburns:.75},
  "combo-ear":{cheeks:.75,jaw:.85,chin:.55,moustache:.95,sideburns:1.10},
  "stubble-light":{stubble:.30},
  "stubble-full":{stubble:.62},
  "stubble-heavy":{stubble:.95}
};
export function facialHairShape(style){
  return {...BASE,...(STYLES[style]||STYLES.none)};
}
