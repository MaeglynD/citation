# Citation Needed

One real quote. Four suspects. One of them actually said it.

A ten-round comedy quiz rendered in a pixel-art WebGL scene. Saturated violet, warm cream and bright candy accents combine dimensional pixel cards, animated portraits and a 2×2 answer grid. Edited user-provided Suno recordings supply the soundtrack and verdict cues; Web Audio supplies the small interface sounds and a composed fallback.

## Play locally

Requires Node.js 22 or newer.

    npm ci
    npm run dev

Open the local URL printed by Vite (normally http://127.0.0.1:5173/; it picks another port if occupied). For the release build:

    npm run build
    npm run preview

The deployable static site is in dist/. It needs no database, API keys or backend. Preferences, best score, seen quotes and the latest 50 game records are saved only in the player's browser. Each game records its start time, answers and completion. Older flat answer history is retained as “Earlier answers” because it contains no game boundaries. Missing or blocked browser storage does not prevent play.

## Controls

- Click a name or use 1–4 to accuse. Hover, arrows or Tab preview a suspect.
- On touch screens, tap a name to preview, then tap again to accuse.
- Space or a click reveals the rest of a typing quote.
- After a verdict, click or press Enter / Space to continue. A 1.5-second lock prevents an accidental double-tap from skipping it.
- While checking an answer, the selected card gently quivers and a small highlight travels along its lower edge.
- S or Escape opens settings; Escape or S closes them. M mutes.
- In settings, Tab or up/down selects volume, display size or Done. Left/right adjusts the selected setting; Enter toggles mute, cycles size or closes. + / - adjusts volume, M mutes, and D cycles display size.
- On the final screen, click a numbered portrait or use arrows to review each quote, your chosen speaker and the actual speaker. Enter plays again.
- Citations in the final overview and History open their sources in a separate tab.
- MENU or Home returns to the main menu. Its single play button becomes CONTINUE while a game is in progress. An unfinished answer is cancelled if you leave during suspense.
- HISTORY (or H from the menu) lists dated games, scores and answer marks. Click a game or select with arrows and Enter to open its results. Sources are available here; click a citation to open it in a separate tab. Escape goes back to the game list, then the menu. History survives reloads; continuing an unfinished game is available during the current visit.

## Visuals and sound

The single design builds on the original default's layout: violet panels, warm paper, pink quotation marks and yellow controls. Stationary hit targets let button faces spring upward on hover and depress on press. Answer cards grow to fit long aliases. Correct answers bounce with a colourful confetti burst; wrong answers wobble with a brief comic reaction. The illustrated environments and theme selector have been removed; saved theme choices migrate automatically.

New players start with audio enabled, the quietest audible volume and large display size. Saved preferences are retained. Music starts with the first click, tap or keypress, ducks under typing and verdict cues, and pauses in hidden tabs. Browsers generally block sound until that first gesture; hovering alone does not unlock it. Quote lettering has an original grainy nonsense voice, with a distinct timbre per quote. Answer cards can be previewed while text is typing; clicking during typing reveals the text before an answer can be submitted. The live portrait stays steady when changing suspects. Verdicts animate the cards with a brief one-to-two-pixel screen jolt and no white flash. At the owner's explicit request, the game's animations run independently of the operating system's reduced-motion preference. This does not alter any operating-system or browser setting.

Attribution Chaos supplies a 62.96-second loop that continues across the menu and game. Quiz Groove supplies a 36.91-second results loop. The correct, wrong and completion cues are phrase excerpts lasting 1.368, 1.344 and 3.135 seconds. Their original tempo is preserved; edits use short fades and balanced levels. Ogg and MP3 alternatives are packaged in public/audio/suno/, selected by public/audio/manifest.json. Unavailable recordings fall back to the composed score and effects.

The original WAVs remain untouched in the supplied source directory. public/audio/credits.json records filenames, hashes, edit boundaries and measurements. To reproduce these assets with Python (NumPy and SciPy) and ffmpeg installed:

    python scripts/prepare-suno-audio.py <directory-containing-the-original-WAVs>

Display sizes cap the CSS size of each virtual pixel. The normal desktop frame is capped at 576 × 400 virtual pixels, so large monitors do not spread the game across the screen. Narrow and short windows get an adapted frame.

## Quote provenance

The release contains 611 quotes from ten topic collections and 853 distinct answer/decoy identities, with a portrait for each. The art library contains 868 portraits in total.

The research directory retains the earlier agents' source URLs, verification notes and confidence ratings. research/overrides.json applies editorial corrections. Source links and translation flags are preserved in the shipped data.

Fifteen records rated 3/5 by the earlier research are held out pending stronger verification; six duplicate records are merged out. This release validates the complete data structure and portrait coverage and spot-checks selected citations; it does not claim a fresh independent historical audit of every quote.

    npm run quotes:check

This regenerates the game data and validates sources, unique answers/decoys, consistent aliases and portrait coverage. Bob Ross and other well-known figures use their familiar names. Descriptive aliases for less familiar figures remain consistent whether they are answers or decoys.

## Release checks

    npm test
    npm run build

With the dev server running:

    npm run test:browser
    node scripts/test-layout.mjs
    node scripts/test-saved-games.mjs
    npm run test:audio
    node scripts/test-recordings.mjs
    node scripts/test-suno-motion.mjs
    node scripts/test-dialogue.mjs
    node scripts/test-typing-hover.mjs

The browser suite plays a full mixed-result game, checks scoring, reveal lockout, keyboard settings, menu/resume, durable history and responsive layouts; screenshots go to shots/release/. The saved-game suite checks persistence, actual row clicks, keyboard selection, pagination and archived sources. Pass an alternative local URL as the first argument when testing on a different port. Audio QA renders the composed fallback with OfflineAudioContext and reports levels, clipping and spectral measurements in shots/audio/. The recording test verifies codec fallback, decoding, loop boundaries, uninterrupted shared tracks and mute with an in-memory test tone. The Suno/motion suite checks actual bundled recordings, both codecs, results crossfades, and visible verdict animations with reduced motion enabled. These are Chromium checks, including emulated touch, rather than a claim of physical-device testing.

## Project map

- src/game/: game state, deck selection, preferences, input and text fitting.
- src/scene/: low-resolution GPU pipeline, stage, title, play, review and settings.
- src/portraits/: portrait renderer, lighting pass and texture cache.
- src/audio/: synthesiser, scheduler, composed fallback and optional recording loader.
- research/: source records, portrait specs and editorial overrides.
- md/: supporting documentation and earlier research briefs; README.md stays at the root.
- scripts/: data generation, regression checks, screenshot and audio tools.
- .openai/hosting.json: private Sites deployment identity and static output configuration.

Development-only cheat, font-test, state-inspection and offline-audio hooks are excluded from production behavior. Keep source changes in this checkout and rebuild dist/ before deploying.
