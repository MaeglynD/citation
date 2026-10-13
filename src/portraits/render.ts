/*
 * Procedural pixel-art portraits.
 *
 * Pure functions, no DOM: the game uploads the output as GPU textures, and
 * scripts/portrait-sheet.mts renders the same pixels into PNG contact sheets.
 *
 * A portrait is PW x PH pixels: head and shoulders, facing the viewer, lit from
 * the upper left, with a dark outline. Everything is driven by a PortraitSpec.
 */

export const PW = 40
export const PH = 48
export type Frame = 'idle' | 'blink' | 'talk'

export interface PortraitSpec {
  base?: string // human | animal | sponge | starfish | crab | robot | helmet | skull | ghost | triangle | blob | object
  skin?: string
  face?: string
  build?: string
  age?: string
  hair?: string
  hairColor?: string
  hairColor2?: string // two-tone hair: colours the subject's right half (Cruella)
  facialHair?: string
  facialHairColor?: string
  brows?: string
  browColor?: string
  eyes?: string
  eyeColor?: string
  nose?: string
  noseColor?: string
  mouth?: string
  lipColor?: string
  ears?: string
  eyewear?: string
  eyewearColor?: string
  headwear?: string
  headwearColor?: string
  headwearColor2?: string
  headwearSymbol?: string
  outfit?: string
  outfitColor?: string
  outfitColor2?: string
  pattern?: string // outfit pattern: leopard, plaid, camo, pinstripes, vstripes, hstripes, polka, zigzag, unionjack
  patternColor?: string
  headwearPattern?: string // leopard, plaid, stripes
  symbol?: string // chest emblem / jersey number / book cover mark
  extras?: string[]
  // animal heads
  animal?: { ears?: string; snout?: string; fur?: string; fur2?: string; muzzle?: string; earColor?: string; pattern?: string; nose?: string }
  // special bases
  kind?: string // robot / helmet / object sub-type
  color?: string
  color2?: string
}

// ---------------------------------------------------------------------------
// colour

type Col = number
const OUTLINE = 0x15111e

const mixc = (a: Col, b: Col, t: number): Col => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t)
}
const dark = (c: Col, t = 0.3) => mixc(c, 0x1b1030, t) // shadows lean cool/purple
const light = (c: Col, t = 0.3) => mixc(c, 0xfff6e2, t) // highlights lean warm

interface Ramp { hi: Col; base: Col; lo: Col; dk: Col }
const ramp = (c: Col): Ramp => ({ hi: light(c, 0.3), base: c, lo: dark(c, 0.27), dk: dark(c, 0.52) })

export const COLORS: Record<string, Col> = {
  black: 0x2b2934, charcoal: 0x46465a, darkgrey: 0x5c5c6c, grey: 0x8b8b99, gray: 0x8b8b99, lightgrey: 0xc2c3c7,
  silver: 0xc8cdd6, white: 0xf4f1ea, cream: 0xf1e2c2, beige: 0xd9c4a0, khaki: 0xb8a77a, tan: 0xc49a6c,
  brown: 0x7a4a2a, darkbrown: 0x4f3422, navy: 0x2a3d78, blue: 0x2f6fd6, royalblue: 0x3b4fd8, lightblue: 0x72b6ff,
  skyblue: 0x9fdcff, teal: 0x1aa39a, cyan: 0x3fd8e0, turquoise: 0x40c8b0, green: 0x35a852, lime: 0x9be33a,
  darkgreen: 0x1f6b3a, olive: 0x6b7a3a, armygreen: 0x5a6b3a, red: 0xd8303a, crimson: 0xb0102a, maroon: 0x7e1f3a,
  burgundy: 0x6a1a2e, orange: 0xf28a2a, saffron: 0xf2a02a, yellow: 0xf5d63a, gold: 0xe8b83a, mustard: 0xc9a227,
  purple: 0x7a3fb0, violet: 0x9b6ad6, lavender: 0xc0a8e8, pink: 0xff77a8, hotpink: 0xff3d8a, rose: 0xe06a8a,
  peach: 0xffccaa, magenta: 0xd02aa0, coral: 0xff7a5a, mint: 0x9fe8c0, bronze: 0xb07a3a, copper: 0xc06a3a,
}

export const SKIN: Record<string, Col> = {
  pale: 0xf8dccb, fair: 0xf6cfb3, light: 0xf0bf98, medium: 0xdca478, tan: 0xd39a6a, olive: 0xbf8b5a,
  brown: 0x9c6542, darkbrown: 0x7a4a2e, dark: 0x6a4128, deep: 0x4c2e1d,
  yellow: 0xfcd12a, simpson: 0xfcd12a, green: 0x76b852, ogre: 0xa3c23a, zombie: 0x9db896, alien: 0x8fd16a,
  blue: 0x4aa3e8, grey: 0xb7b7c2, gray: 0xb7b7c2, white: 0xf3f1ee, red: 0xe0453a, purple: 0x8f62c0,
  orange: 0xf2a15a, pink: 0xf7a8bc, gold: 0xe9c46a, metal: 0xaab3c2, lavender: 0xc8b4e8,
}

export const HAIR: Record<string, Col> = {
  black: 0x24232e, darkbrown: 0x4c3221, brown: 0x7a5232, lightbrown: 0xa0744a, auburn: 0x8e3f28, red: 0xc4502a,
  ginger: 0xe07a30, blonde: 0xf0c860, darkblonde: 0xc9a050, platinum: 0xf6ebc4, strawberry: 0xf0a060,
  orange: 0xf2b84a, grey: 0xa6a6b0, gray: 0xa6a6b0, saltpepper: 0x6e6e78, white: 0xf0f0f6, silver: 0xd4d6e0,
}

function colour(v: string | undefined, fallback: Col, ...tables: Record<string, Col>[]): Col {
  if (!v) return fallback
  const k = String(v).toLowerCase().replace(/[\s_-]/g, '')
  if (/^#[0-9a-f]{6}$/.test(k)) return parseInt(k.slice(1), 16)
  for (const t of tables) if (k in t) return t[k]
  if (k in COLORS) return COLORS[k]
  if (k in HAIR) return HAIR[k]
  if (k in SKIN) return SKIN[k]
  return fallback
}

// ---------------------------------------------------------------------------
// glyphs

export const FONT: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '#.#', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '-': ['...', '...', '###', '...', '...'],
  "'": ['.#.', '.#.', '...', '...', '...'], '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'], ' ': ['...', '...', '...', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'], '"': ['#.#', '#.#', '...', '...', '...'],
}

const SYMBOLS: Record<string, string[]> = {
  star: ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  cross: ['..#..', '#####', '..#..', '..#..', '..#..'],
  crescent: ['.##..', '#....', '#...#', '#....', '.##..'],
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  circle: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  dot: ['.....', '.###.', '.###.', '.###.', '.....'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
  bolt: ['...#.', '..#..', '.###.', '..#..', '.#...'],
  bat: ['#...#', '##.##', '#####', '.#.#.', '.....'],
  skull: ['.###.', '#.#.#', '#####', '.###.', '.#.#.'],
  eye: ['.....', '.###.', '#.#.#', '.###.', '.....'],
  dollar: ['.###.', '#.#..', '.###.', '..#.#', '.###.'],
  peace: ['.###.', '#.#.#', '#.#.#', '##.##', '.###.'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  sickle: ['.##.#', '#..#.', '#.#..', '.#.#.', '#...#'],
  apple: ['..#..', '.##..', '####.', '####.', '.##..'],
  flower: ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  swastika: ['.....', '.....', '..#..', '.....', '.....'], // deliberately not drawn
  eagle: ['#.#.#', '#####', '.###.', '..#..', '.#.#.'],
  leaf: ['...##', '..###', '.###.', '###..', '#....'],
  anchor: ['..#..', '.###.', '..#..', '#.#.#', '.###.'],
  check: ['....#', '...#.', '#.#..', '.#...', '.....'],
  note: ['..##.', '..#.#', '..#..', '###..', '##...'],
  sun: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  ankh: ['.###.', '.#.#.', '#####', '..#..', '..#..'],
  om: ['##...', '..#.#', '.#..#', '..#.#', '##.#.'],
  wheel: ['.###.', '#.#.#', '#####', '#.#.#', '.###.'],
  hammer: ['###..', '.#...', '.##..', '..#..', '...#.'],
}

// ---------------------------------------------------------------------------
// pixel buffer

class Pix {
  d = new Int32Array(PW * PH).fill(-1)
  set(x: number, y: number, c: Col) {
    x = Math.floor(x); y = Math.floor(y)
    if (x >= 0 && y >= 0 && x < PW && y < PH) this.d[y * PW + x] = c
  }
  get(x: number, y: number): Col {
    if (x < 0 || y < 0 || x >= PW || y >= PH) return -1
    return this.d[y * PW + x]
  }
  clear(x: number, y: number) { if (x >= 0 && y >= 0 && x < PW && y < PH) this.d[y * PW + x] = -1 }
  span(y: number, x0: number, x1: number, c: Col) { for (let x = Math.ceil(x0); x <= x1; x++) this.set(x, y, c) }
  rect(x: number, y: number, w: number, h: number, c: Col) { for (let j = 0; j < h; j++) this.span(y + j, x, x + w - 1, c) }
  sym(x: number, y: number, c: Col) { this.set(x, y, c); this.set(PW - 1 - x, y, c) }
  symSpan(y: number, x0: number, x1: number, c: Col) { this.span(y, x0, x1, c); this.span(y, PW - 1 - x1, PW - 1 - x0, c) }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col | ((x: number, y: number) => Col)) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) this.set(x, y, typeof c === 'function' ? c(x, y) : c)
      }
    }
  }
  ring(cx: number, cy: number, rx: number, ry: number, c: Col) {
    const inside = (x: number, y: number) => { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1 }
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) this.set(x, y, c)
      }
    }
  }
  // fill rows between two straight edges: left edge from (xl0,y0) to (xl1,y1), right edge likewise
  trap(y0: number, y1: number, xl0: number, xr0: number, xl1: number, xr1: number, c: Col | ((x: number, y: number) => Col)) {
    for (let y = y0; y <= y1; y++) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0)
      const xl = Math.round(xl0 + (xl1 - xl0) * t), xr = Math.round(xr0 + (xr1 - xr0) * t)
      for (let x = xl; x <= xr; x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c)
    }
  }
  glyph(rows: string[], x: number, y: number, c: Col) {
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') this.set(x + i, y + j, c) })
  }
  text(s: string, x: number, y: number, c: Col) {
    let cx = x
    for (const ch of s.toUpperCase()) { const g = FONT[ch]; if (g) this.glyph(g, cx, y, c); cx += 4 }
  }
  recolor(fn: (x: number, y: number, c: Col) => Col | undefined) {
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
      const c = this.d[y * PW + x]
      if (c < 0) continue
      const n = fn(x, y, c)
      if (n !== undefined) this.d[y * PW + x] = n
    }
  }
}

const textWidth = (s: string) => s.length * 4 - 1

function drawSymbol(p: Pix, sym: string | undefined, cx: number, cy: number, c: Col) {
  if (!sym) return
  const key = sym.toLowerCase()
  if (key === 'swastika') return
  if (SYMBOLS[key]) { p.glyph(SYMBOLS[key], Math.round(cx - 2.5), Math.round(cy - 2.5), c); return }
  const s = sym.toUpperCase().slice(0, 3)
  p.text(s, Math.round(cx - textWidth(s) / 2), Math.round(cy - 2.5), c)
}

// ---------------------------------------------------------------------------
// head geometry

interface Head {
  top: number; chin: number; hw: number; eyeY: number; mouthY: number; hl: number; cx: number
  span: (y: number) => [number, number] | null
  dome: (y: number, expand: number, lift: number) => [number, number] | null
}

const FACES: Record<string, [number, number, number, number]> = {
  oval: [10, 34, 10, 0.55], round: [11, 34, 11, 0.82], square: [10, 34, 10, 0.95], long: [8, 35, 9, 0.62],
  wide: [10, 34, 11.5, 0.85], narrow: [9, 34, 8.5, 0.5], heart: [10, 34, 10.5, 0.35], small: [13, 34, 9, 0.6],
  big: [7, 35, 12, 0.75], tall: [5, 35, 9.5, 0.7],
}

function makeHead(face = 'oval', build = 'average', age = 'adult'): Head {
  let [top, chin, hw, jaw] = FACES[face] ?? FACES.oval
  if (build === 'heavy') { hw += 1; jaw = Math.min(1, jaw + 0.3) }
  else if (build === 'slim') hw -= 0.5
  if (age === 'child') { top += 2; hw -= 0.5 }
  const cx = 19.5
  const H = chin + 1 - top
  const upper = H * 0.4
  const span = (y: number): [number, number] | null => {
    if (y < top || y > chin) return null
    const t = (y + 0.5 - top) / H
    let w: number
    if (t < 0.4) { const u = (upper - (y + 0.5 - top)) / upper; w = hw * Math.sqrt(Math.max(0, 1 - u * u)) }
    else if (t < 0.62) w = hw
    else {
      const s = (t - 0.62) / 0.38
      w = hw * (1 - (1 - jaw) * Math.pow(s, 1.4))
      if (s > 0.8) w *= 1 - (s - 0.8) * 1.6
    }
    w = Math.max(1.5, w)
    return [Math.ceil(cx - w), Math.floor(cx + w)]
  }
  const dome = (y: number, expand: number, lift: number): [number, number] | null => {
    const tp = top - lift
    const R = upper + lift
    if (y < tp) return null
    const dy = tp + R - (y + 0.5)
    const w = dy > 0 ? (hw + expand) * Math.sqrt(Math.max(0, 1 - (dy / R) ** 2)) : hw + expand
    if (w < 0.8) return null
    return [Math.ceil(cx - w), Math.floor(cx + w)]
  }
  const eyeY = Math.round(top + H * 0.45)
  const mouthY = Math.min(chin - 4, eyeY + 7)
  const hl = top + Math.round(H * 0.22)
  return { top, chin, hw, cx, eyeY, mouthY, hl, span, dome }
}

// ---------------------------------------------------------------------------
// body / outfits

const NECK: Record<string, number> = { slim: 3, average: 4, broad: 4, heavy: 5 }
const SHOULDER: Record<string, number> = { slim: 15, average: 16.5, broad: 18, heavy: 18.5 }

function torsoTop(H: Head) { return H.chin + 3 }
function torsoSpan(H: Head, build: string, y: number): [number, number] | null {
  const top = torsoTop(H)
  if (y < top) return null
  const nw = NECK[build] ?? 4
  const sh = SHOULDER[build] ?? 16.5
  const k = y - top
  const w = k === 0 ? nw + 5 : k === 1 ? nw + 9 : k === 2 ? sh - 1 : sh
  return [Math.ceil(19.5 - w), Math.floor(19.5 + w)]
}

const OUTFIT_DEFAULT: Record<string, [string, string]> = {
  suit: ['charcoal', 'red'], 'suit-bowtie': ['charcoal', 'black'], tuxedo: ['black', 'black'], shirt: ['white', 'lightgrey'],
  tshirt: ['grey', 'white'], polo: ['navy', 'white'], turtleneck: ['black', 'black'], sweater: ['navy', 'white'],
  cardigan: ['red', 'white'], hoodie: ['grey', 'white'], military: ['olive', 'gold'], mao: ['grey', 'grey'],
  robe: ['saffron', 'maroon'], monk: ['saffron', 'maroon'], toga: ['white', 'red'], cassock: ['black', 'white'],
  papal: ['white', 'gold'], habit: ['black', 'white'], kimono: ['navy', 'white'], dress: ['red', 'red'],
  gown: ['purple', 'gold'], jersey: ['red', 'white'], tank: ['white', 'white'], singlet: ['red', 'yellow'],
  leather: ['black', 'grey'], labcoat: ['white', 'blue'], cape: ['black', 'red'], armor: ['silver', 'gold'],
  hawaiian: ['teal', 'yellow'], overalls: ['blue', 'white'], prison: ['orange', 'white'], stripes: ['white', 'black'],
  bare: ['peach', 'peach'], shawl: ['white', 'white'], sari: ['white', 'blue'], regal: ['crimson', 'gold'],
  ruff: ['black', 'white'], tunic: ['brown', 'tan'], vest: ['black', 'white'], tracksuit: ['blue', 'white'],
  jumpsuit: ['white', 'gold'], emblem: ['blue', 'red'], trenchcoat: ['khaki', 'brown'], chef: ['white', 'white'],
  scrubs: ['teal', 'teal'], fur: ['brown', 'tan'], none: ['brown', 'tan'], uniform: ['navy', 'gold'],
  sweatervest: ['brown', 'white'], blazer: ['navy', 'white'], denim: ['blue', 'white'], spacesuit: ['white', 'orange'],
  kermit: ['green', 'green'], furcoat: ['brown', 'tan'], cravat: ['black', 'white'], sailor: ['navy', 'white'], poncho: ['brown', 'red'], 'tie-dye': ['purple', 'yellow'],
}

