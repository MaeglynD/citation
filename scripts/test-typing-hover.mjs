import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const url=process.argv[2]??'http://127.0.0.1:5173/'
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
fs.mkdirSync('shots/hover',{recursive:true})
try {
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(url)
  await page.waitForFunction(()=>window.__qa?.game.getState().all.length>600 && document.querySelector('canvas')?.getAttribute('role')==='application')
  assert.deepEqual(await page.evaluate(()=>{
    const {muted,volume,size}=window.__qa.settings.getState();return {muted,volume,size}
  }),{muted:false,volume:1,size:'large'})
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='question')
  const targets=await page.evaluate(async()=>{
    const {layout}=await import('/src/scene/Play.tsx')
    const s=window.__qa.game.getState(),q=s.all.toSorted((a,b)=>b.quote.length-a.quote.length)[0]
    window.__qa.game.setState({deck:[q],round:0,phaseAt:performance.now(),typedDone:false,hovered:null,options:[{person:q.answer,correct:true},...q.decoys.map(person=>({person,correct:false}))]})
    const L=layout(s.view,q)
    return [0,1].map(i=>{
      const p=L.optPos(i);return {x:(p.x/s.view.w+.5)*innerWidth,y:(.5-p.y/s.view.h)*innerHeight}
    })
  })
  await page.waitForTimeout(500)
  await page.mouse.move(targets[0].x,targets[0].y)
  await page.waitForFunction(()=>window.__qa.game.getState().hovered===0)
  await page.waitForFunction(()=>window.__qa.scene.getObjectByName('answer-card-0').children[0].children[0].position.y>=2)
  assert.equal(await page.evaluate(()=>window.__qa.game.getState().typedDone),false,'Hover must work before typing ends')
  await page.screenshot({path:'shots/hover/typing-hover.png'})
  await page.mouse.move(targets[1].x,targets[1].y)
  await page.waitForFunction(()=>window.__qa.game.getState().hovered===1)
  await page.mouse.click(targets[1].x,targets[1].y)
  assert.deepEqual(await page.evaluate(()=>{
    const {phase,typedDone,picked}=window.__qa.game.getState();return {phase,typedDone,picked}
  }),{phase:'question',typedDone:true,picked:null},'First click reveals text without submitting')
  const mix=await page.evaluate(async()=>{
    const {audio}=await import('/src/audio/engine.ts');return {master:audio.s.master.gain.value,music:audio.s.music.gain.value}
  })
  assert.ok(Math.abs(mix.master-.08)<.002 && Math.abs(mix.music-.3)<.002,'Quiet default mix is applied')
  await page.mouse.click(targets[1].x,targets[1].y)
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='reveal')
  await page.evaluate(()=>window.__qa.settings.getState().update({volume:4,size:'small',muted:true}))
  await page.reload()
  await page.waitForFunction(()=>window.__qa?.game.getState().all.length>600)
  assert.deepEqual(await page.evaluate(()=>{
    const {muted,volume,size}=window.__qa.settings.getState();return {muted,volume,size}
  }),{muted:true,volume:4,size:'small'},'Saved player preferences must survive the new defaults')
  assert.deepEqual(errors,[])
  console.log('Defaults and typing hover passed: live pointer highlights/lift/portrait preview, safe text skip, quiet mix and saved preferences.')
} finally {await browser.close()}
