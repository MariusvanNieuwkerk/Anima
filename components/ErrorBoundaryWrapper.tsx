'use client'

import React from 'react'
import ErrorBoundary from './ErrorBoundary'

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode
}

export default function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>
}