function drawBody(p: Pix, H: Head, s: PortraitSpec, SK: Ramp, furBody: Ramp | null) {
  const build = s.build ?? 'average'
  const kind = (s.outfit ?? 'suit').toLowerCase()
  const def = OUTFIT_DEFAULT[kind] ?? OUTFIT_DEFAULT.suit
  const A = ramp(colour(s.outfitColor, colour(def[0], 0x46465a)))
  const B = ramp(colour(s.outfitColor2, colour(def[1], 0xd8303a)))
  const top = torsoTop(H)
  const nw = NECK[build] ?? 4
  const ts = (y: number) => torsoSpan(H, build, y)!
  const nl = Math.ceil(19.5 - nw), nr = Math.floor(19.5 + nw)

  // neck
  for (let y = H.chin - 2; y <= top + 2; y++) for (let x = nl; x <= nr; x++) p.set(x, y, y <= H.chin + 1 ? SK.dk : x >= nr - 1 ? SK.lo : SK.base)

  const fill = (c: Ramp, from = top, to = PH - 1) => {
    for (let y = from; y <= to; y++) { const [xl, xr] = ts(y); for (let x = xl; x <= xr; x++) p.set(x, y, x >= xr - 2 ? c.lo : c.base) }
  }
  // V opening (depth rows) exposing `c`
  const vee = (c: Ramp | Col, depth: number, wTop = nw + 1) => {
    for (let k = 0; k <= depth; k++) {
      const w = wTop * (1 - k / (depth + 1))
      if (w < 0.5) break
      p.span(top + k, Math.ceil(19.5 - w), Math.floor(19.5 + w), typeof c === 'number' ? c : c.base)
    }
  }
  const tie = (c: Ramp, from = top + 1) => {
    p.span(from, 19, 20, c.base)
    for (let y = from + 1; y < PH; y++) { p.set(19, y, c.base); p.set(20, y, c.lo); if (y > from + 3) { p.set(18, y, c.base); p.set(21, y, c.lo) } }
  }
  const bowtie = (c: Ramp, y = top + 1) => {
    p.span(y - 1, 16, 17, c.base); p.span(y, 16, 23, c.base); p.span(y + 1, 16, 17, c.base)
    p.span(y - 1, 22, 23, c.lo); p.span(y + 1, 22, 23, c.lo); p.span(y, 19, 20, c.dk)
  }
  const buttons = (c: Col, x = 19, from = top + 3, step = 3) => { for (let y = from; y < PH; y += step) p.set(x, y, c) }
  const collar = (c: Ramp) => { // shirt collar points
    p.span(top, nl - 1, nl + 1, c.base); p.span(top + 1, nl, nl + 2, c.base); p.set(nl + 1, top + 2, c.base)
    p.span(top, nr - 1, nr + 1, c.lo); p.span(top + 1, nr - 2, nr, c.lo); p.set(nr - 1, top + 2, c.lo)
  }
  const lapels = (c: Col, depth: number) => {
    for (let k = 0; k <= depth; k++) { const w = (nw + 1) * (1 - k / (depth + 1)); p.set(Math.ceil(19.5 - w) - 1, top + k, c); p.set(Math.floor(19.5 + w) + 1, top + k, c) }
  }
  const WHITE = ramp(COLORS.white)

  switch (kind) {
    case 'suit': case 'blazer': {
      fill(A); vee(WHITE, 7); lapels(A.dk, 7); if (kind === 'suit') tie(B); else collar(WHITE)
      break
    }
    case 'suit-bowtie': fill(A); vee(WHITE, 6); lapels(A.dk, 6); bowtie(B); break
    case 'tuxedo': fill(ramp(colour(s.outfitColor, COLORS.black))); vee(WHITE, 8); lapels(0x111111, 8); bowtie(B); buttons(0x222222, 19, top + 5, 2); break
    case 'shirt': case 'denim': fill(A); collar(ramp(light(A.base, 0.25))); buttons(A.dk); if (s.outfitColor2) tie(B); break
    case 'tshirt': fill(A); p.span(top, 17, 22, SK.lo); p.span(top + 1, 18, 21, SK.lo); p.span(top + 2, 17, 22, A.lo); break
    case 'polo': fill(A); vee(SK, 2, 2); collar(A); p.set(19, top + 2, B.base); p.set(19, top + 4, B.base); break
    case 'turtleneck': fill(A); for (let y = H.chin; y <= top + 1; y++) p.span(y, nl - 1, nr + 1, y === H.chin ? A.lo : A.base); p.set(nr + 1, H.chin + 1, A.lo); break
    case 'sweater': fill(A); vee(B, 4); collar(B); break
    case 'sweatervest': fill(B); for (let y = top + 2; y < PH; y++) { const [xl, xr] = ts(y); p.span(y, xl + 4, xr - 4, A.base) } vee(B, 6); tie(ramp(COLORS.navy), top + 1); break
    case 'cardigan': fill(A); vee(B, 9, nw + 2); if (s.extras?.includes('tie')) tie(ramp(COLORS.navy)); buttons(A.dk, 16, top + 4, 3); buttons(A.dk, 23, top + 4, 3); break
    case 'vest': fill(B); for (let y = top + 1; y < PH; y++) { const [xl, xr] = ts(y); p.span(y, xl + 2, 16, A.base); p.span(y, 23, xr - 2, A.lo) } collar(B); buttons(A.dk, 16, top + 4, 3); break
    case 'hoodie': {
      fill(A)
      for (let y = H.chin - 1; y <= top + 2; y++) { p.span(y, nl - 3, nl - 1, A.lo); p.span(y, nr + 1, nr + 3, A.lo) }
      vee(SK, 2, nw); p.set(17, top + 3, B.base); p.set(17, top + 4, B.base); p.set(22, top + 3, B.base); p.set(22, top + 4, B.base)
      break
    }
    case 'military': case 'uniform': {
      fill(A)
      for (let y = top - 1; y <= top + 1; y++) p.span(y, nl - 1, nr + 1, A.lo) // closed collar
      const [xl, xr] = ts(top + 3); p.span(top + 2, xl + 1, xl + 4, B.base); p.span(top + 2, xr - 4, xr - 1, B.base) // epaulettes
      buttons(B.base, 19, top + 3, 2)
      if (kind === 'military') { p.set(nl, top, B.base); p.set(nr, top, B.base) }
      break
    }
    case 'mao': fill(A); for (let y = top - 1; y <= top + 1; y++) p.span(y, nl, nr, y === top - 1 ? A.lo : A.base); buttons(A.dk, 19, top + 2, 2); p.span(top + 5, 13, 16, A.dk); p.span(top + 5, 23, 26, A.dk); break
    case 'robe': case 'monk': {
      fill(A)
      for (let y = top; y < PH; y++) { const [, xr] = ts(y); const edge = 19 + (y - top) * 1.4; for (let x = Math.ceil(edge); x <= xr; x++) p.set(x, y, kind === 'monk' ? (x >= xr - 1 ? SK.lo : SK.base) : B.base); p.set(Math.round(edge), y, A.dk) }
      break
    }
    case 'toga': case 'shawl': {
      // bare chest under a drape over the left shoulder
      fill(kind === 'shawl' ? SK : A)
      for (let y = top; y < PH; y++) { const [xl] = ts(y); const edge = 17 + (y - top) * 1.5; for (let x = xl; x <= Math.min(edge, 39); x++) p.set(x, y, x > edge - 1 ? A.lo : A.base) }
      if (kind === 'toga') for (let y = top + 2; y < PH; y += 3) p.span(y, 10 + (y - top), 12 + (y - top), A.lo)
      break
    }
    case 'cassock': fill(A); p.rect(18, top - 1, 4, 2, WHITE.base); buttons(A.dk, 19, top + 3, 2); break
    case 'papal': {
      fill(A)
      for (let y = top; y <= top + 5; y++) { const [xl, xr] = ts(y); p.span(y, xl, xr, y === top + 5 ? A.lo : A.base) } // mozzetta
      p.rect(18, top - 1, 4, 1, A.lo)
      p.set(19, top + 6, B.base); p.set(20, top + 6, B.base); p.span(top + 7, 18, 21, B.base); p.set(19, top + 8, B.base); p.set(20, top + 8, B.base); p.set(19, top + 9, B.base); p.set(20, top + 9, B.base)
      for (let y = top + 1; y <= top + 5; y++) p.set(19 + ((y - top) % 2), y, B.lo) // chain
      break
    }
    case 'habit': fill(A); for (let y = top - 1; y <= top + 3; y++) { const w = nw + 4 - Math.max(0, y - top); p.span(y, Math.ceil(19.5 - w), Math.floor(19.5 + w), WHITE.base) } break
    case 'sari': fill(WHITE); for (let y = top; y < PH; y++) { const [xl] = ts(y); const e = 15 + (y - top) * 1.2; p.set(Math.round(e), y, B.base); p.set(Math.round(e) + 1, y, B.base); p.set(Math.round(e) + 3, y, B.base) } p.span(top, 17, 22, SK.lo); break
    case 'kimono': fill(A); for (let k = 0; k < 10; k++) { p.set(15 + k, top + k, WHITE.base); p.set(16 + k, top + k, WHITE.lo); p.set(24 - Math.min(k, 4), top + k, A.dk) } break
    case 'dress': fill(A); for (let k = 0; k < 3; k++) p.span(top + k, 14 + k, 25 - k, SK.base); p.set(13, top, A.base); p.set(26, top, A.base); break
    case 'gown': fill(A); for (let y = top; y <= top + 2; y++) { const [xl, xr] = ts(y); p.span(y, xl, xr, y === top + 2 ? SK.lo : SK.base) } p.span(top + 3, 10, 29, B.base); break
    case 'jersey': {
      fill(A); p.span(top, 17, 22, B.base); p.span(top + 1, 18, 21, SK.lo); p.span(top + 2, 17, 22, B.base)
      const [xl, xr] = ts(top + 3); p.span(top + 3, xl, xl + 2, B.base); p.span(top + 3, xr - 2, xr, B.base)
      if (s.symbol) drawSymbol(p, s.symbol, 19.5, top + 7, B.base)
      break
    }
    case 'tank': case 'singlet': {
      fill(SK)
      for (let y = top + (kind === 'tank' ? 2 : 1); y < PH; y++) p.span(y, 14, 25, y < top + 3 ? A.base : A.base)
      for (let y = top; y < top + 3; y++) { p.span(y, 14, 15, A.base); p.span(y, 24, 25, A.lo) }
      p.span(top + 3, 16, 23, SK.lo)
      if (kind === 'singlet' && s.symbol) drawSymbol(p, s.symbol, 19.5, top + 7, B.base)
      break
    }
    case 'leather': fill(A); vee(ramp(colour(s.outfitColor2, COLORS.white)), 4); lapels(A.hi, 5); for (let y = top + 5; y < PH; y++) p.set(21, y, 0x9a9aa8); p.set(14, top + 6, A.hi); p.set(15, top + 7, A.hi); break
    case 'labcoat': fill(A); vee(ramp(colour(s.outfitColor2, COLORS.lightblue)), 6); lapels(A.lo, 7); tie(ramp(COLORS.navy), top + 2); p.span(top + 7, 12, 15, A.lo); break
    case 'chef': fill(A); for (let k = 0; k < 3; k++) p.span(top - 1 + k, 15, 24, A.lo); buttons(0x8a8a98, 16, top + 4, 3); buttons(0x8a8a98, 23, top + 4, 3); break
    case 'cape': {
      fill(A)
      // tall standing collar
      for (let y = H.chin - 5; y <= top + 2; y++) { const out = Math.max(0, (y - (H.chin - 5)) >> 1); p.span(y, nl - 4 - out, nl - 2, y < H.chin - 3 ? A.base : B.base); p.span(y, nr + 2, nr + 4 + out, y < H.chin - 3 ? A.lo : B.lo) }
      vee(WHITE, 4); bowtie(ramp(COLORS.black), top + 1)
      break
    }
    case 'armor': {
      fill(A)
      const [xl, xr] = ts(top + 3)
      p.ellipse(xl + 3, top + 3, 4, 3, A.hi); p.ellipse(xr - 3, top + 3, 4, 3, A.base)
      for (let y = top + 6; y < PH; y += 3) p.span(y, xl + 6, xr - 6, A.lo)
      p.span(top, nl - 1, nr + 1, A.dk)
      break
    }
    case 'hawaiian': fill(A); collar(ramp(light(A.base, 0.2))); for (let y = top + 2; y < PH; y += 3) for (let x = 6 + (y % 2) * 2; x < 34; x += 5) if (p.get(x, y) >= 0) { p.set(x, y, B.base); p.set(x + 1, y, B.lo) } break
    case 'tie-dye': fill(A); for (let y = top; y < PH; y++) for (let x = 0; x < PW; x++) if (p.get(x, y) >= 0 && ((x + y * 2) % 7 < 2)) p.set(x, y, B.base); break
    case 'overalls': fill(B); for (let y = top + 3; y < PH; y++) p.span(y, 13, 26, A.base); p.span(top, 14, 15, A.base); p.span(top, 24, 25, A.base); for (let y = top; y < top + 3; y++) { p.set(14, y, A.base); p.set(25, y, A.lo) } p.set(14, top + 3, 0xe8b83a); p.set(25, top + 3, 0xe8b83a); break
    case 'prison': fill(A); vee(SK, 2, 3); p.text('0' + ((H.chin * 7) % 10), 20, top + 4, A.dk); break
    case 'stripes': fill(A); for (let y = top + 1; y < PH; y += 3) { const [xl, xr] = ts(y); p.span(y, xl, xr, B.base); p.span(y + 1, xl, xr, B.base) } break
    case 'furcoat': case 'cravat': break
    case 'bare': case 'fur': case 'none': {
      if (kind === 'fur' && !furBody) { drawCoat(p, H, build, A, B, 'fur', SK); break }
      const F = furBody ?? SK
      fill(F)
      if (kind === 'bare') { p.span(top + 4, 14, 17, F.lo); p.span(top + 4, 22, 25, F.lo); p.set(19, top + 6, F.lo); p.set(19, top + 8, F.lo) }
      if (furBody && s.animal?.fur2) { const B2 = ramp(colour(s.animal.fur2, F.hi)); for (let y = top + 2; y < PH; y++) p.span(y, 15, 24, B2.base) }
      break
    }
    case 'regal': {
      fill(A)
      for (let y = top - 1; y <= top + 3; y++) { const sp = ts(Math.max(top, y)); p.span(y, sp[0], sp[1], WHITE.base) }
      for (let x = 6; x < 34; x += 3) p.set(x, top + 1 + (x % 2), 0x222222)
      p.span(top + 4, 12, 27, B.base); buttons(B.base, 19, top + 6, 3)
      break
    }
    case 'ruff': {
      fill(A)
      for (let y = H.chin - 1; y <= top + 2; y++) p.span(y, nl - 5, nr + 5, (y + 0) % 2 ? WHITE.base : WHITE.lo)
      for (let x = nl - 5; x <= nr + 5; x += 2) p.set(x, top + 3, WHITE.lo)
      buttons(B.base, 19, top + 5, 2)
      break
    }
    case 'tunic': case 'poncho': fill(A); vee(SK, 2, 3); if (kind === 'poncho') for (let y = top + 3; y < PH; y += 4) { const [xl, xr] = ts(y); p.span(y, xl, xr, B.base) } else p.span(PH - 3, 6, 33, B.base); break
    case 'tracksuit': fill(A); for (let y = top + 1; y < PH; y++) p.set(20, y, A.dk); const [txl, txr] = ts(top + 4); for (let y = top + 2; y < PH; y++) { p.set(txl + 1, y, B.base); p.set(txr - 1, y, B.base) } p.span(top - 1, nl, nr, A.lo); break
    case 'jumpsuit': fill(A); for (let y = H.chin - 2; y <= top + 2; y++) { p.span(y, nl - 3, nl - 1, A.base); p.span(y, nr + 1, nr + 3, A.lo) } vee(SK, 6, 3); for (let y = top + 3; y < PH; y += 2) { p.set(13, y, B.base); p.set(26, y, B.base) } break
    case 'emblem': {
      fill(A)
      p.ellipse(19.5, top + 6, 5, 4, B.base)
      drawSymbol(p, s.symbol ?? 'S', 19.5, top + 6, s.color ? colour(s.color, A.base) : A.base)
      break
    }
    case 'trenchcoat': fill(A); vee(ramp(COLORS.white), 5); lapels(A.dk, 7); tie(B, top + 1); for (let x = 9; x <= 30; x++) p.set(x, PH - 4, A.dk); break
    case 'scrubs': fill(A); vee(SK, 4, 3); p.span(top + 6, 12, 15, A.lo); break
    case 'sailor': fill(ramp(COLORS.white)); for (let y = top; y <= top + 4; y++) p.span(y, 10, 29, A.base); vee(SK, 4, 3); bowtie(ramp(COLORS.red), top + 4); break
    case 'spacesuit': fill(A); for (let y = top - 1; y <= top + 1; y++) p.span(y, nl - 2, nr + 2, 0x9a9aa8); p.rect(14, top + 5, 4, 3, B.base); p.rect(22, top + 5, 3, 2, 0x3f8ad6); break
    case 'kermit': {
      fill(A)
      for (let i = 0; i < 9; i++) { const x = 8 + i * 3; p.set(x, top + 3, A.lo); p.set(x + 1, top + 4, A.base); p.set(x, top + 4, A.lo) }
      break
    }
    default: fill(A)
  }
  if (kind === 'furcoat') drawCoat(p, H, build, A, B, 'fur', SK)
  if (kind === 'cravat') drawCoat(p, H, build, A, B, 'cravat', SK)
  if (s.pattern) drawPatternOver(p, H, build, s.pattern, A, ramp(colour(s.patternColor ?? s.outfitColor2, 0x2b2934)))
  // shoulder outline seam so heads separate from bodies of similar colour
  for (let x = nl; x <= nr; x++) if (p.get(x, H.chin + 1) === SK.dk) p.set(x, H.chin + 1, SK.dk)
}

function drawCoat(p: Pix, H: Head, build: string, A: Ramp, B: Ramp, style: 'fur' | 'cravat', SK: Ramp) {
  const top = torsoTop(H)
  const nw = NECK[build] ?? 4
  const nl = Math.ceil(19.5 - nw), nr = Math.floor(19.5 + nw)
  for (let y = top; y < PH; y++) { const [xl, xr] = torsoSpan(H, build, y)!; for (let x = xl; x <= xr; x++) p.set(x, y, x >= xr - 2 ? A.lo : A.base) }
  if (style === 'fur') {
    // big fluffy collar of B round the neck and down the front
    for (let y = H.chin; y <= top + 4; y++) { const w = Math.min(10, 4 + (y - H.chin)); p.span(y, nl - w + 3, nl + 1, y % 2 ? B.base : B.lo); p.span(y, nr - 1, nr + w - 3, y % 2 ? B.lo : B.base) }
    for (let y = top + 4; y < PH; y++) { p.span(y, 16, 17, y % 2 ? B.base : B.lo); p.span(y, 22, 23, y % 2 ? B.lo : B.base) }
    for (let y = top + 1; y < PH; y++) p.span(y, 18, 21, 0x2b2934)
    void SK
  } else {
    // high white stock collar and a puffed cravat under a dark coat
    const W = ramp(0xf4f1ea)
    for (let y = H.chin - 3; y <= top + 1; y++) { p.span(y, nl - 1, nl + 1, W.base); p.span(y, nr - 1, nr + 1, W.lo) }
    for (let y = H.chin; y <= top + 1; y++) p.span(y, nl + 2, nr - 2, W.base)
    p.ellipse(19.5, top + 3, 4, 3, (x) => (x > 21 ? W.lo : W.base))
    for (let k = 0; k < 6; k++) { p.set(13 - (k >> 1), top + 1 + k, A.dk); p.set(26 + (k >> 1), top + 1 + k, A.dk) }
  }
}

/** Paint a pattern over the outfit's own colours, leaving faces, ties and props alone. */
function drawPatternOver(p: Pix, H: Head, build: string, pattern: string, A: Ramp, C: Ramp) {
  const top = torsoTop(H)
  const own = new Set([A.base, A.lo, A.hi])
  const pat = pattern.toLowerCase()
  for (let y = top; y < PH; y++) {
    const [xl, xr] = torsoSpan(H, build, y)!
    for (let x = xl; x <= xr; x++) {
      const c = p.get(x, y)
      if (!own.has(c)) continue
      const shade = c === A.lo
      let n: Col | null = null
      switch (pat) {
        case 'leopard': { const k = (x * 7 + y * 13) % 11; if (k === 0 || k === 1) n = 0x3a2414; else if (k === 2) n = 0x8a5a24; break }
        case 'plaid': case 'tartan': if (x % 5 === 0 || y % 5 === 0) n = shade ? C.lo : C.base; if (x % 5 === 0 && y % 5 === 0) n = C.dk; break
        case 'camo': { const v = Math.sin(x * 0.9 + y * 0.3) + Math.sin(y * 0.8 - x * 0.4); if (v > 0.9) n = 0x4a5a2a; else if (v < -0.9) n = 0x6a5a3a; break }
        case 'pinstripes': if (x % 3 === 0) n = shade ? light(A.lo, 0.3) : light(A.base, 0.35); break
        case 'vstripes': if (Math.floor(x / 3) % 2 === 0) n = shade ? C.lo : C.base; break
        case 'hstripes': if (y % 3 === 0) n = shade ? C.lo : C.base; break
        case 'polka': if ((x % 4 === 1) && ((y + (Math.floor(x / 4) % 2) * 2) % 4 === 1)) n = C.base; break
        case 'zigzag': { const band = top + 6; const zz = band + Math.abs((x % 6) - 3) - 1; if (y >= zz && y <= zz + 1) n = C.base; break }
        case 'unionjack': {
          const dx = x + 0.5 - 19.5, dy = y + 0.5 - (top + 6)
          if (Math.abs(dx) <= 1.5 || Math.abs(dy) <= 1) n = 0xd8303a
          else if (Math.abs(dx) <= 2.5 || Math.abs(dy) <= 2) n = 0xf4f1ea
          else if (Math.abs(Math.abs(dx) - Math.abs(dy) * 1.6) < 1.2) n = 0xf4f1ea
          else n = 0x2a3d78
          break
        }
      }
      if (n !== null) p.set(x, y, n)
    }
  }
}

// ---------------------------------------------------------------------------
// hair

function hairShade(hc: Ramp, x: number, y: number, sp: [number, number], topY: number) {
  if (x >= sp[1] - 1) return hc.lo
  if (y <= topY + 2 && x >= 13 && x <= 16 && (x + y) % 2 === 0) return hc.hi
  return hc.base
}

function capFill(p: Pix, H: Head, hc: Ramp, from: number, to: number, expand = 1, lift = 1) {
  for (let y = from; y <= to; y++) {
    const sp = H.dome(y, expand, lift); if (!sp) continue
    for (let x = sp[0]; x <= sp[1]; x++) p.set(x, y, hairShade(hc, x, y, sp, H.top - lift))
  }
}

function sides(p: Pix, H: Head, hc: Ramp, from: number, to: number, width = 2, out = 1) {
  for (let y = from; y <= to; y++) {
    const sp = H.span(y) ?? H.span(H.eyeY)!
    for (let k = 0; k < width; k++) { p.set(sp[0] - out + k, y, hc.base); p.set(sp[1] + out - k, y, hc.lo) }
  }
}

const BACK_STYLES = new Set(['baldlong', 'bouffant', 'longbangs', 'highponytail', 'quills', 'long', 'longwavy', 'bob', 'afro', 'wild', 'dreads', 'mullet', 'ponytail', 'pigtails', 'beehive', 'rocker', 'braids', 'mane', 'curlylong', 'shoulder', 'shaggy'])

function drawHairBack(p: Pix, H: Head, style: string, hc: Ramp) {
  const st = style.replace(/[-_\s]/g, '')
  if (!BACK_STYLES.has(st)) return
  const chinish = H.chin
  switch (st) {
    case 'long': case 'longwavy': case 'rocker': case 'dreads': case 'curlylong': case 'braids': {
      const bottom = 44
      for (let y = H.top; y <= bottom; y++) {
        const sp = H.dome(Math.min(y, H.eyeY), 3, 1) ?? [8, 31]
        const wave = st === 'longwavy' || st === 'curlylong' ? ((y >> 1) % 2) : 0
        const shrink = y > chinish + 4 ? Math.min(3, (y - chinish - 4) >> 1) : 0
        for (let x = sp[0] - wave + shrink; x <= sp[1] + wave - shrink; x++) {
          const strand = st === 'dreads' || st === 'braids' ? (x % 3 === 0 ? hc.dk : x % 3 === 1 ? hc.base : hc.lo) : x >= sp[1] - 2 ? hc.lo : hc.base
          p.set(x, y, strand)
        }
      }
      break
    }
    case 'shoulder': case 'shaggy': {
      for (let y = H.top; y <= chinish + 3; y++) { const sp = H.dome(Math.min(y, H.eyeY), 2, 1) ?? [9, 30]; for (let x = sp[0]; x <= sp[1]; x++) p.set(x, y, x >= sp[1] - 1 ? hc.lo : hc.base) }
      break
    }
    case 'bob': {
      for (let y = H.top; y <= chinish; y++) { const sp = H.dome(Math.min(y, H.eyeY), 2, 1) ?? [9, 30]; for (let x = sp[0]; x <= sp[1]; x++) p.set(x, y, x >= sp[1] - 1 ? hc.lo : hc.base) }
      break
    }
    case 'afro': p.ellipse(19.5, H.top + 7, 15, 13, (x, y) => ((x * 7 + y * 3) % 5 === 0 ? hc.lo : x > 26 ? hc.lo : hc.base)); break
    case 'wild': {
      p.ellipse(19.5, H.top + 6, H.hw + 6, 11, (x, y) => (x > 27 ? hc.lo : (x + y) % 4 === 0 ? hc.hi : hc.base))
      for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI; const x = 19.5 - Math.cos(a) * (H.hw + 7); const y = H.top + 6 - Math.sin(a) * 11; p.set(x, y, hc.base); p.set(x + (i < 4 ? -1 : 1), y - 1, hc.base) }
      break
    }
    case 'mane': p.ellipse(19.5, H.eyeY, H.hw + 7, (H.chin - H.top) / 2 + 6, (x, y) => ((x + y * 2) % 5 === 0 ? hc.dk : x > 26 ? hc.lo : hc.base)); break
    case 'mullet': for (let y = H.eyeY; y <= H.chin + 5; y++) { p.span(y, 7, 11, hc.base); p.span(y, 28, 32, hc.lo) } break
    case 'baldlong': for (let y = H.eyeY - 3; y <= H.chin + 6; y++) { const sh = y > H.chin ? (y - H.chin) >> 1 : 0; p.span(y, 7 + sh, 11, hc.base); p.span(y, 28, 32 - sh, hc.lo) } break
    case 'bouffant': p.ellipse(19.5, H.top + 4, H.hw + 5, 9, (x, y) => (x > 26 ? hc.lo : (x + y) % 5 === 0 ? hc.hi : hc.base)); for (let y = H.eyeY; y <= H.chin - 1; y++) { p.span(y, 7, 10, hc.base); p.span(y, 29, 32, hc.lo) } break
    case 'longbangs': for (let y = H.top; y <= 44; y++) { const sp = H.dome(Math.min(y, H.eyeY), 3, 1) ?? [8, 31]; const sh = y > H.chin + 4 ? Math.min(3, (y - H.chin - 4) >> 1) : 0; for (let x = sp[0] + sh; x <= sp[1] - sh; x++) p.set(x, y, x >= sp[1] - 2 ? hc.lo : hc.base) } break
    case 'highponytail': for (let y = H.top - 6; y <= H.chin + 4; y++) { const x0 = 27 + Math.min(4, Math.max(0, (y - H.top) >> 2)); p.span(y, x0, x0 + 2, y < H.top ? hc.base : hc.lo) } break
    case 'quills': for (let k = 0; k < 4; k++) { const y0 = H.top + 2 + k * 5; p.trap(y0, y0 + 4, 30, 31, 22, 31, hc.lo); p.trap(y0, y0 + 4, 8, 9, 8, 17, hc.base) } break
    case 'ponytail': for (let y = H.eyeY - 2; y <= H.chin + 8; y++) p.span(y, 29 + (y > H.chin ? 1 : 0), 31 + (y > H.chin ? 1 : 0), hc.lo); break
    case 'pigtails': p.ellipse(7, H.eyeY + 4, 3, 6, hc.base); p.ellipse(32, H.eyeY + 4, 3, 6, hc.lo); break
    case 'beehive': p.ellipse(19.5, H.top - 6, H.hw - 1, 12, (x, y) => (x > 24 ? hc.lo : (x + y) % 6 === 0 ? hc.hi : hc.base)); break
  }
}

