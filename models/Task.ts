import mongoose, { Schema, model, models, Document } from 'mongoose'

export interface ISubtask {
  id: string
  name: string
  done: boolean
}

export interface ITask extends Document {
  name: string
  estimatedMin: number
  tag: 'work' | 'personal' | 'urgent'
  done: boolean
  notes: string
  subtasks: ISubtask[]
  order: number
  createdAt: Date
  completedAt: Date | null
}

const SubtaskSchema = new Schema<ISubtask>(
  { id: String, name: String, done: { type: Boolean, default: false } },
  { _id: false }
)

const TaskSchema = new Schema<ITask>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    estimatedMin: { type: Number, required: true, min: 5, max: 480 },
    tag: { type: String, enum: ['work', 'personal', 'urgent'], default: 'work' },
    done: { type: Boolean, default: false },
    notes: { type: String, default: '', maxlength: 1000 },
    subtasks: { type: [SubtaskSchema], default: [] },
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const Task = models.Task || model<ITask>('Task', TaskSchema)
export default Task
