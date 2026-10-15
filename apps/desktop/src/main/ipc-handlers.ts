import { ipcMain, app, BrowserWindow, dialog, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ErrorCode,
  HealthCheckInputSchema,
  HealthCheckResponseSchema,
  IPC_CHANNELS,
  Result,
  StoreSchema,
  SystemInfoResponseSchema,
  CreateCategoryInputSchema,
  CreateUnitInputSchema,
  CreateProductInputSchema,
  UpdateProductInputSchema,
  BarcodeLookupInputSchema,
  ConfirmOpeningStockInputSchema,
  OpenShiftInputSchema,
  CloseShiftInputSchema,
  CheckoutSaleInputSchema,
  ShiftReport,
  CreateSupplierInputSchema,
  CreateSupplierPaymentInputSchema,
  CreatePurchaseOrderInputSchema,
  PostGoodsReceiptInputSchema,
  UpdateGoodsReceiptInputSchema,
  CreateRecipeInputSchema,
  CreateRecipeVersionInputSchema,
  CreateProductionRunInputSchema,
  UpdateProductionRunStatusInputSchema,
  CompleteProductionRunInputSchema,
  CreateCustomerInputSchema,
  CreateCustomOrderInputSchema,
  UpdateCustomOrderStatusInputSchema,
  AddCustomOrderPaymentInputSchema,
  CreateHeldCartInputSchema,
  CreateBackupInputSchema,
  RestoreBackupInputSchema,
  ExportReportInputSchema,
  GetProfitLossQuerySchema,
  LoginInputSchema,
  CreateUserInputSchema,
  UpdateUserInputSchema,
  CreateRoleInputSchema,
  UpdateRoleInputSchema,
  DeleteRoleInputSchema,
  GetStockBalancesQuerySchema,
  CreateExpenseCategoryInputSchema,

  CreateExpenseInputSchema,
  ListExpensesQuerySchema,
  UpsertPayrollProfileInputSchema,
  CreateSalaryAdvanceInputSchema,
  UpdateSalaryAdvanceInputSchema,
  DeleteSalaryAdvanceInputSchema,
  DisburseSalaryInputSchema,
  GetEmployeeStatementQuerySchema,
  UserSession,
} from '@rz-crm/contracts';

import {
  HealthService,
  StoreSettingsService,
  UnitsService,
  CatalogService,
  BarcodeService,
  InventoryService,
  ShiftsService,
  PosSaleService,
  ProfitLossService,
  SuppliersService,
  PurchaseOrdersService,
  GoodsReceivingService,
  RecipesService,
  ProductionRunsService,
  CustomersService,
  CustomOrdersService,
  HeldCartsService,
  BackupService,
  UsersService,
  ExpensesService,
  PayrollService,
  INestApplicationContext,
} from '@rz-crm/backend';
import { generateUuid } from '@rz-crm/shared';

