// Render portrait specs into a labelled PNG contact sheet so they can be checked by eye.
//
// usage:
//   node --experimental-strip-types scripts/portrait-sheet.mts <specs.json> <out.png> [--scale 4] [--cols 6] [--frames] [--only "Name A,Name B"]
//
// specs.json is either { "Name": spec, ... } or [ { "name": "...", "spec": {...} }, ... ].
// --frames renders idle / blink / talk side by side for each portrait.
import fs from 'node:fs'
import path from 'node:path'
import { renderPortrait, PW, PH, FONT, type PortraitSpec, type Frame } from '../src/portraits/render.ts'
// @ts-ignore plain JS helper
import { encodePNG } from './png.mjs'

const argv = process.argv.slice(2)
const flag = (k: string, d?: string) => { const i = argv.indexOf('--' + k); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true') : d }
const [inFile, outFile] = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--frames'))
if (!inFile || !outFile) { console.error('usage: portrait-sheet <specs.json> <out.png> [--scale 4] [--cols 6] [--frames] [--only "A,B"]'); process.exit(1) }

const scale = Number(flag('scale', '4'))
const withFrames = flag('frames') === 'true'
const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'))
let entries: { name: string; spec: PortraitSpec }[] = Array.isArray(raw)
  ? raw.map((r: any) => ({ name: r.name, spec: r.spec ?? r }))
  : Object.entries(raw).filter(([k]) => !k.startsWith('_')).map(([name, spec]) => ({ name, spec: spec as PortraitSpec }))
const only = flag('only')
if (only) { const set = new Set(only.split(',').map((s) => s.trim())); entries = entries.filter((e) => set.has(e.name)) }
const from = Number(flag('from', '0'))
const count = Number(flag('count', '9999'))
entries = entries.slice(from, from + count)
const cols = Number(flag('cols', withFrames ? '3' : '6'))

const frames: Frame[] = withFrames ? ['idle', 'blink', 'talk'] : ['idle']
const cardW = PW * frames.length + (frames.length - 1) * 2 + 4
const labelH = 16
const cardH = PH + 4 + labelH
const rows = Math.ceil(entries.length / cols)
const W = (cols * cardW + (cols + 1) * 2) * scale
const Hh = (rows * cardH + (rows + 1) * 2) * scale
const img = new Uint8ClampedArray(W * Hh * 4)

const BG = [15, 23, 51]
const CARD = [52, 69, 122]
const LINE = [44, 59, 106]
const TXT = [255, 241, 232]
function px(x: number, y: number, c: number[]) {
  for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) {
    const X = x * scale + i, Y = y * scale + j
    if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue
    const k = (Y * W + X) * 4
    img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2]; img[k + 3] = 255
  }
}
for (let y = 0; y < Hh / scale; y++) for (let x = 0; x < W / scale; x++) px(x, y, BG)

function text(s: string, x: number, y: number, maxW: number) {
  // two lines max, 3x5 glyphs on a 4px advance
  const words = s.toUpperCase().split(/\s+/)
  const lines: string[] = ['']
  for (const w of words) {
    const cand = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w
    if (cand.length * 4 - 1 <= maxW) lines[lines.length - 1] = cand
    else if (lines.length < 2) lines.push(w)
    else { lines[1] = (lines[1] + ' ' + w).slice(0, Math.floor(maxW / 4)); break }
  }
  lines.forEach((ln, li) => {
    let cx = x + Math.floor((maxW - (ln.length * 4 - 1)) / 2)
    for (const ch of ln) { const g = FONT[ch]; if (g) g.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') px(cx + i, y + li * 7 + j, TXT) }); cx += 4 }
  })
}

entries.forEach((e, idx) => {
  const c = idx % cols, r = Math.floor(idx / cols)
  const ox = 2 + c * (cardW + 2), oy = 2 + r * (cardH + 2)
  for (let y = 0; y < PH + 4; y++) for (let x = 0; x < cardW; x++) px(ox + x, oy + y, y % 6 === 5 ? LINE : CARD)
  frames.forEach((f, fi) => {
    let data: Uint8ClampedArray
    try { data = renderPortrait(e.spec, f) } catch (err) { console.error('render failed:', e.name, (err as Error).message); return }
    const fx = ox + 2 + fi * (PW + 2)
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const k = (y * PW + x) * 4
      if (data[k + 3] > 0) px(fx + x, oy + 2 + y, [data[k], data[k + 1], data[k + 2]])
    }
  })
  text(e.name, ox, oy + PH + 5, cardW)
})

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, encodePNG(W, Hh, img))
console.log(`wrote ${outFile} (${entries.length} portraits, ${W}x${Hh})`)
