import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Normalizza stringhe rimuovendo caratteri strani
function normalize(str: string) {
  return str
    .replace(/�/g, "") // simboli rotti
    .replace(/\u00A0/g, " ") // NBSP
    .trim();
}

// Funzione per accedere in sicurezza a r[col]
function safe(r: any, colIndex: string | undefined) {
  return colIndex !== undefined && r[colIndex] !== undefined ? r[colIndex] : null;
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
    numericResult: header.find((h) => normalize(h).includes("Esito Numerico")),
  };
}

function parseEuroNumber(v: any) {
  if (!v || typeof v !== "string") return null;
  const cleaned = v
    .replace(/€/g, "")
    .replace(/�/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parsePercent(v: any) {
  if (!v || typeof v !== "string") return null;

  const cleaned = v.replace("%", "").replace(",", ".").trim();
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function parseDateAndTime(dateStr: any, timeStr: any) {
  if (!dateStr || typeof dateStr !== "string") return null;

  const [day, month, year] = dateStr.split("/");
  if (!day || !month || !year) return null;

  const time = typeof timeStr === "string" && timeStr.includes(":") ? timeStr : "00:00";

  const full = `${year}-${month}-${day}T${time}:00`;

  const d = new Date(full);
  return isNaN(d.getTime()) ? null : d;
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

  return required.every((key) => safe(r, key));
}

export async function POST(req: Request) {
  try {
    const rows = await req.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "CSV vuoto o invalido" },
        { status: 400 }
      );
    }

    const header = Object.keys(rows[0]);
    const col = detectColumns(header);

    let importOrder = 1;

    for (const r of rows) {
      if (!isRowComplete(r, col)) {
        console.log("SKIPPED ROW (incomplete):", r);
        continue;
      }

      const rawEquity = safe(r, col.equity);
      const equity =
        rawEquity && !String(rawEquity).includes("#VAL")
          ? parseEuroNumber(rawEquity)
          : null;

      await prisma.trade.create({
        data: {
          importOrder: importOrder++,
          tradeNumber: Number(safe(r, col.trade)) || importOrder,

          date: parseDateAndTime(safe(r, col.date), safe(r, col.openTime)),
          dayOfWeek: safe(r, col.day),
          currencyPair: safe(r, col.currency),
          positionType: safe(r, col.position),
          openTime: safe(r, col.openTime),
          groupType: safe(r, col.group),
          result: safe(r, col.result),

          amount: parseEuroNumber(safe(r, col.amount)),
          riskReward: parsePercent(safe(r, col.rr)),
          pnl: parseEuroNumber(safe(r, col.pnl)),
          equity,

          notes: safe(r, col.notes) || "",
          numericResult: safe(r, col.numericResult)
            ? Number(safe(r, col.numericResult))
            : null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("IMPORT ERROR", e);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
