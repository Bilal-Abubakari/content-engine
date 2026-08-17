import { Module } from '@nestjs/common';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from '../repurpose/providers/llm-provider';
import { createLlmProvider } from '../repurpose/providers/llm-provider.factory';
import { TokenCryptoService } from '../social/token-crypto.service';
import { InboxController } from './inbox.controller';
import { InboxEventsService } from './inbox-events.service';
import { InboxSyncService } from './inbox-sync.service';
import { InboxService } from './inbox.service';
import { InboxProviderRegistry } from './providers/inbox-provider.registry';

/**
 * The unified social inbox. Consolidates messages, comments, mentions and
 * reviews from every connected platform into one normalized, real-time stream
 * with a shared team workflow and AI-drafted replies. Providers are resolved via
 * {@link InboxProviderRegistry} (mock today, real platforms later), tokens are
 * decrypted with its own {@link TokenCryptoService}, and reply drafting reuses
 * the same {@link LlmProvider} seam as content repurposing.
 */
@Module({
  controllers: [InboxController],
  providers: [
    InboxService,
    InboxProviderRegistry,
    InboxEventsService,
    InboxSyncService,
    TokenCryptoService,
    { provide: LLM_PROVIDER, useFactory: (): LlmProvider => createLlmProvider() },
  ],
  exports: [InboxService],
})
export class InboxModule {}
