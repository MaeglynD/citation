import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const url = process.argv[2] ?? 'http://127.0.0.1:5173/'
fs.mkdirSync('shots/release', { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errors = []
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await context.newPage()
if (!process.argv.includes('--touch-only')) {
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.__qa?.game.getState().all.length > 600)
await page.evaluate(async () => {
  const { layout } = await import('/src/scene/Play.tsx')
  window.qa = { ...window.__qa, layout }
})
await page.waitForFunction(() => window.qa.game.getState().all.length > 600)
await page.waitForTimeout(1600)
await page.screenshot({ path: 'shots/release/title.png' })
await page.keyboard.press('Enter')
await page.waitForFunction(() => window.qa.game.getState().phase === 'question')
await page.keyboard.press('Space')
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(300)
assert.equal(await page.evaluate(() => window.qa.game.getState().hovered), 0)
await page.screenshot({ path: 'shots/release/desktop-question.png' })
let expectedScore = 0
for (let i = 0; i < 10; i++) {
  await page.waitForFunction(() => window.qa.game.getState().phase === 'question')
  if (!await page.evaluate(() => window.qa.game.getState().typedDone)) await page.keyboard.press('Space')
  const key = await page.evaluate(i => {
    const s = window.qa.game.getState()
    return String(s.options.findIndex(o => o.correct === (i % 2 === 0)) + 1)
  }, i)
  if (i % 2 === 0) expectedScore++
  await page.keyboard.press(key)
  await page.keyboard.press(key)
  await page.waitForFunction(() => window.qa.game.getState().phase === 'reveal')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => window.qa.game.getState().phase), 'reveal', 'Double-tap cooldown')
  if (i === 0) {
    await page.keyboard.press('s')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => window.qa.game.getState().round), 0, 'Settings must block gameplay')
    await page.keyboard.press('Escape')
  }
  await page.waitForFunction(() => performance.now() - window.qa.game.getState().phaseAt >= 1550)
  if (i === 1) await page.screenshot({ path: 'shots/release/desktop-reveal.png' })
  await page.keyboard.press('Enter')
}
await page.waitForFunction(() => window.qa.game.getState().phase === 'summary')
assert.equal(await page.evaluate(() => window.qa.game.getState().score), expectedScore)
assert.equal(await page.evaluate(() => window.qa.game.getState().picks.length), 10)
assert.deepEqual(await page.evaluate(() => {const g=window.qa.game.getState().games;return {games:g.length,answers:g[0].answers.length,complete:!!g[0].completedAt,score:g[0].answers.filter(a=>a.correct).length}}), {games:1,answers:10,complete:true,score:5})
await page.waitForTimeout(1000)
await page.screenshot({ path: 'shots/release/desktop-summary.png' })
await page.keyboard.press('ArrowRight')
await page.keyboard.press('s')
await page.keyboard.press('ArrowRight')
await page.keyboard.press('Enter')
await page.waitForTimeout(1600)
assert.equal(await page.evaluate(() => window.qa.settings.getState().volume), 2)
assert.equal(await page.evaluate(() => window.qa.settings.getState().theme), 'arcade')
await page.screenshot({ path: 'shots/release/settings.png' })
await page.keyboard.press('Escape')
const savedDeck = await page.evaluate(() => window.qa.game.getState().deck)
console.log('Full 10-round game: score, picks, cooldown and settings isolation passed.')

await page.keyboard.press('Home')
assert.equal(await page.evaluate(() => window.qa.game.getState().phase), 'title')
await page.keyboard.press('h')
assert.equal(await page.evaluate(() => window.qa.game.getState().phase), 'history')
assert.equal(await page.evaluate(() => window.qa.game.getState().history.length), 10)
await page.waitForTimeout(600)
await page.screenshot({ path: 'shots/release/history.png' })
await page.reload()
await page.waitForFunction(() => window.__qa?.game.getState().all.length > 600)
await page.waitForFunction(() => document.querySelector('canvas')?.getAttribute('role') === 'application')
assert.equal(await page.evaluate(() => window.__qa.game.getState().history.length), 10, 'History persists across reloads')
await page.evaluate(async () => { window.qa = {...window.__qa, layout:(await import('/src/scene/Play.tsx')).layout} })
await page.keyboard.press('Enter')
await page.waitForFunction(() => window.qa.game.getState().phase === 'question')
await page.keyboard.press('Space')
await page.keyboard.press('1')
await page.keyboard.press('Home')
await page.waitForTimeout(1100)
assert.equal(await page.evaluate(() => window.qa.game.getState().history.length), 10, 'Leaving suspense cancels unanswered verdict')
await page.keyboard.press('Enter')
assert.equal(await page.evaluate(() => window.qa.game.getState().phase), 'question')
await page.keyboard.press('1')
await page.waitForFunction(() => window.qa.game.getState().phase === 'reveal')
const preserved = await page.evaluate(() => ({id:window.qa.game.getState().deck[0].id,score:window.qa.game.getState().score}))
await page.keyboard.press('Home')
await page.keyboard.press('h')
await page.keyboard.press('Escape')
await page.keyboard.press('Enter')
assert.deepEqual(await page.evaluate(() => ({id:window.qa.game.getState().deck[0].id,score:window.qa.game.getState().score})), preserved)
assert.equal(await page.evaluate(() => window.qa.game.getState().phase), 'reveal', 'Continue restores the verdict without scoring twice')
console.log('Menu, history persistence, suspended answer cancellation and resume passed.')

