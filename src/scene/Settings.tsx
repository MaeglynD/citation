import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { useSettings, SIZE_ORDER, SIZE_LABEL } from '../game/settings'
import { usePalette, THEMES } from '../themes'
import { audio } from '../audio/engine'
import { PixelBox } from './PixelBox'
import { PixelText } from './PixelText'
import { Bitmap, CHECK, SPEAKER_ON, SPEAKER_OFF } from './Sprites'
import { Surface, Action, Control } from './Surface'

export const GEAR = ['...##...', '.#.##.#.', '########', '.##..##.', '##....##', '.##..##.', '########', '.#.##.#.', '...##...']

export function SettingsPanel() {
  const p = usePalette(), v = useGame(s => s.view), st = useSettings()
  const [focus, setFocusState] = useState(0), focusRef = useRef(0)
  const setFocus = (n: number) => { focusRef.current = (n + 4) % 4; setFocusState(focusRef.current) }
  const close = () => useSettings.getState().setOpen(false)
  const volume = (n: number) => { useSettings.getState().update({ volume: Math.max(0, Math.min(5, n)), muted: false }); audio.resume(); audio.select() }
  const step = (row: number, delta: number) => {
    const s = useSettings.getState()
    if (row === 0) s.update({ theme: THEMES[(THEMES.findIndex(t => t.id === s.theme) + delta + THEMES.length) % THEMES.length].id })
    if (row === 1) { volume(s.volume + delta); return }
    if (row === 2) s.update({ size: SIZE_ORDER[(SIZE_ORDER.indexOf(s.size) + delta + 4) % 4] })
    audio.select()
  }
  useEffect(() => useSettings.subscribe((s, prev) => { if (s.open && !prev.open) setFocus(0) }), [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useSettings.getState()
      if (!s.open || e.repeat) return
      e.stopImmediatePropagation()
      if (['Escape', 's', 'S'].includes(e.key)) { e.preventDefault(); close() }
      else if (['Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); setFocus(focusRef.current + (e.key === 'ArrowUp' || e.shiftKey ? -1 : 1)); audio.hover()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault(); step(focusRef.current, e.key === 'ArrowLeft' ? -1 : 1)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (focusRef.current === 3) close()
        else if (focusRef.current === 1) useGame.getState().toggleMute()
        else step(focusRef.current, 1)
      } else if (e.key === '+' || e.key === '=') volume(s.volume + 1)
      else if (e.key === '-') volume(s.volume - 1)
      else if (e.key.toLowerCase() === 'm') useGame.getState().toggleMute()
      else if (e.key.toLowerCase() === 'd') step(2, 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  if (!st.open) return null
  const phone = v.portrait, w = Math.min(v.fw - 28, 360), h = phone ? 444 : 326, z = 40
  const cardW = (w - 48) / 2, cardH = phone ? 56 : 44
  const volumeY = phone ? -47 : -58, sizeY = phone ? -123 : -99
  const buttonW = phone ? 40 : 24, stride = phone ? 43 : 28
  const controlsX = phone ? 0 : 43
  return <group>
    <mesh position={[0, 0, 38]} renderOrder={38} onClick={e => { e.stopPropagation(); close() }}><planeGeometry args={[v.w,v.h]} /><meshBasicMaterial color={p.shadow} transparent opacity={.85} depthWrite={false} /></mesh>
    <Surface x={0} y={0} w={w} h={h} z={z} fill={p.box} stroke={p.cardEdge} onClick={e => e.stopPropagation()} />
    <PixelText x={0} y={h / 2 - 29} z={z + .3} size={16} color={p.paper}>SETTINGS</PixelText>
    <PixelText x={0} y={phone ? 152 : 99} z={z + .3} size={8} color={focus === 0 ? p.accent : p.muted}>PALETTE</PixelText>
    {THEMES.map((theme, i) => {
      const selected = st.theme === theme.id, colors = theme.palette
      return <Control key={theme.id} x={(i % 2 ? 1 : -1) * (cardW + 12) / 2} y={(phone ? 106 : 61) - Math.floor(i / 2) * (cardH + 12)} w={cardW} h={cardH} z={z + 1}
        focused={focus === 0 && selected} onClick={() => { setFocus(0); st.update({ theme: theme.id }) }}>{hot => <>
        <Surface x={0} y={0} w={cardW} h={cardH} z={z + 1} fill={colors.bg} stroke={selected ? p.accent : hot ? p.paper : colors.boxEdge} />
        <PixelText x={selected ? -5 : 0} y={phone ? 10 : 7} z={z + 1.2} size={8} color={colors.text}>{theme.name.toUpperCase()}</PixelText>
        {selected && <Bitmap rows={CHECK} x={cardW / 2 - 12} y={phone ? 10 : 7} z={z + 1.2} color={p.accent} />}
        {[colors.paper, colors.accent, colors.mark, colors.good].map((color, j) => <PixelBox key={j} x={(j - 1.5) * 19} y={phone ? -12 : -10} w={16} h={phone ? 9 : 6} z={z + 1.2} fill={color} border={0} />)}
      </>}</Control>
    })}
    <PixelText x={phone ? 0 : -w / 2 + 20} y={phone ? volumeY + 34 : volumeY} z={z + 1} anchorX={phone ? 'center' : 'left'} color={focus === 1 ? p.accent : p.text}>VOLUME</PixelText>
    <Control x={controlsX - 2.5 * stride} y={volumeY} w={buttonW} h={phone ? 40 : 28} z={z + 1} onClick={() => { setFocus(1); useGame.getState().toggleMute() }}>{hot => <>
      <Surface x={0} y={0} w={buttonW} h={phone ? 38 : 26} z={z + 1} stroke={hot ? p.accent : p.dim} />
      <Bitmap rows={st.muted || st.volume === 0 ? SPEAKER_OFF : SPEAKER_ON} x={0} y={0} z={z + 1.2} color={hot ? p.accent : p.text} />
    </>}</Control>
    {[1,2,3,4,5].map((n, i) => <Control key={n} x={controlsX + (i - 1.5) * stride} y={volumeY} w={buttonW} h={phone ? 40 : 30} z={z + 1} onClick={() => { setFocus(1); volume(n === st.volume && !st.muted ? n - 1 : n) }} sound={false}>{hot => <PixelBox x={0} y={-7 + i * 2} w={phone ? 24 : 16} h={10 + i * 4} z={z + 1} fill={!st.muted && n <= st.volume ? p.accent : p.bg} stroke={hot ? p.paper : p.dim} border={1} shadow={p.shadow} />}</Control>)}
    <PixelText x={phone ? 0 : -w / 2 + 20} y={phone ? sizeY + 34 : sizeY} z={z + 1} anchorX={phone ? 'center' : 'left'} color={focus === 2 ? p.accent : p.text}>SIZE</PixelText>
    {SIZE_ORDER.map((size, i) => <Action key={size} x={controlsX + (i - 1.5) * (phone ? 64 : 42)} y={sizeY} w={phone ? 52 : 34} h={phone ? 40 : 26} z={z + 1} label={SIZE_LABEL[size]} primary={st.size === size} focused={focus === 2 && st.size === size} onClick={() => { setFocus(2); st.update({ size }) }} />)}
    <Action x={0} y={phone ? -185 : -139} w={124} h={phone ? 38 : 27} z={z + 1} label="DONE" focused={focus === 3} primary onClick={close} />
  </group>
}

export function GearButton({ x, y, hitSize = 22 }: { x: number; y: number; hitSize?: number }) {
  const p = usePalette()
  return <Control x={x} y={y} w={hitSize} h={hitSize} z={5} onClick={() => { audio.resume(); useSettings.getState().setOpen(!useSettings.getState().open) }}>{hot => <>
    <Surface x={0} y={0} w={22} h={20} z={5} fill={p.bg} stroke={hot ? p.accent : p.dim} />
    <Bitmap rows={GEAR} x={0} y={0} z={5.1} color={hot ? p.accent : p.muted} />
  </>}</Control>
}
