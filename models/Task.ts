import mongoose, { Schema } from 'mongoose';

const TaskSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String },
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    focusMode: { type: Boolean, default: false },
    focusModeStartedAt: { type: Date, default: null },
});

export const Task = mongoose.model('Task', TaskSchema);