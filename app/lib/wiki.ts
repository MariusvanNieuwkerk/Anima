export type WikiImageResult = {
  found: boolean
  url?: string
  title?: string
  caption?: string
  extract?: string
  pageUrl?: string
}

export async function searchWikimedia(query: string): Promise<WikiImageResult> {
  const raw = String(query || '').trim()
  if (!raw) return { found: false }

  // Prefer Wikimedia Commons (File namespace) so we can pick *diagrams* instead of random Wikipedia thumbnails.
  // Also normalize a few common Dutch educational queries to canonical English terms.
  const normalized = (() => {
    const q = raw.toLowerCase()
    if (q.includes('fotosynthese')) return 'photosynthesis diagram'
    return raw
  })()

  const scoreTitle = (title: string, q: string): number => {
    const t = (title || '').toLowerCase()
    const qq = (q || '').toLowerCase()
    let score = 0

    // Prefer vector diagrams
    if (t.includes('.svg')) score += 60
    if (t.includes('.png')) score += 25
    if (t.includes('.jpg') || t.includes('.jpeg')) score += 10

    // Prefer educational diagrams/schemas/cycles
    if (/(diagram|schema|cycle|process|pathway|reaction|equation)/.test(t)) score += 30

    // Penalize scans/docs/covers
    if (t.includes('.pdf') || t.includes('.djvu')) score -= 80
    if (/(cover|front cover|title page|scan|page)/.test(t)) score -= 35

    // Query overlap
    const keywords = qq
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
    for (const w of keywords) {
      if (t.includes(w)) score += 6
    }

    // Special bias: photosynthesis should strongly prefer diagrams/cycles
    if (qq.includes('photosynthesis')) {
      if (t.includes('photosynthesis')) score += 25
      if (/(diagram|cycle|process|pathway)/.test(t)) score += 20
    }

    return score
  }

  const fetchImageInfoByTitle = async (fileTitle: string) => {
    const infoUrl = new URL('https://commons.wikimedia.org/w/api.php')
    infoUrl.searchParams.set('action', 'query')
    infoUrl.searchParams.set('format', 'json')
    infoUrl.searchParams.set('origin', '*')
    infoUrl.searchParams.set('prop', 'imageinfo')
    infoUrl.searchParams.set('titles', fileTitle)
    infoUrl.searchParams.set('iiprop', 'url|mime|mediatype')
    infoUrl.searchParams.set('iiurlwidth', '1200')

    const infoRes = await fetch(infoUrl.toString(), {
      headers: { 'User-Agent': 'Anima/1.0 (wikimedia-imageinfo)' },
      cache: 'no-store',
    })
    if (!infoRes.ok) return null

    const infoJson: any = await infoRes.json()
    const pages = infoJson?.query?.pages || {}
    const page = Object.values(pages)[0] as any
    const ii = (page?.imageinfo?.[0] || null) as any
    const mime = String(ii?.mime || '').toLowerCase()
    const mediatype = String(ii?.mediatype || '').toLowerCase()
    if (mime.includes('pdf') || mediatype === 'document') return null

    const url = ii?.thumburl || ii?.url
    const descriptionUrl = ii?.descriptionurl
    if (!url) return null

    return { url: String(url), descriptionUrl: typeof descriptionUrl === 'string' ? descriptionUrl : undefined }
  }

  const candidates = (() => {
    const q = normalized
    const base: string[] = [q]
    // Encourage diagram-like results
    base.unshift(`${q} diagram`)
    base.unshift(`${q} schema`)
    base.unshift(`${q} cycle`)
    base.unshift(`${q} filetype:svg`)
    base.unshift(`${q} svg`)
    return Array.from(new Set(base.map((s) => s.trim()).filter(Boolean)))
  })()

  let hits: string[] = []
  for (const q of candidates) {
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
    searchUrl.searchParams.set('action', 'query')
    searchUrl.searchParams.set('format', 'json')
    searchUrl.searchParams.set('origin', '*')
    searchUrl.searchParams.set('list', 'search')
    searchUrl.searchParams.set('srnamespace', '6') // File:
    searchUrl.searchParams.set('srlimit', '12')
    searchUrl.searchParams.set('srsearch', q)

    const res = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'Anima/1.0 (wikimedia-search)' },
      cache: 'no-store',
    })
    if (!res.ok) continue

    const json: any = await res.json()
    const searchHits: any[] = Array.isArray(json?.query?.search) ? json.query.search : []
    const titles = searchHits.map((h) => String(h?.title || '')).filter((t) => /^File:/i.test(t))
    if (titles.length) {
      hits = titles
      break
    }
  }

  if (!hits.length) return { found: false }

  const ranked = hits.sort((a, b) => scoreTitle(b, normalized) - scoreTitle(a, normalized))
  for (const fileTitle of ranked.slice(0, 8)) {
    const info = await fetchImageInfoByTitle(fileTitle)
    if (!info?.url) continue
    const caption = fileTitle.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ')
    return {
      found: true,
      url: info.url,
      title: fileTitle,
      caption,
      pageUrl: info.descriptionUrl,
    }
  }

  return { found: false }
}


