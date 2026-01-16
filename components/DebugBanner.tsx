'use client'

import { useEffect, useMemo, useState } from 'react'

type VersionInfo = {
  vercelEnv: string | null
  vercelUrl: string | null
  gitCommitSha: string | null
  gitCommitRef: string | null
  gitCommitMessage: string | null
  deploymentId: string | null
  buildId: string | null
  nodeEnv: string | null
  serverTime: string | null
}

type Props = {
  enabled: boolean
  tutorMode: string
  language: string
  age: number
  sessionId: string
  userRole?: string
}

export default function DebugBanner({
  enabled,
  tutorMode,
  language,
  age,
  sessionId,
  userRole,
}: Props) {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const shortSha = useMemo(() => {
    const sha = info?.gitCommitSha
    return sha ? sha.slice(0, 7) : null
  }, [info?.gitCommitSha])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      try {
        setErr(null)
        const r = await fetch('/api/version', { cache: 'no-store' as any })
        const j = await r.json()
        if (!cancelled) setInfo(j)
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'failed to load /api/version')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div className="fixed bottom-2 left-2 z-[200] max-w-[95vw]">
      <div className="rounded-xl border border-stone-300 bg-white/90 backdrop-blur px-3 py-2 shadow-sm text-[11px] leading-snug text-stone-700">
        <div className="font-semibold text-stone-800">Debug</div>
        <div>
          <span className="font-medium">Settings:</span> mode={tutorMode} lang={language} age={age} role={userRole || 'unknown'}
        </div>
        <div>
          <span className="font-medium">Session:</span> {sessionId ? sessionId.slice(0, 8) : '(none)'}
        </div>
        <div>
          <span className="font-medium">Deploy:</span>{' '}
          {info ? (
            <>
              {info.vercelEnv || 'vercel?'} {shortSha ? `@${shortSha}` : ''}{' '}
              {info.gitCommitRef ? `(${info.gitCommitRef})` : ''}
            </>
          ) : err ? (
            <span className="text-red-700">/api/version error: {err}</span>
          ) : (
            'loading...'
          )}
        </div>
      </div>
    </div>
  )
}


