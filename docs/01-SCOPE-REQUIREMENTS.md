# Scope and Requirements

## 1. In scope

### Store and administration

- Bakery/branch settings, currency, timezone, tax, receipt details, business day rules.
- Users, PIN/password authentication, roles, permissions, active/inactive status.
- One local installation and device identity.
- Health/diagnostics, export, backup, restore, and audit visibility.

### Catalog

- Categories, products, sellable variants, ingredients, packaging items, units, conversions, tax class, prices, costs, shelf life, active state.
- Unique SKU and one or more unique barcodes per resolvable item/variant.
- Supplier barcodes, bakery-generated barcodes, weighted/price-embedded barcode rules when enabled.
- Manual entry and validated CSV/XLSX import.

### Purchasing and inventory

- Supplier records, purchase orders, partial receiving, goods receipts, lot/expiry capture, landed unit cost where required.
- Opening stock, purchase receipts/returns, production input/output, sales/refunds, wastage, counts, adjustments, and transfers represented in the stock ledger.
- Reorder and expiry warnings; on-hand and available stock.

### Production

- Versioned recipes/BOM, ingredients, quantities, units, expected yield, standard cost.
- Planned and completed production runs, actual consumption/output, wastage, variance, batch/lot traceability.

### POS, money, and shifts

- Barcode scan, touch/search selection, quantity, line/order discounts, tax, notes, hold/resume cart.
- Cash, card, and configured payment methods; split payment; change calculation.
- Receipt printing/reprint, manager-controlled void/refund, shift opening/closing, cash movements and variance.
- Training/test transaction mode excluded from live reports.

### Custom orders

- Customer, event/delivery/pickup date, design notes, product/specification, allergens, price, deposit, remaining balance, status and printable order sheet.

### Reports

- Sales, tax, discounts, refunds, payment methods, shift/cash, purchases, supplier, inventory valuation/movement, wastage, production/yield/cost, expiry/reorder, custom order deposits/balances.
- CSV export for tabular reports and PDF/print for client-facing summaries where appropriate.

## 2. Out of scope for baseline V1

- Shared live multi-terminal database, cross-branch synchronization, cloud-first POS, mobile apps, web customer ordering, marketplace, payroll, general ledger, online payment gateway, e-commerce, delivery fleet routing, and multi-company consolidation.
- These are not “small additions.” Each needs a separate scope and architecture decision.

## 3. Functional requirements

Requirements use `FR-<AREA>-NNN` IDs so tests and change requests can reference them.

| ID          | Requirement                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-001 | The first setup creates a client super admin; later users receive roles/permissions.                                                |
| FR-CAT-001  | Each active sellable variant has a unique SKU and may have multiple unique barcodes.                                                |
| FR-PUR-001  | Posting a goods receipt atomically creates receipt lines, lots where applicable, stock movements, cost evidence, and audit entries. |
| FR-INV-001  | Normal operations cannot directly overwrite on-hand stock.                                                                          |
| FR-PRD-001  | Completing production atomically records ingredient outputs/consumption and finished-goods output.                                  |
| FR-POS-001  | A cashier can complete a sale while fully offline.                                                                                  |
| FR-POS-002  | A completed sale atomically records sale, lines, payments, stock movements, cash effects, and audit evidence.                       |
| FR-POS-003  | Scanner failure does not prevent manual product search/touch sale.                                                                  |
| FR-REF-001  | Refunds reference original lines/payments and create reversal movements; posted sales are not edited.                               |
| FR-SHF-001  | Cash sales require an open shift unless a documented business configuration says otherwise.                                         |
| FR-ORD-001  | Deposits and final payments remain linked to the custom order and payment records.                                                  |
| FR-BKP-001  | The app automatically creates local backups and queues encrypted cloud copies when configured.                                      |
| FR-BKP-002  | Restore is guided, authorized, audited, and followed by integrity/schema checks.                                                    |
| FR-UPD-001  | Every production upgrade makes a verified pre-migration backup before changing the schema.                                          |
| FR-IMP-001  | Imports validate and preview all rows before committing anything.                                                                   |
| FR-IMP-002  | Confirmed opening stock creates an immutable opening-stock session and ledger movements.                                            |

## 4. Non-functional requirements

| ID           | Requirement                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-OFF-001  | Core operational workflows work without internet.                                                                                                          |
| NFR-PERF-001 | On target hardware, ordinary barcode-to-cart feedback should feel immediate; performance budgets are measured and agreed during hardware baseline testing. |
| NFR-REL-001  | Power loss or forced termination cannot create a half-posted transaction.                                                                                  |
| NFR-SEC-001  | Renderer is isolated from privileged APIs and all IPC payloads are runtime-validated.                                                                      |
| NFR-DAT-001  | Database foreign keys and integrity checks are enabled.                                                                                                    |
| NFR-AUD-001  | Sensitive changes record actor, time, device, action, target, reason, and before/after data where appropriate.                                             |
| NFR-BKP-001  | Backup retention, encryption, checksums, retry, and restore drills are supported.                                                                          |
| NFR-INS-001  | A clean supported Windows machine requires no separate Node.js, database server, or developer-tool installation.                                           |
| NFR-UPD-001  | Failed migration prevents normal startup and presents a recovery path.                                                                                     |
| NFR-USE-001  | POS supports keyboard, scanner, mouse, and touch-friendly operation.                                                                                       |

## 5. Assumptions to confirm during client discovery

- Exact Windows versions and PC specifications.
- Single machine versus shared multi-terminal operation.
- Currency, tax/VAT rules, invoice/receipt legal fields, rounding, and fiscal-device requirements.
- Exact printer/scanner/cash-drawer/scale/label-printer models and connection types.
- Product count, barcode types, weighted products, units, recipes, current opening stock data, and import quality.
- Refund, discount, credit/khata, negative-stock, expiry, and manager-approval policies.
- Cloud-backup ownership, region, retention, support terms, and internet reliability.

No tax, accounting, or fiscal rule should be invented by developers. Obtain written client decisions.
