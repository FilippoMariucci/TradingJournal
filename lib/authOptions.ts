import { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Cerca l'utente nel database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        // Controlla la password
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? undefined,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Salva user.id nel token JWT
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
      }
      return token;
    },

    // Inserisce token.id in session.user.id
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = (token as any).id;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
