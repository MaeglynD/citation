import { chromium } from 'playwright'
import assert from 'node:assert/strict'

// A generated test tone is served only inside this browser test; no production recording is invented.
const rate = 22050, frames = rate / 2, wav = Buffer.alloc(44 + frames * 2)
wav.write('RIFF',0); wav.writeUInt32LE(wav.length - 8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16)
wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28)
wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(frames*2,40)
for(let i=0;i<frames;i++) wav.writeInt16LE(Math.round(Math.sin(i/rate*440*Math.PI*2)*1500),44+i*2)
const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(() => {
    const AC = window.AudioContext
    window.audioStarts = []
    window.AudioContext = class extends AC {
      createBufferSource() {
        const node = super.createBufferSource(), start = node.start.bind(node)
        node.start = (...args) => { if(node.loop) window.audioStarts.push({start:node.loopStart,end:node.loopEnd,duration:node.buffer?.duration}); return start(...args) }
        return node
      }
    }
  })
  await page.route('**/audio/manifest.json',route=>route.fulfill({json:{version:1,themes:{arcade:{music:{main:{sources:['/audio/corrupt.ogg','/audio/test.wav'],loopStart:.1,loopEnd:.4,gain:.5}},sfx:{hover:{sources:['/audio/test.wav'],gain:.2}}}}}}))
  await page.route('**/audio/corrupt.ogg',route=>route.fulfill({body:'invalid audio',contentType:'audio/ogg'}))
  await page.route('**/audio/test.wav',route=>route.fulfill({body:wav,contentType:'audio/wav'}))
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:5173/')
  await page.waitForFunction(()=>window.__qa?.game.getState().all.length > 600)
  await page.waitForFunction(()=>document.querySelector('canvas')?.getAttribute('role') === 'application')
  await page.keyboard.press('Enter')
  await page.waitForFunction(()=>window.audioStarts?.some(a=>a.start===.1 && a.end===.4))
  assert.equal(await page.evaluate(()=>window.audioStarts.find(a=>a.start===.1&&a.end===.4).duration),.5)
  await page.keyboard.press('Home')
  await page.waitForTimeout(500)
  assert.equal(await page.evaluate(()=>window.audioStarts.filter(a=>a.start===.1&&a.end===.4).length),1,'The same recording continues across menu/game transitions')
  await page.keyboard.press('m')
  assert.equal(await page.evaluate(()=>window.__qa.settings.getState().muted),true)
  assert.deepEqual(errors,[])
  const unavailable=await browser.newPage()
  await unavailable.addInitScript(()=>{
    const AC=window.AudioContext;window.fallbackNotes=0
    window.AudioContext=class extends AC {
      createOscillator(){const node=super.createOscillator(),start=node.start.bind(node);node.start=(...args)=>{window.fallbackNotes++;return start(...args)};return node}
    }
  })
  await unavailable.route(url=>url.pathname.startsWith('/audio/'),route=>route.fulfill({status:404,body:'Not available'}))
  await unavailable.goto(process.argv[2] ?? 'http://127.0.0.1:5173/')
  await unavailable.waitForFunction(()=>window.__qa?.game.getState().all.length>600 && document.querySelector('canvas')?.getAttribute('role')==='application')
  await unavailable.keyboard.press('s')
  await unavailable.waitForFunction(()=>window.fallbackNotes>10)
  assert.equal(await unavailable.evaluate(()=>window.__qa.game.getState().screen),'title','Fallback music plays on the menu without typing sounds')
  console.log('Recorded audio passed: codec fallback, decoding, explicit loop range, uninterrupted shared track, mute and composed music when recordings are unavailable.')
} finally { await browser.close() }
