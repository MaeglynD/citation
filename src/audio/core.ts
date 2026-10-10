/**
 * Synth core: every sound in the game is built here from oscillators, noise and filters.
 * Works with a realtime AudioContext and with an OfflineAudioContext (used for QA renders).
 */

export interface ToneOpts {
  type?: OscillatorType | 'pulse25' | 'pulse12' | 'organ' | 'reed' | 'soft'
  gain?: number
  a?: number // attack seconds
  d?: number // decay time constant (seconds to ~fall)
  s?: number // sustain level 0..1
  r?: number // release seconds
  slide?: number // pitch ratio reached by the end of the note
  slideTime?: number
  vib?: { rate: number; cents: number; delay?: number }
  filter?: { type?: BiquadFilterType; freq: number; q?: number; to?: number; time?: number }
  filter2?: { type?: BiquadFilterType; freq: number; q?: number; gain?: number }
  dest?: AudioNode
  pan?: number
  verb?: number
  detune?: number
  shaper?: number // drive amount for a tanh waveshaper (buzz)
  bits?: number // quantise the wave to this many bits (lo-fi, console wave channels)
}

export interface NoiseOpts {
  gain?: number
  a?: number
  d?: number
  s?: number
  r?: number
  filter?: { type?: BiquadFilterType; freq: number; q?: number; to?: number; time?: number }
  filter2?: { type?: BiquadFilterType; freq: number; q?: number }
  dest?: AudioNode
  pan?: number
  verb?: number
}

export interface SuperOpts extends ToneOpts {
  /** Number of detuned oscillators (default 5). */
  voices?: number
  /** Total detune spread in cents, edge to edge (default 14). */
  spread?: number
}

