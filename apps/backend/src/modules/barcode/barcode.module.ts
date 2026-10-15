import { Module } from '@nestjs/common';
import { BarcodeService } from './barcode.service.js';

@Module({
  providers: [BarcodeService],
  exports: [BarcodeService],
})
export class BarcodeModule {}
