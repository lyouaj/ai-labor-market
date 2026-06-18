import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/mongodb'
import Recommendation from '@/lib/models/Recommendation'
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

    const recos = await Recommendation.find({ userId }).sort({ createdAt: -1 })
    return NextResponse.json(recos)
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

    const newReco = await Recommendation.create({
      userId,
      formData: data.formData,
      results: data.results,
    })
    return NextResponse.json(newReco, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
