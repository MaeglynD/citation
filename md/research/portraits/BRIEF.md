# Brief: pixel-art portraits for "Citation Needed"

## What this is for
"Citation Needed" is a comedy quiz: a real quote, four suspects, pick who said it. When the player hovers a
name, a small pixel-art portrait of that person appears in a "mugshot" card next to the speech bubble, so the
person appears to be *saying* the quote. On the reveal, the real speaker's portrait appears. Portraits are
40x48 pixels: head and shoulders, facing the viewer, outlined, on a blue mugshot card.

Portraits are drawn procedurally by `src/portraits/render.ts` from a small JSON **spec** per person. Your
job is to write the spec for every person in your batch so each one is as recognisable and characterful as
the format allows, checking your work by rendering contact sheets and looking at them.

## Files
- Your input: `research/portraits/todo-N.json` (N given in your task). Each row has `name` (copy it EXACTLY,
  including accents), `alias` (a joke descriptor shown in-game instead of the name, if any), `fictional`, and
  a `hint` (a quote they said or a quote they were a decoy for) to help you identify obscure people.
- Your output: `research/portraits/batch-N.json`, an object mapping each exact name to its spec:
  `{ "Adolf Hitler": { ...spec... }, "Mister Rogers": { ... } }`
- Option reference (every allowed value): [OPTIONS.md](OPTIONS.md). READ IT FIRST.
- Worked examples (copy their style): `research/portraits/_calibration.json` and `_calibration2.json`.
  Rendered versions: `shots/portraits-cal.png`, `shots/portraits-cal2.png`, `shots/portraits-fix.png`.
  Look at these images before you start (use the Read tool on the PNG).

## Rendering your work (do this often)
    node --experimental-strip-types scripts/portrait-sheet.mts research/portraits/batch-N.json shots/portraits/batch-N-p1.png --scale 3 --cols 9 --from 0 --count 36
    (then --from 36 --count 36 → -p2.png, etc.)
    --frames      also renders the blink and talk animation frames
    --only "A,B"  renders just the named people (handy while fixing a few)
Then open the PNG with the Read tool and look at every portrait. Labels drop accented letters; that's fine.
Ignore the "ExperimentalWarning" line node prints.

## Spec fields (all optional; see OPTIONS.md for values)
Human: `skin, face, build, age, hair, hairColor, facialHair, facialHairColor, brows, browColor, eyes, eyeColor,
nose, noseColor, mouth, lipColor, ears, eyewear, eyewearColor, headwear, headwearColor, headwearColor2,
headwearSymbol, outfit, outfitColor, outfitColor2, symbol, extras[]`
- `symbol` = chest emblem for outfit "emblem" (e.g. "S", "bat", "star"), a jersey/singlet number ("23"), or the
  mark on an object's cover. Up to 3 characters or a named symbol from OPTIONS.md.
- `extras` = small touches: face marks (freckles, scar, tattoo, wrinkles…), props (cigar, microphone, medals,
  pearls, chain…). `color2` sets the colour of facepaint / scarf / bowtie / tie extras.
Animal head (`base: "animal"`): uses the human fields plus
`animal: { fur, fur2, muzzle, earColor, ears, snout, pattern, nose }`. Outfit "none" = bare fur body.
Special bases (ignore most human fields): `sponge, starfish, crab, triangle, blob, ghost, skull` (use
`color`/`color2`), `robot` (`kind`: bender, boxy, screen, terminator, android), `helmet` (`kind`: vader, trooper,
chief, spartan, knight, astronaut, football, diver), `object` (`kind`: book, tablet, scroll, document, screen,
device, lens, building, flag, globe, coin, trophy, bottle, crown, camera, burger; plus `color, color2, symbol`;
add `"extras": ["face"]` to give an object a little face).
Colours: any named colour in OPTIONS.md, or a hex string "#rrggbb" for exact shades.

## How to make them recognisable
1. Lead with the 2-3 most iconic visual traits: hair (style + colour), facial hair, headwear, glasses, and the
   outfit they are famous in (Mister Rogers' red cardigan, Jobs' black turtleneck, Gandhi's shawl and round
   glasses, Hulk Hogan's bandana and horseshoe moustache, Napoleon's bicorne).
2. Pick the most iconic era (Elvis in the white jumpsuit, Einstein old with wild white hair, Dolly's platinum
   beehive). For historical figures without photos, use their famous paintings/statues (Caesar: laurel + toga).
3. Contrast: hair, skin and outfit must differ clearly in brightness or hue, or the face becomes a blob.
   Check the sheet; if a face disappears, change a colour.
4. Variety: don't give everyone the default suit. Use expression (`mouth`, `eyes`, `brows`) to suggest
   personality: smug, grumpy, beaming, deranged, serene.
5. Fictional characters: match their canonical colours and silhouette (Simpsons: yellow skin + big eyes;
   muppets: fuzzy + pingpong eyes + muppet mouth; Peanuts: dots eyes; anime: anime/spiky hair, vivid colours).
6. Organisations, scriptures, documents, AIs and abstractions use `base: "object"` (The Bible: black book
   with gold cross; Magna Carta: scroll; The Taliban: a flag; a chatbot: robot screen).
7. People you don't recognise: use the hint, era, nationality and profession to make a plausible, specific
   portrait (period clothing, typical hair). You may use WebSearch to check what someone looked like (load it
   with ToolSearch "select:WebSearch,WebFetch"), one request at a time; most people won't need it.

## Hard rules
- Respectful likenesses. Represent skin tone accurately, but never exaggerate ethnic features. Comedy comes
  from the quotes, not the faces.
- No hate symbols of any kind: no swastikas, SS runes, Nazi eagles or armbands, KKK robes, Confederate flags,
  ISIS flags. Nazi figures get a plain khaki/grey military uniform with no insignia (medals extra is fine).
- Villains and criminals: neutral mugshot depiction; no blood or weapons (a cigar is fine).
- Do not edit any file in `src/` or `scripts/`. If the renderer lacks something you need, use the closest
  option and add it to your final report's wishlist.
- Save `batch-N.json` after every ~20 specs (overwrite with the full object so far), so work survives an
  interruption. It must be valid JSON (validate with node before finishing).
- Every name in your todo file must appear in your output, spelled exactly as given.

## Final report (short)
Count written; the 5 portraits you're proudest of; names you're unsure about; and a wishlist of up to 5
renderer features that would most improve your batch (e.g. "a top-knot hairstyle", "a beret tilted the
other way"), with which people need them.
