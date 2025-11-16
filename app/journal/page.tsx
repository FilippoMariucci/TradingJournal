"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function TradeLogPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvCount, setCsvCount] = useState(0);

  // FILTRI
  const [filterResult, setFilterResult] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("");
  const [filterDay, setFilterDay] = useState("");

  // ORDINAMENTO
  const [sortColumn, setSortColumn] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  async function loadTrades() {
    const res = await fetch("/api/trades");
    const data = await res.json();
    setTrades(data);
  }

  useEffect(() => {
    loadTrades();
  }, []);

  // Import CSV
  function handleCsvFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        setCsvData(rows);
        setCsvCount(rows.length);
        setShowConfirmModal(true);
      },
    });
  }

  function animateProgress() {
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
      }
      setProgress(p);
    }, 150);
  }

  async function importCsv() {
    if (!csvData.length) return;

    setImporting(true);
    animateProgress();

    await fetch("/api/trades/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(csvData),
    });

    setImporting(false);
    setShowConfirmModal(false);
    setShowDoneModal(true);
    await loadTrades();
  }

  async function deleteAll() {
    if (!confirm("Vuoi davvero eliminare tutti i trade?")) return;
    await fetch("/api/trades/delete-all", { method: "DELETE" });
    loadTrades();
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

  // 📌 TOTALE PNL
  function calculateTotalPnl(trades: any[]) {
    let total = 0;
    trades.forEach((t) => {
      const pnl = Number(t.pnl ?? 0);
      const amount = Number(t.amount ?? 0);

      if (t.result === "Presa") total += pnl;
      else if (t.result === "Persa") total -= Math.abs(amount);
    });
    return total;
  }

  // 📊 STATISTICHE
  function getStats(trades: any[]) {
    let wins = 0;
    let losses = 0;
    let totalWinValue = 0;
    let totalLossValue = 0;
    let rrSum = 0;
    let rrCount = 0;

    trades.forEach((t) => {
      const pnl = Number(t.pnl ?? 0);
      const amount = Number(t.amount ?? 0);

      if (t.result === "Presa") {
        wins++;
        totalWinValue += pnl;
      } else if (t.result === "Persa") {
        losses++;
        totalLossValue += amount;
      }

      if (t.riskReward) {
        rrSum += Number(t.riskReward);
        rrCount++;
      }
    });

    const totalTrades = trades.length;
    const winLossCount = wins + losses;

    const winRate =
      winLossCount > 0 ? (wins / winLossCount) * 100 : 0;

    const profitFactor =
      totalLossValue > 0 ? totalWinValue / totalLossValue : 0;

    const avgTrade =
      totalTrades > 0
        ? (totalWinValue - totalLossValue) / totalTrades
        : 0;

    return {
      totalTrades,
      wins,
      losses,
      winRate,
      totalWinValue,
      totalLossValue,
      avgTrade,
      profitFactor,
      rrAverage: rrCount > 0 ? rrSum / rrCount : 0,
    };
  }

  // 🔍 FILTRI APPLICATI
  const filteredTrades = trades.filter((t) => {
    if (filterResult && t.result !== filterResult) return false;
    if (filterCurrency && t.currencyPair !== filterCurrency) return false;
    if (filterDay && t.dayOfWeek !== filterDay) return false;
    return true;
  });

  // 🔽 ORDINAMENTO
  function sortTrades(list: any[]) {
    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      const x = a[sortColumn];
      const y = b[sortColumn];

      if (x < y) return sortDirection === "asc" ? -1 : 1;
      if (x > y) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const finalTrades = sortTrades(filteredTrades);

  // 📁 ESPORTAZIONE CSV
  function exportCsv() {
    if (!trades.length) return;

    const headers = Object.keys(trades[0]);
    const rows = trades.map((t) =>
      headers.map((h) => `"${t[h] ?? ""}"`).join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "trade_log.csv";
    link.click();
  }

  const totalPnl = calculateTotalPnl(trades);
  const totalIsWin = totalPnl > 0;
  const totalIsLoss = totalPnl < 0;
  const stats = getStats(trades);

  // Funzione helper per rendere sortable le colonne
  function sortableHead(label: string, key: string) {
    return (
      <TableHead
        onClick={() => {
          if (sortColumn === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
          } else {
            setSortColumn(key);
            setSortDirection("asc");
          }
        }}
        className="cursor-pointer select-none"
      >
        {label}
        {sortColumn === key ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
      </TableHead>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#0b0f19] text-white px-6 py-10 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-2">Trade Log</h1>
      <p className="text-neutral-300 mb-6">Tutti i trade importati dal CSV</p>

      {/* 🔥 AZIONI */}
      <div className="flex gap-4 mb-6">
        <Button
          onClick={deleteAll}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          Cancella tutto
        </Button>

        <label className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md cursor-pointer">
          Importa CSV
          <Input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvFile}
          />
        </label>

        <Button
          onClick={exportCsv}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Esporta CSV
        </Button>
      </div>

      {/* 🔍 FILTRI */}
      <div className="w-full max-w-[1600px] grid grid-cols-3 gap-4 mb-8">
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Risultato (tutti)</option>
          <option value="Presa">Presa</option>
          <option value="Persa">Persa</option>
          <option value="Pareggio">Pareggio</option>
        </select>

        <select
          value={filterCurrency}
          onChange={(e) => setFilterCurrency(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Valuta (tutte)</option>
          {Array.from(new Set(trades.map((t) => t.currencyPair))).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Giorno (tutti)</option>
          {["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"].map(
            (d) => (
              <option key={d} value={d}>
                {d}
              </option>
            )
          )}
        </select>
      </div>

      {/* 🟩 TOTALE PnL */}
      <div
        className={`
          mb-6 px-6 py-4 rounded-xl text-2xl font-bold
          ${totalIsWin ? "text-green-400 bg-green-900/30" : ""}
          ${totalIsLoss ? "text-red-400 bg-red-900/30" : ""}
          ${!totalIsWin && !totalIsLoss ? "text-white bg-neutral-700/40" : ""}
        `}
      >
        Totale Guadagno/Perdita:{" "}
        {totalIsWin
          ? `+ ${formatEuro(totalPnl)} €`
          : totalIsLoss
          ? `- ${formatEuro(Math.abs(totalPnl))} €`
          : `0,00 €`}
      </div>

      {/* 📊 STATISTICHE */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[1600px] mb-8">
        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Trade Totali</p>
          <p className="text-2xl font-bold">{stats.totalTrades}</p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Win Rate</p>
          <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Profit Factor</p>
          <p className="text-2xl font-bold">{stats.profitFactor.toFixed(2)}</p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Media per Trade</p>
          <p className="text-2xl font-bold">
            {formatEuro(stats.avgTrade)} €
          </p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Totale Vincite</p>
          <p className="text-2xl font-bold text-green-400">
            + {formatEuro(stats.totalWinValue)} €
          </p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Totale Perdite</p>
          <p className="text-2xl font-bold text-red-400">
            - {formatEuro(stats.totalLossValue)} €
          </p>
        </div>
      </div>

      {/* 🔽 TABELLA */}
      <div
        className="w-full max-w-[1600px] overflow-auto rounded-xl shadow-2xl border border-neutral-700 bg-[#faf7f2]"
      >
        <Table className="min-w-[1550px] text-black">
          <TableHeader className="bg-[#e8e2d5]">
            <TableRow>
              {sortableHead("Trade", "tradeNumber")}
              {sortableHead("Data", "date")}
              {sortableHead("Giorno", "dayOfWeek")}
              {sortableHead("Valuta", "currencyPair")}
              {sortableHead("Posizione", "positionType")}
              {sortableHead("Orario", "openTime")}
              <TableHead>Tipo Gruppo</TableHead>
              {sortableHead("Risultato", "result")}
              {sortableHead("Importo (€)", "amount")}
              {sortableHead("RR (%)", "riskReward")}
              {sortableHead("Guadagno/Perdita (€)", "pnl")}
              {sortableHead("Equity", "equity")}
              <TableHead>Note</TableHead>
              <TableHead>Esito</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {finalTrades.map((t, i) => {
              const pnl = Number(t.pnl ?? 0);
              const amount = Number(t.amount ?? 0);

              let displayPnl = pnl;
              if (t.result === "Persa") {
                displayPnl = -Math.abs(amount);
              }

              const isWin = displayPnl > 0;
              const isLoss = displayPnl < 0;

              return (
                <TableRow
                  key={t.id}
                  className={`${
                    i % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#f3ede2]"
                  } border-b border-neutral-300 hover:bg-[#e8e0cf] transition`}
                >
                  <TableCell>{t.tradeNumber}</TableCell>
                  <TableCell>
                    {t.date ? new Date(t.date).toLocaleDateString("it-IT") : ""}
                  </TableCell>
                  <TableCell>{t.dayOfWeek}</TableCell>
                  <TableCell>{t.currencyPair}</TableCell>
                  <TableCell>{t.positionType}</TableCell>
                  <TableCell>{t.openTime}</TableCell>
                  <TableCell>{t.groupType}</TableCell>
                  <TableCell>{t.result}</TableCell>

                  <TableCell>€ {formatEuro(t.amount)}</TableCell>
                  <TableCell>{t.riskReward ?? ""}%</TableCell>

                  <TableCell
                    className={
                      isWin
                        ? "text-green-600 font-bold"
                        : isLoss
                        ? "text-red-600 font-bold"
                        : "text-black"
                    }
                  >
                    {isWin
                      ? `+ ${formatEuro(displayPnl)} €`
                      : isLoss
                      ? `- ${formatEuro(Math.abs(displayPnl))} €`
                      : `0,00 €`}
                  </TableCell>

                  <TableCell>€ {formatEuro(t.equity)}</TableCell>
                  <TableCell>{t.notes}</TableCell>
                  <TableCell>{t.numericResult}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* MODALE CONFERMA */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-[#111827] text-white border border-neutral-700 max-w-lg">
          <DialogHeader>
            <DialogTitle>Confermi l'importazione?</DialogTitle>
          </DialogHeader>

          <p className="text-neutral-300 mt-3 text-sm">
            Verranno inviati all&apos;import <b>{csvCount}</b> record dal CSV.
            Le righe incomplete verranno automaticamente scartate.
          </p>

          {importing && (
            <div className="w-full h-3 bg-neutral-700 rounded mt-4 overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <Button
            className="w-full bg-green-600 hover:bg-green-700 mt-6"
            onClick={importCsv}
            disabled={importing}
          >
            {importing ? "Importazione in corso..." : "Importa ora"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* MODALE FINE IMPORT */}
      <Dialog open={showDoneModal} onOpenChange={setShowDoneModal}>
        <DialogContent className="bg-[#111827] text-white border border-neutral-700 max-w-sm">
          <DialogHeader>
            <DialogTitle>Importazione completata</DialogTitle>
          </DialogHeader>
          <p className="text-neutral-300 mt-3 text-sm">
            I trade validi sono stati importati correttamente.
          </p>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 mt-6"
            onClick={() => setShowDoneModal(false)}
          >
            Chiudi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