export function registerIpcHandlers(appContext: INestApplicationContext, databasePath: string): void {
  const healthService = appContext.get(HealthService);
  const usersService = appContext.get(UsersService);
  const expensesService = appContext.get(ExpensesService);
  const payrollService = appContext.get(PayrollService);
  let activeSession: UserSession | null = null;

  const storeSettingsService = appContext.get(StoreSettingsService);
  const unitsService = appContext.get(UnitsService);
  const catalogService = appContext.get(CatalogService);
  const barcodeService = appContext.get(BarcodeService);
  const inventoryService = appContext.get(InventoryService);
  const shiftsService = appContext.get(ShiftsService);
  const posSaleService = appContext.get(PosSaleService);
  const profitLossService = appContext.get(ProfitLossService);
  const suppliersService = appContext.get(SuppliersService);
  const purchaseOrdersService = appContext.get(PurchaseOrdersService);
  const goodsReceivingService = appContext.get(GoodsReceivingService);
  const recipesService = appContext.get(RecipesService);
  const productionRunsService = appContext.get(ProductionRunsService);
  const customersService = appContext.get(CustomersService);
  const customOrdersService = appContext.get(CustomOrdersService);
  const heldCartsService = appContext.get(HeldCartsService);
  const backupService = appContext.get(BackupService);

  // 0. Auth & Users Handlers
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = LoginInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid login credentials format',
          correlationId,
        });
      }
      const session = await usersService.login(parsed.data);
      activeSession = session;
      return Result.ok(session);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.AUTH_UNAUTHENTICATED,
        message: err instanceof Error ? err.message : 'Login failed',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    if (activeSession?.id) {
      try {
        const refreshed = await usersService.getSessionForUser(activeSession.id);
        if (refreshed) {
          activeSession = {
            ...activeSession,
            ...refreshed,
          };
        }
      } catch {
        // use cached activeSession
      }
    }
    return Result.ok(activeSession);
  });

  ipcMain.handle(IPC_CHANNELS.USERS_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const users = await usersService.listUsers(storeId || 1);
      return Result.ok(users);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list users',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.USERS_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateUserInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid user input data',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const user = await usersService.createUser(parsed.data);
      return Result.ok(user);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to create user',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.USERS_UPDATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateUserInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid user update data',
          correlationId,
        });
      }
      const user = await usersService.updateUser(parsed.data);
      return Result.ok(user);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update user',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.ROLES_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const roles = await usersService.listRoles();
      return Result.ok(roles);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list roles',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.ROLES_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateRoleInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid role data: ' + parsed.error.issues.map((i) => i.message).join(', '),
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const role = await usersService.createRole(parsed.data);
      return Result.ok(role);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to create role',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.ROLES_UPDATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateRoleInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid role update data',
          correlationId,
        });
      }
      const role = await usersService.updateRole(parsed.data);
      if (activeSession && activeSession.role === role.name) {
        activeSession.permissions = role.permissions;
      }
      return Result.ok(role);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update role',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.ROLES_DELETE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = DeleteRoleInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid delete role input',
          correlationId,
        });
      }
      await usersService.deleteRole(parsed.data);
      return Result.ok(undefined);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to delete role',
        correlationId,
      });
    }
  });

  // 1. Health Check Handler
  ipcMain.handle(IPC_CHANNELS.HEALTH_CHECK, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const inputParsed = HealthCheckInputSchema.safeParse(rawInput ?? {});
      if (!inputParsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid health check payload format',
          correlationId,
          details: { errors: inputParsed.error.issues },
        });
      }

      const healthData = await healthService.checkHealth({
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        userDataPath: app.getPath('userData'),
      });

      const responseValidation = HealthCheckResponseSchema.safeParse(healthData);
      if (!responseValidation.success) {
        return Result.err({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Health check response violated contract schema',
          correlationId,
        });
      }

      return Result.ok(responseValidation.data);
    } catch (err) {
      console.error(`[IPC ${correlationId}] Health check error:`, err);
      return Result.err({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal error during health check',
        correlationId,
      });
    }
  });

  // 2. System Info Handler
  ipcMain.handle(IPC_CHANNELS.SYSTEM_INFO, async () => {
    const correlationId = generateUuid();
    try {
      const store = await storeSettingsService.getActiveStore();
      const installation = await storeSettingsService.getActiveInstallation();

      const systemInfo = {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron ?? 'development',
        nodeVersion: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        userDataPath: app.getPath('userData'),
        databasePath,
        installation,
        store,
      };

      const parsed = SystemInfoResponseSchema.safeParse(systemInfo);
      if (!parsed.success) {
        console.error(`[IPC ${correlationId}] System info validation failed:`, parsed.error.issues);
        return Result.err({
          code: ErrorCode.INTERNAL_ERROR,
          message: `System info response violated contract schema: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
          correlationId,
        });
      }

      return Result.ok(parsed.data);
    } catch (err) {
      console.error(`[IPC ${correlationId}] System info error:`, err);
      return Result.err({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to retrieve system info',
        correlationId,
      });
    }
  });

  // 3. System Store Get Handler
  ipcMain.handle(IPC_CHANNELS.SYSTEM_STORE_GET, async () => {
    const correlationId = generateUuid();
    try {
      const store = await storeSettingsService.getActiveStore();
      if (!store) return Result.ok(null);

      const parsed = StoreSchema.safeParse(store);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Store response violated contract schema',
          correlationId,
        });
      }

      return Result.ok(parsed.data);
    } catch (err) {
      console.error(`[IPC ${correlationId}] Store fetch error:`, err);
      return Result.err({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to retrieve active store',
        correlationId,
      });
    }
  });

  // 3b. System Settings Handlers
  ipcMain.handle(IPC_CHANNELS.SYSTEM_SETTINGS_GET, async (_event, storeId?: number) => {
    const correlationId = generateUuid();
    try {
      const settings = await storeSettingsService.getSettings(storeId);
      return Result.ok(settings);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch settings',
        correlationId,
      });
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SYSTEM_SETTINGS_SET,
    async (
      _event,
      input: { key: string; value: string; storeId?: number; scope?: string; description?: string; actorId?: number },
    ) => {
      const correlationId = generateUuid();
      try {
        const setting = await storeSettingsService.setSetting(input.key, input.value, {
          storeId: input.storeId,
          scope: input.scope,
          description: input.description,
          actorId: input.actorId,
        });
        return Result.ok(setting);
      } catch (err: unknown) {
        return Result.err({
          code: ErrorCode.DATABASE_ERROR,
          message: err instanceof Error ? err.message : 'Failed to save setting',
          correlationId,
        });
      }
    },
  );

  // 4. Units List
  ipcMain.handle(IPC_CHANNELS.CATALOG_UNITS_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const units = await unitsService.getUnits();
      return Result.ok(units);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch units',
        correlationId,
      });
    }
  });

  // 4b. Create Unit
  ipcMain.handle(
    IPC_CHANNELS.CATALOG_UNITS_CREATE,
    async (_event, rawInput: unknown) => {
      const correlationId = generateUuid();
      try {
        const validated = CreateUnitInputSchema.parse(rawInput);
        const created = await unitsService.createUnit(validated);
        return Result.ok(created);
      } catch (err) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: err instanceof Error ? err.message : 'Failed to create unit',
          correlationId,
        });
      }
    },
  );

  // 5. Categories List
  ipcMain.handle(IPC_CHANNELS.CATALOG_CATEGORIES_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const categories = await catalogService.getCategories();
      return Result.ok(categories);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch categories',
        correlationId,
      });
    }
  });

  // 6. Category Create
  ipcMain.handle(IPC_CHANNELS.CATALOG_CATEGORIES_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateCategoryInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid category payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const category = await catalogService.createCategory(parsed.data);
      return Result.ok(category);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to create category',
        correlationId,
      });
    }
  });

  // 7. Products List
  ipcMain.handle(IPC_CHANNELS.CATALOG_PRODUCTS_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const products = await catalogService.getProducts();
      return Result.ok(products);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch products',
        correlationId,
      });
    }
  });

  // 8. Product Create
  ipcMain.handle(IPC_CHANNELS.CATALOG_PRODUCTS_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateProductInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid product payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const product = await catalogService.createProduct(parsed.data);
      return Result.ok(product);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to create product',
        correlationId,
      });
    }
  });

  // 8b. Product Update (Prices, Details)
  ipcMain.handle(IPC_CHANNELS.CATALOG_PRODUCTS_UPDATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateProductInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid product update payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const product = await catalogService.updateProduct(parsed.data);
      return Result.ok(product);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to update product',
        correlationId,
      });
    }
  });

  // 9. Barcode Resolve
  ipcMain.handle(IPC_CHANNELS.BARCODE_RESOLVE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = BarcodeLookupInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid barcode query',
          correlationId,
        });
      }

      const result = await barcodeService.resolve(parsed.data.barcodeValue);
      return Result.ok(result);
    } catch (err) {
      return Result.err({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Error during barcode resolution',
        correlationId,
      });
    }
  });

  // 10. Opening Stock Get
  ipcMain.handle(IPC_CHANNELS.INVENTORY_OPENING_STOCK_GET, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const session = await inventoryService.getOpeningStockSession(storeId);
      return Result.ok(session);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch opening stock session',
        correlationId,
      });
    }
  });

  // 11. Opening Stock Confirm
  ipcMain.handle(IPC_CHANNELS.INVENTORY_OPENING_STOCK_CONFIRM, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = ConfirmOpeningStockInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid opening stock payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const session = await inventoryService.confirmOpeningStock(parsed.data);
      return Result.ok(session);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to confirm opening stock',
        correlationId,
      });
    }
  });

  // 11b. Inventory Stock Balances
  ipcMain.handle(IPC_CHANNELS.INVENTORY_STOCK_BALANCES_GET, async (_event, rawQuery: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = GetStockBalancesQuerySchema.safeParse(rawQuery ?? {});
      const balances = await inventoryService.getStockBalances(parsed.success ? parsed.data : undefined);
      return Result.ok(balances);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to load stock balances',
        correlationId,
      });
    }
  });

  // 11c. Inventory Movements Log
  ipcMain.handle(IPC_CHANNELS.INVENTORY_MOVEMENTS_GET, async (_event, storeId: number, itemId?: number) => {
    const correlationId = generateUuid();
    try {
      const movements = await inventoryService.getMovements(storeId || 1, itemId);
      return Result.ok(movements);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to load stock movements',
        correlationId,
      });
    }
  });

  // 11d. Inventory Stock Quick Adjustment
  ipcMain.handle(
    IPC_CHANNELS.INVENTORY_STOCK_ADJUST,
    async (
      _event,
      input: { storeId: number; itemId: number; newQuantity: number; reason: string; actorId?: number },
    ) => {
      const correlationId = generateUuid();
      try {
        const res = await inventoryService.recordStockAdjustment(input);
        return Result.ok(res);
      } catch (err: unknown) {
        return Result.err({
          code: ErrorCode.DATABASE_ERROR,
          message: err instanceof Error ? err.message : 'Failed to record stock adjustment',
          correlationId,
        });
      }
    },
  );

  // 12. POS Active Shift Get
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_GET_ACTIVE, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const shift = await shiftsService.getActiveShift(storeId);
      return Result.ok(shift);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch active shift',
        correlationId,
      });
    }
  });

  // 13. POS Shift Open
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_OPEN, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = OpenShiftInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid shift open payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const shift = await shiftsService.openShift(parsed.data);
      return Result.ok(shift);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to open shift',
        correlationId,
      });
    }
  });

  // 14. POS Shift Close
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_CLOSE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CloseShiftInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid shift close payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const shift = await shiftsService.closeShift(parsed.data);
      return Result.ok(shift);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to close shift',
        correlationId,
      });
    }
  });

  // 15. POS Cash Sale Checkout
  ipcMain.handle(IPC_CHANNELS.POS_SALE_CHECKOUT_CASH, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CheckoutSaleInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid sale checkout payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const receipt = await posSaleService.checkoutCashSale(parsed.data);
      return Result.ok(receipt);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.CONFLICT,
        message: err instanceof Error ? err.message : 'Failed to checkout cash sale',
        correlationId,
      });
    }
  });

  // 16. POS Recent Sales List
  ipcMain.handle(IPC_CHANNELS.POS_SALE_RECENT_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const sales = await posSaleService.getRecentSales(storeId);
      return Result.ok(sales);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch recent sales',
        correlationId,
      });
    }
  });

  // 17. POS Sale Receipt Details (Reprint)
  ipcMain.handle(IPC_CHANNELS.POS_SALE_GET_RECEIPT, async (_event, saleId: number) => {
    const correlationId = generateUuid();
    try {
      const receipt = await posSaleService.getSaleReceipt(saleId);
      return Result.ok(receipt);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Receipt not found',
        correlationId,
      });
    }
  });

  // 17b. POS Sale Silent Thermal Print (80mm)
  ipcMain.handle(
    IPC_CHANNELS.POS_PRINT_RECEIPT_SILENT,
    async (_event, input: { html: string; printerName?: string }) => {
      const correlationId = generateUuid();
      let printWin: BrowserWindow | null = null;
      try {
        printWin = new BrowserWindow({
          show: false,
          width: 350,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        let finalHtml = input.html;
        if (finalHtml.includes('<!-- MEZAAN_LOGO_PLACEHOLDER -->')) {
          try {
            const possiblePaths = [
              path.join(__dirname, '../renderer/mezaan-logo.png'),
              path.resolve(app.getAppPath(), 'dist/renderer/mezaan-logo.png'),
              path.resolve('apps/renderer/public/mezaan-logo.png'),
            ];
            let buf: Buffer | null = null;
            for (const p of possiblePaths) {
              try {
                buf = await fs.readFile(p);
                if (buf) break;
              } catch {}
            }
            if (buf) {
              const base64 = buf.toString('base64');
              const logoHtml = `<div style="text-align: center; margin-bottom: 4px;"><img src="data:image/png;base64,${base64}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; display: inline-block;" /></div>`;
              finalHtml = finalHtml.replace('<!-- MEZAAN_LOGO_PLACEHOLDER -->', logoHtml);
            } else {
              finalHtml = finalHtml.replace('<!-- MEZAAN_LOGO_PLACEHOLDER -->', '');
            }
          } catch {
            finalHtml = finalHtml.replace('<!-- MEZAAN_LOGO_PLACEHOLDER -->', '');
          }
        }

        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(finalHtml)}`);

        // Wait a brief moment for layout/fonts/image to settle
        await new Promise((resolve) => setTimeout(resolve, 250));

        const printers = await printWin.webContents.getPrintersAsync();
        let targetPrinter = '';

        // Priority 1: Exact 'POS-80' match
        const exactPos80 = printers.find((p) => p.name.trim().toLowerCase() === 'pos-80');
        if (exactPos80) {
          targetPrinter = exactPos80.name;
        } else if (input.printerName) {
          const match = printers.find(
            (p) => p.name.toLowerCase() === input.printerName!.toLowerCase(),
          );
          if (match) targetPrinter = match.name;
        }

        // Priority 2: Any printer with 'pos-80' (excluding copies if clean name exists)
        if (!targetPrinter) {
          const posMatch = printers.find(
            (p) =>
              p.name.toLowerCase().includes('pos-80') &&
              !p.name.toLowerCase().includes('(copy'),
          ) || printers.find((p) => p.name.toLowerCase().includes('pos-80'));
          if (posMatch) targetPrinter = posMatch.name;
        }

        // Priority 3: Default printer
        if (!targetPrinter) {
          const defaultPrinter = printers.find((p) => p.isDefault);
          if (defaultPrinter) targetPrinter = defaultPrinter.name;
        }

        // Priority 4: Any other thermal printer
        if (!targetPrinter) {
          const thermalMatch = printers.find(
            (p) =>
              p.name.toLowerCase().includes('80mm') ||
              p.name.toLowerCase().includes('thermal') ||
              p.name.toLowerCase().includes('fp-1100') ||
              p.name.toLowerCase().includes('pos'),
          );
          if (thermalMatch) targetPrinter = thermalMatch.name;
        }

        const winRef = printWin;
        return await new Promise((resolve) => {
          let hasResolved = false;
          const timer = setTimeout(() => {
            if (!hasResolved) {
              hasResolved = true;
              try {
                winRef.close();
              } catch {}
              resolve(
                Result.err({
                  code: ErrorCode.INTERNAL_ERROR,
                  message: 'Silent print timed out after 15 seconds',
                  correlationId,
                }),
              );
            }
          }, 15000);

          winRef.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: targetPrinter,
              margins: {
                marginType: 'printableArea',
              },
              pageSize: {
                width: 72000,
                height: 297000,
              },
            },
            (success, failureReason) => {
              if (success) {
                clearTimeout(timer);
                if (!hasResolved) {
                  hasResolved = true;
                  try {
                    winRef.close();
                  } catch {}
                  resolve(Result.ok({ printed: true, printerName: targetPrinter }));
                }
              } else {
                // Retry with minimal options if driver rejected custom pageSize/printableArea
                winRef.webContents.print(
                  {
                    silent: true,
                    printBackground: true,
                    deviceName: targetPrinter,
                  },
                  (retrySuccess, retryFailureReason) => {
                    clearTimeout(timer);
                    if (!hasResolved) {
                      hasResolved = true;
                      try {
                        winRef.close();
                      } catch {}
                      if (retrySuccess) {
                        resolve(Result.ok({ printed: true, printerName: targetPrinter }));
                      } else {
                        resolve(
                          Result.err({
                            code: ErrorCode.INTERNAL_ERROR,
                            message: `Silent print failed: ${retryFailureReason || failureReason}`,
                            correlationId,
                          }),
                        );
                      }
                    }
                  },
                );
              }
            },
          );
        });
      } catch (err: unknown) {
        if (printWin) {
          try {
            printWin.close();
          } catch {}
        }
        return Result.err({
          code: ErrorCode.INTERNAL_ERROR,
          message: err instanceof Error ? err.message : 'Silent print exception',
          correlationId,
        });
      }
    },
  );

  // 18. POS Shifts List
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const shifts = await shiftsService.getRecentShifts(storeId);
      return Result.ok(shifts);
    } catch (err) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: 'Failed to fetch shifts list',
        correlationId,
      });
    }
  });

  // 19. POS Shift Report (X/Z Report)
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_REPORT, async (_event, shiftId: number) => {
    const correlationId = generateUuid();
    try {
      const report = await shiftsService.getShiftReport(shiftId);
      return Result.ok(report);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Shift report failed',
        correlationId,
      });
    }
  });

  // 20. POS Shift Export to Native PDF
  ipcMain.handle(IPC_CHANNELS.POS_SHIFT_EXPORT_PDF, async (_event, report: ShiftReport) => {
    const correlationId = generateUuid();
    let printWin: BrowserWindow | null = null;
    try {
      const html = generateShiftReportHtml(report);

      printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'A4',
        margins: {
          marginType: 'custom',
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4,
        },
      });

      printWin.close();
      printWin = null;

      const defaultFileName = `Shift_Report_${(report.shiftCode || 'Shift-' + report.shiftId).replace(/[^a-zA-Z0-9-_]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const defaultPath = path.join(app.getPath('downloads'), defaultFileName);

      const saveResult = await dialog.showSaveDialog({
        title: 'Save Shift Summary PDF Report',
        defaultPath,
        filters: [{ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return Result.ok({ filePath: '' });
      }

      await fs.writeFile(saveResult.filePath, pdfBuffer);

      // Launch default system PDF viewer for immediate viewing and printing
      shell.openPath(saveResult.filePath);

      return Result.ok({ filePath: saveResult.filePath });
    } catch (err: unknown) {
      if (printWin) {
        try {
          printWin.close();
        } catch {
          // ignore
        }
      }
      return Result.err({
        code: ErrorCode.INTERNAL_ERROR,
        message: err instanceof Error ? err.message : 'Failed to export shift report to PDF',
        correlationId,
      });
    }
  });

  // 21. Purchasing: Suppliers List
  ipcMain.handle(IPC_CHANNELS.PURCHASING_SUPPLIER_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const suppliers = await suppliersService.getSuppliers(storeId);
      return Result.ok(suppliers);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch suppliers',
        correlationId,
      });
    }
  });

  // 22. Purchasing: Create Supplier
  ipcMain.handle(IPC_CHANNELS.PURCHASING_SUPPLIER_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateSupplierInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid supplier payload format',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const created = await suppliersService.createSupplier(parsed.data);
      return Result.ok(created);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create supplier',
        correlationId,
      });
    }
  });

  // 22a. Purchasing: Supplier Balances Summary
  ipcMain.handle(IPC_CHANNELS.PURCHASING_SUPPLIERS_BALANCES, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const balances = await suppliersService.getSupplierBalances(storeId);
      return Result.ok(balances);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch supplier balances',
        correlationId,
      });
    }
  });

  // 22b. Purchasing: Supplier Chronological Ledger Statement
  ipcMain.handle(
    IPC_CHANNELS.PURCHASING_SUPPLIERS_LEDGER,
    async (_event, input: { storeId: number; supplierId: number }) => {
      const correlationId = generateUuid();
      try {
        const ledger = await suppliersService.getSupplierLedger(input.storeId, input.supplierId);
        return Result.ok(ledger);
      } catch (err: unknown) {
        return Result.err({
          code: ErrorCode.DATABASE_ERROR,
          message: err instanceof Error ? err.message : 'Failed to fetch supplier ledger',
          correlationId,
        });
      }
    }
  );

  // 22c. Purchasing: Record Supplier Payment
  ipcMain.handle(IPC_CHANNELS.PURCHASING_SUPPLIERS_RECORD_PAYMENT, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateSupplierPaymentInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid supplier payment payload format',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const payment = await suppliersService.recordSupplierPayment(parsed.data);
      return Result.ok(payment);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to record supplier payment',
        correlationId,
      });
    }
  });

  // 23. Purchasing: Purchase Orders List
  ipcMain.handle(IPC_CHANNELS.PURCHASING_PO_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const orders = await purchaseOrdersService.getPurchaseOrders(storeId);
      return Result.ok(orders);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch purchase orders',
        correlationId,
      });
    }
  });

  // 24. Purchasing: Create Purchase Order
  ipcMain.handle(IPC_CHANNELS.PURCHASING_PO_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreatePurchaseOrderInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid purchase order payload format',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const created = await purchaseOrdersService.createPurchaseOrder(parsed.data);
      return Result.ok(created);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create purchase order',
        correlationId,
      });
    }
  });

  // 25. Purchasing: Get Purchase Order Detail
  ipcMain.handle(IPC_CHANNELS.PURCHASING_PO_GET, async (_event, poId: number) => {
    const correlationId = generateUuid();
    try {
      const po = await purchaseOrdersService.getPurchaseOrder(poId);
      return Result.ok(po);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Purchase order not found',
        correlationId,
      });
    }
  });

  // 26. Purchasing: Approve Purchase Order
  ipcMain.handle(IPC_CHANNELS.PURCHASING_PO_APPROVE, async (_event, poId: number) => {
    const correlationId = generateUuid();
    try {
      const approved = await purchaseOrdersService.approvePurchaseOrder(poId);
      return Result.ok(approved);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to approve purchase order',
        correlationId,
      });
    }
  });

  // 27. Purchasing: Goods Receipts (GRN) List
  ipcMain.handle(IPC_CHANNELS.PURCHASING_GRN_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const receipts = await goodsReceivingService.getGoodsReceipts(storeId);
      return Result.ok(receipts);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch goods receipts',
        correlationId,
      });
    }
  });

  // 28. Purchasing: Post Goods Receipt (GRN)
  ipcMain.handle(IPC_CHANNELS.PURCHASING_GRN_POST, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = PostGoodsReceiptInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid goods receipt payload format',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const receipt = await goodsReceivingService.postGoodsReceipt(parsed.data);
      return Result.ok(receipt);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to post goods receipt',
        correlationId,
      });
    }
  });

  // 28b. Purchasing: Update Unpaid Goods Receipt (GRN)
  ipcMain.handle(IPC_CHANNELS.PURCHASING_GRN_UPDATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateGoodsReceiptInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid goods receipt update payload format',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const receipt = await goodsReceivingService.updateGoodsReceipt(parsed.data);
      return Result.ok(receipt);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update goods receipt',
        correlationId,
      });
    }
  });

  // 29. Purchasing: Get Goods Receipt Detail
  ipcMain.handle(IPC_CHANNELS.PURCHASING_GRN_GET, async (_event, grnId: number) => {
    const correlationId = generateUuid();
    try {
      const receipt = await goodsReceivingService.getGoodsReceipt(grnId);
      return Result.ok(receipt);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Goods receipt not found',
        correlationId,
      });
    }
  });

  // 30. Production: Recipes List
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RECIPE_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const recipes = await recipesService.getRecipes(storeId);
      return Result.ok(recipes);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch recipes',
        correlationId,
      });
    }
  });

  // 31. Production: Get Recipe Detail
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RECIPE_GET, async (_event, recipeId: number) => {
    const correlationId = generateUuid();
    try {
      const recipe = await recipesService.getRecipe(recipeId);
      return Result.ok(recipe);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Recipe not found',
        correlationId,
      });
    }
  });

  // 32. Production: Create Recipe
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RECIPE_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateRecipeInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid recipe payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const activeStore = await storeSettingsService.getActiveStore();
      if (!activeStore) {
        return Result.err({
          code: ErrorCode.NOT_FOUND,
          message: 'No active store found',
          correlationId,
        });
      }
      const recipe = await recipesService.createRecipe(activeStore.id, parsed.data);
      return Result.ok(recipe);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create recipe',
        correlationId,
      });
    }
  });

  // 33. Production: Create Recipe Version
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RECIPE_VERSION_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateRecipeVersionInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid recipe version payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const version = await recipesService.createRecipeVersion(parsed.data.recipeId, parsed.data);
      return Result.ok(version);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create recipe version',
        correlationId,
      });
    }
  });

  // 34. Production: Production Runs List
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RUN_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const runs = await productionRunsService.getProductionRuns(storeId);
      return Result.ok(runs);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch production runs',
        correlationId,
      });
    }
  });

  // 35. Production: Get Production Run Detail
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RUN_GET, async (_event, runId: number) => {
    const correlationId = generateUuid();
    try {
      const run = await productionRunsService.getProductionRun(runId);
      return Result.ok(run);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Production run not found',
        correlationId,
      });
    }
  });

  // 36. Production: Create Production Run
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RUN_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateProductionRunInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid production run payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const activeStore = await storeSettingsService.getActiveStore();
      if (!activeStore) {
        return Result.err({
          code: ErrorCode.NOT_FOUND,
          message: 'No active store found',
          correlationId,
        });
      }
      const run = await productionRunsService.createProductionRun(activeStore.id, parsed.data);
      return Result.ok(run);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create production run',
        correlationId,
      });
    }
  });

  // 37. Production: Update Run Status
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RUN_UPDATE_STATUS, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateProductionRunStatusInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid status update payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const updated = await productionRunsService.updateProductionRunStatus(parsed.data);
      return Result.ok(updated);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update run status',
        correlationId,
      });
    }
  });

  // 38. Production: Complete Run
  ipcMain.handle(IPC_CHANNELS.PRODUCTION_RUN_COMPLETE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CompleteProductionRunInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid production run completion payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const activeStore = await storeSettingsService.getActiveStore();
      if (!activeStore) {
        return Result.err({
          code: ErrorCode.NOT_FOUND,
          message: 'No active store found',
          correlationId,
        });
      }
      const completed = await productionRunsService.completeProductionRun(activeStore.id, parsed.data);
      return Result.ok(completed);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to complete production run',
        correlationId,
      });
    }
  });

  // 39. Custom Orders: Customer Search
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_CUSTOMER_SEARCH, async (_event, storeId: number, query: string) => {
    const correlationId = generateUuid();
    try {
      const customers = await customersService.searchCustomers(storeId, query ?? '');
      return Result.ok(customers);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to search customers',
        correlationId,
      });
    }
  });

  // 40. Custom Orders: Customer Create
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_CUSTOMER_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateCustomerInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid customer payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const customer = await customersService.createCustomer(parsed.data);
      return Result.ok(customer);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create customer',
        correlationId,
      });
    }
  });

  // 41. Custom Orders: List
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_LIST, async (_event, storeId: number, status?: string) => {
    const correlationId = generateUuid();
    try {
      const orders = await customOrdersService.getCustomOrders(storeId, status);
      return Result.ok(orders);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch custom orders',
        correlationId,
      });
    }
  });

  // 42. Custom Orders: Get by ID
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_GET, async (_event, orderId: number) => {
    const correlationId = generateUuid();
    try {
      const order = await customOrdersService.getCustomOrder(orderId);
      return Result.ok(order);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.NOT_FOUND,
        message: err instanceof Error ? err.message : 'Failed to fetch custom order',
        correlationId,
      });
    }
  });

  // 43. Custom Orders: Create
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_CREATE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateCustomOrderInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid custom order payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const order = await customOrdersService.createCustomOrder(parsed.data);
      return Result.ok(order);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create custom order',
        correlationId,
      });
    }
  });

  // 44. Custom Orders: Update Status
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_UPDATE_STATUS, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateCustomOrderStatusInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid order status update payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const updated = await customOrdersService.updateOrderStatus(parsed.data);
      return Result.ok(updated);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update order status',
        correlationId,
      });
    }
  });

  // 45. Custom Orders: Record Payment
  ipcMain.handle(IPC_CHANNELS.CUSTOM_ORDERS_RECORD_PAYMENT, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = AddCustomOrderPaymentInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid order payment payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const updated = await customOrdersService.recordOrderPayment(parsed.data);
      return Result.ok(updated);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to record order payment',
        correlationId,
      });
    }
  });

  // 46. Held Carts: List
  ipcMain.handle(IPC_CHANNELS.POS_HELD_CARTS_LIST, async (_event, storeId: number) => {
    const correlationId = generateUuid();
    try {
      const carts = await heldCartsService.getHeldCarts(storeId);
      return Result.ok(carts);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to fetch held carts',
        correlationId,
      });
    }
  });

  // 47. Held Carts: Hold
  ipcMain.handle(IPC_CHANNELS.POS_HELD_CARTS_HOLD, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateHeldCartInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid held cart payload',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const held = await heldCartsService.holdCart(parsed.data);
      return Result.ok(held);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to hold cart',
        correlationId,
      });
    }
  });

  // 48. Held Carts: Restore
  ipcMain.handle(IPC_CHANNELS.POS_HELD_CARTS_RESTORE, async (_event, cartId: number) => {
    const correlationId = generateUuid();
    try {
      const cart = await heldCartsService.restoreHeldCart(cartId);
      return Result.ok(cart);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to restore held cart',
        correlationId,
      });
    }
  });

  // 49. Held Carts: Discard
  ipcMain.handle(IPC_CHANNELS.POS_HELD_CARTS_DISCARD, async (_event, cartId: number) => {
    const correlationId = generateUuid();
    try {
      await heldCartsService.discardHeldCart(cartId);
      return Result.ok(undefined);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to discard held cart',
        correlationId,
      });
    }
  });

  // 50. Backup: List Backups
  ipcMain.handle(IPC_CHANNELS.BACKUP_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const backups = await backupService.listBackups();
      return Result.ok(backups);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list backups',
        correlationId,
      });
    }
  });

  // 51. Backup: Create Backup Snapshot
  ipcMain.handle(IPC_CHANNELS.BACKUP_CREATE, async (_event, rawInput?: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateBackupInputSchema.safeParse(rawInput ?? {});
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid create backup parameters',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const manifest = await backupService.createBackup(parsed.data);
      return Result.ok(manifest);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create backup snapshot',
        correlationId,
      });
    }
  });

  // 52. Backup: Restore Backup
  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = RestoreBackupInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid restore backup request',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }
      const result = await backupService.restoreBackup(parsed.data);
      return Result.ok(result);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to restore database from backup',
        correlationId,
      });
    }
  });

  // 53. Backup: Get Status & Summary
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_STATUS, async () => {
    const correlationId = generateUuid();
    try {
      const status = await backupService.getStatus();
      return Result.ok(status);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to get backup status',
        correlationId,
      });
    }
  });

  // 54. Backup: Verify Integrity
  ipcMain.handle(IPC_CHANNELS.BACKUP_VERIFY, async (_event, filename: string) => {
    const correlationId = generateUuid();
    try {
      const result = await backupService.verifyBackup(filename);
      return Result.ok(result);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to verify backup integrity',
        correlationId,
      });
    }
  });

  // 55. Backup: Open Backup Folder in File Explorer
  ipcMain.handle(IPC_CHANNELS.BACKUP_OPEN_FOLDER, async () => {
    const correlationId = generateUuid();
    try {
      const dir = backupService.getBackupDir();
      await shell.openPath(dir);
      return Result.ok(undefined);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to open backup folder',
        correlationId,
      });
    }
  });

  // 56. Reports: Profit & Loss Analytics
  ipcMain.handle(IPC_CHANNELS.REPORTS_PROFIT_LOSS, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = GetProfitLossQuerySchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid profit & loss query parameters',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const report = await profitLossService.calculateProfitLoss(parsed.data);
      return Result.ok(report);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to calculate profit and loss report',
        correlationId,
      });
    }
  });

  // 57. Reports: Export File via Native Windows Dialog (CSV / Excel / PDF)
  ipcMain.handle(IPC_CHANNELS.REPORTS_EXPORT_FILE, async (_event, rawInput: unknown) => {
    const correlationId = generateUuid();
    try {
      const parsed = ExportReportInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'Invalid export report request',
          correlationId,
          details: { errors: parsed.error.issues },
        });
      }

      const ext = parsed.data.format === 'csv' ? 'csv' : parsed.data.format === 'json' ? 'json' : 'txt';
      const filters =
        ext === 'csv'
          ? [{ name: 'CSV (Excel) File', extensions: ['csv'] }]
          : ext === 'json'
          ? [{ name: 'JSON Document', extensions: ['json'] }]
          : [{ name: 'Text Document', extensions: ['txt'] }];

      const focusedWindow = BrowserWindow.getFocusedWindow();
      const saveRes = await dialog.showSaveDialog(focusedWindow || (BrowserWindow.getAllWindows()[0] as any), {
        title: parsed.data.title || 'Save Report',
        defaultPath: parsed.data.suggestedFilename,
        filters,
      });

      if (saveRes.canceled || !saveRes.filePath) {
        return Result.ok({ saved: false });
      }

      // Add UTF-8 BOM so Microsoft Excel correctly renders Unicode without scrambled characters
      const fileContent = ext === 'csv' ? '\uFEFF' + parsed.data.content : parsed.data.content;
      await fs.writeFile(saveRes.filePath, fileContent, 'utf8');

      return Result.ok({ saved: true, filePath: saveRes.filePath });
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to save report file',
        correlationId,
      });
    }
  });

  // ==========================================
  // EXPENSES & OPERATING COSTS
  // ==========================================

  ipcMain.handle(IPC_CHANNELS.EXPENSES_CATEGORIES_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const categories = await expensesService.listCategories();
      return Result.ok(categories);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list expense categories',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPENSES_CATEGORIES_CREATE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateExpenseCategoryInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const category = await expensesService.createCategory(parsed.data);
      return Result.ok(category);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create expense category',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPENSES_LIST, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = ListExpensesQuerySchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const expenses = await expensesService.listExpenses(parsed.data);
      return Result.ok(expenses);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list expenses',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPENSES_CREATE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateExpenseInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const expense = await expensesService.createExpense(parsed.data);
      return Result.ok(expense);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to create expense',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPENSES_DELETE, async (_event, id: number) => {
    const correlationId = generateUuid();
    try {
      await expensesService.deleteExpense(id);
      return Result.ok(undefined);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to delete expense',
        correlationId,
      });
    }
  });

  // ==========================================
  // STAFF PAYROLL & ADVANCES
  // ==========================================

  ipcMain.handle(IPC_CHANNELS.PAYROLL_PROFILES_LIST, async () => {
    const correlationId = generateUuid();
    try {
      const profiles = await payrollService.listProfiles();
      return Result.ok(profiles);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list payroll profiles',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_PROFILES_UPSERT, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpsertPayrollProfileInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const profile = await payrollService.upsertProfile(parsed.data);
      return Result.ok(profile);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to save payroll profile',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_ADVANCES_LIST, async (_event, { storeId, userId }: { storeId: number; userId?: number }) => {
    const correlationId = generateUuid();
    try {
      const advances = await payrollService.listAdvances(storeId, userId);
      return Result.ok(advances);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list salary advances',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_ADVANCES_CREATE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = CreateSalaryAdvanceInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const advance = await payrollService.createAdvance(parsed.data);
      return Result.ok(advance);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to record salary advance',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_ADVANCES_UPDATE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = UpdateSalaryAdvanceInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const advance = await payrollService.updateAdvance(parsed.data);
      return Result.ok(advance);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to update salary advance',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_ADVANCES_DELETE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = DeleteSalaryAdvanceInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      await payrollService.deleteAdvance(parsed.data);
      return Result.ok(undefined);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to delete salary advance',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_MONTHLY_SHEET, async (_event, { storeId, payrollMonth }: { storeId: number; payrollMonth: string }) => {
    const correlationId = generateUuid();
    try {
      const sheet = await payrollService.getMonthlySheet(storeId, payrollMonth);
      return Result.ok(sheet);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to generate monthly payroll sheet',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_SALARY_DISBURSE, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = DisburseSalaryInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.errors.map((e) => e.message).join(', '),
          correlationId,
        });
      }
      const payment = await payrollService.disburseSalary(parsed.data);
      return Result.ok(payment);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to disburse salary',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_PAYMENTS_LIST, async (_event, { storeId, payrollMonth }: { storeId: number; payrollMonth?: string }) => {
    const correlationId = generateUuid();
    try {
      const payments = await payrollService.listPayments(storeId, payrollMonth);
      return Result.ok(payments);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to list salary payments',
        correlationId,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.PAYROLL_EMPLOYEE_STATEMENT, async (_event, rawInput) => {
    const correlationId = generateUuid();
    try {
      const parsed = GetEmployeeStatementQuerySchema.safeParse(rawInput);
      if (!parsed.success) {
        return Result.err({
          code: ErrorCode.VALIDATION_FAILED,
          message: parsed.error.issues.map((i) => i.message).join(', '),
          correlationId,
        });
      }
      const statement = await payrollService.getEmployeeStatement(parsed.data);
      return Result.ok(statement);
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to generate employee statement',
        correlationId,
      });
    }
  });

  // 57. Diagnostics: Export Complete Support Diagnostics Bundle
  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_EXPORT_BUNDLE, async () => {

    const correlationId = generateUuid();
    try {
      const [health, backupStatus, store] = await Promise.all([
        healthService.checkHealth({
          version: app.getVersion(),
          platform: process.platform,
          arch: process.arch,
          userDataPath: app.getPath('userData'),
        }),
        backupService.getStatus(),
        storeSettingsService.getActiveStore(),
      ]);

      const bundle = {
        generatedAtUtc: new Date().toISOString(),
        system: {
          platform: process.platform,
          arch: process.arch,
          electronVersion: process.versions.electron,
          nodeVersion: process.versions.node,
          chromeVersion: process.versions.chrome,
          memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
        store: store ? { id: store.id, code: store.code, name: store.name } : null,
        health,
        backup: backupStatus,
      };

      const jsonStr = JSON.stringify(bundle, null, 2);
      const defaultFilename = `bakery-support-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;

      const focusedWindow = BrowserWindow.getFocusedWindow();
      const saveRes = await dialog.showSaveDialog(focusedWindow || (BrowserWindow.getAllWindows()[0] as any), {
        title: 'Export Support Diagnostic Bundle',
        defaultPath: defaultFilename,
        filters: [{ name: 'JSON Diagnostics File', extensions: ['json'] }],
      });

      if (saveRes.canceled || !saveRes.filePath) {
        return Result.ok({ saved: false });
      }

      await fs.writeFile(saveRes.filePath, jsonStr, 'utf8');
      return Result.ok({ saved: true, filePath: saveRes.filePath });
    } catch (err: unknown) {
      return Result.err({
        code: ErrorCode.DATABASE_ERROR,
        message: err instanceof Error ? err.message : 'Failed to export diagnostics bundle',
        correlationId,
      });
    }
  });
}