export interface PluckOpts {
  gain?: number
  /** Seconds for the string to ring out (default 1.2, max 3). */
  decay?: number
  /** 0 = dull thumb, 1 = bright pick (default 0.6). */
  bright?: number
  /** Cut the note short after this many seconds. */
  dur?: number
  dest?: AudioNode
  pan?: number
  verb?: number
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** 'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46 */
export function note(n: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(n.trim())
  if (!m) throw new Error(`bad note ${n}`)
  let v = NOTE_INDEX[m[1].toUpperCase()] + (Number(m[3]) + 1) * 12
  if (m[2] === '#') v++
  if (m[2] === 'b') v--
  return v
}

export class Synth {
  readonly ctx: BaseAudioContext
  readonly master: GainNode
  readonly music: GainNode
  readonly sfx: GainNode
  readonly verbIn: GainNode
  private noiseBuf: AudioBuffer
  private waves = new Map<string, PeriodicWave>()
  private curves = new Map<number, Float32Array>()
  private stairs = new Map<number, Float32Array>()
  private strings = new Map<string, AudioBuffer>()
  private impulses = new Map<string, AudioBuffer>()
  private tails = new WeakMap<AudioNode, (() => void)[]>()

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 12
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.2
    const trim = ctx.createGain()
    trim.gain.value = 0.9
    this.master = ctx.createGain()
    this.master.connect(comp)
    comp.connect(trim)
    trim.connect(destination)
    this.music = ctx.createGain()
    this.music.connect(this.master)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.master)
    const verb = ctx.createConvolver()
    verb.buffer = this.impulse(2.6, 3)
    const verbOut = ctx.createGain()
    verbOut.gain.value = 0.8
    this.verbIn = ctx.createGain()
    this.verbIn.connect(verb)
    verb.connect(verbOut)
    verbOut.connect(this.sfx)
    const len = ctx.sampleRate * 2
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    let seed = 1234567
    for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff) - 1 }
  }

  get now() { return this.ctx.currentTime }

  /** Stereo exponentially-decaying noise, darkened over time: a cheap plate-ish reverb. */
  private impulse(seconds: number, decay: number): AudioBuffer {
    const key = `${seconds}|${decay}`
    const hit = this.impulses.get(key)
    if (hit) return hit
    const sr = this.ctx.sampleRate
    const len = Math.floor(sr * seconds)
    const buf = this.ctx.createBuffer(2, len, sr)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let lp = 0
      let seed = ch ? 99991 : 7777
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        const n = (seed / 0x3fffffff) - 1
        const t = i / len
        const k = 0.15 + 0.8 * t // more smoothing later = darker tail
        lp = lp + (n - lp) * (1 - k)
        d[i] = lp * Math.pow(1 - t, decay) * (i < sr * 0.012 ? i / (sr * 0.012) : 1)
      }
    }
    this.impulses.set(key, buf)
    return buf
  }

  private periodic(name: string): PeriodicWave {
    let w = this.waves.get(name)
    if (w) return w
    const N = 32
    const re = new Float32Array(N)
    const im = new Float32Array(N)
    for (let k = 1; k < N; k++) {
      switch (name) {
        case 'pulse25': im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25); re[k] = (2 / (k * Math.PI)) * (1 - Math.cos(k * Math.PI * 0.25)); break
        case 'pulse12': im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.125); re[k] = (2 / (k * Math.PI)) * (1 - Math.cos(k * Math.PI * 0.125)); break
        case 'organ': im[k] = [0, 1, 0.6, 0.45, 0.3, 0, 0.18, 0, 0.12][k] ?? 0; break
        case 'reed': im[k] = (k % 2 ? 1 : 0.35) / Math.pow(k, 0.9); break
        case 'soft': im[k] = k === 1 ? 1 : k === 2 ? 0.25 : k === 3 ? 0.08 : 0; break
      }
    }
    w = this.ctx.createPeriodicWave(re, im)
    this.waves.set(name, w)
    return w
  }

  private curve(drive: number): Float32Array {
    let c = this.curves.get(drive)
    if (c) return c
    c = new Float32Array(1024)
    for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive) }
    this.curves.set(drive, c)
    return c
  }

  private envelope(g: AudioParam, t0: number, dur: number, peak: number, a: number, d: number, s: number, r: number) {
    g.setValueAtTime(0, t0)
    g.linearRampToValueAtTime(peak, t0 + Math.max(0.001, a))
    if (s < 1) g.setTargetAtTime(peak * s, t0 + a, Math.max(0.005, d / 3))
    const end = t0 + Math.max(a + 0.005, dur)
    g.setTargetAtTime(0, end, Math.max(0.004, r / 4))
    return end + r + 0.05
  }

  private route(node: AudioNode, o: { dest?: AudioNode; pan?: number; verb?: number }, defDest: AudioNode) {
    let out: AudioNode = node
    if (o.pan) {
      const p = this.ctx.createStereoPanner()
      p.pan.value = o.pan
      out.connect(p)
      out = p
    }
    out.connect(o.dest ?? defDest)
    if (o.verb) {
      const send = this.ctx.createGain()
      send.gain.value = o.verb
      out.connect(send)
      send.connect(this.verbIn)
    }
  }

  tone(freq: number, t0: number, dur: number, o: ToneOpts = {}) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const type = o.type ?? 'square'
    if (type === 'pulse25' || type === 'pulse12' || type === 'organ' || type === 'reed' || type === 'soft') osc.setPeriodicWave(this.periodic(type))
    else osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (o.detune) osc.detune.value = o.detune
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t0 + (o.slideTime ?? dur))
    if (o.vib) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = o.vib.rate
      const lg = ctx.createGain()
      const depth = freq * (Math.pow(2, o.vib.cents / 1200) - 1)
      lg.gain.setValueAtTime(0, t0)
      lg.gain.linearRampToValueAtTime(depth, t0 + (o.vib.delay ?? 0) + 0.08)
      lfo.connect(lg)
      lg.connect(osc.frequency)
      lfo.start(t0)
      lfo.stop(t0 + dur + (o.r ?? 0.05) + 0.1)
    }
    let last: AudioNode = osc
    if (o.shaper) {
      const ws = ctx.createWaveShaper()
      ws.curve = this.curve(o.shaper) as Float32Array<ArrayBuffer>
      last.connect(ws)
      last = ws
    }
    if (o.bits) {
      const ws = ctx.createWaveShaper()
      ws.curve = this.stair(o.bits) as Float32Array<ArrayBuffer>
      last.connect(ws)
      last = ws
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type ?? 'lowpass'
      f.frequency.setValueAtTime(o.filter.freq, t0)
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.to), t0 + (o.filter.time ?? dur))
      f.Q.value = o.filter.q ?? 0.8
      last.connect(f)
      last = f
    }
    if (o.filter2) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter2.type ?? 'peaking'
      f.frequency.value = o.filter2.freq
      f.Q.value = o.filter2.q ?? 1
      if (o.filter2.gain !== undefined) f.gain.value = o.filter2.gain
      last.connect(f)
      last = f
    }
    const g = ctx.createGain()
    const end = this.envelope(g.gain, t0, dur, o.gain ?? 0.2, o.a ?? 0.005, o.d ?? 0.2, o.s ?? 1, o.r ?? 0.03)
    last.connect(g)
    this.route(g, o, this.sfx)
    osc.start(t0)
    osc.stop(end)
  }

  noise(t0: number, dur: number, o: NoiseOpts = {}) {
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    src.playbackRate.value = 0.9 + ((t0 * 977) % 1) * 0.2
    let last: AudioNode = src
    const filters: { type?: BiquadFilterType; freq: number; q?: number; to?: number; time?: number }[] = []
    if (o.filter) filters.push(o.filter)
    if (o.filter2) filters.push(o.filter2)
    for (const fo of filters) {
      const f = ctx.createBiquadFilter()
      f.type = fo.type ?? 'bandpass'
      f.frequency.setValueAtTime(fo.freq, t0)
      if (fo.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, fo.to), t0 + (fo.time ?? dur))
      f.Q.value = fo.q ?? 1
      last.connect(f)
      last = f
    }
    const g = ctx.createGain()
    const end = this.envelope(g.gain, t0, dur, o.gain ?? 0.2, o.a ?? 0.002, o.d ?? dur, o.s ?? 0, o.r ?? 0.02)
    last.connect(g)
    this.route(g, o, this.sfx)
    src.start(t0, (t0 * 0.37) % 1.5)
    src.stop(end)
  }

  /** Two-operator FM: electric pianos, bells, vibes, marimba. */
  fm(freq: number, t0: number, dur: number, o: ToneOpts & { ratio?: number; index?: number; indexEnd?: number; indexTime?: number; tremolo?: { rate: number; depth: number } } = {}) {
    const ctx = this.ctx
    const car = ctx.createOscillator()
    car.type = 'sine'
    car.frequency.setValueAtTime(freq, t0)
    if (o.detune) car.detune.value = o.detune
    const mod = ctx.createOscillator()
    mod.type = 'sine'
    const ratio = o.ratio ?? 1
    mod.frequency.setValueAtTime(freq * ratio, t0)
    const mg = ctx.createGain()
    const i0 = (o.index ?? 2) * freq * ratio
    const i1 = (o.indexEnd ?? 0.2) * freq * ratio
    mg.gain.setValueAtTime(i0, t0)
    mg.gain.setTargetAtTime(i1, t0, Math.max(0.01, (o.indexTime ?? 0.4) / 3))
    mod.connect(mg)
    mg.connect(car.frequency)
    if (o.vib) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = o.vib.rate
      const lg = ctx.createGain()
      lg.gain.setValueAtTime(0, t0)
      lg.gain.linearRampToValueAtTime(o.vib.cents, t0 + (o.vib.delay ?? 0) + 0.08)
      lfo.connect(lg)
      lg.connect(car.detune)
      lg.connect(mod.detune)
      lfo.start(t0)
      lfo.stop(t0 + dur + (o.r ?? 0.2) + 0.3)
    }
    let last: AudioNode = car
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type ?? 'lowpass'
      f.frequency.value = o.filter.freq
      f.Q.value = o.filter.q ?? 0.7
      last.connect(f)
      last = f
    }
    const g = ctx.createGain()
    const end = this.envelope(g.gain, t0, dur, o.gain ?? 0.2, o.a ?? 0.003, o.d ?? 0.8, o.s ?? 0.3, o.r ?? 0.2)
    last.connect(g)
    let out: AudioNode = g
    if (o.tremolo) {
      const tg = ctx.createGain()
      tg.gain.value = 1 - o.tremolo.depth
      const lfo = ctx.createOscillator()
      lfo.frequency.value = o.tremolo.rate
      const lg = ctx.createGain()
      lg.gain.value = o.tremolo.depth
      lfo.connect(lg)
      lg.connect(tg.gain)
      lfo.start(t0)
      lfo.stop(end)
      g.connect(tg)
      out = tg
    }
    this.route(out, o, this.sfx)
    car.start(t0)
    mod.start(t0)
    car.stop(end)
    mod.stop(end)
  }

  /** Staircase transfer curve: quantises any waveform to 2^bits levels. */
  private stair(bits: number): Float32Array {
    let c = this.stairs.get(bits)
    if (c) return c
    const half = Math.pow(2, bits) / 2
    c = new Float32Array(2048)
    for (let i = 0; i < 2048; i++) { const x = (i / 2047) * 2 - 1; c[i] = Math.round(x * half) / half }
    this.stairs.set(bits, c)
    return c
  }

  /** Several detuned sawtooths (or any wave) through one filter: pads, 80s brass, synthwave leads. */
  supersaw(freq: number, t0: number, dur: number, o: SuperOpts = {}) {
    const ctx = this.ctx
    const n = Math.max(1, o.voices ?? 5)
    const spread = o.spread ?? 14
    const mix = ctx.createGain()
    mix.gain.value = 1 / Math.sqrt(n)
    let last: AudioNode = mix
    if (o.shaper) { const ws = ctx.createWaveShaper(); ws.curve = this.curve(o.shaper) as Float32Array<ArrayBuffer>; last.connect(ws); last = ws }
    if (o.bits) { const ws = ctx.createWaveShaper(); ws.curve = this.stair(o.bits) as Float32Array<ArrayBuffer>; last.connect(ws); last = ws }
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type ?? 'lowpass'
      f.frequency.setValueAtTime(o.filter.freq, t0)
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.to), t0 + (o.filter.time ?? dur))
      f.Q.value = o.filter.q ?? 0.8
      last.connect(f)
      last = f
    }
    if (o.filter2) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter2.type ?? 'peaking'
      f.frequency.value = o.filter2.freq
      f.Q.value = o.filter2.q ?? 1
      if (o.filter2.gain !== undefined) f.gain.value = o.filter2.gain
      last.connect(f)
      last = f
    }
    const g = ctx.createGain()
    const end = this.envelope(g.gain, t0, dur, o.gain ?? 0.15, o.a ?? 0.01, o.d ?? 0.3, o.s ?? 1, o.r ?? 0.08)
    last.connect(g)
    this.route(g, o, this.sfx)
    let lg: GainNode | null = null
    if (o.vib) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = o.vib.rate
      lg = ctx.createGain()
      lg.gain.setValueAtTime(0, t0)
      lg.gain.linearRampToValueAtTime(o.vib.cents, t0 + (o.vib.delay ?? 0) + 0.08)
      lfo.connect(lg)
      lfo.start(t0)
      lfo.stop(end)
    }
    const type = o.type ?? 'sawtooth'
    for (let k = 0; k < n; k++) {
      const osc = ctx.createOscillator()
      if (type === 'pulse25' || type === 'pulse12' || type === 'organ' || type === 'reed' || type === 'soft') osc.setPeriodicWave(this.periodic(type))
      else osc.type = type
      osc.frequency.setValueAtTime(freq, t0)
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t0 + (o.slideTime ?? dur))
      osc.detune.value = (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * spread) + (o.detune ?? 0)
      if (lg) lg.connect(osc.detune)
      osc.connect(mix)
      osc.start(t0)
      osc.stop(end)
    }
  }

  /** Karplus-Strong plucked string: bass guitars, nylon strings, harps, kotos. */
  pluck(freq: number, t0: number, o: PluckOpts = {}) {
    const ctx = this.ctx
    const buf = this.string(freq, Math.min(3, o.decay ?? 1.2), o.bright ?? 0.6)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(o.gain ?? 0.3, t0)
    const end = o.dur !== undefined ? t0 + o.dur : t0 + buf.duration
    if (o.dur !== undefined) g.gain.setTargetAtTime(0, end, 0.03)
    src.connect(g)
    this.route(g, o, this.sfx)
    src.start(t0)
    src.stop(end + 0.2)
  }

  private string(freq: number, decay: number, bright: number): AudioBuffer {
    const sr = this.ctx.sampleRate
    const N = Math.max(2, Math.round(sr / freq))
    const key = `${N}|${decay}|${bright}`
    const hit = this.strings.get(key)
    if (hit) return hit
    const len = Math.ceil(sr * decay)
    const buf = this.ctx.createBuffer(1, len, sr)
    const d = buf.getChannelData(0)
    let seed = N * 7919 + 17
    let lp = 0
    const k = 0.15 + 0.85 * bright
    for (let i = 0; i < N; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const nz = (seed / 0x3fffffff) - 1; lp += (nz - lp) * k; d[i] = lp }
    // per-sample loss so the string has fallen 60 dB by `decay` seconds
    const loss = Math.pow(10, (-3 * N) / (sr * decay))
    for (let i = N; i < len; i++) { const a = d[i - N]; const b = i - N - 1 >= 0 ? d[i - N - 1] : a; d[i] = loss * 0.5 * (a + b) }
    let peak = 0
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]))
    if (peak > 0) for (let i = 0; i < len; i++) d[i] *= 0.9 / peak
    this.strings.set(key, buf)
    return buf
  }

  // ---- effect returns -------------------------------------------------------
  // Each returns the node to play into; dry goes straight to `out`, wet via the effect.
  // Cleanup for anything that would otherwise run forever is registered against `out`
  // and fired by release(out).

  private tail(out: AudioNode, fn: () => void) {
    const list = this.tails.get(out) ?? []
    list.push(fn)
    this.tails.set(out, list)
  }

  /** Tears down the modulators and feedback loops built for `out` (a song's fader). */
  release(out: AudioNode) {
    for (const fn of this.tails.get(out) ?? []) { try { fn() } catch { /* already gone */ } }
    this.tails.delete(out)
  }

  /** Convolver reverb: `seconds` long, `decay` steepness, `mix` send level. */
  reverbBus(out: AudioNode, seconds = 2.2, decay = 3, mix = 0.3): GainNode {
    const input = this.ctx.createGain()
    input.connect(out)
    const conv = this.ctx.createConvolver()
    conv.buffer = this.impulse(seconds, decay)
    const send = this.ctx.createGain()
    send.gain.value = mix
    input.connect(send)
    send.connect(conv)
    conv.connect(out)
    this.tail(out, () => conv.disconnect())
    return input
  }

  /** Feedback delay with a darkening lowpass in the loop. */
  delayBus(out: AudioNode, time = 0.375, feedback = 0.35, mix = 0.25, tone = 2500): GainNode {
    const ctx = this.ctx
    const input = ctx.createGain()
    input.connect(out)
    const dl = ctx.createDelay(2)
    dl.delayTime.value = Math.min(2, time)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = tone
    const fb = ctx.createGain()
    fb.gain.value = Math.min(0.9, feedback)
    const wet = ctx.createGain()
    wet.gain.value = mix
    input.connect(dl)
    dl.connect(lp)
    lp.connect(fb)
    fb.connect(dl)
    lp.connect(wet)
    wet.connect(out)
    this.tail(out, () => { fb.disconnect(); dl.disconnect() })
    return input
  }

  /** Stereo chorus: two short delays swept by one LFO in opposite phase, under the dry signal. */
  chorusBus(out: AudioNode, rate = 0.5, depth = 0.0035, mix = 0.5): GainNode {
    const ctx = this.ctx
    const input = ctx.createGain()
    input.connect(out)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = rate
    for (const [pan, sign] of [[-0.6, 1], [0.6, -1]] as [number, number][]) {
      const dl = ctx.createDelay(0.1)
      dl.delayTime.value = 0.018
      const dg = ctx.createGain()
      dg.gain.value = depth * sign
      lfo.connect(dg)
      dg.connect(dl.delayTime)
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      const wet = ctx.createGain()
      wet.gain.value = mix * 0.7
      input.connect(dl)
      dl.connect(p)
      p.connect(wet)
      wet.connect(out)
    }
    lfo.start()
    this.tail(out, () => lfo.stop())
    return input
  }

  // ---- drum kit ------------------------------------------------------------
  kick(t: number, o: { gain?: number; dest?: AudioNode; pitch?: number; decay?: number } = {}) {
    const p = o.pitch ?? 110
    this.tone(p, t, o.decay ?? 0.22, { type: 'sine', gain: o.gain ?? 0.6, a: 0.001, slide: 0.38, slideTime: 0.09, r: 0.06, dest: o.dest })
    this.noise(t, 0.015, { gain: (o.gain ?? 0.6) * 0.2, filter: { type: 'lowpass', freq: 2000 }, dest: o.dest })
  }
  snare(t: number, o: { gain?: number; dest?: AudioNode; tone?: number; decay?: number; verb?: number } = {}) {
    this.tone(o.tone ?? 190, t, 0.07, { type: 'triangle', gain: (o.gain ?? 0.35) * 0.6, slide: 0.7, dest: o.dest })
    this.noise(t, o.decay ?? 0.16, { gain: o.gain ?? 0.35, filter: { type: 'highpass', freq: 1500 }, filter2: { type: 'lowpass', freq: 8000 }, dest: o.dest, verb: o.verb })
  }
  hat(t: number, o: { gain?: number; dest?: AudioNode; open?: boolean } = {}) {
    this.noise(t, o.open ? 0.22 : 0.035, { gain: o.gain ?? 0.12, filter: { type: 'highpass', freq: 7500 }, dest: o.dest })
  }
  /** Metallic cymbal from inharmonic square waves (the classic 808 recipe). */
  cymbal(t: number, o: { gain?: number; dest?: AudioNode; decay?: number; base?: number; verb?: number } = {}) {
    const base = o.base ?? 330
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) this.tone(base * r, t, 0.01, { type: 'square', gain: (o.gain ?? 0.1) / 3, a: 0.001, d: o.decay ?? 0.5, s: 0.0001, r: o.decay ?? 0.5, filter: { type: 'highpass', freq: 6000 }, dest: o.dest, verb: o.verb })
  }
  rim(t: number, o: { gain?: number; dest?: AudioNode } = {}) {
    this.tone(1700, t, 0.02, { type: 'triangle', gain: (o.gain ?? 0.25) * 0.7, r: 0.02, dest: o.dest })
    this.noise(t, 0.025, { gain: o.gain ?? 0.25, filter: { type: 'bandpass', freq: 3200, q: 2 }, dest: o.dest })
  }
  wood(t: number, freq = 900, o: { gain?: number; dest?: AudioNode } = {}) {
    this.tone(freq, t, 0.05, { type: 'sine', gain: o.gain ?? 0.35, a: 0.001, d: 0.04, s: 0, r: 0.04, slide: 0.92, dest: o.dest })
    this.noise(t, 0.012, { gain: (o.gain ?? 0.35) * 0.4, filter: { type: 'bandpass', freq: freq * 3, q: 3 }, dest: o.dest })
  }
}
