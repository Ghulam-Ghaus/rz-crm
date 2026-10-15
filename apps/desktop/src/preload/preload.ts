import { contextBridge, ipcRenderer } from 'electron';
import {
  BakeryDesktopApi,
  HealthCheckInput,
  HealthCheckResponse,
  IPC_CHANNELS,
  Result,
  Store,
  SystemInfoResponse,
  Setting,
  Category,
  CreateCategoryInput,
  Unit,
  CreateUnitInput,
  ProductListItem,
  CreateProductInput,
  UpdateProductInput,
  BarcodeLookupInput,
  ResolvedBarcodeResult,
  OpeningStockSession,
  ConfirmOpeningStockInput,
  Shift,
  OpenShiftInput,
  CloseShiftInput,
  ShiftReport,
  CheckoutSaleInput,
  SaleReceipt,
  SaleSummary,
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
  Recipe,
  CreateRecipeInput,
  RecipeVersion,
  CreateRecipeVersionInput,
  ProductionRun,
  CreateProductionRunInput,
  UpdateProductionRunStatusInput,
  CompleteProductionRunInput,
  Customer,
  CreateCustomerInput,
  CustomOrder,
  CreateCustomOrderInput,
  UpdateCustomOrderStatusInput,
  AddCustomOrderPaymentInput,
  HeldCart,
  CreateHeldCartInput,
  BackupManifest,
  CreateBackupInput,
  RestoreBackupInput,
  BackupStatus,
  ExportReportInput,
  ExportReportResult,
  GetProfitLossQuery,
  ProfitLossReport,
  User,
  UserSession,
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  Role,
  CreateRoleInput,
  UpdateRoleInput,
  DeleteRoleInput,
  StockBalanceItem,
  GetStockBalancesQuery,
  StockMovementLogItem,
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
} from '@rz-crm/contracts';


/**
 * Narrow, secure preload bridge.
 * Exposes strictly typed, allow-listed methods on `window.bakery`.
 */
