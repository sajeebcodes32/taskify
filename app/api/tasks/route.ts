import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Task from '@/models/Task'

export const runtime = 'nodejs'

// GET /api/tasks — fetch all tasks, sorted by order then createdAt
export async function GET() {
  try {
    await connectDB()
    const tasks = await Task.find({}).sort({ order: 1, createdAt: -1 }).lean()
    return NextResponse.json({ success: true, data: tasks })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    )
  }
}

// POST /api/tasks — create a new task
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { name, estimatedMin, tag } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Task name is required' },
        { status: 400 }
      )
    }

    const task = await Task.create({
      name: name.trim(),
      estimatedMin: estimatedMin || 25,
      tag: tag || 'work',
    })

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to create task' },
      { status: 500 }
    )
  }
}
