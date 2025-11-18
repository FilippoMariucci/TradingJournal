import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const trade = await prisma.trade.findUnique({
    where: { id: Number(params.id) },
  });
  return NextResponse.json(trade);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  try {
    const updated = await prisma.trade.update({
      where: { id: Number(params.id) },
      data: body,
    });
    return NextResponse.json({ success: true, trade: updated });
  } catch (error) {
    return NextResponse.json({ error: "Errore nella modifica" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.trade.delete({
      where: { id: Number(params.id) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Errore nella cancellazione" }, { status: 500 });
  }
}
