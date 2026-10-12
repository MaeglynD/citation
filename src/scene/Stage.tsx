import { Backdrop } from './Backdrop'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { Title } from './Title'
import { Play } from './Play'
import { Summary } from './Summary'
import { Bitmap, SPEAKER_OFF, SPEAKER_ON } from './Sprites'
import { useSettings } from '../game/settings'
import { usePalette } from '../themes'
import { GearButton, SettingsPanel } from './Settings'
import { History } from './History'
import { Action, Surface, Control } from './Surface'

/** Full-screen click catcher behind everything: advances / starts depending on phase. */
function ClickCatcher() {
  const view = useGame((s) => s.view)
  return (
    <mesh
      position={[0, 0, -20]}
      onClick={() => {
        if (useSettings.getState().open) return
        const s = useGame.getState()
        if (s.phase === 'reveal') s.next()
        else if (s.phase === 'question' && !s.typedDone) s.finishTyping()
      }}
    >
      <planeGeometry args={[view.w, view.h]} />
      <meshBasicMaterial color="#000000" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function MuteButton({ x, y, hitSize }: { x: number; y: number; hitSize: number }) {
  const pal = usePalette()
  const muted = useSettings((s) => s.muted)
  const toggle = useGame((s) => s.toggleMute)
  return (
    <Control x={x} y={y} w={hitSize} h={hitSize} z={5} onClick={toggle}>{hot => <>
      <Surface x={0} y={0} w={22} h={20} z={5} fill={pal.bg} stroke={hot ? pal.accent : pal.dim} />
      <Bitmap rows={muted ? SPEAKER_OFF : SPEAKER_ON} x={0} y={0} z={5.1} color={hot ? pal.accent : muted ? pal.dim : pal.muted} />
    </>}</Control>
  )
}

function Corner() {
  const view = useGame((s) => s.view)
  const screen = useGame(s => s.screen)
  const phone = view.portrait, hitSize = phone ? 44 : 28
  const x = view.fw / 2 - (phone ? 26 : 18)
  const y = view.fh / 2 - (phone ? 26 : 15)
  return (
    <group>
      <MuteButton x={x} y={y} hitSize={hitSize} />
      <GearButton x={x - (phone ? 48 : 28)} y={y} hitSize={hitSize} />
      {screen !== 'title' && <Action x={-view.fw / 2 + 33} y={y} w={48} h={phone ? 32 : 20} z={5} label="MENU" onClick={() => useGame.getState().menu()} />}
    </group>
  )
}

export function Stage() {
  const screen = useGame((s) => s.screen)
  return (
    <>
      <Backdrop />
      <ClickCatcher />
      {screen === 'title' && <Title />}
      {screen === 'play' && <Play />}
      {screen === 'summary' && <Summary />}
      {screen === 'history' && <History />}
      <Corner />
      <SettingsPanel />
    </>
  )
}

