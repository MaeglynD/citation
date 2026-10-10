/** Tracks how the player last pointed at something, so touch can use tap-to-preview. */
export const input = { lastPointer: 'mouse' as string }

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { input.lastPointer = e.pointerType || 'mouse' }, { capture: true })
}
