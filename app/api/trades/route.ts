import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET — Ritorna tutti i trade ordinati per importOrder
export async function GET() {
  const trades = await prisma.trade.findMany({
    orderBy: {
      importOrder: "asc",
    },
  });

  return NextResponse.json(trades);
}

// POST — Crea un nuovo trade (manuale)
export async function POST(req: Request) {
  const data = await req.json();

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
      amount: data.amount ? Number(data.amount) : null,
      riskReward: data.riskReward ? Number(data.riskReward) : null,
      pnl: data.pnl ? Number(data.pnl) : null,
      equity: data.equity ? Number(data.equity) : null,
      notes: data.notes ?? null,
      numericResult: data.numericResult ?? null,

      importOrder: data.importOrder ?? null,
    },
  });

  return NextResponse.json(newTrade);
}
