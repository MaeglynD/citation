import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
try {
  const page = await browser.newPage({viewport:{width:1280,height:800}})
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5173/')
  await page.waitForFunction(()=>window.__qa?.game.getState().all.length>600 && document.querySelector('canvas')?.getAttribute('role')==='application')
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='question')
  await page.keyboard.press('Space')
  await page.keyboard.press('1')
  await page.waitForTimeout(250)
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await page.keyboard.press('2')
  await page.waitForTimeout(730)
  assert.equal(await page.evaluate(()=>window.__qa.game.getState().phase),'suspense','The abandoned first answer must not resolve the second answer early')
  await page.waitForFunction(()=>window.__qa.game.getState().phase==='reveal')
  assert.deepEqual(await page.evaluate(()=>{
    const s=window.__qa.game.getState();return {count:s.history.length,picked:s.history[0].picked,expected:s.options[1].person.name}
  }),await page.evaluate(()=>{const s=window.__qa.game.getState();return {count:1,picked:s.options[1].person.name,expected:s.options[1].person.name}}))
  await page.keyboard.press('Home')
  await page.keyboard.press('h')
  await page.evaluate(()=>{
    const s=window.__qa.game.getState(),q=s.all.toSorted((a,b)=>b.quote.length-a.quote.length)[0]
    window.__qa.game.setState({history:[{quoteId:q.id,picked:q.decoys[0].name,correct:false,at:Date.now()}]})
  })
  await page.setViewportSize({width:320,height:568})
  await page.waitForTimeout(900)
  await page.screenshot({path:'shots/redesign/history-small-phone.png'})
  await page.keyboard.press('s')
  await page.waitForTimeout(700)
  await page.screenshot({path:'shots/redesign/settings-small-phone.png'})
  assert.deepEqual(errors,[])
  console.log('Fast menu/resume/re-answer race passed; one verdict, correct chosen person, no browser errors.')
} finally {await browser.close()}
