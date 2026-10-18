import { create } from 'zustand'
import { useSettings } from '../game/settings'
import { THEMES, themeById, type Palette, type Theme } from './palettes'

export { THEMES, themeById, type Palette, type Theme } from './palettes'

/** Only keyboard changes show a brief label; swatches update quietly in place. */
export const useThemeNotice = create<{ changes: number }>(() => ({ changes: 0 }))
export const selectTheme = (id: Theme['id']) => useSettings.getState().update({ colorScheme: id })
export const cycleTheme = (direction = 1) => {
  const index = THEMES.indexOf(currentTheme())
  selectTheme(THEMES[(index + direction + THEMES.length) % THEMES.length].id)
  useThemeNotice.setState(s => ({ changes: s.changes + 1 }))
}
export const useTheme = (): Theme => themeById(useSettings(s => s.colorScheme))
export const usePalette = (): Palette => useTheme().palette
export const currentTheme = (): Theme => themeById(useSettings.getState().colorScheme)
