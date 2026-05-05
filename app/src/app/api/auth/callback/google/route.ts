import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code') ?? ''
  const state = searchParams.get('state') ?? ''

  // Redirect to the frontend callback page which handles token exchange
  // This must match GOOGLE_REDIRECT_URI registered in Google OAuth
  const frontendCallback = `${process.env.GOOGLE_REDIRECT_URI}/google`
  return NextResponse.redirect(`${frontendCallback}?code=${code}&state=${state}`)
}
