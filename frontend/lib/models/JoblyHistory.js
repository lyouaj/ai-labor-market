import mongoose from 'mongoose'

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false })

const JoblyHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  model: { type: String, default: 'gemini' },
  messages: [MessageSchema],
  sessionDate: { type: Date, default: Date.now },
})

export default mongoose.models.JoblyHistory || mongoose.model('JoblyHistory', JoblyHistorySchema)
