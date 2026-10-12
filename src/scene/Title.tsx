import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { usePalette } from '../themes'
import { PixelText, FONTS } from './PixelText'
import { BubbleTail } from './PixelBox'
import { Surface, Action, Control } from './Surface'
import { Bitmap, QMARK } from './Sprites'
import { Mugshot } from './Mugshot'
import { audio } from '../audio/engine'

const CAST = [null, 'Dolly Parton', 'Albert Einstein', 'SpongeBob SquarePants', 'Bob Ross', 'Darth Vader', 'Mahatma Gandhi', 'Kermit the Frog', 'Mother Teresa', 'Napoleon Bonaparte']

export function Title() {
  const p = usePalette(), v = useGame(s => s.view), best = useGame(s => s.bestScore)
  const paused = useGame(s => s.resumePhase)
  const [reel, setReel] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setReel(r => r + 1), 2400)
    return () => clearInterval(t)
  }, [])
  const phone = v.portrait, big = 24
  const titleX = phone ? -96 : -57, titleY = phone ? 60 : 77
  const playY = phone ? -100 : -82
  return <group>
    <Control x={phone ? 0 : -131} y={phone ? 152 : 49} w={88} h={100} z={1} sound={false} onClick={() => { setReel(r => r + 1); audio.hover() }}>{hot => <>
      <Mugshot x={0} y={-9} name={CAST[reel % CAST.length]} scale={phone ? 1.25 : 1.5} border={hot ? p.accent : p.cardEdge} talkUntil={hot ? performance.now() + 180 : 0} />
      <Surface kind="paper" x={30} y={40} w={28} h={23} z={1} />
      <BubbleTail x={23} y={26} w={9} h={9} z={1.05} fill={p.paper} stroke={p.paperEdge} />
      <Bitmap rows={QMARK} x={30} y={40} z={1.3} color={p.mark} />
    </>}</Control>
    {[0, 1].map(i => <group key={i}>
      <PixelText x={titleX + 2} y={titleY - i * (big + 11) - 4} size={big} color={p.shadow} font={FONTS.press} anchorX="left">{i ? 'NEEDED' : 'CITATION'}</PixelText>
      <PixelText x={titleX} y={titleY - i * (big + 11)} z={.3} size={big} color={i ? p.accent : p.paper} font={FONTS.press} anchorX="left">{i ? 'NEEDED' : 'CITATION'}</PixelText>
    </group>)}
    <PixelText x={0} y={phone ? -32 : -25} size={phone ? 20 : 8} font={phone ? FONTS.vt : FONTS.press} color={p.text} maxWidth={v.fw - 36} lineHeight={1.75}>Who said that, then?</PixelText>
    <Action x={0} y={playY} w={158} h={phone ? 42 : 30} label={paused ? 'CONTINUE' : 'PRESS START'} primary onClick={() => useGame.getState().resume()} />
    <Action x={0} y={playY - (phone ? 58 : 44)} w={122} h={phone ? 38 : 24} label="HISTORY" onClick={() => useGame.getState().showHistory()} />
    {best > 0 && <PixelText x={0} y={playY - (phone ? 100 : 80)} size={8} color={p.muted}>{'BEST ' + best + '/10'}</PixelText>}
  </group>
}
