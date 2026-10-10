import { useGame } from '../game/store'
import { PixelText, FONTS } from './PixelText'
import { P } from './palette'

/** Dev-only: ?fonttest renders sample lines so font sizes can be judged in screenshots. */
export function FontTest() {
  const view = useGame((s) => s.view)
  const sample = '— Speech to a Communist Youth League conference, July 1962. Quick fox 0123'
  const rows: { font: string; size: number; crisp: boolean; label: string }[] = [
    { font: FONTS.vt, size: 16, crisp: true, label: 'vt16c' },
    { font: FONTS.vt, size: 16, crisp: false, label: 'vt16' },
    { font: FONTS.vt, size: 20, crisp: true, label: 'vt20c' },
    { font: FONTS.vt, size: 24, crisp: true, label: 'vt24c' },
    { font: FONTS.micro, size: 10, crisp: true, label: 'mic10' },
    { font: FONTS.micro, size: 15, crisp: true, label: 'mic15' },
    { font: FONTS.jersey, size: 10, crisp: true, label: 'jer10' },
    { font: FONTS.jersey, size: 20, crisp: true, label: 'jer20' },
    { font: FONTS.silk, size: 8, crisp: true, label: 'silk8' },
    { font: FONTS.silkBold, size: 8, crisp: true, label: 'silkb8' },
    { font: FONTS.press, size: 8, crisp: true, label: 'press8' },
    { font: FONTS.press, size: 8, crisp: false, label: 'press8aa' },
  ]
  const top = view.h / 2 - 16
  return (
    <group>
      {rows.map((r, i) => (
        <group key={r.label}>
          <PixelText x={-view.w / 2 + 8} y={top - i * 28} size={8} color={P.indigo} font={FONTS.press} anchorX="left">
            {r.label}
          </PixelText>
          <PixelText x={-view.w / 2 + 80} y={top - i * 28} size={r.size} color={P.white} font={r.font} anchorX="left" crisp={r.crisp} maxWidth={view.w - 100} align="left" lineHeight={1}>
            {sample}
          </PixelText>
        </group>
      ))}
    </group>
  )
}
