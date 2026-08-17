-- CreateEnum
CREATE TYPE "InboxChannel" AS ENUM ('message', 'comment', 'mention', 'review');

-- CreateEnum
CREATE TYPE "InboxItemStatus" AS ENUM ('unread', 'read', 'replied', 'snoozed', 'archived');

-- CreateEnum
CREATE TYPE "InboxItemDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "channel" "InboxChannel" NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountName" TEXT,
    "participantExternalId" TEXT,
    "participantName" TEXT NOT NULL,
    "participantAvatarUrl" TEXT,
    "snippet" TEXT NOT NULL,
    "status" "InboxItemStatus" NOT NULL DEFAULT 'unread',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snoozedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "channel" "InboxChannel" NOT NULL,
    "direction" "InboxItemDirection" NOT NULL,
    "text" TEXT NOT NULL,
    "authorExternalId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "permalink" TEXT,
    "externalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "channel" "InboxChannel" NOT NULL,
    "cursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_connectionId_externalId_key" ON "Conversation"("connectionId", "externalId");

-- CreateIndex
CREATE INDEX "Conversation_userId_status_lastActivityAt_idx" ON "Conversation"("userId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Conversation_userId_platform_idx" ON "Conversation"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_conversationId_externalId_key" ON "InboxItem"("conversationId", "externalId");

-- CreateIndex
CREATE INDEX "InboxItem_conversationId_createdAt_idx" ON "InboxItem"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_connectionId_channel_key" ON "SyncCursor"("connectionId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_platform_externalId_key" ON "WebhookEvent"("platform", "externalId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "SocialConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
