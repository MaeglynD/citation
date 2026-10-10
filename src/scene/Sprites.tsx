import { useMemo } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'

/** Build a nearest-filtered RGBA texture from rows of '#' / '.' characters. */
function bitmapTexture(rows: string[], color: string): THREE.DataTexture {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const c = new THREE.Color(color)
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const row = rows[h - 1 - y] // flip so row 0 is the top
    for (let x = 0; x < w; x++) {
      const on = row[x] === '#'
      const i = (y * w + x) * 4
      data[i] = Math.round(c.r * 255)
      data[i + 1] = Math.round(c.g * 255)
      data[i + 2] = Math.round(c.b * 255)
      data[i + 3] = on ? 255 : 0
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

export interface BitmapProps {
  rows: string[]
  x: number
  y: number
  z?: number
  color?: string
  visible?: boolean
  opacity?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

/** A pixel sprite, one texel per virtual pixel, positioned by its centre. */
export function Bitmap({ rows, x, y, z = 0.2, color = '#fff1e8', visible = true, opacity = 1, onClick, onPointerOver, onPointerOut }: BitmapProps) {
  const tex = useMemo(() => bitmapTexture(rows, color), [rows, color])
  const w = tex.image.width
  const h = tex.image.height
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: false }), [tex])
  mat.opacity = opacity
  const ox = w % 2 ? 0.5 : 0
  const oy = h % 2 ? 0.5 : 0
  return (
    <mesh
      visible={visible}
      position={[Math.round(x) + ox, Math.round(y) + oy, z]}
      material={mat}
      renderOrder={z}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

// ---- sprite sheets ----------------------------------------------------------

/** The mystery speaker: a 24x28 bust silhouette. */
export const BUST = [
  '........########........',
  '......############......',
  '.....##############.....',
  '....################....',
  '....################....',
  '...##################...',
  '...##################...',
  '...##################...',
  '...##################...',
  '...##################...',
  '....################....',
  '....################....',
  '.....##############.....',
  '......############......',
  '........########........',
  '..........####..........',
  '..........####..........',
  '.......##########.......',
  '.....##############.....',
  '...##################...',
  '..####################..',
  '.######################.',
  '.######################.',
  '########################',
  '########################',
  '########################',
  '########################',
  '########################',
]

/** A 7x10 question mark. */
export const QMARK = [
  '.#####.',
  '##...##',
  '##...##',
  '....##.',
  '...##..',
  '..##...',
  '..##...',
  '.......',
  '..##...',
  '..##...',
]

/** Menu cursor. */
export const CURSOR = [
  '#.....',
  '##....',
  '###...',
  '####..',
  '#####.',
  '######',
  '#####.',
  '####..',
  '###...',
  '##....',
  '#.....',
]

export const CHECK = [
  '........##',
  '.......##.',
  '......##..',
  '.....##...',
  '##..##....',
  '.####.....',
  '..##......',
]

export const CROSS = [
  '##....##',
  '.##..##.',
  '..####..',
  '...##...',
  '..####..',
  '.##..##.',
  '##....##',
]

export const SPEAKER_ON = [
  '....#.......',
  '...##...#...',
  '..###....#..',
  '#####.#..#..',
  '#####..#.#..',
  '#####..#.#..',
  '#####.#..#..',
  '..###....#..',
  '...##...#...',
  '....#.......',
]

export const SPEAKER_OFF = [
  '....#.......',
  '...##.......',
  '..###..#..#.',
  '#####...##..',
  '#####...##..',
  '#####...##..',
  '#####..#..#.',
  '..###.......',
  '...##.......',
  '....#.......',
]

/** Big pixel quotation marks (open looks like 66, close like 99). 16x9. */
export const QUOTE_OPEN = [
  '....###......###',
  '...###.....###..',
  '..###.....###...',
  '.###.....###....',
  '#######..#######',
  '#######..#######',
  '#######..#######',
  '.#####....#####.',
  '..###......###..',
]
export const QUOTE_CLOSE = [
  '..###......###..',
  '.#####....#####.',
  '#######..#######',
  '#######..#######',
  '#######..#######',
  '...###.....###..',
  '..###.....###...',
  '.###.....###....',
  '###.....###.....',
]

/** Little heart for the end screen. */
export const HEART = [
  '.##..##.',
  '########',
  '########',
  '########',
  '.######.',
  '..####..',
  '...##...',
]

/** A tiny audience head (seen from behind). */
export const HEAD = [
  '..####..',
  '.######.',
  '########',
  '########',
  '.######.',
  '..####..',
  '...##...',
  '.######.',
]
