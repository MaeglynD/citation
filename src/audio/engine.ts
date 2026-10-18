import { Synth } from './core'
import { THEMES, themeById } from './themes'
import type { Theme, Voice } from './themes/helpers'
import { isLetter } from './themes/helpers'
import { recordings, type MusicScene, type Clip } from './recordings'

export type { Voice }

/** Volume steps 0..5 mapped onto a roughly perceptual gain curve. */
const LEVEL = [0, 0.025, 0.2, 0.4, 0.67, 1]
const MUSIC_BASE = 0.3
const SFX_BASE = 1.0
/** Seconds of music scheduled ahead of the clock. */
const LOOKAHEAD = 0.9
/** Theme change: the old song fades on this time constant while the new one rises over FADE_IN seconds. */
const FADE_TC = 0.4
const FADE_IN = 1.2

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** A different gibberish voice per quote. */
export function voiceFor(id: string): Voice {
  const h = hash(id)
  const waves: OscillatorType[] = ['square', 'triangle', 'sawtooth', 'square']
  return { base: 160 + (h % 380), wave: waves[(h >> 8) % waves.length], wobble: 0.5 + ((h >> 16) % 100) / 100, seed: h }
}

/** One running song. Each has its own fader so two can overlap while a theme change crossfades. */
interface SongRun {
  theme: Theme
  fader: GainNode
  bar: number
  next: number
  timer: number | null
  alive: boolean
  recording?: AudioBufferSourceNode
  recordingKey?: string
}

const clipKey = (clip: Clip) => JSON.stringify([clip.sources, clip.loopStart ?? 0, clip.loopEnd ?? null])

