import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type {
  HealthCheckResponse,
  SystemInfoResponse,
  Category,
  Unit,
  ProductListItem,
  ResolvedBarcodeResult,
  Shift,
  SaleReceipt,
  SaleSummary,
  ShiftReport,
  Store,
  Supplier,
  SupplierBalanceSummary,
  SupplierLedgerResponse,
  PurchaseOrder,
  GoodsReceipt,
  Recipe,
  ProductionRun,
  Customer,
  CustomOrder,
  HeldCart,
  BackupManifest,
  BackupStatus,
  UserSession,
} from '@rz-crm/contracts';
import { LoginScreen } from './components/LoginScreen.js';
import { InventoryTab } from './components/InventoryTab.js';
import { UsersTab } from './components/UsersTab.js';
import { MezaanLogo } from './components/MezaanLogo.js';
import { GrnItemSearchPicker } from './components/GrnItemSearchPicker.js';
import { ProfitLossTab } from './components/ProfitLossTab.js';
import { ExpensesTab } from './components/ExpensesTab.js';
import { PosWeightAmountModal, PosWeightTarget } from './components/PosWeightAmountModal.js';

type ActiveTab = 'pos' | 'products' | 'categories' | 'purchasing' | 'production' | 'custom-orders' | 'inventory' | 'expenses' | 'scanner' | 'reports' | 'users' | 'diagnostics';

interface CartItem {
  variantId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinorUnits: number;
  baseUnitCode?: string;
}

function formatCartQuantity(qty: number, unitCode?: string): string {
  const isWeight = !unitCode || unitCode.toLowerCase() === 'kg' || unitCode.toLowerCase() === 'kilogram' || unitCode.toLowerCase() === 'g';
  if (isWeight && qty > 0 && qty < 1) {
    return `${Math.round(qty * 1000)}g`;
  }
  if (isWeight && qty >= 1 && !Number.isInteger(qty)) {
    return `${Number(qty.toFixed(3))}kg`;
  }
  return `${Number(qty.toFixed(3))}`;
}

