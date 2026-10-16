import { Module } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service.js';

@Module({
  providers: [StakeholdersService],
  exports: [StakeholdersService],
})
export class StakeholdersModule {}
