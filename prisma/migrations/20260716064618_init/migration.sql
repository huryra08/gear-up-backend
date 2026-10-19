/*
  Warnings:

  - A unique constraint covering the columns `[sslValId]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "sslSessionKey" TEXT,
ADD COLUMN     "sslValId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_sslValId_key" ON "payments"("sslValId");
