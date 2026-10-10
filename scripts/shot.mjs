// Drive the game in headless Chromium and take screenshots.
// usage: node scripts/shot.mjs --out shots/x.png --w 1280 --h 720 --dpr 1 --steps "wait:1500,click:640x400,wait:3000,shot:q1,key:1,wait:2500"
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? true : arr[i + 1]])
  return acc
}, []))

const url = args.url ?? 'http://127.0.0.1:5173/'
const out = args.out ?? 'shots/shot.png'
const w = Number(args.w ?? 1280)
const h = Number(args.h ?? 720)
const dpr = Number(args.dpr ?? 1)
const steps = String(args.steps ?? 'wait:1500').split(',').map((s) => s.trim()).filter(Boolean)

fs.mkdirSync(path.dirname(out), { recursive: true })
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(url, { waitUntil: 'load' })

let shotIndex = 0
for (const step of steps) {
  const [cmd, arg] = step.split(':')
  if (cmd === 'wait') await page.waitForTimeout(Number(arg))
  else if (cmd === 'click') { const [x, y] = arg.split('x').map(Number); await page.mouse.click(x, y) }
  else if (cmd === 'move') { const [x, y] = arg.split('x').map(Number); await page.mouse.move(x, y) }
  else if (cmd === 'key') await page.keyboard.press(arg)
  else if (cmd === 'shot') {
    const p = out.replace(/\.png$/, `-${arg ?? shotIndex++}.png`)
    await page.screenshot({ path: p })
    console.log('saved', p)
  } else if (cmd === 'eval') console.log(await page.evaluate(arg))
}
await page.screenshot({ path: out })
console.log('saved', out)
await browser.close()
