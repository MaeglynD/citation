import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { usePalette } from '../themes'

/** Quiet pixel field, drawn at the same resolution as the cards and portraits. */
export function Backdrop() {
  const view = useGame(s => s.view), p = usePalette()
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { res: { value: new THREE.Vector2() }, time: { value: 0 },
      base: { value: new THREE.Color(p.bg) }, light: { value: new THREE.Color(p.bg2) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `precision highp float;
      uniform vec2 res; uniform float time; uniform vec3 base,light; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 px=floor(vUv*res), cell=floor(px/32.); vec2 dotpx=mod(px,32.);
        float glow=1.-smoothstep(.08,.72,length((vUv-.5)*vec2(1.,.8)));
        float dither=mod(px.x+px.y,2.);
        float level=floor((glow*.65+vUv.y*.35)*8.+dither*.3)/8.;
        vec3 c=mix(base,light,level*.8);
        float star=step(.88,hash(cell))*step(dotpx.x,1.)*step(dotpx.y,1.);
        c+=star*(.06+.025*sin(time*.7+hash(cell)*10.));
        gl_FragColor=vec4(c,1.);
      }`,
  }), [p])
  useEffect(() => () => mat.dispose(), [mat])
  mat.uniforms.res.value.set(view.w, view.h)
  useFrame(({ clock }) => { mat.uniforms.time.value = clock.getElapsedTime() })
  return <mesh position={[0, 0, -30]} material={mat} renderOrder={-30}><planeGeometry args={[view.w, view.h]} /></mesh>
}
