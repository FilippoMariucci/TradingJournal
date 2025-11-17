import { PrismaClient } from "@prisma/client";

<<<<<<< HEAD
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"], // o "query" se preferisci
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
=======
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
>>>>>>> 9a907855d172c733c89957fb25b7e0babcbc0ab0

export default prisma;
