import { mtof } from '../core'
import { type Theme, type Sfx, send } from './helpers'
import { noir as originalNoir } from './noir'
import { dialogueBlip } from '../dialogue'

/** Quiet, tactile cues: fewer overlapping voices and no synthetic crowd or horn. */
function effects(kind: 'wood' | 'paper' | 'glass'): Sfx {
  const bright = kind === 'glass', paper = kind === 'paper'
  return {
    blip: dialogueBlip,
    typed() {},
    mumble() {},
    hover(s,t) {
      if (bright) s.fm(880,t,.055,{ratio:2,index:.18,indexEnd:0,gain:.035,a:.002,r:.07})
      else s.wood(t,paper ? 640 : 460,{gain:.055})
    },
    select(s,t) {
      s.wood(t,bright ? 1200 : 360,{gain:.12})
      s.fm(bright ? 1320 : 660,t+.025,.11,{ratio:2,index:.2,indexEnd:0,gain:.05,r:.12})
    },
    page(s,t) { s.noise(t,.16,{gain:.085,a:.035,r:.04,filter:{type:'bandpass',freq:1300,to:450,q:.5}}) },
    drumroll(s,t,dur) {
      for(let i=0;i<5;i++) s.wood(t+i*dur/6,320+i*40,{gain:.055+i*.006})
    },
    correct(s,t) {
      ;[62,69,74,77].forEach((n,i) => s.fm(mtof(n),t+i*.075,.22,{ratio:bright ? 3 : 1,index:.5,indexEnd:.06,gain:.12,r:.24,pan:(i-1.5)*.12,verb:.08}))
    },
    wrong(s,t) {
      ;[65,61].forEach((n,i) => s.pluck(mtof(n),t+i*.16,{gain:.28,bright:.32,decay:.42}))
      s.tone(mtof(50),t+.17,.22,{type:'soft',gain:.07,a:.02,r:.13,filter:{freq:900}})
    },
    stamp(s,t) { s.wood(t,185,{gain:.17}); s.noise(t,.035,{gain:.055,filter:{type:'lowpass',freq:650}}) },
    crowd() {},
    fanfare(s,t,ratio) {
      const ns = ratio >= .7 ? [62,65,69,74,77,81] : [62,65,69,74]
      ns.forEach((n,i) => s.fm(mtof(n),t+i*.14,.36,{ratio:2,index:.45,indexEnd:.06,gain:.12,r:.45,pan:(i%3-1)*.15,verb:.12}))
    },
  }
}

const THEATRE_CHORDS = [[50,57,60,65],[50,57,61,65],[43,53,57,62],[45,55,61,64],[46,53,57,62],[43,53,58,62],[40,55,58,62],[45,55,61,64]]
const THEATRE_MELODY = [[74,77,76,69],[72,69,65,-1],[74,72,69,65],[73,-1,69,-1],[77,81,79,77],[74,70,69,-1],[76,74,70,67],[73,76,69,-1]]
export const theatre: Theme = {
  id:'arcade', name:'THEATRE', musicGain:1.4, sfxGain:1,
  song:{bpm:104,bars:16,bar(s,b,t,step,dest){
    const room=send(dest,'chamber',()=>s.reverbBus(dest,1.2,3,.16))
    const chord=THEATRE_CHORDS[b%8], melody=THEATRE_MELODY[b%8]
    // A plucked bass, gently swung brushes, and dry pizzicato answering the melody.
    for(let k=0;k<4;k++) {
      const at=t+k*4*step, root=chord[0]-12+(k===2 ? 7 : 0)
      s.pluck(mtof(root),at,{gain:.65,bright:.24,decay:.65,dur:step*3.7,dest})
      s.tone(mtof(root),at,step*3,{type:'sine',gain:.07,a:.006,r:.08,dest})
      s.noise(at+step*2.5,.07,{gain:.025,filter:{type:'bandpass',freq:3200,q:.5},pan:.22,dest:room})
      if(k%2) s.noise(at,.1,{gain:.04,filter:{type:'bandpass',freq:1800,q:.7},pan:-.16,dest:room})
    }
    for(const j of [2.5,10.5]) chord.slice(1).forEach((n,i)=>s.pluck(mtof(n),t+j*step+i*.008,{gain:.18,bright:.38,decay:.3,dest:room,pan:-.25+i*.16}))
    if(b%4!==3 || b>7) melody.forEach((n,i)=>{
      if(n<0) return
      const at=t+(i*4+(i%2 ? .5 : 0))*step
      if(b<8) s.fm(mtof(n),at,step*2.7,{ratio:1,index:.8,indexEnd:.1,gain:.09,d: .22,s:.15,r:.16,dest:room,pan:.22})
      else s.tone(mtof(n),at,step*2.8,{type:'reed',gain:.035,a:.024,d:.12,s:.5,r:.09,filter:{freq:2000},vib:{rate:4,cents:5},dest:room,pan:.1})
    })
    if(b===7||b===15) [69,73,76].forEach((n,i)=>s.fm(mtof(n),t+(10+i*2)*step,.18,{ratio:2,index:.5,indexEnd:.03,gain:.09,r:.18,dest:room}))
  }}, sfx:effects('wood'),
}

const MUSEUM_CHORDS = [[45,52,59,60],[48,55,59,64],[41,53,57,64],[43,55,59,62],[45,52,60,64],[50,57,60,65],[41,53,59,64],[40,52,56,62]]
export const museum: Theme = {
  id:'haunted',name:'MUSEUM',musicGain:1.8,sfxGain:1,
  song:{bpm:92,bars:16,steps:12,bar(s,b,t,step,dest){
    const room=send(dest,'gallery',()=>s.reverbBus(dest,2.2,3,.23))
    const chord=MUSEUM_CHORDS[Math.floor(b/2)%8]
    s.pluck(mtof(chord[0]-12),t,{gain:.75,bright:.18,decay:1.3,dest})
    s.tone(mtof(chord[0]),t,step*10,{type:'soft',gain:.055,a:.18,d:.5,s:.7,r:.25,filter:{freq:700},dest:room})
    for(let i=0;i<4;i++) {
      const n=chord[1+(i+b)%3]+(b%4===3 ? 0 : 12)
      s.fm(mtof(n),t+i*3*step,.2,{ratio:3,index:.35,indexEnd:.02,gain:i===0 ? .11 : .08,a:.004,d:.13,s:.1,r:.35,pan:(i-1.5)*.22,dest:room})
    }
    if(b%2===1) chord.slice(1).forEach((n,i)=>s.pluck(mtof(n),t+step*6+i*.014,{gain:.15,bright:.25,decay:.7,dest:room,pan:-.25}))
    if(b>=8 && b%2===0) s.tone(mtof(chord[2]),t+step*3,step*7,{type:'reed',gain:.022,a:.09,d:.2,s:.6,r:.2,filter:{freq:1300},dest:room,pan:.2})
  }},sfx:effects('glass'),
}
export const noir: Theme = { ...originalNoir, musicGain:.6, sfxGain:1, sfx:effects('paper') }
