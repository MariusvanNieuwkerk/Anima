export type TutorPolicyContext = {
  userLanguage?: string
  messages?: any[]
  lastUserText?: string
}

export type TutorPayload = {
  message: string
  action?: string
  topic?: string | null
  graph?: any
  map?: any
  image?: any
  formula?: any
  [k: string]: any
}

const strip = (s: any) => String(s || '').trim()

export function applyTutorPolicy(payload: TutorPayload, ctx: TutorPolicyContext): TutorPayload {
  const out: TutorPayload = { ...payload }
  const lang = String(ctx.userLanguage || 'nl')
  const lastUser = strip(ctx.lastUserText)

  // 1) Stop signals (student control)
  if (
    lastUser &&
    lastUser.length <= 32 &&
    !/[?¿]/.test(lastUser) &&
    /^(niets|nee\s+hoor|laat\s+maar|stop|klaar|geen\s+vragen|geen\s+verdere\s+vragen|that'?s\s+all|nothing|no\s+thanks)\b[!.]*$/i.test(
      lastUser
    )
  ) {
    const closuresNl = ['Oké. Tot later.', 'Helemaal goed. Tot zo.', 'Prima. Laat maar weten als je nog iets hebt.']
    const closuresEn = ['Okay. See you later.', 'All good. Talk soon.', 'Sure. Let me know if you need anything else.']
    const turn = (Array.isArray(ctx.messages) ? ctx.messages : []).filter((m: any) => m?.role === 'user').length
    const v = ((turn % 3) + 3) % 3
    out.message = lang === 'en' ? closuresEn[v] : closuresNl[v]
    out.action = out.action || 'none'
    return out
  }

  // 2) Low-friction linter: eliminate guess/meta questions (policy-first)
  const msg = strip(out.message)
  const bannedGuess = /(schat|schatten|meer\s+of\s+minder|denk\s+je\s+dat|zou\s+het\s+kunnen|past\s+.*\b(vaker|meer)\b)/i.test(msg)
  const bannedMeta = /(schrijf\s+je\s+berekening|wat\s+is\s+je\s+volgende\s+stap)/i.test(msg)
  if (bannedGuess || bannedMeta) {
    // Attempt to rewrite to a concrete compute/fill-blank step.
    const prevUser = (() => {
      const arr = Array.isArray(ctx.messages) ? ctx.messages : []
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i]
        if (m?.role !== 'user') continue
        const t = strip(m?.content)
        if (!t) continue
        if (/^(ja|nee|yes|no|yep|nope|ok(é|ay)?|top|klopt)\b/i.test(t)) continue
        return t
      }
      return ''
    })()
    const frac = prevUser.match(/(\d+)\s*\/\s*(\d+)/)
    if (frac) {
      const b = frac[2]
      out.message =
        lang === 'en'
          ? `Start with: **${b} × 10 = __**. What is it?`
          : `Begin met: **${b} × 10 = __**. Wat is dat?`
      return out
    }
    out.message =
      lang === 'en'
        ? `Do one concrete step: write **one** calculation you can do right now.`
        : `Doe één concrete stap: schrijf **één** berekening die je nu kunt doen.`
    return out
  }

  return out
}

