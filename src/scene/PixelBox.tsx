import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'

export interface PixelBoxProps {
  x: number
  y: number
  w: number
  h: number
  z?: number
  fill?: string
  stroke?: string
  border?: number
  radius?: number
  opacity?: number
  fillAlpha?: number
  shadow?: string
  shadowOffset?: [number, number]
  /** Horizontal pinstripes inside the fill (mugshot height chart). */
  stripe?: string
  stripeStep?: number
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uSize;
  uniform float uRadius;
  uniform float uBorder;
  uniform vec3 uFill;
  uniform vec3 uStroke;
  uniform float uOpacity;
  uniform float uFillAlpha;
  uniform vec3 uStripe;
  uniform float uStripeStep;
  varying vec2 vUv;

  float sdBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    // Pixel-centre coordinates relative to the box centre: every fragment is one virtual pixel.
    vec2 p = floor(vUv * uSize) + 0.5 - uSize * 0.5;
    float d = sdBox(p, uSize * 0.5, uRadius);
    if (d > 0.0) discard;
    float isBorder = step(-uBorder, d);
    vec3 fillCol = uFill;
    if (uStripeStep > 0.0 && mod(floor(vUv.y * uSize.y) + 1.0, uStripeStep) == 0.0) fillCol = uStripe;
    vec3 col = mix(fillCol, uStroke, isBorder);
    float a = mix(uFillAlpha, 1.0, isBorder) * uOpacity;
    if (a <= 0.001) discard;
    gl_FragColor = vec4(col, a);
  }
`

/**
 * A rectangle with pixel-stepped rounded corners and a crisp 1px (or N px) border,
 * drawn entirely in a fragment shader. Positioned by its centre in virtual pixels.
 */
export function PixelBox({
  x, y, w, h, z = 0,
  fill = '#1d2b53', stroke = '#fff1e8', border = 1, radius = 3,
  opacity = 1, fillAlpha = 1, shadow, shadowOffset = [2, -2], stripe, stripeStep = 0,
  onPointerOver, onPointerOut, onClick, onPointerDown,
}: PixelBoxProps) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(w, h) },
      uRadius: { value: radius },
      uBorder: { value: border },
      uFill: { value: new THREE.Color(fill) },
      uStroke: { value: new THREE.Color(stroke) },
      uOpacity: { value: opacity },
      uFillAlpha: { value: fillAlpha },
      uStripe: { value: new THREE.Color(stripe ?? fill) },
      uStripeStep: { value: stripe ? stripeStep : 0 },
    },
  }), [])
  mat.uniforms.uStripe.value.set(stripe ?? fill)
  mat.uniforms.uStripeStep.value = stripe ? stripeStep : 0
  mat.uniforms.uSize.value.set(w, h)
  mat.uniforms.uRadius.value = radius
  mat.uniforms.uBorder.value = border
  mat.uniforms.uFill.value.set(fill)
  mat.uniforms.uStroke.value.set(stroke)
  mat.uniforms.uOpacity.value = opacity
  mat.uniforms.uFillAlpha.value = fillAlpha

  const shadowMat = useMemo(() => shadow ? new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(w, h) },
      uRadius: { value: radius },
      uBorder: { value: 0 },
      uFill: { value: new THREE.Color(shadow) },
      uStroke: { value: new THREE.Color(shadow) },
      uOpacity: { value: opacity },
      uFillAlpha: { value: 1 },
      uStripe: { value: new THREE.Color(shadow) },
      uStripeStep: { value: 0 },
    },
  }) : null, [!!shadow])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => shadowMat?.dispose(), [shadowMat])
  if (shadowMat) {
    shadowMat.uniforms.uSize.value.set(w, h)
    shadowMat.uniforms.uRadius.value = radius
    shadowMat.uniforms.uFill.value.set(shadow!)
    shadowMat.uniforms.uStroke.value.set(shadow!)
    shadowMat.uniforms.uOpacity.value = opacity
  }

  const pw = Math.max(1, Math.round(w))
  const ph = Math.max(1, Math.round(h))
  // Odd sizes get a half-pixel offset so their edges land on pixel boundaries.
  const px = Math.round(x) + (pw % 2 ? 0.5 : 0)
  const py = Math.round(y) + (ph % 2 ? 0.5 : 0)

  return (
    <group>
      {shadowMat && (
        <mesh position={[px + shadowOffset[0], py + shadowOffset[1], z - 0.01]} material={shadowMat} renderOrder={z - 0.01}>
          <planeGeometry args={[pw, ph]} />
        </mesh>
      )}
      <mesh
        position={[px, py, z]}
        material={mat}
        renderOrder={z}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <planeGeometry args={[pw, ph]} />
      </mesh>
    </group>
  )
}

/**
 * Speech-bubble tail: a stepped pixel triangle hanging off the bottom edge of a bubble,
 * with a border on its two slanted sides and an open top so it merges with the bubble.
 */
export function BubbleTail({ x, y, w = 14, h = 10, z = 0.02, fill = '#fff1e8', stroke = '#1d2b53', flip = false, left = false }: {
  x: number; y: number; w?: number; h?: number; z?: number; fill?: string; stroke?: string; flip?: boolean
  /** Point left (off the bubble's left edge) instead of down. */
  left?: boolean
}) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(w, h) },
      uFill: { value: new THREE.Color(fill) },
      uStroke: { value: new THREE.Color(stroke) },
      uFlip: { value: flip ? 1 : 0 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec2 uSize; uniform vec3 uFill; uniform vec3 uStroke; uniform float uFlip;
      varying vec2 vUv;
      // Inside test for a right-leaning tail: wide at the top, pointing to the bottom-left.
      bool inside(vec2 p) {
        if (p.x < 0.0 || p.y < 0.0 || p.x >= uSize.x || p.y >= uSize.y) return false;
        float t = p.y / uSize.y;              // 0 at tip (bottom), 1 at the bubble
        float x = uFlip > 0.5 ? uSize.x - 1.0 - p.x : p.x;
        float left = (1.0 - t) * 1.0;         // tip sits near the left edge
        float right = t * (uSize.x - 1.0) + 1.0;
        return x >= left && x < right;
      }
      void main() {
        vec2 p = floor(vUv * uSize);
        if (!inside(p)) discard;
        bool edge = !inside(p + vec2(1.0, 0.0)) || !inside(p - vec2(1.0, 0.0)) || !inside(p - vec2(0.0, 1.0));
        gl_FragColor = vec4(edge ? uStroke : uFill, 1.0);
      }
    `,
  }), [])
  useEffect(() => () => mat.dispose(), [mat])
  mat.uniforms.uSize.value.set(w, h)
  mat.uniforms.uFill.value.set(fill)
  mat.uniforms.uStroke.value.set(stroke)
  mat.uniforms.uFlip.value = flip ? 1 : 0
  return (
    <mesh position={[Math.round(x) + (left ? (h % 2) / 2 : (w % 2) / 2), Math.round(y) + (left ? (w % 2) / 2 : (h % 2) / 2), z]} rotation={[0, 0, left ? -Math.PI / 2 : 0]} material={mat} renderOrder={z}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}
