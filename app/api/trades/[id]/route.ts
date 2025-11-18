import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";

// ----------------------------------------
// GET → visibile a tutti
// ----------------------------------------
export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { id } = context.params;

  const trade = await prisma.trade.findUnique({
    where: { id: Number(id) },
  });

  return NextResponse.json(trade);
}

// ----------------------------------------
// PATCH → SOLO se loggato
// ----------------------------------------
export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 401 }
    );
  }

  const { id } = context.params;
  const body = await req.json();

  try {
    const allowedFields = {
      date: body.date ? new Date(body.date) : null,
      dayOfWeek: body.dayOfWeek ?? null,
      currencyPair: body.currencyPair ?? null,
      positionType: body.positionType ?? null,
      openTime: body.openTime ?? null,
      groupType: body.groupType ?? null,
      result: body.result ?? null,
      amount: body.amount ? Number(body.amount) : null,
      riskReward: body.riskReward ? Number(body.riskReward) : null,
      notes: body.notes ?? null,
    };

    const updated = await prisma.trade.update({
      where: { id: Number(id) },
      data: allowedFields,
    });

    return NextResponse.json({ success: true, trade: updated });

  } catch (error) {
    console.error("PATCH ERROR", error);
    return NextResponse.json(
      { error: "Errore nella modifica" },
      { status: 500 }
    );
  }
}

// ----------------------------------------
// DELETE → SOLO se loggato
// ----------------------------------------
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { error: "Non autorizzato" },
      { status: 401 }
    );
  }

  const { id } = context.params;

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
