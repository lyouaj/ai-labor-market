import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import connectDB from '@/lib/mongodb'
import User from '@/lib/models/User'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB()
        const user = await User.findOne({ email: credentials.email })
        if (!user) throw new Error('Aucun compte trouvé avec cet email')
        if (!user.password) throw new Error('Ce compte utilise Google. Connectez-vous avec Google.')
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) throw new Error('Mot de passe incorrect')
        return { id: user._id.toString(), name: user.name, email: user.email, image: user.image }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account }) {
      if (account.provider === 'google') {
        await connectDB()
        const existing = await User.findOne({ email: user.email })
        if (!existing) {
          await User.create({
            name: user.name,
            email: user.email,
            image: user.image,
            password: null,
          })
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        await connectDB()
        const dbUser = await User.findOne({ email: user.email })
        if (dbUser) token.userId = dbUser._id.toString()
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId
      return session
    },
  },
}
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
