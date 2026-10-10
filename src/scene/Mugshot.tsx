import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CARD_W, CARD_H, portraitTexture, silhouetteTexture } from '../portraits/textures'
import type { Frame } from '../portraits/render'
import { PixelBox } from './PixelBox'
import { Bitmap, QMARK } from './Sprites'
import { usePalette } from '../themes'
import { useSettings } from '../game/settings'
import { Surface } from './Surface'

export interface MugshotProps {
  x: number
  y: number
  z?: number
  /** Person to show; null shows the mystery silhouette. */
  name: string | null
  /** performance.now() until which the portrait "talks" (mouth flaps). */
  talkUntil?: number
  /** Border colour (e.g. good / bad on reveal). Defaults to the theme's card edge. */
  border?: string
  shake?: boolean
  /** Whole-number pixel scale for the card (2 = double size). */
  scale?: number
  /** Skip the pop animation when the name changes. */
  still?: boolean
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

/**
 * The suspect's mugshot card: a striped height-chart background, the portrait, and a "?" for
 * the unknown suspect. Swapping `name` pops the card; portraits blink on their own rhythm and
 * flap their mouths while `talkUntil` is in the future.
 */
export function Mugshot({ x, y, z = 0.5, name, talkUntil = 0, border, shake = false, scale = 1, still = false }: MugshotProps) {
  const pal = usePalette()
  const theme = useSettings(s => s.theme)
  const groupRef = useRef<THREE.Group>(null)
  const qRef = useRef<THREE.Group>(null)
  const popAt = useRef(performance.now())
  const lastFrame = useRef<string>('')
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), [])
  const shade = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: '#10121b', opacity: .45 }), [])
  useEffect(() => () => { mat.dispose(); shade.dispose() }, [mat, shade])
  const blinkPhase = useMemo(() => (name ? (hash(name) % 1000) / 1000 : 0), [name])

  useEffect(() => { if (!still) popAt.current = performance.now() }, [name, still])

  useFrame(({ clock }) => {
    const now = performance.now()
    const e = clock.getElapsedTime()
    let frame: Frame = 'idle'
    if (name) {
      const period = 3.1 + blinkPhase * 1.7
      if (((e + blinkPhase * 5) % period) < 0.13) frame = 'blink'
      if (now < talkUntil && Math.floor(now / 110) % 2 === 0) frame = 'talk'
    }
    const key = (name ?? '?') + frame + pal.silhouette + theme
    if (key !== lastFrame.current) {
      lastFrame.current = key
      mat.map = name ? portraitTexture(name, frame, theme) : silhouetteTexture(pal.silhouette)
      mat.needsUpdate = true
      shade.map = mat.map; shade.needsUpdate = true
    }
    // pop: quick squash and stretch over ~240ms, snapped to whole pixels
    const t = still ? 1 : Math.min(1, (now - popAt.current) / 240)
    const sy = t < 1 ? 1 + Math.sin(t * Math.PI * 2) * 0.12 * (1 - t) : 1
    const sx = t < 1 ? 1 - Math.sin(t * Math.PI * 2) * 0.08 * (1 - t) : 1
    if (groupRef.current) {
      groupRef.current.scale.set(sx, sy, 1)
      const dx = shake ? Math.round(Math.sin(e * 60) * 1.5) : 0
      groupRef.current.position.set(Math.round(x) + dx, Math.round(y), z)
    }
    if (qRef.current) qRef.current.visible = !name && Math.floor(e * 1.5 + 0.5) % 4 !== 3
  })

  const w = CARD_W * scale
  const h = CARD_H * scale
  return (
    <group ref={groupRef} position={[x, y, z]}>
      <Surface x={0} y={0} w={w + 6} h={h + 6} fill={pal.card} stroke={border ?? pal.cardEdge} />
      <PixelBox x={0} y={0} w={w - 2} h={h - 2} fill={pal.card} stroke={pal.shadow} radius={1} border={1}
        stripe={pal.cardLine} stripeStep={8 * scale} />
      <PixelBox x={-w / 2 + 4} y={h / 2 - 4} w={3} h={3} fill={pal.accent} opacity={.55} border={0} z={.03} />
      <mesh position={[2 * scale, -2 * scale, .04]} material={shade} renderOrder={z + .04}><planeGeometry args={[w, h]} /></mesh>
      <mesh position={[0, 0, 0.05]} material={mat} renderOrder={z + 0.05}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <group ref={qRef} scale={[scale, scale, 1]}>
        <Bitmap rows={QMARK} x={0} y={4} z={z + 0.2} color={pal.accent} />
      </group>

    </group>
  )
}
