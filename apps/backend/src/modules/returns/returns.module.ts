import { Module } from '@nestjs/common';
import { SalesReturnsService } from './sales-returns.service.js';
import { PurchaseReturnsService } from './purchase-returns.service.js';

@Module({
  providers: [SalesReturnsService, PurchaseReturnsService],
  exports: [SalesReturnsService, PurchaseReturnsService],
})
export class ReturnsModule {}
