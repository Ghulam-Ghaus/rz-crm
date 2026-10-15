import { Module } from '@nestjs/common';
import { DatabaseModule } from './modules/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module.js';
import { UnitsModule } from './modules/units/units.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { BarcodeModule } from './modules/barcode/barcode.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PosModule } from './modules/pos/pos.module.js';
import { PurchasingModule } from './modules/purchasing/purchasing.module.js';
import { ProductionModule } from './modules/production/production.module.js';
import { CustomOrdersModule } from './modules/custom-orders/custom-orders.module.js';
import { BackupModule } from './modules/backup/backup.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    StoreSettingsModule,
    UnitsModule,
    CatalogModule,
    BarcodeModule,
    InventoryModule,
    PosModule,
    PurchasingModule,
    ProductionModule,
    CustomOrdersModule,
    BackupModule,
    UsersModule,
    ExpensesModule,
  ],
})

export class AppModule {}
