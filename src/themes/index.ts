import { useSettings } from '../game/settings'
import { themeById } from './palettes'
export { THEMES, themeById } from './palettes'
export type { Palette, Theme } from './palettes'

export const useTheme = () => useSettings(s => themeById(s.theme))
export const usePalette = () => useTheme().palette
export const currentTheme = () => themeById(useSettings.getState().theme)
