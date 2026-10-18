/** Visual palettes are independent of the soundtrack. */
export interface Palette {
  bg: string; bg2: string; bg3: string
  paper: string; paperEdge: string; ink: string; mark: string
  box: string; boxEdge: string; boxText: string; hint: string
  accent: string; accentInk: string
  good: string; goodInk: string; bad: string; badInk: string
  card: string; cardLine: string; cardEdge: string; silhouette: string
  heading: string; text: string; muted: string; dim: string; shadow: string; confetti: string[]
}
export interface Theme { id: 'midnight' | 'arcade' | 'ember' | 'parchment'; name: string; palette: Palette }
const arcade: Theme = {
  id: 'arcade', name: 'Arcade',
  palette: {
    bg: '#302575', bg2: '#6551c7', bg3: '#6de4ff',
    paper: '#fff4dd', paperEdge: '#241544', ink: '#30204b', mark: '#ff6aab',
    box: '#4b389a', boxEdge: '#b99af2', boxText: '#fff5e9', hint: '#cec0ef',
    accent: '#ffe35c', accentInk: '#32214c',
    good: '#62f2b1', goodInk: '#173d39', bad: '#ff6f94', badInk: '#44203b',
    card: '#6264b8', cardLine: '#5053a3', cardEdge: '#bdc8ff', silhouette: '#a5a1d5',
    heading: '#fff4dd', text: '#fff2fa', muted: '#d2c4ed', dim: '#9383bf', shadow: '#20133c',
    confetti: ['#ffe35c', '#ff6aab', '#62f2b1', '#6de4ff', '#fff4dd'],
  },
}
const midnight: Theme = {
  id: 'midnight', name: 'Midnight',
  palette: {
    bg: '#101b2c', bg2: '#243c55', bg3: '#76d8d3',
    paper: '#263d51', paperEdge: '#658c9f', ink: '#f0f5ed', mark: '#ecb577',
    box: '#1b3044', boxEdge: '#607f95', boxText: '#e7f1f2', hint: '#adc4ce',
    accent: '#91ded2', accentInk: '#142e35',
    good: '#a4dca1', goodInk: '#163323', bad: '#f19e9c', badInk: '#492731',
    card: '#38556b', cardLine: '#2e485d', cardEdge: '#8fb6c5', silhouette: '#9cb5bd',
    heading: '#f0f5ed', text: '#e7f1f2', muted: '#b1c5d0', dim: '#7793a6', shadow: '#080f1d',
    confetti: ['#91ded2', '#ecb577', '#a4dca1', '#f19e9c', '#e7f1f2'],
  },
}

const ember: Theme = {
  id: 'ember', name: 'Ember',
  palette: {
    bg: '#221e24', bg2: '#44353d', bg3: '#dbad7d',
    paper: '#3d3035', paperEdge: '#967777', ink: '#fff0db', mark: '#f2ad85',
    box: '#30292f', boxEdge: '#846b73', boxText: '#f7e8de', hint: '#d6bfb5',
    accent: '#f3c37c', accentInk: '#39291f',
    good: '#bad29c', goodInk: '#283521', bad: '#efa0a4', badInk: '#48252d',
    card: '#55434a', cardLine: '#483940', cardEdge: '#b9a092', silhouette: '#c4ada0',
    heading: '#fff0db', text: '#f7e8de', muted: '#d2bab2', dim: '#a18b89', shadow: '#120f15',
    confetti: ['#f3c37c', '#efa0a4', '#bad29c', '#d9b5dd', '#fff0db'],
  },
}

const parchment: Theme = {
  id: 'parchment', name: 'Parchment',
  palette: {
    bg: '#e7dcc6', bg2: '#f4ebd9', bg3: '#356d72',
    paper: '#fff8e9', paperEdge: '#a29175', ink: '#3d342d', mark: '#9c4934',
    box: '#f4ead7', boxEdge: '#a79678', boxText: '#443a31', hint: '#695b4b',
    accent: '#85402e', accentInk: '#fff8e9',
    good: '#346843', goodInk: '#f4f8e7', bad: '#a23f45', badInk: '#fff4e9',
    card: '#d8cab1', cardLine: '#c5b698', cardEdge: '#88785e', silhouette: '#796c5b',
    heading: '#3d342d', text: '#443a31', muted: '#6c5b49', dim: '#99866a', shadow: '#c0b095',
    confetti: ['#85402e', '#356d72', '#b18b35', '#346843', '#a23f45'],
  },
}

// The selected preview order: 2, 1, 3, 4.
export const THEMES = [midnight, arcade, ember, parchment]
export const themeById = (id: string): Theme => THEMES.find(t => t.id === id) ?? THEMES[0]
