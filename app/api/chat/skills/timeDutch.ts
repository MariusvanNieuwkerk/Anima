export type DutchDaypart = 'morning' | 'afternoon' | 'evening' | null

export const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0')

export const parseDutchDurationMinutes = (t: string) => {
  const text = (t || '').toLowerCase()
  // Matches: "5 uur 25 minuten", "5 uur en 25 minuten", "5 uur", "25 minuten"
  const h = text.match(/(\d{1,2})\s*uur\b/)
  const m = text.match(/(\d{1,2})\s*minu(?:ut|ten)\b/)
  const hours = h ? parseInt(h[1], 10) : 0
  const mins = m ? parseInt(m[1], 10) : 0
  if (!hours && !mins) return null
  return hours * 60 + mins
}

export const parseDutchStartTime = (t: string) => {
  const text = (t || '').toLowerCase()
  // Prefer explicit HH:MM if present
  const hm = text.match(/\b([01]?\d|2[0-3])[:.](\d{2})\b/)
  if (hm) {
    return { hour: parseInt(hm[1], 10), minute: parseInt(hm[2], 10), daypart: null as DutchDaypart }
  }

  // Matches: "om 2 uur", "om 2 uur 's middags", "om 2 uur s middags"
  const hOnly = text.match(/\bom\s*(\d{1,2})\s*uur\b/)
  if (!hOnly) return null

  const hour = parseInt(hOnly[1], 10)
  const minute = 0
  const daypart: DutchDaypart =
    /'s\s*middags|s\s*middags|middag/.test(text) ? 'afternoon' :
    /'s\s*avonds|s\s*avonds|avond/.test(text) ? 'evening' :
    /'s\s*ochtends|s\s*ochtends|ochtend/.test(text) ? 'morning' :
    null

  return { hour, minute, daypart }
}

export const to24Hour = (hour: number, daypart: DutchDaypart) => {
  let h = hour
  if (daypart === 'afternoon' || daypart === 'evening') {
    if (h >= 1 && h <= 11) h += 12
  }
  return h
}

export const extractOptionTimes = (t: string) => {
  // Try to extract multiple-choice options like:
  // 19:25 A / 18:25 B / 08:25 C / 07:25 D  (letters optional)
  const text = (t || '').replace(/[.,]/g, ':')
  const times = text.match(/\b([01]?\d|2[0-3]):(\d{2})\b/g) || []
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const x of times) {
    const norm = x
      .split(':')
      .map((p, i) => (i === 0 ? String(parseInt(p, 10)) : p))
      .join(':')
    if (!seen.has(norm)) {
      seen.add(norm)
      uniq.push(norm)
    }
  }
  return uniq
}

export const solveDutchTimeWordProblem = (t: string) => {
  const text = (t || '').toLowerCase()
  // Heuristic trigger: time + duration + typical keywords
  const looksLikeTimeTask =
    /digitale\s+klok|welke\s+tijd|kaars|brandt|eindtijd|stopt|gaat\s+uit/.test(text) &&
    /\b\d{1,2}\s*uur\b/.test(text) &&
    /\bminu(?:ut|ten)\b/.test(text)
  if (!looksLikeTimeTask) return null

  const start = parseDutchStartTime(text)
  const durMin = parseDutchDurationMinutes(text)
  if (!start || durMin == null) return null

  const startHour24 = to24Hour(start.hour, start.daypart)
  if (Number.isNaN(startHour24) || startHour24 < 0 || startHour24 > 23) return null

  const startTotal = startHour24 * 60 + start.minute
  const endTotal = (startTotal + durMin) % (24 * 60)
  const endHour = Math.floor(endTotal / 60)
  const endMinute = endTotal % 60
  const endHHMM = `${pad2(endHour)}:${pad2(endMinute)}`

  const options = extractOptionTimes(t)
  const matchIndex = options.findIndex((opt) => {
    // Normalize "7:25" vs "07:25"
    const [h, m] = opt.split(':')
    const norm = `${pad2(parseInt(h, 10))}:${m}`
    return norm === endHHMM
  })

  const optionLetter = matchIndex === -1 ? null : ['A', 'B', 'C', 'D'][matchIndex] || null
  return { endHHMM, optionLetter, options }
}

export const solveDutchTimeHoursOnly = (t: string) => {
  // Handles follow-up questions like: "Hoeveel uur is 2 uur 's middags + 5 uur?"
  // We only provide scaffolding (no final hour).
  const text = (t || '').toLowerCase()
  const looksLike =
    /\bhoeveel\s+uur\b/.test(text) &&
    /\b\d{1,2}\s*uur\b/.test(text) &&
    /'s\s*middags|s\s*middags|middag/.test(text)
  if (!looksLike) return null

  const start = parseDutchStartTime(text)
  if (!start) return null

  // Duration hours: take the first "X uur" after a "+" or the last one in the sentence.
  const plusH = text.match(/\+\s*(\d{1,2})\s*uur\b/)
  const allH = Array.from(text.matchAll(/(\d{1,2})\s*uur\b/g)).map((m) => parseInt(m[1], 10))
  const durHours = plusH ? parseInt(plusH[1], 10) : (allH.length >= 2 ? allH[allH.length - 1] : null)
  if (durHours == null || Number.isNaN(durHours)) return null

  const startHour24 = to24Hour(start.hour, start.daypart)
  const startHHMM = `${pad2(startHour24)}:${pad2(start.minute)}`
  return { startHHMM, durHours }
}

export const getDutchTimeWordProblemSteps = (t: string) => {
  const start = parseDutchStartTime(t)
  const durMin = parseDutchDurationMinutes(t)
  if (!start || durMin == null) return null

  const startHour24 = to24Hour(start.hour, start.daypart)
  if (Number.isNaN(startHour24) || startHour24 < 0 || startHour24 > 23) return null

  const startTotal = startHour24 * 60 + start.minute
  const hoursPart = Math.floor(durMin / 60)
  const minsPart = durMin % 60
  const afterHoursTotal = (startTotal + hoursPart * 60) % (24 * 60)

  return {
    startHHMM: `${pad2(Math.floor(startTotal / 60))}:${pad2(startTotal % 60)}`,
    afterHoursHHMM: `${pad2(Math.floor(afterHoursTotal / 60))}:${pad2(afterHoursTotal % 60)}`,
    hoursPart,
    minsPart,
  }
}


