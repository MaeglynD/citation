import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { currentTheme } from '../themes'

const N = 144
interface Particle { x: number; y: number; vx: number; vy: number; life: number; size: number; spin: number; delay: number }

/** Wall-clock particle paths keep celebration timing consistent on slow devices. */
export function Confetti({ burstKey, since, delay = 0, x, y, spread = 60, z = 8 }: {
  burstKey: string | null; since: number; delay?: number; x: number; y: number; spread?: number; z?: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null), parts = useRef<Particle[]>([]), fired = useRef<string | null>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), [])
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    const elapsed = (performance.now() - since) / 1000 - delay
    if (!burstKey || elapsed < 0 || elapsed > 2.7) { m.count = 0; return }
    if (fired.current !== burstKey) {
      fired.current = burstKey
      parts.current = Array.from({ length: N }, () => ({
        x: x + (Math.random() - .5) * spread, y,
        vx: (Math.random() - .5) * 230, vy: 70 + Math.random() * 150,
        life: 1.3 + Math.random() * 1.3, size: 2 + Math.floor(Math.random() * 3),
        spin: (Math.random() - .5) * 12, delay: Math.random() * .16,
      }))
      const colors = currentTheme().palette.confetti.map(c => new THREE.Color(c))
      for (let i = 0; i < N; i++) m.setColorAt(i, colors[i % colors.length])
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    let count = 0
    for (const p of parts.current) {
      const t = elapsed - p.delay
      if (t < 0 || t > p.life) continue
      const fade = Math.min(1, (p.life - t) * 5)
      dummy.position.set(Math.round(p.x + p.vx * t * Math.exp(-t * .3)), Math.round(p.y + p.vy * t - 95 * t * t), z)
      dummy.rotation.z = p.spin * t
      dummy.scale.set(p.size * fade, Math.max(1, p.size * .65 * Math.abs(Math.cos(p.spin * t))) * fade, 1)
      dummy.updateMatrix()
      m.setMatrixAt(count++, dummy.matrix)
    }
    m.count = count; m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh name="verdict-confetti" ref={mesh} args={[geo, mat, N]} frustumCulled={false} renderOrder={z} />
}
