/** Colour choices share the same pixel art, layout and soundtrack. */
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
  id: 'arcade', name: 'Violet',
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
const mint: Theme = {
  id: 'mint', name: 'Mint',
  palette: {
    bg: '#103e43', bg2: '#24756c', bg3: '#baf56d',
    paper: '#fff3d8', paperEdge: '#112e32', ink: '#183d38', mark: '#ee6f85',
    box: '#19584f', boxEdge: '#75bdae', boxText: '#fff7df', hint: '#b4d5bf',
    accent: '#d7f783', accentInk: '#243e28',
    good: '#71edc1', goodInk: '#183c36', bad: '#ff96a1', badInk: '#4a2030',
    card: '#4e8880', cardLine: '#3c756e', cardEdge: '#badccc', silhouette: '#a2cabc',
    text: '#fff5e0', muted: '#bcd9cb', dim: '#719b91', shadow: '#0c2b30',
    confetti: ['#d7f783', '#ee6f85', '#71edc1', '#99dcff', '#fff3d8'],
  },
}
const coral: Theme = {
  id: 'coral', name: 'Coral',
  palette: {
    bg: '#692c43', bg2: '#b24e62', bg3: '#ffc07d',
    paper: '#fff1d9', paperEdge: '#3e2035', ink: '#53243c', mark: '#e14b73',
    box: '#873950', boxEdge: '#e7959a', boxText: '#fff2df', hint: '#f2c4bb',
    accent: '#ffdb80', accentInk: '#582937',
    good: '#96f1c5', goodInk: '#234136', bad: '#ffabc7', badInk: '#5b203d',
    card: '#ac6e83', cardLine: '#925b71', cardEdge: '#f4bfbe', silhouette: '#e4b0b1',
    text: '#fff2df', muted: '#f2c4bb', dim: '#c0818e', shadow: '#3e2035',
    confetti: ['#ffdb80', '#ffabc7', '#96f1c5', '#a1d9f5', '#fff1d9'],
  },
}
const midnight: Theme = {
  id: 'midnight', name: 'Midnight',
  palette: {
    bg: '#111c35', bg2: '#29476f', bg3: '#60d7ee',
    paper: '#eaf3f4', paperEdge: '#10172c', ink: '#20304c', mark: '#ce6aaf',
    box: '#203758', boxEdge: '#6f99be', boxText: '#eaf5ff', hint: '#bdd0e7',
    accent: '#84e0f2', accentInk: '#182e47',
    good: '#91e5be', goodInk: '#213e3d', bad: '#f49cba', badInk: '#482d43',
    card: '#4d688b', cardLine: '#3d587a', cardEdge: '#a6c5df', silhouette: '#9eb7d0',
    text: '#eaf5ff', muted: '#b8ccdf', dim: '#7191b3', shadow: '#0a1022',
    confetti: ['#84e0f2', '#f49cba', '#91e5be', '#ffe19b', '#eaf3f4'],
  },
}
export const THEMES: Theme[] = [arcade, mint, coral, midnight]
export const themeById = (id: string): Theme => THEMES.find(theme => theme.id === id) ?? arcade
