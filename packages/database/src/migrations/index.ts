import { AppIdentity1699999999000 } from './1699999999000-AppIdentity.js';
import { InitialSystemStoreSettings1700000000000 } from './1700000000000-InitialSystemStoreSettings.js';
import { CatalogUnitsInventoryLedger1700000001000 } from './1700000001000-CatalogUnitsInventoryLedger.js';
import { ShiftsSalesCashDrawer1700000002000 } from './1700000002000-ShiftsSalesCashDrawer.js';
import { PurchasingAndGoodsReceiving1700000003000 } from './1700000003000-PurchasingAndGoodsReceiving.js';
import { ProductionAndRecipes1700000004000 } from './1700000004000-ProductionAndRecipes.js';
import { CustomOrdersAndHeldCarts1700000005000 } from './1700000005000-CustomOrdersAndHeldCarts.js';
import { UsersAndRbac1700000006000 } from './1700000006000-UsersAndRbac.js';
import { SupplierPaymentsAndLedger1700000007000 } from './1700000007000-SupplierPaymentsAndLedger.js';
import { RolesAndFormPermissions1700000008000 } from './1700000008000-RolesAndFormPermissions.js';
import { ExpensesAndStaffPayroll1700000009000 } from './1700000009000-ExpensesAndStaffPayroll.js';

export const MIGRATIONS = [
  AppIdentity1699999999000,
  InitialSystemStoreSettings1700000000000,
  CatalogUnitsInventoryLedger1700000001000,
  ShiftsSalesCashDrawer1700000002000,
  PurchasingAndGoodsReceiving1700000003000,
  ProductionAndRecipes1700000004000,
  CustomOrdersAndHeldCarts1700000005000,
  UsersAndRbac1700000006000,
  SupplierPaymentsAndLedger1700000007000,
  RolesAndFormPermissions1700000008000,
  ExpensesAndStaffPayroll1700000009000,
];

export * from './1699999999000-AppIdentity.js';
export * from './1700000000000-InitialSystemStoreSettings.js';
export * from './1700000001000-CatalogUnitsInventoryLedger.js';
export * from './1700000002000-ShiftsSalesCashDrawer.js';
export * from './1700000003000-PurchasingAndGoodsReceiving.js';
export * from './1700000004000-ProductionAndRecipes.js';
export * from './1700000005000-CustomOrdersAndHeldCarts.js';
export * from './1700000006000-UsersAndRbac.js';
export * from './1700000007000-SupplierPaymentsAndLedger.js';
export * from './1700000008000-RolesAndFormPermissions.js';
export * from './1700000009000-ExpensesAndStaffPayroll.js';

