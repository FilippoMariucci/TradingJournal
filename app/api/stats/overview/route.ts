import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");
    const symbol = searchParams.get("symbol");
    const resultFilter = searchParams.get("result");
    const groupType = searchParams.get("groupType");

    // ### 1. Recuperiamo il budget iniziale in modo sicuro ###
    const settings = await prisma.settings.findFirst();
    const INITIAL_BALANCE =
      settings?.initialBudget !== undefined
        ? settings.initialBudget
        : 700;

    // ### 2. Costruzione filtro ###
    const where: any = {};

    if (startDateStr || endDateStr) {
      where.date = {};
      if (startDateStr) where.date.gte = new Date(startDateStr);
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (symbol && symbol !== "all") where.currencyPair = symbol;
    if (groupType && groupType !== "all") where.groupType = groupType;

    // ### 3. Carichiamo i trades ###
    const trades = await prisma.trade.findMany({
      where,
      orderBy: [{ date: "asc" }, { importOrder: "asc" }],
    });

    // ### 4. Filtri risultato ###
    let filteredTrades = trades;

    if (resultFilter && resultFilter !== "all") {
      filteredTrades = trades.filter((t) => {
        const p = t.pnl ?? 0;
        if (resultFilter === "win") return p > 0;
        if (resultFilter === "loss") return p < 0;
        if (resultFilter === "breakeven") return p === 0;
        return true;
      });
    }

    // ### 5. Costruzione equity ###
    let equity = INITIAL_BALANCE;

    const equityCurve: { date: string; equity: number }[] = [];
    const equityDeltas: {
      id: number;
      date: Date;
      delta: number;
    }[] = [];

    const dayMap = new Map<string, number>();
    const symbolMap = new Map<string, number>();
    const groupMap = new Map<string, number>();

    for (const t of filteredTrades) {
      const pnl = t.pnl ?? 0;
      equity += pnl;

      const dateKey = t.date.toISOString().slice(0, 10);

      equityCurve.push({ date: dateKey, equity });
      equityDeltas.push({ id: t.id, date: t.date, delta: pnl });

      dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + pnl);

      const s = t.currencyPair ?? "Altro";
      symbolMap.set(s, (symbolMap.get(s) ?? 0) + pnl);

      const g = t.groupType ?? "Altro";
      groupMap.set(g, (groupMap.get(g) ?? 0) + pnl);
    }

    // ### 6. Statistiche ###
    const totalTrades = filteredTrades.length;
    const totalPnl = equity - INITIAL_BALANCE;
    const avgPnlPerTrade = totalTrades ? totalPnl / totalTrades : 0;

    // Miglior/peggior trade basato su equity
    let bestTrade = null;
    let worstTrade = null;

    if (equityDeltas.length > 0) {
      bestTrade = equityDeltas.reduce((a, b) =>
        b.delta > a.delta ? b : a
      );
      worstTrade = equityDeltas.reduce((a, b) =>
        b.delta < a.delta ? b : a
      );
    }

    // Giorni verdi/rossi
    let daysGreen = 0;
    let daysRed = 0;
    for (const v of dayMap.values()) {
      if (v > 0) daysGreen++;
      else if (v < 0) daysRed++;
    }

    // Per simbolo
    const pnlBySymbol = Array.from(symbolMap.entries()).map(
      ([symbol, pnl]) => ({
        symbol,
        totalPnl: pnl,
        trades: trades.filter(
          (t) => (t.currencyPair ?? "Altro") === symbol
        ).length,
      })
    );

    // Per gruppo
    const groupStats = Array.from(groupMap.entries()).map(
      ([groupType, pnl]) => ({
        groupType,
        totalPnl: pnl,
        trades: trades.filter(
          (t) => (t.groupType ?? "Altro") === groupType
        ).length,
      })
    );

    // Miglior/peggior gruppo
    let bestGroup = null;
    let worstGroup = null;

    if (groupStats.length > 0) {
      bestGroup = groupStats.reduce((a, b) =>
        b.totalPnl > a.totalPnl ? b : a
      );
      worstGroup = groupStats.reduce((a, b) =>
        b.totalPnl < a.totalPnl ? b : a
      );
    }

    return NextResponse.json({
      startingBalance: INITIAL_BALANCE,
      totalTrades,
      totalPnl,
      avgPnlPerTrade,
      winRate: totalTrades
        ? ((equityDeltas.filter((x) => x.delta > 0).length /
            totalTrades) *
            100)
        : 0,
      wins: equityDeltas.filter((x) => x.delta > 0).length,
      losses: equityDeltas.filter((x) => x.delta < 0).length,
      breakevens: equityDeltas.filter((x) => x.delta === 0).length,
      daysGreen,
      daysRed,
      bestTrade,
      worstTrade,
      equityCurve,
      pnlBySymbol,
      groupStats,
      bestGroup,
      worstGroup,
      availableSymbols: Array.from(
        new Set(trades.map((t) => t.currencyPair).filter(Boolean))
      ),
      availableGroups: Array.from(
        new Set(trades.map((t) => t.groupType).filter(Boolean))
      ),
    });
  } catch (error) {
    console.error("ERROR /api/stats/overview:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
