import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  bootstrapBackend,
  CatalogService,
  StoreSettingsService,
  UsersService,
  ExpensesService,
  SuppliersService,
  CustomersService,
  InventoryService,
  UnitsService,
  RecipesService,
} from '../apps/backend/dist/index.js';
import {
  StockLocationEntity,
  RegisterEntity,
  UnitConversionEntity,
  ProductVariantEntity,
  ItemEntity,
  OpeningStockSessionEntity,
  StockMovementEntity,
  UserEntity,
  CustomerEntity,
} from '../packages/database/dist/index.js';

// ==========================================
// 1. DATA DEFINITIONS
// ==========================================

const SEED_LOCATIONS = [
  { code: 'MAIN_FLOOR', name: 'Main Sales Floor & POS Counter', locationType: 'sales_floor' },
  { code: 'KITCHEN', name: 'Bakery Kitchen & Production Floor', locationType: 'kitchen' },
  { code: 'WAREHOUSE', name: 'Raw Ingredients & Cold Storage Room', locationType: 'warehouse' },
];

const SEED_UNITS = [
  { code: 'pcs', name: 'Pieces', dimension: 'COUNT', precision: 0, isBase: true },
  { code: 'dozen', name: 'Dozen (12 pcs)', dimension: 'COUNT', precision: 0, isBase: false },
  { code: 'g', name: 'Grams', dimension: 'MASS', precision: 0, isBase: false },
  { code: 'kg', name: 'Kilograms', dimension: 'MASS', precision: 3, isBase: true },
  { code: 'ml', name: 'Milliliters', dimension: 'VOLUME', precision: 0, isBase: false },
  { code: 'liter', name: 'Liters', dimension: 'VOLUME', precision: 3, isBase: true },
  { code: 'pack', name: 'Pack', dimension: 'COUNT', precision: 0, isBase: false },
];

const SEED_CONVERSIONS = [
  { fromUnitCode: 'dozen', toUnitCode: 'pcs', multiplier: 12, dimension: 'COUNT' },
  { fromUnitCode: 'kg', toUnitCode: 'g', multiplier: 1000, dimension: 'MASS' },
  { fromUnitCode: 'g', toUnitCode: 'kg', multiplier: 0.001, dimension: 'MASS' },
  { fromUnitCode: 'liter', toUnitCode: 'ml', multiplier: 1000, dimension: 'VOLUME' },
  { fromUnitCode: 'ml', toUnitCode: 'liter', multiplier: 0.001, dimension: 'VOLUME' },
];

const SEED_USERS = [
  {
    username: 'admin',
    displayName: 'Store Administrator',
    role: 'admin',
    pin: '1234',
    password: 'admin123',
    permissions: ['*'],
  },
  {
    username: 'manager1',
    displayName: 'Tariq Mehmood (Store Manager)',
    role: 'manager',
    pin: '2222',
    password: 'manager123',
    permissions: ['pos', 'inventory', 'products', 'categories', 'purchasing', 'production', 'custom-orders', 'scanner', 'reports'],
  },
  {
    username: 'cashier1',
    displayName: 'Fatima Noor (Senior Cashier)',
    role: 'cashier',
    pin: '1111',
    password: 'cashier123',
    permissions: ['pos', 'inventory', 'custom-orders', 'scanner'],
  },
  {
    username: 'cashier2',
    displayName: 'Bilal Ahmed (Cashier)',
    role: 'cashier',
    pin: '3333',
    password: 'cashier123',
    permissions: ['pos', 'inventory', 'custom-orders', 'scanner'],
  },
  {
    username: 'baker1',
    displayName: 'Master Chef Rashid (Head Baker)',
    role: 'baker',
    pin: '4444',
    password: 'baker123',
    permissions: ['production', 'inventory'],
  },
];

const SEED_EXPENSE_CATEGORIES = [
  'Utilities (Electricity, Gas, Water)',
  'Ingredients & Perishables',
  'Kitchen Equipment & Maintenance',
  'Packaging & Disposables',
  'Staff Meals & Refreshments',
  'Store Maintenance & Cleaning',
];

