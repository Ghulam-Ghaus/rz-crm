import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service.js';
import { CustomOrdersService } from './custom-orders.service.js';

@Module({
  providers: [CustomersService, CustomOrdersService],
  exports: [CustomersService, CustomOrdersService],
})
export class CustomOrdersModule {}
