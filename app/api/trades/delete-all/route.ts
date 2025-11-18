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
