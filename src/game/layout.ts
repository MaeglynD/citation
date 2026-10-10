/** Deterministic wrapping shared by the GPU screens and their content-fit checks. */
export function wrapLines(text: string, cpl: number): number {
  cpl = Math.max(1, Math.floor(cpl))
  let lines = 1, col = 0
  for (const word of text.split(/\s+/)) {
    if (!col) col = word.length
    else if (col + 1 + word.length <= cpl) col += 1 + word.length
    else { lines++; col = word.length }
    while (col > cpl) { lines++; col -= cpl }
  }
  return lines
}

export function fitText(text: string, width: number, height: number) {
  const choices = [
    { font: 'press' as const, size: 16, advance: 16, lineHeight: 1.25 },
    { font: 'vt' as const, size: 24, advance: 9.6, lineHeight: 1 },
    { font: 'vt' as const, size: 20, advance: 8, lineHeight: 1 },
    { font: 'vt' as const, size: 16, advance: 6.4, lineHeight: 1 },
    { font: 'press' as const, size: 8, advance: 8, lineHeight: 1.5 },
  ]
  return choices.filter(c => c.font !== 'press' || c.size !== 16 || wrapLines(text, width / 16) <= 4)
    .map(c => ({ ...c, height: wrapLines(text, width / c.advance) * c.size * c.lineHeight }))
    .find(c => c.height <= height) ?? { ...choices[4], height: wrapLines(text, width / 8) * 12 }
}
