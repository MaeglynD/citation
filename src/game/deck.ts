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
 * Unseen material always comes before repeats. Within each pool, give the
 * strongest editorial tier first billing, with fresh shuffles on every game.
 * Start with up to three accessible openers, then mix themes and speakers.
 */
export function buildDeck(all: Quote[], seen: Set<string>, n = ROUNDS, rnd = Math.random): Quote[] {
  if (all.length === 0 || n <= 0) return []
  let pool = all.filter((q) => !seen.has(q.id))
  if (pool.length === 0) {
    seen.clear()
    pool = all.slice()
  }
  // A stable sort preserves the shuffle within each tier.
  const rank = (quotes: Quote[]) => shuffle(quotes, rnd).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const unseen = rank(pool)
  const repeats = rank(all.filter(q => seen.has(q.id)))
  const deck: Quote[] = []
  const usedIds = new Set<string>()
  const usedAnswers = new Set<string>()
  const themeCount = new Map<string, number>()
  const theme = (q: Quote) => q.tags[0] ?? 'misc'
  const perThemeCap = Math.max(2, Math.ceil(n / 4))

  const add = (q: Quote, capThemes = true, uniqueSpeaker = true): boolean => {
    if (deck.length >= n || usedIds.has(q.id)) return false
    if (uniqueSpeaker && usedAnswers.has(q.answer.name)) return false
    const t = theme(q)
    if (capThemes && (themeCount.get(t) ?? 0) >= perThemeCap) return false
    deck.push(q)
    usedIds.add(q.id)
    usedAnswers.add(q.answer.name)
    themeCount.set(t, (themeCount.get(t) ?? 0) + 1)
    return true
  }

  const openingThemes = new Set<string>()
  for (const q of unseen) {
    if (deck.length >= Math.min(3, n)) break
    if (!q.opener || openingThemes.has(theme(q))) continue
    if (add(q)) openingThemes.add(theme(q))
  }

  for (const candidates of [unseen, repeats]) {
    for (const q of candidates) add(q)
    // Exhaust fresh material before using repeats, even in a lopsided pool.
    for (const q of candidates) add(q, false)
    for (const q of candidates) add(q, false, false)
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
