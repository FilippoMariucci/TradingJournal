import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// -------------------------------
// FUNZIONI UTILI
// -------------------------------
function normalize(str: string) {
  return str.replace(/�/g, "").replace(/\u00A0/g, " ").trim();
}

function detectColumns(header: string[]) {
  const n = header.map((h) => normalize(h));

  return {
    date: header[n.indexOf("Data")],
    day: header[n.indexOf("Apertura Giorno")],
    currency: header[n.indexOf("Valuta")],
    position: header[n.indexOf("Posizione")],
    openTime: header[n.indexOf("Orario Apertura")],
    group: header[n.indexOf("Tipo Gruppo")],
    result: header[n.indexOf("Risultato")],
    amount: header.find((h) => h.includes("Importo")),
    rr: header.find((h) => h.includes("Risk Reward")),
    notes: header[n.indexOf("Note")],
    numericResult: header.find((h) => normalize(h).includes("Esito Numerico")),
  };
}

function parseEuroNumber(v: string | null) {
  if (!v) return null;
  return Number(
    v
      .replace(/€/g, "")
      .replace(/�/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  );
}

function parsePercent(v: string | null) {
  if (!v) return null;
  return Number(v.replace("%", "").replace(",", ".").trim());
}

function parseDateAndTime(data: string, time: string) {
  if (!data) return null;

  const [d, m, y] = data.split("/");
  if (!d || !m || !y) return null;

  if (time && time.includes(":")) {
    return new Date(`${y}-${m}-${d}T${time}:00`);
  }

  return new Date(`${y}-${m}-${d}T00:00:00`);
}

function computePnl(result: string | null, amount: number | null, rr: number | null) {
  if (!result || !amount) return 0;

  const r = result.toLowerCase().trim();

  if (r.includes("presa") || r.includes("vinta")) {
    return rr && rr > 0 ? (amount * rr) / 100 : amount;
  }

  if (r.includes("persa")) return -Math.abs(amount);

  return 0; // pareggio
}

function isRowComplete(r: any, col: any) {
  const required = [
    col.date,
    col.day,
    col.currency,
    col.position,
    col.openTime,
    col.group,
    col.result,
    col.amount,
    col.rr,
  ];

  return required.every((key) => {
    const v = r[key];
    return v && v.toString().trim() !== "";
  });
}

// -------------------------------
// POST — IMPORTAZIONE CSV
// -------------------------------
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // ❌ Non loggato → non può importare
  if (!session) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 401 }
    );
  }

  try {
    const rows = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "CSV vuoto o invalido" },
        { status: 400 }
      );
    }

    const last = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    let importOrder = last ? last.importOrder + 1 : 1;
    let previousEquity = last?.equity ?? 700;

    const header = Object.keys(rows[0]);
    const col = detectColumns(header);

    for (const r of rows) {
      if (!isRowComplete(r, col)) continue;

      const amount = parseEuroNumber(r[col.amount]);
      const rr = parsePercent(r[col.rr]);
      const result = r[col.result];

      // 🔥 CALCOLA PNL IN BACKEND
      const pnl = computePnl(result, amount, rr);

      // 🔥 CALCOLA NUOVA EQUITY
      const equity = previousEquity + pnl;
      previousEquity = equity;

      await prisma.trade.create({
        data: {
          importOrder,
          tradeNumber: importOrder,

          date: parseDateAndTime(r[col.date], r[col.openTime]),
          dayOfWeek: r[col.day],
          currencyPair: r[col.currency],
          positionType: r[col.position],
          openTime: r[col.openTime],
          groupType: r[col.group],
          result,

          amount,
          riskReward: rr,
          pnl,       // 🔥 NON DAL CSV, DAL BACKEND
          equity,    // 🔥 NON DAL CSV, DAL BACKEND

          notes: r[col.notes] || "",
          numericResult: r[col.numericResult]
            ? Number(r[col.numericResult])
            : null,
        },
      });

      importOrder++;
    }

    return NextResponse.json({
      success: true,
      message: "Importazione completata",
    });

  } catch (error) {
    console.error("IMPORT ERROR", error);
    return NextResponse.json(
      { error: "Errore durante l'importazione" },
      { status: 500 }
    );
  }
}
