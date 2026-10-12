import assert from 'node:assert/strict'
import fs from 'node:fs'
const quotes = JSON.parse(fs.readFileSync('src/data/quotes.json', 'utf8'))
const portraits = JSON.parse(fs.readFileSync('src/data/portraits.json', 'utf8'))
const ids = new Set(), texts = new Set(), labels = new Map()
for (const q of quotes) {
  assert(q.id && !ids.has(q.id), 'Duplicate/missing id: ' + q.id); ids.add(q.id)
  assert(q.quote.length >= 15 && q.quote.length <= 260, 'Invalid quote length: ' + q.id)
  const text = q.quote.toLowerCase().replace(/[^a-z0-9]/g, '')
  assert(!texts.has(text), 'Duplicate quote: ' + q.id); texts.add(text)
  assert(q.source.trim() && /^https?:\/\//.test(q.url), 'Missing source: ' + q.id)
  assert(q.priority === undefined || [1, 2].includes(q.priority), 'Invalid editorial priority: ' + q.id)
  assert(q.opener === undefined || typeof q.opener === 'boolean', 'Invalid opener flag: ' + q.id)
  if (q.opener) assert(q.priority === 2 && q.quote.length <= 180, 'Opener must be a short headliner: ' + q.id)
  assert(q.tags.length && typeof q.tags[0] === 'string', 'Missing primary theme: ' + q.id)
  assert.equal(q.decoys.length, 3)
  const people = [q.answer, ...q.decoys]
  assert.equal(new Set(people.map(p => p.name)).size, 4, q.id)
  assert.equal(new Set(people.map(p => p.alias || p.name)).size, 4, 'Ambiguous labels: ' + q.id)
  for (const p of people) {
    assert(portraits[p.name], 'Missing portrait: ' + p.name)
    const label = p.alias || p.name
    if (labels.has(p.name)) assert.equal(labels.get(p.name), label, 'Inconsistent alias: ' + p.name)
    labels.set(p.name, label)
  }
}
assert(quotes.length >= 600, 'Unexpected content loss')
assert.equal(labels.get('Bob Ross'), 'Bob Ross')
console.log('Validated ' + quotes.length + ' quotes, source URLs, unique choices and ' + labels.size + ' portrait-backed people.')
