"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const isLogged = !!session;

  return (
    <nav className="w-full bg-slate-900 border-b border-slate-800 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold text-blue-400">Trade Journal</h1>

        <div className="flex gap-6 text-sm items-center">
          <Link href="/dashboard" className="hover:text-blue-400 transition">
            Dashboard
          </Link>

          <Link href="/journal" className="hover:text-blue-400 transition">
            Journal
          </Link>

          <Link href="/statistics" className="hover:text-blue-400 transition">
            Statistiche
          </Link>

          {isLogged ? (
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-white"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-md text-white rounded-md"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