function drawHairFront(p: Pix, H: Head, style: string, hc: Ramp, SK: Ramp, hatHides: boolean) {
  const st = style.replace(/[-_\s]/g, '')
  const hl = H.hl
  const shadowForehead = () => { for (let x = 11; x <= 28; x++) { const c = p.get(x, hl + 1); if (c === SK.base || c === SK.hi) p.set(x, hl + 1, SK.lo) } }
  switch (st) {
    case 'bald': case 'none': case '': {
      if (!hatHides) { p.set(14, H.top + 2, SK.hi); p.set(15, H.top + 2, SK.hi); p.set(14, H.top + 3, SK.hi) }
      break
    }
    case 'baldsides': case 'horseshoe': sides(p, H, hc, H.hl - 1, H.eyeY, 2, 1); break
    case 'receding': capFill(p, H, hc, H.top - 1, H.top + 2, 0, 1); sides(p, H, hc, H.top + 2, H.eyeY - 1, 2, 1); break
    case 'buzz': {
      const bc = mixc(hc.base, SK.lo, 0.35)
      for (let y = H.top; y <= hl; y++) { const sp = H.span(y)!; for (let x = sp[0]; x <= sp[1]; x++) if ((x + y) % 2 === 0 || y < hl) p.set(x, y, x >= sp[1] - 1 ? dark(bc, 0.2) : bc) }
      break
    }
    case 'short': case 'messy': case 'crew': case 'curly': case 'pixie': {
      capFill(p, H, hc, H.top - (st === 'messy' || st === 'curly' ? 2 : 1), hl, 1, st === 'messy' || st === 'curly' ? 2 : 1)
      sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1)
      if (st === 'messy' || st === 'curly') for (let x = 10; x <= 29; x += 2) { p.set(x, H.top - 2 - ((x >> 1) % 2), hc.base); p.set(x, hl + 1, hc.lo) }
      if (st === 'curly') for (let y = H.top; y <= hl; y++) for (let x = 9; x <= 30; x++) if (p.get(x, y) === hc.base && (x * 3 + y * 5) % 7 === 0) p.set(x, y, hc.lo)
      if (st === 'crew') p.span(H.top - 1, 13, 26, hc.base)
      if (st === 'pixie') { sides(p, H, hc, hl + 1, H.eyeY + 1, 2, 1); for (let x = 12; x < 18; x++) p.set(x, hl + 1, hc.base) }
      shadowForehead()
      break
    }
    case 'sidepart': case 'sidefringe': {
      capFill(p, H, hc, H.top - 1, hl, 1, 1)
      sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1)
      // part line and a fringe that sweeps across the forehead
      p.set(14, H.top, SK.base); p.set(14, H.top + 1, SK.lo)
      if (st === 'sidefringe') for (let k = 0; k < 9; k++) { p.set(13 + k, hl + 1 + (k >> 2), hc.base); p.set(13 + k, hl + 2 + (k >> 2), k < 7 ? hc.lo : -1) }
      else for (let k = 0; k < 6; k++) p.set(22 + k, hl + 1, hc.base)
      shadowForehead()
      break
    }
    case 'slick': case 'slicked': case 'widow': case 'widowspeak': {
      capFill(p, H, hc, H.top - 1, hl - 1, 1, 1)
      sides(p, H, hc, hl, H.eyeY - 1, 2, 1)
      for (let x = 12; x <= 27; x += 3) p.set(x, H.top + 1, hc.hi)
      if (st.startsWith('widow')) { p.span(hl, 18, 21, hc.base); p.span(hl + 1, 19, 20, hc.base) }
      break
    }
    case 'pompadour': case 'quiff': case 'elvis': {
      capFill(p, H, hc, H.top - 1, hl - 1, 1, 1)
      p.ellipse(18.5, H.top - 1, 8, 4, (x, y) => (x > 23 ? hc.lo : (y === H.top - 3 && x < 18) ? hc.hi : hc.base))
      sides(p, H, hc, hl, H.eyeY + 3, 2, 1)
      break
    }
    case 'zigzag': {
      // A flat cartoon crown joins the full forehead; it is not a row of
      // triangles balanced on the narrow tip of an elliptical scalp.
      const [left, right] = H.dome(hl, 1, 1)!
      for (let x = left; x <= right; x++) {
        const top = H.top - 3 + [0, 1, 2, 1][(x - left) % 4]
        for (let y = top; y <= hl; y++) p.set(x, y, x >= right - 2 ? hc.lo : hc.base)
      }
      sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1)
      break
    }
    case 'spiky': case 'anime': {
      // Anchor each tuft to its own point on the scalp, and fill down to
      // the hairline. Fixed-height bases left wide floating shelves.
      const [left, right] = H.dome(hl, 1, 1)!
      const peaks = st === 'anime' ? [1, 3, 5, 2, 0] : [0, 2, 3, 1, 0]
      for (let x = left; x <= right; x++) {
        let root = H.top - 1
        for (; root < hl; root++) {
          const span = H.dome(root, 1, 1)
          if (span && x >= span[0] && x <= span[1]) break
        }
        const top = Math.max(1, root - peaks[(x - left) % peaks.length])
        for (let y = top; y <= hl; y++) p.set(x, y, x >= right - 2 ? hc.lo : hc.base)
        if (x < H.cx && (x - left) % 5 === 2) p.set(x, top + 2, hc.hi)
      }
      sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1)
      if (st === 'anime') for (let k = 0; k < 7; k++) p.set(13 + k * 2, hl + 1 + (k % 2), hc.base)
      shadowForehead()
      break
    }
    case 'wild': capFill(p, H, hc, H.top - 2, H.top + 2, 2, 2); for (let x = 11; x < 29; x += 3) p.set(x, H.top + 3, hc.base); break
    case 'afro': capFill(p, H, hc, H.top - 1, hl - 1, 2, 1); break
    case 'mane': break
    case 'mohawk': {
      const bc = mixc(hc.base, SK.lo, 0.5)
      for (let y = H.top; y <= hl; y++) { const sp = H.span(y)!; for (let x = sp[0]; x <= sp[1]; x++) if ((x + y) % 2 === 0) p.set(x, y, bc) }
      for (let y = H.top - 6; y <= hl; y++) p.span(y, 18, 21, y < H.top - 3 && (y % 2) ? hc.lo : hc.base)
      break
    }
    case 'combover': case 'trump': {
      capFill(p, H, hc, H.top - 2, hl, 2, 2)
      sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 2)
      for (let x = 10; x <= 27; x++) p.set(x, H.top - 2 + Math.round((x - 10) / 9), hc.hi)
      p.ellipse(13, hl - 1, 4, 2.5, hc.base)
      p.span(hl + 1, 10, 16, hc.base)
      shadowForehead()
      break
    }
    case 'bowl': case 'mop': case 'shaggy': {
      capFill(p, H, hc, H.top - 1, H.eyeY - 3, 1, 1)
      const to = st === 'bowl' ? H.eyeY - 1 : H.eyeY + 3
      sides(p, H, hc, H.eyeY - 2, to, 3, 1)
      for (let x = 11; x <= 28; x++) p.set(x, H.eyeY - 3, x >= 27 ? hc.lo : hc.base)
      break
    }
    case 'fringe': case 'bangs': case 'long': case 'longwavy': case 'bob': case 'shoulder': case 'rocker': case 'dreads': case 'braids': case 'curlylong': {
      capFill(p, H, hc, H.top - 1, hl, 1, 1)
      if (st === 'fringe' || st === 'bangs' || st === 'bob') for (let y = hl + 1; y <= H.eyeY - 3; y++) { const sp = H.span(y)!; p.span(y, sp[0], sp[1], hc.base); p.set(sp[1], y, hc.lo) }
      else { p.set(19, H.top, SK.lo); p.set(20, H.top, SK.lo); p.set(19, H.top + 1, SK.lo); for (let k = 0; k < 4; k++) { p.set(14 - k, hl + 1 + k, hc.base); p.set(25 + k, hl + 1 + k, hc.lo) } }
      // strands framing the face
      for (let y = hl + 1; y <= H.chin - 2; y++) { const sp = H.span(y)!; p.span(y, sp[0] - 1, sp[0], hc.base); p.span(y, sp[1], sp[1] + 1, hc.lo) }
      if (st === 'dreads' || st === 'braids') for (let y = hl + 1; y <= H.chin - 2; y += 2) { const sp = H.span(y)!; p.set(sp[0] - 1, y, hc.dk); p.set(sp[1] + 1, y, hc.dk) }
      shadowForehead()
      break
    }
    case 'bun': case 'topknot': {
      capFill(p, H, hc, H.top - 1, hl - 1, 1, 1)
      sides(p, H, hc, hl, H.eyeY - 1, 1, 1)
      if (st === 'bun') p.ellipse(19.5, H.top - 3, 4, 3, (x) => (x > 21 ? hc.lo : hc.base))
      else { p.ellipse(19.5, H.top - 3, 2.5, 2.5, (x) => (x > 20 ? hc.lo : hc.base)); p.set(19, H.top - 6, hc.base); p.set(20, H.top - 7, hc.base) }
      for (let x = 13; x <= 26; x += 3) p.set(x, H.top + 1, hc.hi)
      break
    }
    case 'wig': {
      // 18th-century powdered wig: smooth top with rolled curls over the ears
      capFill(p, H, hc, H.top - 2, hl - 1, 1, 2)
      for (const yy of [H.eyeY - 2, H.eyeY + 1]) { p.ellipse(9.5, yy, 2.6, 1.6, hc.base); p.ellipse(30, yy, 2.6, 1.6, hc.lo); p.set(9, yy, hc.lo); p.set(30, yy, hc.dk) }
      for (let x = 12; x <= 27; x += 3) p.set(x, H.top, hc.hi)
      break
    }
    case 'baldlong': sides(p, H, hc, H.eyeY - 3, H.eyeY + 2, 2, 1); break
    case 'bouffant': capFill(p, H, hc, H.top - 3, hl, 3, 4); sides(p, H, hc, hl + 1, H.eyeY + 2, 2, 2); for (let x = 12; x <= 27; x += 3) p.set(x, H.top - 1, hc.hi); shadowForehead(); break
    case 'longbangs': capFill(p, H, hc, H.top - 1, hl, 1, 1); for (let y = hl + 1; y <= H.eyeY - 3; y++) { const sp = H.span(y)!; p.span(y, sp[0], sp[1], hc.base); p.set(sp[1], y, hc.lo) } for (let y = hl + 1; y <= H.chin - 2; y++) { const sp = H.span(y)!; p.span(y, sp[0] - 1, sp[0], hc.base); p.span(y, sp[1], sp[1] + 1, hc.lo) } break
    case 'highponytail': capFill(p, H, hc, H.top - 1, hl - 1, 1, 1); sides(p, H, hc, hl, H.eyeY - 1, 1, 1); p.ellipse(25, H.top - 3, 2.5, 2.5, hc.base); break
    case 'quills': capFill(p, H, hc, H.top - 2, hl + 1, 2, 2); for (let k = 0; k < 4; k++) p.set(13 + k * 4, hl + 2, hc.base); break
    case 'cornrows': { capFill(p, H, hc, H.top - 1, hl, 0, 1); for (let y = H.top - 1; y <= hl; y++) for (let x = 10; x <= 29; x++) if (p.get(x, y) === hc.base && x % 3 === 0) p.set(x, y, hc.dk); break }
    case 'ponytail': case 'pigtails': capFill(p, H, hc, H.top - 1, hl, 1, 1); sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1); shadowForehead(); break
    case 'beehive': capFill(p, H, hc, H.top - 1, hl, 1, 1); sides(p, H, hc, hl + 1, H.eyeY, 2, 1); break
    case 'mullet': capFill(p, H, hc, H.top - 2, hl, 1, 2); sides(p, H, hc, hl + 1, H.eyeY + 2, 2, 1); for (let x = 12; x < 28; x += 2) p.set(x, hl + 1, hc.base); break
    case 'undercut': case 'kimjongun': {
      const bc = mixc(hc.base, SK.lo, 0.55)
      for (let y = hl - 2; y <= H.eyeY - 1; y++) { const sp = H.span(y)!; p.set(sp[0], y, bc); p.set(sp[0] + 1, y, bc); p.set(sp[1], y, bc); p.set(sp[1] - 1, y, bc) }
      for (let y = H.top - 3; y <= hl - 2; y++) { const sp = H.dome(Math.max(y, H.top), 0, 0) ?? [12, 27]; p.span(y, Math.max(sp[0], 11), Math.min(sp[1], 28), y === H.top - 3 ? hc.hi : hc.base); p.set(Math.min(sp[1], 28), y, hc.lo) }
      p.span(hl - 1, 13, 22, hc.base)
      break
    }
    case 'homer': {
      // two hairs on top and the zigzag above the ears
      const c = hc.dk
      p.set(17, H.top - 1, c); p.set(18, H.top - 2, c); p.set(19, H.top - 2, c); p.set(20, H.top - 1, c)
      p.set(19, H.top - 1, c); p.set(20, H.top - 3, c); p.set(21, H.top - 3, c); p.set(22, H.top - 2, c)
      for (const side of [0, 1]) {
        const sp = H.span(H.eyeY - 2)!
        const x0 = side ? sp[1] - 2 : sp[0]
        p.set(x0, H.eyeY - 3, c); p.set(x0 + 1, H.eyeY - 2, c); p.set(x0 + 2, H.eyeY - 3, c); p.set(x0 + 1, H.eyeY - 4, c)
      }
      break
    }
    case 'tuft': p.set(19, H.top - 1, hc.dk); p.set(20, H.top - 2, hc.dk); p.set(21, H.top - 1, hc.dk); p.set(18, H.top - 2, hc.dk); break
    case 'flattop': {
      // Carry the flat top's sides all the way down to its hairline; narrowing
      // to the dome halfway down makes a detached-looking horizontal shelf.
      const [left, right] = H.dome(hl, 0, 0)!
      for (let y = Math.max(1, H.top - 3); y <= hl; y++) {
        p.span(y, left, right, y === H.top - 3 ? hc.hi : hc.base)
        p.set(right, y, hc.lo)
      }
      sides(p, H, hc, hl + 1, H.eyeY - 1, 1, 0)
      shadowForehead()
      break
    }
    case 'tonsure': sides(p, H, hc, H.top + 2, H.eyeY - 1, 3, 1); p.span(H.top + 1, 11, 28, hc.base); break
    case 'wisps': for (let x = 9; x <= 30; x += 3) { if (x > 13 && x < 26) continue; p.set(x, H.top + 2 + (x % 2), hc.base); p.set(x - 1, H.top + 1 + (x % 2), hc.base) } sides(p, H, hc, H.top + 3, H.eyeY, 1, 1); break
    case 'partmiddle': capFill(p, H, hc, H.top - 1, hl, 1, 1); sides(p, H, hc, hl + 1, H.eyeY, 2, 1); p.set(19, H.top, SK.base); p.set(20, H.top, SK.base); p.set(19, H.top + 1, SK.lo); for (let k = 0; k < 3; k++) { p.set(17 - k, hl + 1 + k, hc.base); p.set(22 + k, hl + 1 + k, hc.lo) } shadowForehead(); break
    default: capFill(p, H, hc, H.top - 1, hl, 1, 1); sides(p, H, hc, hl + 1, H.eyeY - 1, 2, 1); shadowForehead()
  }
}

// ---------------------------------------------------------------------------
// face features

function eyeCols(H: Head) {
  const outer = H.hw >= 10 ? 14 : 15
  return { outer, inner: 17 }
}

function drawEyes(p: Pix, H: Head, s: PortraitSpec, SK: Ramp, frame: Frame) {
  const style = (s.eyes ?? 'normal').toLowerCase()
  const iris = colour(s.eyeColor, 0x2a1a14, { brown: 0x5a3418, blue: 0x2f6fd6, green: 0x2f8a4a, grey: 0x6a7a8a, hazel: 0x7a6a2a, red: 0xe0302a, yellow: 0xf2c230, black: 0x15111e, purple: 0x7a3fb0 })
  const W = 0xfaf6f0
  const lid = dark(SK.base, 0.62)
  const y0 = H.eyeY, y1 = H.eyeY + 1
  const { outer, inner } = eyeCols(H)
  const blink = frame === 'blink'
  const bothSides = (fn: (x0: number, x1: number, mirror: boolean) => void) => { fn(outer, inner, false); fn(39 - inner, 39 - outer, true) }

  if (blink && style !== 'glow' && style !== 'frog' && style !== 'googly') {
    if (style === 'cyclops') { p.span(y1, 17, 22, lid); return }
    if (style === 'big' || style === 'cartoon') { bothSides((a, b) => { p.span(y0, a - 1, b, SK.lo); p.span(y0 + 1, a - 1, b, lid) }); return }
    bothSides((a, b) => p.span(y1, a, b, lid))
    return
  }
  switch (style) {
    case 'small': case 'beady': bothSides((a, b, m) => { p.set(m ? a + 1 : b - 2, y1, iris); p.set(m ? a + 2 : b - 1, y1, iris); p.set(m ? a + 1 : b - 2, y0, lid) }); break
    case 'dots': bothSides((a, b, m) => { const x = m ? a + 1 : b - 1; p.set(x, y0, 0x15111e); p.set(x, y1, 0x15111e) }); break
    case 'narrow': case 'squint': bothSides((a, b) => { p.span(y1, a, b, lid); p.set(a + 1, y1, iris); p.set(a + 2, y1, iris) }); break
    case 'sleepy': bothSides((a, b) => { p.span(y0, a, b, lid); p.span(y1, a, b, W); p.set(a + 1, y1, iris); p.set(a + 2, y1, iris); p.set(a, y1, lid); p.set(b, y1, lid) }); break
    case 'closed': case 'happy': bothSides((a, b) => { p.set(a, y1, lid); p.set(b, y1, lid); p.span(y0, a + 1, b - 1, lid) }); break
    case 'angry': bothSides((a, b, m) => { p.span(y0, a, b, lid); p.span(y1, a, b, W); p.set(a + 1, y1, iris); p.set(a + 2, y1, iris); p.set(m ? a : b, y1, lid) }); break
    case 'wide': case 'crazy': bothSides((a, b) => { p.span(y0 - 1, a, b, lid); p.span(y0, a, b, W); p.span(y1, a, b, W); p.set(a + 1, y0, iris); p.set(a + 2, y0, iris); p.set(a + 1, y1, iris); p.set(a + 2, y1, iris); if (style === 'crazy') { p.set(a + 2, y0, W); p.set(a + 1, y1, W) } }); break
    case 'big': case 'cartoon': {
      bothSides((a, b, m) => {
        const cx = (a + b + 1) / 2 + (m ? 0.5 : -0.5)
        p.ellipse(cx, y0 + 0.5, 3.2, 3.2, lid); p.ellipse(cx, y0 + 0.5, 2.3, 2.3, W)
        p.set(Math.floor(cx) + (m ? -1 : 0), y0, 0x15111e)
      })
      break
    }
    case 'pingpong': case 'googly': {
      bothSides((a, b, m) => {
        const cx = (a + b + 1) / 2 + (m ? 0.5 : -0.5)
        const cy = style === 'googly' ? H.top + 1 : y0 - 1
        p.ellipse(cx, cy, 3.4, 3.4, lid); p.ellipse(cx, cy, 2.6, 2.6, W)
        const ox = style === 'googly' ? (m ? -1 : 1) : 0
        p.rect(Math.floor(cx) - 1 + ox, Math.floor(cy) - (style === 'googly' ? 0 : 1), 2, 2, 0x15111e)
      })
      break
    }
    case 'frog': {
      bothSides((a, b, m) => {
        const cx = m ? 25.5 : 14
        p.ellipse(cx, H.top + 1, 4, 3.6, SK.base); p.ellipse(cx, H.top + 1, 3, 2.6, W)
        p.rect(Math.floor(cx) - 1, H.top, 2, 2, 0x15111e)
        p.span(H.top + 1, Math.floor(cx) - 2, Math.floor(cx) + 2, blink ? lid : -1)
        if (!blink) p.rect(Math.floor(cx) - 1, H.top, 2, 2, 0x15111e)
      })
      break
    }
    case 'cyclops': p.ellipse(19.5, y0 + 0.5, 4, 2.6, lid); p.ellipse(19.5, y0 + 0.5, 3, 1.8, W); p.rect(19, y0, 2, 2, iris); break
    case 'glow': bothSides((a, b) => { p.span(y0, a, b, iris); p.span(y1, a, b, dark(iris, 0.3)); p.set(a, y0, light(iris, 0.5)) }); break
    case 'hollow': bothSides((a, b) => { p.span(y0, a, b, 0x15111e); p.span(y1, a, b, 0x15111e) }); break
    default: bothSides((a, b) => { p.span(y0, a, b, lid); p.span(y1, a, b, W); p.set(a + 1, y1, iris); p.set(a + 2, y1, iris) })
  }
}

