export interface AnswerRecord {
  quoteId: string
  picked: string
  correct: boolean
  at: number
}
export interface GameRecord {
  id: string
  startedAt: number
  completedAt: number | null
  total: number
  answers: AnswerRecord[]
  /** Old versions stored answers without game boundaries. Never invent those boundaries. */
  legacy?: boolean
}
const KEY = 'citation-needed.history'
const GAMES_KEY = 'citation-needed.games'
export const HISTORY_LIMIT = 200
export const GAME_LIMIT = 50
const validAnswer = (r: any): r is AnswerRecord => !!r && typeof r.quoteId === 'string' && r.quoteId.length > 0
  && typeof r.picked === 'string' && r.picked.length > 0 && typeof r.correct === 'boolean' && Number.isFinite(r.at) && r.at >= 0

export function loadHistory(): AnswerRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(validAnswer).slice(0, HISTORY_LIMIT) : []
  } catch { return [] }
}
export function recordAnswer(previous: AnswerRecord[], record: AnswerRecord): AnswerRecord[] {
  const history = [record, ...previous].slice(0, HISTORY_LIMIT)
  try { localStorage.setItem(KEY, JSON.stringify(history)) } catch { /* Session history still works. */ }
  return history
}
function saveGames(games: GameRecord[]) {
  try { localStorage.setItem(GAMES_KEY, JSON.stringify({ version: 1, games })) } catch { /* Keep this visit usable without storage. */ }
}
export function loadGames(): GameRecord[] {
  try {
    const raw = localStorage.getItem(GAMES_KEY)
    if (raw !== null) {
      const saved = JSON.parse(raw)
      if (saved?.version === 1 && Array.isArray(saved.games)) {
        const seen = new Set<string>()
        return saved.games.filter((g: any) => {
          if (!g || typeof g.id !== 'string' || !g.id || seen.has(g.id) || !Number.isFinite(g.startedAt)
            || g.startedAt < 0 || !Number.isInteger(g.total) || g.total < 1 || g.total > HISTORY_LIMIT
            || !Array.isArray(g.answers) || g.answers.length < 1 || g.answers.length > g.total
            || !g.answers.every(validAnswer) || (g.completedAt !== null && (!Number.isFinite(g.completedAt)
              || g.completedAt < g.startedAt || g.answers.length !== g.total))) return false
          seen.add(g.id)
          return true
        }).sort((a: GameRecord, b: GameRecord) => b.startedAt - a.startedAt).slice(0, GAME_LIMIT)
      }
    }
  } catch { /* Recover the old answer list if the newer value is damaged. */ }
  const answers = loadHistory().sort((a, b) => a.at - b.at)
  if (!answers.length) return []
  const migrated: GameRecord[] = [{ id: 'legacy-answers', startedAt: answers[0].at,
    completedAt: null, total: answers.length, answers, legacy: true }]
  saveGames(migrated)
  return migrated
}
export function recordGame(previous: GameRecord[], game: GameRecord): GameRecord[] {
  const games = [game, ...previous.filter(g => g.id !== game.id)]
    .sort((a, b) => b.startedAt - a.startedAt).slice(0, GAME_LIMIT)
  saveGames(games)
  return games
}
export function formatPlayedAt(at: number): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(at)
}
