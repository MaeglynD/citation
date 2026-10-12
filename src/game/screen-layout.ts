import type { View } from './store'
import { displayName, type Quote } from './types'
import { fitText, wrapLines } from './layout'
import { PW, PH } from '../portraits/render'
const CARD_W = PW + 4, CARD_H = PH + 4

export const META_SIZE = 16
export const META_LH = 16
const META_ADV = 0.4 // VT323 advance width in em (monospace)

export interface Layout {
  /** content width (options span this) */
  bw: number
  dotsY: number
  // speech bubble
  bubbleX: number
  bubbleW: number
  innerW: number
  quoteSize: number
  quoteFont: 'press' | 'vt'
  lineHeight: number
  bubbleTop: number
  bubbleBottom: number
  bubbleCy: number
  bh: number
  tailX: number
  tailY: number
  tailLeft: boolean
  // suspect
  mugScale: number
  mugX: number
  mugY: number
  plateY: number | null
  plateW: number
  textX: number
  textW: number
  // reveal block
  cardW: number
  cardH: number
  cardX: number
  cardY: number
  srcTop: number
  noteTop: number
  // options
  optW: number
  optH: number
  optSize: number
  optFont: 'press' | 'vt'
  optLineHeight: number
  gap: number
  cols: number
  optsTop: number
  optsBottom: number
  optPos: (i: number) => { x: number; y: number }
}

/** Greedy word wrap for a monospace font: returns the number of lines. */
function fitQuote(quote: string, innerW: number, maxBh: number, portrait: boolean, padY: number) {
  const f = fitText(quote, innerW, maxBh - padY * 2)
  return { quoteSize: f.size, quoteFont: f.font, lineHeight: f.lineHeight, textH: f.height }
}

