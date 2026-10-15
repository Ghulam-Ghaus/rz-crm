import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  CustomOrderEntity,
  CustomOrderLineEntity,
  CustomOrderPaymentEntity,
  CustomerEntity,
  ShiftEntity,
  CashTransactionEntity,
} from '@rz-crm/database';
import {
  CustomOrder,
  CustomOrderStatus,
  CreateCustomOrderInput,
  UpdateCustomOrderStatusInput,
  AddCustomOrderPaymentInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class CustomOrdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async createCustomOrder(input: CreateCustomOrderInput): Promise<CustomOrder> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const orderRepo = manager.getRepository(CustomOrderEntity);
      const lineRepo = manager.getRepository(CustomOrderLineEntity);
      const paymentRepo = manager.getRepository(CustomOrderPaymentEntity);
      const custRepo = manager.getRepository(CustomerEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);

      const storeId = input.storeId ?? 1;

      // Verify customer exists
      const customer = await custRepo.findOne({ where: { id: input.customerId } });
      if (!customer) {
        throw new Error(`Customer with ID ${input.customerId} not found.`);
      }

      // Generate order number
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await orderRepo.count();
      const orderNumber = `ORD-${today}-${String(count + 1).padStart(4, '0')}`;

      const totalAmount = input.totalAmountMinorUnits;
      const depositAmount = Math.min(totalAmount, Math.max(0, input.depositAmountMinorUnits || 0));
      const balanceAmount = totalAmount - depositAmount;
      const now = nowUtcString();

      const order = orderRepo.create({
        storeId,
        orderNumber,
        customerId: input.customerId,
        dueDateUtc: input.dueDateUtc,
        eventDateUtc: input.eventDateUtc || null,
        status: 'CONFIRMED',
        totalAmountMinorUnits: totalAmount,
        depositAmountMinorUnits: depositAmount,
        balanceAmountMinorUnits: balanceAmount,
        currencyCode: 'PKR',
        cakeFlavor: input.cakeFlavor?.trim() || null,
        cakeSize: input.cakeSize?.trim() || null,
        cakeMessage: input.cakeMessage?.trim() || null,
        decorationNotes: input.decorationNotes?.trim() || null,
        allergensNotes: input.allergensNotes?.trim() || null,
        createdBy: input.cashierId || null,
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedOrder = await orderRepo.save(order);

      // 1. If lines are provided, save them
      const savedLines: CustomOrderLineEntity[] = [];
      if (input.lines && input.lines.length > 0) {
        for (const line of input.lines) {
          const l = lineRepo.create({
            customOrderId: savedOrder.id,
            productVariantId: line.productVariantId || null,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPriceMinorUnits: line.unitPriceMinorUnits,
            totalPriceMinorUnits: line.quantity * line.unitPriceMinorUnits,
          });
          savedLines.push(await lineRepo.save(l));
        }
      }

      // 2. If deposit is paid, record payment and update shift drawer if cash
      const savedPayments: CustomOrderPaymentEntity[] = [];
      if (depositAmount > 0) {
        const method = input.depositPaymentMethod || 'CASH';
        const payment = paymentRepo.create({
          customOrderId: savedOrder.id,
          paymentType: 'DEPOSIT',
          paymentMethod: method,
          amountMinorUnits: depositAmount,
          currencyCode: 'PKR',
          shiftId: input.shiftId || null,
          cashierId: input.cashierId || null,
          referenceNotes: `Advance deposit for ${orderNumber}`,
          createdAtUtc: now,
        });
        savedPayments.push(await paymentRepo.save(payment));

        // Update shift expected cash if paid in CASH
        if (method === 'CASH' && input.shiftId) {
          const shift = await shiftRepo.findOne({ where: { id: input.shiftId, status: 'open' } });
          if (shift) {
            shift.expectedCashMinorUnits += depositAmount;
            shift.updatedAtUtc = now;
            await shiftRepo.save(shift);

            // Record cash transaction movement
            const tx = cashTxRepo.create({
              shiftId: shift.id,
              transactionType: 'sale_in',
              amountMinorUnits: depositAmount,
              sourceId: `ORDER-${savedOrder.id}`,
              notes: `Order ${orderNumber} advance cash deposit`,
              createdAtUtc: now,
            });
            await cashTxRepo.save(tx);
          }
        }
      }

      return this.mapToDto(savedOrder, customer, savedLines, savedPayments);
    });
  }

  public async getCustomOrders(storeId: number, status?: string): Promise<CustomOrder[]> {
    const ds = this.databaseService.getDataSource();
    const orderRepo = ds.getRepository(CustomOrderEntity);
    const custRepo = ds.getRepository(CustomerEntity);

    const qb = orderRepo
      .createQueryBuilder('o')
      .where('o.store_id = :storeId', { storeId });

    if (status) {
      qb.andWhere('o.status = :status', { status });
    }

    qb.orderBy('o.due_date_utc', 'ASC');

    const orders = await qb.getMany();
    if (orders.length === 0) return [];

    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    let customerMap = new Map<number, CustomerEntity>();
    if (customerIds.length > 0) {
      const customers = await custRepo
        .createQueryBuilder('c')
        .where('c.id IN (:...ids)', { ids: customerIds })
        .getMany();
      customerMap = new Map(customers.map((c: CustomerEntity) => [c.id, c]));
    }

    return orders.map((o) => this.mapToDto(o, customerMap.get(o.customerId) || null));
  }

  public async getCustomOrder(orderId: number): Promise<CustomOrder> {
    const ds = this.databaseService.getDataSource();
    const orderRepo = ds.getRepository(CustomOrderEntity);
    const lineRepo = ds.getRepository(CustomOrderLineEntity);
    const paymentRepo = ds.getRepository(CustomOrderPaymentEntity);
    const custRepo = ds.getRepository(CustomerEntity);

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new Error(`Custom order #${orderId} not found.`);

    const [customer, lines, payments] = await Promise.all([
      custRepo.findOne({ where: { id: order.customerId } }),
      lineRepo.find({ where: { customOrderId: order.id } }),
      paymentRepo.find({ where: { customOrderId: order.id }, order: { createdAtUtc: 'ASC' } }),
    ]);

    return this.mapToDto(order, customer, lines, payments);
  }

  public async updateOrderStatus(input: UpdateCustomOrderStatusInput): Promise<CustomOrder> {
    const ds = this.databaseService.getDataSource();
    const orderRepo = ds.getRepository(CustomOrderEntity);

    const order = await orderRepo.findOne({ where: { id: input.orderId } });
    if (!order) throw new Error(`Order #${input.orderId} not found.`);

    const validStatuses: CustomOrderStatus[] = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'COLLECTED', 'CANCELLED'];
    if (!validStatuses.includes(input.status)) {
      throw new Error(`Invalid status: ${input.status}`);
    }

    order.status = input.status;
    order.updatedAtUtc = nowUtcString();

    const saved = await orderRepo.save(order);
    return this.getCustomOrder(saved.id);
  }

  public async recordOrderPayment(input: AddCustomOrderPaymentInput): Promise<CustomOrder> {
    const ds = this.databaseService.getDataSource();

    return ds.transaction(async (manager) => {
      const orderRepo = manager.getRepository(CustomOrderEntity);
      const paymentRepo = manager.getRepository(CustomOrderPaymentEntity);
      const shiftRepo = manager.getRepository(ShiftEntity);
      const cashTxRepo = manager.getRepository(CashTransactionEntity);

      const order = await orderRepo.findOne({ where: { id: input.orderId } });
      if (!order) throw new Error(`Order #${input.orderId} not found.`);

      if (order.status === 'CANCELLED') {
        throw new Error(`Cannot record payment for cancelled order #${order.orderNumber}.`);
      }

      const now = nowUtcString();

      // Create payment record
      const payment = paymentRepo.create({
        customOrderId: order.id,
        paymentType: input.paymentType,
        paymentMethod: input.paymentMethod,
        amountMinorUnits: input.amountMinorUnits,
        currencyCode: 'PKR',
        shiftId: input.shiftId || null,
        cashierId: input.cashierId || null,
        referenceNotes: input.referenceNotes || null,
        createdAtUtc: now,
      });
      await paymentRepo.save(payment);

      // Recalculate deposit & balance
      order.depositAmountMinorUnits += input.amountMinorUnits;
      order.balanceAmountMinorUnits = Math.max(0, order.totalAmountMinorUnits - order.depositAmountMinorUnits);
      order.updatedAtUtc = now;
      await orderRepo.save(order);

      // Update shift cash drawer if payment is in CASH
      if (input.paymentMethod === 'CASH' && input.shiftId) {
        const shift = await shiftRepo.findOne({ where: { id: input.shiftId, status: 'open' } });
        if (shift) {
          shift.expectedCashMinorUnits += input.amountMinorUnits;
          shift.updatedAtUtc = now;
          await shiftRepo.save(shift);

          const tx = cashTxRepo.create({
            shiftId: shift.id,
            transactionType: 'sale_in',
            amountMinorUnits: input.amountMinorUnits,
            sourceId: `ORDER-${order.id}`,
            notes: `Order ${order.orderNumber} ${input.paymentType.toLowerCase()} payment`,
            createdAtUtc: now,
          });
          await cashTxRepo.save(tx);
        }
      }

      return this.getCustomOrder(order.id);
    });
  }

  private mapToDto(
    order: CustomOrderEntity,
    customer?: CustomerEntity | null,
    lines?: CustomOrderLineEntity[],
    payments?: CustomOrderPaymentEntity[]
  ): CustomOrder {
    return {
      id: order.id,
      storeId: order.storeId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      dueDateUtc: order.dueDateUtc,
      eventDateUtc: order.eventDateUtc,
      status: order.status as CustomOrderStatus,
      totalAmountMinorUnits: order.totalAmountMinorUnits,
      depositAmountMinorUnits: order.depositAmountMinorUnits,
      balanceAmountMinorUnits: order.balanceAmountMinorUnits,
      currencyCode: order.currencyCode,
      cakeFlavor: order.cakeFlavor,
      cakeSize: order.cakeSize,
      cakeMessage: order.cakeMessage,
      decorationNotes: order.decorationNotes,
      allergensNotes: order.allergensNotes,
      createdBy: order.createdBy,
      createdAtUtc: order.createdAtUtc,
      updatedAtUtc: order.updatedAtUtc,
      customer: customer
        ? {
            id: customer.id,
            storeId: customer.storeId,
            code: customer.code,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            notes: customer.notes,
            createdAtUtc: customer.createdAtUtc,
            updatedAtUtc: customer.updatedAtUtc,
          }
        : undefined,
      lines: lines?.map((l) => ({
        id: l.id,
        customOrderId: l.customOrderId,
        productVariantId: l.productVariantId,
        itemName: l.itemName,
        quantity: l.quantity,
        unitPriceMinorUnits: l.unitPriceMinorUnits,
        totalPriceMinorUnits: l.totalPriceMinorUnits,
      })),
      payments: payments?.map((p) => ({
        id: p.id,
        customOrderId: p.customOrderId,
        paymentType: p.paymentType as 'DEPOSIT' | 'BALANCE' | 'REFUND',
        paymentMethod: p.paymentMethod as 'CASH' | 'CARD' | 'ONLINE',
        amountMinorUnits: p.amountMinorUnits,
        currencyCode: p.currencyCode,
        shiftId: p.shiftId,
        cashierId: p.cashierId,
        referenceNotes: p.referenceNotes,
        createdAtUtc: p.createdAtUtc,
      })),
    };
  }
}
