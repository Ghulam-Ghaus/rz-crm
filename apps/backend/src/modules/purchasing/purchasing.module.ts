import { Module } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { GoodsReceivingService } from './goods-receiving.service.js';

@Module({
  providers: [SuppliersService, PurchaseOrdersService, GoodsReceivingService],
  exports: [SuppliersService, PurchaseOrdersService, GoodsReceivingService],
})
export class PurchasingModule {}
