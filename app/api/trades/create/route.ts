import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Calcolo equity automatica
    const lastTrade = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const previousEquity = lastTrade?.equity ?? 700; // budget iniziale

    let pnl = 0;
    if (data.result === "Presa") pnl = Number(data.amount);
    if (data.result === "Persa") pnl = -Math.abs(Number(data.amount));
    if (data.result === "Pareggio") pnl = 0;

    const newEquity = previousEquity + pnl;

    const created = await prisma.trade.create({
      data: {
        ...data,
        pnl,
        equity: newEquity,
        importOrder: (lastTrade?.importOrder ?? 0) + 1,
        numericResult:
          data.result === "Presa" ? 1 : data.result === "Persa" ? -1 : 0,
      },
    });

    return NextResponse.json(created);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Errore creazione trade" }, { status: 500 });
  }
}
