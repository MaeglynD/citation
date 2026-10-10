// Merge research/portraits/batch-*.json (and the calibration files as a fallback) into src/data/portraits.json,
// keeping only names that appear in src/data/people.json, and report who is still missing.
import fs from 'node:fs'
import path from 'node:path'

const dir = 'research/portraits'
const people = JSON.parse(fs.readFileSync('src/data/people.json', 'utf8')).map((p) => p.name)
const wanted = new Set(people)
const out = {}
const sources = {}
const files = fs.readdirSync(dir).filter((f) => /^(_calibration.*|batch-\d+|overrides)\.json$/.test(f))
// calibration first, then batches, then hand overrides last (later wins)
files.sort((a, b) => (a.startsWith('_') ? -1 : b.startsWith('_') ? 1 : a.startsWith('overrides') ? 1 : b.startsWith('overrides') ? -1 : a.localeCompare(b, undefined, { numeric: true })))
for (const f of files) {
  let obj
  try { obj = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) } catch (e) { console.log(`skip ${f}: ${e.message}`); continue }
  for (const [name, spec] of Object.entries(obj)) {
    if (name.startsWith('_')) continue
    if (!wanted.has(name)) continue
    out[name] = f.startsWith('overrides') && out[name] ? { ...out[name], ...spec } : spec
    sources[name] = f
  }
}
fs.writeFileSync('src/data/portraits.json', JSON.stringify(out) + '\n')
const missing = people.filter((n) => !out[n])
console.log(`portraits: ${Object.keys(out).length}/${people.length}  (missing ${missing.length})`)
if (process.argv.includes('--missing')) console.log(missing.join('\n'))