function drawBrows(p: Pix, H: Head, s: PortraitSpec, color: Col) {
  const style = (s.brows ?? 'normal').toLowerCase()
  if (style === 'none') return
  const { outer, inner } = eyeCols(H)
  const by = H.eyeY - 2
  const both = (fn: (a: number, b: number, m: boolean) => void) => { fn(outer, inner, false); fn(39 - inner, 39 - outer, true) }
  switch (style) {
    case 'thin': both((a, b) => p.span(by, a + 1, b, color)); break
    case 'thick': both((a, b) => { p.span(by, a, b, color); p.span(by - 1, a + 1, b - 1, color) }); break
    case 'bushy': both((a, b, m) => { p.span(by, a - 1, b + 0, color); p.span(by - 1, a, b, color); p.set(m ? b + 1 : a - 1, by - 2, color) }); break
    case 'angry': both((a, b, m) => { p.set(m ? b : a, by - 1, color); p.set(m ? b - 1 : a + 1, by - 1, color); p.set(m ? b - 2 : a + 2, by, color); p.set(m ? a : b, by + 1, color); p.set(m ? a + 1 : b - 1, by, color) }); break
    case 'sad': case 'worried': both((a, b, m) => { p.set(m ? b : a, by + 1, color); p.set(m ? b - 1 : a + 1, by, color); p.set(m ? b - 2 : a + 2, by, color); p.set(m ? a : b, by - 1, color) }); break
    case 'oneraised': case 'peoples': { const a = outer, b = inner; p.span(by - 1, a + 1, b - 1, color); p.set(a, by, color); const ra = 39 - inner, rb = 39 - outer; p.span(by - 3, ra + 1, rb - 1, color); p.set(ra, by - 2, color); p.set(rb, by - 2, color); break }
    case 'raised': both((a, b) => { p.span(by - 2, a + 1, b - 1, color); p.set(a, by - 1, color); p.set(b, by - 1, color) }); break
    case 'unibrow': p.span(by, outer, 39 - outer, color); p.span(by - 1, outer + 1, 38 - outer, color); break
    default: both((a, b, m) => { p.span(by - 1, a + 1, b - 1, color); p.set(m ? b : a, by, color) })
  }
}

function drawNose(p: Pix, H: Head, s: PortraitSpec, SK: Ramp) {
  const style = (s.nose ?? 'normal').toLowerCase()
  const y = H.eyeY + 4
  switch (style) {
    case 'none': break
    case 'slits': p.set(18, y, SK.dk); p.set(21, y, SK.dk); break
    case 'button': case 'small': p.set(19, y, SK.lo); p.set(20, y, SK.lo); break
    case 'big': case 'mario': {
      const c = s.noseColor ? colour(s.noseColor, SK.base) : SK.base
      p.ellipse(19.5, y - 0.5, 3, 2.5, c); p.span(y + 1, 17, 22, SK.lo); p.set(21, y - 1, dark(c, 0.15)); p.set(18, y - 2, light(c, 0.3))
      break
    }
    case 'long': case 'hooked': for (let k = 1; k <= 4; k++) p.set(20, H.eyeY + k, SK.lo); p.span(y + 1, 18, 21, SK.lo); if (style === 'hooked') { p.set(21, H.eyeY + 2, SK.lo); p.set(21, H.eyeY + 3, SK.lo) } break
    case 'droopy': for (let k = 1; k <= 7; k++) { p.span(H.eyeY + k, 18, 21, SK.base); p.set(21, H.eyeY + k, SK.lo) } p.span(H.eyeY + 8, 18, 21, SK.lo); break
    case 'ball': case 'red': case 'clown': {
      const c = colour(s.noseColor ?? 'red', 0xe0302a)
      p.ellipse(19.5, y - 0.5, 2.2, 2, c); p.set(18, y - 2, light(c, 0.5))
      break
    }
    case 'pig': p.ellipse(19.5, y - 0.5, 3, 2, light(SK.base, 0.15)); p.set(18, y - 1, SK.dk); p.set(21, y - 1, SK.dk); break
    case 'beak': case 'duck': {
      const c = colour(s.noseColor ?? 'orange', 0xf28a2a)
      if (style === 'duck') { p.ellipse(19.5, y, 5, 2.4, c); p.span(y + 1, 15, 24, dark(c, 0.3)); p.set(17, y - 1, dark(c, 0.4)); p.set(22, y - 1, dark(c, 0.4)) }
      else { p.trap(y - 2, y + 2, 18, 21, 19, 20, c); p.set(21, y - 1, dark(c, 0.3)) }
      break
    }
    default: p.set(20, H.eyeY + 2, SK.lo); p.set(20, H.eyeY + 3, SK.lo); p.span(y, 18, 21, SK.lo); p.set(19, y - 1, SK.hi)
  }
}

function drawMouth(p: Pix, H: Head, s: PortraitSpec, SK: Ramp, frame: Frame) {
  let style = (s.mouth ?? 'neutral').toLowerCase()
  const lip = s.lipColor ? colour(s.lipColor, 0xb02a3a) : mixc(dark(SK.base, 0.55), 0x8a2a2a, 0.35)
  const y = H.mouthY
  const W = 0xfaf6f0
  const inside = 0x3a1020
  if (frame === 'talk') {
    if (style === 'muppet' || style === 'wide') { p.span(y, 13, 26, inside); p.span(y + 1, 14, 25, inside); p.span(y + 2, 16, 23, inside); p.span(y + 2, 17, 22, 0xd04060); return }
    p.span(y, 18, 21, inside); p.span(y + 1, 18, 21, inside); p.set(19, y + 1, 0xd04060); p.set(20, y + 1, 0xd04060)
    if (style === 'lipstick') { p.span(y - 1, 18, 21, lip); p.span(y + 2, 18, 21, lip) }
    if (style === 'teeth' || style === 'buck') { p.set(19, y, W); p.set(20, y, W) }
    return
  }
  switch (style) {
    case 'smile': p.span(y, 18, 21, lip); p.set(17, y - 1, lip); p.set(22, y - 1, lip); break
    case 'grin': p.span(y, 17, 22, W); p.span(y - 1, 17, 22, lip); p.span(y + 1, 18, 21, lip); p.set(16, y - 1, lip); p.set(23, y - 1, lip); break
    case 'frown': p.span(y, 18, 21, lip); p.set(17, y + 1, lip); p.set(22, y + 1, lip); break
    case 'smirk': p.span(y, 17, 21, lip); p.set(22, y - 1, lip); break
    case 'open': case 'shout': p.rect(18, y - 1, 4, 3, inside); p.span(y + 1, 19, 20, 0xd04060); break
    case 'o': p.rect(19, y - 1, 2, 2, inside); break
    case 'tongue': p.rect(17, y - 1, 6, 2, inside); for (let k = 0; k < 6; k++) p.span(y + 1 + k, 18 - (k > 3 ? 0 : 0), 21, k === 5 ? 0xb03050 : 0xe05070); break
    case 'teeth': case 'buck': p.span(y, 17, 22, lip); p.set(19, y + 1, W); p.set(20, y + 1, W); break
    case 'lipstick': p.span(y, 17, 22, lip); p.span(y - 1, 18, 21, lip); p.span(y + 1, 18, 21, dark(lip, 0.2)); break
    case 'fangs': p.span(y, 17, 22, lip); p.set(18, y + 1, W); p.set(21, y + 1, W); break
    case 'muppet': case 'wide': p.span(y, 12, 27, inside); p.set(11, y - 1, inside); p.set(28, y - 1, inside); p.span(y + 1, 15, 24, dark(SK.base, 0.4)); break
    case 'bigsmile': case 'joker': p.span(y, 15, 24, lip); p.set(14, y - 1, lip); p.set(25, y - 1, lip); p.set(13, y - 2, lip); p.set(26, y - 2, lip); p.span(y + 1, 17, 22, lip); if (style === 'joker') p.span(y, 16, 23, W); break
    case 'gold': case 'grill': p.span(y, 17, 22, 0xe8b83a); p.span(y - 1, 17, 22, lip); break
    case 'gap': p.span(y, 17, 22, W); p.set(19, y, inside); p.span(y - 1, 17, 22, lip); break
    case 'none': break
    default: p.span(y, 18, 21, lip)
  }
}

function drawFacialHair(p: Pix, H: Head, style: string, fc: Ramp, SK: Ramp) {
  const st = style.replace(/[-_\s]/g, '').toLowerCase()
  if (!st || st === 'none') return
  const my = H.mouthY
  const jawFrom = H.eyeY + 3
  const inHead = (x: number, y: number) => { const sp = H.span(y); return !!sp && x >= sp[0] && x <= sp[1] }
  const moustache = (w: number, rows = 2, droop = 0) => {
    for (let r = 0; r < rows; r++) p.span(my - 1 - r, 20 - w + (r ? 1 : 0), 19 + w - (r ? 1 : 0), r ? fc.base : fc.lo)
    for (let d = 1; d <= droop; d++) { p.set(20 - w, my - 1 + d, fc.base); p.set(19 + w, my - 1 + d, fc.lo) }
  }
  const beard = (below: number, hideMouth = false) => {
    for (let y = jawFrom; y <= H.chin + below; y++) {
      const sp = H.span(Math.min(y, H.chin)) ?? [16, 23]
      const shrink = y > H.chin ? (y - H.chin) * 2 : 0
      for (let x = sp[0] + shrink; x <= sp[1] - shrink; x++) {
        if (y < my - 2 && x > sp[0] + 2 && x < sp[1] - 2) continue // cheeks clear above the moustache line
        if (!hideMouth && y >= my - 1 && y <= my + 1 && x >= 17 && x <= 22 && y !== my - 1) continue
        p.set(x, y, x >= sp[1] - 1 - shrink ? fc.lo : (x + y) % 5 === 0 ? fc.dk : fc.base)
      }
    }
    moustache(3)
  }
  switch (st) {
    case 'stubble': for (let y = jawFrom + 1; y <= H.chin; y++) for (let x = 0; x < PW; x++) if (inHead(x, y) && (x + y) % 2 === 0 && (y > my - 2 || Math.abs(x - 19.5) > 7) && !(y === my && x >= 18 && x <= 21)) p.set(x, y, mixc(SK.lo, fc.base, 0.5)); break
    case 'shadow': case 'fiveoclock': for (let y = my - 2; y <= H.chin; y++) for (let x = 0; x < PW; x++) if (inHead(x, y) && !(y === my && x >= 17 && x <= 22)) p.set(x, y, mixc(SK.base, fc.base, 0.35)); break
    case 'moustache': case 'mustache': moustache(3); break
    case 'pencil': p.span(my - 1, 17, 22, fc.base); break
    case 'toothbrush': p.rect(18, my - 2, 4, 2, fc.base); p.set(21, my - 1, fc.lo); break
    case 'walrus': case 'stalin': moustache(st === 'stalin' ? 4 : 5, 3, 1); break
    case 'dali': p.span(my - 1, 17, 22, fc.base); for (let k = 0; k < 6; k++) { p.set(16 - (k > 3 ? 1 : 0), my - 2 - k, fc.base); p.set(23 + (k > 3 ? 1 : 0), my - 2 - k, fc.lo) } break
    case 'handlebar': moustache(3); p.set(15, my - 2, fc.base); p.set(14, my - 3, fc.base); p.set(24, my - 2, fc.lo); p.set(25, my - 3, fc.lo); break
    case 'horseshoe': moustache(3); for (let y = my - 1; y <= H.chin; y++) { p.set(16, y, fc.base); p.set(23, y, fc.lo) } break
    case 'fumanchu': moustache(2); for (let y = my; y <= H.chin + 3; y++) { p.set(17, y, fc.base); p.set(22, y, fc.lo) } break
    case 'goatee': {
      moustache(3)
      for (let y = my - 1; y <= my + 1; y++) { p.set(16, y, fc.base); p.set(23, y, fc.lo) }
      for (let y = my + 2; y <= H.chin + 1; y++) { const w = y > H.chin ? 2 : 3; p.span(y, 20 - w, 19 + w, y >= H.chin ? fc.lo : fc.base); p.set(19 + w, y, fc.lo) }
      break
    }
    case 'vandyke': case 'imperial': {
      p.span(my - 1, 16, 23, fc.base); p.span(my - 2, 17, 22, fc.lo)
      if (st === 'imperial') { p.set(15, my - 2, fc.base); p.set(24, my - 2, fc.lo) }
      for (let y = my + 2; y <= H.chin + (st === 'imperial' ? 1 : 3); y++) { const w = Math.max(1, 3 - Math.floor((y - my - 2) / 2)); p.span(y, 20 - w, 19 + w, y % 2 ? fc.base : fc.lo) }
      break
    }
    case 'soulpatch': p.span(my + 2, 19, 20, fc.base); break
    case 'chinstrap': case 'amish': case 'lincoln': {
      for (let y = jawFrom; y <= H.chin + 2; y++) {
        const sp = H.span(Math.min(y, H.chin)) ?? [16, 23]
        const sh = y > H.chin ? (y - H.chin) * 2 : 0
        for (let x = sp[0] + sh; x <= sp[1] - sh; x++) if (y > my + 1 || x <= sp[0] + 2 || x >= sp[1] - 2) p.set(x, y, x >= sp[1] - 1 ? fc.lo : fc.base)
      }
      break
    }
    case 'muttonchops': case 'sideburns': {
      const to = st === 'sideburns' ? H.eyeY + 3 : my + 1
      for (let y = H.eyeY - 1; y <= to; y++) { const sp = H.span(y)!; p.span(y, sp[0], sp[0] + 2, fc.base); p.span(y, sp[1] - 2, sp[1], fc.lo) }
      if (st === 'muttonchops') moustache(4)
      break
    }
    case 'short': case 'beard': case 'beardshort': beard(1); break
    case 'full': case 'beardfull': beard(3); break
    case 'long': case 'beardlong': case 'wizard': beard(9, false); break
    case 'braided': beard(3); for (let y = H.chin + 3; y <= H.chin + 9; y++) p.span(y, 18, 21, y % 2 ? fc.base : fc.lo); break
    case 'tentacles': for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) p.set(16 + i * 2 + (k % 2), my + k - 1, k % 2 ? fc.lo : fc.base); break
    default: beard(1)
  }
}

// ---------------------------------------------------------------------------
// headwear

const HATS_HIDE_EARS = new Set(['camauro', 'magneto', 'hijab', 'habit', 'keffiyeh', 'hood', 'ushanka', 'skimask', 'helmet', 'wimple', 'veil', 'balaclava', 'cowl', 'batcowl'])
const HATS_COVER_HAIR = new Set(['hijab', 'habit', 'keffiyeh', 'hood', 'skimask', 'balaclava', 'turban', 'helmet', 'beanie', 'ushanka', 'veil', 'cowl', 'batcowl', 'durag', 'bandana-full'])

