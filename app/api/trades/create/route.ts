import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅


// 🔥 Calcolo PnL coerente con percentuale
function computeDisplayPnl(
  result: string | null,
  amount: number | null,
  rr: number | null
) {
  if (!result || !amount) return 0;

  const res = result.toLowerCase().trim();

  // ➕ PRESA → amount * rr%
  if (res.includes("presa")) {
    if (rr && rr > 0) return (amount * rr) / 100; // esatto per OTC
    return amount; // fallback
  }

  // ➖ PERSA → sempre -amount
  if (res.includes("persa")) {
    return -Math.abs(amount);
  }

  // 🟰 PAREGGIO / PARI
  return 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const amount = body.amount ? Number(body.amount) : null;
    const rr = body.riskReward ? Number(body.riskReward) : null;

    // 🔥 Calcolo PnL corretto
    const pnl = computeDisplayPnl(body.result, amount, rr);

    // Recupero ultimo trade per equity e importOrder
    const last = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const previousEquity = last?.equity ?? 700; // equity iniziale
    const newEquity = previousEquity + pnl;

    const newOrder = (last?.importOrder ?? 0) + 1;

    // 🔥 CREAZIONE TRADE
    const trade = await prisma.trade.create({
      data: {
        importOrder: newOrder,

        date: body.date ? new Date(body.date) : null,
        dayOfWeek: body.dayOfWeek || null,
        currencyPair: body.currencyPair || null,
        positionType: body.positionType || null,
        openTime: body.openTime || null,
        groupType: body.groupType || null,

        result: body.result || null,
        amount: amount,
        riskReward: rr,
        notes: body.notes || null,

        pnl,
        equity: newEquity,
      },
    });

    return NextResponse.json(trade);
  } catch (err) {
    console.error("CREATE ERROR", err);
    return NextResponse.json(
      { error: "Errore durante la creazione del trade" },
      { status: 500 }
    );
  }
}
