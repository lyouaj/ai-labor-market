import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/mongodb'
import PredictionHistory from '@/lib/models/PredictionHistory'
import User from '@/lib/models/User'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    await connectDB()
    let userId = session?.user?.id
    if (!userId) {
      const dbUser = await User.findOne({ email: session.user.email })
      if (dbUser) userId = dbUser._id
    }
    if (!userId) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const predictions = await PredictionHistory.find({ userId }).sort({ createdAt: -1 })
    return NextResponse.json(predictions)
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  try {
    const data = await req.json()
    await connectDB()
    let userId = session?.user?.id
    if (!userId) {
      const dbUser = await User.findOne({ email: session.user.email })
      if (dbUser) userId = dbUser._id
    }
    if (!userId) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const newPrediction = await PredictionHistory.create({
      userId,
      pays: data.pays,
      secteur: data.secteur || null,
      periode: data.periode,
      results: data.results,
    })
    return NextResponse.json(newPrediction, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
