import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET — Ritorna tutti i trade ordinati per importOrder
export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: {
        importOrder: "asc",
      },
    });

    return NextResponse.json(trades);
  } catch (error) {
    console.error("GET /api/trades error:", error);
    return NextResponse.json(
      { error: "Errore nel recupero dei trade" },
      { status: 500 }
    );
  }
}

// POST — Crea un nuovo trade (manuale)
export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Calcoliamo un importOrder se non arriva dal client
    let importOrder: number;

    if (data.importOrder !== undefined && data.importOrder !== null) {
      importOrder = Number(data.importOrder);
    } else {
      const last = await prisma.trade.aggregate({
        _max: { importOrder: true },
      });

      importOrder = (last._max.importOrder ?? 0) + 1;
    }

    const newTrade = await prisma.trade.create({
      data: {
        tradeNumber: null,
        date: data.date ? new Date(data.date) : null,
        dayOfWeek: data.dayOfWeek ?? null,
        currencyPair: data.currencyPair ?? null,
        positionType: data.positionType ?? null,
        openTime: data.openTime ?? null,
        groupType: data.groupType ?? null,
        result: data.result ?? null,

        amount:
          data.amount !== undefined && data.amount !== null && data.amount !== ""
            ? Number(data.amount)
            : null,

        riskReward:
          data.riskReward !== undefined &&
          data.riskReward !== null &&
          data.riskReward !== ""
            ? Number(data.riskReward)
            : null,

        pnl:
          data.pnl !== undefined && data.pnl !== null && data.pnl !== ""
            ? Number(data.pnl)
            : null,

        equity:
          data.equity !== undefined && data.equity !== null && data.equity !== ""
            ? Number(data.equity)
            : null,

        notes: data.notes ?? null,
        numericResult: data.numericResult ?? null,

        importOrder,
      },
    });

    return NextResponse.json(newTrade);
  } catch (error) {
    console.error("POST /api/trades error:", error);
    return NextResponse.json(
      { error: "Errore nella creazione del trade" },
      { status: 500 }
    );
  }
}
