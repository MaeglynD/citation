import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame, FRAME_MAX_W, FRAME_MAX_H } from '../game/store'
import { useSettings, MAX_CSS_PX } from '../game/settings'
import { currentTheme } from '../themes'

/**
 * Renders the whole scene into a tiny render target (one texel = one "virtual pixel"),
 * then blits it to the screen with nearest-neighbour sampling. This is what makes
 * everything pixel art: text, boxes, particles, all of it.
 *
 * The blit shader also owns screen shake and a dithered vignette, both computed in
 * virtual-pixel space so they look like part of the pixel art rather than a smooth overlay.
 */
export function PixelPipeline() {
  const { gl, size } = useThree()
  const view = useGame((s) => s.view)
  const setView = useGame((s) => s.setView)

  const sizeSetting = useSettings((st) => st.size)

  // Derive the virtual resolution from the drawing-buffer size.
  useEffect(() => {
    const dpr = gl.getPixelRatio()
    const bufW = Math.round(size.width * dpr)
    const bufH = Math.round(size.height * dpr)
    const portrait = bufW / bufH < 1.2
    // Aim for ~360 virtual pixels along the shorter axis (classic 640x360 on a 1080p screen)...
    const target = portrait ? 400 : 360
    let scale = Math.max(1, Math.round(Math.min(bufW, bufH) / target))
    // ...but never let one virtual pixel get bigger than the size setting allows, so on a big
    // monitor the game stays a comfortable size instead of filling the whole screen.
    const cap = Math.max(1, Math.floor(MAX_CSS_PX[sizeSetting] * dpr + 1e-6))
    scale = Math.min(scale, cap, bufW / 320, bufH / (portrait ? 600 : 360))
    // Even sizes keep the pixel grid aligned to integer world coordinates.
    const w = Math.max(2, 2 * Math.round(bufW / scale / 2))
    const h = Math.max(2, 2 * Math.round(bufH / scale / 2))
    const fw = portrait ? Math.min(w, 400) : Math.min(w, FRAME_MAX_W)
    const fh = portrait ? Math.min(h, 700) : Math.min(h, FRAME_MAX_H)
    setView({ w, h, fw, fh, scale, portrait })
  }, [gl, size.width, size.height, setView, sizeSetting])

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(view.w, view.h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
    })
    rt.texture.colorSpace = THREE.NoColorSpace
    return rt
  }, [view.w, view.h])
  useEffect(() => () => target.dispose(), [target])

  const blit = useMemo(() => {
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geo = new THREE.BufferGeometry()
    // One big triangle covering the clip space.
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uShake: { value: new THREE.Vector2(0, 0) },
        uFlash: { value: 0 },
        uWipe: { value: 0 },
        uWipeColor: { value: new THREE.Color('#1d2b53') },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uTex;
        uniform vec2 uRes;
        uniform vec2 uShake;
        uniform float uFlash;
        uniform float uWipe;
        uniform vec3 uWipeColor;
        uniform float uTime;
        varying vec2 vUv;

        // 4x4 Bayer matrix for ordered dithering.
        float bayer(vec2 p) {
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          float m[16];
          m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
          m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
          m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
          m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
          for (int k = 0; k < 16; k++) { if (k == i) return (m[k] + 0.5) / 16.0; }
          return 0.5;
        }

        void main() {
          // Work in virtual pixel space so shake snaps to whole pixels.
          vec2 px = floor(vUv * uRes) + 0.5 + uShake;
          vec2 uv = px / uRes;
          vec3 c = texture2D(uTex, uv).rgb;
          // Outside the shaken frame: darken to the frame colour.
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) c = vec3(0.04, 0.05, 0.1);

          // Dithered vignette: two discrete darkness levels, Bayer-dithered.
          vec2 q = (px / uRes) - 0.5;
          float d = length(q * vec2(uRes.x / uRes.y, 1.0)) ;
          float vig = smoothstep(0.9, 1.25, d);
          float lvl = step(bayer(px), vig);
          c *= 1.0 - 0.08 * lvl;

          c = mix(c, vec3(1.0), uFlash);

          // Pixel-dissolve wipe: a Bayer-thresholded curtain that sweeps down, then lifts.
          if (uWipe > 0.0) {
            float sweep = px.y / uRes.y;           // 0 bottom .. 1 top
            float cover = uWipe < 0.5
              ? smoothstep(0.0, 1.0, uWipe * 2.0) * 1.6 - (1.0 - sweep) * 0.6
              : (1.0 - smoothstep(0.0, 1.0, (uWipe - 0.5) * 2.0)) * 1.6 - sweep * 0.6;
            if (bayer(px) < cover) c = uWipeColor;
          }
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    scene.add(mesh)
    return { scene, camera, mat }
  }, [])

  const bg = useMemo(() => new THREE.Color(), [])

  useFrame(({ gl, scene, camera, clock }) => {
    const fx = useGame.getState().fx
    // Decay screen shake / flash.
    const t = clock.getElapsedTime()
    let sx = 0
    let sy = 0
    if (fx.shakeUntil > t) {
      const k = (fx.shakeUntil - t) / fx.shakeDuration
      const amp = fx.shakeAmp * k
      const age = fx.shakeDuration * (1 - k)
      sx = Math.round(Math.sin(age * Math.PI * 32) * amp)
      sy = Math.round(Math.sin(age * Math.PI * 24) * amp * .35)
    }
    const flash = fx.flashUntil > t ? (fx.flashUntil - t) / fx.flashDuration : 0
    const wipeT = (t - fx.wipeAt) / fx.wipeDuration
    const wipe = wipeT > 0 && wipeT < 1 ? wipeT : 0

    gl.setRenderTarget(target)
    const pal = currentTheme().palette
    bg.set(pal.bg)
    gl.setClearColor(bg, 1)
    gl.clear(true, true, false)
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    blit.mat.uniforms.uTex.value = target.texture
    blit.mat.uniforms.uRes.value.set(target.width, target.height)
    blit.mat.uniforms.uShake.value.set(sx, sy)
    blit.mat.uniforms.uFlash.value = flash * 0.5
    blit.mat.uniforms.uWipe.value = wipe
    ;(blit.mat.uniforms.uWipeColor.value as THREE.Color).set(pal.bg2)
    blit.mat.uniforms.uTime.value = t
    gl.render(blit.scene, blit.camera)
  }, 1)

  return null
}
