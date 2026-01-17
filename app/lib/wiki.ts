export type WikiImageResult = {
  found: boolean
  url?: string
  title?: string
  caption?: string
  extract?: string
  pageUrl?: string
}

export async function searchWikimedia(query: string): Promise<WikiImageResult> {
  const q = String(query || '').trim()
  if (!q) return { found: false }

  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    q
  )}&gsrlimit=1&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=1000&exintro=1&explaintext=1&format=json&origin=*`

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { found: false }

  const json: any = await res.json()
  const pages = json?.query?.pages
  if (!pages || typeof pages !== 'object') return { found: false }

  const firstKey = Object.keys(pages)[0]
  const page = pages[firstKey]
  const thumb = page?.thumbnail?.source
  if (!thumb) {
    return {
      found: false,
      title: page?.title,
      extract: typeof page?.extract === 'string' ? page.extract : undefined,
    }
  }

  const pageid = page?.pageid
  const pageUrl = typeof pageid === 'number' ? `https://en.wikipedia.org/?curid=${pageid}` : undefined

  const title = typeof page?.title === 'string' ? page.title : undefined
  const extract = typeof page?.extract === 'string' ? page.extract : undefined

  return {
    found: true,
    url: String(thumb),
    title,
    caption: title,
    extract,
    pageUrl,
  }
}


