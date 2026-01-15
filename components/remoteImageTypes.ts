export type RemoteImageSpec = {
  src?: string
  query?: string
  caption?: string
  sourceUrl?: string
  attribution?: {
    source?: string
    artist?: string | null
    credit?: string | null
    license?: string | null
  }
}


