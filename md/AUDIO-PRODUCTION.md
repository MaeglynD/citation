# Citation Needed — audio production pack

Archived planning notes from before the single-theme design and Suno import. For the current soundtrack, edited cue lengths and playback behaviour, see [README](../README.md#visuals-and-sound). Earlier theme concepts and instructions below are retained as project history.

Research checked **10 October 2026** against the providers' official pages. These prompts and production choices are recommendations, not claims that a particular generation has been auditioned. The game includes three newly composed, quiet procedural scores and tactile interaction effects. No paid AI tracks have been imported, and no accounts or subscriptions have been changed; those recordings must be generated, selected and imported separately.

## What to buy

**Start with one month of Suno Pro on monthly billing.** You already like its output, and its current editing, WAV export and stems make it a practical way to produce three strong scores. “Best sounding” is subjective; the useful test is whether a track remains enjoyable while reading quotes for ten minutes. Do that test before paying for a larger plan.

| Option | Cost and useful limits | Recommendation for this game |
| --- | --- | --- |
| Suno Pro | US$10/month; 2,500 generation credits; 20 distinct song downloads/month | First choice for music. Enough exports for three final scores and a few variants. |
| Suno Premier | US$30/month; 10,000 credits; 60 song downloads; Studio | Only upgrade if you want to do multitrack arranging inside Suno. Unnecessary for the initial three tracks. |
| ElevenLabs Starter | US$6/month standard price; currently advertises US$1 first month until 18 October; 30,000 shared credits | Optional second purchase for tailored Foley, ambience and short effects. |
| Udio | Official help currently says audio, video and stem downloads are disabled | Skip for this production: a browser game needs usable exported assets. |

Suno's US$8/US$24 headline prices are the **annual-billing equivalents**, not the one-month purchase. Taxes/local currency appear at checkout. Sources: [Suno pricing](https://suno.com/pricing), [Suno monthly plan explanation](https://suno.com/), [ElevenLabs pricing](https://elevenlabs.io/pricing), [Udio download status](https://help.udio.com/en/articles/12683565-changes-associated-with-the-universal-music-group-umg-partnership).

Budget **US$10 plus tax** initially, or **US$16 plus tax** including one normal-price month of ElevenLabs. Do not pay for both before hearing whether Suno Sounds already produces the effects you want.

### Buy once, cancel renewal, keep the month

1. Buy **Pro → Monthly** directly on the Suno website. Check that checkout is one month, not a year.
2. Go to [Suno account](https://suno.com/account) and cancel renewal immediately if you only want one month. Keep the cancellation confirmation and the displayed expiry date. Suno's current terms explicitly preserve paid access until the end of the period already paid for. Cancellation is not an immediate refund. [Cancellation instructions](https://help.suno.com/en/articles/2410369), [current terms, Subscription Renewals and Cancellations](https://suno.com/terms-of-service).
3. Generate, choose and **officially download** the final tracks before that expiry date. Current commercial permission depends on a permitted download; permission for such a download survives cancellation. Keep the original WAV, song URL/ID, generation/download dates, invoice and a copy of the applicable terms. [Suno paid rights](https://help.suno.com/en/articles/9601665), [current terms, Permitted Commercial Use](https://suno.com/terms-of-service).
4. Audition freely inside Suno; export the keepers. A song's WAV, MP3, repeat downloads and stems count as one song download, not separate slots. Monthly download allowances do not roll over. [Download rules](https://help.suno.com/en/articles/13926209).

**Your existing free-tier test:** Suno's official pages conflict. Its older FAQ says upgrading does not automatically grant retroactive rights, while its September 2026 policy says songs downloaded as a paying subscriber receive commercial permission. Do not assume the old test is cleared. For a clean production record, generate a fresh track while paid, or obtain written confirmation from Suno for that specific existing song and retain it. A new generation from the same text prompt is simpler than extending or covering the old test. [Older FAQ](https://help.suno.com/en/articles/2425729), [new policy](https://suno.com/blog/suno-updates-tos), [current terms](https://suno.com/terms-of-service).

Use your own prompts/material. Avoid other users' remixes: the current terms impose a separate noncommercial restriction on collaborative Remixes. Commercial permission is also distinct from a guarantee of copyright exclusivity. [Suno terms](https://suno.com/terms-of-service).

## Can Suno do every sound?

It can now attempt much more than songs: **Create → Sounds** offers **One Shot** and **Loop**, with BPM and key controls. This feature is explicitly experimental/beta; its documentation includes effects, ambience and instrument samples. Try it for a bell, paper stamp or rain bed, but inspect any feature-specific terms presented in the interface before using the result in production. [Suno Sounds](https://help.suno.com/en/articles/10625537).

My recommendation is a mixed system: recorded music for atmosphere; very short, tightly timed interface sounds for responsiveness; a few distinctive Foley sounds for character. Do not generate a new song for every interaction. A 100 ms selection tick needs a clean attack and consistent level, while a song generator often adds silence, tails or an unwanted arrangement. Preserve the game's immediate synthesized controls unless a replacement is clearly better.

ElevenLabs is the useful alternative for SFX because it exposes duration, looping and prompt influence, and supports concise descriptions of individual actions. Its paid plans include commercial SFX use for eligible non-beta output. [SFX documentation](https://elevenlabs.io/docs/overview/capabilities/sound-effects), [commercial policy](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform).

Eleven Music is also a credible music alternative, especially for defined sections. Its **9 October 2026 terms** permit qualifying indie games on self-serve plans: game revenue below US$500,000 and developer/publisher annual game revenue below US$1 million, under the terms' definitions. Starter has no music-streaming distribution right; high-quality music downloads require Pro. The music pricing page and terms currently show inconsistent generation allowances, so use the account's displayed quota rather than planning around a promised number of minutes. For this project, Suno Pro gives a simpler inexpensive WAV workflow. [Eleven Music terms](https://elevenlabs.io/music-terms), [music product/pricing](https://elevenlabs.io/music).

## Make the three scores

Use **Advanced/Custom**, **Instrumental on**, no lyrics, and **v6** as the first model. Its current docs describe v6 as the controlled model and v6-wild as the exploratory alternative. Start with **Variety 0** and **Max Mode off** for short sketches. Explore v6-wild only if results feel too polite. If the interface also exposes the older Weirdness/Style Influence controls, try **Weirdness 25% / Style Influence 80%** as an initial experiment, not a required recipe. [Current v6 controls](https://help.suno.com/en/articles/13924481), [creative sliders](https://help.suno.com/en/articles/6141377).

In **Exclude**, enter:

```text
vocals, speech, choir, scat singing, crowd noise, applause, laugh track, dramatic risers, huge drops, harsh cymbals, distorted mastering
```

The Exclude field is documented under Advanced Options. [Suno exclusion instructions](https://help.suno.com/en/articles/3161921).

Generate about **three pairs per theme**, listen, then change one thing at a time. Choose the strongest groove before refining it. The tempos, keys, durations and loop instructions below are **targets to check**, not guaranteed controls. A prompt saying “seamless loop” does not prove the file loops cleanly.

### THEATRE — a suspiciously elegant quiz show

Style prompt:

```text
Instrumental score for a witty quote-guessing game set in a miniature velvet theatre. Elegant comic chamber jazz, 104 BPM, 4/4, D minor with brief sunny major turns. Plucked upright bass, soft brushed drums, dry pizzicato strings, woody clarinet, muted brass used very sparingly, little vibraphone answers. A memorable four-note question-and-answer motif, playful pauses, sly harmonic wrong turns. Sophisticated and mischievous, never circus music or frantic slapstick. Intimate human performance, warm detailed sound, light percussion, plenty of space for reading. Begin directly with the groove; sustain a restrained 32-bar cycle with small variations. Around 90 seconds. Stable tempo and energy, no big build, no ending flourish. Return naturally to the opening harmony for an editable game loop. Instrumental only.
```

Choose a version that feels amused rather than constantly announcing a joke. The reveal itself supplies the punchline; the music should leave room for it.

### NOIR — late-night detective office

Style prompt:

```text
Instrumental small-combo detective jazz for a quietly absurd quote mystery. 78 BPM, relaxed swung 4/4, C minor. Felt piano with sparse minor-nine voicings, warm upright bass, delicate brush kit, breathy muted trumpet making very occasional two-note comments. Tiny hints of vibraphone. Rain-lit office at midnight, polished wood and a green desk lamp, dry humour beneath genuine intrigue. Restrained, intimate, spacious, warm tape colour without loud vinyl crackle. No rain sound in the music itself. No grand saxophone solo, no heroic drama. Start with the established groove, around 100 seconds of gently evolving 32-bar phrases, constant tempo and instrumentation, no climax or fade-out. Finish on harmony that leads naturally back to the opening. Instrumental only.
```

Keep rain separate so it can be quiet, optional and independently looped. Prefer a gently inquisitive piano part over a dominant trumpet melody.

### MUSEUM — cabinet of impossible quotations

Style prompt:

```text
Instrumental chamber miniature for an eccentric nocturnal museum and astronomical observatory. 92 BPM, gentle 6/8, A minor with curious Lydian colours. Clear celesta, delicate marimba, plucked strings, soft bass clarinet and a warm low bowed-string foundation. Tiny glassy harmonics like distant stars, a curious three-note motif passed between instruments. Beautiful, tactile, mysterious and faintly ridiculous, with the poise of a tiny mechanical orchestra. Warm room acoustics, detailed natural attacks, soft dynamics, large spaces between phrases. No horror, no cheap haunted-house organ, no children's nursery tune. Around 100 seconds of even, unhurried motion; small variations over repeating phrases, no massive crescendo, no dramatic ending. An editable loop returning to its opening harmony. Instrumental only.
```

Keep enough bass warmth that the celesta does not become brittle on phone speakers.

### Related cues without losing the musical identity

The minimum good release needs **three main loops**, not dozens of separate songs. A useful optional second pass is a menu arrangement and a short results cue for each theme. Use a cleared paid track as your own reference and ask:

```text
Keep the same instruments, key, tempo and short melodic motif. Make a quieter menu arrangement: remove most drums and thin the melody, leave gentle movement and spacious phrases. No vocals. No new lead instrument. No climax. About 60 seconds with an editable loop.
```

```text
Using the same instrumental palette and motif, create an understated 8-second completion cue: two bars of rising anticipation, a warm satisfying resolution, then a clean natural decay. Wry and charming, not a sports victory fanfare. Instrumental only.
```

Requesting eight seconds may still produce something longer. Select and edit the useful phrase. For separate stems, **Get Stems → Auto Split** is available on Pro (up to 12 parts, currently 50 credits); **Split from Mix** can isolate a chosen instrument plus its complement. Download only useful stems, not everything by default. [Stem controls and costs](https://help.suno.com/en/articles/12702337).

## Short effects to generate

For Suno use **Sounds → One Shot** except the rain row. For ElevenLabs use Sound Effects, the indicated duration, looping off except rain, and a fairly literal prompt influence. Generate several alternatives, select one, trim to the attack and apply a tiny fade to avoid clicks. These are original production prompts; exact duration/pitch remain listening checks.

| File / event | Target | Prompt |
| --- | --- | --- |
| `ui-hover.wav` — focus a new choice | 0.12 s | `A single soft wooden mechanism tick, delicate and tactile, close dry recording, a tiny high-frequency detail but no harsh click, immediate attack, very short decay, isolated, no voice, no music, no background.` |
| `ui-confirm.wav` — commit answer | 0.30 s | `One satisfying little mechanical latch engaging, polished wood and brass, soft low clack followed by a tiny metallic ting, compact friendly interface confirmation, immediate attack, dry isolated sound, no speech or musical backing.` |
| `page-turn.wav` — next quote/history | 0.45 s | `One heavy cream index card lifted and slid onto a wooden desk, crisp paper movement and a gentle final tap, intimate dry Foley, one action only, no ambience, no voices, no music.` |
| `theatre-correct.wav` | 0.9 s | `A tiny elegant correct-answer sting: two ascending dry vibraphone notes and a soft pizzicato chord, cheerful D minor to F major colour, refined comic theatre, immediate start, clean short decay, no drums, no voice, no full song.` |
| `theatre-wrong.wav` | 0.7 s | `One low woody clarinet note bends down gently, followed by a tiny brushed woodblock tap; wry comic disappointment, affectionate rather than mocking, dry short isolated sting, no buzzer, no voice, no full song.` |
| `noir-correct.wav` | 0.8 s | `Two restrained rising vibraphone notes and a soft warm piano minor-nine chord, a detective quietly solves a case, C minor jazz colour, immediate attack and short decay, isolated musical sting, no backing groove or voice.` |
| `noir-wrong.wav` | 0.7 s | `One brief breathy muted-trumpet downward sigh with a quiet double-bass pluck, elegant deadpan detective humour, close dry recording, short isolated sting, no voice, no buzzer, no song.` |
| `museum-correct.wav` | 1.0 s | `Three delicate ascending celesta notes ending on a warm plucked-string chord, a tiny astronomical mechanism finding its alignment, A minor resolving gently to C major, magical and understated, isolated short sting, no voice or full song.` |
| `museum-wrong.wav` | 0.8 s | `Two softly descending bass-clarinet notes with one muted marimba knock, a curious museum mechanism politely refusing an answer, warm whimsical acoustic sound, isolated short sting, no horror, no voice, no full song.` |
| `noir-rain.ogg` — optional ambience | 20 s loop | `Steady very quiet rain on an office window heard from indoors, soft diffuse patter, no thunder, no footsteps, no traffic, no voices, no music, constant texture and level, seamless ambient loop.` |

The UI sound should be much quieter than a verdict. Avoid playing a sound for every typed character; a soft opening flourish is usually more pleasant. Duck the music briefly for a verdict instead of making the sting louder. Never put a canned laugh track over the quote.

## Export and handoff

Keep original paid masters and licence evidence in a separate working folder. Prefer **WAV** for editing, plus the provider's MP3 as a reference. Suno's browser WAV export is available on Pro/Premier; stems belong to the same song download. [Export formats](https://help.suno.com/en/articles/13926081).

Deliver the following minimum set, with originals alongside the prepared web versions:

```text
theatre-main.wav       theatre-main.ogg       theatre-main.mp3
noir-main.wav          noir-main.ogg          noir-main.mp3
museum-main.wav        museum-main.ogg        museum-main.mp3
ui-hover.wav           ui-confirm.wav        page-turn.wav
theatre-correct.wav    theatre-wrong.wav
noir-correct.wav       noir-wrong.wav
museum-correct.wav     museum-wrong.wav
audio-credits.json
```

Optional extras are `theatre-menu`, `noir-menu`, `museum-menu`, corresponding `-results` looped beds, short `-complete` stings, and `noir-rain`. The public theme names map to legacy game IDs: THEATRE → `arcade`, NOIR → `noir`, MUSEUM → `haunted`.

Suggested production targets, to refine by ear:

- Trim a stable **16 or 32 bars** from the middle of a main track. Measure its actual tempo; do not assume the prompt was obeyed. Match beginning/end harmony and beat, then crossfade at the loop boundary if needed. Listen to at least five consecutive repeats.
- Keep a full-resolution master; encode web music to Ogg plus MP3 fallback. Record loop start/end in seconds if the file includes an introduction. Do not simply loop an entire song with its fade-out.
- Aim initially around **−20 to −18 LUFS integrated** for music with peaks below **−1 dBTP**, then set in-game gain while comparing all three themes. These are mix starting points, not broadcast requirements. A quiet, unhurried reading game should not sound mastered for maximum streaming loudness.
- Audition with inexpensive headphones and a phone speaker, at low volume, through ten questions. Reject phantom vocals, crunchy transients, distracting solos, audible edit seams and tiring high frequencies.
- In `audio-credits.json`, record provider, track URL/ID, title, generation date, official download date, paid plan, permission evidence location, edits and final filenames. Keep billing documents private, outside the site's public assets.

## Import into the game

1. Put the prepared web files in `public/audio/`. Keep private invoices and licence correspondence elsewhere.
2. Edit `public/audio/manifest.json`, retaining `"version": 1`. Add only assets you have actually supplied. For example, after copying both versions of the THEATRE loop:

```json
{
  "version": 1,
  "themes": {
    "arcade": {
      "music": {
        "main": {
          "sources": ["/audio/theatre-main.ogg", "/audio/theatre-main.mp3"],
          "gain": 0.8,
          "loopStart": 0
        }
      }
    }
  }
}
```

3. Add `noir` and `haunted` theme entries using the same shape. Each theme can contain `music.main`, `music.menu` and `music.results`. **All three are looped music beds.** A short completion fanfare belongs in `sfx.complete`, not `music.results`.
4. For optional effects, add a theme's `sfx` object with any of these keys: `hover`, `confirm`, `page`, `suspense`, `correct`, `wrong`, `stamp`, `complete`. Each accepts `sources` and `gain`, for example `"correct": { "sources": ["/audio/theatre-correct.ogg", "/audio/theatre-correct.mp3"], "gain": 0.6 }`. Export those SFX web versions from the WAV masters first.
5. Restart/reload the game and audition the theme, a verdict and the results screen. Adjust gains relative to the other themes, then rebuild with `npm run build` for release.

`loopStart` and optional `loopEnd` are **seconds**, measured from the actual prepared file. Omitting `loopEnd`, as above, uses the decoded file's end; that is only seamless when the audio has been edited for that boundary. If the useful loop lies inside a longer file, set both to real measured numbers with the end after the start. Do not paste `SECONDS` or an estimated BPM-derived endpoint into the JSON.

The player caches decoded audio, loops it without repeated network requests, crossfades music transitions and ducks music for events. Missing entries or unavailable files retain the game's procedural score and effects. No generation API or paid account is needed by players. Separate ambience has no dedicated manifest slot; retain rain as a production stem and mix it quietly into a final NOIR bed if wanted.
