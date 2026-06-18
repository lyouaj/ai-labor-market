import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/apercu/:path*",
    "/prediction/:path*",
    "/recommandation/:path*",
    "/jobly/:path*",
    "/cv-builder/:path*",
    "/profile/:path*",
  ],
}
