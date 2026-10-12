import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame, type View } from '../game/store'
import { useSettings } from '../game/settings'
import { formatPlayedAt, type AnswerRecord } from '../game/history'
import type { Quote } from '../game/types'
import { fitText, wrapLines } from '../game/layout'
import { PixelText, FONTS } from './PixelText'
import { PixelBox } from './PixelBox'
import { Bitmap, CHECK, CROSS, QUOTE_OPEN } from './Sprites'
import { Mugshot } from './Mugshot'
import { SourceLink } from './SourceLink'
import { Confetti } from './Confetti'
import { usePalette } from '../themes'
import { audio } from '../audio/engine'
import { Surface, Action, Control } from './Surface'

export interface ReviewEntry { quote: Quote; answer: AnswerRecord }

export function reviewLayout(view: View, q: Quote, count: number) {
  const top = view.fh / 2, bottom = -top, bw = Math.min(view.fw - 28, 540)
  const perRow = view.portrait ? 5 : 10, slotW = Math.min(50, (bw - 8) / perRow)
  const lineupY = top - 103, rows = Math.ceil(count / perRow)
  const fileTop = lineupY - (rows - 1) * 59 - 34, fileBottom = bottom + 44
  const peopleH = view.portrait ? 108 : 58
  const sourceH = wrapLines(q.source + ' ↗', (bw - 30) / 6.4) * 16 + 8
  const fit = fitText(q.quote, bw - 34, Math.max(24, fileTop - fileBottom - peopleH - sourceH - 32))
  const bh = fit.height + 24, quoteY = fileTop - bh / 2, peopleTop = fileTop - bh - 14
  const peopleY = peopleTop - 28, sourceY = peopleTop - peopleH - 2
  return { top, bottom, bw, perRow, slotW, lineupY, fileTop, fileBottom, peopleH, sourceH, fit, bh, quoteY, peopleTop, peopleY, sourceY }
}

export function Summary() {
  const deck = useGame(s => s.deck), picks = useGame(s => s.picks), results = useGame(s => s.results)
  const gameStartedAt = useGame(s => s.gameStartedAt), phaseAt = useGame(s => s.phaseAt)
  const entries = deck.map((quote, i) => ({ quote, answer: {
    quoteId: quote.id, picked: picks[i], correct: results[i] === 'right', at: gameStartedAt,
  } }))
  return <ResultReview entries={entries} total={deck.length} startedAt={gameStartedAt}
    since={phaseAt} onPlay={() => useGame.getState().restart()} />
}

