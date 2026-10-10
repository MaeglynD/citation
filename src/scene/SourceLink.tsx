/** A transparent GPU hit target over a citation. Never advance the game on a source click. */
export function SourceLink({ url, x, y, w, h }: { url: string; x: number; y: number; w: number; h: number }) {
  if (!/^https?:\/\//.test(url)) return null
  return <mesh position={[x, y, 3]}
    onClick={e => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer') }}
    onPointerOver={e => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { document.body.style.cursor = 'default' }}>
    <planeGeometry args={[w, Math.max(18, h)]} />
    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
  </mesh>
}
