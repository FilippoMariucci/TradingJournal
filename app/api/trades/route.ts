import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅


// GET — Ritorna tutti i trade ordinati
export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: { importOrder: "asc" },
  });

  return NextResponse.json(trades);
}

// POST — Crea un trade manuale con numerazione automatica
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Trova l'ultimo importOrder
    const lastTrade = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const nextOrder = lastTrade ? lastTrade.importOrder + 1 : 1;

    // Crea trade
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
        amount: body.amount ? Number(body.amount) : null,
        riskReward: body.riskReward ? Number(body.riskReward) : null,
        pnl: body.pnl ? Number(body.pnl) : null,
        equity: body.equity ? Number(body.equity) : null,
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
