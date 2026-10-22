# Development

[← Back to the README](../README.md)

## Project map

| Path | Purpose |
| :--- | :--- |
| `src/game/` | Game state, deck selection, saved games, preferences and text fitting |
| `src/scene/` | Pixel rendering pipeline, title, questions, results and settings |
| `src/portraits/` | Portrait renderer, lighting and texture cache |
| `src/audio/` | Synthesiser, scheduler, recorded music and fallback score |
| `src/data/` | Generated quotes and portrait data |
| `research/` | Source records, portrait specifications and editorial overrides |
| `public/` | Fonts, recordings and the social preview image |
| `scripts/` | Data generation, regression checks and audio tools |
| `md/` | Supporting documentation and README images |

## Rendering and interaction

The game renders into a low-resolution WebGL target before scaling it to the screen. The normal desktop frame is capped at 576 × 400 virtual pixels. Display-size settings cap the CSS size of each virtual pixel; narrow and short windows get an adapted frame.

Controls have stationary hit targets while their faces lift or depress. During typing, clicking an answer finishes the quote without submitting a guess. Touch uses a preview tap followed by an answer tap. A 950 ms suspense phase follows a selection; the reveal has a 1.5-second lock to prevent double taps from skipping it.

Windows/browser reduced-motion preferences do not disable the game's answer effects. This is intentional for this version. The game does not modify the system preference.

Settings retain saved values, including the color scheme. New players start with Midnight colors, audio enabled, the quietest audible volume and large display size. In Settings, Tab or up/down selects a control, left/right adjusts it, and Enter activates it. M toggles music only, +/− changes overall volume and D cycles display size. Zero volume silences everything; music mute leaves dialogue and effects audible. The four theme swatches are Midnight, Arcade, Ember and Parchment. T / Shift+T cycle through the same saved choices.

## Saved games

Preferences, best score, seen quotes and the latest 50 games are stored only in the player's browser. Each game records its start time, answers and completion. Older flat history is retained as “Earlier answers” because it has no game boundaries. Missing or blocked storage does not prevent play.

Menu or Home returns to the title screen. Continue restores an unfinished game during the current visit. Leaving during suspense cancels the pending answer. History lists dated games and their results; Escape goes back to the list, then the menu. Source citations open in a separate tab from both the final overview and saved-game results.

Local storage belongs to an origin. Records from localhost or the earlier hosted preview do not automatically transfer to `citation.party`.

## Quote data

The release contains 738 quotes across ten topics and 938 distinct answer/decoy identities, all with portraits. Recent research collections include `encore.json` (47 rounds), `afterparty.json` (31), `sharp-turns.json` (25), `punchlines.json` (17), and `readable.json` (7). These collections specify each record's primary `theme` explicitly.

Research records retain source URLs, verification notes and confidence ratings. `research/overrides.json` applies editorial corrections. Source links and translation flags remain in the shipped data. Fifteen records rated 3/5 are held out pending stronger verification; six duplicates are merged out. Automated checks validate the data and portrait coverage; they are not a fresh historical audit of every attribution.

```sh
npm run quotes:check
```

This regenerates game data and validates sources, unique answer choices, consistent aliases and portrait coverage. Keep aliases consistent whether a person is the correct answer or a decoy. Include a verifiable source when changing or adding a quote.

### Editorial selection

Before changing the shortlist, read the [October editorial notes](research/CURATION-2026-10-22.md).

`research/curation.json` assigns billing independently of the source records: `priority: 2` is a headliner (32 rounds), `priority: 1` is featured (60), unlisted records remain in the wider collection (610), and `priority: -1` is reserve (36). Only 12 headliners have `opener: true`. Every listed decision includes a required research-only `reason`. Judge the quote **and its four choices**: a complete setup and payoff in the displayed words, recognisable suspects, plausible misdirection, and a reveal that adds something. Length and a famous clip are not quality scores. Read the third-pass audit before promoting a demoted line again.

The player's latest clarification is about comedy surviving as text, not a preference for one genre. They liked both Nick Cave's insult and George Carlin's everyday driving observation, alongside Burns and Super Hans. Homer's lying line became intelligible to them only after hearing the original delivery; it and Reagan's deficit quip now sit in reserve. Do not rewrite an authentic quote into an invented punchline, assume all wordplay is unwelcome, or turn the shortlist into an insult-only set. Keep the setup, contrast and final qualification that make the actual words work. Neither newness nor a quota of games earns promotion.

Each game shuffles within tiers and starts with up to three unseen openers from different topics. Within each tier, it first seeks distinct speakers and at most three quotes from one topic, then relaxes those preferences before moving to a weaker tier. Variety cannot promote filler over a stronger unseen quote. Reserve follows all other unseen material, but fresh material always precedes repeats. History resets only when every quote has been seen. Existing players automatically receive new unseen headliners; there is no history migration or reset. Answer positions are shuffled separately.

