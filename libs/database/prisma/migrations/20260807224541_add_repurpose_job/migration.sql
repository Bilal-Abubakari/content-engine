-- CreateTable
CREATE TABLE "RepurposeJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepurposeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepurposeJob_userId_createdAt_idx" ON "RepurposeJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "RepurposeJob" ADD CONSTRAINT "RepurposeJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
