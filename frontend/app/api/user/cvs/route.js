import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import connectDB from '@/lib/mongodb'
import CV from '@/lib/models/CV'
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

    const cvs = await CV.find({ userId }).sort({ lastModified: -1 })
    return NextResponse.json(cvs)
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
    
    // Check if we are updating an existing CV or creating a new one
    if (data.id) {
      const updated = await CV.findOneAndUpdate(
        { _id: data.id, userId },
        { 
          nom: data.formData.personal?.lastName,
          prenom: data.formData.personal?.firstName,
          template: data.template,
          formData: data.formData,
          lastModified: new Date()
        },
        { new: true }
      )
      return NextResponse.json(updated)
    } else {
      const newCV = await CV.create({
        userId,
        nom: data.formData.personal?.lastName,
        prenom: data.formData.personal?.firstName,
        template: data.template,
        formData: data.formData,
      })
      return NextResponse.json(newCV, { status: 201 })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
