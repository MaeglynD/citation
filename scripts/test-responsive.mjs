import { buildSync } from 'esbuild'
import fs from 'node:fs'
import assert from 'node:assert/strict'
let loadId=0
const mod = file => import('data:text/javascript;base64,' + Buffer.from(buildSync({entryPoints:[file],bundle:true,write:false,platform:'node',format:'esm'}).outputFiles[0].text).toString('base64') + '#' + loadId++)
const {layout,reviewLayout} = await mod('src/game/screen-layout.ts')
const {wrapLines} = await mod('src/game/layout.ts')
const {calculateView} = await mod('src/game/view.ts')
const {THEMES,themeById} = await mod('src/themes/palettes.ts')
const quotes = JSON.parse(fs.readFileSync('src/data/quotes.json'))
const failures=[]
const views=new Map()
// Usable browser areas: small phones, browser bars, landscape, tablets, desktop.
for(const [w,h] of [[320,480],[320,568],[360,640],[375,667],[390,740],[430,830],[568,280],[667,320],[740,350],[844,390],[540,450],[768,1024],[1024,768],[1280,720],[1920,1080]]) for(const dpr of [1,2]) for(const cap of [1.5,2,3,99]) {
 // The CSS canvas has a minimum readable height; the root scrolls below it.
 const canvasH=Math.max(h,w>=560 && w/h>=1.55?360:600)
 const v=calculateView(w,canvasH,dpr,cap)
 assert(v.w>=v.fw && v.h>=v.fh)
 views.set([v.fw,v.fh,v.portrait].join(','),v)
}
for (const v of views.values()) for(const q of quotes){
 const L=layout(v,q), adv=L.quoteFont==='vt'?L.quoteSize*.4:L.quoteSize
 const quoteH=wrapLines(q.quote,L.innerW/adv)*L.quoteSize*L.lineHeight
 const meta=q.note?L.noteTop-wrapLines(q.note,L.textW/6.4)*16:L.cardY-L.cardH/2
 const optionH=Math.max(...[q.answer,...q.decoys].map(p=>wrapLines(p.alias||p.name,(L.optW-44)/(L.optFont==='vt'?L.optSize*.4:L.optSize))*L.optSize*L.optLineHeight))
 const reason = quoteH>L.bh-24?'quote':meta<L.optsTop+4?'note':optionH>L.optH-10?'answer':L.optsBottom < -v.fh/2+18?'bottom':null
 if(reason) failures.push({id:q.id,w:v.fw,h:v.fh,reason,quoteH,bh:L.bh,meta,optsTop:L.optsTop,bottom:L.optsBottom})
 assert.equal(L.cols,2)
 // Saved partial games use the same sheet as a full ten-answer overview.
 for(const count of [1,5,10]) {
  const R=reviewLayout(v,q,count)
  if(R.fit.height>Math.max(24,R.quoteSpace)+1||R.sourceY-R.sourceH < R.fileBottom) failures.push({id:q.id,w:v.fw,h:v.fh,reason:'review',count,sourceBottom:R.sourceY-R.sourceH,bottom:R.fileBottom})
 }
}
assert.equal(failures.length,0,JSON.stringify(failures.slice(0,10)))
assert.equal(THEMES.length,4)
assert.equal(themeById('obsolete').id,'arcade')
const luminance=hex=>hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)
const contrast=(a,b)=>{const [lo,hi]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (hi+.05)/(lo+.05)}
for(const t of THEMES) for(const [fg,bg] of [['ink','paper'],['boxText','box'],['accentInk','accent'],['goodInk','good'],['badInk','bad'],['text','bg'],['muted','box']]) assert(contrast(t.palette[fg],t.palette[bg])>=4.5,`${t.name}: ${fg} on ${bg}`)
console.log(`Responsive layouts passed: ${quotes.length} quotes across ${views.size} distinct frames, including partial and complete results. Four palettes passed text-contrast checks.`)
const storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
let {useSettings}=await mod('src/game/settings.ts')
assert.equal(useSettings.getState().theme,'arcade')
useSettings.getState().update({theme:'mint'})
useSettings.getState().update({volume:2})
assert.equal(useSettings.getState().theme,'mint','Changing volume must preserve the palette')
;({useSettings}=await mod('src/game/settings.ts'))
assert.equal(useSettings.getState().theme,'mint','Palette survives a reload')
storage.set('citation-needed.settings',JSON.stringify({theme:'old-removed-theme',volume:1,size:'large',muted:true}))
;({useSettings}=await mod('src/game/settings.ts'))
assert.equal(useSettings.getState().theme,'arcade')
assert.equal(useSettings.getState().muted,true,'Legacy palette migration preserves audio preferences')
storage.set('citation-needed.settings','{invalid')
;({useSettings}=await mod('src/game/settings.ts'))
assert.equal(useSettings.getState().theme,'arcade')
assert.equal(useSettings.getState().size,'large')
delete globalThis.localStorage
console.log('Palette persistence, preference updates and legacy migration passed.')
