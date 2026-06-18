import mongoose from 'mongoose'

const PredictionHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pays: { type: String, required: true },
  secteur: String,
  periode: { type: String, default: 'quarterly' },
  results: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.PredictionHistory || mongoose.model('PredictionHistory', PredictionHistorySchema)
