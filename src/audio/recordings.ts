/** Bundled recordings with a composed fallback when a file cannot be loaded. */
export interface Clip {
  sources: string[]
  gain?: number
  loopStart?: number
  loopEnd?: number
}
export type MusicScene = 'menu' | 'main' | 'results'
interface SoundPack { music?: Partial<Record<MusicScene, Clip>>; sfx?: Record<string, Clip> }
interface Manifest { version: 1; themes: Record<string, SoundPack> }

class Recordings {
  private manifest: Promise<Manifest> | null = null
  private cache = new Map<string, Promise<AudioBuffer | null>>()
  private effects = new Map<string, { buffer: AudioBuffer; gain: number }>()
  private config(): Promise<Manifest> {
    return this.manifest ??= fetch('/audio/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null)
      .then(m => m?.version === 1 && m.themes ? m as Manifest : { version: 1 as const, themes: {} })
      .catch(() => ({ version: 1 as const, themes: {} }))
  }
  private decode(ctx: BaseAudioContext, clip: Clip): Promise<AudioBuffer | null> {
    const key = JSON.stringify(clip.sources)
    if (!this.cache.has(key)) this.cache.set(key, (async () => {
      for (const path of clip.sources ?? []) {
        // Audio is packaged with the game; no third-party tracking or remote URL dependency.
        if (!path.startsWith('/audio/') || path.includes('..')) continue
        try { const response = await fetch(path); if (response.ok) return await ctx.decodeAudioData(await response.arrayBuffer()) } catch { /* Try the alternate codec. */ }
      }
      return null
    })())
    return this.cache.get(key)!
  }
  async music(ctx: BaseAudioContext, theme: string, scene: MusicScene) {
    const pack = (await this.config()).themes[theme]
    const clip = pack?.music?.[scene] ?? pack?.music?.main
    if (!clip) return null
    const buffer = await this.decode(ctx, clip)
    return buffer ? { buffer, clip } : null
  }
  async preloadEffects(ctx: BaseAudioContext, theme: string) {
    const pack = (await this.config()).themes[theme]
    await Promise.all(Object.entries(pack?.sfx ?? {}).map(async ([key, clip]) => {
      const buffer = await this.decode(ctx, clip)
      if (buffer) this.effects.set(theme + '/' + key, { buffer, gain: Math.max(0, Math.min(2, clip.gain ?? 1)) })
    }))
  }
  hasEffect(theme: string, key: string) { return this.effects.has(theme + '/' + key) }
  playEffect(ctx: BaseAudioContext, dest: AudioNode, theme: string, key: string, when: number) {
    const effect = this.effects.get(theme + '/' + key)
    if (!effect) return false
    const node = ctx.createBufferSource(), gain = ctx.createGain()
    node.buffer = effect.buffer; gain.gain.value = effect.gain
    node.connect(gain); gain.connect(dest)
    node.onended = () => { node.disconnect(); gain.disconnect() }
    node.start(when)
    return true
  }
}
export const recordings = new Recordings()
