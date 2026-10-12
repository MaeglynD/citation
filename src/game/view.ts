import type { View } from './store'

export const FRAME_MAX_W = 576
export const FRAME_MAX_H = 400

/** Keep text in a usable virtual frame, even on short phones and square tablets. */
export function calculateView(width: number, height: number, dpr: number, maxCssPixel: number): View {
  const bufW = Math.round(width * dpr), bufH = Math.round(height * dpr)
  const portrait = bufW / bufH < 1.55
  const target = portrait ? 400 : 360
  const cap = Math.max(1, Math.floor(maxCssPixel * dpr + 1e-6))
  const scale = Math.min(Math.max(1, Math.round(Math.min(bufW, bufH) / target)), cap, bufW / 320, bufH / (portrait ? 600 : 360))
  const w = Math.max(2, 2 * Math.round(bufW / scale / 2))
  const h = Math.max(2, 2 * Math.round(bufH / scale / 2))
  const fw = Math.min(w, portrait ? 400 : FRAME_MAX_W)
  const fh = Math.min(h, portrait ? 700 : FRAME_MAX_H)
  return { w, h, fw, fh, scale, portrait }
}
