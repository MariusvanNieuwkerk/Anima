'use client'

import React from 'react'

type Props = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

type State = { hasError: boolean; message: string }

export default class InlineErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[INLINE ERROR BOUNDARY] Caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-5 text-stone-700">
              <div className="font-medium mb-1">Grafiek kon niet laden</div>
              <div className="text-sm text-stone-600">Ververs de pagina of probeer een eenvoudigere formule.</div>
              <div className="mt-3 text-xs text-stone-500 break-words">{this.state.message}</div>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}


