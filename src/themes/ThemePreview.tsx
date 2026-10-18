import { useEffect, useState } from 'react'
import { cycleTheme, THEMES, useTheme, useThemeNotice } from './index'

/** Keyboard shortcut and a brief palette-name badge. */
export function ThemePreview() {
  const changes = useThemeNotice(s => s.changes)
  const [visible, setVisible] = useState(false)
  const theme = useTheme(), p = theme.palette, index = THEMES.indexOf(theme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 't') return
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return
      e.preventDefault()
      cycleTheme(e.shiftKey ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!changes) return
    setVisible(true)
    const timer = window.setTimeout(() => setVisible(false), 2400)
    return () => window.clearTimeout(timer)
  }, [changes])

  useEffect(() => {
    document.body.style.backgroundColor = p.bg
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg)
  }, [p.bg])

  return <div role="status" aria-live="polite" aria-atomic="true" style={{
    position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
    zIndex: 10, pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap',
    padding: '9px 14px', border: `2px solid ${p.boxEdge}`, background: p.box, color: p.boxText,
    boxShadow: `3px 3px 0 ${p.shadow}`, font: '12px/1.6 monospace', opacity: visible ? 1 : 0,
  }}>
    {visible && <><strong>{index + 1}/{THEMES.length} · {theme.name.toUpperCase()}</strong><br />T next · Shift+T previous</>}
  </div>
}
