export type MapQuery = {
  query: string
  label?: string
  withGeoJson?: boolean
}

export type MapSpec = {
  title?: string
  queries: MapQuery[]
  zoom?: number
}


