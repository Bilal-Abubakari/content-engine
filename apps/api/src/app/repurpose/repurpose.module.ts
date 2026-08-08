import { Module } from '@nestjs/common';
import { UsageModule } from '../usage/usage.module';
import { LLM_PROVIDER, type LlmProvider } from './providers/llm-provider';
import { createLlmProvider } from './providers/llm-provider.factory';
import { RepurposeHistoryService } from './repurpose-history.service';
import { RepurposeController } from './repurpose.controller';
import { RepurposeService } from './repurpose.service';
import { SourceResolverService } from './source-resolver.service';

@Module({
  imports: [UsageModule],
  controllers: [RepurposeController],
  providers: [
    RepurposeService,
    RepurposeHistoryService,
    SourceResolverService,
    {
      provide: LLM_PROVIDER,
      useFactory: (): LlmProvider => createLlmProvider(),
    },
  ],
})
export class RepurposeModule {}
