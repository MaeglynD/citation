import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
async function moduleAt(path) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  return import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'))
}
const { buildDeck, buildOptions } = await moduleAt('src/game/deck.ts')
const quotes = JSON.parse(fs.readFileSync('src/data/quotes.json', 'utf8'))
for (let i = 0; i < 500; i++) {
  const deck = buildDeck(quotes, new Set())
  assert.equal(deck.length, 10)
  assert.equal(new Set(deck.map(q => q.id)).size, 10)
  assert.equal(new Set(deck.map(q => q.answer.name)).size, 10)
  for (const q of deck) {
    const options = buildOptions(q)
    assert.equal(options.length, 4)
    assert.equal(options.filter(o => o.correct).length, 1)
    assert.equal(options.find(o => o.correct).person.name, q.answer.name)
  }
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
console.log('Passed 500 deck simulations, answer integrity, unseen priority, exhausted and small-pool cases.')
console.log('History passed: per-game upserts, completion, legacy migration, validation, ordering, bounds and blocked storage.')
