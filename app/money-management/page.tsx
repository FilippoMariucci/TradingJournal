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
  const [startingEquity, setStartingEquity] = useState(700); // default 700€

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
  });

  // 🔹 Al mount: carico config + startingEquity da localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedConfig = window.localStorage.getItem(
      "moneyManagementConfig"
    );
    if (storedConfig) {
      try {
        const parsed = JSON.parse(storedConfig) as MoneyManagementConfig;
        setConfig(parsed);
      } catch {
        // ignore
      }
    }

    const storedStartEq = window.localStorage.getItem("startingEquity");
    if (storedStartEq) {
      const v = Number(storedStartEq);
      if (!Number.isNaN(v)) setStartingEquity(v);
    }
  }, []);

  // 🔹 Salvo su localStorage quando cambia
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "moneyManagementConfig",
      JSON.stringify(config)
    );
  }, [config]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "startingEquity",
      String(startingEquity)
    );
  }, [startingEquity]);

  // 🔥 Carica tutti i trade dall'API
  useEffect(() => {
    async function load() {
      const res = await fetch("/api/trades");
      const data = await res.json();

      // Normalizzo i dati per sicurezza (pnl numerico, payout in 0.xx, ecc.)
      const normalized: Trade[] = (data || []).map(
        (t: any, index: number) => ({
          id: t.id ?? index,
          groupType: t.groupType,
          pnl:
            typeof t.pnl === "number"
              ? t.pnl
              : Number(
                  String(t.pnl)
                    .replace("€", "")
                    .replace("%", "")
                    .replace(".", "")
                    .replace(",", ".")
                ) || 0,
          date: t.date,
          payout:
            typeof t.payout === "number"
              ? t.payout
              : t.payout
              ? Number(
                  String(t.payout)
                    .replace("%", "")
                    .replace(",", ".")
                ) / 100
              : null,
        })
      );

      setTrades(normalized);
    }

    load();
  }, []);

  // ==========================
  // 📌 CALCOLO STATISTICHE
  // ==========================
  useEffect(() => {
    if (!trades.length) return;

    // Winrate generale, per gruppo, equity, history, dailyPnL
    let totalPnL = 0;
    let wins = 0;

    const wrGroup: Record<GroupType, number> = {
      "Gruppo Live": 0,
      "Gruppo Elite Pro": 0,
      Bot: 0,
    };

    const groupCounts: Record<GroupType, { wins: number; total: number }> = {
      "Gruppo Live": { wins: 0, total: 0 },
      "Gruppo Elite Pro": { wins: 0, total: 0 },
      Bot: { wins: 0, total: 0 },
    };

    // 🔹 serie equity
    const sortedTrades = [...trades].sort((a, b) => {
      if (a.date && b.date) {
        return (
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      }
      return (a.id ?? 0) - (b.id ?? 0);
    });

    let runningEquity = startingEquity;
    const history: EquityPoint[] = [];

    // Per dailyPnL: guardo la data dell'ultimo trade
    const datedTrades = trades.filter((t) => t.date);
    let lastDayPnl = 0;

    let lastDateKey: string | null = null;
    if (datedTrades.length > 0) {
      const last = datedTrades.reduce((acc, t) => {
        if (!acc.date) return t;
        if (
          new Date(t.date as string).getTime() >
          new Date(acc.date as string).getTime()
        ) {
          return t;
        }
        return acc;
      });
      const lastDate = new Date(last.date as string);
      lastDateKey = `${lastDate.getFullYear()}-${
        lastDate.getMonth() + 1
      }-${lastDate.getDate()}`;
    }

    // 🔹 ciclo su sortedTrades per equity + winrate + gruppo
    sortedTrades.forEach((t, i) => {
      const pnlNum =
        typeof t.pnl === "number" ? t.pnl : Number(t.pnl) || 0;
      totalPnL += pnlNum;
      if (pnlNum > 0) wins += 1;

      const gt = t.groupType as GroupType | undefined;
      if (gt && GROUPS.includes(gt)) {
        groupCounts[gt].total += 1;
        if (pnlNum > 0) groupCounts[gt].wins += 1;
      }

      // equity curve
      runningEquity += pnlNum;
      history.push({
        index: i + 1,
        equity: runningEquity,
      });

      // dailyPnL (ultimo giorno)
      if (t.date && lastDateKey) {
        const d = new Date(t.date);
        const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (key === lastDateKey) {
          lastDayPnl += pnlNum;
        }
      }
    });

    const eqFinal = startingEquity + totalPnL;
    setEquity(eqFinal);
    setEquityHistory(history);

    const wrUser =
      trades.length > 0 ? wins / trades.length : 0.5;
    setWinRateUser(wrUser);

    GROUPS.forEach((g) => {
      const info = groupCounts[g];
      wrGroup[g] =
        info.total > 0 ? info.wins / info.total : wrUser || 0.5;
    });
    setWinRateGroup(wrGroup);

    const dailyPct =
      eqFinal !== 0 ? lastDayPnl / eqFinal : 0;
    setDailyPnLPercent(dailyPct);

    // Perdite consecutive globali
    let consec = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      const pnlNum =
        typeof trades[i].pnl === "number"
          ? trades[i].pnl
          : Number(trades[i].pnl) || 0;
      if (pnlNum < 0) consec++;
      else break;
    }
    setConsecutiveLosses(consec);
  }, [trades, startingEquity]);

  const isDailyLossLimitHit =
    dailyPnLPercent <= -config.maxDailyLossPercent;
  const isConsecLimitHit =
    consecutiveLosses >= config.maxConsecutiveLosses;

  const stakeByGroup: Record<GroupType, StakeSuggestion> = {
    "Gruppo Live": getSuggestionForGroup("Gruppo Live"),
    "Gruppo Elite Pro": getSuggestionForGroup("Gruppo Elite Pro"),
    Bot: getSuggestionForGroup("Bot"),
  };

  function getSuggestionForGroup(group: GroupType): StakeSuggestion {
    const stats: StatsInput = {
      equity,
      winRateUser,
      winRateGroup: winRateGroup[group],
      payout: payoutAvg[group],
      consecutiveLosses,
      dailyPnLPercent,
    };

    return calculateStakeSuggestion(config, stats);
  }

  // ==========================
  // 🧩 RENDER
  // ==========================

  return (
    <div className="p-6 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold mb-2">
        💰 Money Management
      </h1>
      <p className="text-sm text-muted-foreground">
        Controllo completo del rischio basato su equity, winrate e
        gruppi (Live, Elite Pro, Bot).
      </p>

      {/* ALERT GLOBALI */}
      {(isDailyLossLimitHit || isConsecLimitHit) && (
        <Card className="border-red-500/50 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">
              ⚠️ Attenzione: limiti di sicurezza raggiunti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-red-800">
            {isDailyLossLimitHit && (
              <p>
                • Limite di perdita giornaliera superato (
                {(dailyPnLPercent * 100).toFixed(2)}%).
              </p>
            )}
            {isConsecLimitHit && (
              <p>
                • Hai {consecutiveLosses} perdite consecutive
                (limite: {config.maxConsecutiveLosses}).
              </p>
            )}
            <p className="font-semibold mt-1">
              Il sistema blocca automaticamente lo stake
              consigliato.
            </p>
          </CardContent>
        </Card>
      )}

      {/* RIGA EQUITY + GRAFICO */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Equity attuale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-bold">
              € {equity.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              Equity di partenza:
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="border rounded px-2 py-1 w-28 text-sm"
                value={startingEquity}
                onChange={(e) =>
                  setStartingEquity(
                    Number(e.target.value) || 0
                  )
                }
              />
              <span className="text-xs text-muted-foreground">
                Modifica il budget iniziale (es. 700)
              </span>
            </div>
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
                  <XAxis
                    dataKey="index"
                    tick={{ fontSize: 10 }}
                    label={{
                      value: "Trade #",
                      position: "insideBottom",
                      offset: -2,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={60}
                    tickFormatter={(v) => `€ ${v}`}
                  />
                  <Tooltip
                    formatter={(value: any) =>
                      `€ ${Number(value).toFixed(2)}`
                    }
                    labelFormatter={(label) =>
                      `Trade #${label}`
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun trade disponibile per costruire la curva
                equity.
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
            <p className="font-semibold">
              Winrate personale:{" "}
              {(winRateUser * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Calcolato su tutti i trade registrati.
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="font-semibold">
                Gruppo Live:
              </span>{" "}
              {(winRateGroup["Gruppo Live"] * 100).toFixed(1)}%
            </p>
            <p>
              <span className="font-semibold">
                Gruppo Elite Pro:
              </span>{" "}
              {(
                winRateGroup["Gruppo Elite Pro"] * 100
              ).toFixed(1)}
              %
            </p>
            <p>
              <span className="font-semibold">Bot:</span>{" "}
              {(winRateGroup["Bot"] * 100).toFixed(1)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* STAKE CONSIGLIATO PER OGNI GRUPPO */}
      <Card>
        <CardHeader>
          <CardTitle>Stake consigliato per gruppo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {GROUPS.map((g) => {
            const s = stakeByGroup[g];

            return (
              <div
                key={g}
                className="border rounded p-3 flex flex-col gap-1"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">{g}</h3>
                  <span className="text-xs text-muted-foreground">
                    WR combinato:{" "}
                    {(s.combinedWinRate * 100).toFixed(1)}%
                  </span>
                </div>

                {s.allowed ? (
                  <>
                    <p className="text-lg font-bold">
                      Importo consigliato: €{" "}
                      {s.suggestedStake.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Base: € {s.baseStake.toFixed(2)} | Kelly
                      ridotto: € {s.kellyStake.toFixed(2)} | Rischio
                      usato: {(s.usedRiskPercent * 100).toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-red-600">
                    {s.reason}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* RISCHIO GIORNALIERO */}
      <Card>
        <CardHeader>
          <CardTitle>Rischio giornaliero e disciplina</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p>
              <span className="font-semibold">
                PnL ultimo giorno:
              </span>{" "}
              {(dailyPnLPercent * 100).toFixed(2)}%
            </p>
            <p>
              <span className="font-semibold">
                Limite perdita giornaliera:
              </span>{" "}
              {(config.maxDailyLossPercent * 100).toFixed(2)}%
            </p>
            <p>
              <span className="font-semibold">
                Perdite consecutive:
              </span>{" "}
              {consecutiveLosses} /{" "}
              {config.maxConsecutiveLosses}
            </p>
          </div>

          {/* IMPOSTAZIONI */}
          <div className="space-y-2">
            <p className="font-semibold">
              Impostazioni Money Management
            </p>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">
                Rischio base / trade
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-sm"
                min={0.1}
                max={5}
                step={0.1}
                value={(config.baseRiskPercent * 100).toFixed(1)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const pct = !Number.isNaN(v) ? v / 100 : 0.01;
                  setConfig((c) => ({
                    ...c,
                    baseRiskPercent: pct,
                  }));
                }}
              />
              <span className="text-xs text-muted-foreground">
                %
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">
                Kelly factor
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-sm"
                min={0}
                max={1}
                step={0.05}
                value={config.kellyFactor}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setConfig((c) => ({
                    ...c,
                    kellyFactor: !Number.isNaN(v) ? v : 0.25,
                  }));
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">
                Max loss giornaliera
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-sm"
                min={1}
                max={15}
                step={0.5}
                value={(
                  config.maxDailyLossPercent * 100
                ).toFixed(1)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const pct = !Number.isNaN(v) ? v / 100 : 0.04;
                  setConfig((c) => ({
                    ...c,
                    maxDailyLossPercent: pct,
                  }));
                }}
              />
              <span className="text-xs text-muted-foreground">
                %
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">
                Max perdite di fila
              </label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-sm"
                min={1}
                max={10}
                value={config.maxConsecutiveLosses}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setConfig((c) => ({
                    ...c,
                    maxConsecutiveLosses:
                      !Number.isNaN(v) && v > 0 ? v : 3,
                  }));
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
