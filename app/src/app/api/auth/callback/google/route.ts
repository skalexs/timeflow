import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code') ?? ''
  const state = searchParams.get('state') ?? ''

  // GOOGLE_REDIRECT_URI = https://timeflow.skalexs.duckdns.org/api/auth/callback/google
  // Strip /google to get the frontend callback page: /api/auth/callback
  const baseCallback = (process.env.GOOGLE_REDIRECT_URI ?? '').replace('/google', '')
  return NextResponse.redirect(`${baseCallback}?code=${code}&state=${state}`)
}
