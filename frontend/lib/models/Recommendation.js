import mongoose from 'mongoose'

const RecommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  formData: {
    email: String,
    niveau: String,
    diplome: String,
    anneeObtention: String,
    competences: [String],
    experience: String,
    langues: [String],
    disponibilite: String,
    typeTravail: String,
    paysCible: String,
  },
  results: {
    secteurs: [String],
    domaines: [String],
    pays: [String],
    competencesAcquerir: [String],
    conseil: String,
  },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.Recommendation || mongoose.model('Recommendation', RecommendationSchema)
