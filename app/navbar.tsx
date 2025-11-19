"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session } = useSession();
  const isLogged = !!session;

  return (
    <nav className="w-full bg-[#111827] border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
      <div className="text-xl font-bold text-white">
        Trade Journal
      </div>

      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="text-neutral-300 hover:text-white">
          Dashboard
        </Link>

        <Link href="/journal" className="text-neutral-300 hover:text-white">
          Journal
        </Link>

        <Link href="/statistics" className="text-neutral-300 hover:text-white">
          Statistiche
        </Link>

        {/* ⭐ NUOVO LINK */}
        <Link
          href="/money-management"
          className="text-neutral-300 hover:text-white"
        >
          Money Management
        </Link>

        {!isLogged ? (
          <button
            onClick={() => signIn()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Login
          </button>
        ) : (
          <button
            onClick={() => signOut()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
