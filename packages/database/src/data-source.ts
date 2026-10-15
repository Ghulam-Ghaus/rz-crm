import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  SchemaMetadataEntity,
  StoreEntity,
  InstallationEntity,
  RegisterEntity,
  SettingEntity,
  UnitEntity,
  UnitConversionEntity,
  CategoryEntity,
  TaxClassEntity,
  ItemEntity,
  ProductEntity,
  ProductVariantEntity,
  BarcodeEntity,
  StockLocationEntity,
  StockMovementEntity,
  OpeningStockSessionEntity,
  ShiftEntity,
  CashTransactionEntity,
  SaleEntity,
  SaleItemEntity,
  SalePaymentEntity,
  SupplierEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  InventoryLotEntity,
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  RecipeEntity,
  RecipeVersionEntity,
  RecipeItemEntity,
  ProductionRunEntity,
  ProductionRunItemEntity,
  CustomerEntity,
  CustomOrderEntity,
  CustomOrderLineEntity,
  CustomOrderPaymentEntity,
  HeldCartEntity,
  UserEntity,
  AuditLogEntity,
  SupplierPaymentEntity,
  RoleEntity,
  ExpenseCategoryEntity,
  ExpenseEntity,
  StaffPayrollProfileEntity,
  SalaryAdvanceEntity,
  SalaryPaymentEntity,
} from './entities/index.js';
import { MIGRATIONS } from './migrations/index.js';

export interface DatabaseConnectionOptions {
  filePath: string;
  busyTimeoutMs?: number;
  logging?: boolean;
}

export function createDataSourceOptions(options: DatabaseConnectionOptions): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: options.filePath,
    entities: [
      SchemaMetadataEntity,
      StoreEntity,
      InstallationEntity,
      RegisterEntity,
      SettingEntity,
      UnitEntity,
      UnitConversionEntity,
      CategoryEntity,
      TaxClassEntity,
      ItemEntity,
      ProductEntity,
      ProductVariantEntity,
      BarcodeEntity,
      StockLocationEntity,
      StockMovementEntity,
      OpeningStockSessionEntity,
      ShiftEntity,
      CashTransactionEntity,
      SaleEntity,
      SaleItemEntity,
      SalePaymentEntity,
      SupplierEntity,
      PurchaseOrderEntity,
      PurchaseOrderLineEntity,
      InventoryLotEntity,
      GoodsReceiptEntity,
      GoodsReceiptLineEntity,
      RecipeEntity,
      RecipeVersionEntity,
      RecipeItemEntity,
      ProductionRunEntity,
      ProductionRunItemEntity,
      CustomerEntity,
      CustomOrderEntity,
      CustomOrderLineEntity,
      CustomOrderPaymentEntity,
      HeldCartEntity,
      UserEntity,
      AuditLogEntity,
      SupplierPaymentEntity,
      RoleEntity,
      ExpenseCategoryEntity,
      ExpenseEntity,
      StaffPayrollProfileEntity,
      SalaryAdvanceEntity,
      SalaryPaymentEntity,
    ],

    migrations: MIGRATIONS,
    synchronize: false,
    migrationsRun: false,
    logging: options.logging ?? false,
  };
}

export function createDataSource(options: DatabaseConnectionOptions): DataSource {
  const dsOptions = createDataSourceOptions(options);
  const dataSource = new DataSource(dsOptions);

  return dataSource;
}
