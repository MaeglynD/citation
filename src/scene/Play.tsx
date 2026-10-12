import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, SUSPENSE_MS, type View } from '../game/store'
import { CHARS_PER_SECOND } from '../game/settings'
import { input } from '../game/input'
import { displayName, type Quote } from '../game/types'
import { PixelText, FONTS } from './PixelText'
import { PixelBox, BubbleTail } from './PixelBox'
import { Bitmap, CURSOR, CHECK, CROSS, QUOTE_OPEN, QUOTE_CLOSE, HEAD } from './Sprites'
import { Mugshot } from './Mugshot'
import { CARD_W, CARD_H, preload } from '../portraits/textures'
import { usePalette, useTheme } from '../themes'
import { audio, voiceFor } from '../audio/engine'
import { Confetti } from './Confetti'
import { wrapLines, fitText } from '../game/layout'
import { VerdictReaction } from './VerdictReaction'
import { Surface, Control } from './Surface'

// ---- layout -----------------------------------------------------------------

const META_SIZE = 16
const META_LH = 16
const META_ADV = 0.4 // VT323 advance width in em (monospace)

interface Layout {
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

export function layout(v: View, q: Quote, theme = 'arcade'): Layout {
  const { fw: w, fh: h, portrait } = v
  // Roomy screens get the dialogue layout: a double-size portrait on the left, talking into the bubble.
  const wide = !portrait && h >= 330
  const mugScale = wide || (portrait && h >= 560) ? 2 : 1
  const MUG_W = CARD_W * mugScale + 4
  const MUG_H = CARD_H * mugScale + 4
  const m = portrait ? 14 : 26
  const bw = w - 2 * m
  const dotsY = h / 2 - 11
  const cols = 2
  const rows = 4 / cols
  const gap = 10
  const optW = Math.floor((bw - gap) / 2)
  const optionLines = Math.max(...[q.answer, ...q.decoys].map(person => wrapLines(displayName(person), (optW - 44) / 8)))
  const optH = Math.max(portrait ? 48 : 38, optionLines * 10 + 12)
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
      optW, optH, gap, cols, optsTop, optsBottom, optPos,
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
    optW, optH, gap, cols, optsTop, optsBottom: optsTop - optsH, optPos,
  }
}

// ---- helpers ----------------------------------------------------------------

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

// ---- components -------------------------------------------------------------

