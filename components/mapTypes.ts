export type MapQuery = {
  query: string
  label?: string
  withGeoJson?: boolean
}

export type MapSpec = {
  title?: string
  // If provided, the map can render directly without geocoding queries.
  center?: { lat: number; lon: number }
  markers?: Array<{ lat: number; lon: number; label?: string }>
  queries?: MapQuery[]
  zoom?: number
}


