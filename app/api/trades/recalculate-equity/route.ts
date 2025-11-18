import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";


export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 401 }
    );
  }


function computeDisplayPnl(result: string | null, amount: number | null, pnl: number | null) {
  if (pnl !== null && pnl !== undefined) return Number(pnl);

  if (!result || !amount) return 0;

  const res = result.toLowerCase();

  if (res.includes("presa")) return Math.abs(amount);
  if (res.includes("persa")) return -Math.abs(amount);

  return 0;
}

export async function POST() {
  try {
    let equity = 700; // equity iniziale

    const trades = await prisma.trade.findMany({
      orderBy: { importOrder: "asc" },
    });

    for (const t of trades) {
      const pnl = computeDisplayPnl(t.result, t.amount, t.pnl);
      equity += pnl;

      await prisma.trade.update({
        where: { id: t.id },
        data: { pnl, equity },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Equity ricalcolata correttamente",
    });

  } catch (err) {
    console.error("RECALC EQUITY ERROR", err);
    return NextResponse.json(
      { error: "Errore durante il ricalcolo dell'equity" },
      { status: 500 }
    );
  }
}
