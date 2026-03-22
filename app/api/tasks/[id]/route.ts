import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Task from '@/models/Task'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

// PATCH /api/tasks/[id] — update a task (done, name, tag, etc.)
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await connectDB()
    const { id } = await params
    const body = await request.json()

    // If marking done, stamp completedAt
    if (body.done === true) {
      body.completedAt = new Date()
    } else if (body.done === false) {
      body.completedAt = null
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    )

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: task })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    await connectDB()
    const { id } = await params
    const task = await Task.findByIdAndDelete(id)

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: {} })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
