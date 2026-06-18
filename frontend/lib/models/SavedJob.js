import mongoose from 'mongoose'

const SavedJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  titre: { type: String, required: true },
  entreprise: String,
  pays: String,
  lien: String,
  salaire: String,
  source: { type: String, default: 'Adzuna' },
  notes: { type: String, default: '' },
  savedAt: { type: Date, default: Date.now },
})

export default mongoose.models.SavedJob || mongoose.model('SavedJob', SavedJobSchema)
