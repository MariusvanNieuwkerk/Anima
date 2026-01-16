'use client'

import { useEffect } from 'react'

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

export default function DemoModeInit() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const demo = params.get('demo')

      if (demo === 'premium') {
        localStorage.setItem('anima_demo_premium', '1')
        setCookie('anima_demo_premium', '1', 60 * 60 * 24 * 30)
      } else if (demo === 'off') {
        localStorage.removeItem('anima_demo_premium')
        setCookie('anima_demo_premium', '0', 0)
      }
    } catch {
      // ignore
    }
  }, [])

  return null
}


