import { create } from 'zustand'
import type { Option, Quote } from './types'
import { buildDeck, buildOptions, loadSeen, saveSeen, ROUNDS } from './deck'
import { audio, voiceFor } from '../audio/engine'
import { useSettings } from './settings'
import { loadHistory, recordAnswer, loadGames, recordGame, type AnswerRecord, type GameRecord } from './history'

export type Phase = 'title' | 'transition' | 'question' | 'suspense' | 'reveal' | 'summary' | 'history'

export interface View {
  /** Whole canvas, in virtual pixels. */
  w: number
  h: number
  /** The frame everything is laid out in: the canvas, capped so big screens don't spread the game out. */
  fw: number
  fh: number
  scale: number
  portrait: boolean
}

export const FRAME_MAX_W = 576
export const FRAME_MAX_H = 400

export interface Fx {
  shakeUntil: number
  shakeDuration: number
  shakeAmp: number
  flashUntil: number
  flashDuration: number
  /** Start time (clock seconds) of the pixel-dissolve wipe; content swaps at its midpoint. */
  wipeAt: number
  wipeDuration: number
}

export const WIPE_SECONDS = 0.36
export const REVEAL_LOCK_MS = 1500
export const SUSPENSE_MS = 950

export interface GameState {
  view: View
  setView: (v: View) => void
  fx: Fx
  shake: (amp: number, duration: number) => void
  flash: (duration: number) => void
  wipe: (then: () => void) => void
  hoverMumble: (label: string) => void
  clockNow: number
  setClock: (t: number) => void

  all: Quote[]
  seen: Set<string>
  phase: Phase
  /** Which screen is on stage; stays put during a 'transition' so the wipe covers a real screen. */
  screen: 'title' | 'play' | 'summary' | 'history'
  resumePhase: 'question' | 'reveal' | null
  resolutionId: number
  history: AnswerRecord[]
  games: GameRecord[]
  gameId: string | null
  gameStartedAt: number
  reviewGameId: string | null
  phaseAt: number // performance.now() when the phase started
  deck: Quote[]
  round: number
  score: number
  results: ('right' | 'wrong')[]
  /** The name the player accused each round. */
  picks: string[]
  options: Option[]
  picked: number | null
  hovered: number | null
  typedDone: boolean
  bestScore: number

  toggleMute: () => void
  hoverAt: number
  hoverMove: (dir: number) => void

  start: () => void
  hover: (i: number | null) => void
  pick: (i: number) => void
  finishTyping: () => void
  next: () => void
  restart: () => void
  menu: () => void
  resume: () => void
  showHistory: () => void
}

const BEST_KEY = 'citation-needed.best'
function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}
function saveBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n))
  } catch {
    /* ignore */
  }
}

