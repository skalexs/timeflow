import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code') ?? ''
  const state = searchParams.get('state') ?? ''

  // Redirect to the frontend callback page which handles token exchange
  const frontendCallback = 'https://timeflow.skalexs.duckdns.org/api/auth/callback'
  return NextResponse.redirect(`${frontendCallback}?code=${code}&state=${state}`)
}
