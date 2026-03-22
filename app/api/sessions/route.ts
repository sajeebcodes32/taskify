import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Session from '@/models/Session'

export const runtime = 'nodejs'

// GET /api/sessions — fetch today's sessions for stats
export async function GET() {
  try {
    await connectDB()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const sessions = await Session.find({
      startedAt: { $gte: startOfDay },
    })
      .sort({ startedAt: -1 })
      .lean()

    return NextResponse.json({ success: true, data: sessions })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// POST /api/sessions — log a completed pomodoro session
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { taskId, type, durationMin, completedFull } = body

    const session = await Session.create({
      taskId: taskId || null,
      type: type || 'focus',
      durationMin: durationMin || 25,
      completedFull: completedFull ?? false,
      endedAt: new Date(),
    })

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to log session' },
      { status: 500 }
    )
  }
}
