import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { StoreEntity, InstallationEntity, RegisterEntity, SettingEntity } from '@bakery/database';
import { Store, Installation, Register, Setting } from '@bakery/contracts';

@Injectable()
export class StoreSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  public async getActiveStore(): Promise<Store> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(StoreEntity);
    let store = await repo.findOne({ where: { isActive: true } });

    if (!store) {
      const now = new Date().toISOString();
      store = repo.create({
        code: 'MEZAAN-01',
        name: 'میزان سویٹس اینڈ بیکرز (Mezaan Sweets & Bakers)',
        timezone: 'Asia/Karachi',
        currencyCode: 'PKR',
        phone: '0343-7763677 / 0309-8809054 / 0301-6008625',
        address: 'چک نمبر 24 ج ب لاہوریاں (Chak No. 24 JB Lahorian)',
        receiptHeader: 'میزان سویٹس اینڈ بیکرز\nMEZAAN SWEETS & BAKERS\nتازہ اور معیاری مٹھائیوں کا مرکز\nچک نمبر 24 ج ب لاہوریاں\nچوہدری تبسم: 0343-7763677\nچوہدری عبدالرؤف: 0309-8809054\nچوہدری محسن: 0301-6008625',
        receiptFooter: 'ذائقہ ہمارا، پہچان آپ کی\nشادی بیاہ، سالگرہ اور دیگر تقریبات کیلئے مال آرڈر پر بھی تیار کیا جاتا ہے\nThank You For Visiting!',
        isActive: true,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await repo.save(store);
    } else if (store.name === 'Bakery Store' || store.code === 'STR-001') {
      store.name = 'میزان سویٹس اینڈ بیکرز (Mezaan Sweets & Bakers)';
      store.code = 'MEZAAN-01';
      store.phone = '0343-7763677 / 0309-8809054 / 0301-6008625';
      store.address = 'چک نمبر 24 ج ب لاہوریاں (Chak No. 24 JB Lahorian)';
      store.receiptHeader = 'میزان سویٹس اینڈ بیکرز\nMEZAAN SWEETS & BAKERS\nتازہ اور معیاری مٹھائیوں کا مرکز\nچک نمبر 24 ج ب لاہوریاں\nچوہدری تبسم: 0343-7763677\nچوہدری عبدالرؤف: 0309-8809054\nچوہدری محسن: 0301-6008625';
      store.receiptFooter = 'ذائقہ ہمارا، پہچان آپ کی\nشادی بیاہ، سالگرہ اور دیگر تقریبات کیلئے مال آرڈر پر بھی تیار کیا جاتا ہے\nThank You For Visiting!';
      store.updatedAtUtc = new Date().toISOString();
      await repo.save(store);
    }

    return {
      id: store.id,
      code: store.code,
      name: store.name,
      timezone: store.timezone,
      currencyCode: store.currencyCode,
      taxNumber: store.taxNumber,
      address: store.address,
      phone: store.phone,
      receiptHeader: store.receiptHeader,
      receiptFooter: store.receiptFooter,
      isActive: store.isActive,
      createdAtUtc: store.createdAtUtc,
      updatedAtUtc: store.updatedAtUtc,
    };
  }

  public async getActiveInstallation(): Promise<Installation | null> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(InstallationEntity);
    const install = await repo.findOne({
      order: { createdAtUtc: 'DESC' },
      where: {},
    });
    if (!install) return null;

    return {
      id: install.id,
      deviceId: install.deviceId,
      storeId: install.storeId,
      appVersion: install.appVersion,
      installState: install.installState as 'pending_onboarding' | 'active' | 'suspended',
      registeredAtUtc: install.registeredAtUtc,
      createdAtUtc: install.createdAtUtc,
      updatedAtUtc: install.updatedAtUtc,
    };
  }

  public async getRegisters(storeId: number): Promise<Register[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(RegisterEntity);
    const records = await repo.find({ where: { storeId, isActive: true } });

    return records.map((r) => ({
      id: r.id,
      storeId: r.storeId,
      code: r.code,
      name: r.name,
      isActive: r.isActive,
      createdAtUtc: r.createdAtUtc,
      updatedAtUtc: r.updatedAtUtc,
    }));
  }

  public async getSettings(storeId?: number): Promise<Setting[]> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(SettingEntity);
    let records = storeId
      ? await repo.find({ where: [{ storeId }, { scope: 'system' }] })
      : await repo.find({ where: { scope: 'system' } });

    // Seed default allow_negative_stock = 'false' if not present
    const hasNegativeStockSetting = records.some((s) => s.key === 'allow_negative_stock');
    if (!hasNegativeStockSetting) {
      const now = new Date().toISOString();
      const defaultNegativeStock = repo.create({
        key: 'allow_negative_stock',
        value: 'false',
        scope: 'store',
        storeId: storeId ?? null,
        description: 'Whether POS sales are permitted to drive inventory balance below zero.',
        version: 1,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await repo.save(defaultNegativeStock);
      records.push(defaultNegativeStock);
    }

    return records.map((s) => ({
      id: s.id,
      storeId: s.storeId,
      key: s.key,
      value: s.value,
      scope: s.scope as 'system' | 'store' | 'register' | 'device',
      description: s.description,
      updatedBy: s.updatedBy,
      version: s.version,
      createdAtUtc: s.createdAtUtc,
      updatedAtUtc: s.updatedAtUtc,
    }));
  }

  public async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(SettingEntity);
    const setting = await repo.findOne({ where: { key } });
    return setting ? setting.value : defaultValue;
  }

  public async setSetting(
    key: string,
    value: string,
    options?: { storeId?: number; scope?: string; description?: string; actorId?: number },
  ): Promise<Setting> {
    const ds = this.databaseService.getDataSource();
    const repo = ds.getRepository(SettingEntity);
    const now = new Date().toISOString();

    let setting = await repo.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      setting.version = (setting.version || 0) + 1;
      setting.updatedAtUtc = now;
      if (options?.description) setting.description = options.description;
      if (options?.actorId) setting.updatedBy = String(options.actorId);
      await repo.save(setting);
    } else {
      setting = repo.create({
        key,
        value,
        scope: options?.scope || 'store',
        storeId: options?.storeId ?? null,
        description: options?.description ?? null,
        updatedBy: options?.actorId ? String(options.actorId) : null,
        version: 1,
        createdAtUtc: now,
        updatedAtUtc: now,
      });
      await repo.save(setting);
    }

    return {
      id: setting.id,
      storeId: setting.storeId,
      key: setting.key,
      value: setting.value,
      scope: setting.scope as 'system' | 'store' | 'register' | 'device',
      description: setting.description,
      updatedBy: setting.updatedBy,
      version: setting.version,
      createdAtUtc: setting.createdAtUtc,
      updatedAtUtc: setting.updatedAtUtc,
    };
  }
}
