// Merges the verified research files in research/*.json into src/data/quotes.json.
// - validates every record
// - normalises people's names and applies aliases consistently (so an alias never
//   gives away the answer: a person shows the same label whether they're the answer or a decoy)
// - dedupes quotes
// - prints a report
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..')
const researchDir = path.join(root, 'research')
const outFile = path.join(root, 'src', 'data', 'quotes.json')
const peopleFile = path.join(root, 'src', 'data', 'people.json')

// Spelling variants -> canonical.
const CANON = new Map(Object.entries({
  'Mr. Rogers': 'Mister Rogers', 'Fred Rogers': 'Mister Rogers', 'Mr Rogers': 'Mister Rogers',
  'Dalai Lama': 'The Dalai Lama', 'the Dalai Lama': 'The Dalai Lama', '14th Dalai Lama': 'The Dalai Lama',
  'Gandhi': 'Mahatma Gandhi', 'Mohandas Gandhi': 'Mahatma Gandhi', 'Mohandas K. Gandhi': 'Mahatma Gandhi',
  'Hitler': 'Adolf Hitler', 'Stalin': 'Joseph Stalin', 'Josef Stalin': 'Joseph Stalin',
  'Mao': 'Mao Zedong', 'Chairman Mao': 'Mao Zedong', 'Mao Tse-tung': 'Mao Zedong',
  'Napoleon': 'Napoleon Bonaparte', 'Kim Jong-il': 'Kim Jong Il', 'Kim Jong-un': 'Kim Jong Un',
  'Muammar Qaddafi': 'Muammar Gaddafi', 'Colonel Gaddafi': 'Muammar Gaddafi',
  'Ted Kaczynski': 'Ted Kaczynski', 'The Unabomber': 'Ted Kaczynski',
  'Joker': 'The Joker', 'Lord Voldemort': 'Voldemort',
  'Mother Theresa': 'Mother Teresa', 'Teresa of Calcutta': 'Mother Teresa',
  'Winnie-the-Pooh': 'Winnie the Pooh', 'Pooh': 'Winnie the Pooh', 'Pooh Bear': 'Winnie the Pooh',
  'Kermit': 'Kermit the Frog', 'SpongeBob': 'SpongeBob SquarePants', 'Spongebob': 'SpongeBob SquarePants', 'Spongebob Squarepants': 'SpongeBob SquarePants',
  'Patrick': 'Patrick Star', 'Squidward Tentacles': 'Squidward', 'Homer': 'Homer Simpson', 'Lisa': 'Lisa Simpson', 'Bart': 'Bart Simpson',
  'Montgomery Burns': 'Mr. Burns', 'C. Montgomery Burns': 'Mr. Burns', 'Rick': 'Rick Sanchez', 'BoJack': 'BoJack Horseman',
  'Albus Dumbledore': 'Dumbledore', 'Professor Dumbledore': 'Dumbledore', 'Gandalf the Grey': 'Gandalf',
  'Bruce Wayne': 'Batman', 'Einstein': 'Albert Einstein', 'Newton': 'Isaac Newton', 'Sir Isaac Newton': 'Isaac Newton',
  'Tesla': 'Nikola Tesla', 'Feynman': 'Richard Feynman', 'Hawking': 'Stephen Hawking', 'Sagan': 'Carl Sagan', 'Darwin': 'Charles Darwin',
  'Musk': 'Elon Musk', 'Jobs': 'Steve Jobs', 'Gates': 'Bill Gates', 'Zuckerberg': 'Mark Zuckerberg', 'Bezos': 'Jeff Bezos',
  'Trump': 'Donald Trump', 'Donald J. Trump': 'Donald Trump', 'Biden': 'Joe Biden', 'Obama': 'Barack Obama', 'George Bush': 'George W. Bush',
  'Churchill': 'Winston Churchill', 'Lincoln': 'Abraham Lincoln', 'The Queen': 'Queen Elizabeth II', 'Elizabeth II': 'Queen Elizabeth II',
  'Prince Philip, Duke of Edinburgh': 'Prince Philip', 'Kanye': 'Kanye West', 'Ye': 'Kanye West', 'Beyonce': 'Beyoncé',
  'Snoop': 'Snoop Dogg', 'Ozzy': 'Ozzy Osbourne', 'Tyson': 'Mike Tyson', 'Ali': 'Muhammad Ali', 'Shaq': "Shaquille O'Neal", 'Shaquille O’Neal': "Shaquille O'Neal",
  'Zlatan': 'Zlatan Ibrahimović', 'Zlatan Ibrahimovic': 'Zlatan Ibrahimović', 'Arnold': 'Arnold Schwarzenegger', 'Randy Savage': 'Macho Man Randy Savage',
  'Dwayne Johnson': 'The Rock', 'Dwayne "The Rock" Johnson': 'The Rock', 'Hemingway': 'Ernest Hemingway', 'Wilde': 'Oscar Wilde', 'Twain': 'Mark Twain',
  'Nietzsche': 'Friedrich Nietzsche', 'Dali': 'Salvador Dalí', 'Salvador Dali': 'Salvador Dalí', 'Picasso': 'Pablo Picasso', 'Warhol': 'Andy Warhol',
  'Van Gogh': 'Vincent van Gogh', 'Vincent Van Gogh': 'Vincent van Gogh', 'William Shakespeare': 'Shakespeare', 'Dr Seuss': 'Dr. Seuss',
  'Vonnegut': 'Kurt Vonnegut', 'Zizek': 'Slavoj Žižek', 'Slavoj Zizek': 'Slavoj Žižek', 'Oprah': 'Oprah Winfrey', 'Bourdain': 'Anthony Bourdain',
  'Attenborough': 'David Attenborough', 'Sir David Attenborough': 'David Attenborough', 'Rogan': 'Joe Rogan',
  'Jesus Christ': 'Jesus', 'The Buddha': 'Buddha', 'Gautama Buddha': 'Buddha', 'Pope Francis I': 'Pope Francis',
  'MLK': 'Martin Luther King Jr.', 'Martin Luther King': 'Martin Luther King Jr.', 'Martin Luther King, Jr.': 'Martin Luther King Jr.', 'Dr. Martin Luther King Jr.': 'Martin Luther King Jr.',
  'Mandela': 'Nelson Mandela', 'Marcus Aurelius Antoninus': 'Marcus Aurelius', 'Bugs': 'Bugs Bunny', 'Yoda (Star Wars)': 'Yoda',
  'Ron Swanson (Parks and Recreation)': 'Ron Swanson', 'Dwight': 'Dwight Schrute', 'Michael Scott (The Office)': 'Michael Scott',
  'Tony Soprano (The Sopranos)': 'Tony Soprano', 'Walter White (Breaking Bad)': 'Walter White', 'Eeyore (Winnie the Pooh)': 'Eeyore',
  'Genghis Khan (Temüjin)': 'Genghis Khan', 'Temujin': 'Genghis Khan', 'Bin Laden': 'Osama bin Laden', 'Saddam': 'Saddam Hussein',
  'Putin': 'Vladimir Putin', 'Pol Pot (Saloth Sar)': 'Pol Pot', 'Capone': 'Al Capone', 'Escobar': 'Pablo Escobar', 'Vader': 'Darth Vader',
  'Dr. Hannibal Lecter': 'Hannibal Lecter', 'Lecter': 'Hannibal Lecter', 'Bob Ross (painter)': 'Bob Ross', 'Dolly': 'Dolly Parton',
  'Keanu': 'Keanu Reeves', 'Tom Hanks (actor)': 'Tom Hanks', 'Paris': 'Paris Hilton', 'Kim K': 'Kim Kardashian', 'Kim Kardashian West': 'Kim Kardashian',
  'Taylor': 'Taylor Swift', 'Gaga': 'Lady Gaga', 'Lil Wayne (Dwayne Carter)': 'Lil Wayne', 'Dylan': 'Bob Dylan', 'Keith': 'Keith Richards',
  'Yogi': 'Yogi Berra', 'Hulk': 'Hulk Hogan', 'Hogan': 'Hulk Hogan', 'Macho Man': 'Macho Man Randy Savage', 'Jaden': 'Jaden Smith',
  'Gwyneth': 'Gwyneth Paltrow', 'Ramsay': 'Gordon Ramsay', 'Steve Irwin (Crocodile Hunter)': 'Steve Irwin', 'Bear': 'Bear Grylls', 'Alex Jones (Infowars)': 'Alex Jones',
  'Peterson': 'Jordan Peterson', 'Jordan B. Peterson': 'Jordan Peterson', 'Bukowski': 'Charles Bukowski', 'Hunter Thompson': 'Hunter S. Thompson',
  'King': 'Stephen King', 'Dahl': 'Roald Dahl', 'Seuss': 'Dr. Seuss', 'Socrates (via Plato)': 'Socrates', 'Thanos (Marvel)': 'Thanos',
  'Mussolini': 'Benito Mussolini', 'Il Duce': 'Benito Mussolini', 'Amin': 'Idi Amin', 'Manson': 'Charles Manson', 'Bundy': 'Ted Bundy', 'Dahmer': 'Jeffrey Dahmer',
  'Curie': 'Marie Curie', 'Madame Curie': 'Marie Curie', 'Tyson (Neil)': 'Neil deGrasse Tyson', 'Neil DeGrasse Tyson': 'Neil deGrasse Tyson', 'Nye': 'Bill Nye',
  'Donkey (Shrek)': 'Donkey', 'Elmo (Sesame Street)': 'Elmo', 'Big Bird (Sesame Street)': 'Big Bird', 'Miss Piggy (The Muppets)': 'Miss Piggy',
  'Roger Rabbit (Who Framed Roger Rabbit)': 'Roger Rabbit', 'Shrek (Shrek)': 'Shrek', 'Mr Burns': 'Mr. Burns',
}))

