import { NextResponse } from 'next/server'

type WikimediaSearchResult = {
  title: string
  pageid: number
}

type WikimediaImageInfo = {
  url?: string
  descriptionurl?: string
  extmetadata?: Record<string, { value?: string }>
}

function stripHtml(input: string): string {
  return (input || '').replace(/<[^>]*>/g, '').trim()
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
    const synonymCandidates: string[] = []
    if (/\bpituitary\b|\bhypofyse\b/.test(qLower)) synonymCandidates.push('hypophysis')
    if (/\bhypophysis\b/.test(qLower)) synonymCandidates.push('pituitary')

    const baseCandidates = [
      grayHints ? rawQuery : `${rawQuery} "Gray's Anatomy"`,
      grayHints ? rawQuery : `"Gray's Anatomy" ${rawQuery}`,
      grayHints ? rawQuery : `Gray ${rawQuery}`,
      rawQuery,
      ...synonymCandidates.map((s) => (grayHints ? s : `${s} Gray`)),
      ...synonymCandidates,
    ]
    const candidates = Array.from(new Set(baseCandidates.map((s) => s.trim()).filter(Boolean)))

    // 1) Search pages (try several query variants)
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
      searchUrl.searchParams.set('srlimit', String(limit))

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

    // 2) Resolve to imageinfo for first hit that is a File:
    const fileTitle = hits.map((h) => h.title).find((t) => /^File:/i.test(t)) || hits[0].title

    const infoUrl = new URL('https://commons.wikimedia.org/w/api.php')
    infoUrl.searchParams.set('action', 'query')
    infoUrl.searchParams.set('format', 'json')
    infoUrl.searchParams.set('origin', '*')
    infoUrl.searchParams.set('prop', 'imageinfo')
    infoUrl.searchParams.set('titles', fileTitle)
    infoUrl.searchParams.set('iiprop', 'url|extmetadata')
    infoUrl.searchParams.set('iiurlwidth', '1200')

    const infoRes = await fetch(infoUrl.toString(), {
      headers: { 'User-Agent': 'Anima/1.0 (wikimedia-imageinfo)' },
      cache: 'no-store',
    })
    if (!infoRes.ok) {
      const t = await infoRes.text().catch(() => '')
      return NextResponse.json({ error: 'Wikimedia imageinfo failed', details: t.slice(0, 500) }, { status: 502 })
    }

    const infoJson = (await infoRes.json()) as any
    const pages = infoJson?.query?.pages || {}
    const page = Object.values(pages)[0] as any
    const ii = (page?.imageinfo?.[0] || null) as WikimediaImageInfo | null

    if (!ii?.url && !(ii as any)?.thumburl) {
      return NextResponse.json({ found: false, query: rawQuery }, { status: 200 })
    }

    const ext = ii.extmetadata || {}
    const licenseShort = stripHtml(ext.LicenseShortName?.value || '')
    const artist = stripHtml(ext.Artist?.value || '')
    const credit = stripHtml(ext.Credit?.value || '')

    return NextResponse.json(
      {
        found: true,
        query: usedQuery,
        title: fileTitle,
        // Prefer thumburl if present (size bounded), otherwise original
        url: (ii as any).thumburl || ii.url,
        descriptionUrl: ii.descriptionurl || null,
        attribution: {
          artist: artist || null,
          credit: credit || null,
          license: licenseShort || null,
          source: 'Wikimedia Commons',
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}