function drawHeadwear(p: Pix, H: Head, s: PortraitSpec, SK: Ramp) {
  const kind = (s.headwear ?? 'none').toLowerCase().replace(/[\s_]/g, '-')
  if (kind === 'none') return
  const defaults: Record<string, [string, string]> = {
    tophat: ['black', 'red'], 'top-hat': ['black', 'red'], bowler: ['black', 'black'], fedora: ['brown', 'black'], cowboy: ['tan', 'brown'],
    beret: ['black', 'red'], cap: ['red', 'white'], 'cap-back': ['red', 'white'], military: ['olive', 'red'], peaked: ['navy', 'gold'],
    helmet: ['olive', 'olive'], crown: ['gold', 'red'], tiara: ['silver', 'blue'], turban: ['white', 'white'], hijab: ['black', 'black'],
    habit: ['white', 'blue'], keffiyeh: ['white', 'red'], zucchetto: ['white', 'white'], kippah: ['navy', 'navy'], mitre: ['white', 'gold'],
    laurel: ['green', 'green'], fez: ['red', 'black'], ushanka: ['brown', 'grey'], beanie: ['grey', 'grey'], bandana: ['red', 'red'],
    headband: ['white', 'red'], hood: ['brown', 'brown'], wizard: ['grey', 'grey'], pirate: ['black', 'white'], tricorn: ['black', 'gold'],
    bicorne: ['black', 'red'], chef: ['white', 'white'], graduation: ['black', 'gold'], headphones: ['black', 'red'], halo: ['yellow', 'yellow'],
    horns: ['red', 'red'], viking: ['silver', 'white'], sombrero: ['tan', 'red'], pith: ['khaki', 'khaki'], hardhat: ['yellow', 'yellow'],
    bucket: ['khaki', 'khaki'], durag: ['black', 'black'], skimask: ['black', 'black'], balaclava: ['black', 'black'], bow: ['red', 'red'],
    coin: ['gold', 'gold'], party: ['blue', 'yellow'], sailor: ['white', 'blue'], cowl: ['black', 'black'], batcowl: ['black', 'black'],
    veil: ['white', 'white'], kufi: ['white', 'white'], santa: ['red', 'white'], antennae: ['black', 'red'], propeller: ['blue', 'red'],
    flower: ['red', 'yellow'], newsboy: ['grey', 'grey'], beaver: ['brown', 'brown'], visor: ['white', 'blue'], mortarboard: ['black', 'gold'],
    'spartan': ['bronze', 'red'], 'jester': ['red', 'green'], 'nightcap': ['blue', 'white'], 'tinfoil': ['silver', 'silver'],
  }
  const d = defaults[kind] ?? ['black', 'red']
  const A = ramp(colour(s.headwearColor, colour(d[0], 0x2b2934)))
  const B = ramp(colour(s.headwearColor2, colour(d[1], 0xd8303a)))
  const t = H.top
  const brim = (y: number, x0: number, x1: number, c: Ramp) => { p.span(y, x0, x1, c.base); p.span(y + 1, x0 + 1, x1 - 1, c.lo) }
  const domeFill = (from: number, to: number, ex: number, lift: number, c: Ramp) => { for (let y = from; y <= to; y++) { const sp = H.dome(y, ex, lift); if (!sp) continue; for (let x = sp[0]; x <= sp[1]; x++) p.set(x, y, x >= sp[1] - 1 ? c.lo : c.base) } }
  const frameFace = (outer: Ramp, inner: Ramp | null, toY: number) => {
    // covers head + neck sides, leaving the face oval open
    for (let y = t - 2; y <= toY; y++) {
      const o = H.dome(Math.min(y, H.eyeY), 3, 2) ?? [8, 31]
      const lowW = y > H.chin ? Math.min(4, y - H.chin) : 0
      const f = y >= H.hl - 1 && y <= H.chin ? H.span(y) : null
      for (let x = o[0] - lowW; x <= o[1] + lowW; x++) {
        if (f && x >= f[0] + 1 && x <= f[1] - 1) continue
        if (y > H.chin && x >= 16 && x <= 23 && y <= H.chin + 2) continue
        const edge = f && (x === f[0] || x === f[1] || x === f[0] - 1 || x === f[1] + 1)
        p.set(x, y, inner && edge ? inner.base : x >= o[1] - 1 + lowW ? outer.lo : outer.base)
      }
    }
    if (inner) for (let x = 0; x < PW; x++) { const sp = H.span(H.hl - 1); if (sp && x >= sp[0] && x <= sp[1]) p.set(x, H.hl - 1, inner.base) }
  }
  switch (kind) {
    case 'tophat': case 'top-hat': {
      for (let y = t - 10; y <= t + 1; y++) p.span(y, 12, 27, y === t - 10 ? A.hi : A.base)
      for (let y = t - 9; y <= t + 1; y++) { p.set(26, y, A.lo); p.set(27, y, A.lo) }
      p.span(t - 1, 12, 27, B.base); p.span(t, 12, 27, B.lo)
      brim(t + 2, 7, 32, A)
      break
    }
    case 'bowler': domeFill(t - 5, t + 2, 0, 4, A); p.span(t + 1, 10, 29, B.base); brim(t + 3, 8, 31, A); break
    case 'fedora': case 'newsboy': {
      for (let y = t - 5; y <= t + 2; y++) p.span(y, 11 + (y === t - 5 ? 1 : 0), 28 - (y === t - 5 ? 1 : 0), y === t - 5 ? A.hi : A.base)
      p.set(19, t - 5, A.dk); p.set(20, t - 5, A.dk); p.set(19, t - 4, A.lo)
      p.span(t + 1, 11, 28, B.base)
      for (let y = t - 4; y <= t + 2; y++) p.set(28, y, A.lo)
      brim(t + 3, kind === 'newsboy' ? 10 : 6, kind === 'newsboy' ? 29 : 33, A)
      break
    }
    case 'cowboy': {
      for (let y = t - 6; y <= t + 2; y++) p.span(y, 12, 27, y === t - 6 ? A.hi : A.base)
      p.set(19, t - 6, A.dk); p.set(20, t - 6, A.dk)
      p.span(t + 1, 12, 27, B.base)
      p.span(t + 3, 5, 34, A.base); p.span(t + 4, 7, 32, A.lo); p.span(t + 2, 3, 6, A.base); p.span(t + 2, 33, 36, A.lo); p.set(3, t + 1, A.base); p.set(36, t + 1, A.lo)
      break
    }
    case 'beret': {
      p.ellipse(17.5, t + 0.5, H.hw + 2.5, 4, (x) => (x > 25 ? A.lo : A.base)); p.set(18, t - 4, A.base)
      for (let x = 9; x <= 29; x++) if (p.get(x, t + 3) === A.base || p.get(x, t + 3) === A.lo) p.set(x, t + 4, A.dk)
      if (s.headwearSymbol) drawSymbol(p, s.headwearSymbol, 22, t + 0.5, B.base)
      break
    }
    case 'cap': case 'cap-back': {
      domeFill(t - 2, H.hl, 1, 2, A)
      if (kind === 'cap') { p.span(H.hl + 1, 9, 30, B.lo === A.lo ? A.dk : A.dk); p.span(H.hl + 1, 10, 29, A.lo); p.span(H.hl + 2, 11, 28, A.dk) }
      else p.span(H.hl, 17, 22, SK.base)
      if (s.headwearSymbol) drawSymbol(p, s.headwearSymbol, 19.5, t + 2, B.base)
      else p.rect(18, t + 1, 4, 3, B.base)
      break
    }
    case 'military': case 'peaked': {
      for (let y = t - 4; y <= t + 3; y++) { const w = y < t ? 12 : 10.5; p.span(y, Math.ceil(19.5 - w), Math.floor(19.5 + w), y === t - 4 ? A.hi : x2(A, y)) }
      p.span(t + 1, 9, 30, B.base); p.span(t + 2, 9, 30, B.lo)
      p.span(t + 4, 11, 28, 0x15111e); p.span(t + 5, 13, 26, 0x2a2a35)
      p.rect(18, t - 2, 4, 3, 0xe8b83a); p.set(19, t - 1, 0xf5d63a)
      break
    }
    case 'helmet': domeFill(t - 3, H.hl + 1, 2, 3, A); p.span(H.hl + 1, 8, 31, A.dk); p.span(H.hl + 2, 9, 30, A.dk); break
    case 'spartan': domeFill(t - 3, H.eyeY + 4, 2, 3, A); for (let y = H.hl; y <= H.eyeY + 5; y++) p.span(y, 16, 23, y > H.eyeY ? 0x15111e : -1); for (let y = H.hl + 1; y <= H.eyeY + 1; y++) p.span(y, 13, 26, 0x15111e); for (let y = t - 9; y <= t - 1; y++) p.span(y, 16, 23, y % 2 ? B.base : B.lo); break
    case 'crown': {
      p.span(t - 1, 10, 29, A.base); p.span(t, 10, 29, A.lo); p.span(t + 1, 10, 29, A.base)
      for (const x of [10, 15, 19, 24, 29]) { p.set(x, t - 2, A.base); p.set(x, t - 3, A.hi); if (x === 19) { p.set(20, t - 2, A.base); p.set(20, t - 3, A.hi); p.set(19, t - 4, A.hi) } }
      p.set(14, t, B.base); p.set(19, t, 0x2f6fd6); p.set(20, t, 0x2f6fd6); p.set(25, t, B.base)
      break
    }
    case 'tiara': p.span(t + 1, 13, 26, A.base); for (const x of [14, 17, 19, 20, 22, 25]) p.set(x, t, A.hi); p.set(19, t - 1, B.base); p.set(20, t - 1, B.base); break
    case 'turban': case 'kufi': {
      if (kind === 'kufi') { domeFill(t - 2, t + 2, 1, 2, A); break }
      p.ellipse(19.5, t + 0.5, H.hw + 2.5, 7, (x, y) => ((x + y) % 4 === 0 ? A.lo : x > 26 ? A.lo : A.base))
      for (let y = H.hl - 1; y <= H.hl; y++) { const sp = H.span(y)!; p.span(y, sp[0] - 1, sp[1] + 1, A.base) }
      if (s.headwearSymbol) drawSymbol(p, s.headwearSymbol, 19.5, t, B.base)
      break
    }
    case 'hijab': case 'veil': frameFace(A, null, H.chin + 6); break
    case 'habit': {
      frameFace(A, B, H.chin + 6)
      // Mother Teresa style stripes on the band
      for (let y = t - 1; y <= H.chin + 6; y++) { const o = H.dome(Math.min(y, H.eyeY), 3, 2); if (o) { p.set(o[0] + 1, y, B.base); p.set(o[1] - 1, y, B.base) } }
      break
    }
    case 'keffiyeh': {
      frameFace(A, null, H.chin + 6)
      for (let y = t - 2; y <= H.chin + 6; y++) for (let x = 0; x < PW; x++) { const c = p.get(x, y); if ((c === A.base || c === A.lo) && (x % 3 === 0 || y % 3 === 0)) p.set(x, y, B.base) }
      p.span(t + 1, 9, 30, 0x15111e); p.span(t + 2, 9, 30, 0x2b2934)
      break
    }
    case 'zucchetto': case 'kippah': domeFill(t - 1, t + 1, -3, 1, A); break
    case 'mitre': {
      p.trap(t - 10, t + 1, 15, 19, 11, 28, (x) => (x > 24 ? A.lo : A.base))
      p.trap(t - 10, t + 1, 20, 24, 11, 28, (x) => (x > 24 ? A.lo : A.base))
      for (let y = t - 8; y <= t + 1; y++) p.set(19, y, B.base); p.span(t - 2, 12, 27, B.base); p.span(t + 1, 11, 28, B.base)
      break
    }
    case 'laurel': for (let k = 0; k < 7; k++) { p.set(10 + k, t + 4 - (k >> 1), A.base); p.set(11 + k, t + 5 - (k >> 1), A.lo); p.set(29 - k, t + 4 - (k >> 1), A.base); p.set(28 - k, t + 5 - (k >> 1), A.lo) } break
    case 'fez': p.trap(t - 5, t + 1, 14, 25, 12, 27, (x) => (x > 24 ? A.lo : A.base)); p.set(23, t - 5, B.base); p.set(24, t - 4, B.base); p.set(25, t - 3, B.base); p.set(25, t - 2, B.base); break
    case 'ushanka': domeFill(t - 4, H.hl, 3, 4, A); p.span(H.hl - 1, 8, 31, B.base); p.span(H.hl, 8, 31, B.lo); for (let y = H.hl; y <= H.eyeY + 6; y++) { p.span(y, 7, 10, B.base); p.span(y, 29, 32, B.lo) } break
    case 'beanie': {
      domeFill(t - 3, H.hl, 2, 3, A)
      const band = s.headwearColor2 ? B : A
      p.span(H.hl - 1, 9, 30, band.lo); p.span(H.hl, 9, 30, band.base); for (let x = 9; x <= 30; x += 2) p.set(x, H.hl, band.lo)
      if (s.headwearColor2) p.ellipse(19.5, t - 4, 2.5, 2, B.base)
      break
    }
    case 'pickelhaube': domeFill(t - 3, H.hl, 2, 3, A); p.span(H.hl, 8, 31, A.dk); p.rect(19, t - 9, 2, 6, 0xe8b83a); p.set(19, t - 10, 0xf5d63a); p.rect(17, t - 1, 6, 4, 0xe8b83a); p.span(H.hl + 1, 10, 29, 0x15111e); break
    case 'sikke': for (let y = t - 12; y <= t + 2; y++) p.span(y, 13 + (y < t - 9 ? 1 : 0), 26 - (y < t - 9 ? 1 : 0), y === t - 12 ? A.hi : A.base); for (let y = t - 11; y <= t + 2; y++) p.set(26, y, A.lo); break
    case 'camauro': domeFill(t - 3, H.hl + 1, 3, 3, A); for (let y = H.hl; y <= H.eyeY + 3; y++) { p.span(y, 7, 10, A.base); p.span(y, 29, 32, A.lo) } for (let x = 8; x <= 31; x++) p.set(x, H.hl + 1, (x % 2) ? 0xf4f1ea : 0xd8d4cc); break
    case 'nurse': p.trap(t - 3, t + 1, 14, 25, 12, 27, A.base); p.span(t + 1, 12, 27, A.lo); p.rect(19, t - 2, 2, 3, 0xd8303a); p.span(t - 1, 18, 21, 0xd8303a); break
    case 'mongol': p.trap(t - 9, t + 1, 18, 21, 11, 28, (x) => (x > 24 ? A.lo : A.base)); for (let y = t; y <= t + 3; y++) p.span(y, 9, 30, y % 2 ? B.base : B.lo); p.set(19, t - 10, 0xd8303a); break
    case 'magneto': domeFill(t - 3, H.eyeY - 2, 2, 3, A); for (let y = H.eyeY - 2; y <= H.mouthY + 2; y++) { p.span(y, 8, 11, A.base); p.span(y, 28, 31, A.lo) } p.span(H.hl, 12, 27, B.base); p.rect(18, t - 3, 4, 3, B.base); break
    case 'goggles-up': p.span(H.hl - 2, 8, 31, 0x4f3422); for (const cx of [15, 24]) { p.ellipse(cx, H.hl - 2, 3.2, 2.6, colour(s.headwearColor, 0x8a6a3a)); p.ellipse(cx, H.hl - 2, 2.2, 1.6, 0x9fdcff) } break
    case 'shades-up': p.span(H.top + 1, 11, 28, 0x15111e); for (const cx of [15, 24]) p.ellipse(cx, H.top + 2, 3, 2, 0x1d1a2a); break
    case 'bandana': case 'headband': {
      const y0 = H.hl - (kind === 'bandana' ? 1 : 0)
      for (let y = y0; y <= H.hl; y++) { const sp = H.span(y) ?? [10, 29]; p.span(y, sp[0] - 1, sp[1] + 1, kind === 'headband' && s.headwearColor2 ? B.base : A.base) }
      if (kind === 'bandana') { p.set(31, H.hl + 1, A.base); p.set(32, H.hl + 2, A.lo); p.set(31, H.hl + 3, A.lo); p.set(33, H.hl + 3, A.base) }
      break
    }
    case 'durag': domeFill(t - 2, H.hl, 1, 2, A); p.set(31, H.hl + 2, A.base); p.set(32, H.hl + 4, A.lo); break
    case 'hood': case 'cowl': case 'batcowl': {
      frameFace(A, null, H.chin + 7)
      for (let y = H.hl - 1; y <= H.chin; y++) { const sp = H.span(y); if (sp) { p.set(sp[0], y, A.dk); p.set(sp[1], y, A.dk) } }
      if (kind === 'batcowl') {
        for (let y = H.hl - 1; y <= H.eyeY + 2; y++) { const sp = H.span(y)!; p.span(y, sp[0], sp[1], y === H.eyeY + 2 ? A.lo : A.base) }
        p.set(17, H.eyeY + 1, 0xfaf6f0); p.set(16, H.eyeY + 1, 0xfaf6f0); p.set(22, H.eyeY + 1, 0xfaf6f0); p.set(23, H.eyeY + 1, 0xfaf6f0)
        for (const x of [11, 12, 27, 28]) { p.set(x, t - 4, A.base); p.set(x, t - 3, A.base) } p.set(11, t - 5, A.base); p.set(28, t - 5, A.base)
      }
      break
    }
    case 'skimask': case 'balaclava': {
      for (let y = t - 1; y <= H.chin + 1; y++) { const sp = H.dome(Math.min(y, H.eyeY), 1, 1); if (!sp) continue; for (let x = sp[0]; x <= sp[1]; x++) if (!(y >= H.eyeY - 1 && y <= H.eyeY + 2 && x >= 13 && x <= 26) && !(y >= H.mouthY - 1 && y <= H.mouthY + 1 && x >= 17 && x <= 22)) p.set(x, y, x >= sp[1] - 1 ? A.lo : A.base) }
      break
    }
    case 'wizard': case 'party': case 'santa': case 'jester': case 'nightcap': {
      const tall = kind === 'wizard' ? 13 : 9
      p.trap(t - tall, t + 1, 19, 20, 12, 27, (x) => (x > 23 ? A.lo : A.base))
      if (kind === 'wizard') { p.set(21, t - tall, A.base); p.set(22, t - tall + 1, A.base); brim(t + 2, 6, 33, A) }
      else if (kind === 'santa') { p.span(t + 1, 11, 28, 0xf4f1ea); p.span(t + 2, 11, 28, 0xd8d4cc); p.ellipse(20, t - tall, 1.6, 1.6, 0xf4f1ea) }
      else if (kind === 'party') { for (let y = t - tall + 3; y <= t; y += 3) { for (let x = 12; x <= 27; x++) if (p.get(x, y) === A.base || p.get(x, y) === A.lo) p.set(x, y, B.base) } p.ellipse(19.5, t - tall, 1.5, 1.5, B.base) }
      else if (kind === 'nightcap') p.ellipse(22, t - tall, 1.6, 1.6, B.base)
      else { p.trap(t - 7, t, 8, 12, 12, 16, B.base); p.trap(t - 7, t, 27, 31, 23, 27, A.base) }
      break
    }
    case 'pirate': case 'tricorn': {
      p.trap(t - 5, t + 1, 12, 27, 8, 31, (x) => (x > 27 ? A.lo : A.base))
      p.span(t + 2, 5, 34, A.base); p.span(t + 1, 4, 6, A.base); p.span(t + 1, 33, 35, A.lo); p.span(t, 3, 4, A.base); p.span(t, 35, 36, A.lo)
      p.span(t + 2, 8, 31, B.base === A.base ? A.lo : B.base)
      if (kind === 'pirate') drawSymbol(p, 'skull', 19.5, t - 2, 0xf4f1ea)
      break
    }
    case 'bicorne': {
      p.ellipse(19.5, t - 1, 16, 5, (x) => (x > 30 ? A.lo : A.base))
      for (let x = 4; x <= 35; x++) if (p.get(x, t + 3) >= 0) p.set(x, t + 3, A.dk)
      p.span(t + 1, 6, 33, B.base === A.base ? A.lo : A.lo)
      p.ellipse(13.5, t - 2, 2.2, 2.2, B.base); p.set(13, t - 2, 0xf4f1ea)
      break
    }
    case 'chef': p.ellipse(19.5, t - 5, 10, 6, (x, y) => ((x + y) % 5 === 0 ? A.lo : x > 26 ? A.lo : A.base)); for (let y = t - 2; y <= t + 2; y++) p.span(y, 11, 28, y === t + 2 ? A.lo : A.base); break
    case 'graduation': case 'mortarboard': domeFill(t - 2, t + 2, 0, 2, A); p.trap(t - 5, t - 2, 13, 26, 6, 33, A.base); p.span(t - 2, 6, 33, A.lo); p.set(30, t - 2, B.base); for (let y = t - 1; y <= t + 4; y++) p.set(31, y, B.base); break
    case 'headphones': for (let y = t - 2; y <= t; y++) { const sp = H.dome(y, 2, 2); if (sp) { p.set(sp[0], y, A.base); p.set(sp[1], y, A.lo) } } p.span(t - 2, 12, 27, A.base); p.rect(6, H.eyeY - 2, 4, 6, A.base); p.rect(30, H.eyeY - 2, 4, 6, A.lo); p.rect(7, H.eyeY - 1, 2, 4, B.base); p.rect(31, H.eyeY - 1, 2, 4, B.lo); break
    case 'halo': p.ring(19.5, t - 4, 7, 2, A.base); break
    case 'horns': case 'viking': {
      if (kind === 'viking') { domeFill(t - 3, H.hl, 2, 3, A); p.span(H.hl, 8, 31, A.dk); p.rect(19, t - 3, 2, H.hl - t + 3, A.lo) }
      const hc = kind === 'viking' ? ramp(colour(s.headwearColor2, 0xf4f1ea)) : A
      for (let k = 0; k < 6; k++) { p.set(10 - k, t + 1 - k, hc.base); p.set(11 - k, t + 1 - k, hc.base); p.set(29 + k, t + 1 - k, hc.lo); p.set(28 + k, t + 1 - k, hc.lo) }
      p.set(4, t - 5, hc.hi); p.set(35, t - 5, hc.hi)
      break
    }
    case 'sombrero': p.ellipse(19.5, t - 3, 6, 5, A.base); p.span(t - 1, 13, 26, B.base); p.ellipse(19.5, t + 2, 19, 2.5, (x) => (x > 32 ? A.lo : A.base)); break
    case 'pith': case 'hardhat': case 'bucket': {
      domeFill(t - 4, t + 2, 1, 4, A)
      p.span(t + 3, kind === 'hardhat' ? 8 : 6, kind === 'hardhat' ? 31 : 33, A.base); p.span(t + 4, kind === 'bucket' ? 7 : 9, kind === 'bucket' ? 32 : 30, A.lo)
      if (kind === 'hardhat') p.rect(19, t - 4, 2, 6, A.hi)
      break
    }
    case 'sailor': domeFill(t - 2, t + 1, -1, 2, A); p.span(t + 2, 11, 28, A.lo); p.span(t + 1, 11, 28, B.base); break
    case 'bow': p.ellipse(25, t - 1, 3, 2.5, A.base); p.ellipse(31, t - 1, 3, 2.5, A.lo); p.rect(27, t - 2, 2, 3, A.dk); break
    case 'flower': for (const [x, y] of [[26, t - 1], [29, t - 1], [27, t - 3], [28, t + 1]]) p.ellipse(x, y, 1.6, 1.6, A.base); p.set(27, t - 1, B.base); break
    case 'coin': p.ellipse(19.5, H.hl - 1, 3, 3.5, A.base); p.ellipse(19.5, H.hl - 1, 1.6, 2.2, A.hi); break
    case 'antennae': p.set(15, t - 1, A.base); p.set(14, t - 2, A.base); p.set(14, t - 3, A.base); p.set(24, t - 1, A.base); p.set(25, t - 2, A.base); p.set(25, t - 3, A.base); p.ellipse(14, t - 4.5, 1.5, 1.5, B.base); p.ellipse(25.5, t - 4.5, 1.5, 1.5, B.base); break
    case 'propeller': domeFill(t - 2, t + 2, 0, 2, A); p.set(19, t - 3, 0x15111e); p.span(t - 4, 14, 25, B.base); break
    case 'beaver': domeFill(t - 4, t + 2, 2, 4, A); for (let x = 8; x <= 31; x += 2) p.set(x, t - 1, A.lo); p.set(31, t + 4, A.base); p.set(32, t + 6, A.lo); break
    case 'visor': p.span(H.hl + 1, 9, 30, A.base); p.span(H.hl + 2, 8, 31, B.base); p.span(H.hl + 3, 10, 29, B.lo); break
    case 'tinfoil': p.trap(t - 5, t + 2, 18, 21, 10, 29, (x, y) => ((x + y) % 3 === 0 ? 0xf4f6fa : (x > 24 ? 0x9aa1ad : 0xc8cdd6))); break
    default: domeFill(t - 2, t + 2, 1, 2, A)
  }
}
function x2(A: Ramp, y: number) { return y % 2 ? A.base : A.base }

// ---------------------------------------------------------------------------
// eyewear

function drawEyewear(p: Pix, H: Head, s: PortraitSpec, frame: Frame) {
  const kind = (s.eyewear ?? 'none').toLowerCase()
  if (kind === 'none') return
  const { outer, inner } = eyeCols(H)
  const y = H.eyeY
  const frameC = colour(s.eyewearColor, kind === 'aviators' || kind === 'monocle' ? 0xe8b83a : 0x23202c)
  const lens = 0x1d1a2a
  const both = (fn: (a: number, b: number, m: boolean) => void) => { fn(outer, inner, false); fn(39 - inner, 39 - outer, true) }
  switch (kind) {
    case 'round': case 'pince-nez': both((a, b) => p.ring((a + b + 1) / 2, y + 1, 3, 2.8, frameC)); p.span(y, 18, 21, frameC); break
    case 'square': case 'thick': case 'reading': {
      const top = kind === 'reading' ? y + 1 : y - 1
      both((a, b) => { p.span(top, a - 1, b + 1, frameC); p.span(y + 2, a - 1, b + 1, frameC); for (let yy = top; yy <= y + 2; yy++) { p.set(a - 1, yy, frameC); p.set(b + 1, yy, frameC) } if (kind === 'thick') p.span(top - 1, a - 1, b + 1, frameC) })
      p.span(top + (kind === 'reading' ? 0 : 1), 18, 21, frameC)
      break
    }
    case 'sunglasses': case 'shades': both((a, b, m) => { p.span(y - 1, a - 1, b + 1, frameC); p.span(y, a - 1, b + 1, lens); p.span(y + 1, a - 1, b + 1, lens); p.span(y + 2, a, b, lens); p.set(m ? b : a, y, 0x6a6a88) }); p.span(y, 18, 21, frameC); break
    case 'aviators': both((a, b, m) => { p.span(y - 1, a - 1, b + 1, frameC); p.span(y, a - 1, b + 1, lens); p.span(y + 1, a - 1, b + 1, lens); p.span(y + 2, m ? a : a, m ? b : b, lens); p.span(y + 3, m ? a + 1 : a + 1, m ? b - 1 : b - 1, lens); p.set(m ? b : a, y, 0x8a7a5a) }); p.span(y - 1, 18, 21, frameC); break
    case 'shutter': for (let yy = y - 1; yy <= y + 2; yy += 1) if ((yy - y) % 2 !== 0 || yy === y - 1) p.span(yy, outer - 1, 40 - outer, frameC); break
    case 'monocle': p.ring(39 - (outer + inner + 1) / 2, y + 1, 3, 2.8, frameC); for (let k = 0; k < 6; k++) p.set(27 + (k >> 1), y + 4 + k, frameC); break
    case 'eyepatch': p.ellipse((outer + inner + 1) / 2, y + 1, 3, 2.4, 0x15111e); for (let k = 0; k < 12; k++) p.set(10 + k * 1.6, H.hl + 4 - k * 0.45, 0x15111e); break
    case 'goggles': both((a, b) => { p.ellipse((a + b + 1) / 2, y + 1, 3.4, 3, frameC); p.ellipse((a + b + 1) / 2, y + 1, 2.4, 2, 0x8fd3ff) }); p.span(y, 8, 31, frameC); break
    case 'visor': p.span(y, 11, 28, frameC === 0x23202c ? 0xe8b83a : frameC); p.span(y + 1, 11, 28, frameC === 0x23202c ? 0xc9a227 : dark(frameC, 0.2)); break
    case 'star': both((a, b) => drawSymbol(p, 'star', (a + b + 1) / 2, y + 0.5, frameC === 0x23202c ? 0xff3d8a : frameC)); break
    case 'heart': both((a, b) => drawSymbol(p, 'heart', (a + b + 1) / 2, y + 0.5, frameC === 0x23202c ? 0xff3d8a : frameC)); break
    case 'mask': case 'domino': p.span(y - 1, 12, 27, frameC); p.span(y, 12, 27, frameC); p.span(y + 1, 13, 26, frameC); p.span(y + 2, 14, 25, frameC); if (frame !== 'blink') { p.set(15, y + 1, 0xfaf6f0); p.set(16, y + 1, 0xfaf6f0); p.set(23, y + 1, 0xfaf6f0); p.set(24, y + 1, 0xfaf6f0) } break
    case 'browline': both((a, b) => { p.span(y - 1, a - 1, b + 1, frameC); p.span(y - 2, a - 1, b + 1, frameC); p.set(a - 1, y, frameC); p.set(b + 1, y, frameC); p.span(y + 2, a, b, mixc(frameC, 0xc8cdd6, 0.6)) }); p.span(y - 1, 18, 21, frameC); break
    case '3d': both((a, b, m) => { p.rect(a - 1, y - 1, b - a + 3, 4, frameC); p.rect(a, y, b - a + 1, 2, m ? 0x3f8ad6 : 0xe0302a) }); break
    case 'cateye': both((a, b, m) => { p.ring((a + b + 1) / 2, y + 1, 3, 2.6, frameC); p.set(m ? b + 2 : a - 2, y - 1, frameC) }); p.span(y, 18, 21, frameC); break
  }
}

// ---------------------------------------------------------------------------
// extras / accessories