function formatDateTime(isoString?: string | null): string {
  if (!isoString) return new Date().toLocaleString();
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

const AVAILABLE_NOTES = [100, 500, 1000, 5000] as const;

function getAvailableNoteButtons(totalDueRs: number): number[] {
  if (totalDueRs <= 0) return [];
  // Only return banknotes strictly greater than the total amount due
  return AVAILABLE_NOTES.filter((note) => note > totalDueRs);
}

function escapeReceiptHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generate80mmReceiptHtml(receipt: SaleReceipt, cashierName: string): string {
  const itemsRows = receipt.items
    .map((item) => {
      const unitPrice =
        item.quantity > 0 ? (item.totalMinorUnits / item.quantity / 100).toFixed(2) : '0.00';
      const itemTotal = (item.totalMinorUnits / 100).toFixed(2);
      let qtyDisplay = `${item.quantity}`;
      if (item.quantity > 0 && item.quantity < 1) {
        qtyDisplay = `${Math.round(item.quantity * 1000)}g`;
      } else if (item.quantity >= 1 && !Number.isInteger(item.quantity)) {
        qtyDisplay = `${Number(item.quantity.toFixed(3))}kg`;
      }
      return `
        <tr style="border-bottom: 1px dashed #444444;">
          <td style="width: 48%; padding: 4px 2px 4px 0; font-weight: 700; word-break: break-word; line-height: 1.25; vertical-align: top;">
            ${escapeReceiptHtml(item.productName)}
          </td>
          <td style="width: 14%; text-align: center; padding: 4px 0; font-weight: 700; vertical-align: top;">
            ${qtyDisplay}
          </td>
          <td style="width: 18%; text-align: right; padding: 4px 0; font-weight: 700; vertical-align: top;">
            ${unitPrice}
          </td>
          <td style="width: 20%; text-align: right; padding: 4px 0; font-weight: 800; vertical-align: top;">
            ${itemTotal}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${escapeReceiptHtml(receipt.invoiceNumber)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      padding: 0 1.5mm 4mm 1.5mm;
      background: #ffffff;
      color: #000000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11.5px;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .divider-solid {
      border-top: 2px solid #000000;
      margin: 6px 0;
    }
    .divider-dashed {
      border-top: 1.5px dashed #000000;
      margin: 6px 0;
    }
  </style>
</head>
<body>
  <div class="text-center">
    <!-- Header Logo -->
    <!-- MEZAAN_LOGO_PLACEHOLDER -->
    <div style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-size: 21px; font-weight: 800; margin: 2px 0; line-height: 1.35;">
      میزان سویٹس اینڈ بیکرز
    </div>
    <div style="font-size: 13px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">
      MEZAAN SWEETS &amp; BAKERS
    </div>
    <div style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-size: 11px; font-weight: 700; margin: 2px 0; line-height: 1.35;">
      تازہ اور معیاری مٹھائیوں کا مرکز
    </div>
    <div style="font-size: 11px; font-weight: 700; margin-top: 3px;">
      📍 چک نمبر 24 ج ب لاہوریاں
    </div>

    <!-- Contact Persons & Numbers (Right-aligned Urdu with distinct numbers) -->
    <div style="margin-top: 5px; font-size: 11px; line-height: 1.5; direction: rtl; text-align: right; border-top: 1px dashed #000000; border-bottom: 1px dashed #000000; padding: 4px 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-weight: 700;">چوہدری تبسم بگوایہ :</span>
        <span style="direction: ltr; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11.5px;">0343-7763677</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-weight: 700;">چوہدری عبدالرؤف بگوایہ :</span>
        <span style="direction: ltr; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11.5px;">0309-8809054</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-weight: 700;">چوہدری محسن بگوایہ :</span>
        <span style="direction: ltr; font-weight: 800; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11.5px;">0301-6008625</span>
      </div>
    </div>

    <!-- Prominent Invoice Metadata Box -->
    <div class="divider-dashed"></div>
    <div style="text-align: left; font-size: 12px; line-height: 1.4;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 900; font-size: 12.5px;">INVOICE: ${escapeReceiptHtml(receipt.invoiceNumber)}</span>
        <span style="font-weight: 700;">CASHIER: ${escapeReceiptHtml(cashierName)}</span>
      </div>
      <div style="font-weight: 700; font-size: 11.5px; margin-top: 2px;">
        DATE: ${escapeReceiptHtml(formatDateTime(receipt.createdAtUtc))}
      </div>
    </div>
    <div class="divider-solid"></div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; table-layout: fixed;">
      <thead>
        <tr style="border-bottom: 2px solid #000000;">
          <th style="width: 48%; text-align: left; padding: 4px 0; font-weight: 800; text-transform: uppercase;">Item</th>
          <th style="width: 14%; text-align: center; padding: 4px 0; font-weight: 800; text-transform: uppercase;">Qty</th>
          <th style="width: 18%; text-align: right; padding: 4px 0; font-weight: 800; text-transform: uppercase;">Price</th>
          <th style="width: 20%; text-align: right; padding: 4px 0; font-weight: 800; text-transform: uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="divider-dashed"></div>
    <div style="font-size: 12px; line-height: 1.45;">
      <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 3px;">
        <span>Subtotal:</span>
        <span>Rs. ${(receipt.subtotalMinorUnits / 100).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 18px; border-top: 2px solid #000000; border-bottom: 2px solid #000000; padding: 5px 0; margin: 6px 0; letter-spacing: 0.5px;">
        <span>TOTAL DUE:</span>
        <span>Rs. ${(receipt.totalMinorUnits / 100).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 700; margin: 3px 0;">
        <span>Amount Tendered:</span>
        <span>Rs. ${(receipt.amountTenderedMinorUnits / 100).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; margin-top: 4px;">
        <span>CHANGE DUE:</span>
        <span>Rs. ${(receipt.changeDueMinorUnits / 100).toFixed(2)}</span>
      </div>
    </div>

    <!-- Footer Greetings -->
    <div class="divider-dashed" style="margin-top: 10px;"></div>
    <div style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-size: 13px; font-weight: 800; margin-bottom: 2px;">
      "ذائقہ ہمارا، پہچان آپ کی"
    </div>
    <div style="font-family: 'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif; font-size: 10.5px; font-weight: 600; line-height: 1.35;">
      شادی بیاہ، سالگرہ اور دیگر تقریبات کیلئے مال آرڈر پر بھی تیار کیا جاتا ہے
    </div>
    <div style="font-size: 11px; font-weight: 800; margin-top: 6px;">
      Thank you for visiting Mezaan Sweets!
    </div>
  </div>
</body>
</html>`;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [store, setStore] = useState<Store | null>(null);
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('bakery_user_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const refreshSession = useCallback(async () => {
    if (!window.bakery?.auth?.getSession) return;
    try {
      const res = await window.bakery.auth.getSession();
      if (res.success && res.data) {
        const fresh = res.data;
        setSession((prev) => {
          if (!prev) return fresh;
          const permChanged =
            JSON.stringify(prev.permissions || []) !== JSON.stringify(fresh.permissions || []) ||
            prev.role !== fresh.role;
          if (permChanged) {
            localStorage.setItem('bakery_user_session', JSON.stringify(fresh));
            return fresh;
          }
          return prev;
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    const onFocus = () => {
      refreshSession();
    };
    window.addEventListener('focus', onFocus);
    const interval = setInterval(refreshSession, 2500);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [session?.id, refreshSession]);

  const hasPermission = useCallback(
    (tab: ActiveTab): boolean => {
      if (!session) return false;
      if (session.role === 'admin') return true;
      if (tab === 'users' || tab === 'diagnostics') return false; // Admin only

      if (session.permissions && session.permissions.length > 0) {
        return session.permissions.includes(tab);
      }

      switch (session.role) {
        case 'manager':
          return ['pos', 'inventory', 'products', 'purchasing', 'production', 'custom-orders', 'expenses', 'scanner', 'reports'].includes(tab);
        case 'cashier':
          return ['pos', 'inventory', 'custom-orders', 'scanner'].includes(tab);
        case 'purchaser':
          return ['purchasing', 'inventory'].includes(tab);
        case 'baker':
          return ['production', 'inventory'].includes(tab);
        default:
          return false;
      }
    },
    [session]
  );

  useEffect(() => {
    if (session && !hasPermission(activeTab)) {
      const allTabs: ActiveTab[] = [
        'pos',
        'purchasing',
        'custom-orders',
        'inventory',
        'production',
        'products',
        'expenses',
        'reports',
        'scanner',
      ];
      const firstAllowed = allTabs.find((t) => hasPermission(t));
      if (firstAllowed) {
        setActiveTab(firstAllowed);
      }
    }
  }, [session, activeTab, hasPermission]);

  // Diagnostics State
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(true);
  const [diagError, setDiagError] = useState<string | null>(null);

  // Categories & Units State
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Products State
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [pCode, setPCode] = useState<string>('');
  const [pName, setPName] = useState<string>('');
  const [pCatId, setPCatId] = useState<string>('');
  const [pSku, setPSku] = useState<string>('');
  const [pPrice, setPPrice] = useState<string>('150.00');
  const [pCostPrice, setPCostPrice] = useState<string>('100.00');
  const [pUnit, setPUnit] = useState<string>('pcs');
  const [pBarcode, setPBarcode] = useState<string>('');
  const [prodMsg, setProdMsg] = useState<string | null>(null);

  // Barcode Scanner State
  interface RecentScanItem {
    id: string;
    time: string;
    barcode: string;
    productName?: string;
    sku?: string;
    priceRs?: number;
    success: boolean;
    latencyMs: number;
  }
  const [scanQuery, setScanQuery] = useState<string>('');
  const [resolvedBarcode, setResolvedBarcode] = useState<ResolvedBarcodeResult | null>(null);
  const [scanLatency, setScanLatency] = useState<number | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // POS State
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState<string>('');
  const [posError, setPosError] = useState<string | null>(null);
  const [posCategoryFilter, setPosCategoryFilter] = useState<string>('ALL');
  const [weightModalTarget, setWeightModalTarget] = useState<PosWeightTarget | null>(null);

  // Modals State
  const [showOpenShiftModal, setShowOpenShiftModal] = useState<boolean>(false);
  const [openFloatRs, setOpenFloatRs] = useState<string>('1000');
  const [openCashier, setOpenCashier] = useState<string>('cashier-01');

  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [countedCashRs, setCountedCashRs] = useState<string>('');

  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [tenderedRs, setTenderedRs] = useState<string>('');
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState<boolean>(false);
  const [receiptPrintFeedback, setReceiptPrintFeedback] = useState<string | null>(null);

  // Reports, Shift History & Backup State
  const [reportsSubTab, setReportsSubTab] = useState<'sales' | 'shifts' | 'pnl' | 'backup'>('sales');
  const [recentSales, setRecentSales] = useState<SaleSummary[]>([]);
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [selectedShiftReport, setSelectedShiftReport] = useState<ShiftReport | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);

  // Backup & Restore State
  const [backupsList, setBackupsList] = useState<BackupManifest[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupLoading, setBackupLoading] = useState<boolean>(false);
  const [backupActionMsg, setBackupActionMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [newBackupNote, setNewBackupNote] = useState<string>('');
  const [showCreateBackupModal, setShowCreateBackupModal] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState<BackupManifest | null>(null);
  const [restoreConfirmChecked, setRestoreConfirmChecked] = useState<boolean>(false);
  const [restoringInProgress, setRestoringInProgress] = useState<boolean>(false);

  // Purchasing & GRN State
  const [purchasingSubTab, setPurchasingSubTab] = useState<'grn' | 'pos' | 'suppliers'>('grn');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [purchasingLoading, setPurchasingLoading] = useState<boolean>(false);
  const [purchasingMsg, setPurchasingMsg] = useState<string | null>(null);

  // Supplier Form State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [supCode, setSupCode] = useState<string>('');
  const [supName, setSupName] = useState<string>('');
  const [supContact, setSupContact] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supEmail, setSupEmail] = useState<string>('');
  const [supTaxNumber, setSupTaxNumber] = useState<string>('');
  const [supAddress, setSupAddress] = useState<string>('');
  const [supTerms, setSupTerms] = useState<string>('0');

  // PO Creation Form State
  const [showCreatePoModal, setShowCreatePoModal] = useState<boolean>(false);
  const [poSupplierId, setPoSupplierId] = useState<string>('');
  const [poVariantId, setPoVariantId] = useState<string>('');
  const [poQuantity, setPoQuantity] = useState<string>('10');
  const [poUnitCostRs, setPoUnitCostRs] = useState<string>('100.00');
  const [poDeliveryDate, setPoDeliveryDate] = useState<string>('');
  const [poNotes, setPoNotes] = useState<string>('');

  // Goods Receiving (GRN) Form State
  const [showCreateGrnModal, setShowCreateGrnModal] = useState<boolean>(false);
  const [editingGrnId, setEditingGrnId] = useState<number | null>(null);
  const [editingGrnNumber, setEditingGrnNumber] = useState<string>('');
  const [grnSupplierId, setGrnSupplierId] = useState<string>('');
  const [grnPoId, setGrnPoId] = useState<string>('');
  const [grnInvoiceRef, setGrnInvoiceRef] = useState<string>('');
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [grnPaymentAmountRs, setGrnPaymentAmountRs] = useState<string>('');
  const [grnPaymentMethod, setGrnPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE_WALLET' | 'ADVANCE_ADJUSTMENT'>('CASH');
  const [selectedGrnDetail, setSelectedGrnDetail] = useState<GoodsReceipt | null>(null);
  const [selectedPoDetail, setSelectedPoDetail] = useState<PurchaseOrder | null>(null);
  const [grnLines, setGrnLines] = useState<Array<{
    id: string;
    variantId: number;
    quantity: number;
    unitCode: string;
    unitCostRs: string;
    salePriceRs?: string;
    lotNumber: string;
    expiryDate: string;
  }>>([]);
  const [quickAddVariantId, setQuickAddVariantId] = useState<number>(0);
  const [quickAddQty, setQuickAddQty] = useState<number>(1);
  const [quickAddCostRs, setQuickAddCostRs] = useState<string>('');
  const [quickAddSalePriceRs, setQuickAddSalePriceRs] = useState<string>('');

  // Add & Edit Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductListItem | null>(null);
  const [editPriceRs, setEditPriceRs] = useState<string>('');
  const [editCostRs, setEditCostRs] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editCatId, setEditCatId] = useState<string>('');
  const [editBarcode, setEditBarcode] = useState<string>('');
  const [editProdMsg, setEditProdMsg] = useState<string | null>(null);

  // Quick Add Category Modal State
  const [showQuickCategoryModal, setShowQuickCategoryModal] = useState<boolean>(false);
  const [quickCatCode, setQuickCatCode] = useState<string>('');
  const [quickCatName, setQuickCatName] = useState<string>('');
  const [quickCatMsg, setQuickCatMsg] = useState<string | null>(null);

  // Quick Add Unit Modal State
  const [showQuickUnitModal, setShowQuickUnitModal] = useState<boolean>(false);
  const [quickUnitName, setQuickUnitName] = useState<string>('');
  const [quickUnitCode, setQuickUnitCode] = useState<string>('');
  const [quickUnitDimension, setQuickUnitDimension] = useState<'COUNT' | 'MASS' | 'VOLUME'>('COUNT');
  const [quickUnitMsg, setQuickUnitMsg] = useState<string | null>(null);
  const [quickUnitLoading, setQuickUnitLoading] = useState<boolean>(false);

  // GRN Inline Quick Add Product Modal State (for instant scanning/creation)
  const [showGrnQuickAddModal, setShowGrnQuickAddModal] = useState<boolean>(false);
  const [grnQuickCode, setGrnQuickCode] = useState<string>('');
  const [grnQuickSku, setGrnQuickSku] = useState<string>('');
  const [grnQuickName, setGrnQuickName] = useState<string>('');
  const [grnQuickBarcode, setGrnQuickBarcode] = useState<string>('');
  const [grnQuickCatId, setGrnQuickCatId] = useState<string>('');
  const [grnQuickCostRs, setGrnQuickCostRs] = useState<string>('100.00');
  const [grnQuickPriceRs, setGrnQuickPriceRs] = useState<string>('150.00');
  const [grnQuickUnit, setGrnQuickUnit] = useState<string>('pcs');
  const [grnQuickMsg, setGrnQuickMsg] = useState<string | null>(null);
  const [grnQuickLoading, setGrnQuickLoading] = useState<boolean>(false);
  const [grnQuickTargetLineId, setGrnQuickTargetLineId] = useState<string | null>(null);

  // Supplier Balances & Ledger State
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalanceSummary[]>([]);
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState<SupplierLedgerResponse | null>(null);
  const [showSupplierLedgerModal, setShowSupplierLedgerModal] = useState<boolean>(false);
  const [ledgerLoading, setLedgerLoading] = useState<boolean>(false);

  // Supplier Payment State
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<boolean>(false);
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | null>(null);
  const [paymentAmountRs, setPaymentAmountRs] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE_WALLET' | 'ADVANCE_ADJUSTMENT' | 'OTHER'>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Production & Recipes State
  const [productionSubTab, setProductionSubTab] = useState<'runs' | 'recipes'>('runs');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [productionLoading, setProductionLoading] = useState<boolean>(false);
  const [productionMsg, setProductionMsg] = useState<string | null>(null);

  // Recipe Creation Form State
  const [showCreateRecipeModal, setShowCreateRecipeModal] = useState<boolean>(false);
  const [rcpCode, setRcpCode] = useState<string>('');
  const [rcpName, setRcpName] = useState<string>('');
  const [rcpDescription, setRcpDescription] = useState<string>('');
  const [rcpOutputVariantId, setRcpOutputVariantId] = useState<string>('');
  const [rcpExpectedYield, setRcpExpectedYield] = useState<string>('12');
  const [rcpOutputUnit, setRcpOutputUnit] = useState<string>('pcs');
  const [rcpNotes, setRcpNotes] = useState<string>('');
  const [rcpItems, setRcpItems] = useState<Array<{ inputVariantId: string; quantity: string; unitCode: string; wastagePercent: string }>>([
    { inputVariantId: '', quantity: '500', unitCode: 'g', wastagePercent: '0' },
  ]);

  // Production Run Planning Form State
  const [showCreateRunModal, setShowCreateRunModal] = useState<boolean>(false);
  const [runRecipeId, setRunRecipeId] = useState<string>('');
  const [runBatchCount, setRunBatchCount] = useState<string>('1');
  const [runPlannedDate, setRunPlannedDate] = useState<string>('');
  const [runNotes, setRunNotes] = useState<string>('');

  // Complete Production Run Form State
  const [showCompleteRunModal, setShowCompleteRunModal] = useState<boolean>(false);
  const [completingRun, setCompletingRun] = useState<ProductionRun | null>(null);
  const [actualYieldQty, setActualYieldQty] = useState<string>('1');
  const [outputLotNumber, setOutputLotNumber] = useState<string>('');
  const [outputExpiryDate, setOutputExpiryDate] = useState<string>('');
  const [completionNotes, setCompletionNotes] = useState<string>('');

  // View Modals
  const [selectedRunDetail, setSelectedRunDetail] = useState<ProductionRun | null>(null);
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<Recipe | null>(null);

  // Custom Orders & Advance Bookings State
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [customOrdersFilter, setCustomOrdersFilter] = useState<'all' | 'today' | 'upcoming' | 'ready'>('all');
  const [customOrdersLoading, setCustomOrdersLoading] = useState<boolean>(false);
  const [customOrdersMsg, setCustomOrdersMsg] = useState<string | null>(null);

  // Customer Registry State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustEmail, setNewCustEmail] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');
  const [newCustNotes, setNewCustNotes] = useState<string>('');

  // Book Custom Order Form State
  const [showCreateOrderModal, setShowCreateOrderModal] = useState<boolean>(false);
  const [ordCustomerId, setOrdCustomerId] = useState<string>('');
  const [ordDueDate, setOrdDueDate] = useState<string>('');
  const [ordEventDate, setOrdEventDate] = useState<string>('');
  const [ordCakeFlavor, setOrdCakeFlavor] = useState<string>('Chocolate Fudge');
  const [ordCakeSize, setOrdCakeSize] = useState<string>('2 Lbs');
  const [ordCakeMessage, setOrdCakeMessage] = useState<string>('');
  const [ordDecorationNotes, setOrdDecorationNotes] = useState<string>('');
  const [ordAllergensNotes, setOrdAllergensNotes] = useState<string>('');
  const [ordTotalPriceRs, setOrdTotalPriceRs] = useState<string>('2500.00');
  const [ordDepositRs, setOrdDepositRs] = useState<string>('1000.00');
  const [ordDepositPaymentMethod, setOrdDepositPaymentMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');

  // Record Order Payment / Collect Balance State
  const [showOrderPaymentModal, setShowOrderPaymentModal] = useState<boolean>(false);
  const [paymentTargetOrder, setPaymentTargetOrder] = useState<CustomOrder | null>(null);
  const [orderPayAmountRs, setOrderPayAmountRs] = useState<string>('');
  const [orderPayMethod, setOrderPayMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');
  const [orderPayNotes, setOrderPayNotes] = useState<string>('');

  // View Order Details
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<CustomOrder | null>(null);

  // Held Carts (POS) State
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [showHeldCartsModal, setShowHeldCartsModal] = useState<boolean>(false);
  const [showHoldCartConfirmModal, setShowHoldCartConfirmModal] = useState<boolean>(false);
  const [holdCartNotes, setHoldCartNotes] = useState<string>('');
  const [holdCartCustomer, setHoldCartCustomer] = useState<string>('');

  // 1. Diagnostics & Store Probe
  const runDiagnostics = useCallback(async () => {
    setDiagLoading(true);
    setDiagError(null);
    try {
      if (!window.bakery) throw new Error('Preload bridge window.bakery is not available');

      const [healthResult, infoResult] = await Promise.all([
        window.bakery.health.check({ clientTimestamp: new Date().toISOString() }),
        window.bakery.system.getInfo(),
      ]);

      if (!healthResult.success) throw new Error(healthResult.error.message);
      if (!infoResult.success) throw new Error(infoResult.error.message);

      setHealth(healthResult.data);
      setSystemInfo(infoResult.data);
      if (infoResult.data.store) {
        setStore(infoResult.data.store);
      }
    } catch (err: unknown) {
      setDiagError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagLoading(false);
    }
  }, []);

  // 2. Load Active Shift
  const loadActiveShift = useCallback(async (storeId: number) => {
    try {
      if (!window.bakery) return;
      const res = await window.bakery.pos.getActiveShift(storeId);
      if (res.success) {
        setActiveShift(res.data);
      }
    } catch (err) {
      console.error('Failed to load active shift:', err);
    }
  }, []);

  // 3. Load Categories & Units
  const loadCategoriesAndUnits = useCallback(async () => {
    try {
      if (!window.bakery) return;
      const [catRes, unitRes] = await Promise.all([
        window.bakery.catalog.getCategories(),
        window.bakery.catalog.getUnits(),
      ]);

      if (catRes.success) setCategories(catRes.data);
      if (unitRes.success) setUnits(unitRes.data);
    } catch (err) {
      console.error('Failed to load categories/units:', err);
    }
  }, []);

  // 4. Load Products
  const loadProducts = useCallback(async () => {
    try {
      if (!window.bakery) return;
      const res = await window.bakery.catalog.getProducts();
      if (res.success) setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }, []);

  useEffect(() => {
    runDiagnostics();
    loadCategoriesAndUnits();
    loadProducts();

    const initStore = async () => {
      if (!window.bakery) return;
      const res = await window.bakery.system.getActiveStore();
      if (res.success && res.data) {
        setStore(res.data);
        loadActiveShift(res.data.id);
      }
    };
    initStore();
  }, [runDiagnostics, loadCategoriesAndUnits, loadProducts, loadActiveShift]);

  useEffect(() => {
    if (store) {
      loadActiveShift(store.id);
    }
  }, [store, loadActiveShift]);

  // Global Keyboard Shortcuts (Function Keys F1-F10)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setShowQuickCategoryModal(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        setShowQuickUnitModal(true);
      } else if (e.key === 'F1' && hasPermission('pos')) {
        e.preventDefault();
        setActiveTab('pos');
      } else if (e.key === 'F2' && hasPermission('inventory')) {
        e.preventDefault();
        setActiveTab('inventory');
      } else if (e.key === 'F3' && hasPermission('purchasing')) {
        e.preventDefault();
        setActiveTab('purchasing');
      } else if (e.key === 'F4' && hasPermission('custom-orders')) {
        e.preventDefault();
        setActiveTab('custom-orders');
      } else if (e.key === 'F5' && hasPermission('production')) {
        e.preventDefault();
        setActiveTab('production');
      } else if (e.key === 'F6' && hasPermission('products')) {
        e.preventDefault();
        setActiveTab('products');
      } else if (e.key === 'F7' && hasPermission('expenses')) {
        e.preventDefault();
        setActiveTab('expenses');
      } else if (e.key === 'F8' && hasPermission('reports')) {
        e.preventDefault();
        setActiveTab('reports');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPermission]);

  // Prevent mouse wheel scrolling from altering number inputs anywhere in the application
  useEffect(() => {
    const handleWheel = () => {
      const active = document.activeElement;
      if (active && (active as HTMLElement).tagName === 'INPUT' && (active as HTMLInputElement).type === 'number') {
        (active as HTMLInputElement).blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle Open Shift
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentStore = store;
    if (!currentStore && window.bakery) {
      const storeRes = await window.bakery.system.getActiveStore();
      if (storeRes.success && storeRes.data) {
        currentStore = storeRes.data;
        setStore(currentStore);
      }
    }
    if (!currentStore) {
      setPosError('Store is not configured. Please refresh or check diagnostics.');
      return;
    }

    const floatMinor = Math.round(parseFloat(openFloatRs || '0') * 100);
    const res = await window.bakery.pos.openShift({
      storeId: currentStore.id,
      cashierId: openCashier,
      openingFloatMinorUnits: floatMinor,
      notes: 'POS shift opening',
    });

    if (res.success) {
      setActiveShift(res.data);
      setShowOpenShiftModal(false);
      setPosError(null);
    } else {
      setPosError(`Open Shift Failed: ${res.error.message}`);
    }
  };

  // Handle Close Shift
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    const countedMinor = Math.round(parseFloat(countedCashRs || '0') * 100);
    const res = await window.bakery.pos.closeShift({
      shiftId: activeShift.id,
      countedCashMinorUnits: countedMinor,
      notes: 'End of shift drawer reconciliation',
    });

    if (res.success) {
      setActiveShift(null);
      setShowCloseShiftModal(false);
      setCart([]);
      setPosError(null);
      loadShiftsList();
    } else {
      setPosError(`Close Shift Failed: ${res.error.message}`);
    }
  };

  // 6. Reports & Shift History Loaders
  const loadRecentSales = useCallback(async () => {
    if (!store) return;
    setReportLoading(true);
    try {
      const res = await window.bakery.pos.getRecentSales(store.id);
      if (res.success) {
        setRecentSales(res.data);
      }
    } finally {
      setReportLoading(false);
    }
  }, [store]);

  const loadShiftsList = useCallback(async () => {
    if (!store) return;
    setReportLoading(true);
    try {
      const res = await window.bakery.pos.getShifts(store.id);
      if (res.success) {
        setShiftsList(res.data);
      }
    } finally {
      setReportLoading(false);
    }
  }, [store]);

  const handleReprintReceipt = async (saleId: number) => {
    setReportLoading(true);
    try {
      const res = await window.bakery.pos.getSaleReceipt(saleId);
      if (res.success) {
        setLastReceipt(res.data);
      } else {
        alert(res.error.message);
      }
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenShiftReport = async (shiftId: number) => {
    setReportLoading(true);
    try {
      const res = await window.bakery.pos.getShiftReport(shiftId);
      if (res.success) {
        setSelectedShiftReport(res.data);
      } else {
        alert(res.error.message);
      }
    } finally {
      setReportLoading(false);
    }
  };

  // Export Cashier Shift Summary to CSV (for Excel)
  const handleExportShiftReportCsv = (report: ShiftReport) => {
    const lines: string[] = [];
    lines.push('"CASHIER SHIFT SUMMARY REPORT"');
    lines.push(`"Store Name","${(report.storeName || 'Bakery Store').replace(/"/g, '""')}"`);
    lines.push(`"Shift Code","${(report.shiftCode || '#' + report.shiftId).replace(/"/g, '""')}"`);
    lines.push(`"Cashier ID","${report.cashierId}"`);
    lines.push(`"Status","${report.status.toUpperCase()}"`);
    lines.push(`"Opened At","${formatDateTime(report.openedAtUtc)}"`);
    lines.push(`"Closed At","${report.closedAtUtc ? formatDateTime(report.closedAtUtc) : 'Currently Active / Open'}"`);
    lines.push('');
    lines.push('"KEY PERFORMANCE INDICATORS"');
    lines.push('"Metric","Value"');
    lines.push(`"Total Cash Sales (PKR)","${(report.totalCashSalesMinorUnits / 100).toFixed(2)}"`);
    lines.push(`"Total Invoices / Transactions","${report.totalTransactions}"`);
    lines.push(`"Total Units Sold","${report.totalUnitsSold}"`);
    lines.push(
      `"Cash Drawer Variance (PKR)","${report.varianceMinorUnits != null ? (report.varianceMinorUnits / 100).toFixed(2) : 'Open Shift'
      }"`,
    );
    lines.push('');
    lines.push('"CASH DRAWER BALANCE RECONCILIATION"');
    lines.push('"Description","Amount (PKR)"');
    lines.push(`"Opening Float Cash","${(report.openingFloatMinorUnits / 100).toFixed(2)}"`);
    lines.push(`"(+) Cash Sales Collected","+${(report.totalCashSalesMinorUnits / 100).toFixed(2)}"`);
    lines.push(`"(=) Expected Cash in Drawer","${(report.expectedCashMinorUnits / 100).toFixed(2)}"`);
    lines.push(
      `"Physical Counted Cash","${report.closingCountedMinorUnits != null ? (report.closingCountedMinorUnits / 100).toFixed(2) : 'Pending Close'
      }"`,
    );
    lines.push(
      `"Drawer Variance (Over / Short)","${report.varianceMinorUnits != null ? (report.varianceMinorUnits / 100).toFixed(2) : 'Pending Close'
      }"`,
    );
    lines.push('');
    lines.push('"PRODUCT SALES BREAKDOWN"');
    lines.push('"Product Name","SKU","Quantity Sold","Total Revenue (PKR)"');
    for (const item of report.itemsSold) {
      lines.push(
        `"${item.productName.replace(/"/g, '""')}","${item.sku}","${item.quantitySold}","${(
          item.revenueMinorUnits / 100
        ).toFixed(2)}"`,
      );
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    const codeStr = (report.shiftCode || 'Shift-' + report.shiftId).replace(/[^a-zA-Z0-9-_]/g, '_');
    link.href = url;
    link.download = `Shift_Report_${codeStr}_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download / Export Shift Report as PDF via Native Electron PrintToPDF
  const handleExportShiftReportPdf = async (report: ShiftReport) => {
    setReportLoading(true);
    try {
      if (window.bakery?.pos?.exportShiftReportPdf) {
        const res = await window.bakery.pos.exportShiftReportPdf(report);
        if (res.success) {
          if (res.data.filePath) {
            // PDF generated, saved and opened
          }
        } else {
          alert(`PDF Export Failed: ${res.error.message}`);
        }
      } else {
        window.print();
      }
    } catch (err: unknown) {
      alert(`PDF Export Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setReportLoading(false);
    }
  };

  // Immediate Silent Print for 80mm Receipt to POS-80
  const handlePrintReceipt = async (receipt: SaleReceipt) => {
    setIsPrintingReceipt(true);
    setReceiptPrintFeedback('Sending...');
    try {
      const cashierName = receipt.cashierId || session?.displayName || 'Cashier';
      const html = generate80mmReceiptHtml(receipt, cashierName);

      if (window.bakery?.pos?.printReceiptSilent) {
        const res = await window.bakery.pos.printReceiptSilent({ html });
        if (res.success) {
          setReceiptPrintFeedback(`✅ Sent to ${res.data.printerName || 'POS-80'}!`);
          setTimeout(() => {
            setReceiptPrintFeedback(null);
            setLastReceipt(null);
          }, 500);
        } else {
          console.warn('Silent print fallback:', res.error);
          window.print();
          setLastReceipt(null);
        }
      } else {
        window.print();
        setLastReceipt(null);
      }
    } catch (err: unknown) {
      console.error('Print receipt error:', err);
      window.print();
      setLastReceipt(null);
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Keyboard shortcut listener when receipt print preview modal is open: Enter prints, Escape closes
  useEffect(() => {
    if (!lastReceipt) return;
    const handleReceiptKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (!isPrintingReceipt) {
          handlePrintReceipt(lastReceipt);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLastReceipt(null);
      }
    };
    window.addEventListener('keydown', handleReceiptKeyDown);
    return () => window.removeEventListener('keydown', handleReceiptKeyDown);
  }, [lastReceipt, isPrintingReceipt]);

  // Export All Invoices to CSV (for Excel)
  const handleExportSalesCsv = async () => {
    const filteredSales = recentSales.filter(
      (s) => !salesSearch || s.invoiceNumber.toLowerCase().includes(salesSearch.toLowerCase()),
    );
    const rows: string[][] = [
      ['Invoice #', 'Date & Time', 'Status', 'Items Count', 'Currency', 'Total Amount (Rs)'],
      ...filteredSales.map((s) => [
        s.invoiceNumber,
        formatDateTime(s.createdAtUtc),
        s.status.toUpperCase(),
        String(s.itemCount ?? 1),
        s.currencyCode,
        (s.totalMinorUnits / 100).toFixed(2),
      ]),
    ];
    const csvContent = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    if (window.bakery?.reports?.exportFile) {
      const res = await window.bakery.reports.exportFile({
        suggestedFilename: `Bakery_Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`,
        content: csvContent,
        format: 'csv',
        title: 'Export Sales Invoices to CSV (Excel)',
      });
      if (res.success && res.data.saved && res.data.filePath) {
        alert(`Sales invoices CSV exported successfully to:\n${res.data.filePath}`);
      }
    } else {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Bakery_Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Export Support Diagnostic Bundle
  const handleExportDiagnosticsBundle = async () => {
    if (!window.bakery?.reports?.exportDiagnosticsBundle) return;
    try {
      const res = await window.bakery.reports.exportDiagnosticsBundle();
      if (res.success && res.data.saved && res.data.filePath) {
        alert(`Support Diagnostic Bundle saved successfully to:\n${res.data.filePath}`);
      } else if (!res.success) {
        alert(`Failed to export support bundle: ${res.error.message}`);
      }
    } catch (err: unknown) {
      alert(`Export error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Load Database Backups & System Status
  const loadBackups = useCallback(async () => {
    if (!window.bakery?.backup) return;
    setBackupLoading(true);
    try {
      const [listRes, statusRes] = await Promise.all([
        window.bakery.backup.listBackups(),
        window.bakery.backup.getStatus(),
      ]);
      if (listRes.success) setBackupsList(listRes.data);
      if (statusRes.success) setBackupStatus(statusRes.data);
    } catch (err: unknown) {
      setBackupActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load backups',
      });
    } finally {
      setBackupLoading(false);
    }
  }, []);

  // Create On-Demand Database Backup Snapshot
  const handleCreateBackup = async () => {
    if (!window.bakery?.backup) return;
    setBackupLoading(true);
    setBackupActionMsg(null);
    try {
      const res = await window.bakery.backup.createBackup({
        notes: newBackupNote.trim() || undefined,
      });
      if (res.success) {
        setBackupActionMsg({
          type: 'ok',
          text: `Snapshot '${res.data.filename}' created successfully! Checksum verified.`,
        });
        setShowCreateBackupModal(false);
        setNewBackupNote('');
        await loadBackups();
      } else {
        setBackupActionMsg({ type: 'error', text: res.error.message });
      }
    } catch (err: unknown) {
      setBackupActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to create backup',
      });
    } finally {
      setBackupLoading(false);
    }
  };

  // Verify Backup Cryptographic Checksum & SQLite Integrity
  const handleVerifyBackup = async (filename: string) => {
    if (!window.bakery?.backup) return;
    setBackupActionMsg(null);
    try {
      const res = await window.bakery.backup.verifyBackup(filename);
      if (res.success) {
        if (res.data.isValid) {
          setBackupActionMsg({
            type: 'ok',
            text: `Integrity check PASSED for '${filename}': ${res.data.message}`,
          });
        } else {
          setBackupActionMsg({
            type: 'error',
            text: `Integrity check FAILED for '${filename}': ${res.data.message}`,
          });
        }
      } else {
        setBackupActionMsg({ type: 'error', text: res.error.message });
      }
    } catch (err: unknown) {
      setBackupActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Verification error',
      });
    }
  };

  // Restore Database from Snapshot with Pre-Restore Safety Copy
  const handleRestoreBackup = async () => {
    if (!window.bakery?.backup || !selectedBackupToRestore || !restoreConfirmChecked) return;
    setRestoringInProgress(true);
    setBackupActionMsg(null);
    try {
      const res = await window.bakery.backup.restoreBackup({
        filename: selectedBackupToRestore.filename,
        confirmRestore: true,
      });
      if (res.success) {
        setBackupActionMsg({
          type: 'ok',
          text: `Database successfully restored from snapshot '${selectedBackupToRestore.filename}'! Pre-restore safety copy saved to: ${res.data.safetyBackupPath || 'backups folder'}`,
        });
        setShowRestoreModal(false);
        setSelectedBackupToRestore(null);
        setRestoreConfirmChecked(false);
        // Refresh live data across application
        runDiagnostics();
        loadCategoriesAndUnits();
        loadProducts();
        if (store) {
          loadActiveShift(store.id);
          loadRecentSales();
          loadShiftsList();
        }
        await loadBackups();
      } else {
        setBackupActionMsg({ type: 'error', text: res.error.message });
      }
    } catch (err: unknown) {
      setBackupActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Restore error occurred',
      });
    } finally {
      setRestoringInProgress(false);
    }
  };

  // Open Native Windows Explorer Backups Folder
  const handleOpenBackupFolder = async () => {
    if (!window.bakery?.backup) return;
    try {
      await window.bakery.backup.openBackupFolder();
    } catch (err: unknown) {
      alert(`Could not open backup directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports') {
      if (store) {
        loadRecentSales();
        loadShiftsList();
      }
      loadBackups();
    }
  }, [activeTab, store, loadRecentSales, loadShiftsList, loadBackups]);

  // Purchasing Loaders
  const loadSuppliers = useCallback(async () => {
    if (!store || !window.bakery?.purchasing) return;
    try {
      const res = await window.bakery.purchasing.getSuppliers(store.id);
      if (res.success) setSuppliers(res.data);
      const bRes = await window.bakery.purchasing.getSupplierBalances(store.id);
      if (bRes.success) setSupplierBalances(bRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  const openSupplierLedger = async (supplierId: number) => {
    if (!store || !window.bakery?.purchasing) return;
    setLedgerLoading(true);
    setShowSupplierLedgerModal(true);
    try {
      const res = await window.bakery.purchasing.getSupplierLedger(store.id, supplierId);
      if (res.success) {
        setSelectedSupplierLedger(res.data);
      } else {
        alert(res.error.message);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setLedgerLoading(false);
    }
  };

  const openRecordPayment = (supplier: Supplier) => {
    setPaymentSupplier(supplier);
    setPaymentAmountRs('');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentNotes('');
    setShowRecordPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.purchasing || !paymentSupplier) return;
    const amt = Math.round(parseFloat(paymentAmountRs) * 100);
    if (isNaN(amt) || amt <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }
    setPurchasingLoading(true);
    try {
      const res = await window.bakery.purchasing.recordSupplierPayment({
        storeId: store.id,
        supplierId: paymentSupplier.id,
        amountMinorUnits: amt,
        paymentMethod,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      if (res.success) {
        setShowRecordPaymentModal(false);
        loadSuppliers();
        loadGoodsReceipts();
        if (showSupplierLedgerModal && selectedSupplierLedger?.supplier.id === paymentSupplier.id) {
          openSupplierLedger(paymentSupplier.id);
        }
      } else {
        alert(res.error.message);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPurchasingLoading(false);
    }
  };

  const loadPurchaseOrders = useCallback(async () => {
    if (!store || !window.bakery?.purchasing) return;
    try {
      const res = await window.bakery.purchasing.getPurchaseOrders(store.id);
      if (res.success) setPurchaseOrders(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  const loadGoodsReceipts = useCallback(async () => {
    if (!store || !window.bakery?.purchasing) return;
    try {
      const res = await window.bakery.purchasing.getGoodsReceipts(store.id);
      if (res.success) setGoodsReceipts(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  useEffect(() => {
    if (activeTab === 'purchasing' && store) {
      loadSuppliers();
      loadPurchaseOrders();
      loadGoodsReceipts();
    }
  }, [activeTab, store, loadSuppliers, loadPurchaseOrders, loadGoodsReceipts]);

  // Handle Add Supplier
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.purchasing) return;
    setPurchasingLoading(true);
    setPurchasingMsg(null);
    try {
      const res = await window.bakery.purchasing.createSupplier({
        storeId: store.id,
        code: supCode,
        name: supName,
        contactPerson: supContact || undefined,
        phone: supPhone || undefined,
        email: supEmail || undefined,
        taxNumber: supTaxNumber || undefined,
        address: supAddress || undefined,
        paymentTermsDays: parseInt(supTerms, 10) || 0,
      });
      if (res.success) {
        setPurchasingMsg(`✓ Supplier '${res.data.name}' registered successfully.`);
        setSupCode('');
        setSupName('');
        setSupContact('');
        setSupPhone('');
        setSupEmail('');
        setSupTaxNumber('');
        setSupAddress('');
        setSupTerms('0');
        setShowAddSupplierModal(false);
        loadSuppliers();
      } else {
        setPurchasingMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setPurchasingMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Handle Create PO
  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.purchasing) return;
    const supId = parseInt(poSupplierId, 10);
    const varId = parseInt(poVariantId, 10);
    const qty = parseInt(poQuantity, 10);
    const unitCost = Math.round(parseFloat(poUnitCostRs) * 100);

    if (!supId) {
      alert('Please select a supplier');
      return;
    }
    if (!varId) {
      alert('Please select a product item');
      return;
    }
    if (qty <= 0) {
      alert('Quantity must be greater than zero');
      return;
    }
    if (isNaN(unitCost) || unitCost <= 0) {
      alert('Unit cost must be valid');
      return;
    }

    const selectedProduct = products.find((p) => p.variantId === varId);
    const unitCode = selectedProduct?.baseUnitCode || 'pcs';

    setPurchasingLoading(true);
    setPurchasingMsg(null);
    try {
      const res = await window.bakery.purchasing.createPurchaseOrder({
        storeId: store.id,
        supplierId: supId,
        expectedDeliveryDateUtc: poDeliveryDate ? new Date(poDeliveryDate).toISOString() : undefined,
        notes: poNotes || undefined,
        lines: [
          {
            productVariantId: varId,
            orderedQuantity: qty,
            unitCode,
            unitCostMinorUnits: unitCost,
          },
        ],
      });
      if (res.success) {
        setPurchasingMsg(`✓ Purchase Order '${res.data.poNumber}' created in DRAFT status.`);
        setShowCreatePoModal(false);
        setPoVariantId('');
        setPoQuantity('10');
        setPoUnitCostRs('100.00');
        setPoDeliveryDate('');
        setPoNotes('');
        loadPurchaseOrders();
      } else {
        setPurchasingMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setPurchasingMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Handle Approve PO
  const handleApprovePo = async (poId: number) => {
    if (!window.bakery?.purchasing) return;
    setPurchasingLoading(true);
    setPurchasingMsg(null);
    try {
      const res = await window.bakery.purchasing.approvePurchaseOrder(poId);
      if (res.success) {
        setPurchasingMsg(`✓ Purchase Order '${res.data.poNumber}' is APPROVED and ready for receiving.`);
        loadPurchaseOrders();
      } else {
        setPurchasingMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setPurchasingMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Handle Post GRN (Goods Receiving Note)
  const handlePostGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.purchasing) return;
    let supId = parseInt(grnSupplierId, 10);
    if (grnSupplierId === 'walkin' || !supId) {
      if (grnSupplierId === 'walkin') {
        let walkinSup = suppliers.find((s) => s.code === 'WALK-IN');
        if (!walkinSup) {
          const createSupRes = await window.bakery.purchasing.createSupplier({
            storeId: store.id,
            code: 'WALK-IN',
            name: 'Direct / Walk-in Supplier',
            phone: '0300-0000000',
            address: 'Spot Cash Purchases',
            paymentTermsDays: 0,
          });
          if (createSupRes.success) {
            walkinSup = createSupRes.data;
          } else {
            alert(`Failed to initialize walk-in supplier: ${createSupRes.error.message}`);
            return;
          }
        }
        supId = walkinSup.id;
      } else {
        alert('Please select a supplier or choose Direct / Walk-in');
        return;
      }
    }
    const finalInvoiceRef = grnInvoiceRef.trim() || `WALK-IN-${Date.now()}`;
    if (grnLines.length === 0) {
      alert('Please add at least one line item to the Goods Receipt');
      return;
    }

    const parsedLines = [];
    for (let i = 0; i < grnLines.length; i++) {
      const line = grnLines[i]!;
      if (!line.variantId) {
        alert(`Line ${i + 1}: Please select a product item`);
        return;
      }
      if (line.quantity <= 0) {
        alert(`Line ${i + 1}: Quantity must be greater than zero`);
        return;
      }
      const unitCost = Math.round(parseFloat(line.unitCostRs) * 100);
      if (isNaN(unitCost) || unitCost <= 0) {
        alert(`Line ${i + 1}: Unit cost must be a valid positive amount`);
        return;
      }
      const selectedProduct = products.find((p) => p.variantId === line.variantId);
      const unitCode = selectedProduct?.baseUnitCode || line.unitCode || 'pcs';

      let poLineId: number | undefined;
      const poId = grnPoId ? parseInt(grnPoId, 10) : undefined;
      if (poId && selectedPoDetail?.lines) {
        const matchedLine = selectedPoDetail.lines.find((l) => l.productVariantId === line.variantId);
        if (matchedLine) poLineId = matchedLine.id;
      }

      const salePriceMinor = line.salePriceRs ? Math.round(parseFloat(line.salePriceRs) * 100) : undefined;
      parsedLines.push({
        poLineId,
        productVariantId: line.variantId,
        receivedQuantity: line.quantity,
        unitCode,
        unitCostMinorUnits: unitCost,
        newSalePriceMinorUnits: salePriceMinor && salePriceMinor > 0 ? salePriceMinor : undefined,
        lotNumber: line.lotNumber.trim() || undefined,
        expiryDateUtc: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
      });
    }

    setPurchasingLoading(true);
    setPurchasingMsg(null);
    try {
      let res;
      if (editingGrnId) {
        res = await window.bakery.purchasing.updateGoodsReceipt({
          grnId: editingGrnId,
          storeId: store.id,
          supplierId: supId,
          supplierInvoiceRef: finalInvoiceRef,
          notes: grnNotes || undefined,
          lines: parsedLines,
        });
      } else {
        const poId = grnPoId ? parseInt(grnPoId, 10) : undefined;
        res = await window.bakery.purchasing.postGoodsReceipt({
          storeId: store.id,
          supplierId: supId,
          purchaseOrderId: poId,
          supplierInvoiceRef: finalInvoiceRef,
          notes: grnNotes || undefined,
          lines: parsedLines,
        });
      }

      if (res.success) {
        if (editingGrnId) {
          setPurchasingMsg(
            `✓ Goods Receipt '${res.data.grnNumber}' updated. Stock and ledger reconciled successfully!`
          );
        } else {
          // Record exact payment amount to supplier ledger (0 = credit, partial, full, or advance)
          const totalInvoiceMinorUnits = parsedLines.reduce(
            (acc, l) => acc + l.receivedQuantity * l.unitCostMinorUnits,
            0
          );
          const paidMinorUnits = Math.round(parseFloat(grnPaymentAmountRs || '0') * 100);
          let paymentSummaryText = '';
          if (paidMinorUnits > 0) {
            const isFull = paidMinorUnits === totalInvoiceMinorUnits;
            const isOver = paidMinorUnits > totalInvoiceMinorUnits;
            const statusDesc = isFull ? ' (Full Settlement)' : isOver ? ' (Overpayment / Advance Credit)' : ' (Partial Payment)';
            const methodLabel =
              grnPaymentMethod === 'ADVANCE_ADJUSTMENT' ? 'Advance Credit Deduction' :
              grnPaymentMethod === 'BANK_TRANSFER' ? 'Bank Transfer' :
              grnPaymentMethod === 'CHEQUE' ? 'Cheque' :
              grnPaymentMethod === 'ONLINE_WALLET' ? 'Online Wallet' : 'Cash';
            await window.bakery.purchasing.recordSupplierPayment({
              storeId: store.id,
              supplierId: supId,
              paymentDateUtc: new Date().toISOString(),
              amountMinorUnits: paidMinorUnits,
              paymentMethod: grnPaymentMethod || 'CASH',
              reference: `PAY-${res.data.grnNumber}`,
              notes: `Settlement for GRN ${res.data.grnNumber} via ${methodLabel}${statusDesc}`,
            });
            paymentSummaryText = ` and settled Rs. ${(paidMinorUnits / 100).toFixed(2)} (${methodLabel})`;
          } else {
            paymentSummaryText = ' on full credit/udhar (ledger payable updated)';
          }

          setPurchasingMsg(
            `✓ Goods Receipt '${res.data.grnNumber}' posted. ${parsedLines.length} item(s) added to inventory${paymentSummaryText}!`
          );
        }

        setShowCreateGrnModal(false);
        setEditingGrnId(null);
        setEditingGrnNumber('');
        setGrnLines([]);
        setGrnInvoiceRef('');
        setGrnNotes('');
        setGrnPaymentAmountRs('');
        setQuickAddVariantId(0);
        setQuickAddQty(1);
        setQuickAddCostRs('');
        setQuickAddSalePriceRs('');
        setSelectedPoDetail(null);
        loadGoodsReceipts();
        loadPurchaseOrders();
        loadSuppliers();
        loadProducts();
      } else {
        setPurchasingMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setPurchasingMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Handle Opening an Unpaid GRN in Edit Mode
  const handleOpenEditGrn = async (grn: GoodsReceipt) => {
    if (!window.bakery?.purchasing) return;
    try {
      setPurchasingLoading(true);
      const res = await window.bakery.purchasing.getGoodsReceipt(grn.id);
      if (!res.success) {
        alert('Failed to load GRN details: ' + res.error.message);
        return;
      }
      const fullGrn = res.data;
      setEditingGrnId(fullGrn.id);
      setEditingGrnNumber(fullGrn.grnNumber);
      setGrnSupplierId(String(fullGrn.supplierId));
      setGrnInvoiceRef(fullGrn.supplierInvoiceRef);
      setGrnNotes(fullGrn.notes || '');
      setGrnPoId(fullGrn.purchaseOrderId ? String(fullGrn.purchaseOrderId) : '');
      setGrnPaymentAmountRs('0.00');

      if (fullGrn.lines && fullGrn.lines.length > 0) {
        setGrnLines(
          fullGrn.lines.map((l) => ({
            id: String(l.id || Math.random()),
            variantId: l.productVariantId,
            quantity: l.receivedQuantity,
            unitCode: l.unitCode,
            unitCostRs: (l.unitCostMinorUnits / 100).toFixed(2),
            salePriceRs: l.salePriceMinorUnits ? (l.salePriceMinorUnits / 100).toFixed(2) : '',
            lotNumber: l.lotNumber || '',
            expiryDate: l.expiryDateUtc ? l.expiryDateUtc.slice(0, 10) : '',
          }))
        );
      } else {
        setGrnLines([
          {
            id: '1',
            variantId: 0,
            quantity: 1,
            unitCode: 'pcs',
            unitCostRs: '',
            lotNumber: '',
            expiryDate: '',
          },
        ]);
      }
      setShowCreateGrnModal(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setPurchasingLoading(false);
    }
  };

  // Production Loaders & Handlers
  const loadRecipes = useCallback(async () => {
    if (!store || !window.bakery?.production) return;
    try {
      const res = await window.bakery.production.getRecipes(store.id);
      if (res.success) setRecipes(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  const loadProductionRuns = useCallback(async () => {
    if (!store || !window.bakery?.production) return;
    try {
      const res = await window.bakery.production.getProductionRuns(store.id);
      if (res.success) setProductionRuns(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  useEffect(() => {
    if (activeTab === 'production' && store) {
      loadRecipes();
      loadProductionRuns();
    }
  }, [activeTab, store, loadRecipes, loadProductionRuns]);

  // Handle Create Recipe
  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.production) return;

    const outVarId = parseInt(rcpOutputVariantId, 10);
    const expectedYield = parseInt(rcpExpectedYield, 10);

    if (!outVarId) {
      alert('Please select an output finished product');
      return;
    }
    if (expectedYield <= 0) {
      alert('Expected yield must be at least 1');
      return;
    }

    const validItems = rcpItems
      .filter((it) => it.inputVariantId && parseInt(it.inputVariantId, 10) > 0)
      .map((it) => ({
        inputVariantId: parseInt(it.inputVariantId, 10),
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        unitCode: it.unitCode || 'g',
        wastagePercent: Math.max(0, Math.min(100, parseInt(it.wastagePercent, 10) || 0)),
      }));

    if (validItems.length === 0) {
      alert('Please add at least one ingredient item');
      return;
    }

    setProductionLoading(true);
    setProductionMsg(null);
    try {
      const res = await window.bakery.production.createRecipe({
        code: rcpCode.trim() || undefined,
        name: rcpName.trim(),
        description: rcpDescription.trim() || undefined,
        outputVariantId: outVarId,
        expectedYieldQuantity: expectedYield,
        outputUnitCode: rcpOutputUnit || 'pcs',
        notes: rcpNotes.trim() || undefined,
        items: validItems,
      });

      if (res.success) {
        setProductionMsg(`✓ Recipe '${res.data.name}' (Version 1) created successfully.`);
        setShowCreateRecipeModal(false);
        setRcpCode('');
        setRcpName('');
        setRcpDescription('');
        setRcpOutputVariantId('');
        setRcpExpectedYield('12');
        setRcpOutputUnit('pcs');
        setRcpNotes('');
        setRcpItems([{ inputVariantId: '', quantity: '500', unitCode: 'g', wastagePercent: '0' }]);
        loadRecipes();
      } else {
        setProductionMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setProductionMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProductionLoading(false);
    }
  };

  // Handle Create Production Run
  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.production) return;

    const rId = parseInt(runRecipeId, 10);
    const batches = parseInt(runBatchCount, 10);

    if (!rId) {
      alert('Please select a recipe');
      return;
    }
    if (batches <= 0) {
      alert('Batch count must be at least 1');
      return;
    }

    setProductionLoading(true);
    setProductionMsg(null);
    try {
      const res = await window.bakery.production.createProductionRun({
        recipeId: rId,
        plannedBatchCount: batches,
        plannedDateUtc: runPlannedDate ? new Date(runPlannedDate).toISOString() : undefined,
        notes: runNotes.trim() || undefined,
      });

      if (res.success) {
        setProductionMsg(`✓ Production Run '${res.data.runNumber}' planned for ${res.data.plannedOutputQuantity} ${res.data.outputUnitCode}.`);
        setShowCreateRunModal(false);
        setRunRecipeId('');
        setRunBatchCount('1');
        setRunPlannedDate('');
        setRunNotes('');
        loadProductionRuns();
      } else {
        setProductionMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setProductionMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProductionLoading(false);
    }
  };

  // Handle Update Run Status
  const handleUpdateRunStatus = async (runId: number, status: 'RELEASED' | 'IN_PROGRESS' | 'CANCELLED') => {
    if (!window.bakery?.production) return;
    setProductionLoading(true);
    setProductionMsg(null);
    try {
      const res = await window.bakery.production.updateProductionRunStatus({
        runId,
        status,
      });
      if (res.success) {
        setProductionMsg(`✓ Production Run '${res.data.runNumber}' moved to ${status}.`);
        loadProductionRuns();
      } else {
        setProductionMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setProductionMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProductionLoading(false);
    }
  };

  // Handle Complete Run
  const handleCompleteRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingRun || !window.bakery?.production) return;

    const actualYield = parseInt(actualYieldQty, 10);
    if (actualYield <= 0) {
      alert('Actual yield must be greater than zero');
      return;
    }

    setProductionLoading(true);
    setProductionMsg(null);
    try {
      const res = await window.bakery.production.completeProductionRun({
        runId: completingRun.id,
        actualOutputQuantity: actualYield,
        outputLotNumber: outputLotNumber.trim() || undefined,
        outputExpiryDate: outputExpiryDate || undefined,
        notes: completionNotes.trim() || undefined,
      });

      if (res.success) {
        const variance = actualYield - completingRun.plannedOutputQuantity;
        const varianceMsg = variance === 0 ? 'Exact Yield (100%)' : variance > 0 ? `+${variance} Over Expected` : `${variance} Under Expected`;
        setProductionMsg(`✓ Run '${res.data.runNumber}' COMPLETED! ${actualYield} ${res.data.outputUnitCode} added to inventory. (${varianceMsg}). Raw materials deducted.`);
        setShowCompleteRunModal(false);
        setCompletingRun(null);
        setActualYieldQty('1');
        setOutputLotNumber('');
        setOutputExpiryDate('');
        setCompletionNotes('');
        loadProductionRuns();
        loadProducts();
      } else {
        setProductionMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setProductionMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProductionLoading(false);
    }
  };


  // Custom Orders & Held Carts Loaders and Handlers
  const loadCustomers = useCallback(async (q?: string) => {
    if (!store || !window.bakery?.customOrders) return;
    try {
      const res = await window.bakery.customOrders.searchCustomers(store.id, q ?? '');
      if (res.success) setCustomers(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  const loadCustomOrders = useCallback(async (statusFilter?: string) => {
    if (!store || !window.bakery?.customOrders) return;
    setCustomOrdersLoading(true);
    try {
      const res = await window.bakery.customOrders.getCustomOrders(store.id, statusFilter);
      if (res.success) setCustomOrders(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setCustomOrdersLoading(false);
    }
  }, [store]);

  const loadHeldCarts = useCallback(async () => {
    if (!store || !window.bakery?.heldCarts) return;
    try {
      const res = await window.bakery.heldCarts.getHeldCarts(store.id);
      if (res.success) setHeldCarts(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [store]);

  useEffect(() => {
    if (activeTab === 'custom-orders' && store) {
      loadCustomOrders();
      loadCustomers();
    }
    if (activeTab === 'pos' && store) {
      loadHeldCarts();
    }
    if (activeTab === 'products' || activeTab === 'pos') {
      loadProducts();
      loadCategoriesAndUnits();
    }
  }, [activeTab, store, loadCustomOrders, loadCustomers, loadHeldCarts, loadProducts, loadCategoriesAndUnits]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.customOrders) return;
    try {
      const res = await window.bakery.customOrders.createCustomer({
        storeId: store.id,
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        email: newCustEmail.trim() || undefined,
        address: newCustAddress.trim() || undefined,
        notes: newCustNotes.trim() || undefined,
      });
      if (res.success) {
        setCustomOrdersMsg(`✓ Customer '${res.data.name}' (${res.data.code}) registered.`);
        setShowCreateCustomerModal(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustEmail('');
        setNewCustAddress('');
        setNewCustNotes('');
        loadCustomers();
        setOrdCustomerId(String(res.data.id));
      } else {
        alert(`Failed to register customer: ${res.error.message}`);
      }
    } catch (err: unknown) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateCustomOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !window.bakery?.customOrders) return;

    const cId = parseInt(ordCustomerId, 10);
    if (!cId) {
      alert('Please select or register a customer for this order');
      return;
    }
    if (!ordDueDate) {
      alert('Please select the pickup / due date and time');
      return;
    }

    const totalMinor = Math.round(parseFloat(ordTotalPriceRs || '0') * 100);
    const depositMinor = Math.round(parseFloat(ordDepositRs || '0') * 100);

    if (totalMinor <= 0) {
      alert('Agreed total price must be greater than zero');
      return;
    }

    setCustomOrdersLoading(true);
    setCustomOrdersMsg(null);
    try {
      const res = await window.bakery.customOrders.createCustomOrder({
        storeId: store.id,
        customerId: cId,
        dueDateUtc: new Date(ordDueDate).toISOString(),
        eventDateUtc: ordEventDate ? new Date(ordEventDate).toISOString() : undefined,
        totalAmountMinorUnits: totalMinor,
        depositAmountMinorUnits: depositMinor,
        depositPaymentMethod: ordDepositPaymentMethod,
        shiftId: activeShift?.id,
        cashierId: activeShift?.cashierId || 'cashier-01',
        cakeFlavor: ordCakeFlavor.trim() || undefined,
        cakeSize: ordCakeSize.trim() || undefined,
        cakeMessage: ordCakeMessage.trim() || undefined,
        decorationNotes: ordDecorationNotes.trim() || undefined,
        allergensNotes: ordAllergensNotes.trim() || undefined,
      });

      if (res.success) {
        setCustomOrdersMsg(`✓ Custom Order '${res.data.orderNumber}' booked successfully! Balance Due: Rs. ${(res.data.balanceAmountMinorUnits / 100).toFixed(2)}`);
        setShowCreateOrderModal(false);
        setOrdCustomerId('');
        setOrdDueDate('');
        setOrdEventDate('');
        setOrdCakeMessage('');
        setOrdDecorationNotes('');
        setOrdAllergensNotes('');
        setOrdTotalPriceRs('2500.00');
        setOrdDepositRs('1000.00');
        loadCustomOrders();
        if (activeShift) loadActiveShift(store.id);
      } else {
        setCustomOrdersMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setCustomOrdersMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCustomOrdersLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: any) => {
    if (!window.bakery?.customOrders) return;
    setCustomOrdersLoading(true);
    try {
      const res = await window.bakery.customOrders.updateOrderStatus({ orderId, status });
      if (res.success) {
        setCustomOrdersMsg(`✓ Order '${res.data.orderNumber}' updated to ${status}.`);
        loadCustomOrders();
      } else {
        setCustomOrdersMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setCustomOrdersMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCustomOrdersLoading(false);
    }
  };

  const handleRecordOrderPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetOrder || !window.bakery?.customOrders) return;

    const payMinor = Math.round(parseFloat(orderPayAmountRs || '0') * 100);
    if (payMinor <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }

    setCustomOrdersLoading(true);
    try {
      const res = await window.bakery.customOrders.recordOrderPayment({
        orderId: paymentTargetOrder.id,
        paymentType: payMinor >= paymentTargetOrder.balanceAmountMinorUnits ? 'BALANCE' : 'DEPOSIT',
        paymentMethod: orderPayMethod,
        amountMinorUnits: payMinor,
        shiftId: activeShift?.id,
        cashierId: activeShift?.cashierId || 'cashier-01',
        referenceNotes: orderPayNotes.trim() || undefined,
      });

      if (res.success) {
        setCustomOrdersMsg(`✓ Payment of Rs. ${(payMinor / 100).toFixed(2)} recorded for Order '${res.data.orderNumber}'. Remaining Balance: Rs. ${(res.data.balanceAmountMinorUnits / 100).toFixed(2)}`);
        setShowOrderPaymentModal(false);
        setPaymentTargetOrder(null);
        setOrderPayAmountRs('');
        setOrderPayNotes('');
        loadCustomOrders();
        if (activeShift && store) loadActiveShift(store.id);
      } else {
        setCustomOrdersMsg(`Error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setCustomOrdersMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCustomOrdersLoading(false);
    }
  };

  const handleHoldCurrentCart = async () => {
    if (!store || !window.bakery?.heldCarts || cart.length === 0) return;
    try {
      const res = await window.bakery.heldCarts.holdCart({
        storeId: store.id,
        cashierId: activeShift?.cashierId || 'cashier-01',
        customerNameOrPhone: holdCartCustomer.trim() || undefined,
        cartJson: JSON.stringify(cart),
        itemCount: cart.reduce((acc, i) => acc + i.quantity, 0),
        subtotalMinorUnits: cartTotalMinor,
        notes: holdCartNotes.trim() || undefined,
      });

      if (res.success) {
        setCart([]);
        setHoldCartNotes('');
        setHoldCartCustomer('');
        setShowHoldCartConfirmModal(false);
        loadHeldCarts();
      } else {
        alert(`Failed to hold cart: ${res.error.message}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreHeldCart = async (heldCartId: number) => {
    if (!window.bakery?.heldCarts) return;
    if (cart.length > 0) {
      if (!confirm('You already have items in your current cart. Restoring this held cart will replace current cart. Proceed?')) {
        return;
      }
    }
    try {
      const res = await window.bakery.heldCarts.restoreHeldCart(heldCartId);
      if (res.success) {
        const items = JSON.parse(res.data.cartJson) as CartItem[];
        setCart(items);
        setShowHeldCartsModal(false);
        loadHeldCarts();
      } else {
        alert(`Failed to restore cart: ${res.error.message}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscardHeldCart = async (heldCartId: number) => {
    if (!window.bakery?.heldCarts) return;
    if (!confirm('Are you sure you want to discard this held cart?')) return;
    try {
      const res = await window.bakery.heldCarts.discardHeldCart(heldCartId);
      if (res.success) {
        loadHeldCarts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Cart operations
  const addToCart = (prod: ProductListItem) => {
    setPosError(null);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variantId === prod.variantId);
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx];
        if (existing) {
          next[idx] = { ...existing, quantity: existing.quantity + 1 };
        }
        return next;
      }
      return [
        ...prev,
        {
          variantId: prod.variantId,
          sku: prod.sku,
          name: prod.name,
          quantity: 1,
          unitPriceMinorUnits: prod.priceMinorUnits,
          baseUnitCode: prod.baseUnitCode,
        },
      ];
    });
  };

  const handleConfirmWeightModal = (target: PosWeightTarget, newQty: number) => {
    setPosError(null);
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.variantId === target.variantId);
      if (idx >= 0) {
        const next = [...prev];
        const existing = next[idx];
        if (existing) {
          next[idx] = { ...existing, quantity: newQty };
        }
        return next;
      }
      return [
        ...prev,
        {
          variantId: target.variantId,
          sku: target.sku,
          name: target.name,
          quantity: newQty,
          unitPriceMinorUnits: target.priceMinorUnits,
          baseUnitCode: target.baseUnitCode,
        },
      ];
    });
    setWeightModalTarget(null);
  };

  const updateQuantity = (variantId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.variantId === variantId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: Number(nextQty.toFixed(3)) } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const removeFromCart = (variantId: number) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const cartSubtotalMinor = cart.reduce(
    (acc, item) => acc + Math.round(item.quantity * item.unitPriceMinorUnits),
    0
  );
  const cartTotalMinor = cartSubtotalMinor; // Tax added in Phase 6

  // Handle Checkout Submit
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentStore = store;
    if (!currentStore && window.bakery) {
      const storeRes = await window.bakery.system.getActiveStore();
      if (storeRes.success && storeRes.data) {
        currentStore = storeRes.data;
        setStore(currentStore);
      }
    }
    if (!currentStore || !activeShift) return;
    const tenderMinor = Math.round(parseFloat(tenderedRs || '0') * 100);

    if (tenderMinor < cartTotalMinor) {
      setPosError(`Tendered amount (Rs. ${(tenderMinor / 100).toFixed(2)}) is less than total due.`);
      return;
    }

    const res = await window.bakery.pos.checkoutCashSale({
      storeId: currentStore.id,
      shiftId: activeShift.id,
      cashierId: activeShift.cashierId,
      items: cart.map((c) => ({
        variantId: c.variantId,
        quantity: c.quantity,
        unitPriceMinorUnits: c.unitPriceMinorUnits,
      })),
      amountTenderedMinorUnits: tenderMinor,
    });

    if (res.success) {
      setLastReceipt(res.data);
      setCart([]);
      setShowCheckoutModal(false);
      setTenderedRs('');
      setPosError(null);
      loadActiveShift(currentStore.id); // refresh drawer balance
    } else {
      setPosError(`Checkout Failed: ${res.error.message}`);
    }
  };


  // Handle Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdMsg(null);
    if (!pCode.trim() || !pName.trim() || !pSku.trim()) {
      setProdMsg('Error: Code, Name, and SKU are required');
      return;
    }

    const priceCents = Math.round(parseFloat(pPrice || '0') * 100);
    const costCents = Math.round(parseFloat(pCostPrice || '0') * 100);

    const res = await window.bakery.catalog.createProduct({
      code: pCode.trim().toUpperCase(),
      name: pName.trim(),
      categoryId: pCatId ? parseInt(pCatId, 10) : null,
      sku: pSku.trim().toUpperCase(),
      priceMinorUnits: priceCents,
      costMinorUnits: costCents,
      currencyCode: 'PKR',
      baseUnitCode: pUnit,
      barcode: pBarcode.trim() || undefined,
    });

    if (res.success) {
      setPCode('');
      setPName('');
      setPSku('');
      setPBarcode('');
      setPCostPrice('100.00');
      setPPrice('150.00');
      setProdMsg('Product created successfully');
      loadProducts();
      setTimeout(() => {
        setShowAddProductModal(false);
        setProdMsg(null);
      }, 600);
    } else {
      setProdMsg(`Error: ${res.error.message}`);
    }
  };

  // Handle Update Product (Buy/Sell Prices & Info)
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditProdMsg(null);

    const priceCents = Math.round(parseFloat(editPriceRs || '0') * 100);
    const costCents = Math.round(parseFloat(editCostRs || '0') * 100);

    const res = await window.bakery.catalog.updateProduct({
      id: editingProduct.id,
      variantId: editingProduct.variantId,
      name: editName.trim(),
      categoryId: editCatId ? parseInt(editCatId, 10) : null,
      priceMinorUnits: priceCents,
      costMinorUnits: costCents,
      barcode: editBarcode.trim() || null,
    });

    if (res.success) {
      setEditProdMsg('✓ Product prices and details updated successfully!');
      loadProducts();
      setTimeout(() => {
        setEditingProduct(null);
        setEditProdMsg(null);
      }, 700);
    } else {
      setEditProdMsg(`Error: ${res.error.message}`);
    }
  };

  // Handle Quick Add Category on the Fly
  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCatMsg(null);
    if (!quickCatName.trim()) {
      setQuickCatMsg('Category name is required');
      return;
    }

    const code = quickCatCode.trim()
      ? quickCatCode.trim().toUpperCase()
      : quickCatName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

    const res = await window.bakery.catalog.createCategory({
      code,
      name: quickCatName.trim(),
    });

    if (res.success) {
      await loadCategoriesAndUnits();
      setPCatId(String(res.data.id));
      setGrnQuickCatId(String(res.data.id));
      if (editingProduct) setEditCatId(String(res.data.id));
      setShowQuickCategoryModal(false);
      setQuickCatName('');
      setQuickCatCode('');
      setQuickCatMsg(null);
    } else {
      setQuickCatMsg(`Error: ${res.error.message}`);
    }
  };

  // Handle Quick Add Unit
  const handleQuickAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUnitName.trim()) {
      setQuickUnitMsg('Unit name is required');
      return;
    }
    const code = quickUnitCode.trim()
      ? quickUnitCode.trim().toLowerCase()
      : quickUnitName.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);

    if (!code) {
      setQuickUnitMsg('Unit code is required');
      return;
    }

    setQuickUnitLoading(true);
    setQuickUnitMsg(null);
    try {
      const res = await window.bakery.catalog.createUnit({
        name: quickUnitName.trim(),
        code,
        dimension: quickUnitDimension,
        precision: quickUnitDimension === 'MASS' ? 2 : 0,
        isBase: false,
      });

      if (res.success) {
        await loadCategoriesAndUnits();
        if (res.data?.code) {
          setPUnit(res.data.code);
          setGrnQuickUnit(res.data.code);
        }
        setShowQuickUnitModal(false);
        setQuickUnitName('');
        setQuickUnitCode('');
        setQuickUnitDimension('COUNT');
      } else {
        setQuickUnitMsg(res.error.message);
      }
    } catch (err: unknown) {
      setQuickUnitMsg(err instanceof Error ? err.message : 'Error creating unit');
    } finally {
      setQuickUnitLoading(false);
    }
  };

  // Helper to determine if a string is a barcode or serial number vs a product name
  const isBarcodeString = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed) return false;
    // 1. Pure numeric barcode (e.g. 890123456789, 4-30 digits)
    if (/^[0-9]{4,30}$/.test(trimmed)) return true;
    // 2. Starts with standard barcode / serial prefixes (e.g. SN:202508060091, SN-..., BAR:, SKU:, LOT:, CODE:, ITEM:)
    if (/^(SN|BAR|SKU|LOT|REF|CODE|ITEM|SER|TAG)[:\-_]?[0-9A-Za-z]+/i.test(trimmed)) return true;
    // 3. Single code token without spaces that contains at least 3 digits and standard code chars
    if (!/\s/.test(trimmed) && /[0-9]{3,}/.test(trimmed) && /^[A-Za-z0-9_\-:\/.]{4,35}$/.test(trimmed)) {
      return true;
    }
    return false;
  };

  // Handle Opening Inline Quick Add Product Modal from GRN
  const handleOpenGrnQuickAdd = (rawQuery: string, targetLineId?: string) => {
    const trimmed = rawQuery.trim();
    const barcodeMatch = isBarcodeString(trimmed);

    // Clean code & SKU generation
    const sanitizedCodePart = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
    const codeGen = barcodeMatch
      ? `P-${sanitizedCodePart || Date.now().toString().slice(-6).toUpperCase()}`
      : `P-${Date.now().toString().slice(-6).toUpperCase()}`;

    const sanitizedSkuPart = trimmed.replace(/[^A-Za-z0-9]/g, '-').toUpperCase();
    const skuGen = barcodeMatch
      ? `SKU-${sanitizedSkuPart}`
      : `SKU-${Date.now().toString().slice(-6).toUpperCase()}`;

    setGrnQuickCode(codeGen);
    setGrnQuickSku(skuGen);

    if (barcodeMatch) {
      setGrnQuickBarcode(trimmed);
      setGrnQuickName('');
    } else {
      setGrnQuickName(trimmed);
      setGrnQuickBarcode('');
    }
    setGrnQuickCatId(categories.length > 0 ? String(categories[0].id) : '');
    setGrnQuickCostRs(quickAddCostRs || '100.00');
    setGrnQuickPriceRs(quickAddSalePriceRs || '150.00');
    setGrnQuickUnit('pcs');
    setGrnQuickMsg(null);
    setGrnQuickTargetLineId(targetLineId || null);
    setShowGrnQuickAddModal(true);
  };

  // Handle Saving New Product from GRN Quick Add Modal
  const handleSaveGrnQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnQuickCode.trim() || !grnQuickName.trim() || !grnQuickSku.trim()) {
      setGrnQuickMsg('Product Code, Name, and SKU are required');
      return;
    }

    const priceCents = Math.round((parseFloat(grnQuickPriceRs) || 0) * 100);
    const costCents = Math.round((parseFloat(grnQuickCostRs) || 0) * 100);

    setGrnQuickLoading(true);
    setGrnQuickMsg(null);

    try {
      const res = await window.bakery.catalog.createProduct({
        code: grnQuickCode.trim().toUpperCase(),
        name: grnQuickName.trim(),
        categoryId: grnQuickCatId ? parseInt(grnQuickCatId, 10) : null,
        sku: grnQuickSku.trim().toUpperCase(),
        priceMinorUnits: priceCents,
        costMinorUnits: costCents,
        currencyCode: 'PKR',
        baseUnitCode: grnQuickUnit || 'pcs',
        barcode: grnQuickBarcode.trim() || undefined,
      });

      if (res.success) {
        const newProd = res.data;
        await loadProducts();

        const costStr = (costCents / 100).toFixed(2);
        const priceStr = (priceCents / 100).toFixed(2);

        if (grnQuickTargetLineId) {
          // If launched from an existing line in GRN table
          setGrnLines((prev) =>
            prev.map((l) => {
              if (l.id !== grnQuickTargetLineId) return l;
              return {
                ...l,
                variantId: newProd.variantId,
                unitCode: newProd.baseUnitCode || 'pcs',
                unitCostRs: costStr,
                salePriceRs: priceStr,
              };
            })
          );
        } else {
          // Launched from Quick Add Item Bar - append to GRN lines
          setGrnLines((prev) => {
            const newLine = {
              id: String(Date.now()),
              variantId: newProd.variantId,
              quantity: quickAddQty || 1,
              unitCode: newProd.baseUnitCode || 'pcs',
              unitCostRs: costStr,
              salePriceRs: priceStr,
              lotNumber: '',
              expiryDate: '',
            };
            if (prev.length === 1 && (!prev[0]?.variantId || prev[0].variantId === 0)) {
              return [newLine];
            }
            return [...prev, newLine];
          });
          // Reset quick add item bar
          setQuickAddVariantId(0);
          setQuickAddQty(1);
          setQuickAddCostRs('');
          setQuickAddSalePriceRs('');
        }

        setShowGrnQuickAddModal(false);
        setGrnQuickName('');
        setGrnQuickBarcode('');
        setGrnQuickTargetLineId(null);
      } else {
        setGrnQuickMsg(res.error.message || 'Failed to create product');
      }
    } catch (err: unknown) {
      setGrnQuickMsg(err instanceof Error ? err.message : 'Error creating product');
    } finally {
      setGrnQuickLoading(false);
    }
  };

  // Handle Barcode Scan / Lookup
  const handleBarcodeLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScanMsg(null);
    setResolvedBarcode(null);
    const val = scanQuery.trim();
    if (!val) return;

    const start = performance.now();
    const res = await window.bakery.barcode.resolve({ barcodeValue: val });
    const latency = Math.round((performance.now() - start) * 100) / 100;
    setScanLatency(latency);

    const nowStr = new Date().toLocaleTimeString();
    if (res.success && res.data) {
      const resData = res.data;
      setResolvedBarcode(resData);
      setRecentScans((prev) => [
        {
          id: Math.random().toString(36).slice(2, 9),
          time: nowStr,
          barcode: val,
          productName: resData.product.name,
          sku: resData.variant.sku,
          priceRs: resData.variant.priceMinorUnits / 100,
          success: true,
          latencyMs: latency,
        },
        ...prev.slice(0, 8),
      ]);
    } else {
      setScanMsg(`Barcode '${val}' not found in catalog.`);
      setRecentScans((prev) => [
        {
          id: Math.random().toString(36).slice(2, 9),
          time: nowStr,
          barcode: val,
          success: false,
          latencyMs: latency,
        },
        ...prev.slice(0, 8),
      ]);
    }
    setScanQuery('');
    setTimeout(() => scanInputRef.current?.focus(), 10);
  };

  useEffect(() => {
    if (activeTab === 'scanner') {
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  }, [activeTab]);

  const isHealthy = health?.status === 'ok';

  const posCategories = useMemo<Array<{ id: string; name: string }>>(() => {
    const list: Array<{ id: string; name: string }> = [{ id: 'ALL', name: 'All Items' }];
    const categoryCounts = new Map<string, number>();

    for (const p of products) {
      if (p.categoryName) {
        categoryCounts.set(p.categoryName, (categoryCounts.get(p.categoryName) || 0) + 1);
      }
    }

    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    // Show only top 5 categories
    for (const name of sortedCategories.slice(0, 5)) {
      list.push({ id: name, name });
    }

    if (list.length === 1) {
      for (const c of categories.slice(0, 5)) {
        list.push({ id: c.name, name: c.name });
      }
    }

    return list;
  }, [categories, products]);

  const hasSearchQuery = posSearch.trim().length > 0;
  const filteredPosProducts = useMemo<ProductListItem[]>(() => {
    const matched = products.filter((p: ProductListItem) => {
      if (hasSearchQuery) {
        const q = posSearch.toLowerCase();
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }
      if (posCategoryFilter !== 'ALL') {
        const matchesCat =
          p.categoryName === posCategoryFilter ||
          String(p.categoryId) === posCategoryFilter;
        if (!matchesCat) return false;
      }
      return true;
    });

    // When searching show matching items (up to 10); when browsing show strictly top 5 selling items
    return hasSearchQuery ? matched.slice(0, 10) : matched.slice(0, 5);
  }, [products, posSearch, hasSearchQuery, posCategoryFilter]);

  const handlePosSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && posSearch.trim()) {
      const trimmed = posSearch.trim();
      const lower = trimmed.toLowerCase();
      const exactBarcode = products.find((p) => p.barcode && p.barcode.toLowerCase() === lower);
      if (exactBarcode) {
        addToCart(exactBarcode);
        setPosSearch('');
        return;
      }
      const exactSku = products.find((p) => p.sku.toLowerCase() === lower);
      if (exactSku) {
        addToCart(exactSku);
        setPosSearch('');
        return;
      }
      if (filteredPosProducts.length === 1 && filteredPosProducts[0]) {
        addToCart(filteredPosProducts[0]);
        setPosSearch('');
        return;
      }

      // Backend Barcode Resolver Fallback (handles variants, external supplier codes)
      try {
        const res = await window.bakery.barcode.resolve({ barcodeValue: trimmed });
        if (res.success && res.data) {
          const resolved = res.data;
          const matchedProd = products.find((p) => p.variantId === resolved.variant.id || p.id === resolved.product.id);
          if (matchedProd) {
            addToCart(matchedProd);
            setPosSearch('');
            return;
          }
          addToCart({
            id: resolved.product.id,
            code: resolved.product.code || `PROD-${resolved.product.id}`,
            name: resolved.product.name,
            variantId: resolved.variant.id,
            sku: resolved.variant.sku,
            priceMinorUnits: resolved.variant.priceMinorUnits,
            costMinorUnits: 0,
            currencyCode: 'PKR',
            baseUnitCode: resolved.baseUnitCode || 'pcs',
            isActive: true,
            barcode: resolved.barcodeValue,
          });
          setPosSearch('');
          return;
        }
      } catch (err) {
        console.error('Barcode resolution error in POS:', err);
      }
    }
  };

  if (!session) {
    return (
      <LoginScreen
        storeName={store?.name}
        onLoginSuccess={(s) => {
          setSession(s);
          localStorage.setItem('bakery_user_session', JSON.stringify(s));
          if (s.role === 'cashier') {
            setActiveTab('pos');
          } else if (s.role === 'purchaser') {
            setActiveTab('purchasing');
          } else if (s.role === 'baker') {
            setActiveTab('production');
          } else {
            setActiveTab('pos');
          }
        }}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Left Sidebar Menu */}
      <aside className="app-sidebar no-print">
        {/* Brand Header */}
        <div className="sidebar-header" style={{ padding: '16px 14px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #2d180c' }}>
          <MezaanLogo size={48} theme="dark" />
          <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
            <div
              style={{
                fontFamily: "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif",
                fontSize: '17px',
                fontWeight: 700,
                color: '#fbbf24',
                whiteSpace: 'nowrap',
                lineHeight: 2.1,
                paddingTop: '2px',
                paddingBottom: '2px',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              میزان سویٹس اینڈ بیکرز
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#fed7aa',
                whiteSpace: 'nowrap',
                lineHeight: 1.6,
                fontFamily: "'Noto Nastaliq Urdu', serif",
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px',
              }}
            >
              <span>📍</span>
              <span>چک 24 ج ب لاہوریاں</span>
            </div>
          </div>
        </div>

        {/* Active Shift Indicator Card */}
        <div className="sidebar-shift-status">
          <div className="sidebar-shift-badge">
            <span className={`sidebar-shift-dot ${activeShift ? 'active' : 'inactive'}`} />
            <span style={{ color: activeShift ? '#34d399' : '#94a3b8' }}>
              {activeShift ? 'Shift Active' : 'Shift Closed'}
            </span>
          </div>
          <div className="sidebar-shift-sub">
            {activeShift ? (
              <span>Code: <strong>{activeShift.shiftCode || `#${activeShift.id}`}</strong></span>
            ) : (
              <span>Drawer not opened</span>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav">
          {hasPermission('pos') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'pos' ? 'active' : ''}`}
              onClick={() => setActiveTab('pos')}
            >
              <span className="nav-item-icon">🛒</span>
              <span>POS Terminal</span>
            </button>
          )}
          {hasPermission('inventory') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <span className="nav-item-icon">📦</span>
              <span>Stock & Inventory</span>
            </button>
          )}
          {hasPermission('products') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <span className="nav-item-icon">🥐</span>
              <span>Product Catalog</span>
            </button>
          )}
          {hasPermission('purchasing') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'purchasing' ? 'active' : ''}`}
              onClick={() => setActiveTab('purchasing')}
            >
              <span className="nav-item-icon">🚚</span>
              <span>Purchasing & GRN</span>
            </button>
          )}
          {hasPermission('production') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'production' ? 'active' : ''}`}
              onClick={() => setActiveTab('production')}
            >
              <span className="nav-item-icon">👨‍🍳</span>
              <span>Production & Recipes</span>
            </button>
          )}
          {hasPermission('custom-orders') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'custom-orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('custom-orders')}
            >
              <span className="nav-item-icon">🎂</span>
              <span>Custom Orders</span>
            </button>
          )}
          {hasPermission('scanner') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'scanner' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('scanner');
                setTimeout(() => scanInputRef.current?.focus(), 100);
              }}
            >
              <span className="nav-item-icon">🔍</span>
              <span>Barcode Scanner</span>
            </button>
          )}
          {hasPermission('reports') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <span className="nav-item-icon">📊</span>
              <span>Sales & Reports</span>
            </button>
          )}
          {hasPermission('expenses') && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              <span className="nav-item-icon">💸</span>
              <span>Expenses & Salaries</span>
            </button>
          )}
          {session.role === 'admin' && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <span className="nav-item-icon">👥</span>
              <span>Staff & Roles</span>
            </button>
          )}
          {session.role === 'admin' && (
            <button
              type="button"
              className={`nav-item-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
              onClick={() => setActiveTab('diagnostics')}
            >
              <span className="nav-item-icon">⚙️</span>
              <span>Diagnostics</span>
            </button>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <span>v1.0 (Win-x64)</span>
          <span>{store ? store.code : 'STR-001'}</span>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="app-main-content">
        {/* Top bar with Breadcrumbs & Context */}
        <header className="main-topbar no-print">
          <div>
            <h1 className="main-title">
              {activeTab === 'pos' && 'Point of Sale Terminal'}
              {activeTab === 'inventory' && 'Real-Time Stock Balances & Movement Audit'}
              {activeTab === 'products' && 'Product Catalog Management'}
              {activeTab === 'purchasing' && 'Purchasing & Goods Receiving Notes (GRN)'}
              {activeTab === 'production' && 'Bakery Production & Recipe Management (BOM)'}
              {activeTab === 'custom-orders' && 'Custom Cake Bookings & Advance Orders'}
              {activeTab === 'scanner' && 'Barcode Scanner Test & Hardware Probe'}
              {activeTab === 'reports' && 'Sales Invoices & Cashier Shift Reports'}
              {activeTab === 'expenses' && 'Operating Expenses & Staff Salaries (Payroll)'}
              {activeTab === 'users' && 'Staff Accounts & Role-Based Access Control (RBAC)'}
              {activeTab === 'diagnostics' && 'System Diagnostics & Health'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
            <span style={{ fontWeight: 700, color: '#92400e', fontFamily: "'Noto Nastaliq Urdu', serif", fontSize: '14px' }}>
              میزان سویٹس اینڈ بیکرز
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '11px', color: '#4b5563' }}>
              📍 چک 24 ج ب لاہوریاں
            </span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '3px 8px',
              }}
            >
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                👤 {session.displayName}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: session.role === 'admin' ? '#fef3c7' : '#e0e7ff',
                  color: session.role === 'admin' ? '#b45309' : '#3730a3',
                }}
              >
                {session.role}
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('bakery_user_session');
                  setSession(null);
                }}
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#dc2626',
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
                title="Lock terminal and return to PIN login screen"
              >
                🔒 Lock
              </button>
            </div>
          </div>
        </header>

        <div className="main-content-body">
          {/* TAB 1: POS TERMINAL */}
          {activeTab === 'pos' && (
            <div>
              {/* Shift Status Bar */}
              <div
                style={{
                  background: activeShift ? '#ecfdf5' : '#fffbeb',
                  border: `1px solid ${activeShift ? '#a7f3d0' : '#fde68a'}`,
                  borderRadius: '4px',
                  padding: '10px 16px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '13px',
                      color: activeShift ? '#065f46' : '#92400e',
                    }}
                  >
                    {activeShift ? '● SHIFT ACTIVE' : '○ NO SHIFT OPEN'}
                  </span>
                  {activeShift && (
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: '#374151' }}>
                      Shift Opened: <strong>{formatDateTime(activeShift.openedAtUtc)}</strong> · Float: Rs. {(activeShift.openingFloatMinorUnits / 100).toFixed(2)} · Expected Drawer Cash: <strong>Rs. {(activeShift.expectedCashMinorUnits / 100).toFixed(2)}</strong>
                    </span>
                  )}
                </div>
                <div>
                  {activeShift ? (
                    <button
                      className="btn-primary"
                      style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                      onClick={() => {
                        setCountedCashRs((activeShift.expectedCashMinorUnits / 100).toFixed(2));
                        setShowCloseShiftModal(true);
                      }}
                    >
                      Close Shift
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={() => setShowOpenShiftModal(true)}>
                      Open Shift
                    </button>
                  )}
                </div>
              </div>

              {posError && (
                <div className="status-banner unhealthy" style={{ marginBottom: '12px' }}>
                  {posError}
                </div>
              )}

              {!activeShift ? (
                <div
                  className="panel-card"
                  style={{ padding: '36px', textAlign: 'center', background: '#ffffff' }}
                >
                  <h2 style={{ fontSize: '18px', color: '#111827', marginBottom: '8px' }}>
                    Cashier Shift is Closed
                  </h2>
                  <p style={{ color: '#4b5563', marginBottom: '16px' }}>
                    You must open a shift with an opening cash float before ringing up sales.
                  </p>
                  <button
                    className="btn-primary"
                    style={{ fontSize: '14px', padding: '8px 16px' }}
                    onClick={() => setShowOpenShiftModal(true)}
                  >
                    Open Cashier Shift Now
                  </button>
                </div>
              ) : (
                /* Split Screen POS Interface */
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: '14px', alignItems: 'start', width: '100%', maxWidth: '100%' }}>
                  {/* Left Side: Products Catalog & Search */}
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Search by name, SKU, or scan barcode..."
                        value={posSearch}
                        onChange={(e) => setPosSearch(e.target.value)}
                        onKeyDown={handlePosSearchKeyDown}
                        className="form-input"
                        style={{ fontSize: '13px', padding: '8px 10px', flex: 1 }}
                        autoFocus
                      />
                      {posSearch && (
                        <button
                          className="tab-btn"
                          onClick={() => setPosSearch('')}
                          style={{ padding: '0 12px' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Category Speed Filter Tabs (Top 5 Categories) */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        flexWrap: 'wrap',
                        marginBottom: '10px',
                      }}
                    >
                      {posCategories.map((cat: { id: string; name: string }) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setPosCategoryFilter(cat.id)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: posCategoryFilter === cat.id ? 700 : 500,
                            background: posCategoryFilter === cat.id ? '#0067b8' : '#ffffff',
                            color: posCategoryFilter === cat.id ? '#ffffff' : '#334155',
                            border: posCategoryFilter === cat.id ? '1px solid #005a9e' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: posCategoryFilter === cat.id ? '0 1px 2px rgba(0,103,184,0.3)' : 'none',
                          }}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>

                    {filteredPosProducts.length === 0 ? (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '40px 20px',
                          textAlign: 'center',
                          color: '#64748b',
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                          No matching products found
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {hasSearchQuery
                            ? `No product matches "${posSearch}". Check spelling or select another category.`
                            : 'No products in this category yet. Add products in the Products tab.'}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          maxHeight: '520px',
                          overflowY: 'auto',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr
                              style={{
                                background: '#f8fafc',
                                borderBottom: '1px solid #e2e8f0',
                                color: '#475569',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                              }}
                            >
                              <th style={{ textAlign: 'left', padding: '10px 14px' }}>Product</th>
                              <th style={{ textAlign: 'left', padding: '10px 12px' }}>Category & SKU</th>
                              <th style={{ textAlign: 'right', padding: '10px 14px' }}>Price</th>
                              <th style={{ textAlign: 'center', padding: '10px 12px', width: '140px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPosProducts.map((p: ProductListItem) => {
                              const isWeighed = (p.baseUnitCode || '').toLowerCase() === 'kg' || (p.baseUnitCode || '').toLowerCase() === 'g';
                              return (
                                <tr
                                  key={p.id}
                                  onClick={() => {
                                    if (isWeighed) {
                                      setWeightModalTarget({
                                        variantId: p.variantId,
                                        name: p.name,
                                        sku: p.sku,
                                        priceMinorUnits: p.priceMinorUnits,
                                        baseUnitCode: p.baseUnitCode,
                                      });
                                    } else {
                                      addToCart(p);
                                    }
                                  }}
                                  style={{
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <td style={{ padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.name}</div>
                                    {p.barcode && (
                                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                        Barcode: <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', fontSize: '11px' }}>{p.barcode}</code>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px' }}>
                                    <div>{p.categoryName || 'General'}</div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.sku}</div>
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#059669', fontSize: '14px' }}>
                                      Rs. {(p.priceMinorUnits / 100).toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>per {p.baseUnitCode}</div>
                                  </td>
                                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToCart(p);
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderRadius: '4px',
                                        }}
                                        title="Add 1 unit"
                                      >
                                        + Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setWeightModalTarget({
                                            variantId: p.variantId,
                                            name: p.name,
                                            sku: p.sku,
                                            priceMinorUnits: p.priceMinorUnits,
                                            baseUnitCode: p.baseUnitCode,
                                          });
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          borderRadius: '4px',
                                          background: '#f0fdf4',
                                          border: '1px solid #86efac',
                                          color: '#15803d',
                                          cursor: 'pointer',
                                          whiteSpace: 'nowrap',
                                        }}
                                        title="Sell by Rs (50, 100) or by Weight (250g, 500g)"
                                      >
                                        ⚖️ Weight / Rs
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Active Cart & Total (Pinned & Visible) */}
                  <div
                    className="panel-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '520px',
                      width: '360px',
                      minWidth: '360px',
                      flexShrink: 0,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div>
                      <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="panel-title">Active Cart ({cart.length} items)</span>
                          {heldCarts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowHeldCartsModal(true)}
                              style={{
                                background: '#fef3c7',
                                border: '1px solid #f59e0b',
                                color: '#92400e',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="View parked carts"
                            >
                              <span>⏸️ Parked:</span>
                              <span>{heldCarts.length}</span>
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {heldCarts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowHeldCartsModal(true)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0284c7',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              Held Carts ({heldCarts.length})
                            </button>
                          )}
                          {cart.length > 0 && (
                            <button
                              onClick={() => setCart([])}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ maxHeight: '330px', overflowY: 'auto', padding: '6px' }}>
                        {cart.length === 0 ? (
                          <div
                            style={{
                              textAlign: 'center',
                              color: '#9ca3af',
                              padding: '40px 10px',
                            }}
                          >
                            Cart is empty. Click a product on the left or scan a barcode.
                          </div>
                        ) : (
                          <table className="data-table">
                            <thead>
                              <tr style={{ background: '#f9fafb' }}>
                                <th style={{ textAlign: 'left', padding: '6px 4px' }}>Item</th>
                                <th style={{ textAlign: 'center', padding: '6px 4px' }}>Qty</th>
                                <th style={{ textAlign: 'right', padding: '6px 4px' }}>Total</th>
                                <th style={{ width: '20px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {cart.map((item) => (
                                <tr key={item.variantId}>
                                  <td style={{ padding: '6px 4px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{item.name}</div>
                                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                      Rs. {(item.unitPriceMinorUnits / 100).toFixed(2)}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <button
                                        onClick={() => updateQuantity(item.variantId, -1)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          cursor: 'pointer',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '2px',
                                        }}
                                      >
                                        -
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setWeightModalTarget({
                                            variantId: item.variantId,
                                            name: item.name,
                                            sku: item.sku,
                                            priceMinorUnits: item.unitPriceMinorUnits,
                                            baseUnitCode: item.baseUnitCode,
                                            currentQuantity: item.quantity,
                                          });
                                        }}
                                        style={{
                                          fontWeight: 700,
                                          fontSize: '11px',
                                          padding: '2px 5px',
                                          background: '#eff6ff',
                                          border: '1px solid #bfdbfe',
                                          borderRadius: '3px',
                                          color: '#1d4ed8',
                                          cursor: 'pointer',
                                          minWidth: '36px',
                                          textAlign: 'center',
                                        }}
                                        title="Click to edit weight (g/kg) or rupee amount"
                                      >
                                        {formatCartQuantity(item.quantity, item.baseUnitCode)}
                                      </button>
                                      <button
                                        onClick={() => updateQuantity(item.variantId, 1)}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          cursor: 'pointer',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '2px',
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td
                                    className="value"
                                    style={{ textAlign: 'right', padding: '6px 4px' }}
                                  >
                                    Rs. {(Math.round(item.quantity * item.unitPriceMinorUnits) / 100).toFixed(2)}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                                    <button
                                      onClick={() => removeFromCart(item.variantId)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#9ca3af',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                      }}
                                    >
                                      ×
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Cart Footer */}
                    <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                          fontSize: '13px',
                          color: '#4b5563',
                        }}
                      >
                        <span>Subtotal:</span>
                        <span>Rs. {(cartSubtotalMinor / 100).toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#111827',
                        }}
                      >
                        <span>Total Due:</span>
                        <span style={{ color: '#059669' }}>
                          Rs. {(cartTotalMinor / 100).toFixed(2)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={cart.length === 0}
                          onClick={() => setShowHoldCartConfirmModal(true)}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: '#f8fafc',
                            borderColor: '#cbd5e1',
                            color: '#334155',
                            cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                            opacity: cart.length > 0 ? 1 : 0.6,
                          }}
                          title="Park this cart temporarily for another customer"
                        >
                          <span>⏸️</span>
                          <span>Hold Cart</span>
                        </button>
                        <button
                          className="btn-primary"
                          disabled={cart.length === 0}
                          onClick={() => {
                            setTenderedRs((cartTotalMinor / 100).toString());
                            setShowCheckoutModal(true);
                          }}
                          style={{
                            flex: 2,
                            padding: '10px',
                            fontSize: '14px',
                            backgroundColor: cart.length > 0 ? '#059669' : '#9ca3af',
                            borderColor: cart.length > 0 ? '#047857' : '#9ca3af',
                            fontWeight: 700,
                          }}
                        >
                          Complete Cash Sale
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCT CATALOG (Full Screen / 100% Width) */}
          {activeTab === 'products' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
              <div className="panel-card" style={{ width: '100%' }}>
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="panel-title">📦 Product Catalog Records</span>
                    <span className="panel-badge ok">{products.length} Products</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '7px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        loadProducts();
                        loadCategoriesAndUnits();
                      }}
                      title="Refresh products & categories from database"
                    >
                      <span>🔄 Refresh</span>
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '13px', fontWeight: 700 }}
                      onClick={() => {
                        loadCategoriesAndUnits();
                        setPCode('');
                        setPName('');
                        setPSku('');
                        setPBarcode('');
                        setPCostPrice('100.00');
                        setPPrice('150.00');
                        setProdMsg(null);
                        setShowAddProductModal(true);
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>+</span>
                      <span>Add New Product</span>
                    </button>
                  </div>
                </div>
                <div className="panel-body" style={{ padding: 0 }}>
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Code</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Name</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Category</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>SKU</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px' }}>Buy Cost (PKR)</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px' }}>Sale Price (PKR)</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px' }}>Unit Profit</th>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Barcode</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px' }}>Unit</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>No products entered yet. Create your first product on the left!</td></tr>
                      ) : (
                        products.map((p) => {
                          const cost = (p.costMinorUnits || 0) / 100;
                          const sell = (p.priceMinorUnits || 0) / 100;
                          const profit = sell - cost;
                          const margin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';
                          return (
                            <tr key={p.id}>
                              <td className="value" style={{ textAlign: 'left', padding: '6px 8px' }}>{p.code}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{p.name}</td>
                              <td style={{ padding: '6px 8px' }}>{p.categoryName ?? '—'}</td>
                              <td className="value" style={{ textAlign: 'left', padding: '6px 8px' }}>{p.sku}</td>
                              <td className="value" style={{ textAlign: 'right', padding: '6px 8px', color: '#64748b' }}>
                                Rs. {cost.toFixed(2)}
                              </td>
                              <td className="value ok" style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>
                                Rs. {sell.toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'right', padding: '6px 8px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: profit >= 0 ? '#dcfce7' : '#fee2e2',
                                    color: profit >= 0 ? '#166534' : '#991b1b',
                                  }}
                                >
                                  {profit >= 0 ? '+' : ''}Rs. {profit.toFixed(2)} ({margin}%)
                                </span>
                              </td>
                              <td className="value" style={{ textAlign: 'left', padding: '6px 8px' }}>{p.barcode ?? '—'}</td>
                              <td style={{ textAlign: 'right', padding: '6px 8px' }}>{p.baseUnitCode}</td>
                              <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: 'pointer',
                                    borderColor: '#93c5fd',
                                    color: '#1d4ed8',
                                    background: '#eff6ff',
                                  }}
                                  onClick={() => {
                                    setEditingProduct(p);
                                    setEditName(p.name);
                                    setEditCatId(p.categoryId ? String(p.categoryId) : '');
                                    setEditPriceRs(((p.priceMinorUnits || 0) / 100).toFixed(2));
                                    setEditCostRs(((p.costMinorUnits || 0) / 100).toFixed(2));
                                    setEditBarcode(p.barcode || '');
                                    setEditProdMsg(null);
                                  }}
                                >
                                  ✏️ Edit Price
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* TAB: PURCHASING & GOODS RECEIVING (GRN) */}
          {activeTab === 'purchasing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Purchasing Sub-tabs & Action Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Segmented Pills */}
                <div
                  style={{
                    display: 'flex',
                    background: '#f1f5f9',
                    padding: '4px',
                    borderRadius: '8px',
                    gap: '4px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPurchasingSubTab('grn')}
                    style={{
                      padding: '7px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: purchasingSubTab === 'grn' ? '#ffffff' : 'transparent',
                      color: purchasingSubTab === 'grn' ? '#0f172a' : '#64748b',
                      boxShadow: purchasingSubTab === 'grn' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>📥 Goods Receipts</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: purchasingSubTab === 'grn' ? '#0284c7' : '#e2e8f0',
                        color: purchasingSubTab === 'grn' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {goodsReceipts.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasingSubTab('pos')}
                    style={{
                      padding: '7px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: purchasingSubTab === 'pos' ? '#ffffff' : 'transparent',
                      color: purchasingSubTab === 'pos' ? '#0f172a' : '#64748b',
                      boxShadow: purchasingSubTab === 'pos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>📋 Purchase Orders</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: purchasingSubTab === 'pos' ? '#0284c7' : '#e2e8f0',
                        color: purchasingSubTab === 'pos' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {purchaseOrders.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchasingSubTab('suppliers')}
                    style={{
                      padding: '7px 16px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: purchasingSubTab === 'suppliers' ? '#ffffff' : 'transparent',
                      color: purchasingSubTab === 'suppliers' ? '#0f172a' : '#64748b',
                      boxShadow: purchasingSubTab === 'suppliers' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>🏢 Suppliers Directory</span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        background: purchasingSubTab === 'suppliers' ? '#0284c7' : '#e2e8f0',
                        color: purchasingSubTab === 'suppliers' ? '#ffffff' : '#64748b',
                        fontWeight: 700,
                      }}
                    >
                      {suppliers.length}
                    </span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {purchasingSubTab === 'grn' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setSelectedPoDetail(null);
                        setEditingGrnId(null);
                        setEditingGrnNumber('');
                        setGrnPoId('');
                        setGrnSupplierId(suppliers[0] ? String(suppliers[0].id) : '');
                        setGrnLines([]);
                        setQuickAddVariantId(0);
                        setQuickAddQty(1);
                        setQuickAddCostRs('');
                        setQuickAddSalePriceRs('');
                        setGrnPaymentAmountRs('');
                        setShowCreateGrnModal(true);
                      }}
                    >
                      <span style={{ fontSize: '15px' }}>+</span>
                      <span>Receive Goods (GRN)</span>
                    </button>
                  )}
                  {purchasingSubTab === 'pos' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setPoSupplierId(suppliers[0] ? String(suppliers[0].id) : '');
                        setPoVariantId(products[0] ? String(products[0].variantId) : '');
                        setShowCreatePoModal(true);
                      }}
                    >
                      <span style={{ fontSize: '15px' }}>+</span>
                      <span>New Purchase Order</span>
                    </button>
                  )}
                  {purchasingSubTab === 'suppliers' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowAddSupplierModal(true)}
                    >
                      <span style={{ fontSize: '15px' }}>+</span>
                      <span>Register Supplier</span>
                    </button>
                  )}
                </div>
              </div>

              {purchasingMsg && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    background: purchasingMsg.startsWith('✓') ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${purchasingMsg.startsWith('✓') ? '#6ee7b7' : '#fca5a5'}`,
                    color: purchasingMsg.startsWith('✓') ? '#065f46' : '#991b1b',
                  }}
                >
                  {purchasingMsg}
                </div>
              )}

              {/* SUBTAB 1: GOODS RECEIPTS (GRN) */}
              {purchasingSubTab === 'grn' && (
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">Goods Receiving Notes (GRN) History</span>
                    <span className="panel-badge ok">{goodsReceipts.length} Recorded</span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>GRN #</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Supplier</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Invoice / Challan</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>PO Reference</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Received Date</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Total Amount</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Paid</th>
                          <th style={{ textAlign: 'right', padding: '10px 12px' }}>Balance Due</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Payment Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {goodsReceipts.map((grn) => {
                          const totalRs = (grn.totalAmountMinorUnits / 100).toFixed(2);
                          const paidRs = ((grn.paidAmountMinorUnits || 0) / 100).toFixed(2);
                          const balanceMinor = grn.balanceDueMinorUnits ?? Math.max(0, grn.totalAmountMinorUnits - (grn.paidAmountMinorUnits || 0));
                          const balanceRs = (balanceMinor / 100).toFixed(2);
                          const isPaid = balanceMinor === 0 && (grn.paidAmountMinorUnits || 0) >= grn.totalAmountMinorUnits;
                          const isPartial = !isPaid && (grn.paidAmountMinorUnits || 0) > 0;

                          return (
                            <tr key={grn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0284c7' }}>
                                {grn.grnNumber}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                                {grn.supplierName}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569' }}>
                                {grn.supplierInvoiceRef}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>
                                {grn.poNumber ? (
                                  <span style={{ fontWeight: 600, color: '#4338ca' }}>{grn.poNumber}</span>
                                ) : (
                                  <span style={{ fontStyle: 'italic' }}>Direct / Walk-in</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                                {formatDateTime(grn.receivedDateUtc)}
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                }}
                              >
                                Rs. {totalRs}
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 600,
                                  color: (grn.paidAmountMinorUnits || 0) > 0 ? '#059669' : '#94a3b8',
                                }}
                              >
                                Rs. {paidRs}
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: balanceMinor > 0 ? '#dc2626' : '#15803d',
                                }}
                              >
                                Rs. {balanceRs}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                {isPaid ? (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#dcfce7',
                                      color: '#15803d',
                                    }}
                                  >
                                    ● PAID
                                  </span>
                                ) : isPartial ? (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#fef3c7',
                                      color: '#b45309',
                                    }}
                                  >
                                    ● PARTIAL
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#fee2e2',
                                      color: '#b91c1c',
                                    }}
                                  >
                                    ● UNPAID
                                  </span>
                                )}
                                {grn.paymentMethod && (
                                  <div style={{ marginTop: '3px' }}>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: '#f1f5f9',
                                        color: '#475569',
                                        border: '1px solid #e2e8f0',
                                        display: 'inline-block',
                                      }}
                                    >
                                      {grn.paymentMethod === 'ADVANCE_ADJUSTMENT'
                                        ? '⭐ Advance Credit'
                                        : grn.paymentMethod === 'BANK_TRANSFER'
                                        ? '🏦 Bank'
                                        : grn.paymentMethod === 'CHEQUE'
                                        ? '📑 Cheque'
                                        : grn.paymentMethod === 'ONLINE_WALLET'
                                        ? '📱 Online'
                                        : '💵 Cash'}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                  onClick={async () => {
                                    if (window.bakery?.purchasing) {
                                      const res = await window.bakery.purchasing.getGoodsReceipt(grn.id);
                                      if (res.success) setSelectedGrnDetail(res.data);
                                    }
                                  }}
                                >
                                  View Items
                                </button>
                                {(!grn.paidAmountMinorUnits || grn.paidAmountMinorUnits === 0) && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      marginLeft: '6px',
                                      color: '#1d4ed8',
                                      borderColor: '#bfdbfe',
                                      background: '#eff6ff',
                                    }}
                                    title={`Edit unpaid GRN ${grn.grnNumber}`}
                                    onClick={() => handleOpenEditGrn(grn)}
                                  >
                                    ✏️ Edit
                                  </button>
                                )}
                                {balanceMinor > 0 && (
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      background: '#059669',
                                      borderColor: '#047857',
                                      marginLeft: '6px',
                                    }}
                                    title={`Pay outstanding balance of Rs. ${balanceRs} for ${grn.grnNumber}`}
                                    onClick={() => {
                                      const sup = suppliers.find((s) => s.id === grn.supplierId);
                                      if (sup) setPaymentSupplier(sup);
                                      setPaymentAmountRs(balanceRs);
                                      setPaymentReference(`PAY-${grn.grnNumber}`);
                                      setPaymentNotes(`Settlement for GRN ${grn.grnNumber} (Inv: ${grn.supplierInvoiceRef})`);
                                      setPaymentMethod('CASH');
                                      setShowRecordPaymentModal(true);
                                    }}
                                  >
                                    💳 Pay
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {goodsReceipts.length === 0 && (
                          <tr>
                            <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No Goods Receiving Notes found. Click "+ Receive Goods (GRN)" to record a delivery.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 2: PURCHASE ORDERS (PO) */}
              {purchasingSubTab === 'pos' && (
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">Purchase Orders (PO) Management</span>
                    <span className="panel-badge ok">{purchaseOrders.length} Orders</span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>PO #</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Supplier</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Order Date</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Expected Delivery</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Total Amount</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseOrders.map((po) => {
                          const statusBg =
                            po.status === 'DRAFT'
                              ? '#fef3c7'
                              : po.status === 'APPROVED'
                                ? '#e0e7ff'
                                : po.status === 'PARTIALLY_RECEIVED'
                                  ? '#fce7f3'
                                  : '#dcfce7';
                          const statusColor =
                            po.status === 'DRAFT'
                              ? '#b45309'
                              : po.status === 'APPROVED'
                                ? '#3730a3'
                                : po.status === 'PARTIALLY_RECEIVED'
                                  ? '#9d174d'
                                  : '#15803d';

                          return (
                            <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                                {po.poNumber}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>
                                {po.supplierName}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                                {formatDateTime(po.orderDateUtc)}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                                {po.expectedDeliveryDateUtc ? formatDateTime(po.expectedDeliveryDateUtc) : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                }}
                              >
                                Rs. {(po.totalCostMinorUnits / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: statusBg,
                                    color: statusColor,
                                  }}
                                >
                                  ● {po.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  {po.status === 'DRAFT' && (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#2563eb',
                                      }}
                                      onClick={() => handleApprovePo(po.id)}
                                    >
                                      ✓ Approve PO
                                    </button>
                                  )}
                                  {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#059669',
                                      }}
                                      onClick={async () => {
                                        if (window.bakery?.purchasing) {
                                          const res = await window.bakery.purchasing.getPurchaseOrder(po.id);
                                          if (res.success) {
                                            setSelectedPoDetail(res.data);
                                            setGrnPoId(String(res.data.id));
                                            setGrnSupplierId(String(res.data.supplierId));
                                            if (res.data.lines && res.data.lines.length > 0) {
                                              setGrnLines(
                                                res.data.lines.map((l, idx) => {
                                                  const prod = products.find((p) => p.variantId === l.productVariantId);
                                                  return {
                                                    id: String(idx + 1),
                                                    variantId: l.productVariantId,
                                                    quantity: Math.max(1, l.orderedQuantity - l.receivedQuantity),
                                                    unitCode: l.unitCode,
                                                    unitCostRs: (l.unitCostMinorUnits / 100).toFixed(2),
                                                    salePriceRs: prod && (prod.priceMinorUnits || 0) > 0
                                                      ? ((prod.priceMinorUnits || 0) / 100).toFixed(2)
                                                      : '',
                                                    lotNumber: '',
                                                    expiryDate: '',
                                                  };
                                                })
                                              );
                                            }
                                            setEditingGrnId(null);
                                            setEditingGrnNumber('');
                                            setShowCreateGrnModal(true);
                                          }
                                        }
                                      }}
                                    >
                                      📥 Receive Goods
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                    onClick={async () => {
                                      if (window.bakery?.purchasing) {
                                        const res = await window.bakery.purchasing.getPurchaseOrder(po.id);
                                        if (res.success) setSelectedPoDetail(res.data);
                                      }
                                    }}
                                  >
                                    View Lines
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {purchaseOrders.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No Purchase Orders found. Click "+ New Purchase Order" to create one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUBTAB 3: SUPPLIERS DIRECTORY & ACCOUNTS PAYABLE */}
              {purchasingSubTab === 'suppliers' && (
                <div>
                  {/* Financial Overview KPI Cards */}
                  {(() => {
                    const totalPurchasesAll = supplierBalances.reduce((sum, b) => sum + b.totalPurchasesMinorUnits, 0);
                    const totalPaidAll = supplierBalances.reduce((sum, b) => sum + b.totalPaidMinorUnits, 0);
                    const totalOutstandingAll = supplierBalances.reduce((sum, b) => sum + b.outstandingBalanceMinorUnits, 0);
                    return (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '14px',
                          marginBottom: '18px',
                        }}
                      >
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Invoiced / Purchases</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                            Rs. {(totalPurchasesAll / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Total goods received</div>
                        </div>

                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Payments Settled</div>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                            Rs. {(totalPaidAll / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Cash, Bank & Cheques paid</div>
                        </div>

                        <div
                          style={{
                            background: totalOutstandingAll > 0 ? '#fef2f2' : '#f0fdf4',
                            border: `1px solid ${totalOutstandingAll > 0 ? '#fecaca' : '#bbf7d0'}`,
                            borderRadius: '10px',
                            padding: '14px 16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              color: totalOutstandingAll > 0 ? '#991b1b' : '#166534',
                              fontWeight: 700,
                            }}
                          >
                            Total Outstanding Payables (واجب الادا)
                          </div>
                          <div
                            style={{
                              fontSize: '20px',
                              fontWeight: 900,
                              color: totalOutstandingAll > 0 ? '#dc2626' : '#15803d',
                              marginTop: '4px',
                            }}
                          >
                            Rs. {(totalOutstandingAll / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: totalOutstandingAll > 0 ? '#b91c1c' : '#15803d',
                              marginTop: '2px',
                            }}
                          >
                            {totalOutstandingAll > 0 ? 'Remaining liability to suppliers' : 'All accounts fully settled'}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="panel-card">
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="panel-title">Suppliers Directory & Accounts Payable (کھاتہ)</span>
                      <span className="panel-badge ok">{suppliers.length} Registered</span>
                    </div>
                    <div className="panel-body" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>Code</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>Supplier Name</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>Contact & Phone</th>
                            <th style={{ textAlign: 'left', padding: '10px 14px' }}>Terms</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px' }}>Total Invoiced</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px' }}>Total Paid</th>
                            <th style={{ textAlign: 'right', padding: '10px 14px' }}>Outstanding Balance</th>
                            <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {suppliers.map((sup) => {
                            const bal = supplierBalances.find((b) => b.supplierId === sup.id);
                            const purchases = bal ? bal.totalPurchasesMinorUnits : 0;
                            const paid = bal ? bal.totalPaidMinorUnits : 0;
                            const outstanding = bal ? bal.outstandingBalanceMinorUnits : 0;
                            const isOwed = outstanding > 0;

                            return (
                              <tr key={sup.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                                  {sup.code}
                                </td>
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                                  <div>{sup.name}</div>
                                  {sup.taxNumber && (
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>NTN: {sup.taxNumber}</span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#475569', fontSize: '13px' }}>
                                  <div style={{ fontWeight: 500 }}>{sup.contactPerson || '—'}</div>
                                  {sup.phone && <div style={{ color: '#0284c7', fontSize: '12px' }}>{sup.phone}</div>}
                                </td>
                                <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                  {sup.paymentTermsDays > 0 ? `Net ${sup.paymentTermsDays} Days` : 'Cash on Delivery'}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                                  Rs. {(purchases / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>
                                  Rs. {(paid / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '4px 10px',
                                      borderRadius: '12px',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      background: isOwed ? '#fee2e2' : '#dcfce7',
                                      color: isOwed ? '#b91c1c' : '#15803d',
                                    }}
                                  >
                                    Rs. {(outstanding / 100).toFixed(2)}
                                    {isOwed ? ' (Owed)' : ' (Cleared)'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                      onClick={() => openSupplierLedger(sup.id)}
                                    >
                                      📜 Ledger
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#059669',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                      onClick={() => openRecordPayment(sup)}
                                    >
                                      💳 Pay
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {suppliers.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                                No suppliers registered yet. Click "+ Register Supplier" to add your bakery vendors.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRODUCTION & RECIPES (BOM) */}
          {activeTab === 'production' && (
            <div>
              {/* Header Navigation & Actions Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={`tab-btn ${productionSubTab === 'runs' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px' }}
                    onClick={() => setProductionSubTab('runs')}
                  >
                    📋 Production Runs ({productionRuns.length})
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${productionSubTab === 'recipes' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px' }}
                    onClick={() => setProductionSubTab('recipes')}
                  >
                    📖 Recipe Book / BOM ({recipes.length})
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {productionSubTab === 'runs' && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '7px 14px', background: '#059669' }}
                      onClick={() => setShowCreateRunModal(true)}
                    >
                      + Plan Production Run
                    </button>
                  )}
                  {productionSubTab === 'recipes' && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: '12px', padding: '7px 14px', background: '#7c3aed' }}
                      onClick={() => setShowCreateRecipeModal(true)}
                    >
                      + Create New Recipe
                    </button>
                  )}
                  <button
                    type="button"
                    className="tab-btn"
                    style={{ fontSize: '12px', padding: '7px 14px' }}
                    disabled={productionLoading}
                    onClick={() => {
                      loadRecipes();
                      loadProductionRuns();
                    }}
                  >
                    {productionLoading ? 'Loading...' : '🔄 Refresh Data'}
                  </button>
                </div>
              </div>

              {/* Status/Notification Banner */}
              {productionMsg && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: productionMsg.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                    border: `1px solid ${productionMsg.startsWith('Error') ? '#fca5a5' : '#a7f3d0'}`,
                    color: productionMsg.startsWith('Error') ? '#b91c1c' : '#065f46',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  <span>{productionMsg}</span>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'inherit',
                      fontSize: '15px',
                    }}
                    onClick={() => setProductionMsg(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* SUB-VIEW 1: PRODUCTION RUNS */}
              {productionSubTab === 'runs' && (
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">Bakery Batch Production Runs</span>
                    <span className="panel-badge ok">{productionRuns.length} Runs</span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Run #</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Recipe Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Output Product</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Batches</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Planned Yield</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Actual Output</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionRuns.map((run) => {
                          const statusBg =
                            run.status === 'PLANNED'
                              ? '#fef3c7'
                              : run.status === 'RELEASED'
                                ? '#dbeafe'
                                : run.status === 'IN_PROGRESS'
                                  ? '#f3e8ff'
                                  : run.status === 'COMPLETED'
                                    ? '#dcfce7'
                                    : '#f1f5f9';
                          const statusColor =
                            run.status === 'PLANNED'
                              ? '#b45309'
                              : run.status === 'RELEASED'
                                ? '#1d4ed8'
                                : run.status === 'IN_PROGRESS'
                                  ? '#7e22ce'
                                  : run.status === 'COMPLETED'
                                    ? '#15803d'
                                    : '#64748b';

                          return (
                            <tr key={run.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                                {run.runNumber}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>
                                {run.recipeName}
                                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
                                  (v{run.recipeVersionId})
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', color: '#334155' }}>
                                {run.outputVariantName}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>
                                {run.plannedBatchCount}x
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                                {run.plannedOutputQuantity} {run.outputUnitCode}
                              </td>
                              <td
                                style={{
                                  padding: '10px 14px',
                                  textAlign: 'right',
                                  fontWeight: 700,
                                  color: run.actualOutputQuantity !== null ? '#059669' : '#94a3b8',
                                }}
                              >
                                {run.actualOutputQuantity !== null
                                  ? `${run.actualOutputQuantity} ${run.outputUnitCode}`
                                  : '—'}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: statusBg,
                                    color: statusColor,
                                  }}
                                >
                                  ● {run.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  {run.status === 'PLANNED' && (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#2563eb',
                                      }}
                                      onClick={() => handleUpdateRunStatus(run.id, 'RELEASED')}
                                    >
                                      Release
                                    </button>
                                  )}
                                  {run.status === 'RELEASED' && (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#7c3aed',
                                      }}
                                      onClick={() => handleUpdateRunStatus(run.id, 'IN_PROGRESS')}
                                    >
                                      Start
                                    </button>
                                  )}
                                  {run.status === 'IN_PROGRESS' && (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        background: '#059669',
                                      }}
                                      onClick={() => {
                                        setCompletingRun(run);
                                        setActualYieldQty(String(run.plannedOutputQuantity));
                                        setOutputLotNumber(`LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${run.id}`);
                                        setOutputExpiryDate(
                                          new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
                                        );
                                        setShowCompleteRunModal(true);
                                      }}
                                    >
                                      ✓ Complete Run
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                    onClick={async () => {
                                      if (window.bakery?.production) {
                                        const res = await window.bakery.production.getProductionRun(run.id);
                                        if (res.success) setSelectedRunDetail(res.data);
                                      }
                                    }}
                                  >
                                    Details
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {productionRuns.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No production runs recorded yet. Click "+ Plan Production Run" to schedule a baking batch.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: RECIPE BOOK / BOM */}
              {productionSubTab === 'recipes' && (
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">Master Bakery Recipes & Bill of Materials (BOM)</span>
                    <span className="panel-badge ok">{recipes.length} Recipes</span>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Recipe Code</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Recipe Name</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Finished Product</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Batch Yield</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Version</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipes.map((rcp) => (
                          <tr key={rcp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
                              {rcp.code}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>
                              {rcp.name}
                              {rcp.description && (
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                                  {rcp.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#334155' }}>
                              {rcp.outputVariantName}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                              {rcp.expectedYieldQuantity} {rcp.outputUnitCode}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  background: '#e0e7ff',
                                  color: '#3730a3',
                                  padding: '2px 7px',
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                v{rcp.currentVersion?.versionNumber ?? 1}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: rcp.isActive ? '#dcfce7' : '#f1f5f9',
                                  color: rcp.isActive ? '#15803d' : '#64748b',
                                }}
                              >
                                {rcp.isActive ? 'Active' : 'Archived'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: '#059669',
                                  }}
                                  onClick={() => {
                                    setRunRecipeId(String(rcp.id));
                                    setRunBatchCount('1');
                                    setShowCreateRunModal(true);
                                  }}
                                >
                                  + Plan Run
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                                  onClick={async () => {
                                    if (window.bakery?.production) {
                                      const res = await window.bakery.production.getRecipe(rcp.id);
                                      if (res.success) setSelectedRecipeDetail(res.data);
                                    }
                                  }}
                                >
                                  View BOM
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {recipes.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No master recipes registered yet. Click "+ Create New Recipe" to specify your BOMs.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: CUSTOM ORDERS & ADVANCE BOOKINGS */}
          {activeTab === 'custom-orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Feedback Message */}
              {customOrdersMsg && (
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: customOrdersMsg.startsWith('Error') ? '#fef2f2' : '#ecfdf5',
                    border: `1px solid ${customOrdersMsg.startsWith('Error') ? '#fecaca' : '#a7f3d0'}`,
                    color: customOrdersMsg.startsWith('Error') ? '#dc2626' : '#059669',
                    fontWeight: 500,
                  }}
                >
                  <span>{customOrdersMsg}</span>
                  <button
                    type="button"
                    onClick={() => setCustomOrdersMsg(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Top Action Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCustomOrdersFilter('all')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      background: customOrdersFilter === 'all' ? '#0284c7' : '#f1f5f9',
                      color: customOrdersFilter === 'all' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All Orders ({customOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomOrdersFilter('today')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      background: customOrdersFilter === 'today' ? '#ea580c' : '#f1f5f9',
                      color: customOrdersFilter === 'today' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ⚠️ Due Today ({
                      customOrders.filter((o) => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        return o.dueDateUtc.slice(0, 10) === todayStr;
                      }).length
                    })
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomOrdersFilter('upcoming')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      background: customOrdersFilter === 'upcoming' ? '#0284c7' : '#f1f5f9',
                      color: customOrdersFilter === 'upcoming' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    📅 Upcoming (7 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomOrdersFilter('ready')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      background: customOrdersFilter === 'ready' ? '#059669' : '#f1f5f9',
                      color: customOrdersFilter === 'ready' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ✨ Ready for Pickup ({customOrders.filter((o) => o.status === 'READY').length})
                  </button>
                </div>

                {/* Primary Actions */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      loadCustomOrders();
                      loadCustomers();
                    }}
                    style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 600 }}
                    title="Refresh data"
                  >
                    🔄 Refresh
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowCreateCustomerModal(true)}
                    style={{ padding: '7px 12px', fontSize: '12px', fontWeight: 600 }}
                  >
                    👤 + Register Customer
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setShowCreateOrderModal(true);
                      if (!ordDueDate) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(16, 0, 0, 0);
                        const tzOffset = tomorrow.getTimezoneOffset() * 60000;
                        const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
                        setOrdDueDate(localISOTime);
                      }
                    }}
                    style={{
                      padding: '7px 16px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                    }}
                  >
                    🎂 + Book Custom Order
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    🎂
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Total Bookings
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      {customOrders.length}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: '#fff7ed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    👨‍🍳
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      In Kitchen / Baking
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#ea580c' }}>
                      {customOrders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION').length}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: '#ecfdf5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    ✨
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Ready For Pickup
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
                      {customOrders.filter((o) => o.status === 'READY').length}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    💰
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Uncollected Balance Due
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>
                      Rs. {(
                        customOrders
                          .filter((o) => o.status !== 'COLLECTED' && o.status !== 'CANCELLED')
                          .reduce((acc, o) => acc + o.balanceAmountMinorUnits, 0) / 100
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Orders Master Table */}
              <div className="panel-card">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="panel-title">Active Cake Bookings & Custom Orders</span>
                    <span className="panel-badge ok">Local-First</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {customOrdersLoading ? 'Loading orders...' : `Showing ${customOrders.filter((order) => {
                      if (customOrdersFilter === 'ready') return order.status === 'READY';
                      if (customOrdersFilter === 'today') {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        return order.dueDateUtc.slice(0, 10) === todayStr;
                      }
                      if (customOrdersFilter === 'upcoming') {
                        const now = new Date();
                        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        const dueDate = new Date(order.dueDateUtc);
                        return dueDate >= now && dueDate <= sevenDaysLater;
                      }
                      return true;
                    }).length
                      } orders`}
                  </span>
                </div>

                <div className="panel-body" style={{ padding: 0 }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Order #</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Customer</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Cake Specifications & Inscription</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Pickup Due</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Agreed Total</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Deposit Paid</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Balance Due</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customOrders
                          .filter((order) => {
                            if (customOrdersFilter === 'ready') return order.status === 'READY';
                            if (customOrdersFilter === 'today') {
                              const todayStr = new Date().toISOString().slice(0, 10);
                              return order.dueDateUtc.slice(0, 10) === todayStr;
                            }
                            if (customOrdersFilter === 'upcoming') {
                              const now = new Date();
                              const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                              const dueDate = new Date(order.dueDateUtc);
                              return dueDate >= now && dueDate <= sevenDaysLater;
                            }
                            return true;
                          })
                          .map((order) => {
                            const isToday = order.dueDateUtc.slice(0, 10) === new Date().toISOString().slice(0, 10);
                            const isOverdue = new Date(order.dueDateUtc) < new Date() && order.status !== 'COLLECTED' && order.status !== 'CANCELLED';

                            return (
                              <tr key={order.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {/* Order # */}
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '13px' }}>
                                    {order.orderNumber}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {order.createdAtUtc ? new Date(order.createdAtUtc).toLocaleDateString() : ''}
                                  </div>
                                </td>

                                {/* Customer */}
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                    {order.customer?.name || 'Walk-in Customer'}
                                  </div>
                                  {order.customer?.phone && (
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      📞 {order.customer.phone}
                                    </div>
                                  )}
                                </td>

                                {/* Cake Specs */}
                                <td style={{ padding: '10px 14px', maxWidth: '300px' }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' }}>
                                    {order.cakeFlavor && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          background: '#fef3c7',
                                          color: '#92400e',
                                          fontWeight: 600,
                                        }}
                                      >
                                        🎂 {order.cakeFlavor}
                                      </span>
                                    )}
                                    {order.cakeSize && (
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          padding: '2px 7px',
                                          borderRadius: '4px',
                                          background: '#f1f5f9',
                                          color: '#475569',
                                          fontWeight: 600,
                                        }}
                                      >
                                        ⚖️ {order.cakeSize}
                                      </span>
                                    )}
                                  </div>
                                  {order.cakeMessage && (
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        fontStyle: 'italic',
                                        color: '#0369a1',
                                        background: '#f0f9ff',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        borderLeft: '2px solid #0284c7',
                                        marginTop: '4px',
                                      }}
                                    >
                                      “{order.cakeMessage}”
                                    </div>
                                  )}
                                  {order.decorationNotes && (
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                      🎨 {order.decorationNotes}
                                    </div>
                                  )}
                                </td>

                                {/* Due Date */}
                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                  <div style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : '#1e293b' }}>
                                    {formatDateTime(order.dueDateUtc)}
                                  </div>
                                  {isToday && order.status !== 'COLLECTED' && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        background: '#ea580c',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        display: 'inline-block',
                                        marginTop: '2px',
                                      }}
                                    >
                                      DUE TODAY
                                    </span>
                                  )}
                                  {isOverdue && !isToday && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        background: '#dc2626',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        display: 'inline-block',
                                        marginTop: '2px',
                                      }}
                                    >
                                      OVERDUE
                                    </span>
                                  )}
                                </td>

                                {/* Total Price */}
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                                  Rs. {(order.totalAmountMinorUnits / 100).toFixed(2)}
                                </td>

                                {/* Deposit Paid */}
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                                  Rs. {(order.depositAmountMinorUnits / 100).toFixed(2)}
                                </td>

                                {/* Balance Due */}
                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  {order.balanceAmountMinorUnits > 0 ? (
                                    <span style={{ fontWeight: 700, color: '#dc2626' }}>
                                      Rs. {(order.balanceAmountMinorUnits / 100).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        fontWeight: 700,
                                      }}
                                    >
                                      ✓ Paid
                                    </span>
                                  )}
                                </td>

                                {/* Status */}
                                <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {order.status === 'CONFIRMED' && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        fontWeight: 700,
                                        border: '1px solid #bfdbfe',
                                      }}
                                    >
                                      Confirmed
                                    </span>
                                  )}
                                  {order.status === 'IN_PRODUCTION' && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background: '#fff7ed',
                                        color: '#c2410c',
                                        fontWeight: 700,
                                        border: '1px solid #fed7aa',
                                      }}
                                    >
                                      👨‍🍳 In Kitchen
                                    </span>
                                  )}
                                  {order.status === 'READY' && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background: '#ecfdf5',
                                        color: '#047857',
                                        fontWeight: 700,
                                        border: '1px solid #a7f3d0',
                                      }}
                                    >
                                      ✨ Ready
                                    </span>
                                  )}
                                  {order.status === 'COLLECTED' && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background: '#f8fafc',
                                        color: '#334155',
                                        fontWeight: 700,
                                        border: '1px solid #cbd5e1',
                                      }}
                                    >
                                      ✓ Delivered
                                    </span>
                                  )}
                                  {order.status === 'CANCELLED' && (
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        padding: '3px 9px',
                                        borderRadius: '12px',
                                        background: '#fef2f2',
                                        color: '#b91c1c',
                                        fontWeight: 700,
                                        border: '1px solid #fecaca',
                                      }}
                                    >
                                      Cancelled
                                    </span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                    {order.status === 'CONFIRMED' && (
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#c2410c' }}
                                        onClick={() => handleUpdateOrderStatus(order.id, 'IN_PRODUCTION')}
                                        title="Send to kitchen for baking"
                                      >
                                        👨‍🍳 Bake
                                      </button>
                                    )}

                                    {order.status === 'IN_PRODUCTION' && (
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: '#047857' }}
                                        onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                                        title="Mark cake finished & ready for pickup"
                                      >
                                        ✨ Ready
                                      </button>
                                    )}

                                    {order.status === 'READY' && order.balanceAmountMinorUnits > 0 && (
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, background: '#059669' }}
                                        onClick={() => {
                                          setPaymentTargetOrder(order);
                                          setOrderPayAmountRs((order.balanceAmountMinorUnits / 100).toFixed(2));
                                          setShowOrderPaymentModal(true);
                                        }}
                                        title="Collect balance amount from customer"
                                      >
                                        💰 Collect
                                      </button>
                                    )}

                                    {order.status === 'READY' && order.balanceAmountMinorUnits === 0 && (
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, background: '#0f766e' }}
                                        onClick={() => handleUpdateOrderStatus(order.id, 'COLLECTED')}
                                        title="Hand over cake to customer"
                                      >
                                        🎁 Handover
                                      </button>
                                    )}

                                    {order.status !== 'COLLECTED' && order.status !== 'CANCELLED' && order.balanceAmountMinorUnits > 0 && order.status !== 'READY' && (
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
                                        onClick={() => {
                                          setPaymentTargetOrder(order);
                                          setOrderPayAmountRs((order.balanceAmountMinorUnits / 100).toFixed(2));
                                          setShowOrderPaymentModal(true);
                                        }}
                                        title="Record advance or partial payment"
                                      >
                                        + Pay
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
                                      onClick={() => setSelectedOrderDetail(order)}
                                      title="View complete order details & sheet"
                                    >
                                      Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}

                        {customOrders.length === 0 && (
                          <tr>
                            <td colSpan={9} style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎂</div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                                No Custom Orders Yet
                              </div>
                              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                Click "+ Book Custom Order" to record advance cake bookings with flavor, size, and advance deposits.
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BARCODE SCANNER TEST */}
          {activeTab === 'scanner' && (
            <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="panel-card">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>⚡</span>
                    <span className="panel-title">USB Barcode Scanner Resolver & Hardware Test</span>
                  </div>
                  <span className="panel-badge ok">Scanner Ready (Auto-Listening)</span>
                </div>
                <div className="panel-body">
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '12.5px',
                      lineHeight: 1.5,
                      color: '#334155',
                    }}
                  >
                    <strong>💡 How to test your scanner:</strong>
                    <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                      <li>Connect your barcode scanner to any USB port on this PC.</li>
                      <li>Point the scanner laser/light at any product barcode or label.</li>
                      <li>Press the trigger. The scanner will beep and instantly test resolution below!</li>
                    </ol>
                  </div>

                  <form onSubmit={handleBarcodeLookup} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                    <input
                      ref={scanInputRef}
                      type="text"
                      placeholder="Scan product barcode with scanner here..."
                      value={scanQuery}
                      onChange={(e) => setScanQuery(e.target.value)}
                      className="form-input"
                      style={{ flex: 1, fontSize: '15px', padding: '9px 12px', fontWeight: 600 }}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0 18px', fontWeight: 700 }}>
                      Resolve
                    </button>
                  </form>

                  {scanLatency !== null && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      ⚡ Roundtrip IPC Resolution Latency: <strong style={{ color: '#0f172a' }}>{scanLatency} ms</strong> (100% Local SQLite)
                    </div>
                  )}

                  {scanMsg && (
                    <div className="status-banner unhealthy" style={{ marginBottom: '14px' }}>
                      {scanMsg}
                    </div>
                  )}

                  {resolvedBarcode && (
                    <div style={{ border: '1.5px solid #10b981', background: '#ecfdf5', borderRadius: '8px', padding: '16px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3 style={{ color: '#065f46', fontSize: '17px', fontWeight: 800, margin: 0 }}>
                          ✓ {resolvedBarcode.product.name}
                        </h3>
                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: '#d1fae5', color: '#065f46', fontWeight: 700 }}>
                          Catalog Match
                        </span>
                      </div>
                      <table className="data-table">
                        <tbody>
                          <tr><td className="label">Barcode Scanned</td><td className="value" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{resolvedBarcode.barcodeValue}</td></tr>
                          <tr><td className="label">SKU</td><td className="value">{resolvedBarcode.variant.sku}</td></tr>
                          <tr><td className="label">Retail Price</td><td className="value ok" style={{ fontSize: '15px', fontWeight: 800 }}>Rs. {(resolvedBarcode.variant.priceMinorUnits / 100).toFixed(2)}</td></tr>
                          <tr><td className="label">Base Unit</td><td className="value">{resolvedBarcode.baseUnitCode}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Recent Scans Table */}
                  {recentScans.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                        Recent Scan Test Log ({recentScans.length})
                      </div>
                      <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Time</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Barcode</th>
                            <th style={{ textAlign: 'left', padding: '6px 8px' }}>Product</th>
                            <th style={{ textAlign: 'right', padding: '6px 8px' }}>Price</th>
                            <th style={{ textAlign: 'center', padding: '6px 8px' }}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentScans.map((s) => (
                            <tr key={s.id}>
                              <td style={{ padding: '6px 8px', color: '#64748b' }}>{s.time}</td>
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700 }}>{s.barcode}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{s.productName || '—'}</td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: s.priceRs ? '#059669' : '#94a3b8' }}>
                                {s.priceRs ? `Rs. ${s.priceRs.toFixed(2)}` : '—'}
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: s.success ? '#dcfce7' : '#fee2e2',
                                    color: s.success ? '#166534' : '#991b1b',
                                  }}
                                >
                                  {s.success ? `✓ Found (${s.latencyMs}ms)` : '✗ Not in DB'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <>
              {diagError ? (
                <div className="status-banner unhealthy">
                  <div>
                    <h2>Diagnostic Check Failed</h2>
                    <p>{diagError}</p>
                  </div>
                  <span className="panel-badge down">ERROR</span>
                </div>
              ) : (
                <div className={`status-banner ${isHealthy ? 'ok' : 'unhealthy'}`}>
                  <div>
                    <h2>
                      {isHealthy ? 'System Health: Normal' : `System Health: ${health?.status?.toUpperCase() ?? 'CHECKING'}`}
                    </h2>
                    <p>
                      Roundtrip IPC latency: <strong>{health?.latencyMs ?? 0}ms</strong> · SQLite foreign keys and WAL mode active.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-primary" onClick={runDiagnostics} disabled={diagLoading}>
                      {diagLoading ? 'Probing...' : 'Refresh'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleExportDiagnosticsBundle}
                      title="Export system, database health and backup diagnostics as a JSON bundle"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📦 Export Diagnostic Bundle
                    </button>
                  </div>
                </div>
              )}

              <div className="panels-grid">
                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">SQLite Local Database</span>
                    <span className={`panel-badge ${health?.database?.status === 'ok' ? 'ok' : 'down'}`}>
                      {health?.database?.status?.toUpperCase() ?? 'DOWN'}
                    </span>
                  </div>
                  <div className="panel-body">
                    <table className="data-table">
                      <tbody>
                        <tr><td className="label">Driver</td><td className="value">{health?.database?.driver ?? 'better-sqlite3'}</td></tr>
                        <tr><td className="label">Foreign Keys</td><td className="value ok">{health?.database?.foreignKeysEnabled ? 'Enabled (ON)' : 'Disabled'}</td></tr>
                        <tr><td className="label">Journal Mode</td><td className="value ok">{health?.database?.journalMode?.toUpperCase() ?? 'WAL'}</td></tr>
                        <tr><td className="label">Integrity Check</td><td className="value ok">{health?.database?.integrityOk ? 'Passed (ok)' : 'Failed'}</td></tr>
                        <tr><td className="label">Schema Version</td><td className="value">v{health?.database?.currentSchemaVersion ?? '1.0.0'}</td></tr>
                        <tr><td className="label">Data Path</td><td className="value" title={health?.database?.filePath}>{health?.database?.filePath ?? 'AppData/...'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">NestJS Context</span>
                    <span className={`panel-badge ${health?.nestjs?.status === 'ok' ? 'ok' : 'down'}`}>
                      {health?.nestjs?.status?.toUpperCase() ?? 'DOWN'}
                    </span>
                  </div>
                  <div className="panel-body">
                    <table className="data-table">
                      <tbody>
                        <tr><td className="label">HTTP Server</td><td className="value ok">None (Headless)</td></tr>
                        <tr><td className="label">Uptime</td><td className="value">{health?.nestjs?.uptimeSeconds ?? 0}s</td></tr>
                        <tr><td className="label">Validation</td><td className="value ok">Zod Strict</td></tr>
                        <tr><td className="label">TypeORM sync</td><td className="value ok">Disabled (false)</td></tr>
                        <tr><td className="label">Database Module</td><td className="value">Injected via DI</td></tr>
                        <tr><td className="label">Active Store</td><td className="value">{store?.name ?? 'Not Configured (Ready)'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel-card">
                  <div className="panel-header">
                    <span className="panel-title">Desktop Runtime</span>
                    <span className="panel-badge ok">SECURE</span>
                  </div>
                  <div className="panel-body">
                    <table className="data-table">
                      <tbody>
                        <tr><td className="label">Electron</td><td className="value">v{systemInfo?.electronVersion ?? '35.0.0'}</td></tr>
                        <tr><td className="label">Node Engine</td><td className="value">v{systemInfo?.nodeVersion ?? '22'}</td></tr>
                        <tr><td className="label">Platform</td><td className="value">{systemInfo?.platform} ({systemInfo?.arch})</td></tr>
                        <tr><td className="label">Context Isolation</td><td className="value ok">Enabled</td></tr>
                        <tr><td className="label">Node Integration</td><td className="value ok">Disabled</td></tr>
                        <tr><td className="label">User Data Path</td><td className="value" title={systemInfo?.userDataPath}>{systemInfo?.userDataPath}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 6: SALES & SHIFT REPORTS */}
          {activeTab === 'reports' && (
            <div>
              {/* Sub-Tabs Header Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className={`tab-btn ${reportsSubTab === 'pnl' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 700, padding: '8px 16px' }}
                    onClick={() => setReportsSubTab('pnl')}
                  >
                    📈 Profit & Loss (P&L)
                  </button>
                  <button
                    className={`tab-btn ${reportsSubTab === 'sales' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px' }}
                    onClick={() => setReportsSubTab('sales')}
                  >
                    📜 Sales Invoices & Receipts
                  </button>
                  <button
                    className={`tab-btn ${reportsSubTab === 'shifts' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px' }}
                    onClick={() => setReportsSubTab('shifts')}
                  >
                    ⏱️ Cashier Shift Reconciliation (X/Z Reports)
                  </button>
                  <button
                    className={`tab-btn ${reportsSubTab === 'backup' ? 'active' : ''}`}
                    style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px' }}
                    onClick={() => {
                      setReportsSubTab('backup');
                      loadBackups();
                    }}
                  >
                    💾 Database Backups & Recovery
                  </button>
                </div>
                <button
                  className="tab-btn"
                  style={{ fontSize: '12px', padding: '6px 14px' }}
                  disabled={reportLoading || backupLoading}
                  onClick={() => {
                    if (reportsSubTab === 'backup') {
                      loadBackups();
                    } else {
                      loadRecentSales();
                      loadShiftsList();
                    }
                  }}
                >
                  {reportLoading || backupLoading ? 'Loading...' : '🔄 Refresh Data'}
                </button>
              </div>

              {/* SUB-VIEW 1: SALES INVOICES & REPRINT */}
              {reportsSubTab === 'sales' && (
                <div>
                  {/* Filter & Summary Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, maxWidth: '340px' }}>
                      <input
                        type="text"
                        placeholder="Search invoices by invoice #..."
                        value={salesSearch}
                        onChange={(e) => setSalesSearch(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '13px', padding: '8px 12px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#4b5563' }}>
                      <span>
                        Total Invoices: <strong>{recentSales.length}</strong>
                      </span>
                      <span>
                        Total Revenue:{' '}
                        <strong style={{ color: '#059669' }}>
                          Rs.{' '}
                          {(
                            recentSales.reduce((acc, s) => acc + s.totalMinorUnits, 0) / 100
                          ).toFixed(2)}
                        </strong>
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 14px' }}
                        onClick={handleExportSalesCsv}
                        title="Export invoices list to CSV for Microsoft Excel"
                      >
                        <span>📥</span>
                        <span>Export CSV (Excel)</span>
                      </button>
                    </div>
                  </div>

                  {/* Sales Table */}
                  <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr
                          style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            color: '#475569',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Invoice #</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Date & Time</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Items</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Total Amount</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', width: '170px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSales
                          .filter((s) =>
                            salesSearch.trim()
                              ? s.invoiceNumber.toLowerCase().includes(salesSearch.toLowerCase())
                              : true,
                          )
                          .map((sale) => (
                            <tr
                              key={sale.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                                {sale.invoiceNumber}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                {formatDateTime(sale.createdAtUtc)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                                {sale.itemCount ?? 1} items
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, color: '#059669', fontSize: '14px' }}>
                                  Rs. {(sale.totalMinorUnits / 100).toFixed(2)}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span className="panel-badge ok">{sale.status.toUpperCase()}</span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="tab-btn"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                  }}
                                  onClick={() => handleReprintReceipt(sale.id)}
                                >
                                  📄 View / Print Receipt
                                </button>
                              </td>
                            </tr>
                          ))}
                        {recentSales.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No sales recorded yet. Completed POS sales will appear here.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 2: SHIFTS LIST & RECONCILIATION */}
              {reportsSubTab === 'shifts' && (
                <div>
                  <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr
                          style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            color: '#475569',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Shift Code</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Opened</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Closed</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Opening Float</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Expected Drawer Cash</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Cash Variance</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', width: '160px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shiftsList.map((shift) => {
                          const isClosed = shift.status === 'closed';
                          const variance = shift.varianceMinorUnits ?? 0;

                          return (
                            <tr
                              key={shift.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background-color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                                {shift.shiftCode || `#${shift.id}`}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                {formatDateTime(shift.openedAtUtc)}
                              </td>
                              <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                {shift.closedAtUtc ? formatDateTime(shift.closedAtUtc) : 'Active / Open'}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span
                                  className={`panel-badge ${shift.status === 'open' ? 'ok' : 'info'}`}
                                  style={{
                                    background: shift.status === 'open' ? '#ecfdf5' : '#f1f5f9',
                                    color: shift.status === 'open' ? '#065f46' : '#475569',
                                    border: `1px solid ${shift.status === 'open' ? '#a7f3d0' : '#cbd5e1'}`,
                                  }}
                                >
                                  {shift.status === 'open' ? '🟢 OPEN' : '⚪ CLOSED'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>
                                Rs. {(shift.openingFloatMinorUnits / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                Rs. {(shift.expectedCashMinorUnits / 100).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                {!isClosed ? (
                                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>In Progress</span>
                                ) : variance === 0 ? (
                                  <span style={{ color: '#059669', fontWeight: 700 }}>Rs. 0.00 (Balanced)</span>
                                ) : variance < 0 ? (
                                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                    -Rs. {(Math.abs(variance) / 100).toFixed(2)} (Shortage)
                                  </span>
                                ) : (
                                  <span style={{ color: '#0284c7', fontWeight: 700 }}>
                                    +Rs. {(variance / 100).toFixed(2)} (Overage)
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-primary"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    borderRadius: '4px',
                                  }}
                                  onClick={() => handleOpenShiftReport(shift.id)}
                                >
                                  📊 View Shift Report
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {shiftsList.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#9ca3af' }}>
                              No cashier shifts found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: DATABASE BACKUPS & DISASTER RECOVERY */}
              {reportsSubTab === 'backup' && (
                <div>
                  {/* Feedback Message Alert */}
                  {backupActionMsg && (
                    <div
                      className={`status-banner ${backupActionMsg.type === 'ok' ? 'ok' : 'unhealthy'}`}
                      style={{
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{backupActionMsg.type === 'ok' ? '✅' : '⚠️'}</span>
                        <span style={{ fontWeight: 600 }}>{backupActionMsg.text}</span>
                      </div>
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '16px',
                          color: '#4b5563',
                        }}
                        onClick={() => setBackupActionMsg(null)}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Header / Actions Toolbar */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
                        Local-First SQLite Database Backups
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748b' }}>
                        Consistent WAL-checkpointed online snapshots with SHA-256 cryptographic verification and safety guarantees.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px' }}
                        onClick={handleOpenBackupFolder}
                        title="Open backups directory in Windows File Explorer"
                      >
                        <span>📁</span>
                        <span>Open Folder</span>
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 16px' }}
                        onClick={() => setShowCreateBackupModal(true)}
                        disabled={backupLoading}
                      >
                        <span>💾</span>
                        <span>Create Backup Snapshot</span>
                      </button>
                    </div>
                  </div>

                  {/* System & Storage KPI Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div className="panel-card" style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Total Retained Snapshots
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                        {backupStatus?.totalBackups ?? backupsList.length}
                      </div>
                      <div style={{ fontSize: '11px', color: '#059669', marginTop: '2px' }}>
                        Max retention: 15 (auto-pruned)
                      </div>
                    </div>

                    <div className="panel-card" style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Last Successful Backup
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
                        {backupStatus?.lastBackupAtUtc ? formatDateTime(backupStatus.lastBackupAtUtc) : 'No backup yet'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Online WAL flush & sealed
                      </div>
                    </div>

                    <div className="panel-card" style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Total Storage Used
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                        {backupStatus ? ((backupStatus.totalSizeBytes / 1024) / 1024).toFixed(2) + ' MB' : '0.00 MB'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Compact SQLite snapshots
                      </div>
                    </div>

                    <div className="panel-card" style={{ padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                        Disaster Recovery
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7', marginTop: '6px' }}>
                        Pre-Restore Safety Active
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Automatic fallback snapshot before restore
                      </div>
                    </div>
                  </div>

                  {/* Backups List Table */}
                  <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr
                          style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            color: '#475569',
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Snapshot File</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Created Date & Time</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px' }}>Size</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>SHA-256 Checksum</th>
                          <th style={{ textAlign: 'left', padding: '10px 14px' }}>Notes / Reason</th>
                          <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                          <th style={{ textAlign: 'center', padding: '10px 14px', width: '220px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backupsList.map((bk) => (
                          <tr
                            key={bk.filename}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              transition: 'background-color 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                              <span style={{ marginRight: '6px' }}>📦</span>
                              {bk.filename}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                              {formatDateTime(bk.createdAtUtc)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>
                              {(bk.sizeBytes / 1024).toFixed(0)} KB
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                              <span title={bk.checksumSha256}>
                                {bk.checksumSha256.slice(0, 10)}...{bk.checksumSha256.slice(-6)}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#334155', fontSize: '12px' }}>
                              {bk.notes || <em style={{ color: '#94a3b8' }}>Routine snapshot</em>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span
                                className="panel-badge ok"
                                style={{
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                }}
                              >
                                ✅ VERIFIED
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px' }}
                                  onClick={() => handleVerifyBackup(bk.filename)}
                                  title="Recalculate SHA-256 and run SQLite integrity pragma"
                                >
                                  🔍 Verify
                                </button>
                                <button
                                  type="button"
                                  className="tab-btn"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff1f2',
                                    color: '#e11d48',
                                    borderColor: '#fecdd3',
                                    fontWeight: 600,
                                  }}
                                  onClick={() => {
                                    setSelectedBackupToRestore(bk);
                                    setRestoreConfirmChecked(false);
                                    setShowRestoreModal(true);
                                  }}
                                  title="Restore database to this snapshot with emergency pre-restore safety copy"
                                >
                                  🔄 Restore
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {backupsList.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                              {backupLoading ? 'Scanning backups...' : 'No backup snapshots found. Click "Create Backup Snapshot" to take one now.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 4: PROFIT & LOSS (P&L) ANALYTICS */}
              {reportsSubTab === 'pnl' && (
                <ProfitLossTab
                  store={store}
                  categories={categories}
                  products={products}
                  suppliers={suppliers}
                />
              )}
            </div>
          )}

          {/* TAB: STOCK & INVENTORY MANAGEMENT */}
          {activeTab === 'inventory' && (
            <InventoryTab storeId={store?.id || 1} />
          )}

          {/* TAB: STAFF & USERS RBAC MANAGEMENT */}
          {activeTab === 'users' && session.role === 'admin' && (
            <UsersTab
              storeId={store?.id || 1}
              currentUserId={session.id}
              currentUserRole={session.role}
              onRoleOrUserUpdated={refreshSession}
            />
          )}

          {/* TAB: EXPENSES & SALARIES (PAYROLL) */}
          {activeTab === 'expenses' && (
            <ExpensesTab
              storeId={store?.id || 1}
              currentUserId={session.id}
              currentUserName={session.displayName}
              currentUserRole={session.role}
            />
          )}
        </div>
      </main>

      {/* MODAL: CREATE BACKUP SNAPSHOT */}
      {showCreateBackupModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💾</span>
              <span>Create Database Backup Snapshot</span>
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
              This operation triggers an immediate WAL checkpoint, copies the database file safely, and seals it with a cryptographic SHA-256 checksum and metadata manifest.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateBackup();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label className="form-label">Snapshot Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. End of Day Cashier Closing, Pre-Stock Count"
                  value={newBackupNote}
                  onChange={(e) => setNewBackupNote(e.target.value)}
                  className="form-input"
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateBackupModal(false)}
                  disabled={backupLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={backupLoading}
                >
                  {backupLoading ? 'Creating Snapshot...' : 'Create Snapshot Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM RESTORE DISASTER RECOVERY */}
      {showRestoreModal && selectedBackupToRestore && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '520px', borderTop: '4px solid #e11d48' }}>
            <h3 style={{ marginBottom: '10px', color: '#be123c', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>⚠️</span>
              <span>Confirm Database Restoration</span>
            </h3>

            <div
              style={{
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: '6px',
                padding: '12px 14px',
                marginBottom: '14px',
                fontSize: '12px',
                color: '#9f1239',
                lineHeight: 1.5,
              }}
            >
              <strong>Critical Operation:</strong> You are about to replace the live active database with snapshot:
              <div style={{ marginTop: '6px', fontFamily: 'monospace', fontWeight: 700, color: '#881337' }}>
                {selectedBackupToRestore.filename}
              </div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: '#4c0519' }}>
                Created: {formatDateTime(selectedBackupToRestore.createdAtUtc)} · Size: {(selectedBackupToRestore.sizeBytes / 1024).toFixed(0)} KB
              </div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '14px',
                fontSize: '12px',
                color: '#166534',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>🛡️</span>
              <div>
                <strong>Automated Safety Guarantee:</strong>
                <div>
                  Before overwriting the active database, the system will automatically create an emergency safety copy (<code>safety-before-restore-*.db</code>) so your current state can always be recovered.
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={restoreConfirmChecked}
                  onChange={(e) => setRestoreConfirmChecked(e.target.checked)}
                  disabled={restoringInProgress}
                />
                <span>I understand and confirm I want to restore this snapshot now.</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedBackupToRestore(null);
                  setRestoreConfirmChecked(false);
                }}
                disabled={restoringInProgress}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{
                  backgroundColor: '#e11d48',
                  borderColor: '#be123c',
                  opacity: restoreConfirmChecked && !restoringInProgress ? 1 : 0.5,
                  cursor: restoreConfirmChecked && !restoringInProgress ? 'pointer' : 'not-allowed',
                }}
                disabled={!restoreConfirmChecked || restoringInProgress}
                onClick={handleRestoreBackup}
              >
                {restoringInProgress ? 'Restoring Database...' : 'Confirm & Restore Live Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OPEN SHIFT */}
      {showOpenShiftModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: '12px' }}>Open Cashier Shift</h3>
            <form onSubmit={handleOpenShiftSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label">Cashier Name / ID</label>
                <input
                  type="text"
                  value={openCashier}
                  onChange={(e) => setOpenCashier(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Opening Float Cash in Drawer (PKR / Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={openFloatRs}
                  onChange={(e) => setOpenFloatRs(e.target.value)}
                  className="form-input"
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowOpenShiftModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm & Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE SHIFT */}
      {showCloseShiftModal && activeShift && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: '12px' }}>Close Cashier Shift</h3>
            <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '4px', marginBottom: '12px' }}>
              <div>Expected Cash in Drawer: <strong>Rs. {(activeShift.expectedCashMinorUnits / 100).toFixed(2)}</strong></div>
            </div>
            <form onSubmit={handleCloseShiftSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label">Counted Physical Cash in Drawer (PKR / Rs.) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={countedCashRs}
                  onChange={(e) => setCountedCashRs(e.target.value)}
                  className="form-input"
                  required
                  autoFocus
                />
              </div>
              {countedCashRs !== '' && (
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  Variance:{' '}
                  <span
                    style={{
                      color:
                        Math.round(parseFloat(countedCashRs) * 100) === activeShift.expectedCashMinorUnits
                          ? '#059669'
                          : '#dc2626',
                    }}
                  >
                    Rs.{' '}
                    {(
                      (Math.round(parseFloat(countedCashRs) * 100) - activeShift.expectedCashMinorUnits) /
                      100
                    ).toFixed(2)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCloseShiftModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}>
                  Close & Lock Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POS WEIGHT & RUPEE AMOUNT SELECTOR */}
      {weightModalTarget && (
        <PosWeightAmountModal
          target={weightModalTarget}
          onClose={() => setWeightModalTarget(null)}
          onConfirm={handleConfirmWeightModal}
        />
      )}

      {/* MODAL: CASH CHECKOUT */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Cash Sale Checkout</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowCheckoutModal(false);
                  setPosError(null);
                }}
                style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {posError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#991b1b',
                  fontSize: '12px',
                  lineHeight: 1.4,
                  marginBottom: '14px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
                <div>
                  <strong>Checkout Blocked:</strong>
                  <div style={{ marginTop: '2px' }}>{posError}</div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#b91c1c' }}>
                    💡 <em>Tip: To allow sales when stock is 0 or unreceived, go to <strong>Stock &amp; Inventory</strong> and enable <strong>Allow Negative Stock</strong>.</em>
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '14px',
                borderRadius: '6px',
                marginBottom: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Amount Due
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#065f46', marginTop: '2px' }}>
                Rs. {(cartTotalMinor / 100).toFixed(2)}
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '13px' }}>
                  Amount Received (Cash Tendered) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: '#6b7280', fontSize: '15px' }}>
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Enter cash received (e.g. 550)..."
                    value={tenderedRs}
                    onChange={(e) => setTenderedRs(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="form-input"
                    style={{ fontSize: '20px', fontWeight: 700, padding: '10px 12px 10px 42px', color: '#111827' }}
                    required
                    autoFocus
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                  Type amount received on keyboard / numpad (e.g. 550), or click a banknote below.
                </div>
              </div>

              {/* Quick Cash Buttons - Only real banknotes (100, 500, 1000, 5000) strictly > Total Due */}
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: 500 }}>
                  Banknotes / Quick Tender:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="tab-btn"
                    style={{
                      flex: 1,
                      minWidth: '85px',
                      padding: '8px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: parseFloat(tenderedRs || '0') === cartTotalMinor / 100 ? '#e0f2fe' : undefined,
                      borderColor: parseFloat(tenderedRs || '0') === cartTotalMinor / 100 ? '#0284c7' : undefined,
                    }}
                    onClick={() => setTenderedRs((cartTotalMinor / 100).toString())}
                  >
                    Exact (Rs. {(cartTotalMinor / 100).toFixed(0)})
                  </button>
                  {getAvailableNoteButtons(cartTotalMinor / 100).map((denom) => (
                    <button
                      key={denom}
                      type="button"
                      className="tab-btn"
                      style={{
                        flex: 1,
                        minWidth: '85px',
                        padding: '8px 8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: parseFloat(tenderedRs || '0') === denom ? '#e0f2fe' : undefined,
                        borderColor: parseFloat(tenderedRs || '0') === denom ? '#0284c7' : undefined,
                      }}
                      onClick={() => setTenderedRs(denom.toString())}
                    >
                      Rs. {denom.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Return / Change Calculation */}
              {(() => {
                const tenderedVal = parseFloat(tenderedRs || '0');
                const tenderedMinor = Math.round(tenderedVal * 100);
                const diffMinor = tenderedMinor - cartTotalMinor;

                if (!tenderedRs || isNaN(tenderedVal)) return null;

                if (diffMinor >= 0) {
                  return (
                    <div
                      style={{
                        background: '#ecfdf5',
                        border: '1px solid #10b981',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Change Due (Return Amount)
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857' }}>
                          Return exact cash to customer
                        </div>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#047857' }}>
                        Rs. {(diffMinor / 100).toFixed(2)}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #f87171',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Remaining Due (Shortage)
                        </div>
                        <div style={{ fontSize: '11px', color: '#b91c1c' }}>
                          Customer needs to provide more cash
                        </div>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626' }}>
                        Rs. {(Math.abs(diffMinor) / 100).toFixed(2)}
                      </div>
                    </div>
                  );
                }
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowCheckoutModal(false); setPosError(null); }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!tenderedRs || Math.round(parseFloat(tenderedRs || '0') * 100) < cartTotalMinor}
                  style={{
                    backgroundColor:
                      !tenderedRs || Math.round(parseFloat(tenderedRs || '0') * 100) < cartTotalMinor
                        ? '#9ca3af'
                        : '#059669',
                    borderColor:
                      !tenderedRs || Math.round(parseFloat(tenderedRs || '0') * 100) < cartTotalMinor
                        ? '#9ca3af'
                        : '#047857',
                    padding: '8px 18px',
                    fontSize: '13px',
                    cursor:
                      !tenderedRs || Math.round(parseFloat(tenderedRs || '0') * 100) < cartTotalMinor
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  Confirm Sale (Print Receipt)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIPT PREVIEW (80mm Thermal Receipt Layout) */}
      {lastReceipt && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div
            className="modal-box"
            style={{
              maxWidth: '380px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              padding: '14px 14px 10px',
              background: '#ffffff',
              borderRadius: '10px',
              color: '#000000',
              boxShadow: '0 20px 45px -10px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Scrollable Receipt Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                paddingRight: '4px',
                paddingBottom: '8px',
              }}
            >
              {/* Printable Receipt Area for 80mm Thermal Printer */}
              <div id="printable-sale-receipt" style={{ width: '100%', maxWidth: '78mm', margin: '0 auto', padding: '0 1.5mm', color: '#000000', boxSizing: 'border-box' }}>
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #000000', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                  <MezaanLogo size={46} theme="light" />
                </div>
                <h2
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif",
                    fontSize: '21px',
                    fontWeight: 800,
                    color: '#000000',
                    margin: '0 0 2px 0',
                    lineHeight: 1.3,
                  }}
                >
                  میزان سویٹس اینڈ بیکرز
                </h2>
                <div style={{ fontSize: '13px', fontWeight: 900, letterSpacing: '1px', color: '#000000', textTransform: 'uppercase' }}>
                  MEZAAN SWEETS &amp; BAKERS
                </div>
                <div style={{ fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif", fontSize: '11px', fontWeight: 700, color: '#000000', margin: '2px 0' }}>
                  تازہ اور معیاری مٹھائیوں کا مرکز
                </div>

                {/* Address & Contacts */}
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '3px', lineHeight: 1.3 }}>
                  <div>📍 چک نمبر 24 ج ب لاہوریاں</div>
                </div>

                {/* Contact Persons & Numbers (Right-aligned Urdu with distinct numbers) */}
                <div
                  style={{
                    marginTop: '5px',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    direction: 'rtl',
                    textAlign: 'right',
                    borderTop: '1px dashed #000000',
                    borderBottom: '1px dashed #000000',
                    padding: '4px 6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif", fontWeight: 700 }}>چوہدری تبسم بگوایہ :</span>
                    <span style={{ direction: 'ltr', fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: '11.5px' }}>0343-7763677</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif", fontWeight: 700 }}>چوہدری عبدالرؤف بگوایہ :</span>
                    <span style={{ direction: 'ltr', fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: '11.5px' }}>0309-8809054</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif", fontWeight: 700 }}>چوہدری محسن بگوایہ :</span>
                    <span style={{ direction: 'ltr', fontWeight: 800, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: '11.5px' }}>0301-6008625</span>
                  </div>
                </div>

                {/* Invoice Metadata Box (Clean, bold, non-overlapping) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    fontSize: '12px',
                    color: '#000000',
                    textAlign: 'left',
                    borderTop: '1.5px dashed #000000',
                    paddingTop: '6px',
                    marginTop: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 900, fontSize: '12.5px' }}>INVOICE: <strong>{lastReceipt.invoiceNumber}</strong></span>
                    <span style={{ fontWeight: 700 }}>CASHIER: <strong>{lastReceipt.cashierId || session?.displayName || 'Staff'}</strong></span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '11.5px', marginTop: '1px' }}>
                    DATE: <strong>{formatDateTime(lastReceipt.createdAtUtc)}</strong>
                  </div>
                </div>
              </div>

              {/* Items Table with 80mm calibrated full widths */}
              <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', marginBottom: '8px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000000', color: '#000000' }}>
                    <th style={{ width: '48%', textAlign: 'left', padding: '4px 0', fontWeight: 800, textTransform: 'uppercase' }}>Item</th>
                    <th style={{ width: '14%', textAlign: 'center', padding: '4px 0', fontWeight: 800, textTransform: 'uppercase' }}>Qty</th>
                    <th style={{ width: '18%', textAlign: 'right', padding: '4px 0', fontWeight: 800, textTransform: 'uppercase' }}>Price</th>
                    <th style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 800, textTransform: 'uppercase' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lastReceipt.items.map((item, idx) => {
                    const unitPrice = item.quantity > 0 ? (item.totalMinorUnits / item.quantity / 100).toFixed(2) : '0.00';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dashed #444444' }}>
                        <td style={{ width: '48%', padding: '4px 2px 4px 0', fontWeight: 700, wordBreak: 'break-word', lineHeight: 1.25 }}>
                          {item.productName}
                        </td>
                        <td style={{ width: '14%', textAlign: 'center', padding: '4px 0', fontWeight: 700, verticalAlign: 'top' }}>
                          {item.quantity}
                        </td>
                        <td style={{ width: '18%', textAlign: 'right', padding: '4px 0', fontWeight: 700, verticalAlign: 'top' }}>
                          {unitPrice}
                        </td>
                        <td style={{ width: '20%', textAlign: 'right', padding: '4px 0', fontWeight: 800, verticalAlign: 'top' }}>
                          {(item.totalMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Financial Totals */}
              <div style={{ borderTop: '1.5px dashed #000000', paddingTop: '6px', fontSize: '12px', lineHeight: 1.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '3px' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {(lastReceipt.subtotalMinorUnits / 100).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '18px',
                    margin: '6px 0',
                    borderTop: '2px solid #000000',
                    borderBottom: '2px solid #000000',
                    padding: '5px 0',
                    color: '#000000',
                    letterSpacing: '0.5px',
                  }}
                >
                  <span>TOTAL DUE:</span>
                  <span>Rs. {(lastReceipt.totalMinorUnits / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, margin: '3px 0' }}>
                  <span>Amount Tendered:</span>
                  <span>Rs. {(lastReceipt.amountTenderedMinorUnits / 100).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    color: '#000000',
                    fontSize: '14px',
                    marginTop: '4px',
                  }}
                >
                  <span>CHANGE DUE:</span>
                  <span>Rs. {(lastReceipt.changeDueMinorUnits / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Receipt Footer Messages */}
              <div style={{ textAlign: 'center', marginTop: '10px', borderTop: '1.5px dashed #000000', paddingTop: '6px' }}>
                <div
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif",
                    fontSize: '13px',
                    color: '#000000',
                    fontWeight: 800,
                    marginBottom: '2px',
                  }}
                >
                  "ذائقہ ہمارا، پہچان آپ کی"
                </div>
                <div
                  style={{
                    fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, serif",
                    fontSize: '10.5px',
                    color: '#000000',
                    fontWeight: 600,
                    lineHeight: 1.35,
                  }}
                >
                  شادی بیاہ، سالگرہ اور دیگر تقریبات کیلئے مال آرڈر پر بھی تیار کیا جاتا ہے
                </div>
                <p style={{ fontSize: '11px', color: '#000000', margin: '4px 0 0 0', fontWeight: 800 }}>
                  Thank you for visiting Mezaan Sweets!
                </p>
              </div>
            </div>
            </div>

            {/* Permanent Sticky Action Bar - Always visible regardless of receipt length */}
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                gap: '8px',
                paddingTop: '10px',
                marginTop: '4px',
                borderTop: '2px solid #e2e8f0',
                background: '#ffffff',
              }}
              className="no-print"
            >
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: '10px 12px', fontWeight: 600, fontSize: '13px' }}
                onClick={() => setLastReceipt(null)}
              >
                ✕ Close (Esc)
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '10px 12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  background: '#d97706',
                  borderColor: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: isPrintingReceipt ? 'not-allowed' : 'pointer',
                  opacity: isPrintingReceipt ? 0.85 : 1,
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.4)',
                }}
                disabled={isPrintingReceipt}
                autoFocus
                onClick={() => handlePrintReceipt(lastReceipt)}
              >
                {isPrintingReceipt ? '⏳ Printing...' : receiptPrintFeedback ? receiptPrintFeedback : '🖨️ Print (80mm) [↵ Enter]'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SHIFT SUMMARY (X/Z REPORT) */}
      {selectedShiftReport && (
        <div className="modal-overlay">
          <div
            className="modal-box"
            style={{
              maxWidth: '920px',
              width: '95%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Modal Fixed Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e5e7eb',
                background: '#ffffff',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#111827', fontWeight: 700 }}>
                    Cashier Shift Summary Report
                  </h3>
                  <span
                    className="panel-badge ok"
                    style={{
                      background: selectedShiftReport.status === 'open' ? '#ecfdf5' : '#f1f5f9',
                      color: selectedShiftReport.status === 'open' ? '#065f46' : '#475569',
                      border: `1px solid ${selectedShiftReport.status === 'open' ? '#a7f3d0' : '#cbd5e1'}`,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                    }}
                  >
                    {selectedShiftReport.status === 'open' ? '🟢 ACTIVE (X-REPORT)' : '⚪ CLOSED (Z-REPORT)'}
                  </span>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setSelectedShiftReport(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', lineHeight: 1.5 }}>
                <div><strong>Shift Code:</strong> {selectedShiftReport.shiftCode || `#${selectedShiftReport.shiftId}`} · <strong>Store:</strong> {selectedShiftReport.storeName}</div>
                <div><strong>Opened:</strong> {formatDateTime(selectedShiftReport.openedAtUtc)} · <strong>Closed:</strong> {selectedShiftReport.closedAtUtc ? formatDateTime(selectedShiftReport.closedAtUtc) : 'Currently In Progress'}</div>
              </div>
            </div>

            {/* Modal Scrollable Content Body */}
            <div
              style={{
                padding: '16px 20px',
                overflowY: 'auto',
                flex: '1 1 auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* 4 Summary Highlight Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Cash Sales</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    Rs. {(selectedShiftReport.totalCashSalesMinorUnits / 100).toFixed(0)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Transactions</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {selectedShiftReport.totalTransactions}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Items Sold</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                    {selectedShiftReport.totalUnitsSold}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Variance</div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 800,
                      marginTop: '4px',
                      color:
                        selectedShiftReport.varianceMinorUnits == null
                          ? '#9ca3af'
                          : selectedShiftReport.varianceMinorUnits === 0
                            ? '#059669'
                            : selectedShiftReport.varianceMinorUnits < 0
                              ? '#dc2626'
                              : '#0284c7',
                    }}
                  >
                    {selectedShiftReport.varianceMinorUnits != null
                      ? `Rs. ${(selectedShiftReport.varianceMinorUnits / 100).toFixed(0)}`
                      : 'Open'}
                  </div>
                </div>
              </div>

              {/* 2-Column Responsive Section: Drawer Math on Left, Sold Items on Right */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'start' }}>
                {/* Left Column: Cash Drawer Balance Reconciliation */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '9px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '12px', color: '#334155' }}>
                    Cash Drawer Balance Reconciliation
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>Opening Float Cash:</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                          Rs. {(selectedShiftReport.openingFloatMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>Total Cash Sales Collected:</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          + Rs. {(selectedShiftReport.totalCashSalesMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                      {(selectedShiftReport.totalExpensesFromDrawerMinorUnits ?? 0) > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fffbeb' }}>
                          <td style={{ padding: '8px 12px', color: '#b45309', fontWeight: 600 }}>
                            Operating Expenses Paid from Drawer:
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                            - Rs. {((selectedShiftReport.totalExpensesFromDrawerMinorUnits ?? 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {(selectedShiftReport.totalPayoutsFromDrawerMinorUnits ?? 0) > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
                          <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 600 }}>
                            Staff Advances & Cash Payouts:
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            - Rs. {((selectedShiftReport.totalPayoutsFromDrawerMinorUnits ?? 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      {(selectedShiftReport.totalRefundsMinorUnits ?? 0) > 0 && (
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fef2f2' }}>
                          <td style={{ padding: '8px 12px', color: '#dc2626', fontWeight: 600 }}>
                            Customer Cash Refunds Paid:
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                            - Rs. {((selectedShiftReport.totalRefundsMinorUnits ?? 0) / 100).toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>Expected Cash in Drawer:</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                          = Rs. {(selectedShiftReport.expectedCashMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                      {selectedShiftReport.closingCountedMinorUnits != null && (
                        <>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>Actual Physical Cash Counted:</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                              Rs. {(selectedShiftReport.closingCountedMinorUnits / 100).toFixed(2)}
                            </td>
                          </tr>
                          <tr style={{ background: (selectedShiftReport.varianceMinorUnits ?? 0) === 0 ? '#ecfdf5' : '#fef2f2' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                              Drawer Variance (Over / Short):
                            </td>
                            <td
                              style={{
                                padding: '8px 12px',
                                textAlign: 'right',
                                fontWeight: 800,
                                fontSize: '13px',
                                color: (selectedShiftReport.varianceMinorUnits ?? 0) === 0 ? '#059669' : '#dc2626',
                              }}
                            >
                              {(selectedShiftReport.varianceMinorUnits ?? 0) === 0
                                ? 'Rs. 0.00 (Exact Balanced)'
                                : (selectedShiftReport.varianceMinorUnits ?? 0) < 0
                                  ? `-Rs. ${(Math.abs(selectedShiftReport.varianceMinorUnits ?? 0) / 100).toFixed(2)} (Shortage)`
                                  : `+Rs. ${((selectedShiftReport.varianceMinorUnits ?? 0) / 100).toFixed(2)} (Overage)`}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Right Column: Items & Products Sold During This Shift */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '9px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '12px', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Items Sold ({selectedShiftReport.itemsSold.length} products)</span>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      Total Units: {selectedShiftReport.totalUnitsSold}
                    </span>
                  </div>
                  <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc' }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px' }}>
                          <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f8fafc' }}>Product</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px', background: '#f8fafc' }}>SKU</th>
                          <th style={{ textAlign: 'center', padding: '8px 10px', background: '#f8fafc' }}>Qty</th>
                          <th style={{ textAlign: 'right', padding: '8px 12px', background: '#f8fafc' }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedShiftReport.itemsSold.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{item.productName}</td>
                            <td style={{ padding: '8px 10px', color: '#64748b', fontSize: '11px' }}>{item.sku}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{item.quantitySold}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                              Rs. {(item.revenueMinorUnits / 100).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {selectedShiftReport.itemsSold.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: '#9ca3af' }}>
                              No products sold during this shift.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Fixed Sticky Footer */}
            <div
              className="no-print"
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e5e7eb',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="tab-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ecfdf5',
                    color: '#065f46',
                    borderColor: '#a7f3d0',
                    fontWeight: 600,
                    padding: '8px 14px',
                    fontSize: '12px',
                  }}
                  onClick={() => handleExportShiftReportCsv(selectedShiftReport)}
                >
                  <span style={{ fontSize: '15px' }}>📥</span>
                  <span>Download CSV (for Excel)</span>
                </button>
                <button
                  type="button"
                  className="tab-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f0f9ff',
                    color: '#0369a1',
                    borderColor: '#bae6fd',
                    fontWeight: 600,
                    padding: '8px 14px',
                    fontSize: '12px',
                  }}
                  disabled={reportLoading}
                  onClick={() => handleExportShiftReportPdf(selectedShiftReport)}
                >
                  <span style={{ fontSize: '15px' }}>📄</span>
                  <span>{reportLoading ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>
              </div>
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 20px' }}
                onClick={() => setSelectedShiftReport(null)}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW PRODUCT */}
      {showAddProductModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title">📦 Add New Product to Catalog</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowAddProductModal(false);
                  setProdMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Product Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. CROISSANT-01"
                      value={pCode}
                      onChange={(e) => setPCode(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">SKU *</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-CRO-01"
                      value={pSku}
                      onChange={(e) => setPSku(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Butter Croissant"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = pName.trim();
                        if (isBarcodeString(trimmed) && (!pBarcode || pBarcode === trimmed)) {
                          e.preventDefault();
                          setPBarcode(trimmed);
                          setPName('');
                          if (!pSku || pSku.startsWith('SKU-')) {
                            setPSku(`SKU-${trimmed.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`);
                          }
                          const sanitizedCode = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
                          if (sanitizedCode) setPCode(`P-${sanitizedCode}`);
                        }
                      }
                    }}
                    className="form-input"
                    required
                  />
                  {pName.trim() && isBarcodeString(pName.trim()) && (
                    <div
                      style={{
                        marginTop: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: '#92400e',
                      }}
                    >
                      <span>🏷️ &ldquo;<strong>{pName.trim()}</strong>&rdquo; is a barcode / serial number</span>
                      <button
                        type="button"
                        style={{
                          background: '#d97706',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                        onClick={() => {
                          const val = pName.trim();
                          setPBarcode(val);
                          setPName('');
                          setPSku(`SKU-${val.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`);
                          const sanitizedCode = val.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
                          if (sanitizedCode) setPCode(`P-${sanitizedCode}`);
                        }}
                      >
                        Move to Barcode Field ➔
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Category</label>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onClick={() => setShowQuickCategoryModal(true)}
                    >
                      + Add Category (F9)
                    </button>
                  </div>
                  <select
                    value={pCatId}
                    onChange={(e) => setPCatId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                      Buy Price / Cost (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={pCostPrice}
                      onChange={(e) => setPCostPrice(e.target.value)}
                      className="form-input"
                      placeholder="e.g. 100.00"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Purchase cost from supplier</span>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#059669' }}>
                      Sale Price / Retail (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={pPrice}
                      onChange={(e) => setPPrice(e.target.value)}
                      className="form-input"
                      placeholder="e.g. 150.00"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Retail selling price in POS</span>
                  </div>
                </div>

                {/* Live Margin Indicator */}
                {(() => {
                  const sell = parseFloat(pPrice) || 0;
                  const cost = parseFloat(pCostPrice) || 0;
                  const profit = sell - cost;
                  const margin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: profit >= 0 ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${profit >= 0 ? '#a7f3d0' : '#fecaca'}`,
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: profit >= 0 ? '#065f46' : '#991b1b' }}>
                        Unit Profit: {profit >= 0 ? '+' : ''}Rs. {profit.toFixed(2)} ({margin}% Margin)
                      </span>
                      <span style={{ color: '#64748b' }}>
                        Markup: {cost > 0 ? ((profit / cost) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Base Unit</label>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        onClick={() => setShowQuickUnitModal(true)}
                      >
                        + Add Unit (F10)
                      </button>
                    </div>
                    <select
                      value={pUnit}
                      onChange={(e) => setPUnit(e.target.value)}
                      className="form-input"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Barcode (Scan or Type)</label>
                    <input
                      type="text"
                      placeholder="e.g. 890123456789"
                      value={pBarcode}
                      onChange={(e) => setPBarcode(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {prodMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: prodMsg.startsWith('Error') ? '#fee2e2' : '#dcfce7',
                      color: prodMsg.startsWith('Error') ? '#991b1b' : '#166534',
                    }}
                  >
                    {prodMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddProductModal(false);
                    setProdMsg(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ✓ Save Product to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK ADD CATEGORY */}
      {showQuickCategoryModal && (
        <div className="modal-overlay" style={{ zIndex: 100005 }}>
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <span className="modal-title">🏷️ Quick Add Category</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowQuickCategoryModal(false);
                  setQuickCatMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleQuickAddCategory}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Biscuits & Cookies, Cakes, Beverages"
                    value={quickCatName}
                    onChange={(e) => setQuickCatName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Category Code (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BISCUITS (auto-generated if blank)"
                    value={quickCatCode}
                    onChange={(e) => setQuickCatCode(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Leave blank to auto-generate code from category name.
                  </span>
                </div>
                {quickCatMsg && (
                  <div style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '12px', background: '#fee2e2', color: '#991b1b' }}>
                    {quickCatMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowQuickCategoryModal(false);
                    setQuickCatMsg(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ✓ Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK ADD BASE UNIT */}
      {showQuickUnitModal && (
        <div className="modal-overlay" style={{ zIndex: 100005 }}>
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <span className="modal-title">⚖️ Add New Base Unit</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowQuickUnitModal(false);
                  setQuickUnitMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleQuickAddUnit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Unit Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Box, Packet, Tray, Pound, Tin"
                    value={quickUnitName}
                    onChange={(e) => {
                      setQuickUnitName(e.target.value);
                      if (!quickUnitCode) {
                        setQuickUnitCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10));
                      }
                    }}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Unit Symbol / Code (Short) *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. box, pkt, tray, lb, tin"
                    value={quickUnitCode}
                    onChange={(e) => setQuickUnitCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Unit Type / Dimension</label>
                  <select
                    className="form-input"
                    value={quickUnitDimension}
                    onChange={(e) => setQuickUnitDimension(e.target.value as 'COUNT' | 'MASS' | 'VOLUME')}
                  >
                    <option value="COUNT">Count / Quantity (e.g. Box, Pcs, Packet, Tray, Dozen)</option>
                    <option value="MASS">Weight / Mass (e.g. kg, g, lb)</option>
                    <option value="VOLUME">Liquid / Volume (e.g. Liter, ml)</option>
                  </select>
                </div>
                {quickUnitMsg && (
                  <div style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '12px', background: '#fee2e2', color: '#991b1b' }}>
                    {quickUnitMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowQuickUnitModal(false);
                    setQuickUnitMsg(null);
                  }}
                  disabled={quickUnitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={quickUnitLoading || !quickUnitName.trim()}
                >
                  {quickUnitLoading ? 'Saving...' : '✓ Save Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PRODUCT PRICES & DETAILS */}
      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <span className="modal-title">✏️ Edit Product Prices & Catalog Info</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setEditingProduct(null);
                  setEditProdMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpdateProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div>Code: <strong style={{ fontFamily: 'monospace' }}>{editingProduct.code}</strong></div>
                  <div>SKU: <strong style={{ fontFamily: 'monospace' }}>{editingProduct.sku}</strong></div>
                  <div>Unit: <strong>{editingProduct.baseUnitCode}</strong></div>
                </div>

                <div>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Category</label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      onClick={() => setShowQuickCategoryModal(true)}
                    >
                      + New Category
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={editCatId}
                    onChange={(e) => setEditCatId(e.target.value)}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                      Buy Cost Price (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={editCostRs}
                      onChange={(e) => setEditCostRs(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Purchase cost per unit</span>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#059669' }}>
                      Sale Retail Price (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={editPriceRs}
                      onChange={(e) => setEditPriceRs(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Selling price in POS checkout</span>
                  </div>
                </div>

                {/* Live Margin Calculation */}
                {(() => {
                  const sell = parseFloat(editPriceRs) || 0;
                  const cost = parseFloat(editCostRs) || 0;
                  const profit = sell - cost;
                  const margin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: profit >= 0 ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${profit >= 0 ? '#a7f3d0' : '#fecaca'}`,
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: profit >= 0 ? '#065f46' : '#991b1b' }}>
                        Unit Profit: {profit >= 0 ? '+' : ''}Rs. {profit.toFixed(2)} ({margin}% Margin)
                      </span>
                      <span style={{ color: '#64748b' }}>
                        Markup: {cost > 0 ? ((profit / cost) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  );
                })()}

                <div>
                  <label className="form-label">Barcode (Scan or Type)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 890123456789"
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                  />
                </div>

                {editProdMsg && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: editProdMsg.startsWith('Error') ? '#fee2e2' : '#dcfce7',
                      color: editProdMsg.startsWith('Error') ? '#991b1b' : '#166534',
                    }}
                  >
                    {editProdMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditProdMsg(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  ✓ Save Price & Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {showAddSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title">🏢 Register New Bakery Supplier</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddSupplierModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddSupplier}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Supplier Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. SUP-FLOUR-01"
                      value={supCode}
                      onChange={(e) => setSupCode(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Company / Vendor Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. National Flour Mills Ltd"
                      value={supName}
                      onChange={(e) => setSupName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Contact Person</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Tariq Mehmood"
                      value={supContact}
                      onChange={(e) => setSupContact(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 0300-1234567"
                      value={supPhone}
                      onChange={(e) => setSupPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="e.g. vendor@domain.pk"
                      value={supEmail}
                      onChange={(e) => setSupEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">NTN / Tax Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NTN-1234567-8"
                      value={supTaxNumber}
                      onChange={(e) => setSupTaxNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Physical Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Industrial Area, Lahore"
                    value={supAddress}
                    onChange={(e) => setSupAddress(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Credit / Payment Terms (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    className="form-input"
                    placeholder="0 = Cash on Delivery"
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Enter 0 for cash on delivery, or number of days allowed for credit payment.
                  </span>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddSupplierModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={purchasingLoading}
                >
                  {purchasingLoading ? 'Saving...' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {showCreatePoModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <span className="modal-title">📋 Create New Purchase Order (PO)</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreatePoModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreatePo}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {suppliers.length === 0 && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: '#92400e',
                    }}
                  >
                    <span>⚠️ No suppliers registered yet. Please add a supplier first.</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                      onClick={() => {
                        setShowCreatePoModal(false);
                        setShowAddSupplierModal(true);
                      }}
                    >
                      + Add Supplier Now
                    </button>
                  </div>
                )}
                <div>
                  <label className="form-label">Supplier *</label>
                  <select
                    className="form-select"
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Product Item to Order *</label>
                  <select
                    className="form-select"
                    value={poVariantId}
                    onChange={(e) => setPoVariantId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Product Item --</option>
                    {products.map((p) => (
                      <option key={p.variantId} value={p.variantId}>
                        {p.name} ({p.sku}) — Base: {p.baseUnitCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Ordered Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      value={poQuantity}
                      onChange={(e) => setPoQuantity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Agreed Unit Cost (PKR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={poUnitCostRs}
                      onChange={(e) => setPoUnitCostRs(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <span>Estimated Total Amount:</span>
                  <span style={{ color: '#059669', fontSize: '15px' }}>
                    Rs. {(Math.max(0, parseInt(poQuantity, 10) || 0) * (parseFloat(poUnitCostRs) || 0)).toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="form-label">Expected Delivery Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={poDeliveryDate}
                    onChange={(e) => setPoDeliveryDate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Order Notes / Instructions</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Standard 50kg bags, delivery before noon"
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreatePoModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={purchasingLoading}
                >
                  {purchasingLoading ? 'Creating...' : 'Create Draft PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POST GOODS RECEIPT (GRN) */}
      {showCreateGrnModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '820px' }}>
            <div className="modal-header">
              <span className="modal-title">
                {editingGrnId
                  ? `✏️ Edit Unpaid Goods Receipt (${editingGrnNumber})`
                  : '📥 Receive Goods Note (GRN) — Multi-Item Stock Inflow'}
              </span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowCreateGrnModal(false);
                  setSelectedPoDetail(null);
                  setEditingGrnId(null);
                  setEditingGrnNumber('');
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handlePostGrn}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {grnPoId && (
                  <div
                    style={{
                      background: '#e0e7ff',
                      border: '1px solid #c7d2fe',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#3730a3',
                      fontWeight: 600,
                    }}
                  >
                    🔗 Linked to Purchase Order #{grnPoId} (Details pre-filled)
                  </div>
                )}

                {suppliers.length === 0 && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px',
                      color: '#92400e',
                    }}
                  >
                    <span>⚠️ No suppliers registered yet. Please add a supplier first.</span>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                      onClick={() => {
                        setShowCreateGrnModal(false);
                        setShowAddSupplierModal(true);
                      }}
                    >
                      + Add Supplier Now
                    </button>
                  </div>
                )}

                {products.length === 0 && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      color: '#92400e',
                    }}
                  >
                    ⚠️ No products available in catalog. Please register products in the Catalog tab first.
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Supplier *</label>
                    <select
                      className="form-select"
                      value={grnSupplierId}
                      onChange={(e) => {
                        setGrnSupplierId(e.target.value);
                        if (e.target.value === 'walkin' && !grnInvoiceRef) {
                          setGrnInvoiceRef(`WALK-IN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
                        }
                      }}
                      required
                      disabled={!!grnPoId}
                    >
                      <option value="">-- Select Supplier --</option>
                      <option value="walkin" style={{ fontWeight: 700, color: '#1e3a8a' }}>
                        🚶 Direct / Walk-in Supplier (Spot Cash Purchase)
                      </option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Supplier Invoice / Delivery Challan Ref *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. INV-9042 or CH-441"
                      value={grnInvoiceRef}
                      onChange={(e) => setGrnInvoiceRef(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* QUICK ADD ITEM BAR (Items are never hidden) */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>
                      ⚡ Quick Add Item to Receiving List (Search or Browse All Items)
                    </span>
                    <span style={{ fontSize: '11px', color: '#3b82f6' }}>
                      Select item, quantity & cost, then click &ldquo;+ Add to List&rdquo;
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 75px 110px 110px auto', gap: '8px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Product / Item *
                      </label>
                      <GrnItemSearchPicker
                        products={products}
                        selectedVariantId={quickAddVariantId}
                        onCreateNewProduct={(q) => handleOpenGrnQuickAdd(q)}
                        onSelect={(val, prod) => {
                          setQuickAddVariantId(val);
                          if (prod && (prod.costMinorUnits || 0) > 0) {
                            setQuickAddCostRs(((prod.costMinorUnits || 0) / 100).toFixed(2));
                          }
                          if (prod && (prod.priceMinorUnits || 0) > 0) {
                            setQuickAddSalePriceRs(((prod.priceMinorUnits || 0) / 100).toFixed(2));
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="form-input"
                        style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'center' }}
                        value={quickAddQty}
                        onChange={(e) => setQuickAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '2px' }}>
                        Buy Cost Rs. *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="form-input"
                        style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'right' }}
                        placeholder="0.00"
                        value={quickAddCostRs}
                        onChange={(e) => setQuickAddCostRs(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#047857', display: 'block', marginBottom: '2px' }}>
                        Sale Price Rs. (Retail)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        style={{ padding: '5px 8px', fontSize: '12px', textAlign: 'right', borderColor: '#a7f3d0' }}
                        placeholder="Retail"
                        value={quickAddSalePriceRs}
                        onChange={(e) => setQuickAddSalePriceRs(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', height: '32px' }}
                      onClick={() => {
                        if (!quickAddVariantId) {
                          alert('Please select a product to add');
                          return;
                        }
                        const costNum = parseFloat(quickAddCostRs) || 0;
                        if (costNum <= 0) {
                          alert('Please enter a valid buy cost price');
                          return;
                        }
                        const prod = products.find((p) => p.variantId === quickAddVariantId);
                        setGrnLines((prev) => {
                          if (prev.length === 1 && (!prev[0]?.variantId || prev[0].variantId === 0)) {
                            return [{
                              id: String(Date.now()),
                              variantId: quickAddVariantId,
                              quantity: quickAddQty,
                              unitCode: prod?.baseUnitCode || 'pcs',
                              unitCostRs: quickAddCostRs,
                              salePriceRs: quickAddSalePriceRs || undefined,
                              lotNumber: '',
                              expiryDate: '',
                            }];
                          }
                          return [
                            ...prev,
                            {
                              id: String(Date.now() + Math.random()),
                              variantId: quickAddVariantId,
                              quantity: quickAddQty,
                              unitCode: prod?.baseUnitCode || 'pcs',
                              unitCostRs: quickAddCostRs,
                              salePriceRs: quickAddSalePriceRs || undefined,
                              lotNumber: '',
                              expiryDate: '',
                            },
                          ];
                        });
                        setQuickAddVariantId(0);
                        setQuickAddQty(1);
                        setQuickAddCostRs('');
                        setQuickAddSalePriceRs('');
                      }}
                    >
                      + Add to List
                    </button>
                  </div>
                </div>

                {/* MULTI-ITEM RECEIVING TABLE */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: 700, fontSize: '13px' }}>
                      📦 Received Items & Products ({grnLines.length})
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => {
                        setGrnLines((prev) => [
                          ...prev,
                          { id: String(Date.now() + Math.random()), variantId: 0, quantity: 1, unitCode: 'pcs', unitCostRs: '', salePriceRs: '', lotNumber: '', expiryDate: '' },
                        ]);
                      }}
                    >
                      + Add Item Row
                    </button>
                  </div>

                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 10px' }}>Product Item *</th>
                          <th style={{ textAlign: 'center', padding: '8px 6px', width: '70px' }}>Qty *</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', width: '95px' }}>Cost (Rs) *</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', width: '95px' }}>Sale Price (Rs)</th>
                          <th style={{ textAlign: 'right', padding: '8px 6px', width: '90px' }}>Total (Rs)</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', width: '80px' }}>Lot #</th>
                          <th style={{ textAlign: 'left', padding: '8px 6px', width: '105px' }}>Expiry</th>
                          <th style={{ textAlign: 'center', padding: '8px 4px', width: '36px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grnLines.map((line) => {
                          const lineTotal = Math.max(0, line.quantity || 0) * (parseFloat(line.unitCostRs) || 0);
                          return (
                            <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 10px', minWidth: '220px' }}>
                                <GrnItemSearchPicker
                                  products={products}
                                  selectedVariantId={line.variantId}
                                  onCreateNewProduct={(q) => handleOpenGrnQuickAdd(q, line.id)}
                                  onSelect={(val, prod) => {
                                    setGrnLines((prev) =>
                                      prev.map((l) => {
                                        if (l.id !== line.id) return l;
                                        const defaultBuyCost = prod && (prod.costMinorUnits || 0) > 0
                                          ? ((prod.costMinorUnits || 0) / 100).toFixed(2)
                                          : l.unitCostRs;
                                        const defaultSalePrice = prod && (prod.priceMinorUnits || 0) > 0
                                          ? ((prod.priceMinorUnits || 0) / 100).toFixed(2)
                                          : l.salePriceRs;
                                        return {
                                          ...l,
                                          variantId: val,
                                          unitCode: prod?.baseUnitCode || 'pcs',
                                          unitCostRs: (!l.unitCostRs || l.unitCostRs === '0' || l.unitCostRs === '') && defaultBuyCost
                                            ? defaultBuyCost
                                            : (l.unitCostRs || defaultBuyCost),
                                          salePriceRs: (!l.salePriceRs || l.salePriceRs === '') && defaultSalePrice
                                            ? defaultSalePrice
                                            : (l.salePriceRs || defaultSalePrice),
                                        };
                                      })
                                    );
                                  }}
                                />
                              </td>
                              <td style={{ padding: '6px 6px' }}>
                                <input
                                  type="number"
                                  min="1"
                                  className="form-input"
                                  style={{ padding: '5px 6px', fontSize: '12px', textAlign: 'center' }}
                                  value={line.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    setGrnLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, quantity: val } : l))
                                    );
                                  }}
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px 6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  className="form-input"
                                  style={{ padding: '5px 6px', fontSize: '12px', textAlign: 'right' }}
                                  placeholder="0.00"
                                  value={line.unitCostRs}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGrnLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, unitCostRs: val } : l))
                                    );
                                  }}
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px 6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="form-input"
                                  style={{ padding: '5px 6px', fontSize: '12px', textAlign: 'right', borderColor: '#a7f3d0' }}
                                  placeholder="Retail"
                                  value={line.salePriceRs || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGrnLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, salePriceRs: val } : l))
                                    );
                                  }}
                                />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                Rs. {lineTotal.toFixed(2)}
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '5px 6px', fontSize: '11px' }}
                                  placeholder="Opt."
                                  value={line.lotNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGrnLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, lotNumber: val } : l))
                                    );
                                  }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px' }}>
                                <input
                                  type="date"
                                  className="form-input"
                                  style={{ padding: '5px 4px', fontSize: '11px' }}
                                  value={line.expiryDate}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGrnLines((prev) =>
                                      prev.map((l) => (l.id === line.id ? { ...l, expiryDate: val } : l))
                                    );
                                  }}
                                />
                              </td>
                              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                {grnLines.length > 1 && (
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      padding: '2px',
                                    }}
                                    title="Remove Item"
                                    onClick={() => {
                                      setGrnLines((prev) => prev.filter((l) => l.id !== line.id));
                                    }}
                                  >
                                    🗑
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Grand Total Summary & Payment Settlement */}
                {(() => {
                  const grnGrandTotal = grnLines.reduce(
                    (acc, l) => acc + (Math.max(0, l.quantity || 0) * (parseFloat(l.unitCostRs) || 0)),
                    0
                  );
                  return (
                    <>
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                            Total Items: {grnLines.length} line item(s)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>Grand Total Invoice Value:</span>
                          <span style={{ color: '#059669', fontSize: '18px', fontWeight: 800 }}>
                            Rs. {grnGrandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* PAYMENT & SUPPLIER LEDGER SETTLEMENT SECTION */}
                      {editingGrnId ? (
                        <div
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '16px' }}>✏️</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>
                              Editing Unpaid Goods Receipt Voucher ({editingGrnNumber})
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '12px', color: '#1e3a8a', lineHeight: 1.5 }}>
                            Saving these changes will reverse previously posted stock movements for this receipt, record updated movements for the new quantities/rates, and adjust the supplier Khata ledger balance to the new total of <strong>Rs. {grnGrandTotal.toFixed(2)}</strong>. This voucher remains <strong>UNPAID</strong> until a payment is recorded via Supplier Khata.
                          </p>
                        </div>
                      ) : (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        {(() => {
                          const selectedSupBal = supplierBalances.find((b) => String(b.supplierId) === grnSupplierId);
                          const currentOutstandingMinor = selectedSupBal ? selectedSupBal.outstandingBalanceMinorUnits : 0;
                          const availableAdvanceMinor = currentOutstandingMinor < 0 ? Math.abs(currentOutstandingMinor) : 0;
                          const availableAdvanceRs = availableAdvanceMinor / 100;
                          const previousDebtRs = currentOutstandingMinor > 0 ? (currentOutstandingMinor / 100) : 0;

                          const paidNow = Math.max(0, parseFloat(grnPaymentAmountRs || '0') || 0);
                          const advanceApplied = Math.min(grnGrandTotal, availableAdvanceRs);
                          const totalCleared = Math.min(grnGrandTotal, advanceApplied + paidNow);
                          const remainingInvoiceDue = Math.max(0, grnGrandTotal - totalCleared);
                          const netKhataAfter = (currentOutstandingMinor / 100) + grnGrandTotal - paidNow;

                          return (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                  💳 Payment & Supplier Khata Settlement (Auto-Calculating)
                                </span>
                                <span style={{ fontSize: '12px', color: '#64748b' }}>
                                  Invoice Value: <strong style={{ color: '#0f172a', fontSize: '13px' }}>Rs. {grnGrandTotal.toFixed(2)}</strong>
                                </span>
                              </div>

                              {/* Supplier Khata Position Strip */}
                              <div
                                style={{
                                  background: availableAdvanceRs > 0 ? '#eff6ff' : previousDebtRs > 0 ? '#fffbeb' : '#f8fafc',
                                  border: `1px solid ${availableAdvanceRs > 0 ? '#bfdbfe' : previousDebtRs > 0 ? '#fde68a' : '#e2e8f0'}`,
                                  borderRadius: '6px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '12px',
                                }}
                              >
                                {availableAdvanceRs > 0 ? (
                                  <div style={{ color: '#1e40af' }}>
                                    <strong>⭐ Pre-existing Advance Credit: Rs. {availableAdvanceRs.toFixed(2)}</strong>
                                    <span style={{ color: '#3b82f6', marginLeft: '6px' }}>
                                      (Auto-applied to reduce this invoice without extra clicks)
                                    </span>
                                  </div>
                                ) : previousDebtRs > 0 ? (
                                  <div style={{ color: '#92400e' }}>
                                    <strong>⚠️ Previous Unpaid Debt: Rs. {previousDebtRs.toFixed(2)}</strong>
                                    <span style={{ color: '#b45309', marginLeft: '6px' }}>(Payable on supplier ledger)</span>
                                  </div>
                                ) : (
                                  <div style={{ color: '#15803d', fontWeight: 600 }}>
                                    ✓ Previous Khata Balance: Rs. 0.00 (Zero Debt)
                                  </div>
                                )}
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  Supplier: <strong>{selectedSupBal?.supplierName ?? 'Selected'}</strong>
                                </span>
                              </div>

                              {/* Simple 2-field Payment Input (Paid Now + Method) */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label className="form-label" style={{ fontWeight: 700, color: '#0f172a' }}>
                                    Cash / Bank Paid Right Now (Rs.)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="form-input"
                                    style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', borderColor: '#3b82f6' }}
                                    placeholder="0.00 (Leave 0 if paying nothing now)"
                                    value={grnPaymentAmountRs}
                                    onChange={(e) => setGrnPaymentAmountRs(e.target.value)}
                                  />
                                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                    Enter any cash/bank paid today. Type 0 if covered by advance credit or taken on credit.
                                  </span>
                                </div>
                                <div>
                                  <label className="form-label" style={{ fontWeight: 700 }}>
                                    Payment Channel
                                  </label>
                                  <select
                                    className="form-input"
                                    value={grnPaymentMethod}
                                    onChange={(e) => setGrnPaymentMethod(e.target.value as any)}
                                  >
                                    <option value="CASH">💵 Cash (Store Register Drawer)</option>
                                    <option value="BANK_TRANSFER">🏦 Bank Transfer (IBFT)</option>
                                    <option value="CHEQUE">📑 Cheque / Pay Order</option>
                                    <option value="ONLINE_WALLET">📱 Online / Mobile Wallet (JazzCash/Nayapay)</option>
                                  </select>
                                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                                    Channel used for today&apos;s paid amount.
                                  </span>
                                </div>
                              </div>

                              {/* Automatic Real-Time Settlement & Khata Calculation Card */}
                              {(() => {
                                let badgeBg = '#f8fafc';
                                let badgeBorder = '#e2e8f0';
                                let titleColor = '#0f172a';
                                let title = '';
                                let details = '';

                                const isFullyPaid = remainingInvoiceDue === 0;
                                const isPartiallyPaid = !isFullyPaid && totalCleared > 0;

                                if (isFullyPaid) {
                                  badgeBg = '#ecfdf5';
                                  badgeBorder = '#a7f3d0';
                                  titleColor = '#065f46';
                                  title = '✓ Invoice 100% Fully Settled (Status: PAID)';
                                  if (availableAdvanceRs >= grnGrandTotal && paidNow === 0) {
                                    details = `Entire Rs. ${grnGrandTotal.toFixed(2)} is auto-covered from your advance credit. Zero new cash needed today!`;
                                  } else if (availableAdvanceRs > 0 && paidNow > 0) {
                                    details = `Cleared via Rs. ${advanceApplied.toFixed(2)} advance credit + Rs. ${paidNow.toFixed(2)} paid now (${grnPaymentMethod}). Zero balance left on this bill!`;
                                  } else {
                                    details = `Exactly Rs. ${paidNow.toFixed(2)} paid now via ${grnPaymentMethod}. Zero balance left on this bill!`;
                                  }
                                } else if (isPartiallyPaid) {
                                  badgeBg = '#fffbeb';
                                  badgeBorder = '#fde68a';
                                  titleColor = '#92400e';
                                  title = `⚖️ Partially Settled (Status: PARTIAL) — Rs. ${totalCleared.toFixed(2)} Cleared`;
                                  details = availableAdvanceRs > 0
                                    ? `Applied Rs. ${advanceApplied.toFixed(2)} advance credit + Rs. ${paidNow.toFixed(2)} paid now (${grnPaymentMethod}). Remaining bill balance: Rs. ${remainingInvoiceDue.toFixed(2)}.`
                                    : `Rs. ${paidNow.toFixed(2)} paid now via ${grnPaymentMethod}. Remaining bill balance: Rs. ${remainingInvoiceDue.toFixed(2)}.`;
                                } else {
                                  badgeBg = '#fef2f2';
                                  badgeBorder = '#fecaca';
                                  titleColor = '#991b1b';
                                  title = '📝 100% On Credit / Udhar (Status: UNPAID)';
                                  details = `No payment made today. Full invoice value of Rs. ${grnGrandTotal.toFixed(2)} will be added as debt to supplier khata.`;
                                }

                                return (
                                  <div
                                    style={{
                                      background: badgeBg,
                                      border: `1px solid ${badgeBorder}`,
                                      borderRadius: '6px',
                                      padding: '10px 14px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '13px', fontWeight: 800, color: titleColor }}>
                                        {title}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '12px',
                                          fontWeight: 800,
                                          color: netKhataAfter > 0 ? '#dc2626' : netKhataAfter < 0 ? '#0284c7' : '#15803d',
                                        }}
                                      >
                                        {netKhataAfter > 0
                                          ? `Net Khata Debt: Rs. ${netKhataAfter.toFixed(2)}`
                                          : netKhataAfter < 0
                                          ? `Remaining Advance Credit: Rs. ${Math.abs(netKhataAfter).toFixed(2)}`
                                          : 'Net Khata Balance: Rs. 0.00 (Zero Debt)'}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                                      {details}
                                    </div>
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '6px',
                                        borderTop: `1px solid ${badgeBorder}`,
                                        paddingTop: '6px',
                                        marginTop: '4px',
                                        fontSize: '11px',
                                      }}
                                    >
                                      <div>
                                        <span style={{ color: '#64748b' }}>Invoice:</span>{' '}
                                        <strong>Rs. {grnGrandTotal.toFixed(2)}</strong>
                                      </div>
                                      <div>
                                        <span style={{ color: '#64748b' }}>Advance Applied:</span>{' '}
                                        <strong style={{ color: '#0284c7' }}>Rs. {advanceApplied.toFixed(2)}</strong>
                                      </div>
                                      <div>
                                        <span style={{ color: '#64748b' }}>Paid Now:</span>{' '}
                                        <strong style={{ color: '#059669' }}>Rs. {paidNow.toFixed(2)}</strong>
                                      </div>
                                      <div style={{ textAlign: 'right' }}>
                                        <span style={{ color: '#64748b' }}>Remaining Bill Due:</span>{' '}
                                        <strong style={{ color: remainingInvoiceDue > 0 ? '#dc2626' : '#15803d' }}>
                                          Rs. {remainingInvoiceDue.toFixed(2)}
                                        </strong>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </div>
                      )}
                    </>
                  );
                })()}

                <div>
                  <label className="form-label">Receiving Notes / Quality Inspection</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bulk ingredients checked, intact bags, quality approved"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateGrnModal(false);
                    setSelectedPoDetail(null);
                    setEditingGrnId(null);
                    setEditingGrnNumber('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={purchasingLoading}
                  style={{ background: '#059669', borderColor: '#047857' }}
                >
                  {purchasingLoading
                    ? (editingGrnId ? 'Updating...' : 'Posting...')
                    : (editingGrnId ? '✓ Update GRN & Adjust Stock' : '✓ Post GRN & Add to Stock')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GRN QUICK ADD NEW PRODUCT (INLINE CREATION ON SAME SCREEN) */}
      {showGrnQuickAddModal && (
        <div className="modal-overlay" style={{ zIndex: 100000 }}>
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title">📦 Add New Product to Catalog</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowGrnQuickAddModal(false);
                  setGrnQuickMsg(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSaveGrnQuickProduct}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Product Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. CROISSANT-01"
                      value={grnQuickCode}
                      onChange={(e) => setGrnQuickCode(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">SKU *</label>
                    <input
                      type="text"
                      placeholder="e.g. SKU-CRO-01"
                      value={grnQuickSku}
                      onChange={(e) => setGrnQuickSku(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Butter Croissant"
                    value={grnQuickName}
                    onChange={(e) => setGrnQuickName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = grnQuickName.trim();
                        if (isBarcodeString(trimmed) && (!grnQuickBarcode || grnQuickBarcode === trimmed)) {
                          e.preventDefault();
                          setGrnQuickBarcode(trimmed);
                          setGrnQuickName('');
                          if (!grnQuickSku || grnQuickSku.startsWith('SKU-')) {
                            setGrnQuickSku(`SKU-${trimmed.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`);
                          }
                          const sanitizedCode = trimmed.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
                          if (sanitizedCode) setGrnQuickCode(`P-${sanitizedCode}`);
                        }
                      }
                    }}
                    className="form-input"
                    autoFocus
                    required
                  />
                  {grnQuickName.trim() && isBarcodeString(grnQuickName.trim()) && (
                    <div
                      style={{
                        marginTop: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        color: '#92400e',
                      }}
                    >
                      <span>🏷️ &ldquo;<strong>{grnQuickName.trim()}</strong>&rdquo; is a barcode / serial number</span>
                      <button
                        type="button"
                        style={{
                          background: '#d97706',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                        onClick={() => {
                          const val = grnQuickName.trim();
                          setGrnQuickBarcode(val);
                          setGrnQuickName('');
                          setGrnQuickSku(`SKU-${val.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`);
                          const sanitizedCode = val.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
                          if (sanitizedCode) setGrnQuickCode(`P-${sanitizedCode}`);
                        }}
                      >
                        Move to Barcode Field ➔
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Category</label>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onClick={() => setShowQuickCategoryModal(true)}
                    >
                      + Add Category (F9)
                    </button>
                  </div>
                  <select
                    value={grnQuickCatId}
                    onChange={(e) => setGrnQuickCatId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#1e293b' }}>
                      Buy Price / Cost (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={grnQuickCostRs}
                      onChange={(e) => setGrnQuickCostRs(e.target.value)}
                      className="form-input"
                      placeholder="100.00"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Purchase cost from supplier</span>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, color: '#059669' }}>
                      Sale Price / Retail (Rs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={grnQuickPriceRs}
                      onChange={(e) => setGrnQuickPriceRs(e.target.value)}
                      className="form-input"
                      placeholder="150.00"
                      required
                    />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Retail selling price in POS</span>
                  </div>
                </div>

                {/* Live Margin Indicator */}
                {(() => {
                  const sell = parseFloat(grnQuickPriceRs) || 0;
                  const cost = parseFloat(grnQuickCostRs) || 0;
                  const profit = sell - cost;
                  const margin = sell > 0 ? ((profit / sell) * 100).toFixed(1) : '0';
                  return (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: profit >= 0 ? '#ecfdf5' : '#fef2f2',
                        border: `1px solid ${profit >= 0 ? '#a7f3d0' : '#fecaca'}`,
                        fontSize: '12px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: profit >= 0 ? '#065f46' : '#991b1b' }}>
                        Unit Profit: {profit >= 0 ? '+' : ''}Rs. {profit.toFixed(2)} ({margin}% Margin)
                      </span>
                      <span style={{ color: '#64748b' }}>
                        Markup: {cost > 0 ? ((profit / cost) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Base Unit</label>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        onClick={() => setShowQuickUnitModal(true)}
                      >
                        + Add Unit (F10)
                      </button>
                    </div>
                    <select
                      value={grnQuickUnit}
                      onChange={(e) => setGrnQuickUnit(e.target.value)}
                      className="form-input"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.code}>{u.name} ({u.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Barcode (Scan or Type)</label>
                    <input
                      type="text"
                      placeholder="e.g. 890123456789"
                      value={grnQuickBarcode}
                      onChange={(e) => setGrnQuickBarcode(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {grnQuickMsg && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontWeight: 500,
                    }}
                  >
                    {grnQuickMsg}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowGrnQuickAddModal(false);
                    setGrnQuickMsg(null);
                  }}
                  disabled={grnQuickLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={grnQuickLoading}
                >
                  {grnQuickLoading ? 'Saving...' : '✓ Save Product to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW GRN DETAILS */}
      {selectedGrnDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <span className="modal-title">📦 GRN Details — {selectedGrnDetail.grnNumber}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedGrnDetail(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div>Supplier: <strong>{selectedGrnDetail.supplierName}</strong></div>
                <div>Invoice Ref: <strong>{selectedGrnDetail.supplierInvoiceRef}</strong></div>
                <div>Received Date: <strong>{formatDateTime(selectedGrnDetail.receivedDateUtc)}</strong></div>
                <div>Status: <strong style={{ color: '#059669' }}>● {selectedGrnDetail.status}</strong></div>
                {selectedGrnDetail.poNumber && (
                  <div>Linked PO: <strong>{selectedGrnDetail.poNumber}</strong></div>
                )}
                {selectedGrnDetail.notes && (
                  <div style={{ gridColumn: 'span 2', color: '#64748b' }}>
                    Notes: {selectedGrnDetail.notes}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Received Line Items & Lots</h4>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Item</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>SKU</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Lot # / Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedGrnDetail.lines ?? []).map((line) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{line.productName}</td>
                        <td style={{ padding: '6px 10px', color: '#64748b' }}>{line.sku}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>
                          +{line.receivedQuantity} {line.unitCode}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          Rs. {(line.unitCostMinorUnits / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          Rs. {(line.totalCostMinorUnits / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 10px', fontSize: '11px', color: '#64748b' }}>
                          {line.lotNumber ? <div>Lot: {line.lotNumber}</div> : null}
                          {line.expiryDateUtc ? <div>Exp: {line.expiryDateUtc.slice(0, 10)}</div> : null}
                          {!line.lotNumber && !line.expiryDateUtc ? '—' : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '14px',
                }}
              >
                <span>Total Received Value:</span>
                <span style={{ color: '#059669' }}>
                  Rs. {(selectedGrnDetail.totalAmountMinorUnits / 100).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedGrnDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER LEDGER STATEMENT */}
      {showSupplierLedgerModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '850px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="modal-title">
                  📜 Supplier Statement & Khata — {selectedSupplierLedger?.supplier.name ?? 'Loading...'}
                </span>
                {selectedSupplierLedger && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Code: <strong>{selectedSupplierLedger.supplier.code}</strong>
                    {selectedSupplierLedger.supplier.phone && <span> • Phone: {selectedSupplierLedger.supplier.phone}</span>}
                    {selectedSupplierLedger.supplier.contactPerson && <span> • Contact: {selectedSupplierLedger.supplier.contactPerson}</span>}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowSupplierLedgerModal(false);
                  setSelectedSupplierLedger(null);
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ledgerLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading supplier statement...
                </div>
              ) : selectedSupplierLedger ? (
                <>
                  {/* Financial Balance Summary Strip */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: selectedSupplierLedger.outstandingBalanceMinorUnits < 0 ? '1fr 1fr 1fr 1.2fr' : '1fr 1fr 1fr',
                      gap: '12px',
                      background: '#f8fafc',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Invoiced / Purchases</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                        Rs. {(selectedSupplierLedger.totalPurchasesMinorUnits / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Payments Settled</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7' }}>
                        Rs. {(selectedSupplierLedger.totalPaidMinorUnits / 100).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: selectedSupplierLedger.outstandingBalanceMinorUnits > 0 ? '#b91c1c' : '#15803d', fontWeight: 700 }}>
                        Current Outstanding (واجب الادا)
                      </div>
                      <div
                        style={{
                          fontSize: '18px',
                          fontWeight: 900,
                          color: selectedSupplierLedger.outstandingBalanceMinorUnits > 0 ? '#dc2626' : '#15803d',
                        }}
                      >
                        Rs. {selectedSupplierLedger.outstandingBalanceMinorUnits > 0
                          ? (selectedSupplierLedger.outstandingBalanceMinorUnits / 100).toFixed(2)
                          : '0.00'}
                      </div>
                      <div style={{ fontSize: '10px', color: selectedSupplierLedger.outstandingBalanceMinorUnits > 0 ? '#b91c1c' : '#15803d', fontWeight: 600, marginTop: '2px' }}>
                        {selectedSupplierLedger.outstandingBalanceMinorUnits > 0
                          ? 'Unpaid balance due to supplier'
                          : '✓ Fully Settled (Zero Debt)'}
                      </div>
                    </div>
                    {selectedSupplierLedger.outstandingBalanceMinorUnits < 0 && (
                      <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700 }}>
                          ⭐ Advance Credit (ہمارا جمع)
                        </div>
                        <div style={{ fontSize: '17px', fontWeight: 900, color: '#0284c7' }}>
                          Rs. {(Math.abs(selectedSupplierLedger.outstandingBalanceMinorUnits) / 100).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 500, marginTop: '2px' }}>
                          Supplier owes us / applies to next deliveries
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ledger Table */}
                  <div style={{ maxHeight: '340px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 10px' }}>Date</th>
                          <th style={{ textAlign: 'center', padding: '8px 10px', width: '90px' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px' }}>Doc # / Reference</th>
                          <th style={{ textAlign: 'left', padding: '8px 10px' }}>Details / Method</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', width: '115px' }}>Delivery / Bill (+)</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', width: '105px' }}>Paid (-)</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', width: '130px' }}>Running Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSupplierLedger.entries.map((entry) => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {formatDateTime(entry.dateUtc)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  background: entry.type === 'GRN' ? '#e0e7ff' : '#dcfce7',
                                  color: entry.type === 'GRN' ? '#3730a3' : '#15803d',
                                }}
                              >
                                {entry.type === 'GRN' ? '📦 Delivery' : '💳 Payment'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                              <div>{entry.documentNumber}</div>
                              {entry.reference && (
                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>Ref: {entry.reference}</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {entry.notes || '—'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: entry.debitMinorUnits > 0 ? '#1e293b' : '#94a3b8' }}>
                              {entry.debitMinorUnits > 0 ? `Rs. ${(entry.debitMinorUnits / 100).toFixed(2)}` : '—'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: entry.creditMinorUnits > 0 ? '#059669' : '#94a3b8' }}>
                              {entry.creditMinorUnits > 0 ? `Rs. ${(entry.creditMinorUnits / 100).toFixed(2)}` : '—'}
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'right',
                                fontWeight: 800,
                                color: entry.runningBalanceMinorUnits > 0
                                  ? '#b91c1c'
                                  : entry.runningBalanceMinorUnits < 0
                                  ? '#0284c7'
                                  : '#15803d',
                              }}
                            >
                              {entry.runningBalanceMinorUnits > 0
                                ? `Rs. ${(entry.runningBalanceMinorUnits / 100).toFixed(2)}`
                                : entry.runningBalanceMinorUnits === 0
                                ? 'Rs. 0.00 (✓ Settled)'
                                : `+Rs. ${(Math.abs(entry.runningBalanceMinorUnits) / 100).toFixed(2)} (Adv)`}
                            </td>
                          </tr>
                        ))}
                        {selectedSupplierLedger.entries.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                              No transactions recorded for this supplier yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {selectedSupplierLedger && (
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#059669', borderColor: '#047857', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      const sup = suppliers.find((s) => s.id === selectedSupplierLedger.supplier.id);
                      if (sup) openRecordPayment(sup);
                    }}
                  >
                    💳 Record Payment for this Supplier
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowSupplierLedgerModal(false);
                  setSelectedSupplierLedger(null);
                }}
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECORD SUPPLIER PAYMENT */}
      {showRecordPaymentModal && paymentSupplier && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <span className="modal-title">💳 Record Supplier Payment</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowRecordPaymentModal(false);
                  setPaymentSupplier(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {paymentSupplier.name} ({paymentSupplier.code})
                  </div>
                  {(() => {
                    const bal = supplierBalances.find((b) => b.supplierId === paymentSupplier.id);
                    const outstanding = bal ? bal.outstandingBalanceMinorUnits : 0;
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '13px' }}>
                        <span style={{ color: '#64748b' }}>Current Outstanding Balance:</span>
                        <span style={{ fontWeight: 800, color: outstanding > 0 ? '#dc2626' : '#15803d' }}>
                          Rs. {(outstanding / 100).toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="form-label">Payment Amount (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder="Enter amount to pay e.g. 15000"
                    value={paymentAmountRs}
                    onChange={(e) => setPaymentAmountRs(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Payment Method *</label>
                    <select
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      required
                    >
                      <option value="CASH">💵 Cash (Store Register)</option>
                      <option value="BANK_TRANSFER">🏦 Bank Transfer (IBFT)</option>
                      <option value="CHEQUE">📝 Cheque / Pay Order</option>
                      <option value="ONLINE_WALLET">📱 Online / Mobile Wallet (JazzCash/Nayapay)</option>
                      <option value="ADVANCE_ADJUSTMENT">⭐ Advance Adjustment (پیشگی جمع سے کٹوتی)</option>
                      <option value="OTHER">📄 Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Reference / Cheque #</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. CHQ-9912 or Bank Ref"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Payment Notes / Description</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Paid via HBL Online transfer against last delivery"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowRecordPaymentModal(false);
                    setPaymentSupplier(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={purchasingLoading}
                  style={{ background: '#059669', borderColor: '#047857' }}
                >
                  {purchasingLoading ? 'Saving...' : '✓ Confirm & Post Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PO DETAILS */}
      {selectedPoDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <span className="modal-title">📋 Purchase Order — {selectedPoDetail.poNumber}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedPoDetail(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div>Supplier: <strong>{selectedPoDetail.supplierName}</strong></div>
                <div>Status: <strong>● {selectedPoDetail.status}</strong></div>
                <div>Order Date: <strong>{formatDateTime(selectedPoDetail.orderDateUtc)}</strong></div>
                <div>Expected Delivery: <strong>{selectedPoDetail.expectedDeliveryDateUtc ? formatDateTime(selectedPoDetail.expectedDeliveryDateUtc) : '—'}</strong></div>
                {selectedPoDetail.notes && (
                  <div style={{ gridColumn: 'span 2', color: '#64748b' }}>
                    Notes: {selectedPoDetail.notes}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Ordered Items & Receiving Progress</h4>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Item</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>SKU</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Ordered</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Received</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Unit Cost</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPoDetail.lines ?? []).map((line) => (
                      <tr key={line.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{line.productName}</td>
                        <td style={{ padding: '6px 10px', color: '#64748b' }}>{line.sku}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          {line.orderedQuantity} {line.unitCode}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: line.receivedQuantity >= line.orderedQuantity ? '#059669' : '#d97706' }}>
                          {line.receivedQuantity} {line.unitCode}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                          Rs. {(line.unitCostMinorUnits / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>
                          Rs. {(line.totalCostMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '14px',
                }}
              >
                <span>Total PO Amount:</span>
                <span style={{ color: '#0f172a' }}>
                  Rs. {(selectedPoDetail.totalCostMinorUnits / 100).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedPoDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: CREATE RECIPE */}
      {showCreateRecipeModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '680px', width: '90%' }}>
            <div className="modal-header">
              <h3>Create Master Recipe & BOM</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateRecipeModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRecipe}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Recipe Code</label>
                    <input
                      type="text"
                      placeholder="e.g. RCP-CROISSANT-01"
                      value={rcpCode}
                      onChange={(e) => setRcpCode(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Recipe Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Classic Butter Croissant"
                      value={rcpName}
                      onChange={(e) => setRcpName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Output Finished Product *</label>
                    <select
                      value={rcpOutputVariantId}
                      onChange={(e) => setRcpOutputVariantId(e.target.value)}
                      className="form-input"
                      required
                    >
                      <option value="">-- Select Finished Product --</option>
                      {products.map((p) => (
                        <option key={p.variantId} value={p.variantId}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Batch Yield *</label>
                    <input
                      type="number"
                      min="1"
                      value={rcpExpectedYield}
                      onChange={(e) => setRcpExpectedYield(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Output Unit</label>
                    <select
                      value={rcpOutputUnit}
                      onChange={(e) => setRcpOutputUnit(e.target.value)}
                      className="form-input"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Description / Instructions</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard 12-hour laminated dough croissant recipe"
                    value={rcpDescription}
                    onChange={(e) => setRcpDescription(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* BOM Ingredients List */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                      Bill of Materials (BOM Raw Material Ingredients) *
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() =>
                        setRcpItems((prev) => [
                          ...prev,
                          { inputVariantId: '', quantity: '100', unitCode: 'g', wastagePercent: '0' },
                        ])
                      }
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ingredient / Raw Material</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', width: '90px' }}>Quantity</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', width: '80px' }}>Unit</th>
                        <th style={{ textAlign: 'right', padding: '6px 8px', width: '80px' }}>Wastage %</th>
                        <th style={{ textAlign: 'center', padding: '6px 8px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rcpItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={item.inputVariantId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRcpItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, inputVariantId: val } : it))
                                );
                              }}
                              className="form-input"
                              style={{ fontSize: '12px', padding: '4px 6px' }}
                              required
                            >
                              <option value="">-- Select Material / Ingredient --</option>
                              {products.map((p) => (
                                <option key={p.variantId} value={p.variantId}>
                                  {p.name} ({p.sku})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRcpItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                                );
                              }}
                              className="form-input"
                              style={{ fontSize: '12px', padding: '4px 6px', textAlign: 'right' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <select
                              value={item.unitCode}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRcpItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, unitCode: val } : it))
                                );
                              }}
                              className="form-input"
                              style={{ fontSize: '12px', padding: '4px 6px' }}
                            >
                              {units.map((u) => (
                                <option key={u.id} value={u.code}>
                                  {u.code}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.wastagePercent}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRcpItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, wastagePercent: val } : it))
                                );
                              }}
                              className="form-input"
                              style={{ fontSize: '12px', padding: '4px 6px', textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                            {rcpItems.length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                                onClick={() =>
                                  setRcpItems((prev) => prev.filter((_, i) => i !== idx))
                                }
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateRecipeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#7c3aed' }}
                  disabled={productionLoading}
                >
                  {productionLoading ? 'Saving...' : 'Save Recipe & BOM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PLAN PRODUCTION RUN */}
      {showCreateRunModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <h3>Plan Production Batch Run</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateRunModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRun}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Master Recipe *</label>
                  <select
                    value={runRecipeId}
                    onChange={(e) => setRunRecipeId(e.target.value)}
                    className="form-input"
                    required
                  >
                    <option value="">-- Select Master Recipe --</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code}) — Yield: {r.expectedYieldQuantity} {r.outputUnitCode}/batch
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Batch Multiplier *</label>
                    <input
                      type="number"
                      min="1"
                      value={runBatchCount}
                      onChange={(e) => setRunBatchCount(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Scheduled Date</label>
                    <input
                      type="date"
                      value={runPlannedDate}
                      onChange={(e) => setRunPlannedDate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Batch scaling preview */}
                {(() => {
                  const selRecipe = recipes.find((r) => String(r.id) === runRecipeId);
                  if (!selRecipe) return null;
                  const batches = parseInt(runBatchCount, 10) || 1;
                  const totalYield = selRecipe.expectedYieldQuantity * batches;
                  const items = selRecipe.currentVersion?.items || [];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px',
                          padding: '10px 14px',
                          fontSize: '13px',
                          color: '#065f46',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          Expected Output: {totalYield} {selRecipe.outputUnitCode} of {selRecipe.outputVariantName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
                          Ingredient quantities scale {batches}x according to the master BOM ({items.length} ingredients).
                        </div>
                      </div>

                      {items.length > 0 && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Required Ingredients for {batches} Batch(es):</div>
                          <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '11px' }}>
                                <span>• {it.inputVariantName || `Variant #${it.inputVariantId}`}</span>
                                <span style={{ fontWeight: 600 }}>{it.quantity * batches} {it.unitCode}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '11px',
                          color: '#92400e',
                          lineHeight: 1.4,
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '2px' }}>🍞 Stock Availability Policy:</div>
                        <div>• <strong>Option A (Bake Anyway):</strong> Permitted! The system records negative stock movements on the immutable ledger until purchases/GRN are booked.</div>
                        <div>• <strong>Option B (Emergency Cash Buy):</strong> If ingredients were bought with cash from the drawer, record it via Petty Cash / Drawer Expenses to reconcile cash immediately.</div>
                        <div style={{ marginTop: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '10.5px', padding: '3px 8px', color: '#b45309', borderColor: '#fcd34d', background: '#ffffff', cursor: 'pointer' }}
                            onClick={() => {
                              setShowCreateRunModal(false);
                              setActiveTab('expenses');
                            }}
                          >
                            ⚡ Log Emergency Cash Buy (Drawer Expense)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="form-label">Production Run Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Morning bakery shift production batch"
                    value={runNotes}
                    onChange={(e) => setRunNotes(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateRunModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#059669' }}
                  disabled={productionLoading}
                >
                  {productionLoading ? 'Scheduling...' : 'Schedule Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE PRODUCTION RUN */}
      {showCompleteRunModal && completingRun && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <h3>Complete Production Run</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowCompleteRunModal(false);
                  setCompletingRun(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCompleteRun}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    Run #: <strong>{completingRun.runNumber}</strong>
                  </div>
                  <div>
                    Recipe: <strong>{completingRun.recipeName}</strong> ({completingRun.plannedBatchCount}x batches)
                  </div>
                  <div>
                    Target Output: <strong>{completingRun.plannedOutputQuantity} {completingRun.outputUnitCode}</strong> of {completingRun.outputVariantName}
                  </div>
                </div>

                <div>
                  <label className="form-label">Actual Finished Yield Produced *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      value={actualYieldQty}
                      onChange={(e) => setActualYieldQty(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '16px', fontWeight: 700 }}
                      required
                      autoFocus
                    />
                    <span style={{ fontWeight: 600, color: '#475569' }}>
                      {completingRun.outputUnitCode}
                    </span>
                  </div>
                  {actualYieldQty && parseInt(actualYieldQty, 10) !== completingRun.plannedOutputQuantity && (
                    <div
                      style={{
                        fontSize: '12px',
                        marginTop: '4px',
                        fontWeight: 600,
                        color: parseInt(actualYieldQty, 10) >= completingRun.plannedOutputQuantity ? '#059669' : '#d97706',
                      }}
                    >
                      Yield Variance: {parseInt(actualYieldQty, 10) - completingRun.plannedOutputQuantity > 0 ? '+' : ''}
                      {parseInt(actualYieldQty, 10) - completingRun.plannedOutputQuantity} {completingRun.outputUnitCode}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="form-label">Finished Goods Lot # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. LOT-20260904-01"
                      value={outputLotNumber}
                      onChange={(e) => setOutputLotNumber(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={outputExpiryDate}
                      onChange={(e) => setOutputExpiryDate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Completion Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Good crust color, texture passed QC"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '11px',
                    color: '#92400e',
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>⚡ Atomic Ledger Update &amp; Stock Policy:</div>
                  <div>• <strong>Raw material consumption:</strong> Ingredients will be deducted from the immutable stock ledger (<code>PRODUCTION_CONSUMPTION</code>) and finished goods added (<code>PRODUCTION_OUTPUT</code>).</div>
                  <div>• <strong>Option A (Bake Anyway):</strong> Permitted! The system records negative stock movements if balance is 0 or low until purchases are logged.</div>
                  <div>• <strong>Option B (Emergency Cash Buy):</strong> If ingredients were bought with cash from the drawer, record it via Petty Cash to keep the drawer reconciled.</div>
                  <div style={{ marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '10.5px', padding: '3px 8px', color: '#b45309', borderColor: '#fcd34d', background: '#ffffff', cursor: 'pointer' }}
                      onClick={() => {
                        setShowCompleteRunModal(false);
                        setCompletingRun(null);
                        setActiveTab('expenses');
                      }}
                    >
                      ⚡ Record Emergency Cash Buy (Drawer Expense)
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCompleteRunModal(false);
                    setCompletingRun(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#059669' }}
                  disabled={productionLoading}
                >
                  {productionLoading ? 'Posting to Ledger...' : 'Post & Complete Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW PRODUCTION RUN DETAILS */}
      {selectedRunDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px', width: '90%' }}>
            <div className="modal-header">
              <h3>Production Run Details: {selectedRunDetail.runNumber}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedRunDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  Recipe: <strong>{selectedRunDetail.recipeName}</strong> (v{selectedRunDetail.recipeVersionId})
                </div>
                <div>
                  Status: <strong style={{ color: selectedRunDetail.status === 'COMPLETED' ? '#059669' : '#d97706' }}>
                    {selectedRunDetail.status}
                  </strong>
                </div>
                <div>
                  Finished Item: <strong>{selectedRunDetail.outputVariantName}</strong>
                </div>
                <div>
                  Batch Scale: <strong>{selectedRunDetail.plannedBatchCount}x</strong>
                </div>
                <div>
                  Planned Output: <strong>{selectedRunDetail.plannedOutputQuantity} {selectedRunDetail.outputUnitCode}</strong>
                </div>
                <div>
                  Actual Yield:{' '}
                  <strong>
                    {selectedRunDetail.actualOutputQuantity !== null
                      ? `${selectedRunDetail.actualOutputQuantity} ${selectedRunDetail.outputUnitCode}`
                      : 'Not completed yet'}
                  </strong>
                </div>
                {selectedRunDetail.createdAtUtc && (
                  <div>Created: {formatDateTime(selectedRunDetail.createdAtUtc)}</div>
                )}
                {selectedRunDetail.completedAtUtc && (
                  <div>Completed: {formatDateTime(selectedRunDetail.completedAtUtc)}</div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                  Raw Material Ingredients Consumed / Planned
                </h4>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Material</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Planned Qty</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Actual Consumed</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Unit</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRunDetail.items ?? []).map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.inputVariantName}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.plannedQuantity}</td>
                        <td
                          style={{
                            padding: '6px 10px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.actualQuantity !== null ? '#059669' : '#64748b',
                          }}
                        >
                          {item.actualQuantity !== null ? item.actualQuantity : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.unitCode}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>Rs. {(item.unitCostMinorUnits / 100).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedRunDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW RECIPE BOM DETAILS */}
      {selectedRecipeDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '580px', width: '90%' }}>
            <div className="modal-header">
              <h3>
                Recipe BOM: {selectedRecipeDetail.name} ({selectedRecipeDetail.code})
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedRecipeDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  Finished Product: <strong>{selectedRecipeDetail.outputVariantName}</strong>
                </div>
                <div>
                  Batch Yield:{' '}
                  <strong style={{ color: '#059669' }}>
                    {selectedRecipeDetail.expectedYieldQuantity} {selectedRecipeDetail.outputUnitCode}
                  </strong>
                </div>
                <div>
                  Version: <strong>v{selectedRecipeDetail.currentVersion?.versionNumber ?? 1}</strong>
                </div>
                <div>
                  Status: <strong>{selectedRecipeDetail.isActive ? 'Active' : 'Archived'}</strong>
                </div>
              </div>

              {selectedRecipeDetail.description && (
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  <em>{selectedRecipeDetail.description}</em>
                </div>
              )}

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                  Bill of Materials Ingredients
                </h4>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Ingredient</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Quantity Per Batch</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Unit</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Wastage Allowance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedRecipeDetail.currentVersion?.items ?? []).map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{item.inputVariantName}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{item.unitCode}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right' }}>{item.wastagePercent}%</td>
                      </tr>
                    ))}
                    {(!selectedRecipeDetail.currentVersion?.items ||
                      selectedRecipeDetail.currentVersion.items.length === 0) && (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                            No ingredient items found for this recipe version.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedRecipeDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BOOK CUSTOM ORDER */}
      {showCreateOrderModal && (
        <div className="modal-overlay" style={{ padding: '16px', alignItems: 'center' }}>
          <div className="modal-card" style={{ maxWidth: '640px', width: '90%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3>🎂 Book Custom Cake / Advance Order</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateOrderModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomOrder} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {/* Customer Selector & Quick Register */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>
                      Customer *
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600 }}
                      onClick={() => setShowCreateCustomerModal(true)}
                    >
                      + Quick Register
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={ordCustomerId}
                    onChange={(e) => setOrdCustomerId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} - {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates: Due Date & Event Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Pickup Due Date & Time *</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={ordDueDate}
                      onChange={(e) => setOrdDueDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Event Date (Optional)</label>
                    <input
                      type="date"
                      className="form-input"
                      value={ordEventDate}
                      onChange={(e) => setOrdEventDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cake Specs: Flavor & Size */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Cake Flavor / Sponge</label>
                    <input
                      type="text"
                      className="form-input"
                      value={ordCakeFlavor}
                      onChange={(e) => setOrdCakeFlavor(e.target.value)}
                      placeholder="e.g. Belgian Chocolate Fudge"
                    />
                  </div>
                  <div>
                    <label className="form-label">Cake Size / Weight</label>
                    <input
                      type="text"
                      className="form-input"
                      value={ordCakeSize}
                      onChange={(e) => setOrdCakeSize(e.target.value)}
                      placeholder="e.g. 2 Lbs / 2-Tier 5 Lbs"
                    />
                  </div>
                </div>

                {/* Inscription / Cake Message */}
                <div>
                  <label className="form-label">Inscription on Cake / Piping Message</label>
                  <input
                    type="text"
                    className="form-input"
                    value={ordCakeMessage}
                    onChange={(e) => setOrdCakeMessage(e.target.value)}
                    placeholder='e.g. "Happy 25th Birthday Zara!"'
                  />
                </div>

                {/* Decoration & Allergen Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Decoration / Theme Notes</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={ordDecorationNotes}
                      onChange={(e) => setOrdDecorationNotes(e.target.value)}
                      placeholder="e.g. Golden pearls, pink roses, fondant topper"
                    />
                  </div>
                  <div>
                    <label className="form-label">Allergies / Special Instructions</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={ordAllergensNotes}
                      onChange={(e) => setOrdAllergensNotes(e.target.value)}
                      placeholder="e.g. Nut-free, less sweet, eggless"
                    />
                  </div>
                </div>

                {/* Financials & Advance Deposit */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>
                    Agreed Price & Advance Deposit Collection
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label">Total Price (Rs.) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        className="form-input"
                        value={ordTotalPriceRs}
                        onChange={(e) => setOrdTotalPriceRs(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label">Advance Deposit (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        value={ordDepositRs}
                        onChange={(e) => setOrdDepositRs(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Deposit Method</label>
                      <select
                        className="form-input"
                        value={ordDepositPaymentMethod}
                        onChange={(e) => setOrdDepositPaymentMethod(e.target.value as any)}
                      >
                        <option value="CASH">Cash (In Drawer)</option>
                        <option value="CARD">Card POS</option>
                        <option value="ONLINE">Bank / Online</option>
                      </select>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '10px',
                      padding: '8px 12px',
                      background: '#ffffff',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  >
                    <span>
                      Balance Due on Pickup:{' '}
                      <strong style={{ color: '#dc2626' }}>
                        Rs.{' '}
                        {Math.max(
                          0,
                          parseFloat(ordTotalPriceRs || '0') - parseFloat(ordDepositRs || '0')
                        ).toFixed(2)}
                      </strong>
                    </span>
                    {ordDepositPaymentMethod === 'CASH' && parseFloat(ordDepositRs || '0') > 0 && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                        ✓ Rs. {parseFloat(ordDepositRs || '0').toFixed(2)} will be added to Cash Drawer
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateOrderModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={customOrdersLoading}
                  style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', fontWeight: 700 }}
                >
                  {customOrdersLoading ? 'Booking...' : 'Confirm & Book Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COLLECT BALANCE / RECORD PAYMENT */}
      {showOrderPaymentModal && paymentTargetOrder && (
        <div className="modal-overlay" style={{ padding: '16px', alignItems: 'center' }}>
          <div className="modal-card" style={{ maxWidth: '480px', width: '90%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3>💰 Collect Payment: {paymentTargetOrder.orderNumber}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowOrderPaymentModal(false);
                  setPaymentTargetOrder(null);
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRecordOrderPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div>
                    Customer: <strong>{paymentTargetOrder.customer?.name || 'Walk-in'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Agreed Price:</span>
                    <span>Rs. {(paymentTargetOrder.totalAmountMinorUnits / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                    <span>Already Deposited:</span>
                    <span>Rs. {(paymentTargetOrder.depositAmountMinorUnits / 100).toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      color: '#dc2626',
                      borderTop: '1px dashed #cbd5e1',
                      paddingTop: '6px',
                    }}
                  >
                    <span>Remaining Balance Due:</span>
                    <span>Rs. {(paymentTargetOrder.balanceAmountMinorUnits / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">Payment Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    value={orderPayAmountRs}
                    onChange={(e) => setOrderPayAmountRs(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="form-input"
                    value={orderPayMethod}
                    onChange={(e) => setOrderPayMethod(e.target.value as any)}
                  >
                    <option value="CASH">Cash (In Drawer)</option>
                    <option value="CARD">Card POS</option>
                    <option value="ONLINE">Bank / Online</option>
                  </select>
                </div>

                {orderPayMethod === 'CASH' && (
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                    ✓ Cash payment will immediately record into the active shift cash drawer.
                  </div>
                )}

                <div>
                  <label className="form-label">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={orderPayNotes}
                    onChange={(e) => setOrderPayNotes(e.target.value)}
                    placeholder="e.g. Balance collected at pickup"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowOrderPaymentModal(false);
                    setPaymentTargetOrder(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={customOrdersLoading}
                  style={{ background: '#059669', borderColor: '#047857', fontWeight: 700 }}
                >
                  {customOrdersLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW CUSTOM ORDER SHEET / DETAILS */}
      {selectedOrderDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header">
              <h3>Custom Order Sheet: {selectedOrderDetail.orderNumber}</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedOrderDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Order Meta Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  Customer: <strong>{selectedOrderDetail.customer?.name || 'Walk-in'}</strong>
                  {selectedOrderDetail.customer?.phone && (
                    <span style={{ color: '#64748b' }}> ({selectedOrderDetail.customer.phone})</span>
                  )}
                </div>
                <div>
                  Pickup Due:{' '}
                  <strong style={{ color: '#0369a1' }}>
                    {formatDateTime(selectedOrderDetail.dueDateUtc)}
                  </strong>
                </div>
                <div>
                  Status: <strong>{selectedOrderDetail.status}</strong>
                </div>
                <div>
                  Booked On: <strong>{formatDateTime(selectedOrderDetail.createdAtUtc)}</strong>
                </div>
              </div>

              {/* Cake Specifications Box */}
              <div style={{ background: '#fefce8', padding: '14px', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#854d0e' }}>
                  🎂 Cake Specifications & Kitchen Notes
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', marginBottom: '8px' }}>
                  <div>
                    Flavor / Sponge: <strong>{selectedOrderDetail.cakeFlavor || 'Standard'}</strong>
                  </div>
                  <div>
                    Size / Tiers: <strong>{selectedOrderDetail.cakeSize || 'Standard'}</strong>
                  </div>
                </div>

                {selectedOrderDetail.cakeMessage && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 700, textTransform: 'uppercase' }}>
                      Piping Inscription:
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontStyle: 'italic',
                        color: '#0369a1',
                        fontWeight: 600,
                        padding: '6px 10px',
                        background: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        marginTop: '4px',
                      }}
                    >
                      “{selectedOrderDetail.cakeMessage}”
                    </div>
                  </div>
                )}

                {selectedOrderDetail.decorationNotes && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#713f12' }}>
                    <strong>Decoration / Theme:</strong> {selectedOrderDetail.decorationNotes}
                  </div>
                )}

                {selectedOrderDetail.allergensNotes && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#b91c1c' }}>
                    <strong>Allergies / Special:</strong> {selectedOrderDetail.allergensNotes}
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                  Financial Breakdown
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Agreed Total Price:</span>
                  <span style={{ fontWeight: 700 }}>
                    Rs. {(selectedOrderDetail.totalAmountMinorUnits / 100).toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', color: '#059669' }}>
                  <span>Advance Deposit Paid:</span>
                  <span style={{ fontWeight: 700 }}>
                    Rs. {(selectedOrderDetail.depositAmountMinorUnits / 100).toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: selectedOrderDetail.balanceAmountMinorUnits > 0 ? '#dc2626' : '#059669',
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: '6px',
                  }}
                >
                  <span>Remaining Balance Due:</span>
                  <span>
                    {selectedOrderDetail.balanceAmountMinorUnits > 0
                      ? `Rs. ${(selectedOrderDetail.balanceAmountMinorUnits / 100).toFixed(2)}`
                      : '✓ FULLY PAID'}
                  </span>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
                  Payment Records ({selectedOrderDetail.payments?.length ?? 0})
                </h4>
                <table className="data-table">
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '6px 10px' }}>Ref / Notes</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Type</th>
                      <th style={{ textAlign: 'center', padding: '6px 10px' }}>Method</th>
                      <th style={{ textAlign: 'right', padding: '6px 10px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrderDetail.payments ?? []).map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px' }}>{formatDateTime(p.createdAtUtc)}</td>
                        <td style={{ padding: '6px 10px', fontSize: '12px', color: '#475569' }}>
                          {p.referenceNotes || `PAY-#${p.id}`}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: p.paymentType === 'DEPOSIT' ? '#eff6ff' : '#ecfdf5',
                              color: p.paymentType === 'DEPOSIT' ? '#1d4ed8' : '#059669',
                              fontWeight: 600,
                            }}
                          >
                            {p.paymentType}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600 }}>{p.paymentMethod}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          Rs. {(p.amountMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {(!selectedOrderDetail.payments || selectedOrderDetail.payments.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '12px', color: '#94a3b8' }}>
                          No payment transactions recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                🖨️ Print Kitchen Sheet
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedOrderDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER CUSTOMER */}
      {showCreateCustomerModal && (
        <div className="modal-overlay" style={{ padding: '16px', alignItems: 'center' }}>
          <div className="modal-card" style={{ maxWidth: '480px', width: '90%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3>👤 Register Customer</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCreateCustomerModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                <div>
                  <label className="form-label">Customer Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    required
                    placeholder="e.g. Fatima Tariq"
                  />
                </div>
                <div>
                  <label className="form-label">Phone Number (Fast Lookup)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="e.g. 03001234567"
                  />
                </div>
                <div>
                  <label className="form-label">Email Address (Optional)</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="e.g. fatima@example.com"
                  />
                </div>
                <div>
                  <label className="form-label">Delivery / Street Address (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    placeholder="e.g. House 14, Street 5, Phase 4"
                  />
                </div>
                <div>
                  <label className="form-label">Preferences / Notes (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={newCustNotes}
                    onChange={(e) => setNewCustNotes(e.target.value)}
                    placeholder="e.g. Regular customer, VIP event booking"
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateCustomerModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HELD / PARKED CARTS DIRECTORY */}
      {showHeldCartsModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '640px', width: '90%' }}>
            <div className="modal-header">
              <h3>⏸️ Parked / Held Carts ({heldCarts.length})</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHeldCartsModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Restoring a parked cart will load its items directly back into the POS checkout terminal.
              </p>

              <table className="data-table">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Hold Code</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Customer / Note</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Items</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Subtotal</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {heldCarts.map((hc) => (
                    <tr key={hc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0369a1' }}>
                        {hc.cartCode}
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {formatDateTime(hc.createdAtUtc)}
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{hc.customerNameOrPhone || 'Anonymous Customer'}</div>
                        {hc.notes && <div style={{ fontSize: '11px', color: '#64748b' }}>{hc.notes}</div>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                        {hc.itemCount} items
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        Rs. {(hc.subtotalMinorUnits / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
                            onClick={() => handleRestoreHeldCart(hc.id)}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}
                            onClick={() => handleDiscardHeldCart(hc.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {heldCarts.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        No held carts currently parked.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowHeldCartsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM HOLD CURRENT CART */}
      {showHoldCartConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '440px', width: '90%' }}>
            <div className="modal-header">
              <h3>⏸️ Park / Hold Current Cart</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowHoldCartConfirmModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  Items in cart: <strong>{cart.reduce((acc, i) => acc + i.quantity, 0)}</strong>
                </div>
                <div>
                  Cart Total:{' '}
                  <strong style={{ color: '#059669' }}>
                    Rs. {(cartTotalMinor / 100).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="form-label">Customer Name or Phone (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={holdCartCustomer}
                  onChange={(e) => setHoldCartCustomer(e.target.value)}
                  placeholder="e.g. Usman (0300...)"
                />
              </div>

              <div>
                <label className="form-label">Reason / Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={holdCartNotes}
                  onChange={(e) => setHoldCartNotes(e.target.value)}
                  placeholder="e.g. Stepped out to car for cash"
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowHoldCartConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleHoldCurrentCart}
                style={{ background: '#d97706', borderColor: '#b45309', fontWeight: 700 }}
              >
                Park Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

