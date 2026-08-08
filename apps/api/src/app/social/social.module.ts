import { Module } from '@nestjs/common';
import { SocialProviderRegistry } from './providers/provider.registry';
import { SocialController } from './social.controller';
import { SocialScheduler } from './social.scheduler';
import { SocialService } from './social.service';
import { TokenCryptoService } from './token-crypto.service';

/**
 * Social publishing feature module: connect accounts via OAuth, publish or
 * schedule posts, and drain the schedule with an in-process poller. Relies on
 * the global PrismaModule for database access.
 */
@Module({
  controllers: [SocialController],
  providers: [
    SocialService,
    SocialProviderRegistry,
    TokenCryptoService,
    SocialScheduler,
  ],
  exports: [SocialService],
})
export class SocialModule {}
