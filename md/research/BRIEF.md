# Research brief: quotes for "CITATION NEEDED" (a who-said-it comedy game)

## The game
The player sees ONE real quote and FOUR names. They pick who said it. The entire joke is the reveal:
"no way THEY said that." Examples of the target effect:
- A tender line about children or kindness -> it was Stalin / Hitler / a serial killer.
- A harsh, petty, dark or sexual line -> it was Mother Teresa / Gandhi / Mr. Rogers / the Dalai Lama.
- A profound philosophical or scientifically accurate insight -> it was Roger Rabbit / SpongeBob / a WWE wrestler / Paris Hilton.
- A gloriously stupid or insane line -> it was a Nobel laureate / a Supreme Court justice / a Pope.
- Something that reads like a modern tweet -> it was written in 300 BC.

Also valued: people whose DEED is better known than their name. Use the deed as an `alias`
(e.g. name "Edward Jenner", alias "The guy who invented the smallpox vaccine"). The game shows the alias when present.

## HARD RULES (non-negotiable)
1. EVERY quote must be REAL and CORRECTLY ATTRIBUTED. Verify each one on the web (Wikiquote "Sourced" sections, primary documents, reputable news/biographies). Reject anything listed under Wikiquote "Misattributed", "Disputed" or "Unsourced", and reject viral fake quotes (Einstein "insanity", Gandhi "be the change", Twain/Marilyn/Buddha/Lincoln internet quotes, etc.). If you cannot find a concrete source (document, speech, interview, episode, film, letter + year), DROP IT. Precision beats volume.
2. Record ONE `url` you actually used to verify, and a short concrete `source` string.
3. Quote text 20-230 characters. Verbatim. You may trim with an ellipsis "..." at start/end, or drop a leading clause, but never paraphrase or splice. Translations are fine for non-English sources (mark `translated: true`).
4. No racial slurs or sexual content involving minors, even in a real quote. Dark, edgy, cruel, blasphemous, sexual (adult), political, religious: all fine. Controversial is the point.
5. Fictional characters are fine as answers AND decoys. For a fictional answer, `source` = the work and year (e.g. "Who Framed Roger Rabbit (1988)"). The line must really be in the work (verify via transcript/wiki). For fictional people set "fictional": true.
6. Do NOT reuse the previous attempt's quotes (list at the bottom).

