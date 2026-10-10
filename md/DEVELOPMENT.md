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

Settings retain saved values. New players start with audio enabled, the quietest audible volume and large display size. In Settings, Tab or up/down selects a control, left/right adjusts it, and Enter activates it. M toggles mute, +/− changes volume and D cycles display size.

## Saved games

Preferences, best score, seen quotes and the latest 50 games are stored only in the player's browser. Each game records its start time, answers and completion. Older flat history is retained as “Earlier answers” because it has no game boundaries. Missing or blocked storage does not prevent play.

Menu or Home returns to the title screen. Continue restores an unfinished game during the current visit. Leaving during suspense cancels the pending answer. History lists dated games and their results; Escape goes back to the list, then the menu. Source citations open in a separate tab from both the final overview and saved-game results.

Local storage belongs to an origin. Records from localhost or the earlier hosted preview do not automatically transfer to `citation.party`.

## Quote data

The release contains 611 quotes from ten topic collections and 853 distinct answer/decoy identities. Each has a portrait; the art library contains 868 portraits in total.

Research records retain source URLs, verification notes and confidence ratings. `research/overrides.json` applies editorial corrections. Source links and translation flags remain in the shipped data. Fifteen records rated 3/5 are held out pending stronger verification; six duplicates are merged out. Automated checks validate the data and portrait coverage; they are not a fresh historical audit of every attribution.

```sh
npm run quotes:check
```

This regenerates game data and validates sources, unique answer choices, consistent aliases and portrait coverage. Keep aliases consistent whether a person is the correct answer or a decoy. Include a verifiable source when changing or adding a quote.

## Audio

`Attribution Chaos` supplies a 62.96-second loop shared by the menu and gameplay. `Quiz Groove` supplies the 36.91-second results loop. Correct, wrong and completion cues last 1.368, 1.344 and 3.135 seconds. Edits preserve the original tempo and use short fades and balanced levels.

Ogg and MP3 alternatives live in `public/audio/suno/`, selected by `public/audio/manifest.json`. Missing recordings fall back to the synthesised score and effects. `public/audio/credits.json` records source filenames, hashes, edit boundaries and measurements. Original WAV files are not required to build or play the game.

To regenerate the edited audio, install Python with NumPy and SciPy, plus ffmpeg, then run:

```sh
python scripts/prepare-suno-audio.py <directory-containing-the-original-WAVs>
```

Browsers require a click, tap or keypress to unlock audio; hovering alone does not. Music ducks under dialogue and verdict cues, pauses in hidden tabs, and preserves its phrase when moving between the menu and questions. Dialogue uses an original grainy nonsense voice with a distinct timbre per quote.

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
