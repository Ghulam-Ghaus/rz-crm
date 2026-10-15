import { Result } from './common/result.js';
import { HealthCheckInput, HealthCheckResponse } from './health/health.schema.js';
import { Store, SystemInfoResponse, Setting } from './system/system.schema.js';
import { Category, CreateCategoryInput } from './catalog/categories.schema.js';
import { Unit, CreateUnitInput } from './catalog/units.schema.js';
import { ProductListItem, CreateProductInput, UpdateProductInput } from './catalog/products.schema.js';
import { BarcodeLookupInput, ResolvedBarcodeResult } from './catalog/barcodes.schema.js';
import {
  OpeningStockSession,
  ConfirmOpeningStockInput,
} from './inventory/opening-stock.schema.js';
import { Shift, OpenShiftInput, CloseShiftInput, ShiftReport } from './pos/shifts.schema.js';
import { CheckoutSaleInput, SaleReceipt, SaleSummary, RecordSalePaymentInput } from './pos/sales.schema.js';
import { GetProfitLossQuery, ProfitLossReport } from './pos/profit-loss.schema.js';
import {
  Supplier,
  CreateSupplierInput,
  SupplierBalanceSummary,
  SupplierPayment,
  CreateSupplierPaymentInput,
  SupplierLedgerResponse,
  PurchaseOrder,
  CreatePurchaseOrderInput,
  GoodsReceipt,
  PostGoodsReceiptInput,
  UpdateGoodsReceiptInput,
} from './purchasing/index.js';
import {
  Recipe,
  CreateRecipeInput,
  RecipeVersion,
  CreateRecipeVersionInput,
  ProductionRun,
  CreateProductionRunInput,
  UpdateProductionRunStatusInput,
  CompleteProductionRunInput,
} from './production/index.js';
import {
  Customer,
  CreateCustomerInput,
  CustomOrder,
  CreateCustomOrderInput,
  UpdateCustomOrderStatusInput,
  AddCustomOrderPaymentInput,
  HeldCart,
  CreateHeldCartInput,
} from './custom-orders/index.js';
import {
  BackupManifest,
  BackupStatus,
  CreateBackupInput,
  RestoreBackupInput,
  ExportReportInput,
  ExportReportResult,
} from './backup/index.js';
import {
  User,
  UserSession,
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  DeleteRoleInput,
} from './auth/auth.schema.js';
import {
  ExpenseCategory,
  CreateExpenseCategoryInput,
  Expense,
  CreateExpenseInput,
  ListExpensesQuery,
  StaffPayrollProfile,
  UpsertPayrollProfileInput,
  SalaryAdvance,
  CreateSalaryAdvanceInput,
  UpdateSalaryAdvanceInput,
  DeleteSalaryAdvanceInput,
  SalaryPayment,
  DisburseSalaryInput,
  MonthlyPayrollSheetResponse,
  EmployeeMonthlyStatementResponse,
  GetEmployeeStatementQuery,
} from './expenses/expenses.schema.js';

import {
  StockBalanceItem,
  GetStockBalancesQuery,
  StockMovementLogItem,
  StockLocationItem,
  TransferStockInput,
} from './inventory/stock-balance.schema.js';
import {
  SalesReturn,
  PostSalesReturnInput,
  PurchaseReturn,
  PostPurchaseReturnInput,
} from './returns/index.js';
import {
  Stakeholder,
  CreateStakeholderInput,
  UpdateStakeholderInput,
  UpdateStakeholderEquityInput,
  StakeholderTransaction,
  CreateStakeholderTxInput,
  FiscalPeriod,
  CreateFiscalPeriodInput,
  CloseFiscalPeriodInput,
  ProfitDistributionRun,
  CalculateDistributionInput,
  CreateDistributionRunInput,
  ApproveDistributionRunInput,
  PayoutDistributionRunInput,
  CompanyPnlSummary,
} from './stakeholders/index.js';

