import { NextResponse } from 'next/server'
import { anatomyCandidates } from '@/utils/anatomyDictionary'

type WikimediaSearchResult = {
  title: string
  pageid: number
}

type WikimediaImageInfo = {
  url?: string
  mime?: string
  mediatype?: string
  descriptionurl?: string
  extmetadata?: Record<string, { value?: string }>
}

function stripHtml(input: string): string {
  return (input || '').replace(/<[^>]*>/g, '').trim()
}

function scoreTitle(title: string, rawQuery: string): number {
  const t = (title || '').toLowerCase()
  const q = (rawQuery || '').toLowerCase()
  let score = 0

  // Prefer diagram-like assets and vector formats
  if (t.includes('.svg')) score += 40
  if (t.includes('diagram') || t.includes('proof') || t.includes('theorem') || t.includes('schema')) score += 20

  // Strongly penalize document containers and scan-like formats
  if (t.includes('.pdf') || t.includes('.djvu')) score -= 60
  if (t.includes('.tif') || t.includes('.tiff')) score -= 40

  // Penalize likely scans/covers/backgrounds
  if (t.includes('cover') || t.includes('front') || t.includes('title page')) score -= 30
  if (t.includes('scan') || t.includes('page') || t.includes('plate')) score -= 10

  // Basic query overlap
  const keywords = q
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
  const overlap = keywords.reduce((acc, w) => (t.includes(w) ? acc + 1 : acc), 0)
  score += overlap * 5

  return score
}

function likelyBadAsset(title: string): boolean {
  const t = (title || '').toLowerCase()
  // Avoid generic book covers/scans when we want a clean diagram
  return (
    t.includes('cover') ||
    t.includes('title page') ||
    t.includes('front cover') ||
    t.includes('.pdf') ||
    t.includes('.djvu')
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawQuery = String(body?.query || '').trim()
    const limit = Math.min(5, Math.max(1, Number(body?.limit || 1)))

    if (!rawQuery) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

    // We bias toward Gray's Anatomy plates, but keep the search broad enough to actually find results.
    const qLower = rawQuery.toLowerCase()
    const grayHints = /gray|grays|gray's/.test(qLower)
    const dict = anatomyCandidates(rawQuery)
    const synonymCandidates: string[] = []
    if (/\bpituitary\b|\bhypofyse\b/.test(qLower)) synonymCandidates.push('hypophysis')
    if (/\bhypophysis\b/.test(qLower)) synonymCandidates.push('pituitary')

    const baseCandidates = [
      grayHints ? rawQuery : `${rawQuery} "Gray's Anatomy"`,
      grayHints ? rawQuery : `"Gray's Anatomy" ${rawQuery}`,
      grayHints ? rawQuery : `Gray ${rawQuery}`,
      rawQuery,
      ...dict.candidates,
      ...synonymCandidates.map((s) => (grayHints ? s : `${s} Gray`)),
      ...synonymCandidates,
    ]
    // For "standard diagram" lookups, prioritize vector/bitmap diagrams over scanned documents.
    const diagramHint = /diagram|proof|theorem|model|spectrum|cycle|symbols|curve/i.test(rawQuery)
    const filetypeCandidates = diagramHint
      ? [
          `${rawQuery} filetype:svg`,
          `${rawQuery} filetype:png`,
          `${rawQuery} filetype:jpg`,
          `${rawQuery} svg diagram`,
        ]
      : []
    const candidates = Array.from(new Set(baseCandidates.map((s) => s.trim()).filter(Boolean)))
    if (filetypeCandidates.length) {
      for (const c of filetypeCandidates) candidates.unshift(c)
    }

    // 1) Search pages (try several query variants). We gather hits, then rank.
    let hits: WikimediaSearchResult[] = []
    let usedQuery = rawQuery
    for (const q of candidates) {
      const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
      searchUrl.searchParams.set('action', 'query')
      searchUrl.searchParams.set('format', 'json')
      searchUrl.searchParams.set('origin', '*')
      searchUrl.searchParams.set('list', 'search')
      searchUrl.searchParams.set('srsearch', q)
      // File namespace only (images)
      searchUrl.searchParams.set('srnamespace', '6')
      // Pull more than 1 so we can pick a better diagram, even if the first is a scan/cover
      searchUrl.searchParams.set('srlimit', String(Math.max(limit, 5)))

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { 'User-Agent': 'Anima/1.0 (wikimedia-search)' },
        cache: 'no-store',
      })
      if (!searchRes.ok) continue
      const searchJson = (await searchRes.json()) as any
      const candidateHits = (searchJson?.query?.search || []) as WikimediaSearchResult[]
      if (candidateHits.length) {
        hits = candidateHits
        usedQuery = q
        break
      }
    }

    if (!hits.length) return NextResponse.json({ found: false, query: rawQuery }, { status: 200 })

    // 2) Rank file titles and resolve imageinfo for the best one.
    const fileTitles = hits
      .map((h) => h.title)
      .filter((t) => /^File:/i.test(t))
      .filter((t) => !likelyBadAsset(t))

    const ranked = (fileTitles.length ? fileTitles : hits.map((h) => h.title)).sort(
      (a, b) => scoreTitle(b, rawQuery) - scoreTitle(a, rawQuery)
    )

    // Try top-N candidates until we get a usable url.
    for (const fileTitle of ranked.slice(0, Math.max(limit, 5))) {
      const infoUrl = new URL('https://commons.wikimedia.org/w/api.php')
      infoUrl.searchParams.set('action', 'query')
      infoUrl.searchParams.set('format', 'json')
      infoUrl.searchParams.set('origin', '*')
      infoUrl.searchParams.set('prop', 'imageinfo')
      infoUrl.searchParams.set('titles', fileTitle)
      infoUrl.searchParams.set('iiprop', 'url|extmetadata|mime|mediatype')
      infoUrl.searchParams.set('iiurlwidth', '1200')

      const infoRes = await fetch(infoUrl.toString(), {
        headers: { 'User-Agent': 'Anima/1.0 (wikimedia-imageinfo)' },
        cache: 'no-store',
      })
      if (!infoRes.ok) continue

      const infoJson = (await infoRes.json()) as any
      const pages = infoJson?.query?.pages || {}
      const page = Object.values(pages)[0] as any
      const ii = (page?.imageinfo?.[0] || null) as WikimediaImageInfo | null

      // Skip document containers (PDF/DjVu) which often render as "black page scans"
      const mime = (ii?.mime || '').toLowerCase()
      const mediatype = (ii?.mediatype || '').toLowerCase()
      if (mime.includes('pdf') || mediatype === 'document') continue

      const url = (ii as any)?.thumburl || ii?.url
      if (!url) continue

      const ext = ii?.extmetadata || {}
      const licenseShort = stripHtml(ext.LicenseShortName?.value || '')
      const artist = stripHtml(ext.Artist?.value || '')
      const credit = stripHtml(ext.Credit?.value || '')

      return NextResponse.json(
        {
          found: true,
          query: usedQuery,
          title: fileTitle,
          url,
          descriptionUrl: ii?.descriptionurl || null,
          attribution: {
            artist: artist || null,
            credit: credit || null,
            license: licenseShort || null,
            source: 'Wikimedia Commons',
          },
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ found: false, query: rawQuery }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


