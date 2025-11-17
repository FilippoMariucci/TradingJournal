import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const trades = await prisma.trade.findMany({
      orderBy: { importOrder: "asc" },
    });

    let counter = 1;

    for (const t of trades) {
      await prisma.trade.update({
        where: { id: t.id },
        data: {
          tradeNumber: counter,
          importOrder: counter,
        },
      });

      counter++;
    }

    return NextResponse.json({
      success: true,
      message: "Rinumerazione completata",
    });
  } catch (err) {
    console.error("RENUMBER ERROR", err);
    return NextResponse.json(
      { error: "Errore durante la rinumerazione" },
      { status: 500 }
    );
  }
}
