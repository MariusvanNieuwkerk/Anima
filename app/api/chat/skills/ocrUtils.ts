export const extractMoneyLike = (t: string) => {
  // Capture common money formats: 2,40 / 2.40 / €2,40 / € 2.40
  // We deliberately avoid integers without decimals to reduce false positives.
  const hits =
    (t || '').match(/€\s*\d{1,3}(?:[.,]\d{2})|\b\d{1,3}(?:[.,]\d{2})\b/g) || []

  const normalized = hits
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  // de-dupe while preserving order
  const seen = new Set<string>()
  const out: string[] = []
  for (const h of normalized) {
    if (!seen.has(h)) {
      seen.add(h)
      out.push(h)
    }
  }
  return out
}


