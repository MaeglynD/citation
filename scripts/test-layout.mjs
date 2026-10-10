import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']})
try {
const page=await browser.newPage()
await page.goto(process.argv[2] ?? 'http://127.0.0.1:5173/')
await page.waitForFunction(()=>window.__qa?.game.getState().all.length>600)
const report=await page.evaluate(async()=>{
 const {layout}=await import('/src/scene/Play.tsx'),{reviewLayout}=await import('/src/scene/Summary.tsx'),{wrapLines}=await import('/src/game/layout.ts')
 const failures=[],views=[{fw:338,fh:600,portrait:true},{fw:320,fh:600,portrait:true},{fw:390,fh:700,portrait:true},{fw:576,fh:360,portrait:false},{fw:576,fh:400,portrait:false}]
 for(const v of views)for(const q of window.__qa.game.getState().all){
  const L=layout(v,q),adv=L.quoteFont==='vt'?L.quoteSize*.4:L.quoteSize
  const quoteH=wrapLines(q.quote,L.innerW/adv)*L.quoteSize*L.lineHeight
  const meta=q.note ? L.noteTop-wrapLines(q.note,L.textW/6.4)*16 : L.cardY-L.cardH/2
  const optionH=Math.max(...[q.answer,...q.decoys].map(p=>wrapLines(p.alias||p.name,(L.optW-44)/8)*10))
  const reason=quoteH>L.bh-24?'quote':meta<L.optsTop+4?'metadata':optionH>L.optH-10?'option':L.cols!==2?'grid':L.optsBottom< -v.fh/2+18?'bottom':null
  {
    const R=reviewLayout(v,q,10)
    const textBottom=R.sourceY-R.sourceH
    const available=R.fileTop-R.fileBottom-R.peopleH-R.sourceH-32
    if(R.fit.height>Math.max(24,available)+1 || textBottom < -v.fh/2+32) failures.push({id:q.id,w:v.fw,h:v.fh,reason:'results/history fit',available,height:R.fit.height,textBottom})
  }
  if(reason)failures.push({id:q.id,w:v.fw,h:v.fh,reason,quoteH,bh:L.bh,meta,optionsTop:L.optsTop})
 }
 return {count:window.__qa.game.getState().all.length*views.length*2,failures}
})
console.log(JSON.stringify(report))
assert.deepEqual(report.failures,[])
} finally {await browser.close()}
