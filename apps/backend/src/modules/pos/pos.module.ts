import { Module } from '@nestjs/common';
import { ShiftsService } from './shifts.service.js';
import { PosSaleService } from './sales.service.js';
import { HeldCartsService } from './held-carts.service.js';
import { ProfitLossService } from './profit-loss.service.js';

@Module({
  providers: [ShiftsService, PosSaleService, HeldCartsService, ProfitLossService],
  exports: [ShiftsService, PosSaleService, HeldCartsService, ProfitLossService],
})
export class PosModule {}
