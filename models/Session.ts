import { Schema, model, models, Document, Types } from 'mongoose'

export interface ISession extends Document {
  taskId: Types.ObjectId | null
  type: 'focus' | 'short' | 'long'
  durationMin: number
  completedFull: boolean
  startedAt: Date
  endedAt: Date | null
}

const SessionSchema = new Schema<ISession>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    type: { type: String, enum: ['focus', 'short', 'long'], default: 'focus' },
    durationMin: { type: Number, required: true },
    completedFull: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const Session = models.Session || model<ISession>('Session', SessionSchema)

export default Session
