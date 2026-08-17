import { PrismaModule } from '@org/database';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { InboxModule } from './inbox/inbox.module';
import { MediaModule } from './media/media.module';
import { RepurposeModule } from './repurpose/repurpose.module';
import { SettingsModule } from './settings/settings.module';
import { SocialModule } from './social/social.module';

@Module({
  imports: [
    // Global IP rate limit: 60 requests per minute. Guards against abuse and
    // brute force on top of the per-plan quota enforced in UsageService.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    HealthModule,
    RepurposeModule,
    BillingModule,
    SocialModule,
    SettingsModule,
    MediaModule,
    InboxModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