export const IPC_CHANNELS = {
  // Auth & Users
  AUTH_LOGIN: 'auth:login',
  AUTH_GET_SESSION: 'auth:get_session',
  USERS_LIST: 'users:list',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  ROLES_LIST: 'roles:list',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  HEALTH_CHECK: 'health:check',
  SYSTEM_INFO: 'system:info',
  SYSTEM_STORE_GET: 'system:store:get',
  SYSTEM_SETTINGS_GET: 'system:settings:get',
  SYSTEM_SETTINGS_SET: 'system:settings:set',

  // Catalog & Units
  CATALOG_CATEGORIES_LIST: 'catalog:categories:list',
  CATALOG_CATEGORIES_CREATE: 'catalog:categories:create',
  CATALOG_UNITS_LIST: 'catalog:units:list',
  CATALOG_UNITS_CREATE: 'catalog:units:create',
  CATALOG_PRODUCTS_LIST: 'catalog:products:list',
  CATALOG_PRODUCTS_CREATE: 'catalog:products:create',
  CATALOG_PRODUCTS_UPDATE: 'catalog:products:update',

  // Barcode
  BARCODE_RESOLVE: 'barcode:resolve',

  // Inventory & Opening stock
  INVENTORY_OPENING_STOCK_GET: 'inventory:opening_stock:get',
  INVENTORY_OPENING_STOCK_CONFIRM: 'inventory:opening_stock:confirm',
  INVENTORY_STOCK_BALANCES_GET: 'inventory:stock_balances:get',
  INVENTORY_MOVEMENTS_GET: 'inventory:movements:get',
  INVENTORY_STOCK_ADJUST: 'inventory:stock:adjust',
  INVENTORY_LOCATIONS_GET: 'inventory:locations:get',
  INVENTORY_TRANSFER_STOCK: 'inventory:transfer_stock',

  // POS & Shifts
  POS_SHIFT_GET_ACTIVE: 'pos:shift:get_active',
  POS_SHIFT_OPEN: 'pos:shift:open',
  POS_SHIFT_CLOSE: 'pos:shift:close',
  POS_SHIFT_LIST: 'pos:shift:list',
  POS_SHIFT_REPORT: 'pos:shift:report',
  POS_SHIFT_EXPORT_PDF: 'pos:shift:export_pdf',
  POS_SALE_CHECKOUT_CASH: 'pos:sale:checkout_cash',
  POS_SALE_RECORD_PAYMENT: 'pos:sale:record_payment',
  POS_SALE_RECENT_LIST: 'pos:sale:recent_list',
  POS_SALE_GET_RECEIPT: 'pos:sale:get_receipt',
  POS_PRINT_RECEIPT_SILENT: 'pos:print_receipt_silent',

  // Purchasing & Goods Receiving
  PURCHASING_SUPPLIER_LIST: 'purchasing:supplier:list',
  PURCHASING_SUPPLIER_CREATE: 'purchasing:supplier:create',
  PURCHASING_SUPPLIERS_BALANCES: 'purchasing:suppliers:balances',
  PURCHASING_SUPPLIERS_LEDGER: 'purchasing:suppliers:ledger',
  PURCHASING_SUPPLIERS_RECORD_PAYMENT: 'purchasing:suppliers:record_payment',
  PURCHASING_PO_LIST: 'purchasing:po:list',
  PURCHASING_PO_CREATE: 'purchasing:po:create',
  PURCHASING_PO_GET: 'purchasing:po:get',
  PURCHASING_PO_APPROVE: 'purchasing:po:approve',
  PURCHASING_GRN_LIST: 'purchasing:grn:list',
  PURCHASING_GRN_POST: 'purchasing:grn:post',
  PURCHASING_GRN_UPDATE: 'purchasing:grn:update',
  PURCHASING_GRN_GET: 'purchasing:grn:get',

  // Production & Recipes
  PRODUCTION_RECIPE_LIST: 'production:recipe:list',
  PRODUCTION_RECIPE_GET: 'production:recipe:get',
  PRODUCTION_RECIPE_CREATE: 'production:recipe:create',
  PRODUCTION_RECIPE_VERSION_CREATE: 'production:recipe:version:create',
  PRODUCTION_RUN_LIST: 'production:run:list',
  PRODUCTION_RUN_GET: 'production:run:get',
  PRODUCTION_RUN_CREATE: 'production:run:create',
  PRODUCTION_RUN_UPDATE_STATUS: 'production:run:update_status',
  PRODUCTION_RUN_COMPLETE: 'production:run:complete',

  // Custom Orders & Customers
  CUSTOM_ORDERS_CUSTOMER_SEARCH: 'custom_orders:customer:search',
  CUSTOM_ORDERS_CUSTOMER_CREATE: 'custom_orders:customer:create',
  CUSTOM_ORDERS_LIST: 'custom_orders:order:list',
  CUSTOM_ORDERS_GET: 'custom_orders:order:get',
  CUSTOM_ORDERS_CREATE: 'custom_orders:order:create',
  CUSTOM_ORDERS_UPDATE_STATUS: 'custom_orders:order:update_status',
  CUSTOM_ORDERS_RECORD_PAYMENT: 'custom_orders:order:record_payment',

  // Held Carts (POS)
  POS_HELD_CARTS_LIST: 'pos:held_carts:list',
  POS_HELD_CARTS_HOLD: 'pos:held_carts:hold',
  POS_HELD_CARTS_RESTORE: 'pos:held_carts:restore',
  POS_HELD_CARTS_DISCARD: 'pos:held_carts:discard',

  // Backup & Recovery
  BACKUP_LIST: 'backup:list',
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_GET_STATUS: 'backup:get_status',
  BACKUP_VERIFY: 'backup:verify',
  BACKUP_OPEN_FOLDER: 'backup:open_folder',

  // Expenses & Operating Costs
  EXPENSES_CATEGORIES_LIST: 'expenses:categories:list',
  EXPENSES_CATEGORIES_CREATE: 'expenses:categories:create',
  EXPENSES_LIST: 'expenses:list',
  EXPENSES_CREATE: 'expenses:create',
  EXPENSES_DELETE: 'expenses:delete',

  // Staff Payroll & Advances
  PAYROLL_PROFILES_LIST: 'payroll:profiles:list',
  PAYROLL_PROFILES_UPSERT: 'payroll:profiles:upsert',
  PAYROLL_ADVANCES_LIST: 'payroll:advances:list',
  PAYROLL_ADVANCES_CREATE: 'payroll:advances:create',
  PAYROLL_ADVANCES_UPDATE: 'payroll:advances:update',
  PAYROLL_ADVANCES_DELETE: 'payroll:advances:delete',
  PAYROLL_MONTHLY_SHEET: 'payroll:monthly_sheet',
  PAYROLL_SALARY_DISBURSE: 'payroll:salary:disburse',
  PAYROLL_PAYMENTS_LIST: 'payroll:payments:list',
  PAYROLL_EMPLOYEE_STATEMENT: 'payroll:employee_statement',

  // Returns & Commercial Reversals
  RETURNS_SALES_LIST: 'returns:sales:list',
  RETURNS_SALES_CREATE: 'returns:sales:create',
  RETURNS_SALES_GET: 'returns:sales:get',
  RETURNS_PURCHASE_LIST: 'returns:purchase:list',
  RETURNS_PURCHASE_CREATE: 'returns:purchase:create',
  RETURNS_PURCHASE_GET: 'returns:purchase:get',

  // Stakeholders, Equity & Capital Profit Distributions
  STAKEHOLDERS_LIST: 'stakeholders:list',
  STAKEHOLDERS_CREATE: 'stakeholders:create',
  STAKEHOLDERS_UPDATE: 'stakeholders:update',
  STAKEHOLDERS_EQUITY_UPDATE: 'stakeholders:equity:update',
  STAKEHOLDERS_TX_LIST: 'stakeholders:tx:list',
  STAKEHOLDERS_TX_CREATE: 'stakeholders:tx:create',
  STAKEHOLDERS_PERIODS_LIST: 'stakeholders:periods:list',
  STAKEHOLDERS_PERIODS_CREATE: 'stakeholders:periods:create',
  STAKEHOLDERS_PERIODS_CLOSE: 'stakeholders:periods:close',
  STAKEHOLDERS_DISTRIBUTIONS_CALCULATE: 'stakeholders:distributions:calculate',
  STAKEHOLDERS_DISTRIBUTIONS_CREATE: 'stakeholders:distributions:create',
  STAKEHOLDERS_DISTRIBUTIONS_LIST: 'stakeholders:distributions:list',
  STAKEHOLDERS_DISTRIBUTIONS_APPROVE: 'stakeholders:distributions:approve',
  STAKEHOLDERS_DISTRIBUTIONS_PAYOUT: 'stakeholders:distributions:payout',
  STAKEHOLDERS_PNL_SUMMARY: 'stakeholders:pnl:summary',

  // Reports & Diagnostics Export
  REPORTS_PROFIT_LOSS: 'reports:profit_loss',

  REPORTS_EXPORT_FILE: 'reports:export_file',
  DIAGNOSTICS_EXPORT_BUNDLE: 'diagnostics:export_bundle',
} as const;

