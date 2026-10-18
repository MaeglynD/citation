import { create } from 'zustand'
import { THEMES, themeById, type Theme } from '../themes/palettes'

/**
 * Player preferences, persisted per browser: the stable soundtrack id,
 * color scheme, overall volume, display size, and music mute.
 */

export type SizeSetting = 'small' | 'medium' | 'large' | 'huge'

export interface Settings {
  theme: string
  colorScheme: Theme['id']
  volume: number // 0..5
  size: SizeSetting
  muted: boolean // music only
}

export const SIZE_ORDER: SizeSetting[] = ['small', 'medium', 'large', 'huge']
export const SIZE_LABEL: Record<SizeSetting, string> = { small: 'S', medium: 'M', large: 'L', huge: 'XL' }
/** Largest on-screen size of one virtual pixel, in CSS pixels, per size setting. */
export const MAX_CSS_PX: Record<SizeSetting, number> = { small: 1.5, medium: 2, large: 3, huge: 99 }
export const CHARS_PER_SECOND = 55

const KEY = 'citation-needed.settings'
const DEFAULTS: Settings = { theme: 'arcade', colorScheme: THEMES[0].id, volume: 1, size: 'large', muted: false }

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw)
    const s: Settings = { ...DEFAULTS }
    // Keep the soundtrack stable; visual choices have their own preference.
    if (typeof saved.colorScheme === 'string') s.colorScheme = themeById(saved.colorScheme).id
    if (Number.isFinite(saved.volume)) s.volume = Math.max(0, Math.min(5, Math.round(saved.volume)))
    else if (typeof saved.music === 'number') s.volume = Math.max(0, Math.min(5, Math.round(saved.music)))
    if (SIZE_ORDER.includes(saved.size)) s.size = saved.size
    if (typeof saved.muted === 'boolean') s.muted = saved.muted
    return s
  } catch {
    return { ...DEFAULTS }
  }
}

function save(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable: settings last for this visit only */
  }
}

interface SettingsStore extends Settings {
  open: boolean
  setOpen: (open: boolean) => void
  update: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...load(),
  open: false,
  setOpen: (open) => set({ open }),
  update: (patch) => {
    set({ ...patch, theme: 'arcade', colorScheme: themeById(patch.colorScheme ?? get().colorScheme).id })
    const { theme, colorScheme, volume, size, muted } = get()
    save({ theme, colorScheme, volume, size, muted })
  },
}))
