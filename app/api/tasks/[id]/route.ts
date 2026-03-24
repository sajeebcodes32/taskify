// File 3: app/api/tasks/[id]/route.ts
import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Task from '@/models/Task'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await connectDB()
    const task = await Task.findById(id).lean()
    if (!task) return NextResponse.json({ success:false, error:'Task not found' },{ status:404 })
    return NextResponse.json({ success:true, data:task })
  } catch { return NextResponse.json({ success:false, error:'Failed to fetch' },{ status:500 }) }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await connectDB()
    const body = await request.json()
    const task = await Task.findByIdAndUpdate(id, body, { new:true }).lean()
    if (!task) return NextResponse.json({ success:false, error:'Task not found' },{ status:404 })
    return NextResponse.json({ success:true, data:task })
  } catch { return NextResponse.json({ success:false, error:'Failed to update' },{ status:500 }) }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await connectDB()
    const task = await Task.findByIdAndDelete(id).lean()
    if (!task) return NextResponse.json({ success:false, error:'Task not found' },{ status:404 })
    return NextResponse.json({ success:true, data:task })
  } catch { return NextResponse.json({ success:false, error:'Failed to delete' },{ status:500 }) }
}