export const useGame = create<GameState>((set, get) => ({
  view: { w: 640, h: 360, fw: 640, fh: 360, scale: 3, portrait: false },
  setView: (view) => set({ view }),
  fx: { shakeUntil: 0, shakeDuration: 1, shakeAmp: 0, flashUntil: 0, flashDuration: 1, wipeAt: -10, wipeDuration: WIPE_SECONDS },
  clockNow: 0,
  setClock: (t) => set({ clockNow: t }),
  wipe: (then) => {
    const t = get().clockNow
    set({ fx: { ...get().fx, wipeAt: t, wipeDuration: WIPE_SECONDS } })
    window.setTimeout(then, WIPE_SECONDS * 500)
  },
  shake: (amp, duration) => {
    const t = get().clockNow
    set({ fx: { ...get().fx, shakeUntil: t + duration, shakeDuration: duration, shakeAmp: amp } })
  },
  flash: (duration) => {
    const t = get().clockNow
    set({ fx: { ...get().fx, flashUntil: t + duration, flashDuration: duration } })
  },

  all: [],
  seen: loadSeen(),
  phase: 'title',
  screen: 'title',
  resumePhase: null,
  resolutionId: 0,
  history: loadHistory(),
  games: loadGames(),
  gameId: null,
  gameStartedAt: 0,
  reviewGameId: null,
  phaseAt: 0,
  deck: [],
  round: 0,
  score: 0,
  results: [],
  picks: [],
  options: [],
  picked: null,
  hovered: null,
  typedDone: false,
  bestScore: loadBest(),

  hoverAt: 0,
  toggleMute: () => {
    const muted = !useSettings.getState().muted
    useSettings.getState().update({ muted })
    audio.configure({ muted })
    if (!muted) audio.resume()
  },

  start: () => {
    const { all, seen, phase } = get()
    const deck = buildDeck(all, seen, ROUNDS)
    if (deck.length === 0) return
    if (phase !== 'title' && phase !== 'summary') return
    audio.resume()
    audio.startMusic()
    audio.page()
    set({ phase: 'transition', resolutionId: get().resolutionId + 1, gameId: crypto.randomUUID(), gameStartedAt: Date.now() })
    get().wipe(() => {
      set({
        phase: 'question',
        screen: 'play',
        phaseAt: performance.now(),
        deck,
        round: 0,
        score: 0,
        results: [],
        picks: [],
        options: buildOptions(deck[0]),
        picked: null,
        hovered: null,
        typedDone: false,
        resumePhase: null,
      })
    })
  },

  hover: (i) => {
    const s = get()
    if (useSettings.getState().open || s.phase !== 'question' || s.hovered === i) return
    if (i !== null) {
      const opt = s.options[i]
      if (opt) {
        audio.hover()
        get().hoverMumble(opt.person.alias || opt.person.name)
      }
    }
    set({ hovered: i, hoverAt: performance.now() })
  },

  hoverMove: (dir) => {
    const s = get()
    if (s.phase !== 'question') return
    const n = s.options.length
    const next = s.hovered === null ? (dir > 0 ? 0 : n - 1) : (s.hovered + dir + n) % n
    get().hover(next)
  },

  hoverMumble: (label) => {
    const s = get()
    const q = s.deck[s.round]
    audio.mumble(label, voiceFor(q ? q.id : 'x'))
  },

  finishTyping: () => set({ typedDone: true }),

  pick: (i) => {
    const s = get()
    if (useSettings.getState().open || s.phase !== 'question' || !s.typedDone) return
    const opt = s.options[i]
    if (!opt) return
    const resolutionId = s.resolutionId + 1
    audio.select()
    set({ phase: 'suspense', phaseAt: performance.now(), picked: i, hovered: null, resolutionId })
    audio.drumroll(0.9)
    window.setTimeout(() => {
      const st = get()
      if (st.phase !== 'suspense' || st.resolutionId !== resolutionId) return
      const q = st.deck[st.round]
      const right = opt.correct
      const results = [...st.results, right ? 'right' : 'wrong'] as ('right' | 'wrong')[]
      const seen = st.seen
      seen.add(q.id)
      saveSeen(seen)
      const answeredAt = Date.now()
      const answer: AnswerRecord = { quoteId: q.id, picked: opt.person.name, correct: right, at: answeredAt }
      const previousAnswers = st.games.find(g => g.id === st.gameId)?.answers ?? []
      const answers = [...previousAnswers, answer]
      const games = st.gameId ? recordGame(st.games, {
        id: st.gameId, startedAt: st.gameStartedAt, completedAt: answers.length === st.deck.length ? answeredAt : null,
        total: st.deck.length, answers,
      }) : st.games
      set({
        phase: 'reveal',
        phaseAt: performance.now(),
        results,
        picks: [...st.picks, opt.person.name],
        score: st.score + (right ? 1 : 0),
        history: recordAnswer(st.history, answer),
        games,
      })
      if (right) {
        audio.correct()
        get().shake(1.25, .16)
      } else {
        audio.wrong()
        get().shake(2, .22)
      }
      window.setTimeout(() => { if (get().phase === 'reveal' && get().deck[get().round]?.id === q.id) audio.stamp(right) }, 380)
    }, SUSPENSE_MS)
  },

  next: () => {
    const s = get()
    if (useSettings.getState().open || s.phase !== 'reveal') return
    // Let the verdict animation and short cue finish before accepting the next answer.
    if (performance.now() - s.phaseAt < REVEAL_LOCK_MS) return
    const round = s.round + 1
    audio.page()
    set({ phase: 'transition' })
    get().wipe(() => {
      const st = get()
      if (round >= st.deck.length) {
        const best = Math.max(st.bestScore, st.score)
        saveBest(best)
        audio.fanfare(st.score / Math.max(1, st.deck.length))
        set({ phase: 'summary', screen: 'summary', phaseAt: performance.now(), bestScore: best })
        return
      }
      set({
        phase: 'question',
        screen: 'play',
        phaseAt: performance.now(),
        round,
        options: buildOptions(st.deck[round]),
        picked: null,
        hovered: null,
        typedDone: false,
      })
    })
  },

  restart: () => {
    get().start()
  },
  menu: () => {
    const s = get()
    if (s.phase === 'transition') return
    useSettings.getState().setOpen(false)
    const resumePhase = s.screen === 'play' ? (s.phase === 'reveal' ? 'reveal' : 'question') : s.resumePhase
    set({ screen: 'title', phase: 'title', phaseAt: performance.now(), resumePhase, resolutionId: s.resolutionId + 1,
      ...(s.phase === 'suspense' ? { picked: null, hovered: null } : {}) })
    audio.page()
  },
  resume: () => {
    const s = get()
    if (s.phase !== 'title') return
    if (!s.resumePhase) { s.start(); return }
    audio.resume(); audio.startMusic(); audio.page()
    set({ phase: s.resumePhase, screen: 'play', phaseAt: performance.now() - (s.resumePhase === 'reveal' ? REVEAL_LOCK_MS : 0), resumePhase: null })
  },
  showHistory: () => {
    if (get().phase !== 'title') return
    set({ phase: 'history', screen: 'history', phaseAt: performance.now(), reviewGameId: null })
    audio.page()
  },
}))
