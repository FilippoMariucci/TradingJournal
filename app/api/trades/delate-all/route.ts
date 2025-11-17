import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE() {
  await prisma.trade.deleteMany({});
  return NextResponse.json({ success: true });
}
