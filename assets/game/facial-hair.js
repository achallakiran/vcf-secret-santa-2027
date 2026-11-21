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
  "beard-goatee":{chin:.88,soul:.50},
  "beard-anchor":{jaw:.34,chin:.93,moustache:.92,pointed:true},
  "beard-balbo":{jaw:.12,chin:.95,moustache:1,separated:true},
  "beard-vandyke":{chin:1.18,soul:.38,moustache:1.08,pointed:true,separated:true},
  "beard-short":{cheeks:.22,jaw:.56,chin:.46},
  "beard-tight":{cheeks:.45,jaw:.70,chin:.43,moustache:.85,sideburns:.55},
  "beard-boxed":{cheeks:.75,jaw:.85,chin:.70,moustache:1,sideburns:.80},
  "beard-full":{cheeks:1,jaw:1,chin:1,moustache:1,sideburns:1},
  "beard-ear":{cheeks:1,jaw:1,chin:1.1,moustache:1,sideburns:1.5},
  "beard-lumberjack":{cheeks:1,jaw:1.07,chin:1.65,moustache:1.10,sideburns:1.15},
  "beard-viking":{cheeks:.96,jaw:1.08,chin:2.12,moustache:1.16,sideburns:1.05,pointed:true},
  "combo-short":{cheeks:.30,jaw:.65,chin:.54,moustache:1},
  "combo-full":{cheeks:1,jaw:1,chin:1.05,moustache:1.08,sideburns:1},
  "combo-ear":{cheeks:1,jaw:1,chin:1.15,moustache:1.08,sideburns:1.50},
  "stubble-light":{stubble:.30},
  "stubble-full":{stubble:.62},
  "stubble-heavy":{stubble:.95}
};
export function facialHairShape(style){
  return {...BASE,...(STYLES[style]||STYLES.none)};
}
