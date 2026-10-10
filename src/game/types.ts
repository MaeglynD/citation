export interface Person {
  name: string
  /** Funny deed-descriptor shown instead of the name, e.g. "The guy who invented dynamite". */
  alias?: string | null
  fictional?: boolean
}

export interface Quote {
  id: string
  quote: string
  answer: Person
  decoys: Person[]
  /** Concrete provenance shown on the reveal, e.g. "Letter to his daughter, 1935". */
  source: string
  url: string
  translated?: boolean
  /** Optional deadpan one-liner shown under the source. */
  note?: string
  tags: string[]
}

export interface Option {
  person: Person
  correct: boolean
}

export function displayName(p: Person): string {
  return (p.alias && p.alias.trim()) || p.name
}
