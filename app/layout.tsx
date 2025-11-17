import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Trade Journal",
  description: "Trading Journal personale",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="bg-[#020617] text-white">

        {/* 🌐 NAVBAR GLOBALE */}
        <nav className="w-full bg-slate-900 border-b border-slate-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">

            <h1 className="text-xl font-bold text-blue-400">
              Trade Journal
            </h1>

            <div className="flex gap-6 text-sm">
              <Link href="/dashboard" className="hover:text-blue-400 transition">
                Dashboard
              </Link>

              <Link href="/journal" className="hover:text-blue-400 transition">
                Journal
              </Link>

              <Link href="/statistics" className="hover:text-blue-400 transition">
                Statistiche
              </Link>
            </div>

          </div>
        </nav>

        <main className="pt-6">{children}</main>

      </body>
    </html>
  );
}
