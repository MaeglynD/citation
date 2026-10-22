import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
async function moduleAt(path) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
}
const { buildDeck, buildOptions } = await moduleAt('src/game/deck.ts')
const quotes = JSON.parse(fs.readFileSync('src/data/quotes.json', 'utf8'))
const random = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const openingQuotes = new Set()
for (let i = 0; i < 500; i++) {
  const deck = buildDeck(quotes, new Set(), 10, random(i + 1))
  assert.equal(deck.length, 10)
  assert.equal(new Set(deck.map(q => q.id)).size, 10)
  assert.equal(new Set(deck.map(q => q.answer.name)).size, 10)
  assert(deck.every(q => q.priority === 2), 'Fresh games lead with the strongest collection')
  assert(deck.slice(0, 3).every(q => q.opener), 'The first three rounds use accessible openers')
  assert.equal(new Set(deck.slice(0, 3).map(q => q.tags[0])).size, 3, 'Opening themes vary')
  for (const q of deck) assert(deck.filter(other => other.tags[0] === q.tags[0]).length <= 3, 'No theme dominates a fresh game')
  openingQuotes.add(deck[0].id)
  for (const q of deck) {
    const options = buildOptions(q)
    assert.equal(options.length, 4)
    assert.equal(options.filter(o => o.correct).length, 1)
    assert.equal(options.find(o => o.correct).person.name, q.answer.name)
  }
}
assert(openingQuotes.size > 8, 'Fresh visits must not have a fixed opening script')
assert.deepEqual(buildDeck(quotes, new Set(), 10, random(42)), buildDeck(quotes, new Set(), 10, random(42)), 'Seeded selection is reproducible')

// Small, deliberately awkward pools separate editorial billing from freshness.
const fixture = (id, priority, theme = 'test', speaker = id, opener = false) => ({ ...quotes[0], id, priority, opener, tags: [theme], answer: { name: speaker } })
const rankedPool = [fixture('reserve', -1), fixture('ordinary'), fixture('featured', 1), fixture('headliner', 2)]
assert.deepEqual(buildDeck(rankedPool, new Set(), 4, random(42)).map(q => q.id), ['headliner', 'featured', 'ordinary', 'reserve'])
assert.deepEqual(buildDeck(rankedPool, new Set(['headliner', 'featured']), 4, random(42)).map(q => q.id), ['ordinary', 'reserve', 'headliner', 'featured'], 'Every unseen tier beats repeats; reserve follows ordinary material')
const topicPressure = [
  ...Array.from({ length: 10 }, (_, i) => fixture(`hit-${i}`, 2, 'same-topic')),
  ...Array.from({ length: 10 }, (_, i) => fixture(`filler-${i}`, 1, `other-${i}`)),
]
assert(buildDeck(topicPressure, new Set(), 10, random(42)).every(q => q.priority === 2), 'Topic variety must not promote weaker material over unseen headliners')
const speakerPressure = [fixture('best-a', 2, 'same', 'same'), fixture('best-b', 2, 'same', 'same'), fixture('weaker', 1), fixture('reserve', -1)]
assert(buildDeck(speakerPressure, new Set(), 2, random(42)).every(q => q.priority === 2), 'Speaker variety must not promote weaker material over unseen headliners')
const newQuoteIds = new Set(JSON.parse(fs.readFileSync('research/punchlines.json', 'utf8')).map(q => q.id))
const returning = new Set(quotes.filter(q => q.priority === 2 && !newQuoteIds.has(q.id)).map(q => q.id))
const returningDeck = buildDeck(quotes, returning, 10, random(42))
assert(returningDeck.every(q => newQuoteIds.has(q.id) && q.priority === 2), 'Existing players discover new headliners without a history reset')
assert.equal(returning.size, quotes.filter(q => q.priority === 2 && !newQuoteIds.has(q.id)).length, 'Building a deck preserves existing history')
for (const id of ['toon-burns-three-demons', 'sharp-superhans-people']) {
  assert.equal(quotes.find(q => q.id === id)?.priority, 2, 'Explicit user favourites remain headliners')
}
assert.equal(quotes.find(q => q.id === 'enc-britney-global-warming')?.priority, -1, 'The explicitly rejected Gaga non sequitur stays in reserve')
const lopsided = [fixture('fresh-a', undefined, 'same', 'same'), fixture('fresh-b', undefined, 'same', 'same'), fixture('seen-hit', 2, 'other', 'other', true)]
assert.deepEqual(buildDeck(lopsided, new Set(['seen-hit']), 3, random(42)).slice(0, 2).map(q => q.id).sort(), ['fresh-a', 'fresh-b'], 'Use every unseen quote before repeating, even if it means repeating a speaker')
assert.equal(buildDeck(lopsided, new Set(), 1, random(42))[0].id, 'seen-hit', 'One-round decks honour the opener')
assert.deepEqual(buildDeck(quotes, new Set(), 0), [])
const openingHistory = new Set()
for (let game = 0; game < 5; game++) {
  const deck = buildDeck(quotes, openingHistory, 10, random(game + 700))
  assert(deck.every(q => !openingHistory.has(q.id) && q.priority === 2), 'The first five games contain only fresh headliners')
  deck.forEach(q => openingHistory.add(q.id))
}
const first = buildDeck(quotes, new Set())
const seen = new Set(first.map(q => q.id))
assert(buildDeck(quotes, seen).every(q => !seen.has(q.id)))
const nearlySeen = new Set(quotes.slice(1).map(q => q.id))
assert(buildDeck(quotes, nearlySeen).some(q => q.id === quotes[0].id), 'Do not discard the final unseen quote')
assert.equal(nearlySeen.size, quotes.length - 1, 'Top-ups must preserve history')
assert.equal(buildDeck(quotes.slice(0, 3), new Set()).length, 3)
assert.deepEqual(buildDeck([], new Set()), [])
const sameSpeaker = quotes.slice(0, 12).map(q => ({ ...q, answer: { name: 'Same speaker' } }))
assert.equal(buildDeck(sameSpeaker, new Set()).length, 10)
const exhausted = new Set(quotes.map(q => q.id))
assert.equal(buildDeck(quotes, exhausted).length, 10)
assert.equal(exhausted.size, 0)
const marathonSeen = new Set()
while (marathonSeen.size < quotes.length) {
  const remaining = quotes.length - marathonSeen.size
  const deck = buildDeck(quotes, marathonSeen, Math.min(10, remaining), random(marathonSeen.size + 91))
  assert.equal(deck.length, Math.min(10, remaining))
  for (const q of deck) {
    assert(!marathonSeen.has(q.id), 'No quote repeats before the collection is exhausted')
    marathonSeen.add(q.id)
  }
}
const { loadHistory, recordAnswer, HISTORY_LIMIT } = await moduleAt('src/game/history.ts')
let stored = null
globalThis.localStorage = {getItem:()=>stored,setItem:(_key,value)=>{stored=value}}
assert.deepEqual(loadHistory(), [])
stored = '{invalid'
assert.deepEqual(loadHistory(), [])
stored = JSON.stringify([{quoteId:'bad'},null,{quoteId:'one',picked:'Person',correct:true,at:1}])
assert.equal(loadHistory().length,1)
let records=[]
for(let i=0;i<205;i++) records=recordAnswer(records,{quoteId:String(i),picked:'Person',correct:!!(i%2),at:i})
assert.equal(records.length,HISTORY_LIMIT)
assert.equal(loadHistory()[0].quoteId,'204')
globalThis.localStorage.setItem=()=>{throw new Error('storage blocked')}
assert.equal(recordAnswer(records,{quoteId:'latest',picked:'Person',correct:true,at:999})[0].quoteId,'latest')