/** Schedules a song's bars into `dest` from time `from`, as the engine and the QA renderer both do. */
export function scheduleBars(s: Synth, theme: Theme, dest: AudioNode, from: number, until: number, firstBar = 0): { bar: number; next: number } {
  const song = theme.song
  const step = 60 / song.bpm / 4
  const barLen = step * (song.steps ?? 16)
  let bar = firstBar
  let next = from
  while (next < until) {
    song.bar(s, bar % song.bars, next, step, dest)
    bar++
    next += barLen
  }
  return { bar, next }
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private s: Synth | null = null
  private theme: Theme = THEMES[0]
  private run: SongRun | null = null
  /** Music ducks under the big sound effects (duckGain) and, more gently, under typing (typeGain). */
  private duckGain: GainNode | null = null
  private typeGain: GainNode | null = null
  private muted = false // music only; effects still follow the overall volume
  private volume = 1
  private lastBlip = 0
  private lastMumble = -1
  private scene: MusicScene = 'menu'

  private ensure(): Synth | null {
    if (this.s) return this.s
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AC({ latencyHint: 'interactive' }) as AudioContext
      const s = new Synth(ctx, ctx.destination)
      this.ctx = ctx
      this.s = s
      this.duckGain = ctx.createGain()
      this.duckGain.connect(s.music)
      this.typeGain = ctx.createGain()
      this.typeGain.connect(this.duckGain)
      this.applyLevels()
      void recordings.preloadEffects(ctx, this.theme.id)
      // a hidden tab goes quiet instead of piling up scheduled notes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (ctx.state === 'running') void ctx.suspend().catch(() => {}) }
        else if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      })
      return s
    } catch {
      return null
    }
  }

  private applyLevels() {
    const s = this.s
    if (!s) return
    const t = s.now
    s.master.gain.cancelScheduledValues(t)
    s.master.gain.setTargetAtTime(LEVEL[this.volume], t, 0.04)
    s.music.gain.cancelScheduledValues(t)
    s.music.gain.setTargetAtTime(this.muted ? 0 : MUSIC_BASE, t, this.muted ? 0.015 : 0.04)
    s.sfx.gain.cancelScheduledValues(t)
    s.sfx.gain.setTargetAtTime(SFX_BASE * this.theme.sfxGain, t, 0.03)
  }

  configure(o: { theme?: string; volume?: number; muted?: boolean }) {
    if (o.theme !== undefined && o.theme !== this.theme.id) {
      this.theme = themeById(o.theme)
      if (this.ctx) void recordings.preloadEffects(this.ctx, this.theme.id)
      if (this.run && this.s) { this.retire(this.run); this.run = this.spawn(this.s, this.theme, FADE_IN) }
    }
    if (o.volume !== undefined) this.volume = Math.max(0, Math.min(5, Math.round(o.volume)))
    if (o.muted !== undefined) this.muted = o.muted
    this.applyLevels()
  }

  resume() {
    const s = this.ensure()
    if (s && this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {})
  }

  get playing() { return this.run !== null }

  setScene(scene: MusicScene) {
    if (this.scene === scene) return
    this.scene = scene
    const run = this.run, s = this.s, theme = this.theme
    if (!run || !s) return
    // Keep the current song audible while the next scene loads. Shared tracks
    // continue from their current beat when moving between the menu and a game.
    void recordings.music(s.ctx, theme.id, scene).then(clip => {
      if (this.scene !== scene || this.run !== run || this.theme !== theme) return
      if ((clip && run.recordingKey === clipKey(clip.clip)) || (!clip && !run.recording)) {
        const level = clip ? Math.max(0, Math.min(2, clip.clip.gain ?? 1)) : theme.musicGain
        run.fader.gain.cancelScheduledValues(s.now)
        run.fader.gain.setTargetAtTime(level * (scene === 'menu' ? .8 : 1), s.now, .25)
      } else {
        this.retire(run); this.run = this.spawn(s, theme, FADE_IN, clip ?? undefined)
      }
    })
  }

  // ---- music -------------------------------------------------------------

  startMusic() {
    const s = this.ensure()
    if (!s || this.run) return
    this.run = this.spawn(s, this.theme, 0.4)
  }

  stopMusic() {
    if (this.run) { this.retire(this.run); this.run = null }
  }

  private spawn(s: Synth, theme: Theme, fadeIn: number, recorded?: { buffer: AudioBuffer; clip: Clip }): SongRun {
    const fader = s.ctx.createGain()
    fader.connect(this.typeGain!)
    const t = s.now
    fader.gain.setValueAtTime(0, t)
    const level = recorded ? Math.max(0, Math.min(2, Number.isFinite(recorded.clip.gain) ? recorded.clip.gain! : 1)) : theme.musicGain
    fader.gain.linearRampToValueAtTime(level * (this.scene === 'menu' ? .8 : 1), t + fadeIn)
    const run: SongRun = { theme, fader, bar: 0, next: t + 0.08, timer: null, alive: true }
    if (recorded) {
      const source = s.ctx.createBufferSource()
      source.buffer = recorded.buffer; source.loop = true
      source.loopStart = Math.max(0, Math.min(Number.isFinite(recorded.clip.loopStart) ? recorded.clip.loopStart! : 0, recorded.buffer.duration - .1))
      source.loopEnd = Math.max(source.loopStart + .1, Math.min(Number.isFinite(recorded.clip.loopEnd) ? recorded.clip.loopEnd! : recorded.buffer.duration, recorded.buffer.duration))
      source.connect(fader); source.start(t + .02, source.loopStart)
      run.recording = source
      run.recordingKey = clipKey(recorded.clip)
      return run
    }
    const scene = this.scene
    void recordings.music(s.ctx, theme.id, scene).then(clip => {
      if (clip && run.alive && this.run === run && this.scene === scene && this.theme.id === theme.id) {
        this.retire(run); this.run = this.spawn(s, theme, FADE_IN, clip)
      } else if (!clip && run.alive && this.run === run) {
        // Start the composed fallback only after the recording lookup fails;
        // don't play a fragment of another tune while a real track is loading.
        run.next = s.now + .02
        tick()
      }
    })
    const tick = () => {
      if (!run.alive || this.s !== s) return
      // Browsers can throttle a busy tab without suspending its AudioContext.
      // Skip expired bars instead of starting all their notes at once.
      if (run.next < s.now - 0.2) {
        const barLength = 60 / theme.song.bpm / 4 * (theme.song.steps ?? 16)
        const missed = Math.ceil((s.now - run.next) / barLength)
        run.bar += missed
        run.next += missed * barLength
      }
      const r = scheduleBars(s, theme, fader, run.next, s.now + LOOKAHEAD, run.bar)
      run.bar = r.bar
      run.next = r.next
      run.timer = window.setTimeout(tick, 120)
    }
    return run
  }

  private retire(run: SongRun) {
    run.alive = false
    if (run.timer) window.clearTimeout(run.timer)
    run.timer = null
    const s = this.s
    if (!s) return
    const t = s.now
    const g = run.fader.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.setTargetAtTime(0, t, FADE_TC)
    // notes already scheduled play out through the fading fader; then its effects go with it
    window.setTimeout(() => { s.release(run.fader); try { run.recording?.stop(); run.recording?.disconnect(); run.fader.disconnect() } catch { /* already gone */ } }, 4000)
  }

  private duck(level: number, seconds: number) {
    const s = this.s
    if (!s || !this.duckGain) return
    const g = this.duckGain.gain
    const t = s.now
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.setTargetAtTime(level, t, 0.06)
    g.setTargetAtTime(1, t + seconds, 0.35)
  }

  /** Typing sits the music back a touch; it comes back a third of a second after the last letter. */
  private typeDuck() {
    const s = this.s
    if (!s || !this.typeGain) return
    const g = this.typeGain.gain
    const t = s.now
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.setTargetAtTime(0.78, t, 0.05)
    g.setTargetAtTime(1, t + 0.3, 0.25)
  }

  // ---- sound effects -----------------------------------------------------

  private play(fn: (s: Synth, t: number) => void) {
    if (document.hidden || this.volume === 0) return
    const s = this.ensure()
    // A hover before the first gesture must not queue a burst of sounds for unlock.
    if (!s || s.ctx.state !== 'running') return
    fn(s, s.now + 0.005)
  }
  private event(key: string, fallback: (s: Synth, t: number) => void) {
    this.play((s,t) => { if (!recordings.playEffect(s.ctx, s.sfx, this.theme.id, key, t)) fallback(s,t) })
  }

  blip(ch: string, v: Voice, i: number) {
    if (document.hidden || this.volume === 0 || !isLetter(ch)) return
    const s = this.ensure()
    if (!s || s.ctx.state !== 'running') return
    if (s.now - this.lastBlip < 0.065) return
    this.lastBlip = s.now
    this.typeDuck()
    this.theme.sfx.blip(s, s.now + 0.005, ch, v, i)
  }
  typed() { this.play((s, t) => this.theme.sfx.typed(s, t)) }
  hover() { this.event('hover', (s, t) => this.theme.sfx.hover(s, t)) }
  mumble(label: string, v: Voice) {
    this.play((s, t) => {
      if (t - this.lastMumble < 0.38) return
      this.lastMumble = t
      this.theme.sfx.mumble(s, t, label, v)
    })
  }
  select() { this.event('confirm', (s, t) => this.theme.sfx.select(s, t)) }
  page() { this.event('page', (s, t) => this.theme.sfx.page(s, t)) }
  drumroll(dur: number) { this.duck(0.3, dur + 0.6); this.event('suspense', (s, t) => this.theme.sfx.drumroll(s, t, dur)) }
  correct() { this.duck(.35, 1.2); this.event('correct', (s, t) => this.theme.sfx.correct(s, t)) }
  wrong() { this.duck(.35, 1.2); this.event('wrong', (s, t) => this.theme.sfx.wrong(s, t)) }
  stamp(right: boolean) {
    if (!recordings.hasEffect(this.theme.id, right ? 'correct' : 'wrong')) this.event('stamp', (s, t) => this.theme.sfx.stamp(s, t, right))
  }
  gasp(right: boolean) { this.play((s, t) => this.theme.sfx.crowd(s, t, right)) }
  fanfare(ratio: number) { this.duck(0.25, 3.2); this.event('complete', (s, t) => this.theme.sfx.fanfare(s, t, ratio)) }
}

