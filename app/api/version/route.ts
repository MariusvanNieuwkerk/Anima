import { NextResponse } from 'next/server'

// Simple diagnostic endpoint to compare deployments across devices.
// Useful when iOS Safari caches old JS bundles or users have different local settings.
export const runtime = 'nodejs'

export async function GET() {
  const payload = {
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null,
    gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    gitCommitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    buildId: process.env.NEXT_BUILD_ID || null,
    nodeEnv: process.env.NODE_ENV || null,
    serverTime: new Date().toISOString(),
  }

  return NextResponse.json(payload, {
    headers: {
      // Avoid CDN/browser caching so two devices compare in real time.
      'Cache-Control': 'no-store',
    },
  })
}


