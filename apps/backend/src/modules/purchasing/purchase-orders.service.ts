import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  SupplierEntity,
  ProductVariantEntity,
  ProductEntity,
} from '@rz-crm/database';
import {
  PurchaseOrder,
  PurchaseOrderLine,
  CreatePurchaseOrderInput,
} from '@rz-crm/contracts';
import { nowUtcString } from '@rz-crm/shared';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getPurchaseOrders(storeId: number): Promise<PurchaseOrder[]> {
    const dataSource = this.databaseService.getDataSource();
    const poRepo = dataSource.getRepository(PurchaseOrderEntity);
    const supplierRepo = dataSource.getRepository(SupplierEntity);

    const orders = await poRepo.find({
      where: { storeId },
      order: { id: 'DESC' },
    });

    const suppliers = await supplierRepo.find({ where: { storeId } });
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

    return orders.map((po) => ({
      id: po.id,
      storeId: po.storeId,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: supplierMap.get(po.supplierId) ?? 'Unknown Supplier',
      status: po.status,
      orderDateUtc: po.orderDateUtc,
      expectedDeliveryDateUtc: po.expectedDeliveryDateUtc,
      subtotalMinorUnits: po.subtotalMinorUnits,
      taxMinorUnits: po.taxMinorUnits,
      totalCostMinorUnits: po.totalCostMinorUnits,
      currencyCode: po.currencyCode,
      notes: po.notes,
      createdBy: po.createdBy,
      createdAtUtc: po.createdAtUtc,
      updatedAtUtc: po.updatedAtUtc,
    }));
  }

  public async getPurchaseOrder(poId: number): Promise<PurchaseOrder> {
    const dataSource = this.databaseService.getDataSource();
    const poRepo = dataSource.getRepository(PurchaseOrderEntity);
    const lineRepo = dataSource.getRepository(PurchaseOrderLineEntity);
    const supplierRepo = dataSource.getRepository(SupplierEntity);
    const variantRepo = dataSource.getRepository(ProductVariantEntity);
    const productRepo = dataSource.getRepository(ProductEntity);

    const po = await poRepo.findOne({ where: { id: poId } });
    if (!po) throw new Error(`Purchase order #${poId} not found`);

    const supplier = await supplierRepo.findOne({ where: { id: po.supplierId } });
    const rawLines = await lineRepo.find({ where: { purchaseOrderId: po.id } });

    const lines: PurchaseOrderLine[] = [];
    for (const line of rawLines) {
      const variant = await variantRepo.findOne({ where: { id: line.productVariantId } });
      const product = variant ? await productRepo.findOne({ where: { id: variant.productId } }) : null;

      lines.push({
        id: line.id,
        purchaseOrderId: line.purchaseOrderId,
        productVariantId: line.productVariantId,
        productName: product?.name ?? variant?.name ?? 'Unknown Product',
        sku: variant?.sku ?? '',
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: line.receivedQuantity,
        unitCode: line.unitCode,
        unitCostMinorUnits: line.unitCostMinorUnits,
        totalCostMinorUnits: line.totalCostMinorUnits,
        notes: line.notes,
      });
    }

    return {
      id: po.id,
      storeId: po.storeId,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: supplier?.name ?? 'Unknown Supplier',
      status: po.status,
      orderDateUtc: po.orderDateUtc,
      expectedDeliveryDateUtc: po.expectedDeliveryDateUtc,
      subtotalMinorUnits: po.subtotalMinorUnits,
      taxMinorUnits: po.taxMinorUnits,
      totalCostMinorUnits: po.totalCostMinorUnits,
      currencyCode: po.currencyCode,
      notes: po.notes,
      createdBy: po.createdBy,
      createdAtUtc: po.createdAtUtc,
      updatedAtUtc: po.updatedAtUtc,
      lines,
    };
  }

  public async createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    const dataSource = this.databaseService.getDataSource();
    const now = nowUtcString();

    return await dataSource.transaction(async (manager) => {
      const poRepo = manager.getRepository(PurchaseOrderEntity);
      const lineRepo = manager.getRepository(PurchaseOrderLineEntity);
      const supplierRepo = manager.getRepository(SupplierEntity);
      const variantRepo = manager.getRepository(ProductVariantEntity);

      const supplier = await supplierRepo.findOne({ where: { id: input.supplierId } });
      if (!supplier) throw new Error(`Supplier #${input.supplierId} not found`);

      // Generate sequential PO number: PO-YYYYMMDD-XXXX
      const datePart = now.slice(0, 10).replace(/-/g, '');
      const count = await poRepo.count({ where: { storeId: input.storeId } });
      const poNumber = `PO-${datePart}-${String(count + 1).padStart(4, '0')}`;

      let subtotal = 0;
      interface LineToSave {
        variantId: number;
        qty: number;
        unitCode: string;
        unitCost: number;
        lineTotal: number;
        notes?: string;
      }
      const linesToSave: LineToSave[] = [];

      for (const line of input.lines) {
        if (line.orderedQuantity <= 0) {
          throw new Error(`Ordered quantity must be greater than zero`);
        }
        const variant = await variantRepo.findOne({ where: { id: line.productVariantId } });
        if (!variant) throw new Error(`Variant #${line.productVariantId} not found`);

        const lineTotal = line.orderedQuantity * line.unitCostMinorUnits;
        subtotal += lineTotal;
        linesToSave.push({
          variantId: variant.id,
          qty: line.orderedQuantity,
          unitCode: line.unitCode,
          unitCost: line.unitCostMinorUnits,
          lineTotal,
          notes: line.notes,
        });
      }

      const total = subtotal; // Tax can be applied in extended tax engine

      const poEntity = poRepo.create({
        storeId: input.storeId,
        poNumber,
        supplierId: input.supplierId,
        status: 'DRAFT',
        orderDateUtc: now,
        expectedDeliveryDateUtc: input.expectedDeliveryDateUtc ?? null,
        subtotalMinorUnits: subtotal,
        taxMinorUnits: 0,
        totalCostMinorUnits: total,
        currencyCode: 'PKR',
        notes: input.notes ?? null,
        createdBy: 'ADMIN',
        createdAtUtc: now,
        updatedAtUtc: now,
      });

      const savedPo = await poRepo.save(poEntity);

      for (const item of linesToSave) {
        const lineEntity = lineRepo.create({
          purchaseOrderId: savedPo.id,
          productVariantId: item.variantId,
          orderedQuantity: item.qty,
          receivedQuantity: 0,
          unitCode: item.unitCode,
          unitCostMinorUnits: item.unitCost,
          totalCostMinorUnits: item.lineTotal,
          notes: item.notes ?? null,
        });
        await lineRepo.save(lineEntity);
      }

      return {
        id: savedPo.id,
        storeId: savedPo.storeId,
        poNumber: savedPo.poNumber,
        supplierId: savedPo.supplierId,
        supplierName: supplier.name,
        status: savedPo.status,
        orderDateUtc: savedPo.orderDateUtc,
        expectedDeliveryDateUtc: savedPo.expectedDeliveryDateUtc,
        subtotalMinorUnits: savedPo.subtotalMinorUnits,
        taxMinorUnits: savedPo.taxMinorUnits,
        totalCostMinorUnits: savedPo.totalCostMinorUnits,
        currencyCode: savedPo.currencyCode,
        notes: savedPo.notes,
        createdBy: savedPo.createdBy,
        createdAtUtc: savedPo.createdAtUtc,
        updatedAtUtc: savedPo.updatedAtUtc,
      };
    });
  }

  public async approvePurchaseOrder(poId: number): Promise<PurchaseOrder> {
    const dataSource = this.databaseService.getDataSource();
    const poRepo = dataSource.getRepository(PurchaseOrderEntity);

    const po = await poRepo.findOne({ where: { id: poId } });
    if (!po) throw new Error(`Purchase order #${poId} not found`);
    if (po.status !== 'DRAFT') {
      throw new Error(`Cannot approve purchase order with status '${po.status}'`);
    }

    po.status = 'APPROVED';
    po.updatedAtUtc = nowUtcString();
    await poRepo.save(po);

    return this.getPurchaseOrder(po.id);
  }
}
