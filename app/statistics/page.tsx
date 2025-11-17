"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Trade = {
  id: number;
  date?: string;
  currencyPair?: string;
  positionType?: string;
  dayOfWeek?: string;
  groupType?: string;
  amount?: number | string;
  pnl?: number | string;
  result?: string;
  riskReward?: number | string;
  equity?: number | string;
};

type Stats = {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalWinValue: number;
  totalLossValue: number;
  profitFactor: number;
  avgTrade: number;
  rrAverage: number;
};

type PeriodStat = {
  key: string;
  label: string;
  startDate: number;
  stats: Stats;
  pnl: number;
};

// 🔢 PnL coerente con Journal/Dashboard
function computeDisplayPnl(t: Trade) {
  const pnl = Number(t.pnl ?? 0);
  const amount = Number(t.amount ?? 0);
  const res = t.result?.toLowerCase() ?? "";

  if (res === "persa") return -Math.abs(amount);
  if (res === "presa") return pnl;
  // "pari" / "pareggio" / "break-even" ecc. li consideriamo 0
  return 0;
}

function formatEuro(v: any) {
  if (v === null || v === undefined || v === "") return "0,00";
  const num = Number(v);
  if (isNaN(num)) return "0,00";
  return num.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// 📊 STATISTICHE GENERALI
function getStats(list: Trade[]): Stats {
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let totalWinValue = 0;
  let totalLossValue = 0;
  let rrSum = 0;
  let rrCount = 0;

  list.forEach((t) => {
    const res = t.result?.toLowerCase() ?? "";
    const dpnl = computeDisplayPnl(t);

    if (res === "presa") {
      wins++;
      totalWinValue += dpnl; // dpnl > 0
    } else if (res === "persa") {
      losses++;
      totalLossValue += Math.abs(dpnl); // parte positiva per PF
    } else if (
      res === "pari" ||
      res === "pareggio" ||
      res === "break-even"
    ) {
      breakeven++;
    }

    if (
      t.riskReward !== "" &&
      t.riskReward !== null &&
      t.riskReward !== undefined
    ) {
      rrSum += Number(t.riskReward);
      rrCount++;
    }
  });

  const totalTrades = list.length;
  const winLoss = wins + losses;
  const winRate = winLoss > 0 ? (wins / winLoss) * 100 : 0;

  const profitFactor =
    totalLossValue > 0
      ? totalWinValue / totalLossValue
      : totalWinValue > 0
      ? 999
      : 0;

  const avgTrade =
    totalTrades > 0
      ? (totalWinValue - totalLossValue) / totalTrades
      : 0;

  return {
    totalTrades,
    wins,
    losses,
    breakeven,
    winRate,
    totalWinValue,
    totalLossValue,
    profitFactor,
    avgTrade,
    rrAverage: rrCount > 0 ? rrSum / rrCount : 0,
  };
}

// 🔢 PnL totale (stessa logica ovunque)
function calculateTotalPnl(list: Trade[]) {
  return list.reduce((sum, t) => sum + computeDisplayPnl(t), 0);
}

// Helpers per raggruppare per periodo
function getDayKey(date?: string) {
  if (!date) return null;
  return date.split("T")[0]; // YYYY-MM-DD
}

function getWeekKey(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const diffDays = Math.floor(
    (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getMonthKey(date?: string) {
  if (!date) return null;
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function buildPeriodStats(
  list: Trade[],
  mode: "day" | "week" | "month"
): PeriodStat[] {
  const buckets: Record<string, Trade[]> = {};
  const starts: Record<string, number> = {};

  list.forEach((t) => {
    let key: string | null = null;

    if (mode === "day") key = getDayKey(t.date);
    else if (mode === "week") key = getWeekKey(t.date);
    else key = getMonthKey(t.date);

    if (!key) return;

    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(t);

    const time = t.date ? new Date(t.date).getTime() : Date.now();
    if (!starts[key] || time < starts[key]) starts[key] = time;
  });

  const result: PeriodStat[] = Object.entries(buckets).map(([key, trades]) => {
    const stats = getStats(trades);
    const pnl = calculateTotalPnl(trades);

    let label = key;
    if (mode === "day") {
      const [y, m, d] = key.split("-");
      label = `${d}/${m}/${y}`;
    } else if (mode === "week") {
      label = key.replace("-", " "); // es: 2025 W03
    } else if (mode === "month") {
      const [y, m] = key.split("-");
      label = `${m}/${y}`;
    }

    return {
      key,
      label,
      stats,
      pnl,
      startDate: starts[key],
    };
  });

  return result.sort((a, b) => b.startDate - a.startDate);
}

export default function StatisticsPage() {
  const [trades, setTrades] = useState<Trade[]>([]);

  // FILTRI
  const [filterResult, setFilterResult] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    async function loadTrades() {
      const res = await fetch("/api/trades");
      const data = await res.json();
      setTrades(data);
    }

    loadTrades();
  }, []);

  // 🔍 Applico i filtri
  const filteredTrades = trades.filter((t) => {
    const res = t.result ?? "";

    if (filterResult && res !== filterResult) return false;
    if (filterCurrency && t.currencyPair !== filterCurrency) return false;
    if (filterDay && t.dayOfWeek !== filterDay) return false;
    if (filterGroup && t.groupType !== filterGroup) return false;

    if (filterFrom) {
      if (!t.date) return false;
      const tradeDate = new Date(t.date);
      const fromDate = new Date(filterFrom);
      if (tradeDate < fromDate) return false;
    }

    if (filterTo) {
      if (!t.date) return false;
      const tradeDate = new Date(t.date);
      const toDate = new Date(filterTo);
      toDate.setHours(23, 59, 59, 999);
      if (tradeDate > toDate) return false;
    }

    return true;
  });

  const hasTrades = filteredTrades.length > 0;

  // 📈 Equity curve (budget) sui trade filtrati
  const equityData = filteredTrades
    .slice()
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return da - db;
    })
    .map((t, index) => ({
      index: index + 1,
      label: t.date
        ? new Date(t.date).toLocaleDateString("it-IT", {
            day: "2-digit",
            month: "2-digit",
          })
        : `#${index + 1}`,
      equity: Number(t.equity ?? 0),
      groupType: t.groupType ?? "N/D",
    }));

  // 📊 Stat globali sui trade filtrati
  const globalStats = getStats(filteredTrades);
  const totalPnlGlobal = calculateTotalPnl(filteredTrades);

  // Gruppi
  const groupNames = Array.from(
    new Set(
      filteredTrades
        .map((t) => t.groupType)
        .filter((g): g is string => !!g && g.trim() !== "")
    )
  );

  const groupStatsMap: Record<string, Stats> = {};
  const groupPnls: Record<string, number> = {};

  groupNames.forEach((g) => {
    const groupTrades = filteredTrades.filter((t) => t.groupType === g);
    groupStatsMap[g] = getStats(groupTrades);
    groupPnls[g] = calculateTotalPnl(groupTrades);
  });

  // Opzioni per i select
  const currencyOptions = Array.from(
    new Set(
      filteredTrades
        .map((t) => t.currencyPair)
        .filter((c): c is string => !!c)
    )
  );
  const dayOptions = Array.from(
    new Set(
      filteredTrades
        .map((t) => t.dayOfWeek)
        .filter((d): d is string => !!d)
    )
  );

  // Period stats: daily / weekly / monthly
  const dailyStats = buildPeriodStats(filteredTrades, "day").slice(0, 10);
  const weeklyStats = buildPeriodStats(filteredTrades, "week").slice(0, 10);
  const monthlyStats = buildPeriodStats(filteredTrades, "month").slice(0, 12);

  return (
    <div className="w-full min-h-screen bg-[#020617] text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* HEADER */}
        <header>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Statistiche Avanzate
          </h1>
          <p className="text-neutral-300">
            Panoramica completa delle performance, dei gruppi e
            dell&apos;andamento del budget. Tutto è calcolato con la stessa
            logica di Journal e Dashboard, sui trade filtrati.
          </p>
        </header>

        {/* 🔍 FILTRI */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-semibold mb-1">Filtri</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Risultato */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Risultato
              </label>
              <select
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              >
                <option value="">Tutti</option>
                <option value="Presa">Presa</option>
                <option value="Persa">Persa</option>
                <option value="Pari">Pari</option>
              </select>
            </div>

            {/* Valuta */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Valuta
              </label>
              <select
                value={filterCurrency}
                onChange={(e) => setFilterCurrency(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              >
                <option value="">Tutte</option>
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Giorno settimana */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Giorno settimana
              </label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              >
                <option value="">Tutti</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Gruppo */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Gruppo
              </label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              >
                <option value="">Tutti</option>
                {groupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Data da */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Data da
              </label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              />
            </div>

            {/* Data a */}
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Data a
              </label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            Tutte le statistiche, l&apos;equity e le sezioni giornaliere /
            settimanali / mensili sono calcolate sui trade filtrati, con la
            stessa logica di PnL usata nel Journal.
          </p>
        </section>

        {!hasTrades && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 text-neutral-300">
              Nessun trade corrisponde ai filtri selezionati. Modifica i filtri
              o importa trade dalla pagina Journal.
            </CardContent>
          </Card>
        )}

        {hasTrades && (
          <>
            {/* 📊 STATISTICHE GLOBALI */}
            <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Trade Totali</p>
                  <p className="text-3xl font-bold">
                    {globalStats.totalTrades}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Win</p>
                  <p className="text-3xl font-bold text-green-400">
                    {globalStats.wins}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Loss</p>
                  <p className="text-3xl font-bold text-red-400">
                    {globalStats.losses}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Pareggi</p>
                  <p className="text-3xl font-bold">
                    {globalStats.breakeven}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Win Rate</p>
                  <p className="text-3xl font-bold text-green-400">
                    {globalStats.winRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Profit Factor</p>
                  <p className="text-3xl font-bold">
                    {globalStats.profitFactor.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">Media per Trade</p>
                  <p className="text-3xl font-bold">
                    {formatEuro(globalStats.avgTrade)} €
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-neutral-400 text-sm">PnL Globale</p>
                  <p
                    className={`text-2xl font-bold ${
                      totalPnlGlobal > 0
                        ? "text-green-400"
                        : totalPnlGlobal < 0
                        ? "text-red-400"
                        : "text-white"
                    }`}
                  >
                    {totalPnlGlobal > 0
                      ? `+ ${formatEuro(totalPnlGlobal)} €`
                      : totalPnlGlobal < 0
                      ? `- ${formatEuro(Math.abs(totalPnlGlobal))} €`
                      : "0,00 €"}
                  </p>
                </CardContent>
              </Card>
            </section>

            {/* 📈 EQUITY */}
            <section>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle>Andamento Budget (Equity)</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  {equityData.length === 0 ? (
                    <p className="text-neutral-400 text-sm">
                      Nessun dato di equity disponibile per i filtri selezionati.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={equityData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="label" tick={{ fill: "#cbd5f5" }} />
                        <YAxis
                          tick={{ fill: "#cbd5f5" }}
                          tickFormatter={(v) => v.toFixed(0)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020617",
                            border: "1px solid #1e293b",
                            borderRadius: "0.5rem",
                            color: "#e5e7eb",
                          }}
                          formatter={(value) => [
                            `€ ${formatEuro(value)}`,
                            "Equity",
                          ]}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="equity"
                          name="Equity"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* 🧩 STATISTICHE PER GRUPPO */}
            {groupNames.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">
                  Statistiche per Gruppo (filtrate)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groupNames.map((g) => {
                    const gs = groupStatsMap[g];
                    const pnl = groupPnls[g] ?? 0;

                    return (
                      <Card
                        key={g}
                        className="bg-slate-900 border-slate-800"
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>{g}</span>
                            <span className="text-xs text-neutral-400">
                              {gs.totalTrades} trade
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1 text-sm text-neutral-200">
                          <p>
                            Win Rate:{" "}
                            <span className="font-semibold text-green-400">
                              {gs.winRate.toFixed(1)}%
                            </span>
                          </p>
                          <p>
                            Profit Factor:{" "}
                            <span className="font-semibold">
                              {gs.profitFactor.toFixed(2)}
                            </span>
                          </p>
                          <p>
                            Media per Trade:{" "}
                            <span className="font-semibold">
                              {formatEuro(gs.avgTrade)} €
                            </span>
                          </p>
                          <p>
                            PnL Gruppo:{" "}
                            <span
                              className={`font-semibold ${
                                pnl > 0
                                  ? "text-green-400"
                                  : pnl < 0
                                  ? "text-red-400"
                                  : "text-white"
                              }`}
                            >
                              {pnl > 0
                                ? `+ ${formatEuro(pnl)} €`
                                : pnl < 0
                                ? `- ${formatEuro(Math.abs(pnl))} €`
                                : "0,00 €"}
                            </span>
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 🧾 TABELLA GRUPPI */}
            {groupNames.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">
                  Riepilogo Gruppi (filtrati)
                </h2>
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Gruppo</TableHead>
                          <TableHead>Trade Totali</TableHead>
                          <TableHead>Win</TableHead>
                          <TableHead>Loss</TableHead>
                          <TableHead>Pareggi</TableHead>
                          <TableHead>Win Rate</TableHead>
                          <TableHead>Profit Factor</TableHead>
                          <TableHead>PnL</TableHead>
                          <TableHead>R:R Medio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupNames.map((g) => {
                          const gs = groupStatsMap[g];
                          const pnl = groupPnls[g] ?? 0;

                          return (
                            <TableRow key={g}>
                              <TableCell className="font-semibold">
                                {g}
                              </TableCell>
                              <TableCell>{gs.totalTrades}</TableCell>
                              <TableCell className="text-green-400">
                                {gs.wins}
                              </TableCell>
                              <TableCell className="text-red-400">
                                {gs.losses}
                              </TableCell>
                              <TableCell>{gs.breakeven}</TableCell>
                              <TableCell>
                                {gs.winRate.toFixed(1)}%
                              </TableCell>
                              <TableCell>
                                {gs.profitFactor.toFixed(2)}
                              </TableCell>
                              <TableCell
                                className={
                                  pnl > 0
                                    ? "text-green-400"
                                    : pnl < 0
                                    ? "text-red-400"
                                    : ""
                                }
                              >
                                {pnl > 0
                                  ? `+ ${formatEuro(pnl)} €`
                                  : pnl < 0
                                  ? `- ${formatEuro(Math.abs(pnl))} €`
                                  : "0,00 €"}
                              </TableCell>
                              <TableCell>
                                {gs.rrAverage.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* 📅 GIORNALIERO */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                Statistiche Giornaliere (ultimi 10 giorni filtrati)
              </h2>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-0">
                  {dailyStats.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-400">
                      Nessun dato giornaliero disponibile per i filtri attuali.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Giorno</TableHead>
                          <TableHead>Trade</TableHead>
                          <TableHead>Win</TableHead>
                          <TableHead>Loss</TableHead>
                          <TableHead>Pareggi</TableHead>
                          <TableHead>Win Rate</TableHead>
                          <TableHead>Profit Factor</TableHead>
                          <TableHead>PnL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyStats.map((d) => (
                          <TableRow key={d.key}>
                            <TableCell>{d.label}</TableCell>
                            <TableCell>{d.stats.totalTrades}</TableCell>
                            <TableCell className="text-green-400">
                              {d.stats.wins}
                            </TableCell>
                            <TableCell className="text-red-400">
                              {d.stats.losses}
                            </TableCell>
                            <TableCell>{d.stats.breakeven}</TableCell>
                            <TableCell>
                              {d.stats.winRate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              {d.stats.profitFactor.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={
                                d.pnl > 0
                                  ? "text-green-400"
                                  : d.pnl < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {d.pnl > 0
                                ? `+ ${formatEuro(d.pnl)} €`
                                : d.pnl < 0
                                ? `- ${formatEuro(Math.abs(d.pnl))} €`
                                : "0,00 €"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* 📆 SETTIMANALE */}
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">
                Statistiche Settimanali (ultime 10 settimane filtrate)
              </h2>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-0">
                  {weeklyStats.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-400">
                      Nessun dato settimanale disponibile per i filtri attuali.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Settimana</TableHead>
                          <TableHead>Trade</TableHead>
                          <TableHead>Win</TableHead>
                          <TableHead>Loss</TableHead>
                          <TableHead>Pareggi</TableHead>
                          <TableHead>Win Rate</TableHead>
                          <TableHead>Profit Factor</TableHead>
                          <TableHead>PnL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyStats.map((w) => (
                          <TableRow key={w.key}>
                            <TableCell>{w.label}</TableCell>
                            <TableCell>{w.stats.totalTrades}</TableCell>
                            <TableCell className="text-green-400">
                              {w.stats.wins}
                            </TableCell>
                            <TableCell className="text-red-400">
                              {w.stats.losses}
                            </TableCell>
                            <TableCell>{w.stats.breakeven}</TableCell>
                            <TableCell>
                              {w.stats.winRate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              {w.stats.profitFactor.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={
                                w.pnl > 0
                                  ? "text-green-400"
                                  : w.pnl < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {w.pnl > 0
                                ? `+ ${formatEuro(w.pnl)} €`
                                : w.pnl < 0
                                ? `- ${formatEuro(Math.abs(w.pnl))} €`
                                : "0,00 €"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* 📆 MENSILE */}
            <section className="space-y-4 mb-10">
              <h2 className="text-2xl font-semibold">
                Statistiche Mensili (ultimi 12 mesi filtrati)
              </h2>
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-0">
                  {monthlyStats.length === 0 ? (
                    <p className="p-4 text-sm text-neutral-400">
                      Nessun dato mensile disponibile per i filtri attuali.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mese</TableHead>
                          <TableHead>Trade</TableHead>
                          <TableHead>Win</TableHead>
                          <TableHead>Loss</TableHead>
                          <TableHead>Pareggi</TableHead>
                          <TableHead>Win Rate</TableHead>
                          <TableHead>Profit Factor</TableHead>
                          <TableHead>PnL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyStats.map((m) => (
                          <TableRow key={m.key}>
                            <TableCell>{m.label}</TableCell>
                            <TableCell>{m.stats.totalTrades}</TableCell>
                            <TableCell className="text-green-400">
                              {m.stats.wins}
                            </TableCell>
                            <TableCell className="text-red-400">
                              {m.stats.losses}
                            </TableCell>
                            <TableCell>{m.stats.breakeven}</TableCell>
                            <TableCell>
                              {m.stats.winRate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              {m.stats.profitFactor.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={
                                m.pnl > 0
                                  ? "text-green-400"
                                  : m.pnl < 0
                                  ? "text-red-400"
                                  : ""
                              }
                            >
                              {m.pnl > 0
                                ? `+ ${formatEuro(m.pnl)} €`
                                : m.pnl < 0
                                ? `- ${formatEuro(Math.abs(m.pnl))} €`
                                : "0,00 €"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
