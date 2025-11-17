import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  const data = await req.json();

  const hashed = await hash(data.password, 10);

  await prisma.user.create({
    data: {
      email: data.email,
      password: hashed,
      name: data.name ?? "",
    },
  });

  return NextResponse.json({ success: true });
}

fetch("/api/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@example.com",
    password: "123456",
    name: "Admin",
  }),
});