export function layout(v: View, q: Quote): Layout {
  const { fw: w, fh: h, portrait } = v
  // Roomy screens get the dialogue layout: a double-size portrait on the left, talking into the bubble.
  const wide = !portrait && h >= 330
  const mugScale = wide || (portrait && h >= 560) ? 2 : 1
  const MUG_W = CARD_W * mugScale + 4
  const MUG_H = CARD_H * mugScale + 4
  const m = portrait ? 14 : 26
  const bw = w - 2 * m
  const dotsY = h / 2 - (portrait ? 65 : 11)
  const cols = 2
  const rows = 4 / cols
  const gap = 10
  const optW = Math.floor((bw - gap) / 2)
  const optSize = portrait ? 16 : 8, optFont = portrait ? 'vt' as const : 'press' as const
  const optLineHeight = portrait ? 1 : 1.25
  const optionAdvance = portrait ? 6.4 : 8
  const optionLines = Math.max(...[q.answer, ...q.decoys].map(person => wrapLines(displayName(person), (optW - 44) / optionAdvance)))
  const optH = Math.max(portrait ? 48 : 38, optionLines * optSize * optLineHeight + 12)
  const optsH = rows * optH + (rows - 1) * gap
  const optsBottom = -h / 2 + 30
  const regionTop = dotsY - 14
  const padY = 14
  const name = displayName(q.answer)

  const measureReveal = (textW: number) => {
    const cardW = Math.min(textW, name.length * 8 + 28)
    const nameLines = wrapLines(name, Math.max(4, Math.floor((cardW - 20) / 8)))
    const cardH = 10 + Math.round(nameLines * 8 * 1.25) + 2
    const metaCpl = Math.max(10, Math.floor(textW / (META_SIZE * META_ADV)))
    const srcLines = 0
    const noteLines = q.note ? wrapLines(q.note, metaCpl) : 0
    const revealH = cardH + 6 + (noteLines ? 4 + noteLines * META_LH : 0)
    return { cardW, cardH, srcLines, revealH }
  }

  let optsTop = optsBottom + optsH
  const optPos = (i: number) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = -bw / 2 + optW / 2 + c * (optW + gap)
    const y = optsTop - optH / 2 - r * (optH + gap)
    return { x: Math.round(x), y: Math.round(y) }
  }

  if (wide) {
    const plateH = 16
    const leftW = MUG_W
    const bubbleLeft = -bw / 2 + leftW + 14
    const bubbleW = Math.round(bw / 2 - bubbleLeft)
    const bubbleX = Math.round(bubbleLeft + bubbleW / 2)
    const textX = Math.round(bubbleLeft)
    const textW = bubbleW
    const R = measureReveal(textW)
    const midTop = regionTop
    const midBottom = optsTop + 10
    const midH = midTop - midBottom
    const innerW = bubbleW - 36
    const maxBh = midH - R.revealH - 10
    const f = fitQuote(q.quote, innerW, maxBh, false, padY)
    const bh = Math.max(64, Math.min(maxBh, Math.round(f.textH + padY * 2)))
    const blockH = Math.max(bh + 10 + R.revealH, MUG_H + 4 + plateH)
    const top = Math.round(midTop - Math.max(0, midH - blockH) / 2)
    const bubbleTop = top
    const bubbleBottom = top - bh
    const mugY = Math.round(top - MUG_H / 2)
    const plateY = Math.round(mugY - MUG_H / 2 - 4 - plateH / 2)
    const tailY = Math.max(bubbleBottom + 12, Math.min(bubbleTop - 12, mugY + 14))
    const cardY = bubbleBottom - 10 - R.cardH / 2
    const srcTop = cardY - R.cardH / 2 - 6
    const result: Layout = {
      bw, dotsY, bubbleX, bubbleW, innerW, quoteSize: f.quoteSize, quoteFont: f.quoteFont, lineHeight: f.lineHeight,
      bubbleTop, bubbleBottom, bubbleCy: Math.round((bubbleTop + bubbleBottom) / 2), bh,
      tailX: bubbleLeft - 5, tailY, tailLeft: true,
      mugScale, mugX: Math.round(-bw / 2 + MUG_W / 2), mugY, plateY, plateW: MUG_W, textX, textW,
      cardW: R.cardW, cardH: R.cardH, cardX: textX + R.cardW / 2, cardY, srcTop, noteTop: srcTop - R.srcLines * META_LH - 2,
      optW, optH, optSize, optFont, optLineHeight, gap, cols, optsTop, optsBottom, optPos,
    }
    return result
  }

  // Compact layout (phones, short windows): the mugshot hangs under the bubble's tail, reveal text beside it.
  const mugX = Math.round(-bw / 2 + 4 + MUG_W / 2)
  const textX = Math.round(-bw / 2 + 4 + MUG_W + 10)
  const textW = Math.round(bw / 2 - textX - 2)
  const R = measureReveal(textW)
  const suspectZone = Math.max(14 + MUG_H + 10, R.revealH + 24)
  const maxBh = regionTop - (optsBottom + optsH + suspectZone)
  const pad = portrait ? 12 : 18
  const innerW = bw - pad * 2
  const f = fitQuote(q.quote, innerW, maxBh, portrait, padY)
  const bh = Math.max(portrait ? 60 : 64, Math.min(maxBh, Math.round(f.textH + padY * 2)))
  let bubbleTop: number
  if (portrait) {
    const stackH = bh + suspectZone + optsH
    bubbleTop = Math.round(regionTop - (regionTop - optsBottom - stackH) / 2)
    optsTop = bubbleTop - bh - suspectZone
  } else {
    const free = regionTop - optsTop - (bh + suspectZone)
    bubbleTop = Math.round(regionTop - Math.max(0, free) / 2)
  }
  const bubbleBottom = bubbleTop - bh
  const mugY = Math.round(bubbleBottom - 14 - MUG_H / 2)
  const cardY = bubbleBottom - 10 - R.cardH / 2
  const srcTop = cardY - R.cardH / 2 - 6
  return {
    bw, dotsY, bubbleX: 0, bubbleW: bw, innerW, quoteSize: f.quoteSize, quoteFont: f.quoteFont, lineHeight: f.lineHeight,
    bubbleTop, bubbleBottom, bubbleCy: Math.round((bubbleTop + bubbleBottom) / 2), bh,
    tailX: mugX + 2, tailY: bubbleBottom - 4, tailLeft: false,
    mugScale, mugX, mugY, plateY: null, plateW: MUG_W, textX, textW,
    cardW: R.cardW, cardH: R.cardH, cardX: textX + R.cardW / 2, cardY, srcTop, noteTop: srcTop - R.srcLines * META_LH - 2,
    optW, optH, optSize, optFont, optLineHeight, gap, cols, optsTop, optsBottom: optsTop - optsH, optPos,
  }
}

export function reviewLayout(view: View, q: Quote, count: number) {
  const top = view.fh / 2, bottom = -top, bw = Math.min(view.fw - 28, 540)
  const perRow = view.portrait ? 5 : 10, slotW = Math.min(50, (bw - 8) / perRow)
  const lineupY = top - 103, rows = Math.ceil(count / perRow)
  const fileTop = lineupY - (rows - 1) * 59 - 34, fileBottom = bottom + (view.portrait ? 56 : 44)
  const nameWidth = view.portrait ? bw / 2 - 8 : bw / 2 - 66
  const nameLines = Math.max(...[q.answer, ...q.decoys].map(p => wrapLines(p.name, nameWidth / 6.4)))
  const peopleH = view.portrait ? 78 + nameLines * 16 + 10 : Math.max(58, 23 + nameLines * 16 + 10)
  const sourceH = wrapLines(q.source + ' ↗', (bw - 30) / 6.4) * 16 + 8
  const compact = !view.portrait && view.fh < 380
  const quotePadding = compact ? 16 : 24, peopleGap = compact ? 10 : 14
  const quoteSpace = fileTop - fileBottom - peopleH - sourceH - quotePadding - peopleGap - 6
  const fit = fitText(q.quote, bw - 34, Math.max(24, quoteSpace))
  const bh = fit.height + quotePadding, quoteY = fileTop - bh / 2, peopleTop = fileTop - bh - peopleGap
  const peopleY = peopleTop - 28, sourceY = peopleTop - peopleH - 2
  return { top, bottom, bw, perRow, slotW, lineupY, fileTop, fileBottom, peopleH, sourceH, quoteSpace, fit, bh, quoteY, peopleTop, peopleY, sourceY }
}

