import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Trade = {
  id: number;
  date: Date;
  pnl: number | null;
  currencyPair?: string | null;
  groupType?: string | null;
  importOrder?: number | null;
};

function summarize(trades: Trade[]) {
  const totalTrades = trades.length;
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;

  for (const t of trades) {
    const pnl = t.pnl ?? 0;
    totalPnl += pnl;

    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    else breakevens++;
  }

  return {
    totalTrades,
    totalPnl,
    avgPnl: totalTrades ? totalPnl / totalTrades : 0,
    winRate: totalTrades ? (wins / totalTrades) * 100 : 0,
    wins,
    losses,
    breakevens,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const startDateStr = searchParams.get("startDate");
  const endDateStr = searchParams.get("endDate");
  const symbol = searchParams.get("symbol");
  const resultFilter = searchParams.get("result");
  const groupType = searchParams.get("groupType");

  const where: any = {};

  if (startDateStr || endDateStr) {
    where.date = {};
    if (startDateStr) where.date.gte = new Date(startDateStr);
    if (endDateStr) {
      const d = new Date(endDateStr);
      d.setHours(23, 59, 59, 999);
      where.date.lte = d;
    }
  }

  if (symbol && symbol !== "all") where.currencyPair = symbol;
  if (groupType && groupType !== "all") where.groupType = groupType;

  const trades = (await prisma.trade.findMany({
    where,
    orderBy: [{ date: "asc" }, { importOrder: "asc" }],
  })) as Trade[];

  // result filter
  let filtered = trades;
  if (resultFilter && resultFilter !== "all") {
    filtered = trades.filter(t => {
      const pnl = t.pnl ?? 0;
      if (resultFilter === "win") return pnl > 0;
      if (resultFilter === "loss") return pnl < 0;
      if (resultFilter === "breakeven") return pnl === 0;
      return true;
    });
  }

  const bucketsMap = new Map<string, Trade[]>();

  for (const t of filtered) {
    const y = t.date.getFullYear();
    const m = t.date.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;

    const arr = bucketsMap.get(key) ?? [];
    arr.push(t);
    bucketsMap.set(key, arr);
  }

  const formatter = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  });

  const buckets = Array.from(bucketsMap.entries())
    .map(([key, bucketTrades]) => {
      const [y, m] = key.split("-");
      const date = new Date(Number(y), Number(m) - 1, 1);

      return {
        key,
        period: formatter.format(date),
        ...summarize(bucketTrades),
      };
    })
    .sort((a, b) => (a.key < b.key ? -1 : 1));

  return NextResponse.json({ buckets });
}
