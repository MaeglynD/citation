// PICO-8 palette. Every colour in the game comes from here.
export const P = {
  black: '#000000',
  navy: '#1d2b53',
  plum: '#7e2553',
  darkGreen: '#008751',
  brown: '#ab5236',
  darkGray: '#5f574f',
  lightGray: '#c2c3c7',
  white: '#fff1e8',
  red: '#ff004d',
  orange: '#ffa300',
  yellow: '#ffec27',
  green: '#00e436',
  blue: '#29adff',
  indigo: '#83769c',
  pink: '#ff77a8',
  peach: '#ffccaa',
} as const

export type PaletteColor = (typeof P)[keyof typeof P]

// Background of the whole stage (slightly darker than navy so navy boxes read on it).
export const BG = '#0f1733'
