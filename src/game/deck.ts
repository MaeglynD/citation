import type { Option, Quote } from './types'

export const ROUNDS = 10

function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SEEN_KEY = 'citation-needed.seen'

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
  } catch {
    /* storage unavailable: fine, the game still works */
  }
}

/**
 * Pick a deck of distinct quotes: unseen first, no repeated answer, and
 * at most a few per theme so a single deck doesn't feel samey.
 */
export function buildDeck(all: Quote[], seen: Set<string>, n = ROUNDS): Quote[] {
  if (all.length === 0) return []
  let pool = all.filter((q) => !seen.has(q.id))
  if (pool.length === 0) {
    seen.clear()
    pool = all.slice()
  }
  const candidates = [...shuffle(pool), ...shuffle(all.filter(q => seen.has(q.id)))]
  const deck: Quote[] = []
  const usedAnswers = new Set<string>()
  const themeCount = new Map<string, number>()
  const theme = (q: Quote) => q.tags[0] ?? 'misc'
  const perThemeCap = Math.max(2, Math.ceil(n / 4))

  for (const q of candidates) {
    if (deck.length >= n) break
    if (usedAnswers.has(q.answer.name)) continue
    const t = theme(q)
    if ((themeCount.get(t) ?? 0) >= perThemeCap) continue
    deck.push(q)
    usedAnswers.add(q.answer.name)
    themeCount.set(t, (themeCount.get(t) ?? 0) + 1)
  }
  // Relax the theme cap if the pool is lopsided.
  for (const q of candidates) {
    if (deck.length >= n) break
    if (deck.includes(q) || usedAnswers.has(q.answer.name)) continue
    deck.push(q)
    usedAnswers.add(q.answer.name)
  }
  // A small custom pool may have fewer unique speakers than rounds.
  for (const q of candidates) {
    if (deck.length >= n) break
    if (!deck.includes(q)) deck.push(q)
  }
  return deck
}

export function buildOptions(q: Quote): Option[] {
  const opts: Option[] = [{ person: q.answer, correct: true }, ...q.decoys.slice(0, 3).map((d) => ({ person: d, correct: false }))]
  const shuffled = shuffle(opts)
  // Dev aid: ?cheat puts the answer in slot 1 so screenshots can hit the correct path.
  if (import.meta.env?.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('cheat')) {
    shuffled.sort((a, b) => Number(b.correct) - Number(a.correct))
  }
  return shuffled
}
