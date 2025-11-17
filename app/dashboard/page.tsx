"use client";



import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakeven: 0,
    winRate: 0,
  });

  useEffect(() => {
    async function loadTrades() {
      const res = await fetch("/api/trades");
      const data = await res.json();

      setTrades(data);

      let wins = 0;
      let losses = 0;
      let breakeven = 0;

      data.forEach((t: any) => {
        const result = t.result?.toLowerCase() ?? "";

        if (result === "presa") wins++;
        else if (result === "persa") losses++;
        else if (
          result === "pari" ||
          result === "pareggio" ||
          result === "break-even"
        )
          breakeven++;
      });

      const total = data.length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      setStats({
        totalTrades: total,
        wins,
        losses,
        breakeven,
        winRate,
      });
    }

    loadTrades();
  }, []);

  function formatDate(dateString: string) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // 👉 Calcolo PNL con la stessa logica del Journal
  function computeDisplayPnl(t: any) {
    const pnl = Number(t.pnl ?? 0);
    const amount = Number(t.amount ?? 0);
    const result = t.result?.toLowerCase() ?? "";

    if (result === "persa") {
      return -Math.abs(amount);
    }
    if (result === "presa") {
      return pnl;
    }
    return 0; // pareggio
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* Pulsante Journal */}
      <div className="col-span-full">
        <Link href="/journal">
          <Button className="bg-blue-600 text-white">
            Vai al Journal
          </Button>
        </Link>
      </div>

      {/* Statistiche */}
      <div className="col-span-full grid grid-cols-1 md:grid-cols-5 gap-4">

        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Trade Totali</h2>
            <p className="text-3xl">{stats.totalTrades}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Win</h2>
            <p className="text-3xl text-green-600">{stats.wins}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Loss</h2>
            <p className="text-3xl text-red-600">{stats.losses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Pareggi</h2>
            <p className="text-3xl">{stats.breakeven}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Win Rate</h2>
            <p className="text-3xl text-blue-600">
              {stats.winRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Budget attuale */}
        <Card className="col-span-full">
          <CardContent className="p-4 text-center">
            <h2 className="text-xl font-bold">Budget Attuale</h2>

            <p className="text-4xl font-bold text-blue-600">
              € {trades.length > 0
                ? Number(trades[trades.length - 1].equity ?? 0).toFixed(2)
                : "0.00"}
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Tabella Trade */}
      <div className="col-span-full">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-xl font-bold mb-4">Ultimi 20 Trade</h2>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Strumento</TableHead>
                    <TableHead>Direzione</TableHead>
                    <TableHead>Risultato</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {trades.slice(0, 20).map((t: any) => {
                    const dpnl = computeDisplayPnl(t);

                    return (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.date)}</TableCell>

                        <TableCell>{t.currencyPair ?? "-"}</TableCell>

                        <TableCell>{t.positionType ?? "-"}</TableCell>

                        <TableCell
                          className={
                            dpnl > 0
                              ? "text-green-600"
                              : dpnl < 0
                              ? "text-red-600"
                              : ""
                          }
                        >
                          € {dpnl.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>

    </div>
  );
}
