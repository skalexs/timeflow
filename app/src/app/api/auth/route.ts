// TimeFlow - Google OAuth2 API routes
import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? 
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? 
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? ''

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') ?? 'login'

  if (action === 'calendars') {
    const token = searchParams.get('access_token')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing access_token' }, { status: 400 })
    }
    return getCalendars(token)
  }

  if (action === 'status') {
    const token = req.cookies.get('google_access_token')?.value
    if (!token) return NextResponse.json({ connected: false })
    return checkTokenStatus(token)
  }

  // Default: login - generate authorization URL
  const state = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64url')
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  })
  const url = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`

  const response = NextResponse.json({ url })
  response.cookies.set('oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 })
  return response
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code } = body

    if (!code) {
      return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })
    }

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    })

    if (!tokenResp.ok) {
      const err = await tokenResp.text()
      return NextResponse.json({ ok: false, error: 'Token exchange failed', detail: err }, { status: 400 })
    }

    const tokenData = await tokenResp.json()
    const { access_token, refresh_token, expires_in } = tokenData

    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userInfo = userInfoResp.ok ? await userInfoResp.json() : {}

    const response = NextResponse.json({
      ok: true,
      email: userInfo.email ?? null,
      name: userInfo.name ?? null,
      picture: userInfo.picture ?? null,
      expires_in,
    })

    const maxAge = expires_in ?? 3600
    response.cookies.set('google_access_token', access_token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge,
    })
    if (refresh_token) {
      response.cookies.set('google_refresh_token', refresh_token, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30,
      })
    }

    return response
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.json({ ok: false, error: 'Callback error' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete('google_access_token')
  response.cookies.delete('google_refresh_token')
  return response
}

async function checkTokenStatus(token: string) {
  try {
    const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return NextResponse.json({ connected: false, error: 'Token expired' })
    const info = await resp.json()
    return NextResponse.json({ connected: true, email: info.email, name: info.name })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

async function getCalendars(accessToken: string) {
  try {
    const resp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!resp.ok) {
      const err = await resp.text()
      return NextResponse.json({ ok: false, error: err }, { status: resp.status })
    }
    const data = await resp.json()
    const calendars = (data.items ?? [])
      .filter((c: { accessRole: string }) => c.accessRole !== 'freeBusyReader')
      .map((c: { id: string; summary: string; primary: boolean; backgroundColor: string }) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary ?? false,
        color: c.backgroundColor ?? '#6366f1',
      }))
    return NextResponse.json({ ok: true, calendars })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
