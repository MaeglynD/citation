import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const code = ts.transpileModule(fs.readFileSync('src/audio/recordings.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
let instance = 0
const fresh = async () => (await import('data:text/javascript;base64,' + Buffer.from(code + `\n// ${instance++}`).toString('base64'))).recordings
const clip = { sources: ['/audio/song.ogg', '/audio/song.mp3'] }
const manifest = { version: 1, themes: { arcade: { music: { menu: clip, main: clip, results: { sources: ['/audio/results.ogg'] } } } } }
let requests = [], decodes = 0, supported = true, fail = false, corrupt = false
globalThis.document = { createElement: () => ({ canPlayType: type => type.includes('ogg') && !supported ? '' : 'probably' }) }
globalThis.fetch = async (path, options) => {
  requests.push({ path, priority: options?.priority })
  if (path.endsWith('.json')) return { ok: true, json: async () => manifest }
  if (fail) throw new Error('network unavailable')
  return { ok: true, arrayBuffer: async () => new Uint8Array([path.endsWith('.ogg') ? 1 : 2]).buffer }
}
const decoded = { duration: 63 }
const ctx = { decodeAudioData: async bytes => { decodes++; if (corrupt && new Uint8Array(bytes)[0] === 1) throw new Error('corrupt Ogg'); return decoded } }

let recordings = await fresh()
await Promise.all([recordings.preloadMusic('arcade', 'menu'), recordings.preloadMusic('arcade', 'menu')])
assert.equal(decodes, 0, 'Speculative loading must never create or decode audio')
assert.deepEqual(requests.map(r => r.path), ['/audio/manifest.json', '/audio/song.ogg'])
assert.equal(requests[1].priority, 'low')
const [menu, main] = await Promise.all([recordings.music(ctx, 'arcade', 'menu'), recordings.music(ctx, 'arcade', 'main')])
assert.equal(menu.buffer, decoded)
assert.equal(main.buffer, menu.buffer)
assert.equal(decodes, 1, 'Shared menu/game music is decoded once')
await recordings.preloadMusic('arcade', 'menu')
assert.equal(requests.length, 2, 'Playback reuses the preloaded bytes; no MP3/results download')

requests = []; supported = false; recordings = await fresh()
await recordings.preloadMusic('arcade', 'menu')
await recordings.music(ctx, 'arcade', 'menu')
assert.deepEqual(requests.map(r => r.path), ['/audio/manifest.json', '/audio/song.mp3'], 'Unsupported Ogg must not waste a download')

requests = []; supported = true; corrupt = true; recordings = await fresh()
assert.equal((await recordings.music(ctx, 'arcade', 'menu')).buffer, decoded)
assert.deepEqual(requests.map(r => r.path), ['/audio/manifest.json', '/audio/song.ogg', '/audio/song.mp3'], 'Corrupt supported audio tries the alternate codec')

requests = []; corrupt = false; fail = true; recordings = await fresh()
await recordings.preloadMusic('arcade', 'menu')
fail = false
assert.equal((await recordings.music(ctx, 'arcade', 'menu')).buffer, decoded, 'Failed preload must be retried during playback')
assert.equal(requests.filter(r => r.path === '/audio/song.ogg').length, 2)

manifest.themes.arcade.music.menu = { sources: ['https://example.com/track.ogg', '/audio/../private.ogg'] }
requests = []; recordings = await fresh()
await recordings.preloadMusic('arcade', 'menu')
assert.equal(await recordings.music(ctx, 'arcade', 'menu'), null)
assert.deepEqual(requests.map(r => r.path), ['/audio/manifest.json'], 'Only bundled audio may be loaded')
console.log('Audio loading passed: lazy warmup, shared downloads/decoding, codec selection, fallback, retries and local-only sources.')