/** A row of little suspects: dark silhouettes that get coloured in as each case is closed. */
function ProgressDots({ L }: { L: Layout }) {
  const pal = usePalette()
  const results = useGame((s) => s.results)
  const round = useGame((s) => s.round)
  const total = useGame((s) => s.deck.length)
  const blinkRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (blinkRef.current) blinkRef.current.visible = Math.floor(clock.getElapsedTime() * 2.5) % 2 === 0
  })
  const w = 8
  const gap = 4
  const totalW = total * w + (total - 1) * gap
  const x0 = -totalW / 2 + w / 2
  return (
    <group>
      {Array.from({ length: total }, (_, i) => {
        const r = results[i]
        const x = x0 + i * (w + gap)
        const isCurrent = i === round && !r
        const color = r === 'right' ? pal.good : r === 'wrong' ? pal.bad : pal.dim
        return (
          <group key={i}>
            <Bitmap rows={HEAD} x={x} y={L.dotsY} color={color} />
            {isCurrent && (
              <group ref={blinkRef}>
                <Bitmap rows={HEAD} x={x} y={L.dotsY} z={0.3} color={pal.boxText} />
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}

function QuoteBubble({ L }: { L: Layout }) {
  const pal = usePalette()
  const theme = useTheme()
  const q = useGame((s) => s.deck[s.round])
  const phase = useGame((s) => s.phase)
  const phaseAt = useGame((s) => s.phaseAt)
  const typedDone = useGame((s) => s.typedDone)
  const finishTyping = useGame((s) => s.finishTyping)
  const groupRef = useRef<THREE.Group>(null)
  const [shown, setShown] = useState(0)
  const voice = useMemo(() => voiceFor(q.id), [q.id])

  useEffect(() => { setShown(0) }, [q.id])

  const typingStart = 0.3

  useFrame(() => {
    const t = (performance.now() - phaseAt) / 1000
    if (groupRef.current) {
      const k = phase === 'question' ? easeOutBack(clamp01(t / 0.3)) : 1
      groupRef.current.scale.setScalar(Math.max(0.01, k))
    }
    if (phase !== 'question') return
    if (typedDone) {
      if (shown !== q.quote.length) setShown(q.quote.length)
      return
    }
    const cps = CHARS_PER_SECOND
    const n = Math.min(q.quote.length, Math.floor(Math.max(0, t - typingStart) * cps))
    if (n !== shown) {
      if (n - shown < 6) for (let i = shown; i < n; i++) audio.blip(q.quote[i], voice, i)
      setShown(n)
      if (n >= q.quote.length) { finishTyping(); audio.typed() }
    }
  })

  // Hide the untyped tail by colouring it like the paper.
  const colorRanges = useMemo(() => {
    if (phase !== 'question' || typedDone || shown >= q.quote.length) return undefined
    return { 0: pal.ink, [shown]: pal.paper } as Record<number, string>
  }, [shown, q.quote.length, pal, phase, typedDone])

  return (
    <group ref={groupRef} position={[L.bubbleX, L.bubbleCy, 0]}>
      <group position={[-L.bubbleX, -L.bubbleCy, 0]}>
        <Surface kind="paper" x={L.bubbleX} y={L.bubbleCy} w={L.bubbleW} h={L.bh} fill={pal.paper} stroke={pal.paperEdge}
          onClick={(e) => { if (phase === 'question' && !typedDone) { e.stopPropagation(); finishTyping() } }} />
        <BubbleTail x={L.tailX} y={L.tailY} w={16} h={12} z={.08} left={L.tailLeft} fill={pal.paper} stroke={pal.paperEdge} />
        {/* Giant quotation marks make it unmistakably a quote. */}
        <Bitmap rows={QUOTE_OPEN} x={L.bubbleX - L.bubbleW / 2 + 16} y={L.bubbleTop - 10} z={0.3} color={pal.mark} />
        <Bitmap rows={QUOTE_CLOSE} x={L.bubbleX + L.bubbleW / 2 - 16} y={L.bubbleBottom + 10} z={0.3} color={pal.mark} />
        <PixelText
          x={L.bubbleX}
          y={L.bubbleCy}
          z={0.2}
          size={L.quoteSize}
          lineHeight={L.lineHeight}
          color={pal.ink}
          font={FONTS[L.quoteFont]}
          maxWidth={L.innerW}
          align="center"
          anchorX="center"
          anchorY="middle"
          colorRanges={colorRanges}
        >
          {q.quote}
        </PixelText>
      </group>
    </group>
  )
}

/** The mugshot under the bubble: mystery silhouette, the hovered suspect, or the real speaker. */
function Suspect({ L }: { L: Layout }) {
  const pal = usePalette()
  const q = useGame((s) => s.deck[s.round])
  const phase = useGame((s) => s.phase)
  const phaseAt = useGame((s) => s.phaseAt)
  const options = useGame((s) => s.options)
  const hovered = useGame((s) => s.hovered)
  const hoverAt = useGame((s) => s.hoverAt)
  const picked = useGame((s) => s.picked)
  const results = useGame((s) => s.results)

  useEffect(() => { preload([q.answer.name, ...q.decoys.map((d) => d.name)]) }, [q])

  const revealed = phase === 'reveal' || phase === 'transition'
  let name: string | null = null
  let talkUntil = 0
  let border: string = pal.cardEdge
  if (phase === 'question' && hovered !== null && options[hovered]) { name = options[hovered].person.name; talkUntil = hoverAt + 420; border = pal.accent }
  else if (phase === 'suspense' && picked !== null && options[picked]) { name = options[picked].person.name; border = pal.accent }
  else if (revealed) { name = q.answer.name; talkUntil = phaseAt + 1300; border = results[results.length - 1] === 'right' ? pal.good : pal.bad }

  const hoveredLabel = phase === 'question' && hovered !== null && options[hovered] ? displayName(options[hovered].person) : null
  return (
    <group>
      <group name="live-speaker">
        <Mugshot x={L.mugX} y={L.mugY} name={name} talkUntil={talkUntil} border={border} scale={L.mugScale} still />
      </group>
      {L.plateY === null && hoveredLabel && (
        <PixelText x={L.textX} y={L.mugY + 6} size={8} color={pal.accent} font={FONTS.press} anchorX="left" align="left" maxWidth={L.textW}>
          {`${hoveredLabel}?`}
        </PixelText>
      )}
    </group>
  )
}

function RevealInfo({ L }: { L: Layout }) {
  const pal = usePalette()
  const view = useGame((s) => s.view)
  const q = useGame((s) => s.deck[s.round])
  const phase = useGame((s) => s.phase)
  const phaseAt = useGame((s) => s.phaseAt)
  const results = useGame((s) => s.results)
  const right = results[results.length - 1] === 'right'
  const cardRef = useRef<THREE.Group>(null)
  const noteRef = useRef<THREE.Group>(null)
  const nextRef = useRef<THREE.Group>(null)
  const name = displayName(q.answer)

  useFrame(({ clock }) => {
    if (phase !== 'reveal' && phase !== 'transition') return
    const t = (performance.now() - phaseAt) / 1000
    const e = clock.getElapsedTime()
    if (cardRef.current) {
      const k = clamp01((t - 0.35) / 0.22)
      const s = k <= 0 ? 0.001 : 2.4 - 1.4 * easeOutBack(k)
      cardRef.current.scale.setScalar(Math.max(0.001, s))
      cardRef.current.visible = t > 0.35
    }
    if (noteRef.current) noteRef.current.visible = t > 1.15
    if (nextRef.current) nextRef.current.visible = t >= 1.5
  })

  if (phase !== 'reveal' && phase !== 'transition') return null
  return (
    <group>
      <group ref={cardRef} position={[L.cardX, L.cardY, 0]} visible={false}>
        <PixelBox x={0} y={0} w={L.cardW} h={L.cardH} fill={right ? pal.good : pal.accent} stroke={pal.paperEdge} radius={3} shadow={pal.shadow} shadowOffset={[2, -2]} border={2} z={0.5} />
        <PixelText x={0} y={0} z={0.8} size={8} color={right ? pal.goodInk : pal.accentInk} font={FONTS.press} maxWidth={L.cardW - 16} lineHeight={1.25}>
          {name}
        </PixelText>
      </group>
      {q.note && (
        <group ref={noteRef} visible={false}>
          <PixelText x={L.textX + 2} y={L.noteTop} z={0.6} size={META_SIZE} color={pal.mark} font={FONTS.vt} anchorX="left" anchorY="top" maxWidth={L.textW} align="left" lineHeight={1}>
            {q.note}
          </PixelText>
        </group>
      )}
      <group ref={nextRef} visible={false}>
        <PixelText x={view.fw / 2 - 30} y={L.optsBottom - 14} z={2} size={8} color={pal.accent} font={FONTS.press} anchorX="right">
          NEXT
        </PixelText>
        <Bitmap rows={CURSOR} x={view.fw / 2 - 20} y={L.optsBottom - 14} z={2} color={pal.accent} />
      </group>
    </group>
  )
}

function OptionBox({ L, i }: { L: Layout; i: number }) {
  const pal = usePalette()
  const opt = useGame(s => s.options[i]), phase = useGame(s => s.phase), phaseAt = useGame(s => s.phaseAt)
  const hovered = useGame(s => s.hovered === i), picked = useGame(s => s.picked === i)
  const groupRef = useRef<THREE.Group>(null)
  const suspenseRef = useRef<THREE.Group>(null)
  const { x, y } = L.optPos(i)
  useFrame(() => {
    if (!groupRef.current) return
    const t = (performance.now() - phaseAt) / 1000
    const entrance = phase === 'question' ? easeOutBack(clamp01((t - .18 - i * .05) / .3)) : 1
    const verdict = phase === 'reveal'
    const waiting = phase === 'suspense' && picked
    const quiver = waiting ? Math.sin(t * Math.PI * 10) * .85 : 0
    const hop = verdict && opt?.correct ? Math.sin(Math.min(1, t / .65) * Math.PI) * 9 : 0
    const wobble = verdict && picked && !opt?.correct ? Math.sin(t * 30) * 3 * Math.max(0, 1 - t / .45) : 0
    groupRef.current.position.set(Math.round(wobble + quiver), Math.round((entrance - 1) * 18 + hop), 0)
    if (suspenseRef.current) suspenseRef.current.position.x = Math.round(-L.optW / 2 + 12 + (L.optW - 24) * clamp01(t * 1000 / SUSPENSE_MS))
    groupRef.current.visible = phase !== 'question' || t > .18 + i * .05
    const pop = phase === 'reveal' && opt?.correct ? Math.max(0, Math.sin(Math.min(Math.PI, (t - .35) * 10))) * .04 : 0
    groupRef.current.scale.setScalar(t > .35 ? 1 + pop : 1)
  })
  if (!opt) return null
  const active = phase === 'question'
  const revealed = phase === 'reveal' || phase === 'transition'
  const right = revealed && opt.correct, wrong = revealed && picked && !opt.correct
  const chosen = phase === 'suspense' && picked
  const fill = right ? pal.good : wrong ? pal.bad : chosen ? pal.accent : pal.box
  const text = right ? pal.goodInk : wrong ? pal.badInk : chosen ? pal.accentInk : revealed || phase === 'suspense' ? pal.muted : pal.boxText
  const w = L.optW, h = L.optH
  const keyColor = pal.box
  return <group name={'answer-card-' + i} ref={groupRef}>
    <Control x={x} y={y} w={w} h={h} z={.5} focused={hovered} disabled={!active} sound={false}
      onOver={() => useGame.getState().hover(i)} onOut={() => useGame.getState().hover(null)}
      onClick={() => {
        if (!useGame.getState().typedDone) { useGame.getState().hover(i); useGame.getState().finishTyping(); return }
        if (input.lastPointer === 'touch' && !hovered) { useGame.getState().hover(i); return }
        useGame.getState().pick(i); document.body.style.cursor = 'default'
      }}>{(hot, down) => <>
      <Surface kind="button" x={0} y={0} w={w} h={h} z={.5}
        fill={hot ? pal.paper : fill} stroke={hot || chosen ? pal.accent : right || wrong ? pal.paperEdge : revealed ? pal.dim : pal.boxEdge} />
      <PixelBox x={-w / 2 + 15} y={0} w={18} h={18} z={.6} fill={right || wrong || chosen ? fill : keyColor} stroke={hot ? pal.accent : pal.dim} border={hot || right || wrong || chosen ? 0 : 1} radius={2} />
      {right || wrong ? <Bitmap rows={right ? CHECK : CROSS} x={-w / 2 + 15} y={0} z={.7} color={text} />
        : <PixelText x={-w / 2 + 15} y={0} z={.7} size={8} color={right || wrong || chosen ? text : pal.muted}>{String(i + 1)}</PixelText>}
      <PixelText x={12} y={down ? -1 : 0} z={.7} size={8} color={hot ? pal.ink : text} maxWidth={w - 44} lineHeight={1.25}>{displayName(opt.person)}</PixelText>
      {chosen && <group name={'answer-suspense-' + i} ref={suspenseRef} position={[-w / 2 + 12, 0, 0]}>
        <PixelBox x={0} y={-h / 2 + 4} w={12} h={1} z={.8} fill={pal.paper} opacity={.8} border={0} />
      </group>}
      {hot && <PixelBox x={w / 2 - 8} y={h / 2 - 8} w={2} h={2} z={.8} border={0} fill={pal.accent} />}
    </>}</Control>
  </group>
}

export function Play() {
  const pal = usePalette()
  const theme = useTheme()
  const view = useGame((s) => s.view)
  const q = useGame((s) => s.deck[s.round])
  const phase = useGame((s) => s.phase)
  const phaseAt = useGame((s) => s.phaseAt)
  const results = useGame((s) => s.results)
  const options = useGame((s) => s.options)
  const L = useMemo(() => (q ? layout(view, q, theme.id) : null), [view, q, theme.id])
  if (!q || !L) return null
  const right = phase === 'reveal' && results[results.length - 1] === 'right'
  const correctIdx = Math.max(0, options.findIndex((o) => o.correct))
  const cpos = L.optPos(correctIdx)
  return (
    <group>
      <ProgressDots L={L} />
      <QuoteBubble key={q.id} L={L} />
      <Suspect L={L} />
      <RevealInfo L={L} />
      {phase === 'reveal' && <VerdictReaction key={'reaction-' + q.id} right={right} since={phaseAt} x={L.mugX} y={L.mugY} />}
      {[0, 1, 2, 3].map((i) => <OptionBox key={`${q.id}-${i}`} L={L} i={i} />)}
      <Confetti burstKey={right ? q.id : null} since={phaseAt} delay={0.12} x={cpos.x} y={cpos.y + L.optH / 2} spread={L.optW * 0.8} />
    </group>
  )
}
