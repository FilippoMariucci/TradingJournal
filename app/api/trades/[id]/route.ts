import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// 🔥 Calcolo PnL identico al create
function computeDisplayPnl(
  result: string | null,
  amount: number | null,
  rr: number | null
) {
  if (!result || !amount) return 0;

  const res = result.toLowerCase().trim();

  // ➕ PRESA → amount * rr%
  if (res.includes("presa")) {
    if (rr && rr > 0) return (amount * rr) / 100;
    return amount; // fallback
  }

  // ➖ PERSA → -amount
  if (res.includes("persa")) {
    return -Math.abs(amount);
  }

  // 🟰 PAREGGIO
  return 0;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const body = await req.json();

    const amount = body.amount ? Number(body.amount) : null;
    const rr = body.riskReward ? Number(body.riskReward) : null;

    // 🔥 Ricalcolo PnL per il trade modificato
    const pnl = computeDisplayPnl(body.result, amount, rr);

    // Aggiorno il trade modificato (senza equity per ora)
    const updated = await prisma.trade.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : null,
        dayOfWeek: body.dayOfWeek || null,
        currencyPair: body.currencyPair || null,
        positionType: body.positionType || null,
        openTime: body.openTime || null,
        groupType: body.groupType || null,
        result: body.result || null,
        amount,
        riskReward: rr,
        notes: body.notes || null,
        pnl,
      },
    });

    // 📌 ORA AGGIORNIAMO TUTTA L'EQUITY SUCCESSIVA

    const allTrades = await prisma.trade.findMany({
      orderBy: { importOrder: "asc" },
    });

    let equity = 700; // equity iniziale

    for (const t of allTrades) {
      const newPnl = t.id === updated.id ? pnl : t.pnl ?? 0;
      equity += newPnl;

      await prisma.trade.update({
        where: { id: t.id },
        data: { equity },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("UPDATE ERROR", err);
    return NextResponse.json(
      { error: "Errore durante l'update del trade" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.trade.delete({
      where: { id: Number(params.id) },
    });

    // 📌 Dopo l'eliminazione, ricalcolo equity per coerenza

    const allTrades = await prisma.trade.findMany({
      orderBy: { importOrder: "asc" },
    });

    let equity = 700;

    for (const t of allTrades) {
      const pnl = t.pnl ?? 0;
      equity += pnl;

      await prisma.trade.update({
        where: { id: t.id },
        data: { equity },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR", err);
    return NextResponse.json(
      { error: "Errore durante la cancellazione del trade" },
      { status: 500 }
    );
  }
}
