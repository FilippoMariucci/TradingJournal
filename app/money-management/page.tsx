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

type SimulatedTrade = {
  n: number;
  stake: string;
  equity: string;
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

  // ---------- LOAD CONFIG & START EQUITY ----------
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

  // ---------- LOAD TRADES ----------
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
            ? Number(String(t.payout).replace("%", "").replace(",", ".")) / 100
            : 0.8,
      }));

      setTrades(normalized);
    }

    load();
  }, []);

  // ---------- CALCOLO STATISTICHE ----------
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
      const last = datedTrades.reduce((acc, t) =>
        !acc.date || new Date(t.date!).getTime() > new Date(acc.date!).getTime()
          ? t
          : acc
      );
      const d = new Date(last.date!);
      lastDateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }

    sortedTrades.forEach((t, i) => {
      const pnl = Number(t.pnl) || 0;
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

    setEquity(runningEquity);
    setEquityHistory(history);

    const wrUser = trades.length > 0 ? wins / trades.length : 0.5;
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

    setDailyPnLPercent(runningEquity !== 0 ? lastDayPnL / runningEquity : 0);

    let consec = 0;
    for (let i = trades.length - 1; i >= 0; i--) {
      const pnlNum = Number(trades[i].pnl) || 0;
      if (pnlNum < 0) consec++;
      else break;
    }
    setConsecutiveLosses(consec);
  }, [trades, startingEquity]);

  const isDailyLossLimitHit =
    dailyPnLPercent <= -config.maxDailyLossPercent;
  const isConsecLimitHit =
    consecutiveLosses >= config.maxConsecutiveLosses;

  // ---------- STAKE PER GRUPPO (KELLY + RECOVERY) ----------
  function getSuggestionForGroup(group: GroupType): StakeSuggestion {
    const stats: StatsInput = {
      equity,
      winRateUser,
      winRateGroup: winRateGroup[group],
      payout: payoutAvg[group],
      consecutiveLosses,
      dailyPnLPercent,
    };

    const base = calculateStakeSuggestion(config, stats);

    // Kelly del gruppo (vero, non solo combinato)
    const WRg = winRateGroup[group] || 0.5;
    const payout = payoutAvg[group] || 0.8;
    const kellyRaw = ((WRg * (payout + 1)) - 1) / payout;
    const kellyAdjusted = Math.max(kellyRaw * config.kellyFactor, 0);
    base.kellyStake = equity * kellyAdjusted;

    // Kelly adattivo in base al tuo WR personale
    const adaptiveMultiplier = 1 + (winRateUser - 0.5);
    base.kellyStake = base.kellyStake * adaptiveMultiplier;

    // Stake teorico: max tra Kelly, rischio base e minimo
    base.suggestedStake = Math.max(
      base.kellyStake,
      base.baseStake,
      config.stakeMinimo
    );

    // Recovery mode
    if (isDailyLossLimitHit || isConsecLimitHit) {
      base.allowed = false;
      base.reason = "Modalità Recovery attiva (stake ridotto del 70%)";
      base.suggestedStake = base.suggestedStake * config.recoveryReduction;
    }

    return base;
  }

  const stakeByGroup: Record<GroupType, StakeSuggestion> = {
    "Gruppo Live": getSuggestionForGroup("Gruppo Live"),
    "Gruppo Elite Pro": getSuggestionForGroup("Gruppo Elite Pro"),
    Bot: getSuggestionForGroup("Bot"),
  };

  const maxStake = Math.max(
    ...GROUPS.map((g) => stakeByGroup[g].suggestedStake || 0),
    1
  );

  // ---------- CONFIDENCE INDEX + RATING ----------
  function getConfidenceIndex(group: GroupType, s: StakeSuggestion): number {
    const wr = winRateGroup[group] || 0.5; // 0–1
    const payout = payoutAvg[group] || 0.8;

    const wrScore = wr * 100; // 0–100
    const payoutScore = Math.min(payout / 1.0, 1) * 100; // fino a payout 1.0
    const riskScore =
      100 - Math.min((s.usedRiskPercent * 100) / 3, 100); // più rischio = meno score

    const total = 0.6 * wrScore + 0.2 * payoutScore + 0.2 * riskScore;
    return Math.round(total);
  }

  function getRatingStars(confidence: number): string {
    const stars = Math.round((confidence / 100) * 5);
    const filled = "★".repeat(stars);
    const empty = "☆".repeat(5 - stars);
    return filled + empty;
  }

  // ---------- SIMULAZIONE SESSIONE (12 TRADE PER OGNI GRUPPO) ----------
  function simulateSessionForGroup(group: GroupType): SimulatedTrade[] {
    let simEq = equity;
    const s = stakeByGroup[group];
    const stake = Number(s.suggestedStake) || config.stakeMinimo;
    const WRg = winRateGroup[group] || 0.5;
    const payout = payoutAvg[group] || 0.8;

    const EV = WRg * payout - (1 - WRg); // valore atteso per unità di stake

    const res: SimulatedTrade[] = [];

    for (let i = 0; i < 12; i++) {
      simEq = simEq + stake * EV;
      res.push({
        n: i + 1,
        stake: stake.toFixed(2),
        equity: simEq.toFixed(2),
      });
    }

    return res;
  }

  const futureLive = simulateSessionForGroup("Gruppo Live");
  const futureElite = simulateSessionForGroup("Gruppo Elite Pro");
  const futureBot = simulateSessionForGroup("Bot");

  // ---------- RENDER ----------
  return (
    <div className="p-6 md:p-8 space-y-6">
      <h1 className="text-3xl font-bold">💰 Money Management</h1>
      <p className="text-sm text-muted-foreground">
        Controllo completo del rischio basato su equity, winrate e gruppi (Live, Elite Pro, Bot).
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
                  <YAxis tickFormatter={(v) => `€ ${v}`} width={60} />
                  <Tooltip formatter={(v: any) => `€ ${Number(v).toFixed(2)}`} />
                  <Legend />
                  <Line dataKey="equity" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nessun trade disponibile per costruire la curva equity.
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
              Winrate personale: {(winRateUser * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Calcolato su tutti i trade registrati.
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="font-semibold">Gruppo Live:</span>{" "}
              {(winRateGroup["Gruppo Live"] * 100).toFixed(1)}%
            </p>
            <p>
              <span className="font-semibold">Gruppo Elite Pro:</span>{" "}
              {(winRateGroup["Gruppo Elite Pro"] * 100).toFixed(1)}%
            </p>
            <p>
              <span className="font-semibold">Bot:</span>{" "}
              {(winRateGroup["Bot"] * 100).toFixed(1)}%
            </p>
          </div>
        </CardContent>
      </Card>

      {/* STAKE CONSIGLIATO PER GRUPPO + ANALISI */}
      <Card>
        <CardHeader>
          <CardTitle>Stake consigliato per gruppo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {GROUPS.map((g) => {
            const s = stakeByGroup[g];
            const confidence = getConfidenceIndex(g, s);
            const rating = getRatingStars(confidence);
            const barWidth = `${(s.suggestedStake / maxStake) * 100}%`;

            return (
              <div key={g} className="border rounded p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
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

                {/* Confidence & rating */}
                <div className="flex flex-wrap items-center gap-3 text-xs mt-1">
                  <span>
                    Confidence Index: <b>{confidence}/100</b>
                  </span>
                  <span>Rating: {rating}</span>
                </div>

                {/* Mini barra comparazione stake */}
                <div className="mt-2 h-2 w-full bg-slate-200 rounded">
                  <div
                    className="h-2 rounded bg-blue-500"
                    style={{ width: barWidth }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Lunghezza barra proporzionale allo stake teorico rispetto agli altri gruppi.
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* SIMULAZIONE SESSIONE: 12 TRADE PER OGNI GRUPPO */}
      <Card>
        <CardHeader>
          <CardTitle>Simulazione sessione (12 trade) per gruppo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-xs md:text-sm">
          <p className="text-muted-foreground">
            Ogni tabella mostra come potrebbe evolvere l&apos;equity nei prossimi 12 trade
            se operassi solo con i segnali di quel gruppo.
          </p>

          {[
            { label: "Gruppo Live", data: futureLive as SimulatedTrade[] },
            { label: "Gruppo Elite Pro", data: futureElite as SimulatedTrade[] },
            { label: "Bot", data: futureBot as SimulatedTrade[] },
          ].map((block) => (
            <div key={block.label} className="border rounded">
              <div className="border-b px-3 py-2 font-semibold">
                {block.label}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Stake</th>
                    <th className="p-2 text-left">Equity stimata</th>
                  </tr>
                </thead>
                <tbody>
                  {block.data.map((row) => (
                    <tr key={row.n} className="border-b">
                      <td className="p-2">{row.n}</td>
                      <td className="p-2">€ {row.stake}</td>
                      <td className="p-2">€ {row.equity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* RISCHIO GIORNALIERO + IMPOSTAZIONI */}
      <Card>
        <CardHeader>
          <CardTitle>Rischio giornaliero e disciplina</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <p>
              <span className="font-semibold">PnL ultimo giorno:</span>{" "}
              {(dailyPnLPercent * 100).toFixed(2)}%
            </p>
            <p>
              <span className="font-semibold">
                Limite perdita giornaliera:
              </span>{" "}
              {(config.maxDailyLossPercent * 100).toFixed(1)}%
            </p>
            <p>
              <span className="font-semibold">Perdite consecutive:</span>{" "}
              {consecutiveLosses} / {config.maxConsecutiveLosses}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Impostazioni Money Management</p>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Rischio base / trade</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-xs"
                value={(config.baseRiskPercent * 100).toFixed(1)}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    baseRiskPercent: Number(e.target.value) / 100 || 0.01,
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Kelly factor</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-xs"
                min={0}
                max={1}
                step={0.05}
                value={config.kellyFactor}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    kellyFactor: Number(e.target.value) || 0.25,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Min. stake (€)</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-xs"
                min={0}
                step={0.5}
                value={config.stakeMinimo}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    stakeMinimo: Number(e.target.value) || 1,
                  }))
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Max loss giornaliera</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-xs"
                value={(config.maxDailyLossPercent * 100).toFixed(1)}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    maxDailyLossPercent: Number(e.target.value) / 100 || 0.04,
                  }))
                }
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs w-32">Max perdite di fila</label>
              <input
                type="number"
                className="border rounded px-2 py-1 w-20 text-xs"
                min={1}
                max={10}
                value={config.maxConsecutiveLosses}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    maxConsecutiveLosses: Number(e.target.value) || 3,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
