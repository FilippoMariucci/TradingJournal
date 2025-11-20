import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// -----------------------------
// UTIL: parse date ISO sicuro
// -----------------------------
function safeDate(v: any) {
  if (!v) return null;

  // aggiunge i secondi se mancano
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v += ":00";

  const d = new Date(v);
  if (isNaN(d.getTime())) return null;

  return d;
}

// -----------------------------
// UTIL: numero safe (mai NaN)
// -----------------------------
function n(v: any) {
  if (v === null || v === undefined) return null;
  const num = Number(v);
  return isNaN(num) ? null : num;
}

// -----------------------------
// UTIL: PNL corretto
// -----------------------------
function computePnl(result: string | null, amount: number | null, rr: number | null) {
  if (!result || !amount) return 0;
  const r = result.toLowerCase().trim();

  if (r.includes("presa") || r.includes("vinta")) {
    if (rr && rr > 0) return (amount * rr) / 100;
    return amount;
  }

  if (r.includes("persa")) return -Math.abs(amount);

  return 0;
}

// =========================================
// GET  → pubblico
// =========================================
export async function GET() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: [
        { importOrder: "asc" },
        { date: "asc" },
        { id: "asc" },
      ],
    });

    return NextResponse.json(trades);
  } catch (err) {
    console.error("GET /api/trades ERROR:", err);
    return NextResponse.json({ error: "Errore caricamento trades" }, { status: 500 });
  }
}

// =========================================
// POST → solo utenti loggati
// =========================================
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const body = await req.json();

    const last = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    const nextOrder = last ? last.importOrder + 1 : 1;

    const amount = n(body.amount) || 0;
    const rr = n(body.riskReward) || 0;
    const pnl = computePnl(body.result, amount, rr);

    const prevEquity = last?.equity ?? 700;
    const newEquity = prevEquity + pnl;

    const newTrade = await prisma.trade.create({
      data: {
        importOrder: nextOrder,
        tradeNumber: nextOrder,

        date: safeDate(body.date),
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
        numericResult: n(body.numericResult),
        ticker: body.ticker || null,
        type: body.type || null,
        entryDate: safeDate(body.entryDate),
        entryPrice: n(body.entryPrice),
        quantity: n(body.quantity),
        exitDate: safeDate(body.exitDate),
        exitPrice: n(body.exitPrice),
      },
    });

    return NextResponse.json(newTrade);

  } catch (err) {
    console.error("POST /api/trades ERROR:", err);
    return NextResponse.json({ error: "Errore creazione trade", details: String(err) }, { status: 500 });
  }
}