const {loadGames,recordGame,GAME_LIMIT}=await moduleAt('src/game/history.ts')
const storage=new Map()
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)}
storage.set('citation-needed.history',JSON.stringify([
 {quoteId:'newer',picked:'B',correct:true,at:200},
 {quoteId:'older',picked:'A',correct:false,at:100},
]))
const legacy=loadGames()
assert.equal(legacy.length,1)
assert.equal(legacy[0].legacy,true,'Old answers must not become invented games')
assert.deepEqual(legacy[0].answers.map(a=>a.quoteId),['older','newer'])
assert.equal(loadGames().length,1,'Migration is idempotent')
const answer={quoteId:'quote',picked:'Person',correct:true,at:400}
let games=recordGame(legacy,{id:'game1',startedAt:300,completedAt:null,total:2,answers:[answer]})
games=recordGame(games,{...games[0],completedAt:500,answers:[answer,{...answer,quoteId:'quote2',at:500}]})
assert.equal(games.length,2,'Saving a second answer updates the same game')
assert.equal(loadGames()[0].answers.length,2)
assert.equal(loadGames()[0].completedAt,500)
for(let i=0;i<55;i++) games=recordGame(games,{id:'run'+i,startedAt:600+i,completedAt:700+i,total:1,answers:[answer]})
assert.equal(games.length,GAME_LIMIT)
assert.equal(loadGames()[0].id,'run54')
storage.set('citation-needed.games',JSON.stringify({version:1,games:[null,{id:'bad'},games[0],games[0]]}))
assert.equal(loadGames().length,1,'Invalid and duplicate records are discarded')
globalThis.localStorage.setItem=()=>{throw new Error('storage blocked')}
assert.equal(recordGame([],games[0]).length,1,'Session history works when storage is blocked')
globalThis.localStorage.getItem=()=>{throw new Error('storage blocked')}
assert.deepEqual(loadGames(),[])
delete globalThis.localStorage
await import('./validate-quotes.mjs')
console.log('Passed 500 seeded deck simulations, opener variety, strict tiers under topic/speaker pressure, reserve ordering, returning-player discovery, explicit taste feedback, five fresh headliner games, and a full collection without repeats.')
console.log('History passed: per-game upserts, completion, legacy migration, validation, ordering, bounds and blocked storage.')
