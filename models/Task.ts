import mongoose, { Schema, model, models, Document } from 'mongoose'

export interface ITask extends Document {
  name: string
  estimatedMin: number
  tag: 'work' | 'personal' | 'urgent'
  done: boolean
  order: number
  createdAt: Date
  completedAt: Date | null
}

const TaskSchema = new Schema<ITask>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    estimatedMin: { type: Number, required: true, min: 5, max: 480 },
    tag: { type: String, enum: ['work', 'personal', 'urgent'], default: 'work' },
    done: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
)

// Prevent model overwrite on hot reload in dev
const Task = models.Task || model<ITask>('Task', TaskSchema)

export default Task
