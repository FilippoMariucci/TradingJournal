import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// 🔥 Funzione PNL corretta
function computePnl(result: string | null, amount: number | null, rr: number | null) {
  if (!result || !amount) return 0;

  const r = result.toLowerCase().trim();

  // VINTA
  if (r.includes("presa") || r.includes("vinta")) {
    if (rr && rr > 0) return (amount * rr) / 100;
    return amount;
  }

  // PERSA
  if (r.includes("persa") || r.includes("loss")) return -Math.abs(amount);

  // PAREGGIO
  return 0;
}

// ---------------------------------------------
// GET (pubblico)
// ---------------------------------------------
export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: { importOrder: "asc" },
  });

  return NextResponse.json(trades);
}

// ---------------------------------------------
// POST (solo loggati)
// ---------------------------------------------
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Trova ultimo trade
    const last = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const nextOrder = last ? last.importOrder + 1 : 1;

    const amount = body.amount ? Number(body.amount) : null;
    const rr = body.riskReward ? Number(body.riskReward) : null;

    // 💰 PNL calcolato sempre dal backend
    const pnl = computePnl(body.result, amount, rr);

    // 💰 Equity calcolata sempre dal backend
    const previousEquity = last?.equity ?? 700;
    const newEquity = previousEquity + pnl;

    // CREA TRADE
    const newTrade = await prisma.trade.create({
      data: {
        importOrder: nextOrder,
        tradeNumber: nextOrder,

        date: body.date ? new Date(body.date) : null,
        dayOfWeek: body.dayOfWeek || null,
        currencyPair: body.currencyPair || null,
        positionType: body.positionType || null,
        openTime: body.openTime || null,
        groupType: body.groupType || null,
        result: body.result || null,
        amount,
        riskReward: rr,
        pnl,
        equity: newEquity,
        notes: body.notes || null,

        numericResult: body.numericResult ? Number(body.numericResult) : null,
        ticker: body.ticker || null,
        type: body.type || null,
        entryDate: body.entryDate ? new Date(body.entryDate) : null,
        entryPrice: body.entryPrice ? Number(body.entryPrice) : null,
        quantity: body.quantity ? Number(body.quantity) : null,
        exitDate: body.exitDate ? new Date(body.exitDate) : null,
        exitPrice: body.exitPrice ? Number(body.exitPrice) : null,
      },
    });

    return NextResponse.json(newTrade);
  } catch (err) {
    console.error("POST /api/trades ERROR:", err);
    return NextResponse.json(
      { error: "Errore durante la creazione del trade" },
      { status: 500 }
    );
  }
}