To add a round, keep its exact sourced wording, three deliberately chosen decoys, a short source label and a useful reveal note. Preserve context when a speaker is joking, quoting someone, or telling a fabricated story; the Pattinson and Martha Stewart records are examples. Source and verification details live in research; source URLs ship with the game. Prefer primary transcripts, letters, recordings and original interviews, with contemporary reporting where those are unavailable. Curation validation rejects missing IDs, missing reasons, unknown fields, invalid tiers and openers over 180 characters. Reasons do not ship in the game payload.

Recent portrait specifications are in `research/portraits/batch-10.json` through `batch-14.json`. GLaDOS, agency signs and the AI search card have dedicated procedural renderers. Spiky and anime hair rise from the scalp contour; flat tops remain connected down to the hairline. Bart's zigzag silhouette is a continuous yellow head shape with a matching colour override. For a visual check:

```sh
node --experimental-strip-types scripts/portrait-sheet.mts research/portraits/batch-14.json shots/readable-portraits.png --frames
```

`npm test` includes 500 reproducible deck simulations, opener/theme variety, strict editorial ordering under topic and speaker pressure, reserve ordering, returning-player discovery with fewer than ten new headliners, explicit taste feedback, freshness over ranking, small and lopsided pools, exhaustion of the actual headliner pool (including its final partial game), and a complete run through the collection without repeats. It deliberately does not require a minimum number of headliner games.

## Audio

`Attribution Chaos` supplies a 62.96-second loop shared by the menu and gameplay. `Quiz Groove` supplies the 36.91-second results loop. Correct, wrong and completion cues last 1.368, 1.344 and 3.135 seconds. Edits preserve the original tempo and use short fades and balanced levels.

Ogg and MP3 alternatives live in `public/audio/suno/`, selected by `public/audio/manifest.json`. Missing recordings fall back to the synthesised score and effects. `public/audio/credits.json` records source filenames, hashes, edit boundaries and measurements. Original WAV files are not required to build or play the game.

To regenerate the edited audio, install Python with NumPy and SciPy, plus ffmpeg, then run:

```sh
python scripts/prepare-suno-audio.py <directory-containing-the-original-WAVs>
```

Browsers require a click, tap or keypress to unlock audio; hovering alone does not. Music ducks under dialogue and verdict cues, pauses in hidden tabs, and preserves its phrase when moving between the menu and questions. Dialogue uses an original grainy nonsense voice with a distinct timbre per quote.

The current scene's music starts a low-priority compressed download after a 1.2-second startup delay. This creates no audio context or playback, and is skipped for mute, zero volume, hidden tabs, Data Saver and 2G connections. Playback shares that request and decodes the track once; menu and gameplay share one buffer. The results track stays lazy. Unsupported codecs are skipped before downloading, and a failed speculative request can be retried during playback. UI sounds are synthesized locally and the three recorded verdict cues are small, separately loaded files.

## Branding and loading

The favicon uses the game's cream speech bubble and pink question mark. The README wordmark uses Dr. Evil's actual portrait, the default theme's palette, the game's question-mark sprite, and Press Start 2P outlines, so GitHub needs no external font. Its card and speech bubble follow the home-screen styling. Its gameplay screenshot is supplied by the project owner.

`python scripts/prepare-branding.py` (Python with `fontTools`, plus Node and the installed npm dependencies) regenerates the wordmark and the two production WOFF fonts. Add `--logo-only` to refresh just the README artwork. WOFF compression preserves every glyph; the original TTFs and license notices remain in `public/fonts/`. Troika supports WOFF, but not WOFF2.

The HTML preloads the production fonts. Vite gives them and the JavaScript chunks content hashes; `public/_headers` lets browsers cache these immutable assets for a year. Editable HTML and the audio manifest/recordings revalidate, preventing stale releases. Portrait textures are generated locally on demand, so the cast does not require hundreds of image downloads. The two music tracks and three recorded cues use about 2.02 MB in Ogg format altogether; the menu/gameplay loop is about 1.25 MB. MP3 alternatives are downloaded only when needed.

## Verification

Start with:

```sh
npm test
npm run build
```

For browser checks, install Chromium once, then start the dev server in another terminal:

```sh
npx playwright install chromium
npm run dev
```

Run the checks relevant to the change:

```sh
npm run test:browser
node scripts/test-layout.mjs
node scripts/test-saved-games.mjs
node scripts/test-typing-hover.mjs
node scripts/test-suno-motion.mjs
node scripts/test-dialogue.mjs
node scripts/test-recordings.mjs
npm run test:audio
```

These default to `http://127.0.0.1:5173/`; a script accepts a different URL as its first argument. The browser suite plays ten rounds and checks scoring, input, settings, history and responsive layouts. Focused suites cover saved-game links, typing interactions, actual audio recordings, codec fallback and reduced-motion effects. Audio QA renders the composed score with `OfflineAudioContext` and measures clipping and levels.

Screenshots and generated audio go to ignored `shots/`. Tests use Chromium, including emulated touch, rather than physical-device coverage. Development-only state inspection, cheat and audio-rendering hooks are excluded from production behavior.
