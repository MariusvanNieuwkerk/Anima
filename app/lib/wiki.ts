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

  // Curator policy (Blueprint V10):
  // - Prefer factual representations: photos, recognized artwork photos, recognized anatomy plates.
  // - Avoid abstract diagrams and user-generated schema’s unless explicitly requested.
  const rawLower = raw.toLowerCase()
  const normalized = raw

  type CuratorKind = 'photo' | 'art' | 'anatomy' | 'diagram'
  const kind: CuratorKind = (() => {
    if (/\bdiagram\b|\bschema\b|\bchart\b|\bgraph\b/.test(rawLower)) return 'diagram'
    if (
      /anatomie|anatomy|grays|gray's|gray\b|skelet|bot|botten|orgaan|organen|spier|spieren|zenuw|rib|schedel|hart|long|lever|nier|huid/.test(
        rawLower
      )
    )
      return 'anatomy'
    if (
      /mona lisa|nachtwacht|rembrandt|leonardo|van gogh|vermeer|picasso|da vinci|schilderij|painting|artwork|masterpiece|sculpture|beeldhouwwerk/.test(
        rawLower
      )
    )
      return 'art'
    return 'photo'
  })()

  const scoreTitle = (title: string, q: string, k: CuratorKind): number => {
    const t = (title || '').toLowerCase()
    const qq = (q || '').toLowerCase()
    let score = 0

    // Format preference depends on kind.
    if (k === 'diagram') {
      if (t.includes('.svg')) score += 40
      if (t.includes('.png')) score += 20
      if (t.includes('.jpg') || t.includes('.jpeg')) score += 10
      if (/(diagram|schema|cycle|process|pathway|reaction|equation)/.test(t)) score += 25
    } else {
      // photo / art / anatomy: prefer raster images, avoid SVG “diagrammy” assets by default.
      if (t.includes('.jpg') || t.includes('.jpeg')) score += 35
      if (t.includes('.png')) score += 25
      if (t.includes('.webp')) score += 20
      if (t.includes('.gif')) score += 5
      if (t.includes('.svg')) score -= 80
      if (/(diagram|schema|chart|graph|infographic|vector)/.test(t)) score -= 60
    }

    // Strongly penalize non-realistic “fallback” style assets
    if (/(cartoon|clipart|icon|emoji|pictogram|puzzle|stick figure)/.test(t)) score -= 120

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

    // Art bias: Mona Lisa should prefer the canonical painting photo, not derivatives/crops
    if (k === 'art' && qq.includes('mona') && qq.includes('lisa')) {
      if (t.includes('mona') && t.includes('lisa')) score += 25
      if (t.includes('c2rmf')) score += 25
      if (t.includes('retouched')) score += 10
      if (/(headcrop|crop|sketch|student|derivative|parody)/.test(t)) score -= 30
    }

    // Anatomy plates are usually illustrations/plates/engravings (acceptable).
    if (k === 'anatomy') {
      if (/(gray|grays|gray's)/.test(t)) score += 20
      if (/(plate|anatomy|dissection|muscle|skeleton|organ)/.test(t)) score += 10
      // Avoid modern clipart icons even if tagged “anatomy”.
      if (/(icon|clipart|cartoon)/.test(t)) score -= 120
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

    return {
      url: String(url),
      descriptionUrl: typeof descriptionUrl === 'string' ? descriptionUrl : undefined,
      mime,
    }
  }

  // 0) Deterministic presets for canonical, high-frequency requests.
  // This avoids “nothing shows up” when search happens to return odd/no results.
  const preferredFileTitlesForQuery = (q: string): string[] => {
    const t = (q || '').toLowerCase()
    // De Nachtwacht / The Night Watch (Rembrandt)
    if (t.includes('nachtwacht') || (t.includes('night') && t.includes('watch') && t.includes('rembrandt'))) {
      return [
        'File:The Night Watch - HD.jpg',
        'File:The Nightwatch by Rembrandt - Rijksmuseum.jpg',
        'File:La ronda de noche, por Rembrandt van Rijn.jpg',
      ]
    }
    // Mona Lisa (Leonardo da Vinci)
    if (t.includes('mona lisa') || t.includes('monalisa') || (t.includes('mona') && t.includes('lisa'))) {
      return [
        'File:Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg',
        'File:Mona Lisa.jpg',
      ]
    }
    return []
  }

  const preferred = preferredFileTitlesForQuery(raw)
  for (const fileTitle of preferred) {
    const info = await fetchImageInfoByTitle(fileTitle)
    if (!info?.url) continue
    const caption = fileTitle
      .replace(/^File:/i, '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/_/g, ' ')
    return {
      found: true,
      url: info.url,
      title: fileTitle,
      caption,
      pageUrl: info.descriptionUrl,
    }
  }

  const candidates = (() => {
    const q = normalized
    const base: string[] = [q]
    // For factual “real world” visuals, bias toward photo/commons file types.
    if (kind === 'photo' || kind === 'art' || kind === 'anatomy') {
      base.unshift(`${q} filetype:jpg`)
      base.unshift(`${q} filetype:jpeg`)
      base.unshift(`${q} filetype:png`)
      base.unshift(`${q} photograph`)
    } else {
      // Only if explicitly requested.
      base.unshift(`${q} diagram`)
      base.unshift(`${q} schema`)
      base.unshift(`${q} filetype:svg`)
    }
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
    searchUrl.searchParams.set('srlimit', '20')
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

  const ranked = hits.sort((a, b) => scoreTitle(b, normalized, kind) - scoreTitle(a, normalized, kind))
  // Quality gate: if the best match is weak, prefer returning no image over a wrong one.
  const bestScore = ranked.length ? scoreTitle(ranked[0], normalized, kind) : -999
  const threshold = kind === 'photo' ? 45 : kind === 'art' ? 35 : kind === 'anatomy' ? 30 : 20
  if (bestScore < threshold) return { found: false }

  for (const fileTitle of ranked.slice(0, 8)) {
    const info = await fetchImageInfoByTitle(fileTitle)
    if (!info?.url) continue

    // MIME/type gate per policy.
    const mime = String((info as any).mime || '')
    const isRaster =
      mime.startsWith('image/jpeg') || mime.startsWith('image/png') || mime.startsWith('image/webp') || mime.startsWith('image/gif')
    const isSvg = mime.includes('svg')
    if (kind !== 'diagram') {
      // No SVGs for factual images unless explicitly requested.
      if (isSvg) continue
      // Prefer raster for “real world” and artwork/anatomy plates.
      if (!isRaster) continue
    }

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


