import { forwardRef, useLayoutEffect, useRef } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

export const FONTS = {
  // 8px grid arcade font: headings, options, stamps.
  press: '/fonts/PressStart2P-Regular.ttf',
  // 16px grid terminal font: long quotes (narrow, so more characters per line).
  vt: '/fonts/VT323-Regular.ttf',
  // 5px grid: tiny labels.
  micro: '/fonts/Micro5-Regular.ttf',
  // 10px grid display font.
  jersey: '/fonts/Jersey10-Regular.ttf',
  // 8px grid, rounded.
  silk: '/fonts/Silkscreen-Regular.ttf',
  silkBold: '/fonts/Silkscreen-Bold.ttf',
} as const

export interface PixelTextProps {
  children: string
  x?: number
  y?: number
  z?: number
  font?: string
  size?: number
  color?: string
  maxWidth?: number
  align?: 'left' | 'center' | 'right'
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom' | 'top-baseline' | 'bottom-baseline'
  lineHeight?: number
  letterSpacing?: number
  opacity?: number
  outline?: string
  outlineWidth?: number
  crisp?: boolean
  onSync?: (troikaText: any) => void
  visible?: boolean
  colorRanges?: Record<number, string>
}

/**
 * Text rendered by troika's GPU signed-distance-field renderer, with the SDF edge
 * thresholded instead of antialiased so every glyph pixel is either on or off.
 */
export const PixelText = forwardRef<any, PixelTextProps>(function PixelText(
  {
    children, x = 0, y = 0, z = 0.1, font = FONTS.press, size = 8, color = '#fff1e8',
    maxWidth, align = 'center', anchorX = 'center', anchorY = 'middle',
    lineHeight = 1.5, letterSpacing = 0, opacity = 1, outline, outlineWidth = 0,
    crisp = true, onSync, visible = true, colorRanges,
  },
  ref,
) {
  const inner = useRef<any>(null)

  useLayoutEffect(() => {
    const t = inner.current
    if (!t || !crisp) return
    const mat = t.material as THREE.Material & { onBeforeCompile: (s: any) => void }
    mat.onBeforeCompile = (shader: { fragmentShader: string }) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        /float alpha = smoothstep\([^;]*\);/,
        'float alpha = step(distance, distanceOffset);',
      )
    }
    mat.needsUpdate = true
  }, [crisp])

  return (
    <Text
      ref={(t: any) => {
        inner.current = t
        if (typeof ref === 'function') ref(t)
        else if (ref) (ref as any).current = t
      }}
      visible={visible}
      position={[Math.round(x), Math.round(y), z]}
      font={font}
      fontSize={size}
      color={color}
      {...({ colorRanges } as any)}
      maxWidth={maxWidth}
      textAlign={align}
      anchorX={anchorX}
      anchorY={anchorY}
      lineHeight={lineHeight}
      letterSpacing={letterSpacing}
      fillOpacity={opacity}
      outlineColor={outline}
      outlineWidth={outline ? outlineWidth : 0}
      outlineOpacity={opacity}
      renderOrder={z}
      onSync={onSync}
      sdfGlyphSize={32}
    >
      {children}
    </Text>
  )
})