function drawExtras(p: Pix, H: Head, s: PortraitSpec, SK: Ramp, hc: Ramp, stage: 'face' | 'front') {
  const ex = (s.extras ?? []).map((e) => e.toLowerCase())
  const top = torsoTop(H)
  const has = (k: string) => ex.includes(k)
  if (stage === 'face') {
    if (has('freckles')) for (const [x, y] of [[14, 1], [16, 2], [15, 3], [24, 1], [23, 2], [25, 3]]) p.set(x, H.eyeY + 2 + y, dark(SK.base, 0.25))
    if (has('blush')) { p.span(H.eyeY + 3, 13, 14, mixc(SK.base, 0xff5a7a, 0.45)); p.span(H.eyeY + 3, 25, 26, mixc(SK.base, 0xff5a7a, 0.45)) }
    if (has('mole') || has('beautymark')) p.set(23, H.mouthY - 2, 0x3a2420)
    if (has('scar')) for (let k = 0; k < 6; k++) p.set(23 + (k >> 1), H.eyeY - 2 + k, mixc(SK.base, 0xc04050, 0.6))
    if (has('wrinkles')) { p.span(H.hl + 2, 15, 18, SK.lo); p.span(H.hl + 2, 21, 24, SK.lo); p.set(12, H.eyeY + 1, SK.lo); p.set(27, H.eyeY + 1, SK.lo); p.set(16, H.mouthY - 2, SK.lo); p.set(23, H.mouthY - 2, SK.lo) }
    if (has('bags')) { p.span(H.eyeY + 2, 14, 16, SK.lo); p.span(H.eyeY + 2, 23, 25, SK.lo) }
    if (has('tattoo') || has('facetattoo')) { const ink = 0x1a1424; for (const [x, y] of [[24, 0], [25, -1], [26, -1], [27, 0], [27, 1], [26, 2], [28, 2], [28, 3], [27, 4], [25, 1], [24, 2], [26, 4], [28, 5]]) p.set(x, H.hl + 1 + y, ink) }
    if (has('facepaint')) { const fp = colour(s.color2, 0x3f8ad6); for (let y = H.hl; y <= H.eyeY + 3; y++) { const sp = H.span(y); if (sp) { p.span(y, sp[0], 15, fp); p.span(y, 24, sp[1], fp) } } }
    if (has('clown')) { for (let y = H.top; y <= H.chin; y++) { const sp = H.span(y); if (sp) for (let x = sp[0]; x <= sp[1]; x++) if (p.get(x, y) === SK.base || p.get(x, y) === SK.lo || p.get(x, y) === SK.hi) p.set(x, y, x >= sp[1] - 1 ? 0xd8d4cc : 0xf4f1ea) } }
    if (has('tear')) { p.set(15, H.eyeY + 2, 0x72b6ff); p.set(15, H.eyeY + 3, 0x72b6ff) }
    if (has('sweat')) { p.set(28, H.hl + 2, 0x9fdcff); p.set(28, H.hl + 3, 0x72b6ff) }
    if (has('drool')) { p.set(22, H.mouthY + 1, 0xb8e0ff); p.set(22, H.mouthY + 2, 0x9fd0f0); p.set(22, H.mouthY + 3, 0x9fd0f0) }
    if (has('kohl')) { const { outer, inner } = eyeCols(H); for (const [a, b] of [[outer, inner], [39 - inner, 39 - outer]]) { p.span(H.eyeY - 1, a - 1, b + 1, 0x1a1424); p.span(H.eyeY + 2, a - 1, b + 1, 0x1a1424); p.set(a - 1, H.eyeY, 0x1a1424); p.set(b + 1, H.eyeY + 1, 0x1a1424) } }
    if (has('bolt') || has('lightningbolt')) { const pts = [[23, H.hl], [22, H.hl + 1], [21, H.hl + 2], [22, H.hl + 3], [23, H.hl + 3], [22, H.eyeY], [21, H.eyeY + 1], [20, H.eyeY + 2], [21, H.eyeY + 3], [20, H.eyeY + 4]]; pts.forEach(([x, y], i) => { p.set(x, y, i % 2 ? 0x3f8ad6 : 0xd8303a); p.set(x + 1, y, 0xd8303a) }) }
    if (has('zinc')) { p.span(H.eyeY + 3, 19, 20, 0xfaf6f0); p.span(H.eyeY + 4, 18, 21, 0xfaf6f0); p.span(H.mouthY, 18, 21, 0xfaf6f0) }
    if (has('bolts')) { p.rect(13, H.chin, 2, 2, 0x9aa1ad); p.rect(25, H.chin, 2, 2, 0x9aa1ad) }
    if (has('stitches')) { for (let x = 13; x <= 26; x++) p.set(x, H.hl + 1, 0x2a2a35); for (let x = 14; x <= 26; x += 3) p.set(x, H.hl, 0x2a2a35) }
    if (has('lashes') || has('eyeliner')) { const { outer } = eyeCols(H); p.set(outer - 1, H.eyeY - 1, 0x15111e); p.set(40 - outer, H.eyeY - 1, 0x15111e) }
    if (has('bindi')) { p.set(19, H.eyeY - 2, 0xd8303a); p.set(20, H.eyeY - 2, 0xd8303a) }
    if (has('tilak')) for (let y = H.hl; y <= H.eyeY - 1; y++) p.set(19 + (y % 2), y, 0xf28a2a)
    if (has('nosering')) p.set(21, H.eyeY + 4, 0xe8b83a)
    if (has('forehead-mark') || has('gaara')) { p.set(13, H.hl + 1, 0xd8303a); p.set(14, H.hl + 2, 0xd8303a); p.set(13, H.hl + 3, 0xd8303a) }
    if (has('redstripe')) for (let y = H.top - 1; y <= H.chin; y++) { const sp = H.span(y); if (sp) p.set(sp[0] + 2 + ((y - H.top) >> 3), y, 0xc0202a) }
    if (has('chinridges')) for (let k = 0; k < 4; k++) p.span(H.chin - 4 + k, 17 + (k >> 1), 22 - (k >> 1), k % 2 ? SK.lo : SK.dk)
  }
  if (stage === 'front') {
    if (has('cigar')) { p.span(H.mouthY, 21, 27, 0x7a4a2a); p.set(27, H.mouthY, 0xf28a2a); p.set(28, H.mouthY - 1, 0xc2c3c7); p.set(29, H.mouthY - 2, 0xc2c3c7) }
    if (has('cigarette')) { p.span(H.mouthY, 21, 26, 0xf4f1ea); p.set(26, H.mouthY, 0xf28a2a); p.set(27, H.mouthY - 2, 0xc2c3c7) }
    if (has('pipe')) { p.span(H.mouthY + 1, 21, 25, 0x4f3422); p.rect(25, H.mouthY - 1, 3, 3, 0x7a4a2a); p.set(26, H.mouthY - 1, 0x2a1a14) }
    if (has('medals')) for (let i = 0; i < 4; i++) { p.set(11 + i * 2, top + 5, [0xd8303a, 0x2f6fd6, 0x35a852, 0xf5d63a][i]); p.set(11 + i * 2, top + 6, 0xe8b83a) }
    if (has('necklace') || has('chain')) { const c = has('chain') ? 0xf5d63a : 0xe8b83a; for (let k = 0; k <= 8; k++) p.set(15 + k, top + 2 + (k < 4 ? k >> 1 : (8 - k) >> 1), c); if (has('chain')) { p.rect(18, top + 5, 4, 3, c); p.set(19, top + 6, 0xc9a227) } }
    if (has('pearls')) for (let k = 0; k <= 10; k++) if (k % 2 === 0) p.set(14 + k, top + 1 + (k < 5 ? k >> 1 : (10 - k) >> 1), 0xfaf6f0)
    if (has('cross')) { p.rect(19, top + 4, 2, 5, 0xe8b83a); p.span(top + 5, 18, 21, 0xe8b83a); for (let k = 0; k < 4; k++) { p.set(16 + k, top + k, 0xc9a227); p.set(23 - k, top + k, 0xc9a227) } }
    if (has('earrings')) { p.set(9, H.eyeY + 4, 0xe8b83a); p.set(30, H.eyeY + 4, 0xe8b83a) }
    if (has('hoops')) { p.ring(9, H.eyeY + 5, 1.6, 2, 0xe8b83a); p.ring(30.5, H.eyeY + 5, 1.6, 2, 0xe8b83a) }
    if (has('microphone')) { p.rect(29, H.mouthY + 3, 2, 10, 0x2a2a35); p.ellipse(30, H.mouthY + 2, 2.4, 2.4, 0x8a8a99); p.set(29, H.mouthY + 1, 0xc2c3c7) }
    if (has('flower')) { p.ellipse(13, top + 5, 1.6, 1.6, 0xff3d8a); p.set(13, top + 5, 0xf5d63a) }
    if (has('rose')) { p.ellipse(13, top + 5, 1.6, 1.6, 0xd8303a) }
    if (has('scarf')) for (let y = H.chin; y <= top + 3; y++) p.span(y, 13, 26, y % 2 ? colour(s.color2, 0xd8303a) : dark(colour(s.color2, 0xd8303a), 0.2))
    if (has('stethoscope')) { for (let k = 0; k < 8; k++) { p.set(15 - (k >> 2), top + k, 0x2a2a35); p.set(24 + (k >> 2), top + k, 0x2a2a35) } p.ellipse(25, top + 9, 1.5, 1.5, 0xc2c3c7) }
    if (has('badge')) drawSymbol(p, 'star', 13, top + 5, 0xe8b83a)
    if (has('dogtags')) { for (let k = 0; k < 5; k++) { p.set(17 + (k >> 2), top + k, 0xc2c3c7); p.set(22 - (k >> 2), top + k, 0xc2c3c7) } p.rect(19, top + 5, 2, 3, 0xc2c3c7) }
    if (has('bowtie')) { const c = colour(s.color2, 0xd8303a); p.span(top, 16, 17, c); p.span(top + 1, 16, 23, c); p.span(top + 2, 16, 17, c); p.span(top, 22, 23, dark(c)); p.span(top + 2, 22, 23, dark(c)); p.span(top + 1, 19, 20, dark(c, 0.5)) }
    if (has('tie')) { const c = ramp(colour(s.color2, 0xd8303a)); for (let y = top + 1; y < PH; y++) { p.set(19, y, c.base); p.set(20, y, c.lo) } }
    if (has('collar-spikes') || has('spikes')) for (let x = 14; x <= 25; x += 2) { p.set(x, H.chin + 2, 0x2a2a35); p.set(x, H.chin + 1, 0xc8cdd6) }
    if (has('lightsaber')) { const lc = colour(s.color2, 0xe0302a); for (let y = 20; y < PH; y++) p.set(34, y, lc); for (let y = 21; y < PH; y++) p.set(33, y, light(lc, 0.5)) }
    if (has('necktattoo')) for (const [x, y] of [[16, 0], [17, 1], [22, 0], [23, 1], [9, 6], [10, 7], [9, 8], [30, 6], [29, 7], [30, 8], [11, 9], [28, 9]]) p.set(x, H.chin + 1 + y, 0x1a1424)
    if (has('poppedcollar')) { const cc = colour(s.outfitColor2 ?? s.outfitColor, 0xf4f1ea); for (let y = H.chin - 3; y <= top; y++) { p.span(y, 13, 15, cc); p.span(y, 24, 26, dark(cc, 0.2)) } }
    if (has('mask') || has('respirator')) { for (let y = H.mouthY - 2; y <= H.chin + 1; y++) p.span(y, 14, 25, y % 2 ? 0x46465a : 0x5c5c6c); p.rect(17, H.mouthY - 1, 6, 3, 0x2b2934) }
    if (has('surgicalmask')) for (let y = H.eyeY + 3; y <= H.chin; y++) { const sp = H.span(y)!; p.span(y, sp[0], sp[1], y % 3 ? 0x9fdcff : 0x72b6ff) }
    if (has('beard-bib') || has('napkin')) for (let y = top; y < PH; y++) p.span(y, 14, 25, 0xf4f1ea)
  }
}

// ---------------------------------------------------------------------------
// animal heads (replace ears / nose, add patterns)

function drawAnimalEars(p: Pix, H: Head, a: NonNullable<PortraitSpec['animal']>, F: Ramp, F2: Ramp) {
  const ears = (a.ears ?? 'round').toLowerCase()
  const t = H.top
  switch (ears) {
    case 'pointy': case 'cat': case 'fox': for (const m of [0, 1]) { const x = (v: number) => (m ? 39 - v : v); for (let k = 0; k < 6; k++) { p.span(t - 4 + k, Math.min(x(12 - (k >> 1)), x(13 + (k >> 1))), Math.max(x(12 - (k >> 1)), x(13 + (k >> 1))), m ? F.lo : F.base); if (k > 1) p.set(x(13), t - 4 + k, F2.base) } } break
    case 'round': case 'bear': p.ellipse(12, t + 1, 3.5, 3.5, F.base); p.ellipse(27.5, t + 1, 3.5, 3.5, F.lo); p.ellipse(12, t + 1, 1.8, 1.8, F2.base); p.ellipse(27.5, t + 1, 1.8, 1.8, F2.lo); break
    case 'mouse': p.ellipse(10, t, 5.5, 5.5, F.base); p.ellipse(29.5, t, 5.5, 5.5, F.lo); break
    case 'floppy': case 'dog': for (let y = t + 1; y <= H.eyeY + 6; y++) { const sp = H.span(Math.min(y, H.chin))!; p.span(y, sp[0] - 3, sp[0] + 1, F2.base); p.span(y, sp[1] - 1, sp[1] + 3, F2.lo) } break
    case 'long': case 'rabbit': for (const [x, c] of [[14, F.base], [25.5, F.lo]] as [number, Col][]) { p.ellipse(x, t - 7, 2.6, 8, c); p.ellipse(x, t - 7, 1.2, 6, F2.base) } break
    case 'pikachu': for (const [x, c, d] of [[12, F.base, -1], [27.5, F.lo, 1]] as [number, Col, number][]) { for (let k = 0; k < 10; k++) p.span(t - k, x + d * (k >> 1) - 1, x + d * (k >> 1) + 1, k > 6 ? 0x15111e : c) } break
    case 'donkey': case 'horse': for (const m of [0, 1]) for (let k = 0; k < 9; k++) { const x = m ? 27 + (k >> 1) : 12 - (k >> 1); p.span(t + 2 - k, x - 1, x + 1, m ? F.lo : F.base); if (k > 1 && k < 8) p.set(x, t + 2 - k, F2.base) } break
    case 'small': p.set(12, t - 1, F.base); p.set(13, t - 1, F.base); p.set(12, t - 2, F.base); p.set(26, t - 1, F.lo); p.set(27, t - 1, F.lo); p.set(27, t - 2, F.lo); break
    case 'antlers': for (const m of [0, 1]) { const x = (v: number) => (m ? 39 - v : v); for (let k = 0; k < 7; k++) p.set(x(13 - (k >> 1)), t - k, 0x7a5032); p.set(x(10), t - 4, 0x7a5032); p.set(x(9), t - 5, 0x7a5032); p.set(x(13), t - 5, 0x7a5032) } break
    case 'none': break
  }
}

function drawSnout(p: Pix, H: Head, a: NonNullable<PortraitSpec['animal']>, F: Ramp, F2: Ramp) {
  const sn = (a.snout ?? 'none').toLowerCase()
  const y = H.eyeY + 4
  const nose = colour(a.nose, 0x15111e)
  switch (sn) {
    case 'dog': case 'bear': case 'lion': {
      p.ellipse(19.5, y + 1, sn === 'bear' ? 5 : 4.5, 3.5, (x) => (x > 22 ? F2.lo : F2.base))
      p.ellipse(19.5, y - 1, 2.2, 1.5, nose); p.set(19, y - 2, light(nose, 0.5))
      p.set(19, y + 1, F.dk); p.set(20, y + 1, F.dk); p.span(y + 2, 17, 18, F.dk); p.span(y + 2, 21, 22, F.dk)
      break
    }
    case 'cat': {
      p.span(y - 1, 18, 21, colour(a.nose, 0xff8aa8)); p.span(y, 19, 20, colour(a.nose, 0xff8aa8))
      p.set(18, y + 1, F.dk); p.set(19, y + 1, F.dk); p.set(20, y + 1, F.dk); p.set(21, y + 1, F.dk); p.set(17, y + 2, F.dk); p.set(22, y + 2, F.dk)
      for (const dy of [0, 2]) { p.span(y + dy, 9, 13, F.hi); p.span(y + dy, 26, 30, F.hi) }
      break
    }
    case 'pig': p.ellipse(19.5, y, 3.6, 2.6, F2.base); p.set(18, y, F.dk); p.set(21, y, F.dk); p.span(y + 2, 17, 22, F.dk); break
    case 'horse': case 'donkey': case 'long': {
      p.ellipse(19.5, y + 3, 6, 5, (x) => (x > 23 ? F2.lo : F2.base))
      p.set(17, y + 3, F.dk); p.set(22, y + 3, F.dk); p.span(y + 6, 17, 22, F.dk)
      break
    }
    case 'mouse': p.ellipse(19.5, y + 1, 5.5, 4, F2.base); p.ellipse(19.5, y - 1, 1.8, 1.4, nose); p.span(y + 3, 17, 22, F.dk); break
    case 'monkey': p.ellipse(19.5, y, 6, 5, F2.base); p.set(18, y, F.dk); p.set(21, y, F.dk); p.span(y + 3, 17, 22, F.dk); break
    case 'duck': case 'beak': case 'bigbeak': {
      const c = colour(a.nose ?? 'orange', 0xf28a2a)
      if (sn === 'duck') { p.ellipse(19.5, y + 1, 6, 2.6, c); p.span(y + 2, 14, 25, dark(c, 0.3)); p.set(17, y, dark(c, 0.5)); p.set(22, y, dark(c, 0.5)) }
      else if (sn === 'bigbeak') { p.trap(y - 2, y + 6, 15, 24, 19, 20, c); p.span(y + 2, 16, 23, dark(c, 0.3)) }
      else { p.trap(y - 1, y + 3, 17, 22, 19, 20, c); p.set(21, y, dark(c, 0.35)) }
      break
    }
    case 'frog': p.set(18, y - 1, F.dk); p.set(21, y - 1, F.dk); break
    case 'none': break
  }
}

function drawPattern(p: Pix, H: Head, a: NonNullable<PortraitSpec['animal']>, F: Ramp, F2: Ramp) {
  const pat = (a.pattern ?? 'none').toLowerCase()
  const inHeadFur = (x: number, y: number) => { const c = p.get(x, y); return c === F.base || c === F.lo || c === F.hi }
  switch (pat) {
    case 'stripes': for (const [x0, y0] of [[17, H.top + 1], [19, H.top], [21, H.top + 1], [11, H.eyeY + 2], [27, H.eyeY + 2], [11, H.eyeY + 4], [27, H.eyeY + 4]]) for (let k = 0; k < 3; k++) { const x = x0 + (x0 < 15 ? k : x0 > 24 ? -k : 0); const y = y0 + (x0 >= 15 && x0 <= 24 ? k : 0); if (inHeadFur(x, y)) p.set(x, y, F.dk) } break
    case 'patches': case 'panda': { const { outer, inner } = eyeCols(H); p.ellipse((outer + inner + 1) / 2, H.eyeY + 1, 3, 2.6, 0x2b2934); p.ellipse(39 - (outer + inner + 1) / 2 + 1, H.eyeY + 1, 3, 2.6, 0x2b2934); break }
    case 'spots': for (let y = H.top; y <= H.chin; y++) for (let x = 0; x < PW; x++) if (inHeadFur(x, y) && (x * 7 + y * 13) % 23 === 0) { p.set(x, y, F2.base === F.base ? F.dk : F2.base); p.set(x + 1, y, F2.base === F.base ? F.dk : F2.base) } break
    case 'mask': case 'face': for (let y = H.eyeY - 2; y <= H.chin; y++) { const sp = H.span(y)!; const w = y < H.eyeY + 1 ? 6 : 8; for (let x = Math.max(sp[0] + 1, Math.ceil(19.5 - w)); x <= Math.min(sp[1] - 1, Math.floor(19.5 + w)); x++) p.set(x, y, F2.base) } p.span(H.eyeY - 3, 15, 18, F2.base); p.span(H.eyeY - 3, 21, 24, F2.base); break
    case 'belly': break
  }
}

// ---------------------------------------------------------------------------
// special bases

function drawSponge(p: Pix, s: PortraitSpec, frame: Frame) {
  const Y = ramp(colour(s.color, 0xf5e04a))
  // shirt and tie
  for (let y = 38; y < PH; y++) p.span(y, 8, 31, y < 41 ? 0xf4f1ea : 0x9a6a3a)
  p.span(38, 18, 21, 0xd8303a); p.span(39, 19, 20, 0xd8303a); p.span(40, 19, 20, 0xb0202a)
  for (let y = 5; y <= 38; y++) for (let x = 8; x <= 31; x++) p.set(x, y, x >= 30 ? Y.lo : Y.base)
  for (let x = 8; x <= 31; x += 3) { p.set(x, 4, Y.base); p.set(x + 1, 4, Y.base) }
  for (const [x, y] of [[10, 9], [28, 7], [11, 31], [27, 33], [9, 20], [29, 23], [13, 36]]) { p.ellipse(x, y, 1.5, 1.2, 0xa8a020) }
  // eyes
  for (const cx of [14.5, 25]) { p.ellipse(cx, 16, 4.2, 4.2, 0x15111e); p.ellipse(cx, 16, 3.5, 3.5, 0xfaf6f0); if (frame !== 'blink') { p.ellipse(cx + (cx < 20 ? 0.5 : -0.5), 16.5, 2, 2, 0x4aa3e8); p.rect(Math.floor(cx), 16, 1, 2, 0x15111e) } else p.span(16, Math.floor(cx) - 3, Math.floor(cx) + 3, 0x15111e) }
  for (const x of [12, 14, 16, 23, 25, 27]) p.set(x, 11, 0x15111e)
  p.ellipse(20, 22, 2, 1.6, Y.hi)
  // freckly cheeks and grin
  p.ellipse(11, 24, 2.4, 2, 0xf08080); p.ellipse(29, 24, 2.4, 2, 0xf08080)
  if (frame === 'talk') { p.ellipse(20, 28, 7, 3, 0x6a1020); p.span(26, 17, 22, 0xfaf6f0) }
  else { p.span(26, 11, 29, 0x7a1a2a); p.set(10, 25, 0x7a1a2a); p.set(30, 25, 0x7a1a2a); p.span(27, 13, 27, 0x7a1a2a); p.rect(17, 27, 2, 3, 0xfaf6f0); p.rect(21, 27, 2, 3, 0xfaf6f0) }
}

