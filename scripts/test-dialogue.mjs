import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const url=process.argv[2]??'http://127.0.0.1:5173/'
const browser=await chromium.launch({args:['--autoplay-policy=document-user-activation-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
try {
  const page=await browser.newPage()
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{
    const AC=window.AudioContext
    window.speechStarts=[]
    window.AudioContext=class extends AC {
      constructor(...args){super(...args);window.testAudioContext=this}
      createOscillator(){
        const node=super.createOscillator(),start=node.start.bind(node)
        node.start=(...args)=>{window.speechStarts.push(this.currentTime);return start(...args)}
        return node
      }
    }
  })
  await page.goto(url)
  // Playwright evaluate grants user activation. Use CDP without it for the
  // initial hover so this actually exercises the browser's autoplay policy.
  const cdp=await page.context().newCDPSession(page)
  const initial=await cdp.send('Runtime.evaluate',{
    expression:"(async()=>{const {audio}=await import('/src/audio/engine.ts');for(let i=0;i<8;i++)audio.hover()})()",
    awaitPromise:true,userGesture:false,
  })
  assert.equal(initial.exceptionDetails,undefined)
  assert.equal(await page.evaluate(()=>window.testAudioContext.state),'suspended')
  assert.equal(await page.evaluate(()=>window.speechStarts.length),0,'Locked hover sounds must not accumulate')
  await page.waitForFunction(()=>document.querySelector('canvas')?.getAttribute('role')==='application')
  await page.mouse.click(5,5)
  await page.waitForFunction(()=>window.testAudioContext.state==='running')
  await page.waitForTimeout(1200)
  assert.equal(await page.evaluate(()=>window.speechStarts.length),0,'Unlock must not unleash stale hover sounds')
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='question').catch(async e=>{
    console.log('Dialogue startup diagnostic',await page.evaluate(()=>({phase:window.__qa.game.getState().phase,screen:window.__qa.game.getState().screen,all:window.__qa.game.getState().all.length,settings:window.__qa.settings.getState().open,active:document.activeElement?.tagName})),errors)
    throw e
  })
  await page.waitForFunction(()=>window.speechStarts.length>=6).catch(async e=>{
    console.log('Dialogue playback diagnostic',await page.evaluate(()=>({phase:window.__qa.game.getState().phase,typed:window.__qa.game.getState().typedDone,length:window.__qa.game.getState().deck[0].quote.length,starts:window.speechStarts,audio:window.testAudioContext.state,hidden:document.hidden,settings:window.__qa.settings.getState()})),errors)
    throw e
  })
  await page.keyboard.press('Space')
  await page.waitForTimeout(100)
  const afterSkip=await page.evaluate(()=>window.speechStarts.length)
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(()=>window.speechStarts.length),afterSkip,'Skipping text must stop new syllables immediately')

  const render=await page.evaluate(async()=>{
    const {Synth}=await import('/src/audio/core.ts')
    const {dialogueBlip}=await import('/src/audio/dialogue.ts')
    const {voiceFor}=await import('/src/audio/engine.ts')
    const rate=22050,ctx=new OfflineAudioContext(1,rate*7,rate),s=new Synth(ctx,ctx.destination)
    s.master.gain.value=.48
    const phrase='I never said that.'
    for(let voice=0;voice<4;voice++)for(let i=0;i<phrase.length;i++)dialogueBlip(s,.1+voice*1.7+i*.075,phrase[i],voiceFor('voice-'+voice),i)
    const data=(await ctx.startRendering()).getChannelData(0)
    return {rate,data:Array.from(data)}
  })
  const peak=render.data.reduce((max,v)=>Math.max(max,Math.abs(v)),0)
  assert.ok(peak>.01 && peak<.9,'Dialogue must be audible with headroom')
  assert.ok(render.data.every(Number.isFinite),'Dialogue must contain finite samples')
  const energy=Array.from({length:4},(_,v)=>{
    const chunk=render.data.slice(Math.round(v*1.7*render.rate),Math.round((v*1.7+1.6)*render.rate))
    return Math.sqrt(chunk.reduce((a,x)=>a+x*x,0)/chunk.length)
  })
  assert.ok(energy.every(e=>e>.003),'Every voice must produce audible syllables')
  const wave=Buffer.alloc(44+render.data.length*2)
  wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16)
  wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(render.rate,24);wave.writeUInt32LE(render.rate*2,28)
  wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(render.data.length*2,40)
  render.data.forEach((v,i)=>wave.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2))
  fs.mkdirSync('shots/audio',{recursive:true});fs.writeFileSync('shots/audio/dialogue-preview.wav',wave)
  assert.deepEqual(errors,[])
  console.log('Dialogue QA passed: gesture unlock, no queued hover burst, typing/skip synchronisation, four voices with no clipping.',{peak,rms:energy})
} finally {await browser.close()}
