"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import {
  calculateStakeSuggestion,
  GroupType,
  MoneyManagementConfig,
  StakeSuggestion,
  StatsInput,
} from "@/lib/moneyManagement";

/* NORMALIZZAZIONE NOMI GRUPPI */
function normalizeGroup(g: any): GroupType | "UNKNOWN" {
  if (!g) return "UNKNOWN";
  const s = String(g).trim().toLowerCase();

  if (s.includes("elite")) return "Gruppo Elite Pro";
  if (s.includes("live")) return "Gruppo Live";
  if (s.includes("bot")) return "Bot";

  return "UNKNOWN";
}

type Trade = {
  id: number;
  groupType?: GroupType | string;
  pnl: number;
  date?: string;
  payout?: number | null;
};

type EquityPoint = {
  index: number;
  equity: number;
};

const GROUPS: GroupType[] = ["Gruppo Live", "Gruppo Elite Pro", "Bot"];

export default function MoneyManagementPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equity, setEquity] = useState(0);
  const [startingEquity, setStartingEquity] = useState(700); // default

  const [winRateUser, setWinRateUser] = useState(0);
  const [winRateGroup, setWinRateGroup] = useState<Record<GroupType, number>>({
    "Gruppo Live": 0,
    "Gruppo Elite Pro": 0,
    Bot: 0,
  });

  const [payoutAvg, setPayoutAvg] = useState<Record<GroupType, number>>({
    "Gruppo Live": 0.82,
    "Gruppo Elite Pro": 0.86,
    Bot: 0.80,
  });

  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [dailyPnLPercent, setDailyPnLPercent] = useState(0);
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([]);

  const [config, setConfig] = useState<MoneyManagementConfig>({
    baseRiskPercent: 0.01,
    kellyFactor: 0.25,
    maxDailyLossPercent: 0.04,
    maxConsecutiveLosses: 3,
  });

  /* LOAD CONFIG FROM LOCALSTORAGE */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const cfg = localStorage.getItem("moneyManagementConfig");
    if (cfg) {
      try {
        setConfig(JSON.parse(cfg));
      } catch {}
    }

    const st = localStorage.getItem("startingEquity");
    if (st && !isNaN(Number(st))) setStartingEquity(Number(st));
  }, []);

  /* SAVE CONFIG */
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("moneyManagementConfig", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("startingEquity", String(startingEquity));
  }, [startingEquity]);

  /* LOAD TRADES */
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/trades");
      const data = await res.json();

      const normalized: Trade[] = (data || []).map((t: any, index: number) => ({
        id: t.id ?? index,
        groupType: normalizeGroup(t.groupType),
        pnl: Number(
          String(t.pnl).replace("€", "").replace(",", ".")
        ) || 0,
        date: t.date || null,
        payout: t.payout
          ? Number(String(t.payout).replace(",", ".").replace("%", "")) / 100
          : null,
      }));

      setTrades(normalized);
    }

    load();
  }, []);

  /* STATS CALCULATION */
  useEffect(() => {
    if (trades.length === 0) return;

    let totalPnL = 0;
    let wins = 0;

    const groupCounts: Record<GroupType, { wins: number; total: number }> = {
      "Gruppo Live": { wins: 0, total: 0 },
      "Gruppo Elite Pro": { wins: 0, total: 0 },
      Bot: { wins: 0, total: 0 },
    };

    let runningEquity = startingEquity;
    const history: EquityPoint[] = [];

    const sortedTrades = trades.sort((a, b) => {
      if (a.date && b.date)
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.id - b.id;
    });

    let lastDayPnL = 0;
    let lastDateKey: string | null = null;

    const datedTrades = trades.filter((t) => t.date);
    if (datedTrades.length > 0) {
      const last = datedTrades[datedTrades.length - 1];
      const d = new Date(last.date!);
      lastDateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    sortedTrades.forEach((t, i) => {
      totalPnL += t.pnl;
      if (t.pnl > 0) wins++;

      if (GROUPS.includes(t.groupType as GroupType)) {
        groupCounts[t.groupType as GroupType].total++;
        if (t.pnl > 0) groupCounts[t.groupType as GroupType].wins++;
      }

      runningEquity += t.pnl;
      history.push({ index: i + 1, equity: runningEquity });

      if (t.date && lastDateKey) {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (key === lastDateKey) lastDayPnL += t.pnl;
      }
    });

    setEquity(runningEquity);
    setEquityHistory(history);

    setWinRateUser(wins / trades.length);

    setWinRateGroup({
      "Gruppo Live":
        groupCounts["Gruppo Live"].total > 0
          ? groupCounts["Gruppo Live"].wins / groupCounts["Gruppo Live"].total
          : wins / trades.length,
      "Gruppo Elite Pro":
        groupCounts["Gruppo Elite Pro"].total > 0
          ? groupCounts["Gruppo Elite Pro"].wins /
            groupCounts["Gruppo Elite Pro"].total
          : wins / trades.length,
      Bot:
        groupCounts["Bot"].total > 0
          ? groupCounts["Bot"].wins / groupCounts["Bot"].total
          : wins / trades.length,
    });

    setDailyPnLPercent(lastDayPnL / runningEquity);

    let consec = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      if (trades[i].pnl < 0) consec++;
      else break;
    }
    setConsecutiveLosses(consec);
  }, [trades, startingEquity]);

  const stakeFor = (group: GroupType): StakeSuggestion => {
    const stats: StatsInput = {
      equity,
      winRateUser,
      winRateGroup: winRateGroup[group],
      payout: payoutAvg[group],
      consecutiveLosses,
      dailyPnLPercent,
    };

    return calculateStakeSuggestion(config, stats);
  };

  /* ============== RENDER PAGE ============== */

  return (
    <div className="p-6 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">💰 Money Management</h1>

      {/* DEBUG SECTION */}
      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle>DEBUG (puoi eliminarlo dopo)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Trades caricati: {trades.length}</p>
          <p>Primo groupType: {String(trades[0]?.groupType)}</p>
          <p>WR User: {(winRateUser * 100).toFixed(1)}%</p>
        </CardContent>
      </Card>

      {/* EQUITY + GRAFICO */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Equity Attuale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              € {equity.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Equity di partenza:</p>
            <input
              type="number"
              className="border px-2 py-1 rounded"
              value={startingEquity}
              onChange={(e) => setStartingEquity(Number(e.target.value))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Curva Equity</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {equityHistory.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={equityHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="equity" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              "Nessun trade"
            )}
          </CardContent>
        </Card>
      </div>

      {/* WIN RATE */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiche Win Rate</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Winrate personale: {(winRateUser * 100).toFixed(1)}%</p>
          <p>Gruppo Live: {(winRateGroup["Gruppo Live"] * 100).toFixed(1)}%</p>
          <p>
            Gruppo Elite Pro:{" "}
            {(winRateGroup["Gruppo Elite Pro"] * 100).toFixed(1)}%
          </p>
          <p>Bot: {(winRateGroup["Bot"] * 100).toFixed(1)}%</p>
        </CardContent>
      </Card>

      {/* STAKE CONSIGLIATO */}
      <Card>
        <CardHeader>
          <CardTitle>Stake consigliato per gruppo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {GROUPS.map((g) => {
  const s = stakeFor(g);

  return (
    <div key={g} className="border rounded p-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{g}</h3>
        <span className="text-xs text-muted-foreground">
          WR combinato: {(s.combinedWinRate * 100).toFixed(1)}%
        </span>
      </div>

      {s.allowed ? (
        <>
          <p className="text-xl font-bold mt-1">
            € {s.suggestedStake.toFixed(2)}
          </p>
        </>
      ) : (
        <>
          <p className="text-red-600 font-semibold mt-1">{s.reason}</p>
          <p className="text-sm mt-1">(valori teorici sotto):</p>
        </>
      )}

      {/* MOSTRA SEMPRE I VALORI CALCOLATI */}
      <div className="text-xs text-muted-foreground mt-2">
        <p>Stake teorico: € {s.suggestedStake.toFixed(2)}</p>
        <p>Base: € {s.baseStake.toFixed(2)}</p>
        <p>Kelly ridotto: € {s.kellyStake.toFixed(2)}</p>
        <p>Rischio: {(s.usedRiskPercent * 100).toFixed(2)}%</p>
      </div>
    </div>
  );
})}

        </CardContent>
      </Card>
    </div>
  );
}
