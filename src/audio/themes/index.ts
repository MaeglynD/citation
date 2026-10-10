import type { Theme } from './helpers'
import { theatre } from './chamber'

export type { Theme, Song, Sfx, Voice } from './helpers'

/** The composed fallback for the single arcade soundtrack slot. */
export const THEMES: Theme[] = [theatre]
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? theatre
