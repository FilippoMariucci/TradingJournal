/*
  Warnings:

  - You are about to drop the column `fees` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `strategy` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Trade` table. All the data in the column will be lost.
  - You are about to alter the column `quantity` on the `Trade` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "fees",
DROP COLUMN "group",
DROP COLUMN "notes",
DROP COLUMN "strategy",
DROP COLUMN "updatedAt",
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;
