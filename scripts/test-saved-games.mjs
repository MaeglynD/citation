import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const url=process.argv[2]??'http://127.0.0.1:5173/'
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
try {
const page=await browser.newPage({viewport:{width:1280,height:720},locale:'en-GB',timezoneId:'Europe/London'})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.goto(url)
await page.waitForFunction(()=>window.__qa?.game.getState().all.length>600 && document.querySelector('canvas')?.getAttribute('role')==='application')
await page.evaluate(async()=>{
 const s=window.__qa.game.getState(),{recordGame}=await import('/src/game/history.ts')
 const worst=s.all.find(q=>q.id==='vil-cromwell-warts')
 const deck=[worst,...s.all.filter(q=>q.id!==worst.id).slice(0,9)]
 let games=[]
 for(let j=0;j<7;j++){
  const at=Date.now()-j*86400000
  games=recordGame(games,{id:'saved-'+j,startedAt:at,completedAt:at+600000,total:10,answers:deck.map((q,i)=>({quoteId:q.id,picked:i%2?q.decoys[0].name:q.answer.name,correct:i%2===0,at:at+i*60000}))})
 }
 window.__qa.game.setState({games})
})
await page.reload()
await page.waitForFunction(()=>window.__qa?.game.getState().games.length===7 && document.querySelector('canvas')?.getAttribute('role')==='application')
await page.keyboard.press('h')
await page.waitForTimeout(800)
const row=await page.evaluate(()=>{
 const v=window.__qa.game.getState().view,y=Math.min(v.fh/2-55,145)-38-34
 return {x:innerWidth/2,y:(.5-y/v.h)*innerHeight}
})
await page.mouse.click(row.x,row.y)
await page.waitForFunction(()=>window.__qa.game.getState().reviewGameId==='saved-0')
await page.waitForTimeout(750)
await page.screenshot({path:'shots/expressive/history-long-desktop.png'})
const source=await page.evaluate(async()=>{
 const {reviewLayout}=await import('/src/scene/Summary.tsx')
 const s=window.__qa.game.getState(),g=s.games[0],q=s.all.find(q=>q.id===g.answers[0].quoteId),L=reviewLayout(s.view,q,10)
 window.open=url=>{window.lastSource=url;return null}
 return {x:innerWidth/2,y:(.5-(L.sourceY-L.sourceH/2)/s.view.h)*innerHeight,url:q.url}
})
await page.mouse.click(source.x,source.y)
assert.equal(await page.evaluate(()=>window.lastSource),source.url,'Archived sources remain available')
await page.keyboard.press('Escape')
assert.equal(await page.evaluate(()=>window.__qa.game.getState().reviewGameId),null)
assert.equal(await page.evaluate(()=>window.__qa.game.getState().screen),'history')
await page.keyboard.press('ArrowDown')
await page.keyboard.press('Enter')
assert.equal(await page.evaluate(()=>window.__qa.game.getState().reviewGameId),'saved-1')
await page.keyboard.press('Escape')
await page.keyboard.press('Escape')
assert.equal(await page.evaluate(()=>window.__qa.game.getState().screen),'title')
// Let the title actually render before reopening History; otherwise React can
// batch both screen changes and preserve the previous History selection.
await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
await page.mouse.move(0,0)
await page.setViewportSize({width:320,height:568})
await page.keyboard.press('h')
await page.waitForTimeout(600)
await page.screenshot({path:'shots/expressive/history-paged-phone.png'})
for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown')
await page.waitForTimeout(250)
await page.screenshot({path:'shots/expressive/history-page2-phone.png'})
await page.keyboard.press('Enter')
assert.equal(await page.evaluate(()=>window.__qa.game.getState().reviewGameId),'saved-5')
await page.waitForTimeout(600)
await page.screenshot({path:'shots/expressive/history-long-phone.png'})
assert.deepEqual(errors,[])
console.log('Saved games: persistence, actual row clicks, keyboard selection, pagination, nested back navigation and archived source links passed.')
} finally {await browser.close()}
