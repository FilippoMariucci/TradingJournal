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

type Trade = {
  id: number;
  groupType?: GroupType | string;
  pnl: number | string;
  date?: string;
  payout?: number | string | null;
};

type EquityPoint = {
  index: number;
  equity: number;
};

const GROUPS: GroupType[] = ["Gruppo Live", "Gruppo Elite Pro", "Bot"];

export default function MoneyManagementPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equity, setEquity] = useState(0);
  const [startingEquity, setStartingEquity] = useState(700);

  const [winRateUser, setWinRateUser] = useState(0);
  const [winRateGroup, setWinRateGroup] = useState<Record<GroupType, number>>({
    "Gruppo Live": 0,
    "Gruppo Elite Pro": 0,
    Bot: 0,
  });

  const [payoutAvg, setPayoutAvg] = useState<Record<GroupType, number>>({
    "Gruppo Live": 0.82,
    "Gruppo Elite Pro": 0.86,
    Bot: 0.8,
  });

  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [dailyPnLPercent, setDailyPnLPercent] = useState(0);
  const [equityHistory, setEquityHistory] = useState<EquityPoint[]>([]);

  const [config, setConfig] = useState<MoneyManagementConfig>({
    baseRiskPercent: 0.01,
    kellyFactor: 0.25,
    maxDailyLossPercent: 0.04,
    maxConsecutiveLosses: 3,
    stakeMinimo: 2,
    recoveryReduction: 0.7,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedConfig = window.localStorage.getItem("moneyManagementConfig");
    if (storedConfig) {
      try {
        setConfig(JSON.parse(storedConfig));
      } catch {}
    }

    const storedStartEq = window.localStorage.getItem("startingEquity");
    if (storedStartEq && !Number.isNaN(Number(storedStartEq))) {
      setStartingEquity(Number(storedStartEq));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("moneyManagementConfig", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("startingEquity", String(startingEquity));
  }, [startingEquity]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/trades");
      const data = await res.json();

      const normalized: Trade[] = (data || []).map((t: any, index: number) => ({
        id: t.id ?? index,
        groupType: t.groupType,
        pnl: Number(String(t.pnl).replace("€", "").replace(",", ".")) || 0,
        date: t.date,
        payout:
          typeof t.payout === "number"
            ? t.payout
            : t.payout
            ? Number(String(t.payout).replace("%", "")) / 100
            : 0.8,
      }));

      setTrades(normalized);
    }

    load();
  }, []);

  // ================================
  // 📊 CALCOLO STATS
  // ================================
  useEffect(() => {
    if (!trades.length) return;

    let totalPnL = 0;
    let wins = 0;

    const groupCounts = {
      "Gruppo Live": { wins: 0, total: 0 },
      "Gruppo Elite Pro": { wins: 0, total: 0 },
      Bot: { wins: 0, total: 0 },
    };

    const sortedTrades = [...trades].sort((a, b) => {
      if (a.date && b.date)
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      return (a.id ?? 0) - (b.id ?? 0);
    });

    let runningEquity = startingEquity;
    const history: EquityPoint[] = [];

    const datedTrades = trades.filter((t) => t.date);
    let lastDayPnL = 0;

    let lastDateKey: string | null = null;
    if (datedTrades.length > 0) {
      const last = datedTrades.reduce((acc, t) => {
        return new Date(t.date!).getTime() > new Date(acc.date!).getTime()
          ? t
          : acc;
      });
      const d = new Date(last.date!);
      lastDateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    sortedTrades.forEach((t, i) => {
      const pnl = Number(t.pnl);
      totalPnL += pnl;
      if (pnl > 0) wins++;

      const g = t.groupType as GroupType;
      if (GROUPS.includes(g)) {
        groupCounts[g].total++;
        if (pnl > 0) groupCounts[g].wins++;
      }

      runningEquity += pnl;
      history.push({ index: i + 1, equity: runningEquity });

      if (t.date && lastDateKey) {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (key === lastDateKey) lastDayPnL += pnl;
      }
    });

    const finalEq = startingEquity + totalPnL;
    setEquity(finalEq);
    setEquityHistory(history);

    const wrUser = wins / trades.length;
    setWinRateUser(wrUser);

    const wrGroup: Record<GroupType, number> = {
      "Gruppo Live": wrUser,
      "Gruppo Elite Pro": wrUser,
      Bot: wrUser,
    };

    GROUPS.forEach((g) => {
      const info = groupCounts[g];
      if (info.total > 0) wrGroup[g] = info.wins / info.total;
    });

    setWinRateGroup(wrGroup);

    setDailyPnLPercent(finalEq !== 0 ? lastDayPnL / finalEq : 0);

    let consec = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      if (Number(trades[i].pnl) < 0) consec++;
      else break;
    }
    setConsecutiveLosses(consec);
  }, [trades, startingEquity]);

  const isDailyLossLimitHit = dailyPnLPercent <= -config.maxDailyLossPercent;
  const isConsecLimitHit = consecutiveLosses >= config.maxConsecutiveLosses;

  // ================================
  // 🧠 STAKE: KELLY ADATTIVO + RECOVERY
  // ================================
  function getSuggestionForGroup(group: GroupType): StakeSuggestion {
    const stats: StatsInput = {
      equity,
      winRateUser,
      winRateGroup: winRateGroup[group],
      payout: payoutAvg[group],
      consecutiveLosses,
      dailyPnLPercent,
    };

    const result = calculateStakeSuggestion(config, stats);

    // ⭐ Kelly adattivo
    const adaptiveKellyMultiplier = 1 + (stats.winRateUser - 0.5);
    result.kellyStake = Math.max(result.kellyStake * adaptiveKellyMultiplier, 0);

    // ⭐ Stake minimo garantito
    result.suggestedStake = Math.max(
      result.suggestedStake,
      result.kellyStake,
      result.baseStake,
      config.stakeMinimo
    );

    // ⭐ Recovery mode
    if (isDailyLossLimitHit || isConsecLimitHit) {
      result.allowed = false;
      result.reason = "Modalità Recovery attiva (stake ridotto del 70%)";
      result.suggestedStake = result.suggestedStake * config.recoveryReduction;
    }

    return result;
  }

  const stakeByGroup: Record<GroupType, StakeSuggestion> = {
    "Gruppo Live": getSuggestionForGroup("Gruppo Live"),
    "Gruppo Elite Pro": getSuggestionForGroup("Gruppo Elite Pro"),
    Bot: getSuggestionForGroup("Bot"),
  };

  // ================================
  // 🔮 SIMULAZIONE FUTURI 5 TRADE (AVANZATA)
  // ================================
  function simulateFutureTrades() {
    let simEq = equity;

    return Array.from({ length: 5 }).map((_, i) => {
      const group = GROUPS[i % GROUPS.length];
      const s = stakeByGroup[group];

      const stake = Number(s.suggestedStake) || config.stakeMinimo;

      const WR = winRateUser || 0.5;
      const payout = payoutAvg[group] || 0.8;

      const EV = WR * payout - (1 - WR);

      simEq = simEq + stake * EV;

      return {
        n: i + 1,
        group,
        stake: stake.toFixed(2),
        equity: simEq.toFixed(2),
      };
    });
  }

  const future = simulateFutureTrades();

  // ================================
  // 🎨 RENDER
  // ================================
  return (
    <div className="p-6 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">💰 Money Management</h1>
      <p className="text-sm text-muted-foreground">
        Controllo completo del rischio basato su equity, winrate e gruppi.
      </p>

      {(isDailyLossLimitHit || isConsecLimitHit) && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">
              ⚠️ Attenzione: limiti di sicurezza raggiunti
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800 space-y-1">
            {isDailyLossLimitHit && (
              <p>
                • Limite di perdita giornaliera superato (
                {(dailyPnLPercent * 100).toFixed(2)}%).
              </p>
            )}
            {isConsecLimitHit && (
              <p>
                • Hai {consecutiveLosses} perdite consecutive (limite:{" "}
                {config.maxConsecutiveLosses})
              </p>
            )}
            <p className="font-semibold mt-1">
              Il sistema blocca automaticamente lo stake consigliato.
            </p>
          </CardContent>
        </Card>
      )}

      {/* EQUITY + GRAFICO */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Equity attuale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">€ {equity.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">
              Equity di partenza:
            </div>
            <input
              type="number"
              className="border rounded px-2 py-1 w-28 text-sm"
              value={startingEquity}
              onChange={(e) => setStartingEquity(Number(e.target.value) || 0)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Curva Equity</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {equityHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equityHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="index" />
                  <YAxis
                    tickFormatter={(v) => `€ ${v}`}
                    width={50}
                  />
                  <Tooltip formatter={(v) => `€ ${v}`} />
                  <Legend />
                  <Line dataKey="equity" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nessun dato per costruire la curva.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WIN RATE */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiche Win Rate</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            Winrate personale:{" "}
            <span className="font-semibold">
              {(winRateUser * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <p>Gruppo Live: {(winRateGroup["Gruppo Live"] * 100).toFixed(1)}%</p>
            <p>
              Gruppo Elite Pro:{" "}
              {(winRateGroup["Gruppo Elite Pro"] * 100).toFixed(1)}%
            </p>
            <p>Bot: {(winRateGroup["Bot"] * 100).toFixed(1)}%</p>
          </div>
        </CardContent>
      </Card>

      {/* STAKE PER GRUPPO */}
      <Card>
        <CardHeader>
          <CardTitle>Stake consigliato per gruppo</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {GROUPS.map((g) => {
            const s = stakeByGroup[g];

            return (
              <div key={g} className="border rounded p-3 flex flex-col gap-2">

                <div className="flex justify-between">
                  <h3 className="font-semibold">{g}</h3>
                  <span className="text-xs text-muted-foreground">
                    WR combinato: {(s.combinedWinRate * 100).toFixed(1)}%
                  </span>
                </div>

                {!s.allowed && (
                  <div className="bg-yellow-50 border-l-4 border-yellow-500 p-2 rounded">
                    <p className="text-sm font-semibold text-yellow-700">
                      {s.reason}
                    </p>
                    <p className="text-xs text-yellow-700">
                      (valori teorici sotto)
                    </p>
                  </div>
                )}

                <p className="text-sm">
                  Stake teorico: <b>€ {s.suggestedStake.toFixed(2)}</b>
                </p>
                <p className="text-xs text-muted-foreground">
                  Base: € {s.baseStake.toFixed(2)} | Kelly: €{" "}
                  {s.kellyStake.toFixed(2)} | Rischio:{" "}
                  {(s.usedRiskPercent * 100).toFixed(2)}%
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* SIMULAZIONE FUTURA */}
      <Card>
        <CardHeader>
          <CardTitle>Operazioni future consigliate</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p className="text-muted-foreground mb-3">
            Simulazione dei prossimi 5 trade basata su equity attuale, Kelly
            adattivo e winrate.
          </p>

          <div className="border rounded">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">Gruppo</th>
                  <th className="p-2 text-left">Stake</th>
                  <th className="p-2 text-left">Equity stimata</th>
                </tr>
              </thead>

              <tbody>
                {future.map((f) => (
                  <tr key={f.n} className="border-b">
                    <td className="p-2">{f.n}</td>
                    <td className="p-2">{f.group}</td>
                    <td className="p-2">€ {f.stake}</td>
                    <td className="p-2">€ {f.equity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* RISCHIO GIORNALIERO */}
      <Card>
        <CardHeader>
          <CardTitle>Rischio giornaliero e disciplina</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <p>PnL ultimo giorno: {(dailyPnLPercent * 100).toFixed(2)}%</p>
            <p>Limite perdita giornaliera: {(config.maxDailyLossPercent * 100).toFixed(1)}%</p>
            <p>
              Perdite consecutive: {consecutiveLosses} /{" "}
              {config.maxConsecutiveLosses}
            </p>
          </div>

          {/* IMPOSTAZIONI */}
          <div className="space-y-2">
            <p className="font-semibold">Impostazioni Money Management</p>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Rischio base / trade</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-sm"
                value={(config.baseRiskPercent * 100).toFixed(1)}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    baseRiskPercent: Number(e.target.value) / 100,
                  }))
                }
              />
              %
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
