import { Module } from '@nestjs/common';
import { BackupService } from './backup.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
