import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // ✅
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";


export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 401 }
    );
  }


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