// Stress real content at representative frame sizes, then photograph the longest record.
for (const [name, width, height] of [['laptop',1280,720], ['phone',390,844], ['small-phone',320,568], ['landscape',844,390], ['large',2560,1440]]) {
  await page.setViewportSize({ width, height })
  await page.waitForFunction(({width,height})=>{
    const v=window.qa.game.getState().view
    return Math.abs(v.w/v.h-width/height)<.01 && v.portrait===(width/height<1.2)
  },{width,height})
  const report = await page.evaluate(() => {
    const s = window.qa.game.getState()
    const failures = []
    for (const theme of ['arcade']) for (const q of s.all) {
      const L = window.qa.layout(s.view, q, theme)
      if (L.bh < 0 || L.bubbleTop > s.view.fh / 2 - 20 || L.optsBottom < -s.view.fh / 2) failures.push(q.id + ': frame')
      const textH = q.note ? L.noteTop - Math.ceil(q.note.length / (L.textW / 6.4)) * 16 : L.cardY - L.cardH/2
      if (textH < L.optsTop - 4) failures.push(theme + '/' + q.id + ': reveal')
    }
    return { view: s.view, failures }
  })
  console.log(name, JSON.stringify(report))
  assert.deepEqual(report.failures, [], name + ' must fit every quote')
  const worst = await page.evaluate(() => window.qa.game.getState().all.toSorted((a,b) => b.quote.length - a.quote.length)[0])
  await page.evaluate(q => {
    window.qa.settings.getState().update({ theme: 'arcade' })
    window.qa.game.setState({ screen: 'play', phase: 'reveal', phaseAt: performance.now() - 2000, deck: [q], round: 0,
      options: [{person:q.answer,correct:true}, ...q.decoys.map(person=>({person,correct:false}))], picked: 1, hovered: null, typedDone: true, results: ['wrong'], picks: [q.decoys[0].name] })
  }, worst)
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/release/' + name + '-long-reveal.png' })
  await page.evaluate(deck => {
    window.qa.game.setState({ screen:'summary', phase:'summary', phaseAt: performance.now() - 3000, deck, round:9, score:5,
      results: deck.map((q,i) => i % 2 ? 'right' : 'wrong'), picks: deck.map((q,i) => i % 2 ? q.answer.name : q.decoys[0].name) })
  }, [worst, ...savedDeck.slice(1)])
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'shots/release/' + name + '-summary.png' })
}
assert.deepEqual(errors, [], 'No browser errors')
}
// Touch uses real browser touch events, including the deliberate two-tap accusation.
const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const phone = await touch.newPage()
phone.on('pageerror', e => errors.push(e.message))
await phone.goto(url)
await phone.waitForFunction(() => window.__qa?.game.getState().all.length > 600)
await phone.waitForFunction(() => document.querySelector('canvas')?.getAttribute('role') === 'application')
await phone.waitForTimeout(1800)
const startAt = await phone.evaluate(() => { const v = window.__qa.game.getState().view; return {x:innerWidth / 2,y:(.5 + 100 / v.h) * innerHeight} })
await phone.touchscreen.tap(startAt.x, startAt.y)
await phone.waitForFunction(() => window.__qa.game.getState().phase === 'question')
await phone.waitForFunction(() => window.__qa.game.getState().typedDone)
const tapAt = await phone.evaluate(async () => {
  const { layout } = await import('/src/scene/Play.tsx')
  const s = window.__qa.game.getState(), L = layout(s.view, s.deck[s.round], window.__qa.settings.getState().theme), p = L.optPos(0)
  return { x: (p.x / s.view.w + .5) * innerWidth, y: (.5 - p.y / s.view.h) * innerHeight }
})
await phone.touchscreen.tap(tapAt.x, tapAt.y)
assert.equal(await phone.evaluate(() => window.__qa.game.getState().phase), 'question')
assert.equal(await phone.evaluate(() => window.__qa.game.getState().hovered), 0)
await phone.waitForTimeout(300)
await phone.screenshot({ path: 'shots/release/touch-preview.png' })
await phone.touchscreen.tap(tapAt.x, tapAt.y)
await phone.waitForFunction(() => window.__qa.game.getState().phase === 'reveal')
await phone.waitForTimeout(1650)
await phone.screenshot({ path: 'shots/release/touch-reveal.png' })
const sourceAt = await phone.evaluate(async () => {
  const { layout } = await import('/src/scene/Play.tsx')
  const s = window.__qa.game.getState(), L = layout(s.view, s.deck[s.round], window.__qa.settings.getState().theme)
  window.open = url => { window.lastSource = url; return null }
  return { x: ((L.textX + L.textW / 2) / s.view.w + .5) * innerWidth, y: (.5 - (L.srcTop - 8) / s.view.h) * innerHeight, expected: s.deck[s.round].url }
})
await phone.touchscreen.tap(sourceAt.x, sourceAt.y)
assert.equal(await phone.evaluate(() => window.lastSource), undefined, 'Live reveals must not open source tabs')
await phone.keyboard.press('s')
await phone.keyboard.press('ArrowRight')
await phone.keyboard.press('Enter')
await phone.waitForFunction(() => window.__qa.settings.getState().volume === 2)
await phone.evaluate(() => window.__qa.settings.getState().update({muted:true}))
await phone.reload()
await phone.waitForFunction(() => window.__qa?.settings.getState().theme === 'arcade')
assert.equal(await phone.evaluate(() => window.__qa.settings.getState().volume), 2)
assert.equal(await phone.evaluate(() => window.__qa.settings.getState().muted), true)
await touch.close()
assert.deepEqual(errors, [], 'No browser errors, including touch')
await browser.close()
console.log('Browser QA complete; screenshots in shots/release.')