export const audio = new AudioEngine()

// ---------------------------------------------------------------------------
// Offline rendering for QA: render a theme's music plus every sound effect to a buffer.

export async function renderThemeOffline(id: string, seconds = 24, sampleRate = 22050, volume = 3): Promise<{ music: Float32Array; sfx: Float32Array; sampleRate: number }> {
  const theme = themeById(id)
  const render = async (fn: (s: Synth) => void, secs: number) => {
    const ctx = new OfflineAudioContext(2, Math.ceil(secs * sampleRate), sampleRate)
    const s = new Synth(ctx, ctx.destination)
    s.master.gain.value = LEVEL[Math.max(0, Math.min(5, volume))]
    s.music.gain.value = MUSIC_BASE
    s.sfx.gain.value = SFX_BASE * theme.sfxGain
    fn(s)
    const buf = await ctx.startRendering()
    const l = buf.getChannelData(0), r = buf.getChannelData(1)
    const mono = new Float32Array(l.length)
    for (let i = 0; i < l.length; i++) mono[i] = (l[i] + r[i]) / 2
    return mono
  }
  const music = await render((s) => {
    const fader = s.ctx.createGain()
    fader.gain.value = theme.musicGain
    fader.connect(s.music)
    scheduleBars(s, theme, fader, 0.05, seconds)
  }, seconds)
  const v = voiceFor('qa')
  const sfx = await render((s) => {
    const x = theme.sfx
    let t = 0.1
    const text = 'I am of another dimension.'
    for (let i = 0; i < text.length; i++) { x.blip(s, t, text[i], v, i); t += 0.03 }
    x.typed(s, t); t += 0.8
    x.hover(s, t); x.mumble(s, t, 'Kanye', v); t += 0.6
    x.select(s, t); t += 0.3
    x.drumroll(s, t, 0.9); t += 1.0
    x.correct(s, t); x.stamp(s, t + 0.38, true); x.crowd(s, t + 0.65, true); t += 2.6
    x.page(s, t); t += 0.5
    x.wrong(s, t); x.stamp(s, t + 0.38, false); x.crowd(s, t + 0.65, false); t += 2.8
    x.fanfare(s, t, 1); t += 3
    x.fanfare(s, t, 0.5); t += 2.2
    x.fanfare(s, t, 0.1)
  }, 22)
  return { music, sfx, sampleRate }
}

if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__renderThemeOffline = renderThemeOffline
