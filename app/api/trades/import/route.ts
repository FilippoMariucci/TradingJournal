import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth"; // ✅ NUOVO SISTEMA


function normalize(str: string) {
  return str.replace(/�/g, "").replace(/\u00A0/g, " ").trim();
}

function detectColumns(header: string[]) {
  const n = header.map((h) => normalize(h));

  return {
    trade: header[n.indexOf("Trade")],
    date: header[n.indexOf("Data")],
    day: header[n.indexOf("Apertura Giorno")],
    currency: header[n.indexOf("Valuta")],
    position: header[n.indexOf("Posizione")],
    openTime: header[n.indexOf("Orario Apertura")],
    group: header[n.indexOf("Tipo Gruppo")],
    result: header[n.indexOf("Risultato")],
    amount: header.find((h) => h.includes("Importo")),

    rr: header.find((h) => h.includes("Risk Reward")),
    pnl: header.find((h) => h.includes("Guadagno/Perdita")),

    equity: header.find(
      (h) => (h.includes("€") || h.includes("�")) && h.includes(",")
    ),

    notes: header[n.indexOf("Note")],
    numericResult: header.find((h) =>
      normalize(h).includes("Esito Numerico")
    ),
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

function parsePercent(p: string | null) {
  if (!p) return null;
  return Number(p.replace("%", "").replace(",", ".").trim());
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
    col.pnl,
    col.numericResult,
  ];

  return required.every((key) => {
    const v = r[key];
    return v && v.toString().trim() !== "";
  });
}


export async function POST(req: Request) {
  // 🔥 FIX — SISTEMA NUOVO DI NEXTAUTH
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const rows = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "CSV vuoto o invalido" },
        { status: 400 }
      );
    }

    const lastTrade = await prisma.trade.findFirst({
      orderBy: { importOrder: "desc" },
    });

    let importOrder = lastTrade ? lastTrade.importOrder + 1 : 1;

    const header = Object.keys(rows[0]);
    const col = detectColumns(header);

    for (const r of rows) {
      if (!isRowComplete(r, col)) continue;

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
          result: r[col.result],

          amount: parseEuroNumber(r[col.amount]),
          riskReward: parsePercent(r[col.rr]),
          pnl: parseEuroNumber(r[col.pnl]),

          equity:
            r[col.equity] && !String(r[col.equity]).includes("#VALORE")
              ? parseEuroNumber(r[col.equity])
              : null,

          notes: r[col.notes] || "",
          numericResult: Number(r[col.numericResult]),
        },
      });

      importOrder++;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IMPORT ERROR", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
