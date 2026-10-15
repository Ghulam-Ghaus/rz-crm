# Backend — NestJS Application Context

## 1. Purpose

NestJS provides dependency injection, module boundaries, command orchestration, authorization, repositories, transactions, jobs, and testing without exposing an HTTP server in V1.

Electron main bootstraps the context with `NestFactory.createApplicationContext(...)`. IPC adapters call application services. Future REST or sync transports may be added around the same services only through an approved design.

## 2. Modules

```text
modules/
├── auth
├── users-rbac
├── store-settings
├── catalog
├── barcode
├── suppliers
├── purchasing
├── inventory
├── recipes
├── production
├── customers
├── custom-orders
├── sales
├── payments
├── shifts
├── reports
├── imports
├── backup-restore
├── audit
├── jobs-outbox
└── hardware
```

Keep module structure proportional. A simple read service does not need a ceremonial factory, facade, manager, and use-case layer.

## 3. Service design

- Commands express business intent: `PostGoodsReceipt`, `CompleteSale`, `RefundSale`, `CompleteProductionRun`, `ConfirmOpeningStock`, `CloseShift`.
- One application service coordinates each aggregate transaction.
- Domain calculators are pure where possible and return explainable intermediate values.
- Repositories hide complicated persistence/locking/query behavior, not every trivial ORM call.
- Mappers return contract responses; entities never cross the boundary.
- Authorization is enforced in the backend for every command. UI hiding is not security.

## 4. Transaction pattern

Within one TypeORM transaction:

1. Check idempotency and return prior result if already committed.
2. Load authoritative records.
3. Enforce permission, status, quantity, shift, and approval rules.
4. Recalculate money/stock effects using server-side/domain rules.
5. Write aggregate and immutable effects.
6. Write audit and outbox evidence.
7. Commit.

Only after commit may the application print, notify, or upload. External side effects use durable jobs/outbox records so retries do not duplicate financial or stock effects.

## 5. Error model

Use stable error codes and safe messages, for example:

- `AUTH_FORBIDDEN`
- `VALIDATION_FAILED`
- `BARCODE_NOT_FOUND`
- `BARCODE_AMBIGUOUS`
- `SHIFT_REQUIRED`
- `INSUFFICIENT_STOCK`
- `MANAGER_APPROVAL_REQUIRED`
- `CONFLICT_STALE_VERSION`
- `DUPLICATE_DOCUMENT_REFERENCE`
- `DATABASE_RECOVERY_REQUIRED`
- `PRINTER_UNAVAILABLE`

Unexpected errors receive a correlation ID and are logged privately. Do not leak SQL, local paths, secrets, or stack traces to the renderer.

## 6. Reports

Reports are backend queries with explicit filters, timezone/business-day treatment, and reconciliation tests. UI code must not reproduce financial totals. Expensive exports run as cancellable jobs and produce deterministic snapshots.

## 7. Background jobs

Use a small durable local job table for cloud backup, retention, health check-in, and export cleanup. Jobs have attempt count, next attempt, lock/lease, terminal status, and last safe error. Startup resumes abandoned eligible jobs. Internet absence is expected and uses bounded exponential retry.

## 8. Tests

- Pure unit tests for pricing, tax, units, recipe yield, change, and permissions.
- Repository/integration tests against real SQLite behavior.
- Transaction rollback and idempotency tests.
- Module tests for posting and reversal workflows.
- IPC contract tests and packaged application end-to-end tests.
