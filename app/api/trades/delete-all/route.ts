import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE() {
  try {
    await prisma.trade.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE ALL ERROR", err);
    return NextResponse.json(
      { error: "Errore durante la cancellazione" },
      { status: 500 }
    );
  }
}
