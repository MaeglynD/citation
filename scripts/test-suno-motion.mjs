import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const url=process.argv[2]??'http://127.0.0.1:5173/'
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
fs.mkdirSync('shots/suno',{recursive:true})
try {
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{
    const AC=window.AudioContext
    window.audioStarts=[]
    window.AudioContext=class extends AC {
      constructor(...args){super(...args);window.testAudioContext=this}
      createBufferSource(){
        const node=super.createBufferSource(),start=node.start.bind(node)
        node.start=(...args)=>{window.audioStarts.push({loop:node.loop,duration:node.buffer?.duration,start:node.loopStart,end:node.loopEnd});return start(...args)}
        return node
      }
    }
  })
  await page.goto(url)
  await page.waitForFunction(()=>window.__qa?.scene && window.__qa.game.getState().all.length>600 && document.querySelector('canvas')?.getAttribute('role')==='application')
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true)
  await page.keyboard.press('s')
  await page.waitForFunction(()=>window.audioStarts.some(a=>a.loop && Math.abs(a.duration-62.96)<.02))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='question')
  await page.keyboard.press('Space')
  await page.waitForTimeout(700)
  for (let i=0;i<4;i++) {
    await page.keyboard.press('ArrowRight')
    const scales=await page.evaluate(async()=>{
      const values=[]
      for(let frame=0;frame<16;frame++){
        await new Promise(requestAnimationFrame)
        values.push(window.__qa.scene.getObjectByName('live-speaker').children[0].scale.toArray())
      }
      return values
    })
    assert.ok(scales.every(s=>s.every(v=>v===1)),'Hover portrait must keep its size')
  }
  assert.equal(await page.evaluate(()=>window.audioStarts.filter(a=>a.loop&&a.duration>30).length),1,'Starting the game preserves the current musical phrase')
  await page.screenshot({path:'shots/suno/play.png'})
  const right=await page.evaluate(()=>window.__qa.game.getState().options.findIndex(o=>o.correct))
  await page.keyboard.press(String(right+1))
  const suspense=await page.evaluate(async i=>{
    const samples=[],start=performance.now()
    while(performance.now()-start<550){
      await new Promise(requestAnimationFrame)
      const {game,scene}=window.__qa
      samples.push({phase:game.getState().phase,x:Array.from({length:4},(_,n)=>scene.getObjectByName('answer-card-'+n)?.position.x),highlight:scene.getObjectByName('answer-suspense-'+i)?.position.x})
    }
    return samples
  },right)
  assert.ok(suspense.every(s=>s.phase==='suspense'),'Waiting cue precedes the reveal')
  assert.ok(new Set(suspense.map(s=>s.x[right])).size>1,'Selected card gently quivers')
  assert.ok(suspense.every(s=>s.x.every((x,i)=>i===right?Math.abs(x)<=1:x===0)),'Only the selected card moves, by at most one pixel')
  const highlights=suspense.map(s=>s.highlight).filter(x=>x!==undefined)
  assert.ok(highlights.length>2 && highlights.at(-1)>highlights[0]+20,'Small highlight travels along the selected card')
  await page.screenshot({path:'shots/suno/answer-suspense.png'})
  await page.waitForFunction(i=>{
    const {game,scene}=window.__qa
    return game.getState().phase==='reveal' && scene.getObjectByName('verdict-confetti')?.count>20 && scene.getObjectByName('answer-card-'+i)?.position.y>2 && scene.getObjectByName('verdict-reaction')?.visible
  },right)
  assert.equal(await page.evaluate(i=>!!window.__qa.scene.getObjectByName('answer-suspense-'+i),right),false,'Waiting highlight leaves on reveal')
  await page.screenshot({path:'shots/suno/correct-reduced-motion.png'})
  assert.equal(await page.evaluate(()=>window.__qa.game.getState().fx.flashUntil),0,'Correct answer must not flash the screen')
  assert.ok(await page.evaluate(()=>window.audioStarts.some(a=>!a.loop&&Math.abs(a.duration-1.368)<.02)),'Edited correct cue actually played')
  await page.waitForTimeout(1600)
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='question')
  await page.keyboard.press('Space')
  const wrong=await page.evaluate(()=>window.__qa.game.getState().options.findIndex(o=>!o.correct))
  await page.keyboard.press(String(wrong+1))
  await page.waitForFunction(i=>{
    const {game,scene}=window.__qa
    return game.getState().phase==='reveal' && Math.abs(scene.getObjectByName('answer-card-'+i)?.position.x)>0 && scene.getObjectByName('verdict-reaction')?.visible
  },wrong)
  await page.screenshot({path:'shots/suno/wrong-reduced-motion.png'})
  const impact=await page.evaluate(()=>window.__qa.game.getState().fx)
  assert.ok(impact.shakeAmp>0 && impact.shakeAmp<=2 && impact.shakeDuration<=.25,'Wrong-answer jolt must stay short and small')
  assert.equal(impact.flashUntil,0,'No white flash')
  assert.ok(await page.evaluate(()=>window.audioStarts.some(a=>!a.loop&&Math.abs(a.duration-1.344)<.02)),'Edited wrong cue actually played')
  await page.waitForTimeout(1600)
  await page.evaluate(()=>{
    const s=window.__qa.game.getState(),deck=s.deck
    window.__qa.game.setState({round:deck.length-1,score:5,results:deck.map((_,i)=>i%2?'right':'wrong'),picks:deck.map(q=>q.answer.name)})
    window.__qa.game.getState().next()
  })
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='summary')
  await page.waitForFunction(()=>window.audioStarts.some(a=>a.loop&&Math.abs(a.duration-36.91)<.02))
  assert.ok(await page.evaluate(()=>window.audioStarts.some(a=>!a.loop&&Math.abs(a.duration-3.135)<.02)),'Edited completion cue actually played')
  await page.waitForTimeout(1000)
  const citation=await page.evaluate(async()=>{
    const {game,scene}=window.__qa,s=game.getState(),q=s.deck[0],texts=[]
    scene.getObjectByName('review-citation').traverse(o=>{if(typeof o.text==='string')texts.push(o.text)})
    const {reviewLayout}=await import('/src/scene/Summary.tsx'),L=reviewLayout(s.view,q,10)
    window.open=(...args)=>{window.overviewOpenedSource=args;return null}
    return {texts,source:q.source,url:q.url,x:innerWidth/2,y:(.5-(L.sourceY-L.sourceH/2)/s.view.h)*innerHeight}
  })
  assert.deepEqual(citation.texts,[citation.source+' ↗'],'Overview displays the citation with a link arrow')
  await page.mouse.click(citation.x,citation.y)
  assert.deepEqual(await page.evaluate(()=>window.overviewOpenedSource),[citation.url,'_blank','noopener,noreferrer'],'Overview citation opens its source like History')
  await page.screenshot({path:'shots/suno/results.png'})
  // Decode the alternate codec too; check actual shipped files, not a test tone.
  const decoded=await page.evaluate(async()=>{
    const manifest=await (await fetch('/audio/manifest.json')).json()
    const pack=manifest.themes.arcade
    const clips=[...Object.values(pack.music),...Object.values(pack.sfx)]
    return Promise.all(clips.map(async clip=>{
      const res=await fetch(clip.sources[1]);if(!res.ok)throw Error('Missing MP3')
      const buffer=await window.testAudioContext.decodeAudioData(await res.arrayBuffer())
      let peak=0
      for(let c=0;c<buffer.numberOfChannels;c++)for(const sample of buffer.getChannelData(c))peak=Math.max(peak,Math.abs(sample))
      return {duration:buffer.duration,peak}
    }))
  })
  assert.equal(decoded.length,6)
  assert.ok(decoded.every(c=>c.peak<.95&&c.duration>1),'Encoded MP3 assets decode without clipping')
  await page.keyboard.press('m')
  assert.equal(await page.evaluate(()=>window.__qa.settings.getState().muted),true)
  assert.deepEqual(errors,[])
  console.log('Suno and motion QA passed: subtle suspense cue, linked overview citation, real cues, both codecs, music continuity, results crossfade, mute, and visible confetti/bounce/wobble with reduced motion enabled.')
} finally {await browser.close()}
