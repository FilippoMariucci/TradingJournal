import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ------------------------------------
// GET — Ottieni un singolo trade
// ------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const trade = await prisma.trade.findUnique({
    where: { id: Number(id) },
  });

  return NextResponse.json(trade);
}

// ------------------------------------
// PATCH — Modifica un trade
// ------------------------------------
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();

  try {
    const updated = await prisma.trade.update({
      where: { id: Number(id) },
      data: body,
    });

    return NextResponse.json({ success: true, trade: updated });
  } catch (error) {
    console.error("UPDATE ERROR", error);
    return NextResponse.json(
      { error: "Errore nella modifica" },
      { status: 500 }
    );
  }
}

// ------------------------------------
// DELETE — Cancella un trade
// ------------------------------------
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    await prisma.trade.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE ERROR", error);
    return NextResponse.json(
      { error: "Errore nella cancellazione" },
      { status: 500 }
    );
  }
}
