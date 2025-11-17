import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/trades/:id
export async function GET(req: Request, context: any) {
  const { id } = await context.params;        // <-- QUI LA DIFFERENZA IMPORTANTE
  const tradeId = Number(id);

  console.log("GET ID:", tradeId);

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
  });

  return NextResponse.json(trade);
}

// PUT /api/trades/:id
export async function PUT(req: Request, context: any) {
  const { id } = await context.params; 
  const tradeId = Number(id);
  const data = await req.json();

  console.log("UPDATE ID:", tradeId);

  const updated = await prisma.trade.update({
    where: { id: tradeId },
    data: {
      ticker: data.ticker,
      type: data.type,
      entryDate: new Date(data.entryDate),
      entryPrice: Number(data.entryPrice),
      quantity: Number(data.quantity),
      exitDate: data.exitDate ? new Date(data.exitDate) : null,
      exitPrice: data.exitPrice ? Number(data.exitPrice) : null,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/trades/:id
export async function DELETE(req: Request, context: any) {
  const { id } = await context.params;
  const tradeId = Number(id);

  console.log("DELETE ID:", tradeId);

  await prisma.trade.delete({
    where: { id: tradeId },
  });

  return NextResponse.json({ success: true });
}
