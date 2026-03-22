import { NextResponse } from 'next/server'
import connectDB from '@/lib/db'
import Task from '@/models/Task'
export const runtime = 'nodejs'
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    if (body.status === 'done' && !body.completedAt) body.completedAt = new Date()
    if (body.status && body.status !== 'done') body.completedAt = null
    const task = await Task.findByIdAndUpdate(id, { $set: body }, { new:true, runValidators:true })
    if (!task) return NextResponse.json({ success:false, error:'Not found' },{ status:404 })
    return NextResponse.json({ success:true, data:task })
  } catch { return NextResponse.json({ success:false, error:'Failed to update' },{ status:500 }) }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await connectDB()
    const { id } = await params
    const task = await Task.findByIdAndDelete(id)
    if (!task) return NextResponse.json({ success:false, error:'Not found' },{ status:404 })
    return NextResponse.json({ success:true, data:{} })
  } catch { return NextResponse.json({ success:false, error:'Failed to delete' },{ status:500 }) }
}
