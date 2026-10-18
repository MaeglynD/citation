import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { PixelBox, type PixelBoxProps } from './PixelBox'
import { PixelText } from './PixelText'
import { usePalette } from '../themes'
import { audio } from '../audio/engine'

/** A crisp face, a dark lower edge, and a one-pixel catchlight. */
export function Surface({ kind = 'panel', ...p }: PixelBoxProps & { kind?: 'panel' | 'paper' | 'button' }) {
  const pal = usePalette()
  const { x, y, w, h, z = 0 } = p
  const paper = kind === 'paper', edge = p.stroke ?? pal.boxEdge
  return <group>
    <PixelBox x={x + 2} y={y - 4} w={w + 2} h={h + 2} z={z - .04} fill={pal.shadow} stroke={pal.shadow} radius={4} />
    <PixelBox x={x} y={y - 2} w={w} h={h} z={z - .02} fill={edge} stroke={pal.shadow} radius={3} />
    <PixelBox {...p} fill={p.fill ?? (paper ? pal.paper : pal.box)} stroke={edge} radius={3} border={1} />
    <PixelBox x={x} y={y + h / 2 - 2} w={w - 6} h={1} z={z + .015} fill={paper ? '#ffffff' : pal.paper} opacity={paper ? .7 : .28} border={0} />
    <PixelBox x={x + w / 2 - 2} y={y - 1} w={1} h={h - 6} z={z + .015} fill={pal.shadow} opacity={paper ? .12 : .28} border={0} />
  </group>
}

/** The hit target stays still while the face lifts and depresses. */
export function Control({ x, y, w, h, z = 2, focused = false, disabled = false, onClick, onOver, onOut, sound = true, children }: {
  x: number; y: number; w: number; h: number; z?: number; focused?: boolean; disabled?: boolean
  onClick: () => void; onOver?: () => void; onOut?: () => void; sound?: boolean
  children: (hot: boolean, down: boolean) => ReactNode
}) {
  const [over, setOver] = useState(false), [down, setDown] = useState(false)
  const face = useRef<Group>(null), lift = useRef(0), velocity = useRef(0)
  const hot = !disabled && (focused || over)
  useFrame((_, delta) => {
    const target = disabled ? 0 : down ? -2 : hot ? 3 : 0
    const dt = Math.min(delta, .03)
    velocity.current += ((target - lift.current) * 420 - velocity.current * 27) * dt
    lift.current += velocity.current * dt
    if (face.current) face.current.position.y = Math.round(lift.current)
  })
  return <group position={[x, y, 0]}>
    <group ref={face}>{children(hot, down && !disabled)}</group>
    <mesh position={[0, 0, z + 2]} renderOrder={z + 2}
      onPointerOver={e => {
        if (disabled) return
        e.stopPropagation()
        if (e.nativeEvent.pointerType === 'touch') return
        setOver(true); onOver?.(); if (sound) audio.hover(); document.body.style.cursor = 'pointer'
      }}
      onPointerOut={e => {
        setOver(false); setDown(false); document.body.style.cursor = 'default'
        if (e.nativeEvent.pointerType !== 'touch') onOut?.()
      }}
      onPointerDown={e => { if (!disabled) { e.stopPropagation(); setDown(true) } }}
      onPointerUp={() => setDown(false)}
      onClick={e => { if (!disabled) { e.stopPropagation(); setDown(false); if (sound) audio.select(); onClick() } }}>
      <planeGeometry args={[w, h]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  </group>
}

export function Action({ x, y, w = 128, h = 28, z = 2, label, onClick, primary = false, disabled = false, focused = false }: {
  x: number; y: number; w?: number; h?: number; z?: number; label: string; onClick: () => void; primary?: boolean; disabled?: boolean; focused?: boolean
}) {
  const p = usePalette()
  return <Control {...{x,y,w,h,z,onClick,disabled,focused}}>{(hot, down) => <>
    <Surface kind="button" x={0} y={0} w={w} h={h} z={z} fill={primary ? (hot ? p.paper : p.accent) : hot ? p.bg2 : p.box} stroke={hot ? p.accent : p.boxEdge} />
    <PixelText x={0} y={down ? -1 : 0} z={z + .1} size={8} color={disabled ? p.dim : primary ? (hot ? p.ink : p.accentInk) : hot ? p.accent : p.boxText}>{label}</PixelText>
  </>}</Control>
}
