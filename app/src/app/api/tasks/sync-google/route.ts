import { NextRequest, NextResponse } from 'next/server'
import { syncGoogleToLocal } from '@/services/GoogleTasksSync'

// POST /api/tasks/sync-google — sincroniza Google Tasks → TimeFlow
// Triggered: on inbox load, or manual refresh
// @deprecated Use POST /api/inbox/sync for two-way sync
export async function POST(req: NextRequest) {
  try {
    const result = await syncGoogleToLocal(req)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