## Comedy rules for DECOYS (3 per quote)
The four options (answer + 3 decoys) are what the player stares at. They must be FUNNY TOGETHER and not solvable by elimination:
- Decoy 1 = the "obvious" guess for that sentiment (e.g. a tender quote -> Mister Rogers; a gun quote -> Clint Eastwood).
- Decoy 2 = plausible, same general world as the answer (so the answer isn't the odd one out).
- Decoy 3 = wild card / absurd juxtaposition (a cartoon, a villain, a pop star).
- The answer must never be the only person of its "type" among the four (e.g. the only dictator, the only fictional character, the only woman, the only non-English-speaker), unless the quote itself gives no hint.
- Don't pick a decoy who famously said something very similar (that creates real ambiguity instead of comedy).
- Don't use the same decoy more than 4 times across your whole set.
- Use the CANONICAL NAMES below when they apply, so the merge step can dedupe people.

## Canonical names (use these exact spellings when you use these people)
Adolf Hitler; Joseph Stalin; Mao Zedong; Benito Mussolini; Napoleon Bonaparte; Genghis Khan; Kim Jong Il; Kim Jong Un; Vladimir Putin; Saddam Hussein; Osama bin Laden; Pol Pot; Idi Amin; Muammar Gaddafi; Charles Manson; Ted Bundy; Jeffrey Dahmer; Ted Kaczynski (alias "The Unabomber"); Al Capone; Pablo Escobar; Darth Vader; Thanos; The Joker; Hannibal Lecter; Voldemort; Mother Teresa; Mahatma Gandhi; The Dalai Lama; Mister Rogers; Bob Ross; Dolly Parton; Keanu Reeves; Tom Hanks; Pope Francis; Nelson Mandela; Martin Luther King Jr.; Jesus; Buddha; Winnie the Pooh; Eeyore; Kermit the Frog; Miss Piggy; Elmo; Big Bird; SpongeBob SquarePants; Patrick Star; Squidward; Homer Simpson; Lisa Simpson; Bart Simpson; Mr. Burns; Rick Sanchez; BoJack Horseman; Bugs Bunny; Roger Rabbit; Shrek; Donkey; Yoda; Gandalf; Dumbledore; Batman; Ron Swanson; Dwight Schrute; Michael Scott; Tony Soprano; Walter White; Albert Einstein; Isaac Newton; Nikola Tesla; Richard Feynman; Stephen Hawking; Carl Sagan; Charles Darwin; Marie Curie; Neil deGrasse Tyson; Bill Nye; Elon Musk; Steve Jobs; Bill Gates; Mark Zuckerberg; Jeff Bezos; Donald Trump; Joe Biden; Barack Obama; George W. Bush; Winston Churchill; Abraham Lincoln; Queen Elizabeth II; Prince Philip; Kanye West; Taylor Swift; Beyoncé; Lil Wayne; Snoop Dogg; Lady Gaga; Paris Hilton; Kim Kardashian; Ozzy Osbourne; Keith Richards; Bob Dylan; Mike Tyson; Muhammad Ali; Yogi Berra; Shaquille O'Neal; Zlatan Ibrahimović; Arnold Schwarzenegger; Hulk Hogan; Macho Man Randy Savage; The Rock; Ernest Hemingway; Oscar Wilde; Mark Twain; Friedrich Nietzsche; Socrates; Marcus Aurelius; Salvador Dalí; Pablo Picasso; Andy Warhol; Vincent van Gogh; Shakespeare; Dr. Seuss; Roald Dahl; Stephen King; Hunter S. Thompson; Charles Bukowski; Kurt Vonnegut; Slavoj Žižek; Jordan Peterson; Gwyneth Paltrow; Oprah Winfrey; Gordon Ramsay; Anthony Bourdain; Steve Irwin; David Attenborough; Bear Grylls; Joe Rogan; Alex Jones; Jaden Smith.

## Output format
Write a single JSON file (UTF-8, valid JSON, an array) to the exact path given in your task. Each element:

    {
      "id": "stalin-tender-01",
      "quote": "...",
      "answer": { "name": "Joseph Stalin", "alias": null, "fictional": false },
      "decoys": [ { "name": "Mister Rogers", "fictional": false }, { "name": "The Dalai Lama", "fictional": false }, { "name": "Winnie the Pooh", "fictional": true } ],
      "source": "Letter to his daughter Svetlana, 1935",
      "note": "He signed it 'your little papa'.",
      "url": "https://...",
      "verification": "wikiquote-sourced",
      "confidence": 5,
      "translated": false,
      "tags": ["villain-tender"]
    }

Field rules:
- id: unique kebab-case, prefixed with your theme code.
- quote: verbatim, 20-230 chars.
- answer.alias: optional funny deed-descriptor shown instead of the name (e.g. "The guy who invented dynamite"). null if none.
- source: <= 80 chars, concrete; include a year when known. For fiction: work + year.
- note: OPTIONAL deadpan one-liner <= 90 chars, no emoji. Omit the field if you have nothing good. This is shown on the reveal; dry, factual, funny.
- url: the page you verified on.
- verification: one of "wikiquote-sourced", "primary", "reputable-secondary", "transcript".
- confidence: 1-5; 5 = iron-clad. DROP anything below 3.
- tags: 1-3 short tags (theme + tone), e.g. ["villain-tender", "children"].

## Process
1. Load WebSearch and WebFetch with ToolSearch (query "select:WebSearch,WebFetch") before researching.
2. Brainstorm 70+ candidates for your theme FIRST (think broadly: eras, countries, genders, fiction, obscure-deed people), then verify each with a search. Many will fail verification; that's expected. Aim to DELIVER 45-60 verified entries.
3. Prefer quotes that are short, punchy, self-contained and surprising WITHOUT the context. Lines that need a paragraph of setup are weak.
4. Write the JSON file, validate it parses, and in your final report give: count delivered, 5 best examples, and any entries you're less sure about.

## Previous attempt's quotes (do NOT reuse)
"A laugh can be a very powerful thing" (Roger Rabbit); "But I am very poorly today & very stupid & hate everybody" (Darwin); "I do not want people to be very agreeable" (Austen); Franklin's fart essay; "Yes, the penalty of death generally is a crime"; "I do not wish them to have power over men; but over themselves" (Wollstonecraft); "where there is only a choice between cowardice and violence, I would advise violence" (Gandhi); "It is what you do with the gift of life that determines who you are" (Mewtwo); "You are too concerned with what was and what will be" (Oogway); "The world is often unkind to new talent" (Ratatouille); "Trying is the first step towards failure" (Homer); "The inner machinations of my mind are an enigma" (Patrick); "Sucking at something is the first step" (Jake); "I know that the ones who love us will miss us" (Keanu); "It costs a fortune to make somebody look so cheap" (Dolly); "I know the human being and fish can coexist peacefully" (Bush); "People who boast about their I.Q. are losers" (Hawking); "I make models of buses"; "What distracts me from my reality is bigfoot" (Megan Fox).