const SEED_SUPPLIERS = [
  {
    code: 'SUP-FLOUR',
    name: 'Punjab Flour Mills Ltd',
    contactPerson: 'Haji Munir',
    phone: '0300-1112233',
    email: 'sales@punjabflourmills.com',
    taxNumber: 'PK-NTN-1002341',
    address: 'Plot 45, Industrial Area, Sector I-9, Islamabad',
    paymentTermsDays: 15,
  },
  {
    code: 'SUP-DAIRY',
    name: 'Sunrise Fresh Dairy Farms',
    contactPerson: 'Asif Malik',
    phone: '0321-4445566',
    email: 'orders@sunrisedairy.pk',
    taxNumber: 'PK-NTN-2003452',
    address: 'Chak Shahzad Organic Farm Rd, Islamabad',
    paymentTermsDays: 7,
  },
  {
    code: 'SUP-PACK',
    name: 'EcoPack Packaging Solutions',
    contactPerson: 'Khurram Shah',
    phone: '0333-7778899',
    email: 'info@ecopackpk.com',
    taxNumber: 'PK-NTN-3004563',
    address: 'Small Industrial Estate, Rawalpindi',
    paymentTermsDays: 30,
  },
  {
    code: 'SUP-BEV',
    name: 'Gourmet Coffee & Tea Roasters',
    contactPerson: 'Salman Khan',
    phone: '0345-9990011',
    email: 'supplies@gourmetbeverages.pk',
    taxNumber: 'PK-NTN-4005674',
    address: 'Commercial Market, Satellite Town, Rawalpindi',
    paymentTermsDays: 15,
  },
];

const SEED_CUSTOMERS = [
  {
    code: 'CUST-WALK',
    name: 'Walk-in Retail Customer',
    phone: '0000-0000000',
    email: null,
    address: null,
    notes: 'Default general retail walk-in customer',
  },
  {
    code: 'CUST-REG-01',
    name: 'Ayesha Siddiqui (VIP Member)',
    phone: '0300-5551234',
    email: 'ayesha.siddiqui@gmail.com',
    address: 'House 14, Street 7, Sector F-8/2, Islamabad',
    notes: 'Preferred customer, 5% frequent buyer discount',
  },
  {
    code: 'CUST-CORP-01',
    name: 'Nexus Technologies (Corporate Client)',
    phone: '0322-8884321',
    email: 'admin@nexustech.pk',
    address: 'Level 4, Evacuee Trust Complex, Blue Area, Islamabad',
    notes: 'Weekly corporate orders for office snacks & catering',
  },
];

const SEED_CATEGORIES = [
  { code: 'CAT-BREAD', name: 'Fresh Breads & Loaves', sortOrder: 1 },
  { code: 'CAT-PASTRY', name: 'Croissants & Pastries', sortOrder: 2 },
  { code: 'CAT-CAKE', name: 'Cakes & Cupcakes', sortOrder: 3 },
  { code: 'CAT-SAVORY', name: 'Savory & Hot Snacks', sortOrder: 4 },
  { code: 'CAT-COOKIE', name: 'Biscuits & Cookies', sortOrder: 5 },
  { code: 'CAT-BEV', name: 'Hot & Cold Beverages', sortOrder: 6 },
  { code: 'CAT-RAW', name: 'Baking Ingredients & Raw Materials', sortOrder: 7 },
];

