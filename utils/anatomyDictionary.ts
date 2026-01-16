type Entry = {
  nl: string[]
  en: string // canonical
  synonyms?: string[] // extra English variants (incl. Latin)
}

// Minimal-but-high-value mapping. Extend over time as you see real user queries.
const ENTRIES: Entry[] = [
  { nl: ['hypofyse'], en: 'pituitary gland', synonyms: ['hypophysis', "Gray's Anatomy pituitary"] },
  { nl: ['hypothalamus'], en: 'hypothalamus' },
  { nl: ['hersenen', 'brein'], en: 'human brain anatomy', synonyms: ["Gray's Anatomy brain"] },
  { nl: ['schedel'], en: 'human skull anatomy', synonyms: ["Gray's Anatomy skull"] },
  { nl: ['wervelkolom', 'ruggengraat'], en: 'spinal cord anatomy', synonyms: ['vertebral column anatomy', "Gray's Anatomy spinal cord"] },
  { nl: ['hart'], en: 'heart anatomy', synonyms: ["Gray's Anatomy heart"] },
  { nl: ['long', 'longen'], en: 'lungs anatomy', synonyms: ["Gray's Anatomy lungs"] },
  { nl: ['lever'], en: 'liver anatomy', synonyms: ["Gray's Anatomy liver"] },
  { nl: ['maag'], en: 'stomach anatomy', synonyms: ["Gray's Anatomy stomach"] },
  { nl: ['slokdarm'], en: 'esophagus anatomy', synonyms: ["Gray's Anatomy esophagus"] },
  { nl: ['luchtpijp'], en: 'trachea anatomy', synonyms: ["Gray's Anatomy trachea"] },
  { nl: ['alvleesklier'], en: 'pancreas anatomy', synonyms: ["Gray's Anatomy pancreas"] },
  { nl: ['galblaas'], en: 'gallbladder anatomy', synonyms: ["Gray's Anatomy gallbladder"] },
  { nl: ['milt'], en: 'spleen anatomy', synonyms: ["Gray's Anatomy spleen"] },
  { nl: ['nier', 'nieren'], en: 'kidney anatomy', synonyms: ["Gray's Anatomy kidney"] },
  { nl: ['blaas'], en: 'urinary bladder anatomy', synonyms: ["Gray's Anatomy bladder"] },
  { nl: ['darm', 'darmen'], en: 'intestine anatomy', synonyms: ['small intestine anatomy', 'large intestine anatomy', "Gray's Anatomy intestine"] },
  { nl: ['dunne darm'], en: 'small intestine anatomy', synonyms: ["Gray's Anatomy small intestine"] },
  { nl: ['dikke darm'], en: 'large intestine anatomy', synonyms: ["Gray's Anatomy large intestine"] },
  { nl: ['spijsverteringsstelsel'], en: 'digestive system anatomy', synonyms: ["Gray's Anatomy digestive system"] },
  { nl: ['bloedsomloop', 'bloedsomloopstelsel'], en: 'circulatory system anatomy', synonyms: ["Gray's Anatomy circulatory system"] },
  { nl: ['ademhaling', 'ademhalingsstelsel'], en: 'respiratory system anatomy', synonyms: ["Gray's Anatomy respiratory system"] },
  { nl: ['skelet'], en: 'human skeleton anatomy', synonyms: ["Gray's Anatomy skeleton"] },
  { nl: ['ribbenkast'], en: 'rib cage anatomy', synonyms: ["Gray's Anatomy rib cage"] },
  { nl: ['bekken'], en: 'pelvis anatomy', synonyms: ["Gray's Anatomy pelvis"] },
  { nl: ['spieren', 'spierstelsel'], en: 'human muscular system anatomy', synonyms: ["Gray's Anatomy muscles"] },
  { nl: ['armspieren'], en: 'muscles of the arm anatomy', synonyms: ["Gray's Anatomy arm muscles"] },
  { nl: ['beenspieren'], en: 'muscles of the leg anatomy', synonyms: ["Gray's Anatomy leg muscles"] },
  { nl: ['oog'], en: 'eye anatomy', synonyms: ["Gray's Anatomy eye"] },
  { nl: ['oor'], en: 'ear anatomy', synonyms: ["Gray's Anatomy ear"] },
  { nl: ['huid'], en: 'skin anatomy', synonyms: ["Gray's Anatomy skin"] },
  { nl: ['hand', 'handwortelbeentjes', 'middenhandsbeentjes', 'vingers', 'vinger', 'vingerkootjes'], en: 'hand bones anatomy', synonyms: ["Gray's Anatomy hand bones"] },
  { nl: ['voet', 'voeten', 'enkel', 'tenen', 'teen', 'middenvoetsbeentjes', 'voetswortelbeentjes', 'teenkootjes'], en: 'foot bones anatomy', synonyms: ["Gray's Anatomy foot bones"] },
]

function normalize(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function anatomyCandidates(input: string): { canonical: string | null; candidates: string[] } {
  const raw = (input || '').trim()
  if (!raw) return { canonical: null, candidates: [] }

  const n = normalize(raw)
  for (const e of ENTRIES) {
    const matches = e.nl.some((nl) => n.includes(normalize(nl)))
    if (!matches) continue
    const out = [e.en, ...(e.synonyms || [])]
    return { canonical: e.en, candidates: Array.from(new Set(out)) }
  }

  // Heuristic: if it contains Dutch anatomy-ish words, try adding Gray hint.
  const dutchHint = /mens|lichaam|orgaan|skelet|spier|anatom/i.test(n)
  const out = dutchHint ? [`${raw} Gray's Anatomy`, raw] : [raw]
  return { canonical: null, candidates: Array.from(new Set(out)) }
}


