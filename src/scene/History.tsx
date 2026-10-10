import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { useSettings } from '../game/settings'
import { usePalette } from '../themes'
import { formatPlayedAt } from '../game/history'
import { PixelText, FONTS } from './PixelText'
import { PixelBox } from './PixelBox'
import { Bitmap, CHECK, CROSS } from './Sprites'
import { Surface, Action, Control } from './Surface'
import { ResultReview, type ReviewEntry } from './Summary'
import { audio } from '../audio/engine'

export function History() {
  const p = usePalette(), v = useGame(s => s.view), all = useGame(s => s.all), games = useGame(s => s.games)
  const gameId = useGame(s => s.reviewGameId), game = games.find(g => g.id === gameId)
  const [selected, setSelected] = useState(0), selectedRef = useRef(0)
  const choose = (n: number) => { selectedRef.current = n; setSelected(n) }
  const perPage = v.portrait ? 5 : 3, start = Math.floor(selected / perPage) * perPage
  const move = (d: number) => { if (games.length) { choose((selectedRef.current + d + games.length) % games.length); audio.hover() } }
  const open = (i: number) => { if (games[i]) useGame.setState({ reviewGameId: games[i].id }) }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useSettings.getState().open || e.repeat || useGame.getState().reviewGameId) return
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); move(-1) }
      else if (['ArrowRight', 'ArrowDown', 'Tab'].includes(e.key)) { e.preventDefault(); move(e.shiftKey ? -1 : 1) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(selectedRef.current) }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [games, selected])
  if (game) {
    const entries = game.answers.flatMap(answer => {
      const quote = all.find(q => q.id === answer.quoteId)
      return quote ? [{ quote, answer }] : []
    }) as ReviewEntry[]
    if (entries.length) return <ResultReview key={game.id} entries={entries} total={game.total} startedAt={game.startedAt}
      legacy={game.legacy} onBack={() => useGame.setState({ reviewGameId: null })} />
    return <group><PixelText size={16} color={p.paper}>These quotes are unavailable.</PixelText><Action x={0} y={-50} label="BACK TO GAMES" onClick={() => useGame.setState({reviewGameId:null})} /></group>
  }
  const w = Math.min(v.fw - 32, 490), top = Math.min(v.fh / 2 - 55, v.portrait ? 265 : 145)
  if (!games.length) return <group>
    <Surface x={0} y={0} w={w} h={170} fill={p.box} stroke={p.boxEdge} />
    <PixelText x={0} y={40} size={16} color={p.accent}>HISTORY</PixelText>
    <PixelText x={0} y={0} size={20} font={FONTS.vt} color={p.text}>Your games will appear here.</PixelText>
    <Action x={0} y={-47} label="BACK" onClick={() => useGame.getState().menu()} />
  </group>
  const shown = games.slice(start, start + perPage), rowH = v.portrait ? 81 : 68, gap = v.portrait ? 12 : 10
  const gameCount = games.filter(g => !g.legacy).length
  const bottom = top - 45 - shown.length * (rowH + gap)
  return <group>
    <PixelText x={-w / 2 + 5} y={top} size={16} color={p.paper} anchorX="left">HISTORY</PixelText>
    {gameCount > 0 && <PixelText x={w / 2 - 4} y={top} size={8} color={p.muted} anchorX="right">{gameCount + (gameCount === 1 ? ' GAME' : ' GAMES')}</PixelText>}
    {shown.map((g, slot) => {
      const i = start + slot, y = top - 38 - rowH / 2 - slot * (rowH + gap)
      const score = g.answers.filter(a => a.correct).length, complete = g.completedAt !== null
      return <Control key={g.id} x={0} y={y} w={w} h={rowH} z={1} focused={selected === i} onClick={() => open(i)} onOver={() => choose(i)}>{hot => <>
        <Surface x={0} y={0} w={w} h={rowH} z={1} fill={hot ? p.bg2 : p.box} stroke={hot ? p.accent : p.boxEdge} />
        <PixelBox x={-w / 2 + 2} y={0} w={3} h={rowH - 8} z={1.1} fill={complete ? p.bg3 : p.mark} border={0} />
        <PixelText x={-w / 2 + 16} y={rowH / 2 - 16} z={1.2} size={16} font={FONTS.vt} color={p.paper} anchorX="left">{g.legacy ? 'Earlier answers' : formatPlayedAt(g.startedAt)}</PixelText>
        <PixelText x={w / 2 - 15} y={-3} z={1.2} size={16} color={p.accent} anchorX="right">{score + '/' + g.total}</PixelText>
        {g.answers.slice(0,10).map((a, j) => <Bitmap key={j} rows={a.correct ? CHECK : CROSS} x={-w / 2 + 20 + j * 13} y={-4} z={1.2} color={a.correct ? p.good : p.bad} />)}
        {!complete && !g.legacy && <PixelText x={-w / 2 + 16} y={-rowH / 2 + 13} z={1.2} size={16} font={FONTS.vt} color={p.muted} anchorX="left">{g.answers.length + ' of ' + g.total + ' answered'}</PixelText>}
      </>}</Control>
    })}
    {games.length > perPage && <>
      <Action x={-w / 2 + 27} y={bottom} w={46} h={24} label="<" disabled={start === 0} onClick={() => choose(Math.max(0, start - perPage))} />
      <PixelText x={0} y={bottom} size={8} color={p.muted}>{(Math.floor(start / perPage) + 1) + ' / ' + Math.ceil(games.length / perPage)}</PixelText>
      <Action x={w / 2 - 27} y={bottom} w={46} h={24} label=">" disabled={start + perPage >= games.length} onClick={() => choose(Math.min(games.length - 1, start + perPage))} />
    </>}
  </group>
}
