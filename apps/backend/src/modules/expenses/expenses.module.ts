import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ExpensesService } from './expenses.service.js';
import { PayrollService } from './payroll.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [ExpensesService, PayrollService],
  exports: [ExpensesService, PayrollService],
})
export class ExpensesModule {}
