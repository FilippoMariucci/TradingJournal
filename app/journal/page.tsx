"use client";

import React, { useEffect, useState } from "react";
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
import { useSession } from "next-auth/react";

type Trade = {
  id: number;
  importOrder: number;
  tradeNumber?: number;
  date?: string;
  dayOfWeek?: string;
  currencyPair?: string;
  positionType?: string;
  openTime?: string;
  groupType?: string;
  result?: string;
  amount?: number;
  riskReward?: number;
  pnl?: number;
  equity?: number;
  notes?: string;
  numericResult?: number;
};

export default function TradeLogPage() {
  const { data: session } = useSession();
  const isLogged = !!session;

  const [trades, setTrades] = useState<Trade[]>([]);
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
  const [filterGroup, setFilterGroup] = useState("");

  // ORDINAMENTO
  const [sortColumn, setSortColumn] = useState("");
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");

  // EDIT TRADE
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  async function loadTrades() {
    const res = await fetch("/api/trades");
    const data = await res.json();
    setTrades(data);
  }

  useEffect(() => {
    loadTrades();
  }, []);

  // Import CSV
  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
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
    await fetch("/api/trades/delate-all", { method: "DELETE" });
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

  function computeDisplayPnl(t: Trade) {
  const amount = Number(t.amount ?? 0);
  const realPnl = t.pnl !== null && t.pnl !== undefined ? Number(t.pnl) : null;

  const res = t.result?.toString().toLowerCase().trim() ?? "";

  // SE IL TRADE HA UN PNL REALE (CSV)
  if (realPnl !== null) {
    return realPnl;
  }

  // SE IL TRADE È MANUALE (nessun PNL)
  if (res.includes("presa") || res.includes("vinta")) {
    return Math.abs(amount);
  }

  if (res.includes("persa") || res.includes("loss")) {
    return -Math.abs(amount);
  }

  if (res.includes("pari") || res.includes("pareggio") || res.includes("break")) {
    return 0;
  }

  return 0;
}



  function calculateTotalPnl(list: Trade[]) {
    return list.reduce((sum, t) => sum + computeDisplayPnl(t), 0);
  }

  function getStats(list: Trade[]) {
    let wins = 0;
    let losses = 0;
    let totalWinValue = 0;
    let totalLossValue = 0;
    let rrSum = 0;
    let rrCount = 0;

    list.forEach((t) => {
      const dpnl = computeDisplayPnl(t);
      const res = t.result?.toLowerCase() ?? "";
      const amount = Number(t.amount ?? 0);

      if (res === "presa") {
        wins++;
        totalWinValue += dpnl;
      } else if (res === "persa") {
        losses++;
        totalLossValue += Math.abs(dpnl || amount);
      }

      if (
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
      winRate,
      totalWinValue,
      totalLossValue,
      avgTrade,
      profitFactor,
      rrAverage: rrCount > 0 ? rrSum / rrCount : 0,
    };
  }

  const filteredTrades = trades.filter((t) => {
    if (filterResult && t.result !== filterResult) return false;
    if (filterCurrency && t.currencyPair !== filterCurrency) return false;
    if (filterDay && t.dayOfWeek !== filterDay) return false;
    if (filterGroup && t.groupType !== filterGroup) return false;
    return true;
  });

  function sortTrades(list: Trade[]) {
    if (!sortColumn) return list;

    return [...list].sort((a, b) => {
      const x = (a as any)[sortColumn];
      const y = (b as any)[sortColumn];

      if (x < y) return sortDirection === "asc" ? -1 : 1;
      if (x > y) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const finalTrades = sortTrades(filteredTrades);

  function exportCsv() {
    if (!trades.length) return;

    const headers = Object.keys(trades[0]);
    const rows = trades.map((t: any) =>
      headers.map((h) => `"${t[h] ?? ""}"`).join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
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

  function sortableHead(label: string, key: string) {
    return (
      <TableHead
        onClick={() => {
          if (sortColumn === key) {
            setSortDirection(
              sortDirection === "asc" ? "desc" : "asc"
            );
          } else {
            setSortColumn(key);
            setSortDirection("asc");
          }
        }}
        className="cursor-pointer select-none"
      >
        {label}
        {sortColumn === key
          ? sortDirection === "asc"
            ? " ▲"
            : " ▼"
          : ""}
      </TableHead>
    );
  }

  async function deleteTrade(id: number) {
    if (!confirm("Vuoi eliminare questo trade?")) return;
    await fetch(`/api/trades/${id}`, {
      method: "DELETE",
    });
    await loadTrades();
  }

  async function saveEditedTrade(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    if (!editingTrade) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const body = {
      date: formData.get("date") || null,
      dayOfWeek: formData.get("dayOfWeek") || null,
      currencyPair: formData.get("currencyPair") || null,
      positionType: formData.get("positionType") || null,
      openTime: formData.get("openTime") || null,
      groupType: formData.get("groupType") || null,
      result: formData.get("result") || null,
      amount: formData.get("amount")
        ? Number(formData.get("amount"))
        : null,
      riskReward: formData.get("riskReward")
        ? Number(formData.get("riskReward"))
        : null,
      notes: formData.get("notes") || null,
    };

    await fetch(`/api/trades/${editingTrade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setShowEditModal(false);
    setEditingTrade(null);
    await loadTrades();
  }

  return (
    <div className="w-full min-h-screen bg-[#0b0f19] text-white px-6 py-10 flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-2">Trade Journal</h1>
      <p className="text-neutral-300 mb-6">
        Tutti i trade importati dal CSV e inseriti manualmente
      </p>

      {/* 🔥 AZIONI (solo loggati possono cancellare/importare) */}
      <div className="flex flex-wrap gap-4 mb-6">
        {isLogged && (
          <Button
            onClick={deleteAll}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Cancella tutto
          </Button>
        )}

        {isLogged && (
          <label className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md cursor-pointer">
            Importa CSV
            <Input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvFile}
            />
          </label>
        )}

        <Button
          onClick={exportCsv}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Esporta CSV
        </Button>

        <Button
  onClick={async () => {
    if (!confirm("Vuoi rinumerare tutti i trade in ordine crescente?")) return;

    await fetch("/api/trades/renumber", {
      method: "POST",
    });

    await loadTrades();
    alert("Numerazione completata!");
  }}
  className="bg-purple-600 hover:bg-purple-700 text-white"
>
  Rinumerazione automatica
</Button>

<Button
  className="bg-purple-600 hover:bg-purple-700 text-white"
  onClick={async () => {
    const ok = confirm("Vuoi davvero ricalcolare l'equity da zero?");
    if (!ok) return;

    const res = await fetch("/api/trades/recalculate-equity", {
      method: "POST",
    });

    if (res.ok) {
      alert("Equity ricalcolata correttamente!");
      loadTrades(); // 🔄 aggiorna subito la tabella
    } else {
      alert("Errore durante il ricalcolo dell'equity.");
    }
  }}
>
  🔄 Ricalcola Equity da Zero
</Button>

      </div>


      {/* ➕ INSERIMENTO MANUALE TRADE (solo loggati) */}
      {isLogged && (
        <div className="w-full max-w-[1600px] bg-[#1f2937] p-6 rounded-xl border border-neutral-700 mb-8">
          <h2 className="text-xl font-bold mb-4">
            Aggiungi Trade Manualmente
          </h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const formData = new FormData(form);

              const body: any = {
                date: formData.get("date")
                  ? new Date(
                      String(formData.get("date"))
                    ).toISOString()
                  : null,
                dayOfWeek: formData.get("dayOfWeek") || null,
                currencyPair: formData.get("currencyPair") || null,
                positionType: formData.get("positionType") || null,
                openTime: formData.get("openTime") || null,
                groupType: formData.get("groupType") || null,
                result: formData.get("result") || null,
                amount: formData.get("amount")
                  ? Number(formData.get("amount"))
                  : null,
                riskReward: formData.get("riskReward")
                  ? Number(formData.get("riskReward"))
                  : null,
                notes: formData.get("notes") || null,
              };

              await fetch("/api/trades/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });

              await loadTrades();
              form.reset();
            }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Input
              name="date"
              type="datetime-local"
              className="bg-[#111827] border-neutral-700"
              required
            />
            <Input
              name="dayOfWeek"
              placeholder="Giorno (es. Lunedì)"
              className="bg-[#111827] border-neutral-700"
            />
            <Input
              name="currencyPair"
              placeholder="Valuta (es. EUR/USD)"
              className="bg-[#111827] border-neutral-700"
            />

            <select
              name="positionType"
              className="bg-[#111827] border border-neutral-700 rounded-md px-2 py-2"
            >
              <option value="">Tipo posizione</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
            </select>

            <Input
              name="openTime"
              placeholder="Orario (es. 09:30)"
              className="bg-[#111827] border-neutral-700"
            />

            <select
              name="result"
              className="bg-[#111827] border border-neutral-700 rounded-md px-2 py-2"
            >
              <option value="Presa">Presa</option>
              <option value="Persa">Persa</option>
              <option value="Pareggio">Pareggio</option>
            </select>

            <Input
              name="amount"
              type="number"
              step="0.01"
              placeholder="Importo (€)"
              className="bg-[#111827] border-neutral-700"
              required
            />

            <Input
              name="riskReward"
              type="number"
              step="0.01"
              placeholder="RR (%)"
              className="bg-[#111827] border-neutral-700"
            />

            <select
              name="groupType"
              className="bg-[#111827] border border-neutral-700 rounded-md px-2 py-2"
            >
              <option value="">Gruppo</option>
              <option value="Gruppo Live">Gruppo Live</option>
              <option value="Gruppo Elite Prop">Gruppo Elite Prop</option>
              <option value="Bot">Bot</option>
            </select>

            <Input
              name="notes"
              placeholder="Note"
              className="bg-[#111827] border-neutral-700 md:col-span-3"
            />

            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 md:col-span-3"
            >
              Aggiungi Trade
            </Button>
          </form>
        </div>
      )}

      {/* 🔍 FILTRI (sempre visibili) */}
      <div className="w-full max-w-[1600px] grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Risultato (tutti)</option>
          <option value="Presa">Presa</option>
          <option value="Persa">Persa</option>
          <option value="Pareggio">Pareggio</option>
          <option value="Pari">Pari</option>
          <option value="Break-even">Break-even</option>
        </select>

        <select
          value={filterCurrency}
          onChange={(e) => setFilterCurrency(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Valuta (tutte)</option>
          {Array.from(
            new Set(trades.map((t) => t.currencyPair))
          ).map(
            (c) =>
              c && (
                <option key={c} value={c}>
                  {c}
                </option>
              )
          )}
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

        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="bg-[#1F2937] text-white p-2 rounded-md border border-neutral-700"
        >
          <option value="">Gruppo (tutti)</option>
          {Array.from(
            new Set(trades.map((t) => t.groupType))
          ).map(
            (g) =>
              g && (
                <option key={g} value={g}>
                  {g}
                </option>
              )
          )}
        </select>
      </div>

      {/* TOTALE PNL */}
      <div
        className={`
          mb-6 px-6 py-4 rounded-xl text-2xl font-bold
          ${totalIsWin ? "text-green-400 bg-green-900/30" : ""}
          ${totalIsLoss ? "text-red-400 bg-red-900/30" : ""}
          ${
            !totalIsWin && !totalIsLoss
              ? "text-white bg-neutral-700/40"
              : ""
          }
        `}
      >
        Totale Guadagno/Perdita:{" "}
        {totalIsWin
          ? `+ ${formatEuro(totalPnl)} €`
          : totalIsLoss
          ? `- ${formatEuro(Math.abs(totalPnl))} €`
          : `0,00 €`}
      </div>

      {/* STATISTICHE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-[1600px] mb-8">
        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Trade Totali</p>
          <p className="text-2xl font-bold">{stats.totalTrades}</p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Win Rate</p>
          <p className="text-2xl font-bold">
            {stats.winRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-[#1f2937] p-4 rounded-xl border border-neutral-700">
          <p className="text-neutral-300">Profit Factor</p>
          <p className="text-2xl font-bold">
            {stats.profitFactor.toFixed(2)}
          </p>
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

      {/* TABELLA */}
<div className="w-full max-w-[1600px] mx-auto">
  <div className="max-h-[75vh] overflow-auto rounded-xl shadow-2xl border border-neutral-700 bg-[#faf7f2]">
    <Table className="min-w-[1700px] text-black">
      <TableHeader className="bg-[#e8e2d5] sticky top-0 z-10">
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
          <TableHead className="sticky right-0 bg-[#e8e2d5] z-20 min-w-[170px] text-center">
            Azioni
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {finalTrades.map((t, i) => {
          const displayPnl = computeDisplayPnl(t);
          const isWin = displayPnl > 0;
          const isLoss = displayPnl < 0;

          return (
            <TableRow
              key={t.id}
              className={`${
                i % 2 === 0 ? "bg-[#fffaf0]" : "bg-[#f3ede2]"
              } border-b border-neutral-300 hover:bg-[#e8e0cf] transition`}
            >
              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.tradeNumber}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.date ? new Date(t.date).toLocaleDateString("it-IT") : ""}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.dayOfWeek}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.currencyPair}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.positionType}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.openTime}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.groupType}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.result}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                € {formatEuro(t.amount)}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.riskReward ?? ""}%
              </TableCell>

              <TableCell
                className={`py-1 px-2 text-sm font-bold whitespace-nowrap ${
                  isWin ? "text-green-600" : isLoss ? "text-red-600" : ""
                }`}
              >
                {isWin
                  ? `+ ${formatEuro(displayPnl)} €`
                  : isLoss
                  ? `- ${formatEuro(Math.abs(displayPnl))} €`
                  : "0,00 €"}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                € {formatEuro(t.equity)}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.notes}
              </TableCell>

              <TableCell className="py-1 px-2 text-sm whitespace-nowrap">
                {t.numericResult}
              </TableCell>

              <TableCell className="sticky right-0 bg-[#faf7f2] z-10 min-w-[170px] px-2 py-1 whitespace-nowrap">
                <div className="flex gap-2 justify-center">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1"
                    onClick={() => {
                      setEditingTrade(t);
                      setShowEditModal(true);
                    }}
                  >
                    Modifica
                  </Button>

                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1"
                    onClick={() => deleteTrade(t.id)}
                  >
                    Elimina
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </div>

  {/* DIALOG IMPORT */}
  <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
    <DialogContent className="bg-[#111827] text-white border border-neutral-700 max-w-lg">
      <DialogHeader>
        <DialogTitle>Confermi l'importazione?</DialogTitle>
      </DialogHeader>

      <p className="text-neutral-300 mt-3 text-sm">
        Verranno inviati all'import <b>{csvCount}</b> record dal CSV.
      </p>

      {importing && (
        <div className="w-full h-3 bg-neutral-700 rounded mt-4 overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
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

  {/* DIALOG DONE */}
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

  {/* DIALOG EDIT */}
  <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
    <DialogContent className="bg-[#111827] text-white border border-neutral-700 max-w-lg">
      <DialogHeader>
        <DialogTitle>Modifica Trade</DialogTitle>
      </DialogHeader>

      {editingTrade && (
        <form onSubmit={saveEditedTrade} className="grid grid-cols-2 gap-4 mt-4">
          <Input
            name="date"
            type="datetime-local"
            defaultValue={
              editingTrade.date
                ? new Date(editingTrade.date).toISOString().slice(0, 16)
                : ""
            }
            className="bg-[#020617] border-neutral-700 col-span-2"
          />

          <Input name="dayOfWeek" defaultValue={editingTrade.dayOfWeek ?? ""} className="bg-[#020617] border-neutral-700" />
          <Input name="currencyPair" defaultValue={editingTrade.currencyPair ?? ""} className="bg-[#020617] border-neutral-700" />
          <Input name="positionType" defaultValue={editingTrade.positionType ?? ""} className="bg-[#020617] border-neutral-700" />
          <Input name="openTime" defaultValue={editingTrade.openTime ?? ""} className="bg-[#020617] border-neutral-700" />
          <Input name="groupType" defaultValue={editingTrade.groupType ?? ""} className="bg-[#020617] border-neutral-700" />

          <select
            name="result"
            defaultValue={editingTrade.result ?? ""}
            className="bg-[#020617] border border-neutral-700 rounded-md px-2 py-2 col-span-2"
          >
            <option value="">Risultato</option>
            <option value="Presa">Presa</option>
            <option value="Persa">Persa</option>
            <option value="Pareggio">Pareggio</option>
            <option value="Pari">Pari</option>
            <option value="Break-even">Break-even</option>
          </select>

          <Input name="amount" type="number" step="0.01" defaultValue={editingTrade.amount ?? 0} className="bg-[#020617] border-neutral-700" />
          <Input name="riskReward" type="number" step="0.01" defaultValue={editingTrade.riskReward ?? 0} className="bg-[#020617] border-neutral-700" />

          <Input name="notes" defaultValue={editingTrade.notes ?? ""} className="bg-[#020617] border-neutral-700 col-span-2" />

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 col-span-2 mt-2">
            Salva modifiche
          </Button>
        </form>
      )}
    </DialogContent>
  </Dialog>
</div>
</div>
  );
}