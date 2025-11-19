import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// ----------------------
// PNL CORRETTO
// ----------------------
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

  return 0; // pareggio o altro
}

// ----------------------
// GET (pubblico)
// ----------------------
export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { importOrder: "asc" },
    });

    return NextResponse.json(trades);
  } catch (err) {
    console.error("GET /api/trades ERROR:", err);
    return NextResponse.json(
      { error: "Errore nel caricamento dei trades" },
      { status: 500 }
    );
  }
}

// ----------------------
// POST (solo utenti loggati)
// ----------------------
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

    // ultimo trade
    const last = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const nextOrder = last ? last.importOrder + 1 : 1;

    // Sanitizzazione numeri (NESSUN NaN MAI)
    const amount = Number(body.amount) || 0;
    const rr = Number(body.riskReward) || 0;

    // calcolo pnl sul backend
    const pnl = computePnl(body.result, amount, rr);

    // calcolo equity
    const previousEquity = last?.equity ?? 700;
    const newEquity = previousEquity + pnl;

    // Sanitizzazione helper
    const n = (v: any) => (v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : null);
    const d = (v: any) => (v ? new Date(v) : null);

    // CREATE
    const newTrade = await prisma.trade.create({
      data: {
        importOrder: nextOrder,
        tradeNumber: nextOrder,

        date: d(body.date),
        dayOfWeek: body.dayOfWeek || null,
        currencyPair: body.currencyPair || null,
        positionType: body.positionType || null,
        openTime: body.openTime || null,
        groupType: body.groupType || null,
        result: body.result || null,

        amount: n(body.amount),
        riskReward: n(body.riskReward),
        pnl,
        equity: newEquity,
        notes: body.notes || null,

        // campi avanzati
        numericResult: n(body.numericResult),
        ticker: body.ticker || null,
        type: body.type || null,
        entryDate: d(body.entryDate),
        entryPrice: n(body.entryPrice),
        quantity: n(body.quantity),
        exitDate: d(body.exitDate),
        exitPrice: n(body.exitPrice),
      },
    });

    return NextResponse.json(newTrade);
  } catch (err) {
    console.error("POST /api/trades ERROR:", err);
    return NextResponse.json(
      { error: "Errore durante la creazione del trade", details: String(err) },
      { status: 500 }
    );
  }
}