const SEED_PRODUCTS = [
  // --- Finished Bakery Products ---
  {
    categoryCode: 'CAT-PASTRY',
    code: 'PRD-CROISSANT-PLAIN',
    name: 'Butter Croissant',
    sku: 'SKU-CRO-001',
    priceMinorUnits: 15000,
    costMinorUnits: 6500,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000014',
    description: 'Flaky French-style butter croissant baked fresh daily',
    initialStockQty: 30,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-PASTRY',
    code: 'PRD-CROISSANT-CHOC',
    name: 'Chocolate Croissant (Pain au Chocolat)',
    sku: 'SKU-CRO-002',
    priceMinorUnits: 22000,
    costMinorUnits: 9500,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000021',
    description: 'Butter pastry filled with Belgian dark chocolate sticks',
    initialStockQty: 25,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-BREAD',
    code: 'PRD-BAGUETTE',
    name: 'Artisan French Baguette',
    sku: 'SKU-BAG-001',
    priceMinorUnits: 18000,
    costMinorUnits: 7000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000038',
    description: 'Traditional crusty long French bread loaf',
    initialStockQty: 20,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-BREAD',
    code: 'PRD-MILK-BREAD-L',
    name: 'Classic Milk Bread (Large)',
    sku: 'SKU-BRD-001',
    priceMinorUnits: 24000,
    costMinorUnits: 11000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000045',
    description: 'Soft sliced sandwich bread loaf (750g)',
    initialStockQty: 35,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-BREAD',
    code: 'PRD-BROWN-BREAD-L',
    name: '100% Whole Wheat Bread',
    sku: 'SKU-BRD-002',
    priceMinorUnits: 26000,
    costMinorUnits: 12000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000052',
    description: 'Healthy fiber-rich whole wheat sliced loaf',
    initialStockQty: 25,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-CAKE',
    code: 'PRD-CAKE-BF-2LB',
    name: 'Black Forest Cake (2 Lbs)',
    sku: 'SKU-CAK-001',
    priceMinorUnits: 185000,
    costMinorUnits: 75000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000069',
    description: 'Layers of chocolate sponge, whipped cream, and cherries',
    initialStockQty: 8,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-CAKE',
    code: 'PRD-CUPCAKE-RED-VELVET',
    name: 'Red Velvet Cupcake',
    sku: 'SKU-CUP-001',
    priceMinorUnits: 25000,
    costMinorUnits: 10000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000076',
    description: 'Moist red velvet topped with cream cheese frosting',
    initialStockQty: 24,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-SAVORY',
    code: 'PRD-CHICKEN-PATTIES',
    name: 'Flaky Chicken Patties',
    sku: 'SKU-SAV-001',
    priceMinorUnits: 12000,
    costMinorUnits: 5500,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000083',
    description: 'Puff pastry stuffed with seasoned shredded chicken',
    initialStockQty: 40,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-SAVORY',
    code: 'PRD-VEG-SPRING-ROLL',
    name: 'Vegetable Spring Roll',
    sku: 'SKU-SAV-002',
    priceMinorUnits: 9000,
    costMinorUnits: 4000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000090',
    description: 'Crispy fried roll with spiced cabbage, carrots, and peas',
    initialStockQty: 35,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-COOKIE',
    code: 'PRD-CHOC-CHIP-COOKIES',
    name: 'Chocolate Chip Cookies (12 pcs)',
    sku: 'SKU-CKI-001',
    priceMinorUnits: 65000,
    costMinorUnits: 28000,
    currencyCode: 'PKR',
    baseUnitCode: 'dozen',
    barcode: '8901000000106',
    description: 'Dozen pack of chewy cookies with dark chocolate chunks',
    initialStockQty: 15,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-BEV',
    code: 'PRD-CAPPUCCINO',
    name: 'Fresh Espresso Cappuccino',
    sku: 'SKU-BEV-001',
    priceMinorUnits: 35000,
    costMinorUnits: 12000,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000113',
    description: 'Double shot espresso with steamed milk and velvety foam',
    initialStockQty: 50,
    stockLocationCode: 'MAIN_FLOOR',
  },
  {
    categoryCode: 'CAT-BEV',
    code: 'PRD-KARAK-CHAI',
    name: 'Special Doodh Patti / Karak Chai',
    sku: 'SKU-BEV-002',
    priceMinorUnits: 12000,
    costMinorUnits: 4500,
    currencyCode: 'PKR',
    baseUnitCode: 'pcs',
    barcode: '8901000000120',
    description: 'Slow-brewed cardamom milk tea',
    initialStockQty: 60,
    stockLocationCode: 'MAIN_FLOOR',
  },

  // --- Raw Baking Ingredients ---
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-FLOUR-FINE',
    name: 'Fine White Flour (Maida)',
    sku: 'SKU-RAW-001',
    priceMinorUnits: 18000,
    costMinorUnits: 14000,
    currencyCode: 'PKR',
    baseUnitCode: 'kg',
    barcode: '8902000000013',
    description: 'High-gluten unbleached refined white wheat flour for breads & pastries',
    initialStockQty: 100,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-BUTTER-UNSALT',
    name: 'Premium Unsalted Butter (82% Fat)',
    sku: 'SKU-RAW-002',
    priceMinorUnits: 220000,
    costMinorUnits: 180000,
    currencyCode: 'PKR',
    baseUnitCode: 'kg',
    barcode: '8902000000020',
    description: 'Pure dairy butter block for viennoiserie, croissant laminations and cakes',
    initialStockQty: 40,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-SUGAR-WHITE',
    name: 'Granulated White Sugar',
    sku: 'SKU-RAW-003',
    priceMinorUnits: 20000,
    costMinorUnits: 16000,
    currencyCode: 'PKR',
    baseUnitCode: 'kg',
    barcode: '8902000000037',
    description: 'Pure refined cane sugar for baking and sweet doughs',
    initialStockQty: 75,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-MILK-WHOLE',
    name: 'Fresh Whole Milk',
    sku: 'SKU-RAW-004',
    priceMinorUnits: 25000,
    costMinorUnits: 21000,
    currencyCode: 'PKR',
    baseUnitCode: 'liter',
    barcode: '8902000000044',
    description: 'Fresh pasteurized farm whole milk for doughs, coffee and teas',
    initialStockQty: 50,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-EGGS-FARM',
    name: 'Fresh Farm Eggs',
    sku: 'SKU-RAW-005',
    priceMinorUnits: 38000,
    costMinorUnits: 32000,
    currencyCode: 'PKR',
    baseUnitCode: 'dozen',
    barcode: '8902000000051',
    description: 'Grade A fresh large white farm eggs',
    initialStockQty: 30,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-CHOC-BELGIAN',
    name: 'Belgian Dark Chocolate Callets (54%)',
    sku: 'SKU-RAW-006',
    priceMinorUnits: 320000,
    costMinorUnits: 260000,
    currencyCode: 'PKR',
    baseUnitCode: 'kg',
    barcode: '8902000000068',
    description: 'High-grade chocolate callets for chocolate croissants, cookies & cakes',
    initialStockQty: 25,
    stockLocationCode: 'WAREHOUSE',
  },
  {
    categoryCode: 'CAT-RAW',
    code: 'RAW-YEAST-INSTANT',
    name: 'Instant Dry Yeast',
    sku: 'SKU-RAW-007',
    priceMinorUnits: 150000,
    costMinorUnits: 120000,
    currencyCode: 'PKR',
    baseUnitCode: 'kg',
    barcode: '8902000000075',
    description: 'Fast-acting commercial instant yeast for bread & croissant fermentation',
    initialStockQty: 10,
    stockLocationCode: 'WAREHOUSE',
  },
];

