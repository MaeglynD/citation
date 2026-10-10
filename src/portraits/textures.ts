import * as THREE from 'three'
import { renderPortrait, renderSilhouette, fallbackSpec, PW, PH, type Frame, type PortraitSpec } from './render'
import specs from '../data/portraits.json'

/**
 * Portrait textures: one nearest-filtered, transparent DataTexture per (person, frame),
 * made on demand. The striped mugshot card behind them is drawn by the scene, so the
 * same texture works in every theme.
 */

export const CARD_W = PW + 4
export const CARD_H = PH + 4

const SPECS = specs as Record<string, PortraitSpec>
const cache = new Map<string, THREE.DataTexture>()

export function specFor(name: string): PortraitSpec {
  return SPECS[name] ?? fallbackSpec(name)
}

export function hasSpec(name: string): boolean {
  return name in SPECS
}

function toTexture(pixels: Uint8ClampedArray, tint?: string, theme?: string): THREE.DataTexture {
  const data = new Uint8Array(CARD_W * CARD_H * 4)
  const t = tint ? new THREE.Color(tint) : null
  for (let y = 0; y < PH; y++) {
    for (let x = 0; x < PW; x++) {
      const k = (y * PW + x) * 4
      if (pixels[k + 3] === 0) continue
      // DataTexture row 0 is the bottom; portrait row 0 is the top. Centre the portrait on the card.
      const o = ((CARD_H - 1 - (y + 2)) * CARD_W + (x + 2)) * 4
      if (t) { data[o] = Math.round(t.r * 255); data[o + 1] = Math.round(t.g * 255); data[o + 2] = Math.round(t.b * 255) }
      else if (theme === 'noir' || theme === 'gameboy') {
        const luminance = (pixels[k] * .299 + pixels[k + 1] * .587 + pixels[k + 2] * .114) / 255
        const colors = theme === 'gameboy' ? [[15,56,15],[48,98,48],[139,172,15],[155,188,15]] : [[25,25,30],[84,84,92],[158,157,157],[232,230,223]]
        const c = colors[Math.min(3, Math.floor(luminance * 4))]
        data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]
      } else {
        // A stepped, directional light pass ties every portrait to its miniature stage.
        // Preserve the drawn facial details; only lift a narrow silhouette rim and cool the far edge.
        const rim = x > 0 && pixels[k - 4 + 3] === 0 && y < PH * .7
        const shade = x > PW * .67 ? .92 : 1
        data[o] = Math.min(255, Math.round(pixels[k] * shade + (rim ? 14 : 0)))
        data[o + 1] = Math.min(255, Math.round(pixels[k + 1] * shade + (rim ? 10 : 0)))
        data[o + 2] = Math.min(255, Math.round(pixels[k + 2] * shade + (rim ? 3 : x > PW * .67 ? 4 : 0)))
      }
      data[o + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, CARD_W, CARD_H, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export function portraitTexture(name: string, frame: Frame = 'idle', theme = 'arcade'): THREE.DataTexture {
  const variant = theme === 'noir' || theme === 'gameboy' ? theme : 'color'
  const key = `${name}\u0000${frame}\u0000${variant}`
  let tex = cache.get(key)
  if (!tex) {
    tex = toTexture(renderPortrait(specFor(name), frame), undefined, variant)
    cache.set(key, tex)
  }
  return tex
}

/** The mystery suspect, in the theme's silhouette colour (the outline stays dark). */
export function silhouetteTexture(color: string): THREE.DataTexture {
  const key = `\u0000silhouette\u0000${color}`
  let tex = cache.get(key)
  if (!tex) {
    const px = renderSilhouette()
    const c = new THREE.Color(color)
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue
      const dark = px[i] + px[i + 1] + px[i + 2] < 90 // the outline
      if (!dark) { px[i] = Math.round(c.r * 255); px[i + 1] = Math.round(c.g * 255); px[i + 2] = Math.round(c.b * 255) }
    }
    tex = toTexture(px)
    cache.set(key, tex)
  }
  return tex
}

/** Warm the cache for the four suspects of a question so hovering never hitches. */
export function preload(names: string[]) {
  for (const n of names) for (const f of ['idle', 'blink', 'talk'] as Frame[]) portraitTexture(n, f)
}
