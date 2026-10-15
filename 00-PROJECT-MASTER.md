# Bakery Store Desktop Application — Project Master

**Document status:** Baseline specification  
**Product phase:** V1 planning  
**Primary platform:** Windows desktop  
**Delivery model:** One-time installation with local operation, local backup, and optional managed cloud backup/support

## 1. Product outcome

Deliver a fast, reliable bakery POS and management application that continues core operations without internet. One installer must provide product setup, barcode purchasing and sales, inventory control, production/recipe tracking, custom orders, users and permissions, reports, hardware support, backups, restore, diagnostics, and safe upgrades.

The release target is not an impossible promise of zero defects. It is:

> Every agreed critical workflow is tested and accepted; there are no known release-blocking defects; financial and stock results reconcile; backup and restore are verified; recovery steps are documented.

## 2. Locked technical direction

| Concern                     | Decision                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Desktop shell and installer | Electron                                                                                                |
| User interface              | React + TypeScript                                                                                      |
| Business application        | NestJS application context inside Electron main                                                         |
| Desktop boundary            | Typed IPC through a narrow preload bridge                                                               |
| Local persistence           | SQLite + `better-sqlite3` + TypeORM                                                                     |
| Schema changes              | Reviewed, ordered TypeORM migrations; no production synchronize                                         |
| Shared FE/BE shapes         | Runtime-validated contracts in `packages/contracts`                                                     |
| Operating mode              | Local-first and offline-capable                                                                         |
| Cloud role                  | Encrypted backup, installation registration, optional service/license health; never required for a sale |
| Repository                  | pnpm workspace monorepo                                                                                 |

Next.js, a browser-hosted POS, and a mandatory local HTTP server are not part of V1.

## 3. V1 users

- Cashier
- Purchase user
- Baker/production user
- Store manager
- Accountant/report viewer
- Client admin
- Client super admin/owner
- Provider support administrator, restricted to service metadata unless the client explicitly grants support access

## 4. V1 business capabilities

1. Guided onboarding, CSV/XLSX catalog and opening-stock imports, and go-live controls.
2. Catalog, variants, SKUs, multiple barcodes, pricing, tax, categories, units, and labels.
3. Suppliers, purchase orders, goods receiving, lots, expiry dates, costs, and purchase returns/corrections.
4. Stock ledger, locations, counts, adjustments, wastage, low-stock and expiry visibility.
5. Recipes/BOM, unit conversions, production runs, ingredient consumption, finished-goods output, yield, and cost variance.
6. POS scanning/touch search, cart, controlled discount, tax, split payment, receipt, returns/refunds, shift and cash reconciliation.
7. Custom cake/order booking, customer details, deposits, balance due, production/delivery date, status, notes, allergens, and printable order summary.
8. Operational and financial reports that reconcile with source records.
9. Local and encrypted cloud backups, restore, diagnostics, installer, updates, and recovery.

## 5. V1 deployment boundary

The baseline is one independent Windows installation using one local SQLite database. It may contain many application users and roles, but it is not a shared multi-PC database.

If a bakery needs several PCs to see and write the same live data, that is a separate LAN/server or cloud-sync architecture and must be designed before implementation. Do not place a SQLite file on a network share.

## 6. Commercial boundary

For a one-time-sale client, support a perpetual license for the agreed installation. Cloud backup, support, upgrades, additional devices, and new modules may be recurring services. Expiry of an optional service must never make the client unable to access, export, or back up their data.

## 7. System invariants

- A sale, purchase receipt, refund, production completion, wastage entry, and shift close are atomic.
- Money uses integer minor units; quantity uses defined decimal precision and canonical base units.
- Stock is derived from ledger movements, not untracked quantity edits.
- Posted documents remain auditable and are corrected by linked reversal/correction records.
- Every report is traceable to posted source records.
- Offline operation is normal, not an error condition.
- Cloud backup failure creates a visible health alert but does not block POS.
- A release does not migrate client data until a verified safety backup exists.

## 8. Documentation map

| File                           | Purpose                                            |
| ------------------------------ | -------------------------------------------------- |
| `01-SCOPE-REQUIREMENTS.md`     | Functional and non-functional scope                |
| `02-ARCHITECTURE.md`           | Runtime architecture and boundaries                |
| `03-DATABASE-FIRST.md`         | Database design principles and sequence            |
| `04-DATABASE-SCHEMA.md`        | Canonical data model                               |
| `05-MIGRATION-PLAN.md`         | Schema lifecycle and upgrade safety                |
| `06-BACKEND-NESTJS.md`         | Modules and service rules                          |
| `07-FRONTEND-REACT.md`         | Desktop UX architecture                            |
| `08-CONTRACTS-IPC.md`          | Shared schemas and secure IPC                      |
| `09-BARCODE-ARCHITECTURE.md`   | Scanner and barcode resolution                     |
| `10-PURCHASING.md`             | Purchasing and receiving workflow                  |
| `11-POS-SALES.md`              | Sales, payments, refunds, and shifts               |
| `12-INVENTORY-LEDGER.md`       | Stock authority and reconciliation                 |
| `13-PRODUCTION-RECIPES.md`     | BOM and production                                 |
| `14-CUSTOM-ORDERS.md`          | Advance/custom order lifecycle                     |
| `15-RBAC-SECURITY.md`          | Roles, permissions, security, and audit            |
| `16-ONBOARDING-IMPORTS.md`     | Setup wizard and controlled imports                |
| `17-BACKUP-RESTORE-SERVICE.md` | Local/cloud backup, restore, and service control   |
| `18-HARDWARE.md`               | Scanner, printer, drawer, labeler, and scale       |
| `19-TESTING-UAT.md`            | Automated, failure, hardware, and acceptance tests |
| `20-IMPLEMENTATION-ORDER.md`   | Vertical slices and release gates                  |
| `21-INSTALLATION-UPDATES.md`   | Packaging, deployment, diagnostics, and upgrades   |
| `../AGENTS.md`                 | Mandatory coding-agent rules                       |

## 9. Definition of done

V1 is deliverable only when all release gates in `19-TESTING-UAT.md` and `20-IMPLEMENTATION-ORDER.md` pass, the exact target hardware has been tested, a full bakery business day has been simulated, both local and cloud restore have been proven, and the client signs the UAT record.
