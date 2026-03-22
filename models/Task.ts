import mongoose, { Schema, model, models, Document } from 'mongoose'

export interface ISubtask { id: string; name: string; done: boolean }

export interface ITask extends Document {
  name: string; description: string; status: 'todo'|'inprogress'|'done'
  priority: 'urgent'|'high'|'medium'|'low'; dueDate: Date|null; tags: string[]
  estimatedMin: number; subtasks: ISubtask[]; notes: string; order: number
  createdAt: Date; completedAt: Date|null
}

const SubSchema = new Schema<ISubtask>({id:String,name:String,done:{type:Boolean,default:false}},{_id:false})

const TaskSchema = new Schema<ITask>({
  name:         { type:String, required:true, trim:true, maxlength:200 },
  description:  { type:String, default:'' },
  status:       { type:String, enum:['todo','inprogress','done'], default:'todo' },
  priority:     { type:String, enum:['urgent','high','medium','low'], default:'medium' },
  dueDate:      { type:Date, default:null },
  tags:         { type:[String], default:[] },
  estimatedMin: { type:Number, default:25, min:1, max:480 },
  subtasks:     { type:[SubSchema], default:[] },
  notes:        { type:String, default:'' },
  order:        { type:Number, default:0 },
  completedAt:  { type:Date, default:null },
},{ timestamps:true })

export default models.Task || model<ITask>('Task', TaskSchema)
