import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const hashed = await hash(data.password, 10);

    await prisma.user.create({
      data: {
        email: data.email,
        password: hashed,
        name: data.name ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);
    return NextResponse.json({ error: "Errore nella registrazione" }, { status: 500 });
  }
}