function drawStarfish(p: Pix, s: PortraitSpec, frame: Frame) {
  const P = ramp(colour(s.color, 0xff9ab0))
  for (let y = 38; y < PH; y++) p.span(y, 6, 33, (y + Math.floor(y / 2)) % 4 === 0 ? 0xa060d0 : 0x6ac040)
  p.trap(4, 38, 18, 21, 9, 30, (x) => (x > 26 ? P.lo : P.base))
  p.trap(20, 30, 4, 12, 9, 15, P.base); p.trap(20, 30, 27, 35, 24, 30, P.lo)
  // brows, eyes, mouth
  p.span(16, 14, 17, 0x15111e); p.span(16, 22, 25, 0x15111e)
  for (const cx of [16, 23.5]) { p.ellipse(cx, 19.5, 2, 2.4, 0xfaf6f0); if (frame !== 'blink') p.set(Math.floor(cx), 20, 0x15111e); else p.span(19, Math.floor(cx) - 1, Math.floor(cx) + 1, 0x15111e) }
  if (frame === 'talk') p.ellipse(19.5, 27, 5, 2.5, 0x6a1020)
  else { p.span(26, 13, 26, 0x7a1a2a); p.set(12, 25, 0x7a1a2a); p.set(27, 25, 0x7a1a2a) }
}

function drawCrab(p: Pix, s: PortraitSpec, frame: Frame) {
  const R = ramp(colour(s.color, 0xd8402a))
  for (let y = 38; y < PH; y++) p.span(y, 5, 34, 0x72b6ff)
  p.span(38, 14, 25, 0x5a90d8)
  p.ellipse(19.5, 28, 15, 11, (x) => (x > 30 ? R.lo : R.base))
  for (const x of [15, 24]) { for (let y = 8; y <= 19; y++) { p.set(x, y, R.base); p.set(x + 1, y, R.lo) } p.ellipse(x + 0.5, 7, 3, 3, 0xfaf6f0); if (frame !== 'blink') p.rect(x, 7, 2, 2, 0x15111e); else p.span(7, x - 1, x + 2, 0x15111e) }
  p.span(25, 16, 23, R.dk)
  if (frame === 'talk') p.ellipse(19.5, 31, 7, 3, 0x3a1020)
  else { p.span(30, 12, 27, 0x3a1020); p.span(31, 13, 26, 0xfaf6f0); p.span(32, 14, 25, 0x3a1020) }
}

function drawRobot(p: Pix, s: PortraitSpec, frame: Frame) {
  const kind = (s.kind ?? 'boxy').toLowerCase()
  const M = ramp(colour(s.color, kind === 'bender' ? 0x9aa6b8 : 0xa8b2c4))
  const glow = colour(s.color2, kind === 'terminator' ? 0xff3030 : 0x8fd3ff)
  if (kind === 'glados') {
    // Suspended white shell, articulated neck and a single amber camera eye.
    p.rect(18, 0, 5, 12, 0x46465a)
    for (const x of [11, 27]) {
      p.rect(x, 0, 2, 18, 0x2b2934)
      p.rect(x < 20 ? x : x - 3, 17, 5, 2, 0x46465a)
    }
    p.ellipse(20, 12, 7, 5, M.lo)
    p.trap(13, 25, 15, 25, 19, 29, M.base)
    p.rect(24, 18, 4, 12, M.lo)
    p.trap(25, 40, 10, 28, 14, 25, M.base)
    p.span(25, 11, 27, M.hi)
    p.rect(12, 29, 14, 8, 0x2b2934)
    p.ellipse(19, 33, 4, 3, 0x15111e)
    p.ellipse(19, 33, frame === 'talk' ? 3 : 2, frame === 'blink' ? 1 : 2, glow)
    if (frame !== 'blink') p.set(18, 32, 0xfff6d0)
    p.span(40, 16, 23, M.lo)
    return
  }
  for (let y = 38; y < PH; y++) { const w = y === 38 ? 10 : y === 39 ? 14 : 16; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 31 ? M.lo : M.base) }
  if (kind === 'bender') {
    for (let y = 9; y <= 36; y++) { const w = y < 12 ? 6 + (y - 9) : 9; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 26 ? M.lo : M.base) }
    p.rect(19, 3, 2, 6, M.lo); p.ellipse(19.5, 3, 1.6, 1.6, M.base)
    p.rect(12, 15, 16, 7, 0x15111e)
    for (const cx of [15.5, 24]) { p.rect(Math.floor(cx) - 2, 16, 5, 5, 0xf8f4d0); if (frame !== 'blink') p.rect(Math.floor(cx) - (cx < 20 ? 0 : 1), 18, 2, 2, 0x15111e); else p.span(18, Math.floor(cx) - 2, Math.floor(cx) + 2, 0x15111e) }
    const my = 27
    p.rect(13, my, 14, frame === 'talk' ? 6 : 5, 0xf8f4d0)
    for (let x = 16; x <= 24; x += 3) for (let y = my; y < my + 5; y++) p.set(x, y, 0x46465a)
    p.span(my + 2, 13, 26, 0x46465a)
    return
  }
  if (kind === 'screen') {
    p.rect(7, 7, 26, 24, 0x2b2934); p.rect(9, 9, 22, 19, colour(s.color, 0x1d2b53)); p.rect(17, 31, 6, 4, 0x46465a); p.rect(13, 35, 14, 2, 0x46465a)
    const fc = glow
    if (frame === 'blink') { p.span(15, 13, 16, fc); p.span(15, 23, 26, fc) } else { p.rect(14, 13, 2, 3, fc); p.rect(24, 13, 2, 3, fc) }
    if (frame === 'talk') p.rect(17, 21, 6, 3, fc); else { p.span(22, 15, 24, fc); p.set(14, 21, fc); p.set(25, 21, fc) }
    return
  }
  if (kind === 'terminator' || kind === 'android') {
    // a human face with the metal showing through on one side
    return
  }
  // boxy
  p.rect(9, 8, 22, 27, M.base); for (let y = 8; y < 35; y++) p.span(y, 28, 30, M.lo); p.span(8, 9, 30, M.hi)
  p.rect(19, 3, 2, 5, M.lo); p.ellipse(19.5, 3, 1.8, 1.8, glow)
  for (const cx of [14.5, 24.5]) { p.ellipse(cx, 17, 3.3, 3.3, 0x2b2934); if (frame !== 'blink') p.ellipse(cx, 17, 2.2, 2.2, glow); else p.span(17, Math.floor(cx) - 2, Math.floor(cx) + 2, glow) }
  p.rect(13, 25, 14, frame === 'talk' ? 6 : 4, 0x2b2934); for (let x = 14; x <= 25; x += 2) p.span(26, x, x, glow)
  p.rect(6, 15, 3, 7, M.lo); p.rect(31, 15, 3, 7, M.lo)
}

function drawHelmet(p: Pix, s: PortraitSpec, frame: Frame) {
  const kind = (s.kind ?? 'vader').toLowerCase()
  const def: Record<string, [Col, Col]> = { vader: [0x2b2934, 0x8b8b99], trooper: [0xf4f1ea, 0x2b2934], chief: [0x5a7a3a, 0xe8b83a], spartan: [0xb07a3a, 0xd8303a], knight: [0xa8b2c4, 0x2b2934], astronaut: [0xf4f1ea, 0xe8b83a], football: [0x2f6fd6, 0xc2c3c7], diver: [0xb07a3a, 0x8fd3ff], racing: [0xf5d63a, 0x35a852] }
  const [d1, d2] = def[kind] ?? def.vader
  const A = ramp(colour(s.color, d1))
  const B = ramp(colour(s.color2, d2))
  // shoulders
  for (let y = 38; y < PH; y++) { const w = y === 38 ? 10 : y === 39 ? 14 : 16; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 31 ? (kind === 'vader' ? 0x15111e : A.lo) : kind === 'vader' ? 0x2b2934 : A.base) }
  if (kind === 'vader') {
    p.rect(14, 40, 12, 7, 0x46465a); for (const [x, c] of [[15, 0xd8303a], [17, 0x35a852], [19, 0x2f6fd6], [21, 0xf5d63a], [23, 0xd8303a]] as [number, Col][]) p.set(x, 42, c); p.span(44, 15, 24, 0x8b8b99)
    // dome flaring into a skirt
    p.ellipse(19.5, 15, 11, 10, (x) => (x > 25 ? A.lo : x < 14 ? A.hi : A.base))
    for (let y = 18; y <= 37; y++) { const w = 11 + Math.max(0, y - 26) * 0.6; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 25 ? A.lo : A.base) }
    // mask: brow ridge, eyes, nose, triangular grille
    p.span(17, 12, 27, 0x15111e)
    for (const cx of [15, 24]) { p.ellipse(cx, 20, 3.2, 2.4, 0x15111e); p.set(Math.floor(cx) - 1, 19, 0x5c5c6c) }
    p.trap(22, 26, 19, 20, 17, 22, 0x46465a)
    p.trap(27, 34, 18, 21, 13, 26, B.lo); for (let y = 28; y <= 33; y += 2) p.span(y, 18 - (y - 27) / 1.6, 21 + (y - 27) / 1.6, 0x15111e)
    return
  }
  p.ellipse(19.5, 21, 12, 15, (x) => (x > 26 ? A.lo : x < 13 ? A.hi : A.base))
  if (kind === 'trooper') {
    for (const cx of [15, 24]) p.trap(17, 22, cx - 3, cx + 2, cx - 1, cx + 1, 0x15111e)
    p.rect(17, 27, 6, 3, 0x2b2934); for (let x = 17; x <= 22; x += 2) p.set(x, 28, 0x8b8b99)
    p.span(25, 12, 15, 0x2b2934); p.span(25, 24, 27, 0x2b2934)
  } else if (kind === 'chief' || kind === 'astronaut' || kind === 'diver') {
    p.ellipse(19.5, 21, 8.5, 6, B.base); p.ellipse(17, 19.5, 3, 2, light(B.base, 0.5)); p.span(26, 12, 27, A.lo)
  } else if (kind === 'knight' || kind === 'spartan') {
    p.span(20, 10, 29, 0x15111e); p.span(21, 10, 29, 0x15111e)
    for (let y = 22; y <= 32; y++) p.span(y, 18, 21, 0x15111e)
    if (kind === 'spartan') for (let y = 2; y <= 8; y++) p.span(y, 16, 23, y % 2 ? B.base : B.lo)
  } else if (kind === 'racing') {
    p.span(14, 9, 30, B.base); p.span(15, 9, 30, B.base)
    p.rect(11, 18, 18, 6, 0x1d1a2a); p.span(18, 12, 18, 0x4a6a9a); p.set(13, 19, 0x9fdcff)
    for (let y = 26; y <= 32; y++) p.span(y, 17, 22, y % 2 ? A.lo : A.dk)
  } else if (kind === 'football') {
    p.ellipse(19.5, 23, 8, 6, 0xf0bf98)
    if (frame !== 'blink') { p.set(16, 22, 0x15111e); p.set(23, 22, 0x15111e) }
    for (let y = 24; y <= 32; y += 3) p.span(y, 11, 28, B.base); p.rect(19, 23, 2, 10, B.base)
  }
}

function drawSkull(p: Pix, s: PortraitSpec, frame: Frame) {
  const W = ramp(colour(s.color, 0xeeeae0))
  const robe = ramp(colour(s.color2, 0x2b2934))
  for (let y = 36; y < PH; y++) { const w = 8 + (y - 36) * 1.2; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 26 ? robe.lo : robe.base) }
  p.ellipse(19.5, 19, 10, 11, (x) => (x > 25 ? W.lo : W.base))
  p.rect(13, 27, 14, 6, W.base); p.span(27, 25, 26, W.lo)
  for (const cx of [15, 24]) p.ellipse(cx, 20, 3, 3.2, 0x15111e)
  if (frame !== 'blink') { p.set(15, 20, 0xe0302a); p.set(24, 20, 0xe0302a) }
  p.set(19, 25, 0x15111e); p.set(20, 25, 0x15111e); p.set(19, 24, 0x15111e)
  for (let x = 14; x <= 25; x += 2) p.set(x, frame === 'talk' ? 31 : 30, 0x15111e)
  p.span(frame === 'talk' ? 30 : 29, 14, 25, 0x15111e)
}

function drawGhost(p: Pix, s: PortraitSpec, frame: Frame) {
  const W = ramp(colour(s.color, 0xf4f1ea))
  for (let y = 8; y < PH; y++) { const w = y < 18 ? 10 * Math.sqrt(1 - ((18 - y) / 10.5) ** 2) : 11 + (y - 18) * 0.12; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 26 ? W.lo : W.base) }
  for (let x = 8; x <= 31; x++) if ((x >> 1) % 2) p.clear(x, PH - 1)
  if (frame === 'blink') { p.span(21, 13, 17, 0x15111e); p.span(21, 22, 26, 0x15111e) } else { p.ellipse(15, 20, 2.2, 3, 0x15111e); p.ellipse(24.5, 20, 2.2, 3, 0x15111e) }
  p.ellipse(19.5, 28, frame === 'talk' ? 3 : 2, frame === 'talk' ? 3 : 2, 0x15111e)
}

function drawTriangle(p: Pix, s: PortraitSpec, frame: Frame) {
  const Y = ramp(colour(s.color, 0xf5d63a))
  p.trap(6, 36, 19, 20, 4, 35, (x, y) => (x > 26 ? Y.lo : (y % 4 === 0 || (x + (y >> 2) * 3) % 7 === 0) && y > 20 ? Y.lo : Y.base))
  for (let y = 0; y <= 5; y++) p.span(y, 16, 23, y === 0 ? 0x46465a : 0x2b2934); p.span(5, 13, 26, 0x2b2934)
  for (let x = 4; x <= 35; x++) p.set(x, 37, 0x15111e)
  p.ellipse(19.5, 20, 5, 4.4, 0x15111e); p.ellipse(19.5, 20, 4, 3.4, 0xfaf6f0)
  if (frame !== 'blink') p.rect(19, 18, 2, 5, 0x15111e); else p.span(20, 16, 23, 0x15111e)
  p.span(33, 16, 18, 0x2b2934); p.span(33, 21, 23, 0x2b2934); p.span(34, 17, 22, 0x2b2934)
  for (let y = 37; y < PH; y++) { p.set(15, y, 0x2b2934); p.set(24, y, 0x2b2934) }
}

function drawBlob(p: Pix, s: PortraitSpec, frame: Frame) {
  const G = ramp(colour(s.color, 0x35a852))
  p.ellipse(19.5, 28, 9, 14, (x) => (x > 24 ? G.lo : G.base))
  p.set(16, 12, G.lo); p.set(15, 10, G.lo); p.set(14, 8, G.base); p.set(23, 12, G.lo); p.set(24, 10, G.lo); p.set(25, 8, G.base)
  p.ellipse(19.5, 22, 5, 4.2, 0xfaf6f0)
  if (frame !== 'blink') { p.ellipse(19.5, 22, 2.5, 2.5, colour(s.color2, 0xd8303a)); p.rect(19, 21, 2, 2, 0x15111e) } else p.span(22, 15, 24, 0x15111e)
  p.span(19, 14, 25, 0x15111e)
  if (frame === 'talk') p.ellipse(19.5, 31, 3, 2, 0x3a1020); else p.span(31, 17, 22, 0x3a1020)
}

function drawObject(p: Pix, s: PortraitSpec, frame: Frame) {
  const kind = (s.kind ?? 'book').toLowerCase()
  const A = ramp(colour(s.color, kind === 'tablet' ? 0x9a9aa8 : kind === 'scroll' || kind === 'document' ? 0xf1e2c2 : 0x7e1f3a))
  const B = colour(s.color2, kind === 'document' ? 0x2b2934 : 0xe8b83a)
  const face = s.extras?.includes('face')
  switch (kind) {
    case 'park-sign': {
      // A park-service sign, with a mountain and evergreen inside the shield.
      p.trap(6, 31, 7, 32, 9, 30, 0x7a4a2a)
      p.trap(31, 44, 9, 30, 19, 20, 0x7a4a2a)
      p.trap(9, 30, 10, 29, 11, 28, 0x3d6546)
      p.trap(30, 39, 11, 28, 19, 20, 0x3d6546)
      p.trap(15, 24, 16, 17, 11, 23, 0xf1e2c2)
      p.rect(23, 22, 2, 12, 0x2b2934)
      p.trap(13, 27, 23, 24, 18, 29, 0x203d2a)
      const label = (s.symbol ?? 'NPS').slice(0, 3)
      p.text(label, Math.floor((PW - (label.length * 4 - 1)) / 2), 9, 0xf1e2c2)
      return
    }
    case 'ai-search': {
      // A search-result card: a four-colour G and an overly cheerful AI answer.
      p.rect(5, 6, 30, 37, 0xf4f1ea)
      p.rect(5, 6, 30, 3, 0xc2c3c7)
      p.rect(8, 12, 24, 7, 0xe0e5ef)
      const logo = FONT.G
      logo.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '#') {
          p.set(10 + x, 13 + y, [0xd8303a, 0xe8b83a, 0x2f6fd6, 0x35a852, 0x35a852][y])
        }
      })
      p.span(15, 17, 28, 0x8b8b99)
      p.rect(8, 22, 24, 17, 0xe6ddfa)
      drawSymbol(p, 'star', 13, 27, 0x7a3fb0)
      p.text('AI', 21, 24, 0x2a3d78)
      if (frame === 'blink') p.span(33, 12, 27, 0x7a3fb0)
      else { p.rect(12, 32, 2, 2, 0x7a3fb0); p.rect(26, 32, 2, 2, 0x7a3fb0) }
      p.span(36, 17, 22, 0x7a3fb0)
      if (frame === 'talk') p.span(35, 17, 22, 0x7a3fb0)
      return
    }
    case 'book': {
      p.rect(9, 7, 22, 33, A.base); for (let y = 7; y < 40; y++) { p.set(9, y, A.dk); p.set(10, y, A.lo) } p.rect(11, 38, 20, 3, 0xf1e2c2); p.span(41, 10, 31, A.dk)
      drawSymbol(p, s.symbol, 20.5, 18, B)
      p.span(29, 14, 27, B); p.span(31, 16, 25, B)
      break
    }
    case 'tablet': for (let y = 6; y < 44; y++) { const w = y < 11 ? 12 * Math.sqrt(1 - ((11 - y) / 5.5) ** 2) : 12; for (let x = Math.ceil(19.5 - w); x <= Math.floor(19.5 + w); x++) p.set(x, y, x > 28 ? A.lo : (x + y * 3) % 11 === 0 ? A.lo : A.base) } for (let y = 13; y < 40; y += 3) p.span(y, 11, 28, A.dk); drawSymbol(p, s.symbol, 19.5, 9, A.dk); break
    case 'scroll': p.rect(10, 8, 20, 32, A.base); for (let y = 8; y < 40; y++) p.set(29, y, A.lo); p.ellipse(19.5, 7, 12, 2.5, A.lo); p.ellipse(19.5, 41, 12, 2.5, A.lo); for (let y = 13; y < 37; y += 3) p.span(y, 13, 26 - (y % 6), dark(A.base, 0.55)); if (s.symbol) drawSymbol(p, s.symbol, 25, 33, colour(s.color2, 0xd8303a)); break
    case 'document': {
      p.rect(9, 5, 22, 40, A.base); for (let y = 5; y < 45; y++) p.set(30, y, A.lo); p.trap(5, 9, 26, 30, 30, 30, A.lo)
      p.text((s.symbol ?? 'TOP').slice(0, 5), 12, 8, B)
      for (let y = 16; y < 40; y += 3) p.span(y, 12, 27 - ((y * 7) % 6), dark(A.base, 0.45))
      p.ellipse(24, 37, 4, 3, mixc(colour(s.color2, 0xd8303a), A.base, 0.2)); p.text('X', 23, 35, A.base)
      break
    }
    case 'screen': case 'device': {
      const frameC = ramp(colour(s.color, kind === 'device' ? 0xd8303a : 0x2b2934))
      p.rect(7, 8, 26, kind === 'device' ? 34 : 24, frameC.base); for (let y = 8; y < (kind === 'device' ? 42 : 32); y++) p.set(32, y, frameC.lo)
      p.rect(9, 10, 22, 17, colour(s.color2, 0x1d6a6a))
      if (kind === 'device') { p.ellipse(13, 35, 3, 3, 0x2f6fd6); p.rect(20, 33, 9, 2, 0x2b2934); p.rect(20, 37, 9, 2, 0x2b2934) } else { p.rect(17, 32, 6, 4, 0x46465a); p.rect(12, 36, 16, 2, 0x46465a) }
      const fc = 0xf4f1ea
      if (frame === 'blink') { p.span(16, 13, 16, fc); p.span(16, 23, 26, fc) } else { p.rect(14, 14, 2, 3, fc); p.rect(24, 14, 2, 3, fc) }
      if (frame === 'talk') p.rect(17, 20, 6, 3, fc); else { p.span(21, 15, 24, fc); p.set(14, 20, fc); p.set(25, 20, fc) }
      return
    }
    case 'lens': case 'hal': {
      p.rect(9, 4, 22, 42, 0x8b8b99); p.rect(10, 5, 20, 40, 0x2b2934); p.rect(11, 6, 18, 6, 0x46465a); p.text('HAL', 14, 7, 0xc8cdd6)
      p.ellipse(19.5, 25, 7, 7, 0x15111e); p.ellipse(19.5, 25, 5, 5, 0x7a1010); p.ellipse(19.5, 25, frame === 'talk' ? 3.5 : 2.6, frame === 'talk' ? 3.5 : 2.6, 0xe0302a); p.ellipse(19.5, 25, 1.2, 1.2, 0xffe060); p.set(17, 22, 0xffffff)
      return
    }
    case 'building': {
      p.trap(6, 14, 19, 20, 6, 33, A.base); p.rect(8, 15, 24, 28, A.base); for (let y = 15; y < 43; y++) p.set(31, y, A.lo)
      for (let x = 10; x <= 28; x += 4) for (let y = 18; y < 40; y++) p.set(x, y, A.lo)
      p.rect(17, 34, 6, 9, A.dk); drawSymbol(p, s.symbol, 19.5, 10, B)
      break
    }
    case 'flag': { p.rect(8, 4, 2, 42, 0x8b8b99); p.rect(10, 6, 22, 15, A.base); p.rect(10, 13, 22, 8, A.lo); drawSymbol(p, s.symbol, 21, 12, B); break }
    case 'globe': p.ellipse(19.5, 22, 13, 13, (x, y) => ((x * 3 + y * 5) % 9 < 4 ? 0x35a852 : 0x2f6fd6)); p.rect(18, 35, 4, 6, 0x8b8b99); p.rect(13, 41, 14, 2, 0x8b8b99); break
    case 'coin': p.ellipse(19.5, 23, 13, 13, A.base); p.ellipse(19.5, 23, 10, 10, A.lo); drawSymbol(p, s.symbol ?? 'dollar', 19.5, 23, A.hi); break
    case 'trophy': p.trap(8, 24, 10, 29, 16, 23, A.base); p.rect(18, 24, 4, 9, A.lo); p.rect(12, 33, 16, 5, A.dk); p.ring(8, 14, 3, 4, A.lo); p.ring(31, 14, 3, 4, A.lo); break
    case 'bottle': p.rect(17, 4, 6, 10, A.lo); p.rect(12, 14, 16, 30, A.base); p.rect(14, 22, 12, 12, 0xf1e2c2); drawSymbol(p, s.symbol, 19.5, 28, B); break
    case 'crown': p.rect(8, 22, 24, 10, A.base); for (const x of [8, 14, 19, 25, 31]) p.trap(12, 22, x, x + 1, x - 2, x + 2, A.base); p.ellipse(19.5, 27, 2, 2, colour(s.color2, 0xd8303a)); break
    case 'camera': p.rect(6, 14, 28, 20, A.base); p.rect(14, 10, 8, 4, A.base); p.ellipse(19.5, 24, 7, 7, 0x2b2934); p.ellipse(19.5, 24, 4, 4, 0x4aa3e8); break
    case 'eye': case 'sauron': {
      p.trap(4, 44, 18, 21, 15, 24, 0x2b2934)
      p.ellipse(19.5, 22, 15, 8, (x, y) => ((x + y) % 5 === 0 ? 0xff9a2a : 0xf26a1a))
      p.ellipse(19.5, 22, 11, 5.5, 0xf5c242)
      p.ellipse(19.5, 22, 1.4, frame === 'blink' ? 1 : 5, 0x15111e)
      for (let x = 5; x <= 34; x += 3) p.set(x, 13 + (x % 2), 0xff6a1a)
      return
    }
    case 'car': {
      const C2 = ramp(colour(s.color, 0xd8303a))
      p.ellipse(19.5, 24, 17, 12, (x) => (x > 30 ? C2.lo : C2.base))
      p.rect(8, 14, 24, 9, 0xf4f1ea)
      for (const cx of [14.5, 25]) { p.ellipse(cx, 18.5, 3.5, 3.5, 0x3f8ad6); if (frame !== 'blink') p.rect(Math.floor(cx), 18, 2, 2, 0x15111e); else p.span(18, Math.floor(cx) - 3, Math.floor(cx) + 3, 0x15111e) }
      p.span(30, 12, 27, 0x15111e); p.span(frame === 'talk' ? 31 : 29, 14, 25, 0x7a1a2a)
      p.rect(5, 36, 6, 7, 0x2b2934); p.rect(29, 36, 6, 7, 0x2b2934)
      drawSymbol(p, s.symbol, 32, 25, 0xf5d63a)
      return
    }
    case 'burger': p.ellipse(19.5, 16, 13, 7, 0xd99a3a); p.rect(6, 22, 28, 3, 0x35a852); p.rect(6, 25, 28, 4, 0x6a3a1a); p.rect(6, 29, 28, 2, 0xf5d63a); p.ellipse(19.5, 33, 13, 3, 0xd99a3a); break
    default: p.rect(10, 10, 20, 30, A.base)
  }
  if (face) {
    const fc = 0x15111e
    if (frame === 'blink') { p.span(22, 14, 16, fc); p.span(22, 23, 25, fc) } else { p.rect(14, 21, 2, 2, fc); p.rect(24, 21, 2, 2, fc) }
    if (frame === 'talk') p.rect(18, 26, 4, 3, fc); else p.span(27, 17, 22, fc)
  }
}

