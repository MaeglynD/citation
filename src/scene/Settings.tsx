import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { useSettings, SIZE_ORDER, SIZE_LABEL } from '../game/settings'
import { usePalette } from '../themes'
import { audio } from '../audio/engine'
import { PixelBox } from './PixelBox'
import { PixelText } from './PixelText'
import { Bitmap, SPEAKER_ON, SPEAKER_OFF } from './Sprites'
import { Surface, Action, Control } from './Surface'

export const GEAR = ['...##...', '.#.##.#.', '########', '.##..##.', '##....##', '.##..##.', '########', '.#.##.#.', '...##...']
export function HitArea({ x, y, w, h, z, onClick, onOver, onOut }: { x: number; y: number; w: number; h: number; z: number; onClick: () => void; onOver?: () => void; onOut?: () => void }) {
  return <mesh position={[x, y, z]} renderOrder={z} onClick={e => { e.stopPropagation(); onClick() }}
    onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onOver?.() }}
    onPointerOut={() => { document.body.style.cursor = 'default'; onOut?.() }}>
    <planeGeometry args={[w, h]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
  </mesh>
}

export function SettingsPanel() {
  const p = usePalette(), v = useGame(s => s.view), st = useSettings()
  const [focus, setFocusState] = useState(0), focusRef = useRef(0)
  const setFocus = (n: number) => { focusRef.current = (n + 3) % 3; setFocusState(focusRef.current) }
  const close = () => useSettings.getState().setOpen(false)
  const volume = (n: number) => { useSettings.getState().update({ volume: Math.max(0, Math.min(5, n)), muted: false }); audio.resume(); audio.select() }
  useEffect(() => useSettings.subscribe((s, prev) => { if (s.open && !prev.open) setFocus(0) }), [])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useSettings.getState()
      if (!s.open || e.repeat) return
      if (['Escape', 's', 'S'].includes(e.key)) { e.preventDefault(); close() }
      else if (['Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); setFocus(focusRef.current + (e.key === 'ArrowUp' || e.shiftKey ? -1 : 1)); audio.hover()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        if (focusRef.current === 0) volume(s.volume + delta)
        if (focusRef.current === 1) { s.update({ size: SIZE_ORDER[(SIZE_ORDER.indexOf(s.size) + delta + 4) % 4] }); audio.select() }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (focusRef.current === 2) close()
        else if (focusRef.current === 0) useGame.getState().toggleMute()
        else s.update({ size: SIZE_ORDER[(SIZE_ORDER.indexOf(s.size) + 1) % 4] })
      } else if (e.key === '+' || e.key === '=') volume(s.volume + 1)
      else if (e.key === '-') volume(s.volume - 1)
      else if (e.key.toLowerCase() === 'm') useGame.getState().toggleMute()
      else if (e.key.toLowerCase() === 'd') s.update({ size: SIZE_ORDER[(SIZE_ORDER.indexOf(s.size) + 1) % 4] })
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  if (!st.open) return null
  const w = Math.min(v.fw - 32, 336), h = 252, z = 40, left = -w / 2 + 22
  return <group>
    <mesh position={[0, 0, 38]} renderOrder={38} onClick={e => { e.stopPropagation(); close() }}><planeGeometry args={[v.w,v.h]} /><meshBasicMaterial color={p.shadow} transparent opacity={.85} depthWrite={false} /></mesh>
    <Surface x={0} y={0} w={w} h={h} z={z} fill={p.box} stroke={p.cardEdge} onClick={e => e.stopPropagation()} />
    <PixelText x={0} y={87} z={z + .3} size={16} color={p.paper}>SETTINGS</PixelText>
    <PixelBox x={0} y={61} w={w - 40} h={1} z={z + .3} fill={p.dim} border={0} />
    <PixelText x={left} y={21} z={z + 1} anchorX="left" color={focus === 0 ? p.accent : p.text}>VOLUME</PixelText>
    <Control x={-11} y={21} w={24} h={28} z={z + 1} onClick={() => { setFocus(0); useGame.getState().toggleMute() }}>{hot => <>
      <Surface x={0} y={0} w={24} h={26} z={z + 1} stroke={hot ? p.accent : p.dim} />
      <Bitmap rows={st.muted || st.volume === 0 ? SPEAKER_OFF : SPEAKER_ON} x={0} y={0} z={z + 1.2} color={hot ? p.accent : p.text} />
    </>}</Control>
    {[1,2,3,4,5].map((n, i) => <Control key={n} x={20 + i * 19} y={21} w={17} h={30} z={z + 1} onClick={() => { setFocus(0); volume(n === st.volume && !st.muted ? n - 1 : n) }} sound={false}>{hot => <PixelBox x={0} y={-7 + i * 2} w={12} h={10 + i * 4} z={z + 1} fill={!st.muted && n <= st.volume ? p.accent : p.bg} stroke={hot ? p.paper : p.dim} border={1} shadow={p.shadow} />}</Control>)}
    <PixelText x={left} y={-31} z={z + 1} anchorX="left" color={focus === 1 ? p.accent : p.text}>SIZE</PixelText>
    {SIZE_ORDER.map((size, i) => <Action key={size} x={-8 + i * 34} y={-31} w={27} h={23} z={z + 1} label={SIZE_LABEL[size]} primary={st.size === size} focused={focus === 1 && st.size === size} onClick={() => { setFocus(1); st.update({ size }) }} />)}
    <Action x={0} y={-89} w={124} h={27} z={z + 1} label="DONE" focused={focus === 2} primary onClick={close} />
  </group>
}

export function GearButton({ x, y }: { x: number; y: number }) {
  const p = usePalette()
  return <Control x={x} y={y} w={22} h={20} z={5} onClick={() => { audio.resume(); useSettings.getState().setOpen(!useSettings.getState().open) }}>{hot => <>
    <Surface x={0} y={0} w={22} h={20} z={5} fill={p.bg} stroke={hot ? p.accent : p.dim} />
    <Bitmap rows={GEAR} x={0} y={0} z={5.1} color={hot ? p.accent : p.muted} />
  </>}</Control>
}
