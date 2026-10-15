# Implementation Order and Gates

## 1. Delivery method

Use controlled vertical slices. Database/migration and contracts are frozen for a slice, then backend and frontend proceed in parallel, followed by integrated acceptance. Do not build all backend modules and postpone integration to the end.

## 2. Phase 0 — Client discovery and acceptance baseline

Deliverables:

- Signed workflow/scope, out-of-scope, tax/rounding/costing rules, roles, hardware matrix, supported Windows baseline, backup/service terms, UAT plan.
- Representative product, purchase, recipe, stock, sale, refund, shift, and report examples.

**Gate 0:** No unresolved decision can materially change money, tax, inventory, deployment topology, or hardware architecture.

## 3. Phase 1 — Engineering foundation

- pnpm workspace, Electron, React, NestJS context, TypeORM/SQLite, secure preload/IPC.
- Config, logging, error/correlation model, database paths, migrations, test harness, packaging skeleton.
- Store/installation/settings, users/RBAC, audit, diagnostics baseline.

**Gate 1:** Packaged clean install starts, renderer isolation tests pass, migration path works, login/permission check works, and application can safely close/reopen a test database.

## 4. Phase 2 — Catalog, units, barcodes, opening stock

- Items/products/variants, units/conversions, categories/tax/prices, barcode resolver and labels.
- Catalog and opening-stock imports with preview/validation.
- Stock ledger and balance reconciliation foundation.

**Gate 2:** Real scanner resolves products; imports are atomic/idempotent; opening stock produces correct base-unit movements; ledger reconciles; session locks after go-live.

## 5. Phase 3 — First sellable vertical slice

- Shift open, cart, scan/search, pricing/tax/discount, cash payment, atomic sale, stock deduction, receipt/drawer, shift close and core sales report.

**Gate 3:** Product-to-receipt workflow passes offline on packaged app and real hardware; duplicate/power-loss tests pass; money, stock and cash reconcile.

## 6. Phase 4 — Purchasing vertical slice

- Suppliers, POs, full/partial goods receiving, lots/expiry, purchase return/correction, purchase/inventory reports.

**Gate 4:** Barcode receiving and unit conversion increase exact stock; partials and returns reconcile; retry/power-loss creates no duplicate/partial effects.

## 7. Phase 5 — Production vertical slice

- Recipe versions, costing, run plan/completion, consumption/output lots, yield and wastage.

**Gate 5:** Scaled recipe, substitution policy, variance, cost, stock and reversal cases pass and reconcile.

## 8. Phase 6 — Full POS and custom orders

- Non-cash/split payments, refund/void, held cart, customers.
- Custom order/deposit/calendar/Kanban/fulfillment/cancellation.

**Gate 6:** Payment/refund/shift reports reconcile; order deposit/balance is not double-counted; transitions and approvals are enforced.

## 9. Phase 7 — Backup, restore, installer, upgrades, reports

- Scheduled local/cloud backup, retention, health, restore and recovery.
- Final reports/exports, setup wizard, installer, app signing/update procedure, diagnostics/support bundle.

**Gate 7:** Clean install, upgrade fixture, pre-migration backup, failed migration recovery, local/cloud/new-PC restores and diagnostics all pass.

## 10. Phase 8 — Hardening and handoff

- Performance profiling on client-sized data.
- Full automated suites, security review, hardware matrix, power-loss matrix, full business-day simulation, training, client UAT.

**Gate 8:** No release blockers; all critical UAT cases accepted; recovery procedures and support boundaries delivered; signed handoff.

## 11. Definition of module complete

A module is complete only when:

- Requirements and invariants are traceable.
- Migration/entities/constraints and contracts are reviewed.
- Backend authorization, transaction, idempotency, audit and errors are implemented.
- UI normal/empty/loading/error/offline/permission states are implemented.
- Unit, database, service, IPC, UI and relevant E2E/hardware tests pass.
- Reports/reconciliation are proven.
- Documentation and migration/restore implications are updated.

## 12. Change control

A change affecting a frozen invariant, architecture, schema authority, tax/rounding, costing, stock, payment, backup security, deployment topology, or supported hardware needs an explicit decision record and updated tests/docs before code merge.