const api: BakeryDesktopApi = {
  health: {
    async check(input?: HealthCheckInput): Promise<Result<HealthCheckResponse>> {
      return ipcRenderer.invoke(IPC_CHANNELS.HEALTH_CHECK, input);
    },
  },
  system: {
    async getInfo(): Promise<Result<SystemInfoResponse>> {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_INFO);
    },
    async getActiveStore(): Promise<Result<Store | null>> {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_STORE_GET);
    },
    async getSettings(storeId?: number): Promise<Result<Setting[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SETTINGS_GET, storeId);
    },
    async setSetting(input: { key: string; value: string; storeId?: number; scope?: string; description?: string; actorId?: number }): Promise<Result<Setting>> {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SETTINGS_SET, input);
    },
  },
  catalog: {
    async getCategories(): Promise<Result<Category[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_CATEGORIES_LIST);
    },
    async createCategory(input: CreateCategoryInput): Promise<Result<Category>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_CATEGORIES_CREATE, input);
    },
    async getUnits(): Promise<Result<Unit[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_UNITS_LIST);
    },
    async createUnit(input: CreateUnitInput): Promise<Result<Unit>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_UNITS_CREATE, input);
    },
    async getProducts(): Promise<Result<ProductListItem[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_PRODUCTS_LIST);
    },
    async createProduct(input: CreateProductInput): Promise<Result<ProductListItem>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_PRODUCTS_CREATE, input);
    },
    async updateProduct(input: UpdateProductInput): Promise<Result<ProductListItem>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CATALOG_PRODUCTS_UPDATE, input);
    },
  },
  barcode: {
    async resolve(input: BarcodeLookupInput): Promise<Result<ResolvedBarcodeResult | null>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BARCODE_RESOLVE, input);
    },
  },
  auth: {
    async login(input: LoginInput): Promise<Result<UserSession>> {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, input);
    },
    async getSession(): Promise<Result<UserSession | null>> {
      return ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION);
    },
  },
  users: {
    async list(storeId: number): Promise<Result<User[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.USERS_LIST, storeId);
    },
    async create(input: CreateUserInput): Promise<Result<User>> {
      return ipcRenderer.invoke(IPC_CHANNELS.USERS_CREATE, input);
    },
    async update(input: UpdateUserInput): Promise<Result<User>> {
      return ipcRenderer.invoke(IPC_CHANNELS.USERS_UPDATE, input);
    },
  },
  roles: {
    async list(): Promise<Result<Role[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.ROLES_LIST);
    },
    async create(input: CreateRoleInput): Promise<Result<Role>> {
      return ipcRenderer.invoke(IPC_CHANNELS.ROLES_CREATE, input);
    },
    async update(input: UpdateRoleInput): Promise<Result<Role>> {
      return ipcRenderer.invoke(IPC_CHANNELS.ROLES_UPDATE, input);
    },
    async delete(input: DeleteRoleInput): Promise<Result<void>> {
      return ipcRenderer.invoke(IPC_CHANNELS.ROLES_DELETE, input);
    },
  },
  inventory: {
    async getOpeningStockSession(storeId: number): Promise<Result<OpeningStockSession | null>> {
      return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_OPENING_STOCK_GET, storeId);
    },
    async confirmOpeningStock(input: ConfirmOpeningStockInput): Promise<Result<OpeningStockSession>> {
      return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_OPENING_STOCK_CONFIRM, input);
    },
    async getStockBalances(query: GetStockBalancesQuery): Promise<Result<StockBalanceItem[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_STOCK_BALANCES_GET, query);
    },
    async getMovements(storeId: number, itemId?: number): Promise<Result<StockMovementLogItem[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_MOVEMENTS_GET, storeId, itemId);
    },
    async adjustStock(input: { storeId: number; itemId: number; newQuantity: number; reason: string; actorId?: number }): Promise<Result<{ success: boolean; variance: number }>> {
      return ipcRenderer.invoke(IPC_CHANNELS.INVENTORY_STOCK_ADJUST, input);
    },
  },
  pos: {
    async getActiveShift(storeId: number): Promise<Result<Shift | null>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_GET_ACTIVE, storeId);
    },
    async openShift(input: OpenShiftInput): Promise<Result<Shift>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_OPEN, input);
    },
    async closeShift(input: CloseShiftInput): Promise<Result<Shift>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_CLOSE, input);
    },
    async getShifts(storeId: number): Promise<Result<Shift[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_LIST, storeId);
    },
    async getShiftReport(shiftId: number): Promise<Result<ShiftReport>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_REPORT, shiftId);
    },
    async exportShiftReportPdf(report: ShiftReport): Promise<Result<{ filePath: string }>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SHIFT_EXPORT_PDF, report);
    },
    async checkoutCashSale(input: CheckoutSaleInput): Promise<Result<SaleReceipt>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SALE_CHECKOUT_CASH, input);
    },
    async getRecentSales(storeId: number): Promise<Result<SaleSummary[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SALE_RECENT_LIST, storeId);
    },
    async getSaleReceipt(saleId: number): Promise<Result<SaleReceipt>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_SALE_GET_RECEIPT, saleId);
    },
    async printReceiptSilent(input: { html: string; printerName?: string }): Promise<Result<{ printed: boolean; printerName: string }>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_PRINT_RECEIPT_SILENT, input);
    },
  },
  purchasing: {
    async getSuppliers(storeId: number): Promise<Result<Supplier[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_SUPPLIER_LIST, storeId);
    },
    async createSupplier(input: CreateSupplierInput): Promise<Result<Supplier>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_SUPPLIER_CREATE, input);
    },
    async getSupplierBalances(storeId: number): Promise<Result<SupplierBalanceSummary[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_SUPPLIERS_BALANCES, storeId);
    },
    async getSupplierLedger(storeId: number, supplierId: number): Promise<Result<SupplierLedgerResponse>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_SUPPLIERS_LEDGER, { storeId, supplierId });
    },
    async recordSupplierPayment(input: CreateSupplierPaymentInput): Promise<Result<SupplierPayment>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_SUPPLIERS_RECORD_PAYMENT, input);
    },
    async getPurchaseOrders(storeId: number): Promise<Result<PurchaseOrder[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_PO_LIST, storeId);
    },
    async getPurchaseOrder(poId: number): Promise<Result<PurchaseOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_PO_GET, poId);
    },
    async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<Result<PurchaseOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_PO_CREATE, input);
    },
    async approvePurchaseOrder(poId: number): Promise<Result<PurchaseOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_PO_APPROVE, poId);
    },
    async getGoodsReceipts(storeId: number): Promise<Result<GoodsReceipt[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_GRN_LIST, storeId);
    },
    async getGoodsReceipt(grnId: number): Promise<Result<GoodsReceipt>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_GRN_GET, grnId);
    },
    async postGoodsReceipt(input: PostGoodsReceiptInput): Promise<Result<GoodsReceipt>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_GRN_POST, input);
    },
    async updateGoodsReceipt(input: UpdateGoodsReceiptInput): Promise<Result<GoodsReceipt>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PURCHASING_GRN_UPDATE, input);
    },
  },
  production: {
    async getRecipes(storeId: number): Promise<Result<Recipe[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RECIPE_LIST, storeId);
    },
    async getRecipe(recipeId: number): Promise<Result<Recipe>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RECIPE_GET, recipeId);
    },
    async createRecipe(input: CreateRecipeInput): Promise<Result<Recipe>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RECIPE_CREATE, input);
    },
    async createRecipeVersion(input: CreateRecipeVersionInput): Promise<Result<RecipeVersion>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RECIPE_VERSION_CREATE, input);
    },
    async getProductionRuns(storeId: number): Promise<Result<ProductionRun[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RUN_LIST, storeId);
    },
    async getProductionRun(runId: number): Promise<Result<ProductionRun>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RUN_GET, runId);
    },
    async createProductionRun(input: CreateProductionRunInput): Promise<Result<ProductionRun>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RUN_CREATE, input);
    },
    async updateProductionRunStatus(input: UpdateProductionRunStatusInput): Promise<Result<ProductionRun>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RUN_UPDATE_STATUS, input);
    },
    async completeProductionRun(input: CompleteProductionRunInput): Promise<Result<ProductionRun>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PRODUCTION_RUN_COMPLETE, input);
    },
  },
  customOrders: {
    async searchCustomers(storeId: number, query: string): Promise<Result<Customer[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_CUSTOMER_SEARCH, storeId, query);
    },
    async createCustomer(input: CreateCustomerInput): Promise<Result<Customer>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_CUSTOMER_CREATE, input);
    },
    async getCustomOrders(storeId: number, status?: string): Promise<Result<CustomOrder[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_LIST, storeId, status);
    },
    async getCustomOrder(orderId: number): Promise<Result<CustomOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_GET, orderId);
    },
    async createCustomOrder(input: CreateCustomOrderInput): Promise<Result<CustomOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_CREATE, input);
    },
    async updateOrderStatus(input: UpdateCustomOrderStatusInput): Promise<Result<CustomOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_UPDATE_STATUS, input);
    },
    async recordOrderPayment(input: AddCustomOrderPaymentInput): Promise<Result<CustomOrder>> {
      return ipcRenderer.invoke(IPC_CHANNELS.CUSTOM_ORDERS_RECORD_PAYMENT, input);
    },
  },
  heldCarts: {
    async getHeldCarts(storeId: number): Promise<Result<HeldCart[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_HELD_CARTS_LIST, storeId);
    },
    async holdCart(input: CreateHeldCartInput): Promise<Result<HeldCart>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_HELD_CARTS_HOLD, input);
    },
    async restoreHeldCart(cartId: number): Promise<Result<HeldCart>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_HELD_CARTS_RESTORE, cartId);
    },
    async discardHeldCart(cartId: number): Promise<Result<void>> {
      return ipcRenderer.invoke(IPC_CHANNELS.POS_HELD_CARTS_DISCARD, cartId);
    },
  },
  backup: {
    async listBackups(): Promise<Result<BackupManifest[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_LIST);
    },
    async createBackup(input?: CreateBackupInput): Promise<Result<BackupManifest>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_CREATE, input);
    },
    async restoreBackup(input: RestoreBackupInput): Promise<Result<{ restored: boolean; safetyBackupPath?: string }>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE, input);
    },
    async getStatus(): Promise<Result<BackupStatus>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_STATUS);
    },
    async verifyBackup(filename: string): Promise<Result<{ isValid: boolean; message: string }>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_VERIFY, filename);
    },
    async openBackupFolder(): Promise<Result<void>> {
      return ipcRenderer.invoke(IPC_CHANNELS.BACKUP_OPEN_FOLDER);
    },
  },
  expenses: {
    async listCategories(): Promise<Result<ExpenseCategory[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_CATEGORIES_LIST);
    },
    async createCategory(input: CreateExpenseCategoryInput): Promise<Result<ExpenseCategory>> {
      return ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_CATEGORIES_CREATE, input);
    },
    async list(query: ListExpensesQuery): Promise<Result<Expense[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_LIST, query);
    },
    async create(input: CreateExpenseInput): Promise<Result<Expense>> {
      return ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_CREATE, input);
    },
    async delete(id: number): Promise<Result<void>> {
      return ipcRenderer.invoke(IPC_CHANNELS.EXPENSES_DELETE, id);
    },
  },
  payroll: {
    async listProfiles(): Promise<Result<StaffPayrollProfile[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_PROFILES_LIST);
    },
    async upsertProfile(input: UpsertPayrollProfileInput): Promise<Result<StaffPayrollProfile>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_PROFILES_UPSERT, input);
    },
    async listAdvances(storeId: number, userId?: number): Promise<Result<SalaryAdvance[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_ADVANCES_LIST, { storeId, userId });
    },
    async createAdvance(input: CreateSalaryAdvanceInput): Promise<Result<SalaryAdvance>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_ADVANCES_CREATE, input);
    },
    async updateAdvance(input: UpdateSalaryAdvanceInput): Promise<Result<SalaryAdvance>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_ADVANCES_UPDATE, input);
    },
    async deleteAdvance(input: DeleteSalaryAdvanceInput): Promise<Result<void>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_ADVANCES_DELETE, input);
    },
    async getMonthlySheet(storeId: number, payrollMonth: string): Promise<Result<MonthlyPayrollSheetResponse>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_MONTHLY_SHEET, { storeId, payrollMonth });
    },
    async disburseSalary(input: DisburseSalaryInput): Promise<Result<SalaryPayment>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_SALARY_DISBURSE, input);
    },
    async listPayments(storeId: number, payrollMonth?: string): Promise<Result<SalaryPayment[]>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_PAYMENTS_LIST, { storeId, payrollMonth });
    },
    async getEmployeeStatement(query: GetEmployeeStatementQuery): Promise<Result<EmployeeMonthlyStatementResponse>> {
      return ipcRenderer.invoke(IPC_CHANNELS.PAYROLL_EMPLOYEE_STATEMENT, query);
    },
  },
  reports: {

    async getProfitLoss(query: GetProfitLossQuery): Promise<Result<ProfitLossReport>> {
      return ipcRenderer.invoke(IPC_CHANNELS.REPORTS_PROFIT_LOSS, query);
    },
    async exportFile(input: ExportReportInput): Promise<Result<ExportReportResult>> {
      return ipcRenderer.invoke(IPC_CHANNELS.REPORTS_EXPORT_FILE, input);
    },
    async exportDiagnosticsBundle(): Promise<Result<ExportReportResult>> {
      return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT_BUNDLE);
    },
  },
};


contextBridge.exposeInMainWorld('bakery', api);