export type IpcChannelType = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * Strongly-typed API interface exposed via Electron preload to the React renderer as window.bakery.
 */
export interface BakeryDesktopApi {
  health: {
    check(input?: HealthCheckInput): Promise<Result<HealthCheckResponse>>;
  };
  system: {
    getInfo(): Promise<Result<SystemInfoResponse>>;
    getActiveStore(): Promise<Result<Store | null>>;
    getSettings(storeId?: number): Promise<Result<Setting[]>>;
    setSetting(input: { key: string; value: string; storeId?: number; scope?: string; description?: string }): Promise<Result<Setting>>;
  };
  catalog: {
    getCategories(): Promise<Result<Category[]>>;
    createCategory(input: CreateCategoryInput): Promise<Result<Category>>;
    getUnits(): Promise<Result<Unit[]>>;
    createUnit(input: CreateUnitInput): Promise<Result<Unit>>;
    getProducts(): Promise<Result<ProductListItem[]>>;
    createProduct(input: CreateProductInput): Promise<Result<ProductListItem>>;
    updateProduct(input: UpdateProductInput): Promise<Result<ProductListItem>>;
  };
  barcode: {
    resolve(input: BarcodeLookupInput): Promise<Result<ResolvedBarcodeResult | null>>;
  };
  auth: {
    login(input: LoginInput): Promise<Result<UserSession>>;
    getSession(): Promise<Result<UserSession | null>>;
  };
  users: {
    list(storeId: number): Promise<Result<User[]>>;
    create(input: CreateUserInput): Promise<Result<User>>;
    update(input: UpdateUserInput): Promise<Result<User>>;
  };
  roles: {
    list(): Promise<Result<Role[]>>;
    create(input: CreateRoleInput): Promise<Result<Role>>;
    update(input: UpdateRoleInput): Promise<Result<Role>>;
    delete(input: DeleteRoleInput): Promise<Result<void>>;
  };
  inventory: {
    getOpeningStockSession(storeId: number): Promise<Result<OpeningStockSession | null>>;
    confirmOpeningStock(input: ConfirmOpeningStockInput): Promise<Result<OpeningStockSession>>;
    getStockBalances(query: GetStockBalancesQuery): Promise<Result<StockBalanceItem[]>>;
    getMovements(storeId: number, itemId?: number): Promise<Result<StockMovementLogItem[]>>;
    adjustStock(input: { storeId: number; itemId: number; newQuantity: number; reason: string; actorId?: number }): Promise<Result<{ success: boolean; variance: number }>>;
    getLocations(storeId: number): Promise<Result<StockLocationItem[]>>;
    transferStock(input: TransferStockInput): Promise<Result<{ success: boolean; movementIds: number[] }>>;
  };
  pos: {
    getActiveShift(storeId: number): Promise<Result<Shift | null>>;
    openShift(input: OpenShiftInput): Promise<Result<Shift>>;
    closeShift(input: CloseShiftInput): Promise<Result<Shift>>;
    getShifts(storeId: number): Promise<Result<Shift[]>>;
    getShiftReport(shiftId: number): Promise<Result<ShiftReport>>;
    exportShiftReportPdf(report: ShiftReport): Promise<Result<{ filePath: string }>>;
    checkoutCashSale(input: CheckoutSaleInput): Promise<Result<SaleReceipt>>;
    getRecentSales(storeId: number): Promise<Result<SaleSummary[]>>;
    getSaleReceipt(saleId: number): Promise<Result<SaleReceipt>>;
    recordSalePayment(input: RecordSalePaymentInput): Promise<Result<{ success: boolean; balanceDueMinorUnits: number; paymentStatus: string }>>;
    printReceiptSilent(input: { html: string; printerName?: string }): Promise<Result<{ printed: boolean; printerName: string }>>;
  };
  purchasing: {
    getSuppliers(storeId: number): Promise<Result<Supplier[]>>;
    createSupplier(input: CreateSupplierInput): Promise<Result<Supplier>>;
    getSupplierBalances(storeId: number): Promise<Result<SupplierBalanceSummary[]>>;
    getSupplierLedger(storeId: number, supplierId: number): Promise<Result<SupplierLedgerResponse>>;
    recordSupplierPayment(input: CreateSupplierPaymentInput): Promise<Result<SupplierPayment>>;
    getPurchaseOrders(storeId: number): Promise<Result<PurchaseOrder[]>>;
    getPurchaseOrder(poId: number): Promise<Result<PurchaseOrder>>;
    createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<Result<PurchaseOrder>>;
    approvePurchaseOrder(poId: number): Promise<Result<PurchaseOrder>>;
    getGoodsReceipts(storeId: number): Promise<Result<GoodsReceipt[]>>;
    getGoodsReceipt(grnId: number): Promise<Result<GoodsReceipt>>;
    postGoodsReceipt(input: PostGoodsReceiptInput): Promise<Result<GoodsReceipt>>;
    updateGoodsReceipt(input: UpdateGoodsReceiptInput): Promise<Result<GoodsReceipt>>;
  };
  production: {
    getRecipes(storeId: number): Promise<Result<Recipe[]>>;
    getRecipe(recipeId: number): Promise<Result<Recipe>>;
    createRecipe(input: CreateRecipeInput): Promise<Result<Recipe>>;
    createRecipeVersion(input: CreateRecipeVersionInput): Promise<Result<RecipeVersion>>;
    getProductionRuns(storeId: number): Promise<Result<ProductionRun[]>>;
    getProductionRun(runId: number): Promise<Result<ProductionRun>>;
    createProductionRun(input: CreateProductionRunInput): Promise<Result<ProductionRun>>;
    updateProductionRunStatus(input: UpdateProductionRunStatusInput): Promise<Result<ProductionRun>>;
    completeProductionRun(input: CompleteProductionRunInput): Promise<Result<ProductionRun>>;
  };
  customOrders: {
    searchCustomers(storeId: number, query: string): Promise<Result<Customer[]>>;
    createCustomer(input: CreateCustomerInput): Promise<Result<Customer>>;
    getCustomOrders(storeId: number, status?: string): Promise<Result<CustomOrder[]>>;
    getCustomOrder(orderId: number): Promise<Result<CustomOrder>>;
    createCustomOrder(input: CreateCustomOrderInput): Promise<Result<CustomOrder>>;
    updateOrderStatus(input: UpdateCustomOrderStatusInput): Promise<Result<CustomOrder>>;
    recordOrderPayment(input: AddCustomOrderPaymentInput): Promise<Result<CustomOrder>>;
  };
  heldCarts: {
    getHeldCarts(storeId: number): Promise<Result<HeldCart[]>>;
    holdCart(input: CreateHeldCartInput): Promise<Result<HeldCart>>;
    restoreHeldCart(cartId: number): Promise<Result<HeldCart>>;
    discardHeldCart(cartId: number): Promise<Result<void>>;
  };
  backup: {
    listBackups(): Promise<Result<BackupManifest[]>>;
    createBackup(input?: CreateBackupInput): Promise<Result<BackupManifest>>;
    restoreBackup(input: RestoreBackupInput): Promise<Result<{ restored: boolean; safetyBackupPath?: string }>>;
    getStatus(): Promise<Result<BackupStatus>>;
    verifyBackup(filename: string): Promise<Result<{ isValid: boolean; message: string }>>;
    openBackupFolder(): Promise<Result<void>>;
  };
  expenses: {
    listCategories(): Promise<Result<ExpenseCategory[]>>;
    createCategory(input: CreateExpenseCategoryInput): Promise<Result<ExpenseCategory>>;
    list(query: ListExpensesQuery): Promise<Result<Expense[]>>;
    create(input: CreateExpenseInput): Promise<Result<Expense>>;
    delete(id: number): Promise<Result<void>>;
  };
  payroll: {
    listProfiles(): Promise<Result<StaffPayrollProfile[]>>;
    upsertProfile(input: UpsertPayrollProfileInput): Promise<Result<StaffPayrollProfile>>;
    listAdvances(storeId: number, userId?: number): Promise<Result<SalaryAdvance[]>>;
    createAdvance(input: CreateSalaryAdvanceInput): Promise<Result<SalaryAdvance>>;
    updateAdvance(input: UpdateSalaryAdvanceInput): Promise<Result<SalaryAdvance>>;
    deleteAdvance(input: DeleteSalaryAdvanceInput): Promise<Result<void>>;
    getMonthlySheet(storeId: number, payrollMonth: string): Promise<Result<MonthlyPayrollSheetResponse>>;
    disburseSalary(input: DisburseSalaryInput): Promise<Result<SalaryPayment>>;
    listPayments(storeId: number, payrollMonth?: string): Promise<Result<SalaryPayment[]>>;
    getEmployeeStatement(query: GetEmployeeStatementQuery): Promise<Result<EmployeeMonthlyStatementResponse>>;
  };
  returns: {
    listSalesReturns(storeId: number): Promise<Result<SalesReturn[]>>;
    createSalesReturn(input: PostSalesReturnInput): Promise<Result<SalesReturn>>;
    getSalesReturn(id: number): Promise<Result<SalesReturn>>;
    listPurchaseReturns(storeId: number): Promise<Result<PurchaseReturn[]>>;
    createPurchaseReturn(input: PostPurchaseReturnInput): Promise<Result<PurchaseReturn>>;
    getPurchaseReturn(id: number): Promise<Result<PurchaseReturn>>;
  };
  stakeholders: {
    list(storeId: number): Promise<Result<Stakeholder[]>>;
    create(input: CreateStakeholderInput): Promise<Result<Stakeholder>>;
    update(input: UpdateStakeholderInput): Promise<Result<Stakeholder>>;
    updateEquity(input: UpdateStakeholderEquityInput): Promise<Result<void>>;
    listTransactions(storeId: number, stakeholderId?: number): Promise<Result<StakeholderTransaction[]>>;
    createTransaction(input: CreateStakeholderTxInput): Promise<Result<StakeholderTransaction>>;
    listPeriods(storeId: number): Promise<Result<FiscalPeriod[]>>;
    createPeriod(input: CreateFiscalPeriodInput): Promise<Result<FiscalPeriod>>;
    closePeriod(input: CloseFiscalPeriodInput): Promise<Result<FiscalPeriod>>;
    calculateDistribution(input: CalculateDistributionInput): Promise<Result<ProfitDistributionRun>>;
    createDistributionRun(input: CreateDistributionRunInput): Promise<Result<ProfitDistributionRun>>;
    listDistributionRuns(storeId: number, periodId?: number): Promise<Result<ProfitDistributionRun[]>>;
    approveDistributionRun(input: ApproveDistributionRunInput): Promise<Result<ProfitDistributionRun>>;
    payoutDistributionRun(input: PayoutDistributionRunInput): Promise<Result<ProfitDistributionRun>>;
    getPnlSummary(storeId: number, startDate?: string, endDate?: string): Promise<Result<CompanyPnlSummary>>;
  };
  reports: {

    getProfitLoss(query: GetProfitLossQuery): Promise<Result<ProfitLossReport>>;
    exportFile(input: ExportReportInput): Promise<Result<ExportReportResult>>;
    exportDiagnosticsBundle(): Promise<Result<ExportReportResult>>;
  };
}

