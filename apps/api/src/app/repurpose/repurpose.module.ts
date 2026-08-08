import { Module } from '@nestjs/common';
import { UsageModule } from '../usage/usage.module';
import { RepurposeHistoryService } from './repurpose-history.service';
import { RepurposeController } from './repurpose.controller';
import { RepurposeService } from './repurpose.service';

@Module({
  imports: [UsageModule],
  controllers: [RepurposeController],
  providers: [RepurposeService, RepurposeHistoryService],
})
export class RepurposeModule {}
