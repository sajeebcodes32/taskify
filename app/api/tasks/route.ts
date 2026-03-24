// File 2: app/api/tasks/route.ts
import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Task from '@/models/Task'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await connectDB()
    const tasks = await Task.find({}).sort({ order:1, createdAt:-1 }).lean()
    return NextResponse.json({ success:true, data:tasks })
  } catch { return NextResponse.json({ success:false, error:'Failed to fetch' },{ status:500 }) }
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    if (!body.name?.trim()) return NextResponse.json({ success:false, error:'Name required' },{ status:400 })
    const task = await Task.create({
      name: body.name.trim(), 
      description: body.description||'', 
      status: body.status||'todo',
      priority: body.priority||'medium', 
      dueDate: body.dueDate||null, 
      tags: body.tags||[],
      estimatedMin: body.estimatedMin||25, 
      subtasks: body.subtasks||[], 
      notes: body.notes||'',
      focusMode: body.focusMode||false, 
      focusModeStartedAt: body.focusModeStartedAt||null,
    })
    return NextResponse.json({ success:true, data:task },{ status:201 })
  } catch { return NextResponse.json({ success:false, error:'Failed to create' },{ status:500 }) }
}