function generateShiftReportHtml(report: ShiftReport): string {
  const isClosed = report.status === 'closed';
  const variance = report.varianceMinorUnits ?? 0;
  const varianceText = !isClosed
    ? 'In Progress'
    : variance === 0
    ? 'Rs. 0.00 (Balanced)'
    : variance < 0
    ? `-Rs. ${(Math.abs(variance) / 100).toFixed(2)} (Shortage)`
    : `+Rs. ${(variance / 100).toFixed(2)} (Overage)`;
  const varianceColor = !isClosed ? '#64748b' : variance === 0 ? '#059669' : '#dc2626';

  const rows = report.itemsSold
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${item.productName}</td>
      <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #f1f5f9;">${item.sku}</td>
      <td style="padding: 8px 12px; text-align: center; border-bottom: 1px solid #f1f5f9;">${item.quantitySold}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: #059669; border-bottom: 1px solid #f1f5f9;">Rs. ${(item.revenueMinorUnits / 100).toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Shift Report - ${report.shiftCode || report.shiftId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 36px;
      color: #111827;
      font-size: 13px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0067b8;
      padding-bottom: 14px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #0067b8;
      margin: 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      background: ${report.status === 'open' ? '#ecfdf5' : '#f1f5f9'};
      color: ${report.status === 'open' ? '#065f46' : '#475569'};
      border: 1px solid ${report.status === 'open' ? '#a7f3d0' : '#cbd5e1'};
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }
    .kpi-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 18px;
      font-weight: 800;
      margin-top: 4px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 20px 0 8px 0;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 12px;
    }
    th {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      text-align: left;
      padding: 8px 12px;
      color: #475569;
      font-weight: 600;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .footer {
      margin-top: 40px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">${report.storeName || 'Bakery Store'}</h1>
      <div class="brand-sub">Cashier Shift Summary & Reconciliation Report</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">${report.status === 'open' ? 'Active Shift (X-Report)' : 'Closed Shift (Z-Report)'}</span>
      <div style="font-size: 11px; color: #64748b; margin-top: 6px;">Generated: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div><strong>Shift Code:</strong> ${report.shiftCode || '#' + report.shiftId}</div>
    <div><strong>Cashier ID:</strong> ${report.cashierId}</div>
    <div><strong>Opened At:</strong> ${report.openedAtUtc ? new Date(report.openedAtUtc).toLocaleString() : 'N/A'}</div>
    <div><strong>Closed At:</strong> ${report.closedAtUtc ? new Date(report.closedAtUtc).toLocaleString() : 'Currently In Progress'}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Cash Sales</div>
      <div class="kpi-val" style="color: #059669;">Rs. ${(report.totalCashSalesMinorUnits / 100).toFixed(2)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Transactions</div>
      <div class="kpi-val" style="color: #0f172a;">${report.totalTransactions}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Units Sold</div>
      <div class="kpi-val" style="color: #0f172a;">${report.totalUnitsSold}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Drawer Variance</div>
      <div class="kpi-val" style="color: ${varianceColor};">${varianceText}</div>
    </div>
  </div>

  <div class="section-title">Cash Drawer Balance Reconciliation</div>
  <table>
    <tbody>
      <tr>
        <td>Opening Float Cash:</td>
        <td style="text-align: right; font-weight: 600;">Rs. ${(report.openingFloatMinorUnits / 100).toFixed(2)}</td>
      </tr>
      <tr>
        <td>Total Cash Sales Collected:</td>
        <td style="text-align: right; font-weight: 600; color: #059669;">+ Rs. ${(report.totalCashSalesMinorUnits / 100).toFixed(2)}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="font-weight: 700;">Expected Cash in Drawer:</td>
        <td style="text-align: right; font-weight: 800; font-size: 13px;">= Rs. ${(report.expectedCashMinorUnits / 100).toFixed(2)}</td>
      </tr>
      ${
        report.closingCountedMinorUnits != null
          ? `
      <tr>
        <td>Actual Physical Cash Counted:</td>
        <td style="text-align: right; font-weight: 700;">Rs. ${(report.closingCountedMinorUnits / 100).toFixed(2)}</td>
      </tr>
      <tr style="background: ${variance === 0 ? '#ecfdf5' : '#fef2f2'}; font-weight: 700;">
        <td>Drawer Variance (Over / Short):</td>
        <td style="text-align: right; color: ${varianceColor};">${varianceText}</td>
      </tr>
      `
          : ''
      }
    </tbody>
  </table>

  <div class="section-title">Items & Products Sold During This Shift (${report.itemsSold.length} products, ${report.totalUnitsSold} units)</div>
  <table>
    <thead>
      <tr>
        <th>Product Name</th>
        <th>SKU</th>
        <th style="text-align: center;">Qty Sold</th>
        <th style="text-align: right;">Total Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? rows : '<tr><td colspan="4" style="text-align: center; color: #9ca3af; padding: 16px;">No products sold during this shift.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Bakery Store Management System · Automated Local-First Shift Audit
  </div>
</body>
</html>`;
}
