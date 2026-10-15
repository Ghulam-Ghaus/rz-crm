import { Module } from '@nestjs/common';
import { StoreSettingsService } from './store-settings.service.js';

@Module({
  providers: [StoreSettingsService],
  exports: [StoreSettingsService],
})
export class StoreSettingsModule {}
