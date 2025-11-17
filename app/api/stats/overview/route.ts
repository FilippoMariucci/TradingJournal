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

    const settings = await prisma.settings.findFirst();
    const INITIAL_BALANCE = settings?.initialBudget ?? 700;

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

    const trades = await prisma.trade.findMany({
      where,
      orderBy: [{ date: "asc" }, { importOrder: "asc" }],
    });

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

    let equity = INITIAL_BALANCE;

    const equityCurve: { date: string; equity: number }[] = [];
    const equityDeltas: { id: number; date: Date | null; delta: number }[] = [];

    const dayMap = new Map<string, number>();
    const symbolMap = new Map<string, number>();
    const groupMap = new Map<string, number>();

    for (const t of filteredTrades) {
      const pnl = t.pnl ?? 0;
      equity += pnl;

      // 🔥 PROTEZIONE DEFINITIVA
      let dateKey = "N/A";

      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          dateKey = d.toISOString().split("T")[0];
        }
      }

      equityCurve.push({ date: dateKey, equity });

      equityDeltas.push({
        id: t.id,
        date: t.date ?? null,
        delta: pnl,
      });

      dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + pnl);

      const s = t.currencyPair ?? "Altro";
      symbolMap.set(s, (symbolMap.get(s) ?? 0) + pnl);

      const g = t.groupType ?? "Altro";
      groupMap.set(g, (groupMap.get(g) ?? 0) + pnl);
    }

    const totalTrades = filteredTrades.length;
    const totalPnl = equity - INITIAL_BALANCE;

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

    let daysGreen = 0;
    let daysRed = 0;

    for (const v of dayMap.values()) {
      if (v > 0) daysGreen++;
      else if (v < 0) daysRed++;
    }

    const pnlBySymbol = Array.from(symbolMap.entries()).map(
      ([symbol, pnl]) => ({
        symbol,
        totalPnl: pnl,
        trades: trades.filter(
          (t) => (t.currencyPair ?? "Altro") === symbol
        ).length,
      })
    );

    const groupStats = Array.from(groupMap.entries()).map(
      ([groupType, pnl]) => ({
        groupType,
        totalPnl: pnl,
        trades: trades.filter(
          (t) => (t.groupType ?? "Altro") === groupType
        ).length,
      })
    );

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
      avgPnlPerTrade: totalTrades ? totalPnl / totalTrades : 0,
      winRate: totalTrades
        ? ((equityDeltas.filter((x) => x.delta > 0).length / totalTrades) * 100)
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
