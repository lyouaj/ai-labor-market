import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/mongodb'
import SavedJob from '@/lib/models/SavedJob'
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

    const jobs = await SavedJob.find({ userId }).sort({ savedAt: -1 })
    return NextResponse.json(jobs)
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

    const newJob = await SavedJob.create({
      userId,
      titre: data.titre,
      entreprise: data.entreprise,
      pays: data.pays,
      lien: data.lien,
      salaire: data.salaire,
      source: data.source || 'Adzuna',
      notes: data.notes || '',
    })
    return NextResponse.json(newJob, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
