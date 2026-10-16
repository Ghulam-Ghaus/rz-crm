import { Module } from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service.js';

@Module({
  providers: [FinancialReportsService],
  exports: [FinancialReportsService],
})
export class FinancialReportsModule {}
