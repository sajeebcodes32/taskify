import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../util/mongodb';

export async function POST(request) {
    const body = await request.json();
    const { title, description, focusMode, focusModeStartedAt } = body;

    if (!title || !description) {
        return NextResponse.json({ message: 'Title and Description are required.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const task = {  
        title,  
        description,
        focusMode: focusMode || false,
        focusModeStartedAt: focusModeStartedAt || null,
        createdAt: new Date(),
    };

    const response = await db.collection('tasks').insertOne(task);

    return NextResponse.json(response.ops[0], { status: 201 });
}