// ==========================================
// 2. MAIN SEEDER PIPELINE
// ==========================================

async function seed() {
  console.log('====================================================');
  console.log('  🥐 BAKERY STORE FULL STRUCTURED DATA SEEDER 🥐    ');
  console.log('====================================================\n');

  // Resolve target DB path
  let customDbPath = process.argv[2];
  if (!customDbPath) {
    const appDataRoaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const defaultDesktopDb = path.join(appDataRoaming, '@bakery', 'desktop', 'data', 'bakery.db');
    if (fs.existsSync(defaultDesktopDb)) {
      customDbPath = defaultDesktopDb;
      console.log(`🎯 Targeting active desktop database: ${customDbPath}`);
    }
  } else {
    console.log(`🎯 Targeting specified database: ${customDbPath}`);
  }

  const backend = await bootstrapBackend({
    runMigrations: true,
    ...(customDbPath ? { dbPath: customDbPath } : {}),
  });

  try {
    const ds = backend.dbManager.getDataSource();
    const storeSettingsService = backend.appContext.get(StoreSettingsService);
    const catalogService = backend.appContext.get(CatalogService);
    const usersService = backend.appContext.get(UsersService);
    const expensesService = backend.appContext.get(ExpensesService);
    const suppliersService = backend.appContext.get(SuppliersService);
    const customersService = backend.appContext.get(CustomersService);
    const inventoryService = backend.appContext.get(InventoryService);
    const unitsService = backend.appContext.get(UnitsService);
    const recipesService = backend.appContext.get(RecipesService);

    const locationRepo = ds.getRepository(StockLocationEntity);
    const registerRepo = ds.getRepository(RegisterEntity);
    const unitConversionRepo = ds.getRepository(UnitConversionEntity);
    const userRepo = ds.getRepository(UserEntity);
    const variantRepo = ds.getRepository(ProductVariantEntity);
    const itemRepo = ds.getRepository(ItemEntity);
    const openingSessionRepo = ds.getRepository(OpeningStockSessionEntity);
    const stockMovementRepo = ds.getRepository(StockMovementEntity);
    const customerRepo = ds.getRepository(CustomerEntity);

    // -------------------------------------------------------------
    // STEP 1: Ensure Active Store & POS Register
    // -------------------------------------------------------------
    console.log('\n--- 1. Store & POS Register Setup ---');
    const store = await storeSettingsService.getActiveStore();
    console.log(`🏬 Active Store: "${store.name}" (ID: ${store.id}, Code: ${store.code}, Currency: ${store.currencyCode})`);

    let register = await registerRepo.findOne({ where: { storeId: store.id, code: 'REG-01' } });
    if (!register) {
      register = registerRepo.create({
        storeId: store.id,
        code: 'REG-01',
        name: 'Main POS Counter 1',
        isActive: true,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
      });
      await registerRepo.save(register);
      console.log(`✅ Created Primary POS Register: "${register.name}" (Code: ${register.code})`);
    } else {
      console.log(`⏭️  POS Register "${register.name}" (${register.code}) already exists.`);
    }

    // -------------------------------------------------------------
    // STEP 2: Stock Locations
    // -------------------------------------------------------------
    console.log('\n--- 2. Stock Locations Setup ---');
    const locationMap = new Map();
    for (const loc of SEED_LOCATIONS) {
      let existingLoc = await locationRepo.findOne({ where: { storeId: store.id, code: loc.code } });
      if (!existingLoc) {
        existingLoc = locationRepo.create({
          storeId: store.id,
          code: loc.code,
          name: loc.name,
          locationType: loc.locationType,
          isActive: true,
          createdAtUtc: new Date().toISOString(),
          updatedAtUtc: new Date().toISOString(),
        });
        await locationRepo.save(existingLoc);
        console.log(`✅ Created Location: "${loc.name}" (${loc.code}) [${loc.locationType}]`);
      } else {
        console.log(`⏭️  Location "${loc.name}" (${loc.code}) already exists.`);
      }
      locationMap.set(loc.code, existingLoc.id);
    }

    // -------------------------------------------------------------
    // STEP 3: Units of Measure & Conversions
    // -------------------------------------------------------------
    console.log('\n--- 3. Units of Measure & Conversions ---');
    const existingUnits = await unitsService.getUnits();
    const existingUnitCodes = new Set(existingUnits.map((u) => u.code.toLowerCase()));

    for (const u of SEED_UNITS) {
      if (!existingUnitCodes.has(u.code.toLowerCase())) {
        await unitsService.createUnit(u);
        console.log(`✅ Created Unit: ${u.name} (${u.code}) [${u.dimension}]`);
      } else {
        console.log(`⏭️  Unit "${u.code}" already exists.`);
      }
    }

    for (const conv of SEED_CONVERSIONS) {
      const existingConv = await unitConversionRepo.findOne({
        where: { fromUnitCode: conv.fromUnitCode, toUnitCode: conv.toUnitCode },
      });
      if (!existingConv) {
        await unitConversionRepo.save(
          unitConversionRepo.create({
            fromUnitCode: conv.fromUnitCode,
            toUnitCode: conv.toUnitCode,
            multiplier: conv.multiplier,
            dimension: conv.dimension,
            createdAtUtc: new Date().toISOString(),
          })
        );
        console.log(`✅ Created Conversion: 1 ${conv.fromUnitCode} = ${conv.multiplier} ${conv.toUnitCode}`);
      }
    }

    // -------------------------------------------------------------
    // STEP 4: Staff Users & RBAC Setup
    // -------------------------------------------------------------
    console.log('\n--- 4. Staff Accounts & RBAC Setup ---');
    for (const userDef of SEED_USERS) {
      const existingUser = await userRepo.findOne({
        where: { username: userDef.username.toLowerCase() },
      });

      if (!existingUser) {
        await usersService.createUser({
          storeId: store.id,
          username: userDef.username,
          displayName: userDef.displayName,
          role: userDef.role,
          pin: userDef.pin,
          password: userDef.password,
          permissions: userDef.permissions,
        });
        console.log(`✅ Created User: [${userDef.role.toUpperCase()}] ${userDef.displayName} (@${userDef.username} | PIN: ${userDef.pin})`);
      } else {
        // Ensure PIN and password hash are active and in sync
        const pinSalt = crypto.randomBytes(16).toString('hex');
        const pinHash = crypto.scryptSync(userDef.pin, pinSalt, 64).toString('hex');
        const passSalt = crypto.randomBytes(16).toString('hex');
        const passHash = crypto.scryptSync(userDef.password, passSalt, 64).toString('hex');

        existingUser.displayName = userDef.displayName;
        existingUser.role = userDef.role;
        existingUser.pinHash = pinHash;
        existingUser.pinSalt = pinSalt;
        existingUser.passwordHash = passHash;
        existingUser.passwordSalt = passSalt;
        existingUser.permissionsJson = JSON.stringify(userDef.permissions);
        existingUser.updatedAtUtc = new Date().toISOString();
        await userRepo.save(existingUser);
        console.log(`🔄 Updated User: [${userDef.role.toUpperCase()}] ${userDef.displayName} (@${userDef.username} | PIN: ${userDef.pin})`);
      }
    }

    // -------------------------------------------------------------
    // STEP 5: Expense Categories Setup
    // -------------------------------------------------------------
    console.log('\n--- 5. Expense Categories Setup ---');
    const existingExpenseCats = await expensesService.listCategories();
    const expenseCatNames = new Set(existingExpenseCats.map((c) => c.name.toLowerCase()));

    for (const catName of SEED_EXPENSE_CATEGORIES) {
      if (!expenseCatNames.has(catName.toLowerCase())) {
        await expensesService.createCategory({ name: catName });
        console.log(`✅ Created Expense Category: "${catName}"`);
      } else {
        console.log(`⏭️  Expense Category "${catName}" already exists.`);
      }
    }

    // -------------------------------------------------------------
    // STEP 6: Suppliers Setup
    // -------------------------------------------------------------
    console.log('\n--- 6. Raw Material & Ingredients Suppliers ---');
    const existingSuppliers = await suppliersService.getSuppliers(store.id);
    const existingSupplierCodes = new Set(existingSuppliers.map((s) => s.code.toUpperCase()));

    for (const sup of SEED_SUPPLIERS) {
      if (!existingSupplierCodes.has(sup.code.toUpperCase())) {
        await suppliersService.createSupplier({
          storeId: store.id,
          code: sup.code,
          name: sup.name,
          contactPerson: sup.contactPerson,
          phone: sup.phone,
          email: sup.email,
          taxNumber: sup.taxNumber,
          address: sup.address,
          paymentTermsDays: sup.paymentTermsDays,
        });
        console.log(`✅ Created Supplier: "${sup.name}" (${sup.code} | Contact: ${sup.contactPerson} | Phone: ${sup.phone})`);
      } else {
        console.log(`⏭️  Supplier "${sup.name}" (${sup.code}) already exists.`);
      }
    }

    // -------------------------------------------------------------
    // STEP 7: Customers Setup
    // -------------------------------------------------------------
    console.log('\n--- 7. Retail & VIP Customers Setup ---');
    const existingCustomers = await customerRepo.find({ where: { storeId: store.id } });
    const existingCustomerCodes = new Set(existingCustomers.map((c) => c.code.toUpperCase()));

    for (const cust of SEED_CUSTOMERS) {
      if (!existingCustomerCodes.has(cust.code.toUpperCase())) {
        await customersService.createCustomer({
          storeId: store.id,
          code: cust.code,
          name: cust.name,
          phone: cust.phone,
          email: cust.email,
          address: cust.address,
          notes: cust.notes,
        });
        console.log(`✅ Created Customer: "${cust.name}" (${cust.code})`);
      } else {
        console.log(`⏭️  Customer "${cust.name}" (${cust.code}) already exists.`);
      }
    }

    // -------------------------------------------------------------
    // STEP 8: Product Catalog (Categories, Products, Barcodes, Items)
    // -------------------------------------------------------------
    console.log('\n--- 8. Product Categories & Catalog ---');
    const existingCategories = await catalogService.getCategories();
    const categoryMap = new Map(existingCategories.map((c) => [c.code, c.id]));

    for (const cat of SEED_CATEGORIES) {
      if (!categoryMap.has(cat.code)) {
        const created = await catalogService.createCategory(cat);
        categoryMap.set(created.code, created.id);
        console.log(`✅ Created Category: "${created.name}" (${created.code})`);
      } else {
        console.log(`⏭️  Category "${cat.name}" (${cat.code}) already exists.`);
      }
    }

    const existingProducts = await catalogService.getProducts();
    const productCodeMap = new Map(existingProducts.map((p) => [p.code, p]));

    for (const prod of SEED_PRODUCTS) {
      if (!productCodeMap.has(prod.code)) {
        const categoryId = categoryMap.get(prod.categoryCode);
        const created = await catalogService.createProduct({
          code: prod.code,
          name: prod.name,
          sku: prod.sku,
          categoryId: categoryId ?? null,
          priceMinorUnits: prod.priceMinorUnits,
          costMinorUnits: prod.costMinorUnits ?? 0,
          currencyCode: prod.currencyCode,
          baseUnitCode: prod.baseUnitCode,
          barcode: prod.barcode,
          description: prod.description,
        });
        productCodeMap.set(created.code, created);
        const priceFmt = (created.priceMinorUnits / 100).toFixed(2);
        const costFmt = ((prod.costMinorUnits ?? 0) / 100).toFixed(2);
        console.log(`✅ Created Product: "${created.name}" | Barcode: ${created.barcode} | Buy: Rs. ${costFmt} | Sell: Rs. ${priceFmt} / ${created.baseUnitCode}`);
      } else {
        // Ensure existing variant cost and sell prices are synchronized
        const existingVariant = await variantRepo.findOne({ where: { sku: prod.sku } });
        if (existingVariant) {
          let modified = false;
          if (existingVariant.costMinorUnits !== (prod.costMinorUnits ?? 0)) {
            existingVariant.costMinorUnits = prod.costMinorUnits ?? 0;
            modified = true;
          }
          if (existingVariant.priceMinorUnits !== prod.priceMinorUnits) {
            existingVariant.priceMinorUnits = prod.priceMinorUnits;
            modified = true;
          }
          if (modified) {
            existingVariant.updatedAtUtc = new Date().toISOString();
            await variantRepo.save(existingVariant);
            const costFmt = (existingVariant.costMinorUnits / 100).toFixed(2);
            const priceFmt = (existingVariant.priceMinorUnits / 100).toFixed(2);
            console.log(`🔄 Updated Prices for "${prod.name}": Buy Cost: Rs. ${costFmt} | Sell Price: Rs. ${priceFmt}`);
          } else {
            console.log(`⏭️  Product "${prod.name}" (${prod.code}) already has current prices.`);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 9: Initial Opening Stock Setup (Immutable Ledger)
    // -------------------------------------------------------------
    console.log('\n--- 9. Opening Stock & Ledger Setup ---');
    const openingSession = await openingSessionRepo.findOne({ where: { storeId: store.id } });
    const isSessionConfirmed = openingSession && openingSession.status === 'confirmed';

    const defaultLocationId = locationMap.get('MAIN_FLOOR') || 1;

    // Fetch all item entities linked to our products
    const items = await itemRepo.find();
    const itemMap = new Map(items.map((it) => [it.code, it]));

    if (!isSessionConfirmed) {
      console.log('📦 Initializing official OPENING_STOCK session...');
      const openingRows = [];

      for (const prod of SEED_PRODUCTS) {
        const itemCode = `ITEM-${prod.code}`;
        const item = itemMap.get(itemCode);
        if (!item) continue;

        const targetLocationId = locationMap.get(prod.stockLocationCode) || defaultLocationId;
        openingRows.push({
          itemId: item.id,
          locationId: targetLocationId,
          quantity: prod.initialStockQty,
          costPerUnitMinorUnits: prod.costMinorUnits || 0,
        });
      }

      if (openingRows.length > 0) {
        const confirmed = await inventoryService.confirmOpeningStock({
          storeId: store.id,
          notes: 'Initial Store Opening Stock & Raw Materials Onboarding',
          confirmedBy: 'admin',
          rows: openingRows,
        });
        console.log(`🎉 Confirmed Opening Stock Session ID: ${confirmed.id} with ${openingRows.length} inventory lines!`);
      }
    } else {
      console.log('🔒 Opening Stock session is already confirmed & locked.');
      console.log('🔍 Checking if any new products require stock count true-up adjustments...');

      let adjustmentsCount = 0;
      for (const prod of SEED_PRODUCTS) {
        const itemCode = `ITEM-${prod.code}`;
        const item = itemMap.get(itemCode);
        if (!item) continue;

        // Check current ledger balance for this item
        const movements = await stockMovementRepo.find({ where: { itemId: item.id } });
        const currentBalance = movements.reduce((acc, m) => acc + m.signedBaseQuantity, 0);

        if (currentBalance === 0 && prod.initialStockQty > 0) {
          const targetLocId = locationMap.get(prod.stockLocationCode) || defaultLocationId;
          const now = new Date().toISOString();
          const movement = stockMovementRepo.create({
            storeId: store.id,
            itemId: item.id,
            locationId: targetLocId,
            signedBaseQuantity: prod.initialStockQty,
            movementType: 'ADJUSTMENT',
            sourceType: 'COUNT_ADJUSTMENT',
            sourceId: 'INITIAL_SEED_TRUEUP',
            sourceLineId: null,
            costPerUnitMinorUnits: prod.costMinorUnits || 0,
            actorId: 'admin',
            idempotencyKey: `SEED-ADJUST-${item.id}-${Date.now()}`,
            createdAtUtc: now,
          });
          await stockMovementRepo.save(movement);
          adjustmentsCount++;
          console.log(`   ➕ Adjusted stock for "${prod.name}": +${prod.initialStockQty} ${prod.baseUnitCode}`);
        }
      }
      if (adjustmentsCount === 0) {
        console.log('   All items already have established stock on hand.');
      }
    }

    // -------------------------------------------------------------
    // STEP 10: Production Recipes Setup
    // -------------------------------------------------------------
    console.log('\n--- 10. Production Recipes Setup ---');
    const existingRecipes = await recipesService.getRecipes(store.id);
    const existingRecipeCodes = new Set(existingRecipes.map((r) => r.code));

    // Lookup variants for recipe links
    const allVariants = await variantRepo.find();
    const variantSkuMap = new Map(allVariants.map((v) => [v.sku, v]));

    const SEED_RECIPES = [
      {
        code: 'RCP-CROISSANT-01',
        name: 'French Butter Croissant Batch',
        description: 'Standard laminated dough yielding 20 crispy butter croissants',
        outputSku: 'SKU-CRO-001',
        expectedYieldQuantity: 20,
        outputUnitCode: 'pcs',
        items: [
          { inputSku: 'SKU-RAW-001', quantity: 1, unitCode: 'kg', wastagePercent: 2, notes: 'Fine flour' },
          { inputSku: 'SKU-RAW-002', quantity: 1, unitCode: 'kg', wastagePercent: 0, notes: 'Lamination butter' },
          { inputSku: 'SKU-RAW-003', quantity: 1, unitCode: 'kg', wastagePercent: 1, notes: 'Sugar' },
          { inputSku: 'SKU-RAW-004', quantity: 1, unitCode: 'liter', wastagePercent: 1, notes: 'Whole milk' },
          { inputSku: 'SKU-RAW-007', quantity: 1, unitCode: 'kg', wastagePercent: 0, notes: 'Instant yeast' },
        ],
      },
      {
        code: 'RCP-BREAD-01',
        name: 'Artisan Baguette Production Batch',
        description: 'Crispy French baguette master recipe yielding 15 loaves',
        outputSku: 'SKU-BAG-001',
        expectedYieldQuantity: 15,
        outputUnitCode: 'pcs',
        items: [
          { inputSku: 'SKU-RAW-001', quantity: 3, unitCode: 'kg', wastagePercent: 1, notes: 'Flour' },
          { inputSku: 'SKU-RAW-007', quantity: 1, unitCode: 'kg', wastagePercent: 0, notes: 'Yeast' },
        ],
      },
      {
        code: 'RCP-CAKE-BF-01',
        name: 'Black Forest Cake 2lb Batch',
        description: 'Rich chocolate sponge with cherries and Belgian chocolate',
        outputSku: 'SKU-CAK-001',
        expectedYieldQuantity: 2,
        outputUnitCode: 'pcs',
        items: [
          { inputSku: 'SKU-RAW-001', quantity: 1, unitCode: 'kg', wastagePercent: 2, notes: 'Flour' },
          { inputSku: 'SKU-RAW-003', quantity: 1, unitCode: 'kg', wastagePercent: 1, notes: 'Sugar' },
          { inputSku: 'SKU-RAW-005', quantity: 1, unitCode: 'dozen', wastagePercent: 0, notes: 'Farm eggs' },
          { inputSku: 'SKU-RAW-006', quantity: 1, unitCode: 'kg', wastagePercent: 2, notes: 'Belgian chocolate' },
          { inputSku: 'SKU-RAW-002', quantity: 1, unitCode: 'kg', wastagePercent: 1, notes: 'Butter' },
        ],
      },
    ];

    for (const rDef of SEED_RECIPES) {
      if (existingRecipeCodes.has(rDef.code)) {
        console.log(`⏭️  Recipe "${rDef.name}" (${rDef.code}) already exists.`);
        continue;
      }

      const outVariant = variantSkuMap.get(rDef.outputSku);
      if (!outVariant) {
        console.log(`⚠️  Cannot create recipe "${rDef.name}": Output variant SKU ${rDef.outputSku} not found.`);
        continue;
      }

      const recipeItems = [];
      for (const itemDef of rDef.items) {
        const inVariant = variantSkuMap.get(itemDef.inputSku);
        if (inVariant) {
          recipeItems.push({
            inputVariantId: inVariant.id,
            quantity: itemDef.quantity,
            unitCode: itemDef.unitCode,
            wastagePercent: itemDef.wastagePercent,
            notes: itemDef.notes,
          });
        }
      }

      if (recipeItems.length > 0) {
        const createdRecipe = await recipesService.createRecipe(store.id, {
          code: rDef.code,
          name: rDef.name,
          description: rDef.description,
          outputVariantId: outVariant.id,
          expectedYieldQuantity: rDef.expectedYieldQuantity,
          outputUnitCode: rDef.outputUnitCode,
          items: recipeItems,
        });
        console.log(`✅ Created Recipe: "${createdRecipe.name}" (${createdRecipe.code} -> Yield: ${createdRecipe.expectedYieldQuantity} ${createdRecipe.outputUnitCode})`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 FULL STRUCTURED SEEDING COMPLETED SUCCESSFULLY! 🎉');
    console.log('====================================================\n');

    await backend.dbManager.close();
    await backend.appContext.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error during structured seeding:', err);
    process.exit(1);
  }
}

seed();
