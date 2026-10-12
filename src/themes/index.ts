/** One visual identity. The stable arcade id also identifies imported music. */
export interface Palette {
  bg: string; bg2: string; bg3: string
  paper: string; paperEdge: string; ink: string; mark: string
  box: string; boxEdge: string; boxText: string; hint: string
  accent: string; accentInk: string
  good: string; goodInk: string; bad: string; badInk: string
  card: string; cardLine: string; cardEdge: string; silhouette: string
  text: string; muted: string; dim: string; shadow: string; confetti: string[]
}
export interface Theme { id: string; name: string; palette: Palette }
const arcade: Theme = {
  id: 'arcade', name: 'Citation Needed',
  palette: {
    bg: '#302575', bg2: '#6551c7', bg3: '#6de4ff',
    paper: '#fff4dd', paperEdge: '#241544', ink: '#30204b', mark: '#ff6aab',
    box: '#4b389a', boxEdge: '#b99af2', boxText: '#fff5e9', hint: '#cec0ef',
    accent: '#ffe35c', accentInk: '#32214c',
    good: '#62f2b1', goodInk: '#173d39', bad: '#ff6f94', badInk: '#44203b',
    card: '#6264b8', cardLine: '#5053a3', cardEdge: '#bdc8ff', silhouette: '#a5a1d5',
    text: '#fff2fa', muted: '#d2c4ed', dim: '#9383bf', shadow: '#20133c',
    confetti: ['#ffe35c', '#ff6aab', '#62f2b1', '#6de4ff', '#fff4dd'],
  },
}
export const THEMES = [arcade]
export const themeById = (_id: string): Theme => arcade
export const usePalette = (): Palette => arcade.palette
export const useTheme = (): Theme => arcade
export const currentTheme = (): Theme => arcade
