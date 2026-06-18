import mongoose from 'mongoose'

const CVSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nom: String,
  prenom: String,
  template: { type: String, default: 'moderne' },
  formData: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedAt: { type: Date, default: Date.now },
  lastModified: { type: Date, default: Date.now },
})

export default mongoose.models.CV || mongoose.model('CV', CVSchema)