/** The same complete result sheet is used for the current game and saved games. */
export function ResultReview({ entries, total, startedAt, since = 0, onPlay, onBack, legacy = false }: {
  entries: ReviewEntry[]; total: number; startedAt: number; since?: number
  onPlay?: () => void; onBack?: () => void; legacy?: boolean
}) {
  const pal = usePalette(), view = useGame(s => s.view)
  const [sel, setSel] = useState(0), [copyState, setCopyState] = useState('COPY RESULT')
  const score = entries.filter(e => e.answer.correct).length
  const [shownScore, setShownScore] = useState(onBack ? score : 0)
  const lastCount = useRef(-1)
  useFrame(() => {
    if (onBack) return
    const t = Math.min(1, Math.max(0, (performance.now() - since - 150) / 650))
    const n = Math.round(score * (1 - (1 - t) ** 3))
    if (n !== lastCount.current) { lastCount.current = n; setShownScore(n) }
  })
  const move = (d: number) => { setSel(i => (i + d + entries.length) % entries.length); audio.hover() }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useSettings.getState().open || e.repeat || !entries.length) return
      const d = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0
      if (d) { e.preventDefault(); move(d) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [entries.length])
  useEffect(() => {
    if (copyState === 'COPY RESULT') return
    const t = setTimeout(() => setCopyState('COPY RESULT'), 2000)
    return () => clearTimeout(t)
  }, [copyState])
  if (!entries.length) return null
  const entry = entries[Math.min(sel, entries.length - 1)], q = entry.quote
  const pageStart = Math.floor(sel / 10) * 10, shown = entries.slice(pageStart, pageStart + 10)
  const { top, bottom, bw, perRow, slotW, lineupY, fileTop, fileBottom, peopleH, sourceH, fit, bh, quoteY, peopleTop, peopleY, sourceY } = reviewLayout(view, q, shown.length)
  const picked = [q.answer, ...q.decoys].find(p => p.name === entry.answer.picked) ?? { name: entry.answer.picked }
  const share = async () => {
    try {
      await navigator.clipboard.writeText('CITATION NEEDED ' + score + '/' + total + '\n'
        + entries.map(e => e.answer.correct ? '🟩' : '🟥').join('') + '\n' + location.origin + location.pathname)
      setCopyState('COPIED!')
    } catch { setCopyState('COPY FAILED') }
  }
  return <group>
    <Surface x={0} y={-16} w={bw + 12} h={view.fh - 52} z={-.4} fill={pal.box} stroke={pal.boxEdge} />
    <PixelBox x={0} y={top - 63} w={bw + 8} h={38} z={-.2} fill={pal.bg2} border={0} />
    <PixelText x={-bw / 2 + 10} y={top - 60} size={legacy ? 16 : 24} color={pal.accent} anchorX="left">{shownScore + '/' + total}</PixelText>
    {legacy && <PixelText x={bw / 2 - 10} y={top - 55} size={8} color={pal.paper} anchorX="right">EARLIER ANSWERS</PixelText>}
    <PixelText x={bw / 2 - 10} y={top - (legacy ? 73 : 62)} size={16} font={FONTS.vt} color={pal.text} anchorX="right">{formatPlayedAt(startedAt)}</PixelText>
    {shown.map((e, index) => {
      const i = pageStart + index, count = Math.min(perRow, shown.length - Math.floor(index / perRow) * perRow)
      const x = (index % perRow - (count - 1) / 2) * slotW, y = lineupY - Math.floor(index / perRow) * 59
      const color = e.answer.correct ? pal.good : pal.bad
      return <Control key={i} x={x} y={y} w={slotW} h={56} z={2} onClick={() => setSel(i)}>{hot => <>
        <Mugshot x={0} y={0} name={e.quote.answer.name} border={hot || sel === i ? pal.accent : color} scale={.7} still />
        <PixelBox x={13} y={-16} z={1} w={12} h={11} fill={color} stroke={color} />
        <Bitmap rows={e.answer.correct ? CHECK : CROSS} x={13} y={-16} z={1.3} color={e.answer.correct ? pal.goodInk : pal.badInk} />
        <PixelText x={0} y={-28} size={8} color={pal.muted}>{String(i + 1).padStart(2, '0')}</PixelText>
      </>}</Control>
    })}
    <Surface kind="paper" x={0} y={quoteY} w={bw - 10} h={bh} fill={pal.paper} stroke={pal.paperEdge} />
    <Bitmap rows={QUOTE_OPEN} x={-bw / 2 + 13} y={fileTop - 8} color={pal.mark} z={.3} />
    <PixelText x={0} y={quoteY} size={fit.size} font={FONTS[fit.font]} color={pal.ink} maxWidth={bw - 34} lineHeight={fit.lineHeight}>{q.quote}</PixelText>
    {[{ person: picked, label: 'YOUR PICK', good: entry.answer.correct }, { person: q.answer, label: 'SAID IT', good: true }].map((p, i) => {
      const left = -bw / 2 + i * (bw / 2 + 4), colW = bw / 2 - 8
      const px = view.portrait ? left + colW / 2 : left + 24
      return <group key={i}>
        <Mugshot x={px} y={peopleY} name={p.person.name} border={p.good ? pal.good : pal.bad} still />
        <PixelText x={view.portrait ? px : left + 55} y={view.portrait ? peopleTop - 64 : peopleTop - 7} size={8}
          color={p.good ? pal.good : pal.bad} anchorX={view.portrait ? 'center' : 'left'}>{p.label}</PixelText>
        <PixelText x={view.portrait ? px : left + 55} y={view.portrait ? peopleTop - 78 : peopleTop - 23} size={16} font={FONTS.vt}
          color={pal.boxText} maxWidth={view.portrait ? colW : colW - 58} anchorY="top" lineHeight={1}
          align={view.portrait ? 'center' : 'left'} anchorX={view.portrait ? 'center' : 'left'}>{p.person.name}</PixelText>
      </group>
    })}
    <group name="review-citation">
      <PixelText x={0} y={sourceY} size={16} font={FONTS.vt} color={pal.text} maxWidth={bw - 30} lineHeight={1} anchorY="top">{q.source + ' ↗'}</PixelText>
      <SourceLink url={q.url} x={0} y={sourceY - sourceH / 2} w={bw} h={sourceH} />
    </group>
    {onBack && <>
      <Action x={-bw / 2 + 28} y={bottom + 18} w={46} h={26} label="<" onClick={() => move(-1)} disabled={entries.length < 2} />
      <Action x={0} y={bottom + 18} w={146} h={26} label="BACK TO GAMES" primary onClick={onBack} />
      <Action x={bw / 2 - 28} y={bottom + 18} w={46} h={26} label=">" onClick={() => move(1)} disabled={entries.length < 2} />
    </>}
    {!onBack && <>
      <Action x={-74} y={bottom + 18} w={136} h={26} label="PLAY AGAIN" primary onClick={onPlay!} />
      <Action x={74} y={bottom + 18} w={136} h={26} label={copyState} onClick={() => void share()} />
      <Confetti burstKey={score > 0 ? 'summary' : null} since={since} delay={.2} x={0} y={top - 70} spread={bw * .85} />
    </>}
  </group>
}
