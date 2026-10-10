import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { usePalette } from '../themes'
import { Surface } from './Surface'
import { PixelText } from './PixelText'
import { PixelBox } from './PixelBox'

/** A short comic reaction over the portrait, leaving the revealed name readable. */
export function VerdictReaction({ right, since, x, y }: { right: boolean; since: number; x: number; y: number }) {
  const p = usePalette(), ref = useRef<Group>(null), rays = useRef<Group>(null)
  useFrame(() => {
    const t = (performance.now() - since) / 1000
    if (!ref.current) return
    ref.current.visible = t > .05 && t < 1.05
    const k = Math.min(1, t / .25)
    const scale = 1 + Math.sin(k * Math.PI) * .25
    ref.current.scale.setScalar(scale)
    ref.current.rotation.z = (right ? -.06 : Math.sin(t * 25) * .08 * Math.max(0, 1 - t))
    ref.current.position.y = y + (Math.round(Math.sin(Math.min(1, t / 1.05) * Math.PI) * 10))
    if (rays.current) { rays.current.scale.setScalar(1 + Math.min(t, .5) * 1.1) }
  })
  return <group name="verdict-reaction" ref={ref} position={[x, y, 0]}>
    <group ref={rays}>{Array.from({length:8},(_,i) => {
      const a = i * Math.PI / 4
      return <PixelBox key={i} x={Math.cos(a) * 52} y={Math.sin(a) * 28} w={i % 2 ? 3 : 5} h={i % 2 ? 5 : 3} z={9} fill={right ? p.accent : p.mark} border={0} />
    })}</group>
    <Surface x={0} y={0} w={82} h={27} z={10} fill={right ? p.good : p.bad} stroke={p.paperEdge} />
    <PixelText x={0} y={0} z={10.2} size={8} color={right ? p.goodInk : p.badInk}>{right ? 'YES!' : 'NOPE!'}</PixelText>
  </group>
}