// ---------------------------------------------------------------------------
// main

function outline(p: Pix) {
  const filled = (x: number, y: number) => p.get(x, y) >= 0
  const out: number[] = []
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    if (filled(x, y)) continue
    if (filled(x + 1, y) || filled(x - 1, y) || filled(x, y + 1) || filled(x, y - 1)) out.push(y * PW + x)
  }
  for (const i of out) p.d[i] = OUTLINE
}

function drawHuman(p: Pix, s: PortraitSpec, frame: Frame) {
  const isAnimal = (s.base ?? 'human') === 'animal'
  const a = s.animal ?? {}
  const skinBase = isAnimal ? colour(a.fur ?? s.skin, 0x9a6a43) : colour(s.skin, SKIN.light, SKIN)
  const SK = ramp(skinBase)
  const F2 = ramp(colour(a.fur2, light(skinBase, 0.45)))
  const H = makeHead(s.face ?? (isAnimal ? 'round' : 'oval'), s.build, s.age)
  const age = s.age ?? 'adult'
  const defaultHair = age === 'old' || age === 'ancient' ? HAIR.grey : HAIR.brown
  const hairStyle = (s.hair ?? (isAnimal ? 'none' : 'short')).toLowerCase()
  const hc = ramp(colour(s.hairColor, defaultHair, HAIR))
  const fc = ramp(colour(s.facialHairColor ?? s.hairColor, hc.base, HAIR))
  const hw = (s.headwear ?? 'none').toLowerCase().replace(/[\s_]/g, '-')

  if (!HATS_COVER_HAIR.has(hw)) drawHairBack(p, H, hairStyle, hc)
  if (isAnimal && (a.pattern ?? '') === 'mane') drawHairBack(p, H, 'mane', ramp(colour(a.fur2, dark(skinBase, 0.25))))
  drawBody(p, H, s, SK, isAnimal ? SK : null)

  // ears
  const earStyle = (s.ears ?? 'normal').toLowerCase()
  if (isAnimal) drawAnimalEars(p, H, a, SK, ramp(colour(a.earColor ?? a.fur2, light(skinBase, 0.35))))
  else if (!HATS_HIDE_EARS.has(hw) && earStyle !== 'none' && earStyle !== 'hidden') {
    const ey = H.eyeY + 1
    const L = H.span(ey)![0], R = H.span(ey)![1]
    if (earStyle === 'pointy' || earStyle === 'elf') { for (let k = 0; k < 5; k++) { p.set(L - 1 - (k >> 1), ey - k, SK.base); p.set(L - 1 - (k >> 1), ey - k + 1, SK.base); p.set(R + 1 + (k >> 1), ey - k, SK.lo); p.set(R + 1 + (k >> 1), ey - k + 1, SK.lo) } }
    else if (earStyle === 'yoda' || earStyle === 'huge') { p.trap(ey - 3, ey + 1, 2, L, 5, L, SK.base); p.trap(ey - 3, ey + 1, R, 37, R, 34, SK.lo); p.span(ey - 1, 6, L - 1, SK.lo); p.span(ey - 1, R + 1, 33, SK.dk) }
    else if (earStyle === 'ogre' || earStyle === 'shrek') { p.rect(L - 3, ey - 3, 3, 2, SK.base); p.rect(L - 2, ey - 1, 2, 3, SK.base); p.rect(R + 1, ey - 3, 3, 2, SK.lo); p.rect(R + 1, ey - 1, 2, 3, SK.lo); p.set(L - 3, ey - 3, SK.dk); p.set(R + 3, ey - 3, SK.dk) }
    else if (earStyle === 'big') { p.ellipse(L - 0.5, ey + 0.5, 2.5, 3.5, SK.base); p.ellipse(R + 1.5, ey + 0.5, 2.5, 3.5, SK.lo); p.set(L - 1, ey, SK.lo); p.set(R + 1, ey, SK.dk) }
    else { p.ellipse(L, ey + 0.5, 1.6, 2.6, SK.base); p.ellipse(R + 1, ey + 0.5, 1.6, 2.6, SK.lo); p.set(L - 1, ey, SK.lo); p.set(R + 1, ey + 1, SK.dk) }
  }

  // head
  const fuzzy = (s.extras ?? []).includes('fuzzy')
  for (let y = H.top; y <= H.chin; y++) {
    const sp = H.span(y)!
    for (let x = sp[0]; x <= sp[1]; x++) {
      let c = SK.base
      if (x === sp[1] || (x === sp[1] - 1 && y > H.eyeY)) c = SK.lo
      else if (y >= H.chin - 1 && x > 16) c = SK.lo
      else if (x <= sp[0] + 1 && y < H.eyeY - 2 && y > H.top + 1) c = SK.hi
      p.set(x, y, c)
    }
    if (fuzzy && (y % 2 === 0)) { p.set(sp[0] - 1, y, SK.base); p.set(sp[1] + 1, y, SK.lo) }
  }
  if (fuzzy) for (let x = 12; x <= 27; x += 2) p.set(x, H.top - 1, x > 23 ? SK.lo : SK.base)
  if ((s.build ?? '') === 'heavy') { p.span(H.chin - 1, 16, 23, SK.lo); p.span(H.chin + 1, 15, 24, SK.lo) }

  if (isAnimal) drawPattern(p, H, a, SK, F2)
  drawExtras(p, H, s, SK, hc, 'face')
  if (!isAnimal || (a.snout ?? 'none') === 'none') drawNose(p, H, s, SK)
  drawFacialHair(p, H, s.facialHair ?? 'none', fc, SK)
  drawMouth(p, H, s, SK, frame)
  if (isAnimal && (a.snout ?? 'none') !== 'none') drawSnout(p, H, a, SK, a.muzzle ? ramp(colour(a.muzzle, F2.base)) : F2)
  drawEyes(p, H, s, SK, frame)
  drawBrows(p, H, s, colour(s.browColor, hairStyle === 'bald' || hairStyle === 'none' ? dark(SK.base, 0.55) : hc.dk, HAIR))
  if (!HATS_COVER_HAIR.has(hw)) drawHairFront(p, H, hairStyle, hc, SK, hw !== 'none')
  if (age === 'old' || age === 'ancient') {
    p.set(12, H.eyeY + 1, SK.lo); p.set(27, H.eyeY + 1, SK.lo); p.set(16, H.mouthY - 1, SK.lo); p.set(23, H.mouthY - 1, SK.lo)
    if (age === 'ancient') { p.span(H.hl + 2, 15, 18, SK.lo); p.span(H.hl + 2, 21, 24, SK.lo); p.span(H.eyeY + 2, 14, 16, SK.lo); p.span(H.eyeY + 2, 23, 25, SK.lo) }
  }
  if (s.headwearPattern) {
    const before = new Int32Array(p.d)
    drawHeadwear(p, H, s, SK)
    const pat = s.headwearPattern.toLowerCase()
    for (let i = 0; i < p.d.length; i++) {
      if (p.d[i] === before[i] || p.d[i] < 0) continue
      const x = i % PW, y = Math.floor(i / PW)
      if (pat === 'leopard') { const k = (x * 7 + y * 13) % 9; if (k === 0) p.d[i] = 0x3a2414; else if (k === 1) p.d[i] = 0x8a5a24 }
      else if (pat === 'plaid' && (x % 4 === 0 || y % 4 === 0)) p.d[i] = dark(p.d[i], 0.4)
      else if (pat === 'stripes' && y % 2 === 0) p.d[i] = light(p.d[i], 0.5)
    }
  } else drawHeadwear(p, H, s, SK)
  if (s.hairColor2) {
    // two-tone hair: the subject's right side (viewer's left) in the second colour
    const h2 = ramp(colour(s.hairColor2, 0x2b2934, HAIR))
    const map = new Map<number, number>([[hc.base, h2.base], [hc.lo, h2.lo], [hc.hi, h2.hi], [hc.dk, h2.dk]])
    for (let i = 0; i < p.d.length; i++) { const x = i % PW; if (x <= 19 && map.has(p.d[i])) p.d[i] = map.get(p.d[i])! }
  }
  drawEyewear(p, H, s, frame)
  drawExtras(p, H, s, SK, hc, 'front')
}

/** Render a portrait frame as RGBA bytes (PW x PH, row 0 = top). */
export function renderPortrait(spec: PortraitSpec, frame: Frame = 'idle'): Uint8ClampedArray {
  const p = new Pix()
  const base = (spec.base ?? 'human').toLowerCase()
  switch (base) {
    case 'sponge': drawSponge(p, spec, frame); break
    case 'starfish': drawStarfish(p, spec, frame); break
    case 'crab': drawCrab(p, spec, frame); break
    case 'robot': if (['terminator', 'android'].includes((spec.kind ?? '').toLowerCase())) { drawHuman(p, { ...spec, base: 'human' }, frame); robotOverlay(p, spec, frame) } else drawRobot(p, spec, frame); break
    case 'helmet': drawHelmet(p, spec, frame); break
    case 'skull': drawSkull(p, spec, frame); break
    case 'ghost': drawGhost(p, spec, frame); break
    case 'triangle': drawTriangle(p, spec, frame); break
    case 'blob': drawBlob(p, spec, frame); break
    case 'object': drawObject(p, spec, frame); break
    default: drawHuman(p, spec, frame)
  }
  outline(p)
  const out = new Uint8ClampedArray(PW * PH * 4)
  for (let i = 0; i < PW * PH; i++) {
    const c = p.d[i]
    if (c < 0) continue
    out[i * 4] = (c >> 16) & 255
    out[i * 4 + 1] = (c >> 8) & 255
    out[i * 4 + 2] = c & 255
    out[i * 4 + 3] = 255
  }
  return out
}

function robotOverlay(p: Pix, s: PortraitSpec, frame: Frame) {
  const H = makeHead(s.face ?? 'square', s.build, s.age)
  const kind = (s.kind ?? '').toLowerCase()
  if (kind === 'terminator') {
    // the right half of the face is torn away to the chrome skull, with a red eye
    for (let y = H.hl - 1; y <= H.chin - 3; y++) { const sp = H.span(y)!; for (let x = 21; x <= sp[1]; x++) p.set(x, y, (x + y) % 3 === 0 ? 0x9aa1ad : x === sp[1] ? 0x6a6a78 : 0xc8cdd6) }
    p.ellipse(23.5, H.eyeY + 1, 2.2, 2, 0x2b2934); if (frame !== 'blink') p.ellipse(23.5, H.eyeY + 1, 1.3, 1.3, 0xff3030)
    for (let y = H.hl - 1; y <= H.chin - 3; y++) p.set(21, y, 0xc04050)
  } else {
    // android: seams and a glowing temple light
    for (let y = H.top + 2; y <= H.chin - 2; y += 6) { const sp = H.span(y)!; p.span(y, sp[0] + 1, sp[1] - 1, dark(colour(s.skin, SKIN.metal, SKIN), 0.25)) }
    p.rect(H.span(H.eyeY)![0], H.eyeY - 1, 1, 3, colour(s.color2, 0x8fd3ff))
  }
}

// ---------------------------------------------------------------------------
// fallbacks

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }

/** A plausible anonymous person, stable per name, for anyone without a spec. */
export function fallbackSpec(name: string): PortraitSpec {
  const h = hash(name)
  const pick = <T,>(arr: T[], salt: number) => arr[(h >>> salt) % arr.length]
  return {
    skin: pick(['pale', 'fair', 'light', 'medium', 'tan', 'olive', 'brown', 'dark'], 0),
    hair: pick(['short', 'sidepart', 'slick', 'bald', 'long', 'bob', 'curly', 'receding'], 3),
    hairColor: pick(['black', 'darkbrown', 'brown', 'blonde', 'grey', 'auburn'], 6),
    outfit: pick(['suit', 'shirt', 'sweater', 'tshirt', 'blazer'], 9),
    outfitColor: pick(['charcoal', 'navy', 'grey', 'brown', 'blue', 'green'], 12),
    mouth: pick(['neutral', 'smile', 'smirk'], 15),
  }
}

/** The mystery suspect: a dark silhouette. */
export function renderSilhouette(): Uint8ClampedArray {
  const p = new Pix()
  drawHuman(p, { hair: 'short', outfit: 'suit', mouth: 'none', eyes: 'none' as string, nose: 'none' }, 'idle')
  p.recolor(() => 0x4a4470)
  outline(p)
  const out = new Uint8ClampedArray(PW * PH * 4)
  for (let i = 0; i < PW * PH; i++) { const c = p.d[i]; if (c < 0) continue; out[i * 4] = (c >> 16) & 255; out[i * 4 + 1] = (c >> 8) & 255; out[i * 4 + 2] = c & 255; out[i * 4 + 3] = 255 }
  return out
}

export const OPTIONS = {
  base: ['human', 'animal', 'sponge', 'starfish', 'crab', 'robot', 'helmet', 'skull', 'ghost', 'triangle', 'blob', 'object'],
  skin: Object.keys(SKIN),
  face: Object.keys(FACES),
  build: Object.keys(SHOULDER),
  age: ['child', 'young', 'adult', 'old', 'ancient'],
  hair: ['wig', 'baldlong', 'bouffant', 'longbangs', 'highponytail', 'quills', 'cornrows', 'bald', 'baldsides', 'receding', 'buzz', 'short', 'messy', 'crew', 'curly', 'pixie', 'sidepart', 'sidefringe', 'slick', 'widow', 'pompadour', 'spiky', 'zigzag', 'anime', 'wild', 'afro', 'mohawk', 'combover', 'bowl', 'mop', 'shaggy', 'fringe', 'long', 'longwavy', 'curlylong', 'bob', 'shoulder', 'rocker', 'dreads', 'braids', 'bun', 'topknot', 'ponytail', 'pigtails', 'beehive', 'mullet', 'undercut', 'flattop', 'tonsure', 'wisps', 'partmiddle', 'homer', 'tuft', 'none'],
  hairColor: Object.keys(HAIR),
  facialHair: ['none', 'stubble', 'shadow', 'moustache', 'pencil', 'toothbrush', 'walrus', 'stalin', 'handlebar', 'dali', 'vandyke', 'imperial', 'horseshoe', 'fumanchu', 'goatee', 'soulpatch', 'chinstrap', 'muttonchops', 'sideburns', 'short', 'full', 'long', 'braided', 'tentacles'],
  brows: ['oneraised', 'normal', 'thin', 'thick', 'bushy', 'angry', 'sad', 'raised', 'unibrow', 'none'],
  eyes: ['normal', 'small', 'dots', 'narrow', 'sleepy', 'closed', 'angry', 'wide', 'crazy', 'big', 'pingpong', 'googly', 'frog', 'cyclops', 'glow', 'hollow'],
  eyeColor: ['dark', 'brown', 'blue', 'green', 'grey', 'hazel', 'red', 'yellow', 'purple'],
  nose: ['normal', 'small', 'button', 'big', 'long', 'hooked', 'droopy', 'ball', 'pig', 'beak', 'duck', 'slits', 'none'],
  mouth: ['neutral', 'smile', 'grin', 'bigsmile', 'joker', 'frown', 'smirk', 'open', 'o', 'tongue', 'teeth', 'buck', 'fangs', 'lipstick', 'muppet', 'wide', 'gold', 'gap', 'none'],
  ears: ['normal', 'big', 'pointy', 'yoda', 'ogre', 'none'],
  eyewear: ['browline', 'none', 'round', 'square', 'thick', 'reading', 'sunglasses', 'aviators', 'shutter', 'monocle', 'eyepatch', 'goggles', 'visor', 'star', 'heart', 'mask', '3d', 'cateye'],
  headwear: ['pickelhaube', 'sikke', 'camauro', 'nurse', 'mongol', 'magneto', 'goggles-up', 'shades-up', 'none', 'tophat', 'bowler', 'fedora', 'newsboy', 'cowboy', 'beret', 'cap', 'cap-back', 'military', 'peaked', 'helmet', 'spartan', 'crown', 'tiara', 'turban', 'kufi', 'hijab', 'veil', 'habit', 'keffiyeh', 'zucchetto', 'kippah', 'mitre', 'laurel', 'fez', 'ushanka', 'beanie', 'bandana', 'headband', 'durag', 'hood', 'cowl', 'batcowl', 'skimask', 'wizard', 'party', 'santa', 'jester', 'nightcap', 'pirate', 'tricorn', 'bicorne', 'chef', 'graduation', 'headphones', 'halo', 'horns', 'viking', 'sombrero', 'pith', 'hardhat', 'bucket', 'sailor', 'bow', 'flower', 'coin', 'antennae', 'propeller', 'beaver', 'visor', 'tinfoil'],
  outfit: Object.keys(OUTFIT_DEFAULT),
  extras: ['kohl', 'necktattoo', 'bolt', 'zinc', 'poppedcollar', 'freckles', 'blush', 'mole', 'scar', 'wrinkles', 'bags', 'tattoo', 'facepaint', 'clown', 'tear', 'sweat', 'drool', 'bolts', 'stitches', 'lashes', 'bindi', 'tilak', 'nosering', 'gaara', 'redstripe', 'chinridges', 'fuzzy', 'cigar', 'cigarette', 'pipe', 'medals', 'necklace', 'chain', 'pearls', 'cross', 'earrings', 'hoops', 'microphone', 'flower', 'rose', 'scarf', 'stethoscope', 'badge', 'dogtags', 'bowtie', 'tie', 'spikes', 'lightsaber', 'mask', 'surgicalmask', 'face'],
  animalEars: ['pointy', 'round', 'mouse', 'floppy', 'long', 'pikachu', 'donkey', 'small', 'antlers', 'none'],
  animalSnout: ['dog', 'bear', 'lion', 'cat', 'pig', 'horse', 'mouse', 'monkey', 'duck', 'beak', 'bigbeak', 'frog', 'none'],
  animalPattern: ['none', 'stripes', 'patches', 'spots', 'mask', 'mane'],
  robotKind: ['bender', 'boxy', 'screen', 'terminator', 'android'],
  helmetKind: ['vader', 'trooper', 'chief', 'spartan', 'knight', 'astronaut', 'football', 'diver', 'racing'],
  patterns: ['leopard', 'plaid', 'camo', 'pinstripes', 'vstripes', 'hstripes', 'polka', 'zigzag', 'unionjack'],
  objectKind: ['eye', 'car', 'book', 'tablet', 'scroll', 'document', 'screen', 'device', 'ai-search', 'park-sign', 'lens', 'building', 'flag', 'globe', 'coin', 'trophy', 'bottle', 'crown', 'camera', 'burger'],
  symbols: Object.keys(SYMBOLS).filter((k) => k !== 'swastika'),
  colors: Object.keys(COLORS),
}
