/**
 * Original bells-and-music-box synthesis of the public-domain Jingle Bells
 * melody (James Lord Pierpont, 1857). No recordings, CDN audio or licensing.
 *
 * A looping AudioBuffer avoids timer drift, network dependency and excessive
 * WebAudio node creation. Browsers require a user gesture to unlock audio.
 */
const NOTE={C4:60,D4:62,E4:64,F4:65,G4:67,A4:69,B4:71,
  C5:72,D5:74,E5:76,F5:77,G5:79,A5:81,B5:83,G3:55,C3:48};
const melody=[
  ["E5",1],["E5",1],["E5",2],
  ["E5",1],["E5",1],["E5",2],
  ["E5",1],["G5",1],["C5",1],["D5",1],["E5",4],
  ["F5",1],["F5",1],["F5",1],["F5",1],
  ["F5",1],["E5",1],["E5",1],["E5",1],
  ["E5",1],["D5",1],["D5",1],["E5",1],["D5",2],["G5",2],
  ["E5",1],["E5",1],["E5",2],
  ["E5",1],["E5",1],["E5",2],
  ["E5",1],["G5",1],["C5",1],["D5",1],["E5",4],
  ["F5",1],["F5",1],["F5",1],["F5",1],
  ["F5",1],["E5",1],["E5",1],["E5",1],
  ["G5",1],["G5",1],["F5",1],["D5",1],["C5",4]
];
function noteHz(key){return 440*Math.pow(2,(NOTE[key]-69)/12);}
function buildBellLoop(context){
  const sampleRate=context.sampleRate,beat=.29;
  const duration=melody.reduce((sum,[,b])=>sum+b,0)*beat;
  const total=Math.ceil(duration*sampleRate);
  const audio=context.createBuffer(1,total,sampleRate);
  const data=audio.getChannelData(0);
  let moment=0;
  const instrument=(hz,start,duration,gain=1)=>{
    const first=Math.max(0,Math.floor(start*sampleRate));
    const len=Math.min(total-first,Math.ceil(duration*sampleRate));
    for(let i=0;i<len;i++){
      const t=i/sampleRate,env=(1-Math.exp(-t*125))*Math.exp(-t*4.6);
      const shimmer=Math.sin(2*Math.PI*hz*t)+
        .27*Math.sin(2*Math.PI*hz*2.015*t)+
        .10*Math.sin(2*Math.PI*hz*3.98*t);
      data[first+i]+=.22*gain*env*shimmer;
    }
  };
  melody.forEach(([note,beats],index)=>{
    const length=beats*beat;
    instrument(noteHz(note),moment,Math.min(length*1.07,1.1),.93);
    // Low warm music-box harmony underneath the tune.
    if(index%4===0)instrument(noteHz(["C4","G3","A4","G3"][Math.floor(index/4)%4]),
      moment,beat*1.24,.13);
    moment+=length;
  });
  // Prevent occasional clusters from clipping on phone speakers.
  let peak=0;for(const v of data)peak=Math.max(peak,Math.abs(v));
  if(peak>.88)for(let i=0;i<data.length;i++)data[i]*=.88/peak;
  return audio;
}
export function createChristmasMusic(){
  const STORAGE_KEY="vcf_ss_jingle_muted";
  let muted=false;
  try{muted=localStorage.getItem(STORAGE_KEY)==="1";}catch{}
  let context=null,source=null,gain=null,entered=false;
  function updateGain(){
    if(!gain||!context)return;
    gain.gain.setTargetAtTime((!muted&&entered)? .19 : 0,context.currentTime,.08);
  }
  function unlock(){
    if(!context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return false;
      context=new AudioContext();
      const buffer=buildBellLoop(context);
      gain=context.createGain();
      gain.gain.value=0;
      gain.connect(context.destination);
      source=context.createBufferSource();
      source.buffer=buffer;source.loop=true;
      source.connect(gain);source.start();
    }
    context.resume().catch(()=>{});
    updateGain();
    return true;
  }
  function enter(){entered=true;updateGain();}
  function leave(){entered=false;updateGain();}
  function setMuted(next){
    muted=!!next;
    try{localStorage.setItem(STORAGE_KEY,muted?"1":"0");}catch{}
    unlock();updateGain();return muted;
  }
  function toggle(){return setMuted(!muted);}
  function dispose(){
    entered=false;
    if(source){try{source.stop();}catch{}source.disconnect();source=null;}
    if(context){context.close().catch(()=>{});context=null;}
    gain=null;
  }
  return {unlock,enter,leave,setMuted,toggle,dispose,get muted(){return muted;}};
}
