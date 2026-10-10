// Writes md/research/portraits/OPTIONS.md and research/portraits/todo-N.json batches of people to draw.
import fs from 'node:fs'
import { OPTIONS } from '../src/portraits/render.ts'

const people: { name: string; alias: string | null; fictional: boolean; asAnswer: number; asDecoy: number }[] = JSON.parse(fs.readFileSync('src/data/people.json', 'utf8'))
const quotes: any[] = JSON.parse(fs.readFileSync('src/data/quotes.json', 'utf8'))

// options reference
let md = '# Portrait spec options (generated from src/portraits/render.ts)\n\nAny colour field also accepts a hex string like "#c4502a". Unknown values fall back to defaults.\n\n'
for (const [k, v] of Object.entries(OPTIONS)) md += `- **${k}**: ${(v as string[]).join(', ')}\n`
fs.mkdirSync('md/research/portraits', { recursive: true })
fs.writeFileSync('md/research/portraits/OPTIONS.md', md)

// context per person: their theme and a hint of who they are
const ctx = new Map<string, { themes: Map<string, number>; hints: string[] }>()
const touch = (n: string) => { if (!ctx.has(n)) ctx.set(n, { themes: new Map(), hints: [] }); return ctx.get(n)! }
for (const q of quotes) {
  const theme = q.tags[0]
  const a = touch(q.answer.name)
  a.themes.set(theme, (a.themes.get(theme) ?? 0) + 3)
  if (a.hints.length < 2) a.hints.push(`said: "${q.quote.slice(0, 60)}" (${q.source})`)
  for (const d of q.decoys) { const c = touch(d.name); c.themes.set(theme, (c.themes.get(theme) ?? 0) + 1); if (c.hints.length < 1) c.hints.push(`decoy next to ${q.answer.name}`) }
}
const main = (n: string) => [...(ctx.get(n)?.themes ?? new Map()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'misc'

const fict = people.filter((p) => p.fictional)
const real = people.filter((p) => !p.fictional)
const groups: Record<string, string[]> = {
  A: ['politics'], B: ['villains', 'docs'], C: ['saints'], D: ['sports'], E: ['music'], F: ['arts', 'experts', 'tech'],
}
const batches: { name: string; people: typeof people }[] = []
batches.push({ name: 'fiction-1', people: fict.slice(0, Math.ceil(fict.length / 2)) })
batches.push({ name: 'fiction-2', people: fict.slice(Math.ceil(fict.length / 2)) })
const assigned = new Set<string>()
for (const [g, themes] of Object.entries(groups)) {
  const ps = real.filter((p) => themes.includes(main(p.name)))
  ps.forEach((p) => assigned.add(p.name))
  batches.push({ name: `real-${g}-${themes.join('+')}`, people: ps })
}
const rest = real.filter((p) => !assigned.has(p.name))
if (rest.length) batches[batches.length - 1].people.push(...rest)

batches.forEach((b, i) => {
  const rows = b.people.map((p) => ({ name: p.name, alias: p.alias, fictional: p.fictional, hint: ctx.get(p.name)?.hints.join(' | ') ?? '' }))
  fs.writeFileSync(`research/portraits/todo-${i + 1}.json`, JSON.stringify(rows, null, 1))
  console.log(`todo-${i + 1}.json  ${b.name}  ${rows.length}`)
})
