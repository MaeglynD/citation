import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { PixelPipeline } from './scene/PixelPipeline'
import { Stage } from './scene/Stage'
import { FontTest } from './scene/FontTest'
import { useGame } from './game/store'
import { useSettings } from './game/settings'
import { audio } from './audio/engine'
import { recordings, type MusicScene } from './audio/recordings'
import './game/input'
import { BG } from './scene/palette'
import quotes from './data/quotes.json'
import type { Quote } from './game/types'
import { themeById } from './themes/palettes'

// Development-only handles for the browser regression suite; never shipped.
if (import.meta.env.DEV) (window as any).__qa = { game: useGame, settings: useSettings }

function CameraRig() {
  const view = useGame((s) => s.view)
  return (
    <OrthographicCamera
      makeDefault
      manual
      left={-view.w / 2}
      right={view.w / 2}
      top={view.h / 2}
      bottom={-view.h / 2}
      near={0.1}
      far={1000}
      position={[0, 0, 100]}
    />
  )
}

function Clock() {
  const setClock = useGame((s) => s.setClock)
  useFrame(({ clock }) => setClock(clock.getElapsedTime()))
  return null
}

function Input() {
  const { gl } = useThree()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (useSettings.getState().open) return // the settings panel has its own keys
      const s = useGame.getState()
      if (e.key === 'Tab' && s.phase === 'question') { e.preventDefault(); s.hoverMove(e.shiftKey ? -1 : 1); return }
      if (e.key === 'Escape' && s.screen === 'history') { e.preventDefault(); if (s.reviewGameId) useGame.setState({reviewGameId: null}); else s.menu(); return }
      if (e.key === 'h' || e.key === 'H') { if (s.phase === 'title') s.showHistory(); return }
      if (e.key === 'Home') { e.preventDefault(); s.menu(); return }
      if (e.key === 'Escape' || e.key === 's' || e.key === 'S') { e.preventDefault(); e.stopImmediatePropagation(); useSettings.getState().setOpen(true); audio.resume(); return }
      if (e.key >= '1' && e.key <= '4') {
        if (s.phase === 'question') s.pick(Number(e.key) - 1)
        return
      }
      if (s.phase === 'question') {
        const step = { ArrowDown: 2, ArrowRight: 1, ArrowUp: -2, ArrowLeft: -1 }[e.key]
        if (step) { e.preventDefault(); s.hoverMove(step); return }
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (s.phase === 'title') s.resume()
        else if (s.phase === 'reveal') s.next()
        else if (s.phase === 'summary') s.restart()
        else if (s.phase === 'question' && !s.typedDone) s.finishTyping()
        else if (s.phase === 'question' && s.hovered !== null) s.pick(s.hovered)
      }
      if (e.key === 'm' || e.key === 'M') s.toggleMute()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    gl.domElement.style.cursor = 'default'
    gl.domElement.tabIndex = 0
    gl.domElement.setAttribute('role', 'application')
    const describe = () => {
      const s = useGame.getState()
      const q = s.deck[s.round]
      const settings = useSettings.getState()
      const label = settings.open ? `Settings. ${themeById(settings.theme).name} palette. Volume ${settings.muted ? 'muted' : settings.volume}. Size ${settings.size}. Tab chooses palette, volume, size or Done. Left and right change the selection. Escape closes settings.`
        : s.phase === 'title' ? 'Citation Needed. Who said that, then? Press Enter to start. S opens settings. M mutes.'
        : s.phase === 'question' && q ? `Question ${s.round + 1} of ${s.deck.length}. ${q.quote}. ${s.options.map((o, i) => `${i + 1}: ${o.person.alias || o.person.name}`).join('. ')}. Space reveals the full quote. Use 1 to 4 to answer, or Tab then Enter.`
        : s.phase === 'reveal' && q ? `${s.results[s.results.length - 1] === 'right' ? 'Correct' : 'Incorrect'}. ${q.answer.name}. ${q.source}. ${q.note ?? ''}. Press Enter to continue.`
        : s.phase === 'summary' ? `Final score ${s.score} of ${s.deck.length}. Left and right arrows browse answers. Enter plays again.`
        : s.phase === 'history' ? `Game history. ${s.games.filter(g => !g.legacy).length} games. Arrows browse and Enter opens a game. Escape goes back.` : 'Checking your answer.'
      gl.domElement.setAttribute('aria-label', label)
    }
    describe()
    const game = useGame.subscribe((s, previous) => { if (s.phase !== previous.phase || s.round !== previous.round) describe() })
    const settings = useSettings.subscribe(describe)
    return () => { game(); settings() }
  }, [gl])
  return null
}

export function App() {
  useEffect(() => {
    useGame.setState({ all: quotes as unknown as Quote[] })
    let warmTimer: number | undefined
    const musicScene = (): MusicScene => useGame.getState().screen === 'play' ? 'main' : useGame.getState().screen === 'summary' ? 'results' : 'menu'
    const warmMusic = () => {
      window.clearTimeout(warmTimer)
      // Let the scene and fonts load first. Respect mute and metered connections.
      warmTimer = window.setTimeout(() => {
        const st = useSettings.getState()
        const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
        if (document.hidden || st.muted || st.volume === 0 || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '')) return
        void recordings.preloadMusic('arcade', musicScene())
      }, 1200)
    }
    // keep the audio engine in step with the saved settings
    // Colour palettes never restart or replace the imported soundtrack.
    const sync = () => { const st = useSettings.getState(); audio.configure({ theme: 'arcade', volume: st.volume, muted: st.muted }); warmMusic() }
    sync()
    const unlock = () => {
      audio.resume(); audio.startMusic()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    const scrollTop = () => document.getElementById('root')?.scrollTo(0, 0)
    const settings = useSettings.subscribe((s, prev) => { sync(); if (s.open && !prev.open) scrollTop() })
    const scene = () => { audio.setScene(musicScene()); warmMusic() }
    scene()
    const game = useGame.subscribe((s, prev) => {
      if (s.screen !== prev.screen) scene()
      if (s.screen !== prev.screen || s.round !== prev.round) scrollTop()
    })
    return () => {
      window.clearTimeout(warmTimer)
      settings(); game()
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
  }, [])
  return (
    <Canvas
      dpr={[1, 2]}
      flat
      linear
      legacy
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) (window as any).__qa.scene = scene
        gl.setClearColor(BG, 1)
      }}
      style={{ background: BG, minHeight: 'var(--game-min-height)' }}
    >
      <CameraRig />
      <Clock />
      <Input />
      <PixelPipeline />
      {import.meta.env.DEV && new URLSearchParams(window.location.search).has('fonttest') ? <FontTest /> : <Stage />}
    </Canvas>
  )
}
