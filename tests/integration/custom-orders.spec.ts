import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  bootstrapBackend,
  ActiveBackend,
  CustomersService,
  CustomOrdersService,
  HeldCartsService,
  ShiftsService,
} from '@rz-crm/backend';
import { StoreEntity } from '@rz-crm/database';

describe('Phase 6 — Custom Orders, Advance Bookings & Held Carts Integration', () => {
  let tempDir: string;
  let activeBackend: ActiveBackend;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bakery-custom-orders-test-'));
    const dbPath = path.join(tempDir, 'custom_orders_test.db');

    activeBackend = await bootstrapBackend({
      dbPath,
      runMigrations: true,
    });
  });

  afterEach(async () => {
    if (activeBackend) {
      await activeBackend.appContext.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should manage customers, book custom cake orders with advance deposit, reconcile drawer, collect balance, and handle held carts', async () => {
    const ds = activeBackend.dbManager.getDataSource();
    const customersService = activeBackend.appContext.get(CustomersService);
    const customOrdersService = activeBackend.appContext.get(CustomOrdersService);
    const heldCartsService = activeBackend.appContext.get(HeldCartsService);
    const shiftsService = activeBackend.appContext.get(ShiftsService);

    // 1. Setup Store
    const store = await ds.getRepository(StoreEntity).save({
      code: 'STORE-ORD-01',
      name: 'Gulberg Sweet Boutique',
      address: 'Main Boulevard, Gulberg III, Lahore',
      phone: '+92 42 35789999',
      currencyCode: 'PKR',
      timezone: 'Asia/Karachi',
      createdAtUtc: new Date().toISOString(),
      updatedAtUtc: new Date().toISOString(),
    });

    // 2. Open Cashier Shift with Rs. 1,000 float
    const shift = await shiftsService.openShift({
      storeId: store.id,
      cashierId: 'cashier-01',
      openingFloatMinorUnits: 100000, // Rs. 1000.00
      notes: 'Morning shift',
    });
    expect(shift.expectedCashMinorUnits).toBe(100000);

    // 3. Customer Registration & Lookup
    const customer = await customersService.createCustomer({
      storeId: store.id,
      name: 'Fatima Zahra',
      phone: '03001234567',
      email: 'fatima@example.com',
      address: 'House 42, Street 5, Gulberg',
      notes: 'Regular VIP client',
    });
    expect(customer.id).toBeDefined();
    expect(customer.code).toMatch(/^CUST-/);

    // Test search by phone
    const searchPhone = await customersService.searchCustomers(store.id, '1234567');
    expect(searchPhone.length).toBe(1);
    expect(searchPhone[0]?.name).toBe('Fatima Zahra');

    // Test search by name
    const searchName = await customersService.searchCustomers(store.id, 'Fatima');
    expect(searchName.length).toBe(1);

    // 4. Book Custom Cake Order with Advance Deposit
    const dueDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const order = await customOrdersService.createCustomOrder({
      storeId: store.id,
      customerId: customer.id,
      dueDateUtc: dueDate,
      cakeFlavor: 'Red Velvet Cream Cheese',
      cakeSize: '4 Lbs (2 Tiers)',
      cakeMessage: 'Happy 10th Birthday Ali!',
      decorationNotes: 'Gold leaf flakes, fresh strawberries, navy ribbon on bottom tier',
      allergensNotes: 'Contains dairy, eggs, gluten. Nut-free strictly required.',
      totalAmountMinorUnits: 450000, // Rs. 4,500.00
      depositAmountMinorUnits: 150000, // Rs. 1,500.00 deposit
      depositPaymentMethod: 'CASH',
      shiftId: shift.id,
      cashierId: 'cashier-01',
      lines: [
        {
          itemName: 'Custom 2-Tier Red Velvet Cake (4 Lbs)',
          quantity: 1,
          unitPriceMinorUnits: 400000,
        },
        {
          itemName: 'Special Golden Acrylic Cake Topper',
          quantity: 1,
          unitPriceMinorUnits: 50000,
        },
      ],
    });

    expect(order.orderNumber).toMatch(/^ORD-/);
    expect(order.status).toBe('CONFIRMED');
    expect(order.totalAmountMinorUnits).toBe(450000);
    expect(order.depositAmountMinorUnits).toBe(150000);
    expect(order.balanceAmountMinorUnits).toBe(300000); // Rs. 3,000 remaining
    expect(order.customer?.name).toBe('Fatima Zahra');
    expect(order.lines?.length).toBe(2);
    expect(order.payments?.length).toBe(1);
    expect(order.payments?.[0]?.paymentType).toBe('DEPOSIT');
    expect(order.payments?.[0]?.amountMinorUnits).toBe(150000);

    // Verify shift drawer cash increased by Rs. 1,500 (from 1,000 to 2,500)
    const shiftAfterDeposit = await shiftsService.getActiveShift(store.id);
    expect(shiftAfterDeposit?.expectedCashMinorUnits).toBe(250000); // Rs. 2,500.00

    // 5. Lifecycle Status Progression
    // Transition to IN_PRODUCTION (Kitchen starts baking)
    const inProdOrder = await customOrdersService.updateOrderStatus({
      orderId: order.id,
      status: 'IN_PRODUCTION',
    });
    expect(inProdOrder.status).toBe('IN_PRODUCTION');

    // Transition to READY (Cake decorated and in display cooler)
    const readyOrder = await customOrdersService.updateOrderStatus({
      orderId: order.id,
      status: 'READY',
    });
    expect(readyOrder.status).toBe('READY');

    // 6. Remaining Balance Payment upon Pickup
    const paidOrder = await customOrdersService.recordOrderPayment({
      orderId: order.id,
      paymentType: 'BALANCE',
      paymentMethod: 'CASH',
      amountMinorUnits: 300000, // Remaining Rs. 3,000.00
      shiftId: shift.id,
      cashierId: 'cashier-01',
      referenceNotes: 'Final balance paid at counter on pickup',
    });

    expect(paidOrder.depositAmountMinorUnits).toBe(450000);
    expect(paidOrder.balanceAmountMinorUnits).toBe(0); // Balance fully cleared!
    expect(paidOrder.payments?.length).toBe(2);

    // Shift drawer expected cash increases to Rs. 5,500 (2,500 + 3,000)
    const shiftAfterBalance = await shiftsService.getActiveShift(store.id);
    expect(shiftAfterBalance?.expectedCashMinorUnits).toBe(550000); // Rs. 5,500.00

    // Complete order pickup
    const collectedOrder = await customOrdersService.updateOrderStatus({
      orderId: order.id,
      status: 'COLLECTED',
    });
    expect(collectedOrder.status).toBe('COLLECTED');

    // 7. Held Carts (Park & Retrieve Cart at POS)
    const cartPayload = JSON.stringify([
      { variantId: 1, name: 'Butter Croissant', quantity: 2, unitPriceMinorUnits: 25000 },
      { variantId: 2, name: 'Sourdough Loaf', quantity: 1, unitPriceMinorUnits: 45000 },
    ]);

    const heldCart = await heldCartsService.holdCart({
      storeId: store.id,
      cashierId: 'cashier-01',
      customerNameOrPhone: 'Ali Raza / 03219876543',
      cartJson: cartPayload,
      itemCount: 3,
      subtotalMinorUnits: 95000,
      notes: 'Customer went to get car keys',
    });

    expect(heldCart.id).toBeDefined();
    expect(heldCart.cartCode).toMatch(/^HOLD-/);
    expect(heldCart.itemCount).toBe(3);

    // List held carts
    const heldList = await heldCartsService.getHeldCarts(store.id);
    expect(heldList.length).toBe(1);
    expect(heldList[0]?.customerNameOrPhone).toBe('Ali Raza / 03219876543');

    // Restore held cart (retrieves and deletes from held table)
    const restoredCart = await heldCartsService.restoreHeldCart(heldCart.id);
    expect(restoredCart.cartJson).toBe(cartPayload);

    // Verify held table is now empty
    const heldListAfter = await heldCartsService.getHeldCarts(store.id);
    expect(heldListAfter.length).toBe(0);
  });
});