function canon(name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ')
  return CANON.get(n) ?? n
}

function normQuote(s) {
  let t = String(s).trim().replace(/\s+/g, ' ')
  // Strip quotation marks only when they wrap the whole quote.
  if (/^["“]/.test(t) && /["”]$/.test(t)) t = t.slice(1, -1).trim()
  return t
    .replace(/\.\.\./g, '…')
    // Straight quotes -> typographic: an opening mark after start/space/bracket, a closing/apostrophe elsewhere.
    .replace(/(^|[\s(\[—–-])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s(\[—–-])"/g, '$1“')
    .replace(/"/g, '”')
}

// Editorial overrides: research/overrides.json maps id -> partial record (or null to drop the quote).
const overridesFile = path.join(researchDir, 'overrides.json')
const overrides = fs.existsSync(overridesFile) ? JSON.parse(fs.readFileSync(overridesFile, 'utf8')) : {}
const curation = JSON.parse(fs.readFileSync(path.join(researchDir, 'curation.json'), 'utf8'))

const files = fs.readdirSync(researchDir).filter((f) => f.endsWith('.json') && !['overrides.json', 'curation.json'].includes(f)).sort()
const all = []
const problems = []
for (const f of files) {
  let arr
  try {
    arr = JSON.parse(fs.readFileSync(path.join(researchDir, f), 'utf8'))
  } catch (e) {
    problems.push(`${f}: cannot parse (${e.message})`)
    continue
  }
  if (!Array.isArray(arr)) { problems.push(`${f}: not an array`); continue }
  for (let r of arr) {
    const where = `${f}#${r?.id ?? '?'}`
    if (!r || typeof r !== 'object') { problems.push(`${where}: not an object`); continue }
    if (r.id in overrides && r.id !== '__people') {
      if (overrides[r.id] === null) continue // dropped by editorial decision
      r = { ...r, ...overrides[r.id], answer: { ...r.answer, ...(overrides[r.id].answer ?? {}) } }
    }
    if (typeof r.quote !== 'string' || r.quote.trim().length < 15) { problems.push(`${where}: quote missing/short`); continue }
    if (!r.answer?.name) { problems.push(`${where}: answer missing`); continue }
    if (!Array.isArray(r.decoys) || r.decoys.length < 3) { problems.push(`${where}: needs 3 decoys`); continue }
    if ((r.confidence ?? 0) < 4) { problems.push(`${where}: held for further source verification`); continue }
    if (!r.source?.trim() || !/^https?:\/\//.test(r.url ?? '')) { problems.push(`${where}: missing provenance`); continue }
    const quote = normQuote(r.quote)
    if (quote.length > 260) { problems.push(`${where}: quote too long (${quote.length})`); continue }
    const answer = { name: canon(r.answer.name), alias: r.answer.alias ? String(r.answer.alias).trim() : null, fictional: !!r.answer.fictional }
    const decoys = r.decoys.slice(0, 3).map((d) => ({ name: canon(d.name), alias: d.alias ? String(d.alias).trim() : null, fictional: !!d.fictional }))
    const names = new Set([answer.name, ...decoys.map((d) => d.name)])
    if (names.size < 4) { problems.push(`${where}: duplicate person among options`); continue }
    all.push({
      id: String(r.id),
      quote,
      answer,
      decoys,
      source: String(r.source ?? '').trim().slice(0, 96),
      note: r.note ? String(r.note).trim().slice(0, 110) : undefined,
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [f.replace('.json', '')],
      theme: r.theme ?? f.replace('.json', ''),
      url: r.url,
      verification: r.verification,
      confidence: r.confidence,
      translated: !!r.translated,
    })
  }
}

// Dedupe by normalised quote text (first 60 chars) and by id.
const seenIds = new Set()
const seenText = new Set()
const deduped = []
for (const q of all) {
  const key = q.quote.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
  if (seenIds.has(q.id)) { problems.push(`${q.id}: duplicate id`); continue }
  if (seenText.has(key)) { problems.push(`${q.id}: duplicate quote text`); continue }
  seenIds.add(q.id)
  seenText.add(key)
  deduped.push(q)
}

// People table: canonical name -> alias and fictional flag. An alias given on an answer record wins
// over one given on a decoy record; research/overrides.json "__people" wins over both.
const people = new Map()
for (const q of deduped) {
  for (const [p, isAnswer] of [[q.answer, true], ...q.decoys.map((d) => [d, false])]) {
    const cur = people.get(p.name) ?? { name: p.name, alias: null, aliasFromAnswer: false, fictional: false, asAnswer: 0, asDecoy: 0 }
    if (p.alias && (!cur.alias || (isAnswer && !cur.aliasFromAnswer))) { cur.alias = p.alias; cur.aliasFromAnswer = isAnswer }
    cur.fictional = cur.fictional || p.fictional
    people.set(p.name, cur)
  }
  people.get(q.answer.name).asAnswer++
  for (const d of q.decoys) people.get(d.name).asDecoy++
}
for (const [name, patch] of Object.entries(overrides.__people ?? {})) {
  const rec = people.get(name)
  if (rec) Object.assign(rec, patch)
}
// Apply aliases consistently everywhere the person appears.
for (const q of deduped) {
  for (const p of [q.answer, ...q.decoys]) {
    const rec = people.get(p.name)
    p.alias = rec.alias
    p.fictional = rec.fictional
  }
}

// Output (strip research-only fields).
for (const [id, billing] of Object.entries(curation)) {
  const q = deduped.find(q => q.id === id)
  if (!q) throw new Error(`Curation refers to an absent quote: ${id}`)
  if (!billing || typeof billing !== 'object' || Object.keys(billing).some(key => !['priority', 'opener'].includes(key))) throw new Error(`Invalid curation fields: ${id}`)
  if (![1, 2].includes(billing.priority)) throw new Error(`Invalid priority: ${id}`)
  if (billing.opener !== undefined && typeof billing.opener !== 'boolean') throw new Error(`Invalid opener flag: ${id}`)
  if (billing.opener && (billing.priority !== 2 || q.quote.length > 180)) throw new Error(`Opener must be a short headliner: ${id}`)
}
const out = deduped.map(({ verification, confidence, theme, ...q }) => ({ ...q, ...curation[q.id], tags: [theme, ...q.tags.filter((t) => t !== theme)] }))
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(out, null, 0) + '\n')
fs.writeFileSync(peopleFile, JSON.stringify([...people.values()].map(({ aliasFromAnswer, ...p }) => p).sort((a, b) => b.asAnswer + b.asDecoy - (a.asAnswer + a.asDecoy)), null, 1) + '\n')

// Report.
const byTheme = {}
for (const q of deduped) byTheme[q.theme] = (byTheme[q.theme] ?? 0) + 1
console.log(`quotes: ${out.length}  (from ${all.length} records in ${files.length} files)`)
console.log('by theme:', byTheme)
console.log(`people: ${people.size}`)
const top = [...people.values()].sort((a, b) => b.asDecoy - a.asDecoy).slice(0, 12)
console.log('most used decoys:', top.map((p) => `${p.name} ${p.asDecoy}`).join(', '))
const lens = out.map((q) => q.quote.length)
console.log(`quote length: min ${Math.min(...lens)} max ${Math.max(...lens)} avg ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)}`)
const longNames = [...people.values()].map((p) => p.alias ?? p.name).filter((n) => n.length > 30)
if (longNames.length) console.log('long labels (>30 chars):', longNames.join(' | '))
// One line of meta text is 73 glyphs on a 640-wide stage; longer sources/notes wrap and steal bubble space.
const longSources = out.filter((q) => q.source.length > 71).map((q) => `${q.id} (${q.source.length})`)
if (longSources.length) console.log(`sources over one line (${longSources.length}):`, longSources.join(', '))
const longNotes = out.filter((q) => q.note && q.note.length > 73).map((q) => `${q.id} (${q.note.length})`)
if (longNotes.length) console.log(`notes over one line (${longNotes.length}):`, longNotes.join(', '))
if (problems.length) {
  console.log(`\n${problems.length} problems:`)
  for (const p of problems) console.log(' -', p)
}
