import { NextResponse } from 'next/server'

type NominatimResult = {
  display_name?: string
  lat?: string
  lon?: string
  boundingbox?: [string, string, string, string]
  geojson?: any
}

function toNumberOrNull(x: unknown): number | null {
  const n = typeof x === 'string' ? Number(x) : typeof x === 'number' ? x : NaN
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const query = String(body?.query || '').trim()
    const withGeoJson = Boolean(body?.withGeoJson ?? true)

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 })
    }

    // Nominatim usage policy requires a valid User-Agent identifying the application.
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')
    if (withGeoJson) url.searchParams.set('polygon_geojson', '1')

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Anima/1.0 (interactive-maps; local-dev)',
        'Accept': 'application/json',
      },
      // Avoid caching incorrect/old geocodes in dev
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `Geocode failed (${res.status})`, details: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const results = (await res.json()) as NominatimResult[]
    const top = results?.[0]
    if (!top) {
      return NextResponse.json({ found: false, query }, { status: 200 })
    }

    const lat = toNumberOrNull(top.lat)
    const lon = toNumberOrNull(top.lon)

    return NextResponse.json(
      {
        found: Boolean(lat != null && lon != null),
        query,
        display_name: top.display_name || query,
        center: lat != null && lon != null ? { lat, lon } : null,
        boundingbox: top.boundingbox || null,
        geojson: withGeoJson ? (top.geojson ?? null) : null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 })
  }
}


