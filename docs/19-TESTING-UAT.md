# Testing, Reliability, and Client Acceptance

## 1. Test layers

| Layer                | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| Static               | formatting, lint, TypeScript, dependency/security policy                        |
| Unit                 | money/tax/rounding, conversions, pricing, yield, permissions, barcode parsing   |
| Database integration | real SQLite constraints, repositories, transactions, migrations, ledger queries |
| Service workflow     | posting, reversal, idempotency, authorization, audit/outbox                     |
| IPC contract         | allow-list, schema validation, serialization, error mapping, spoof resistance   |
| Renderer component   | forms, focus/scanner behavior, permission states, failure messages              |
| Desktop E2E          | Electron main/preload/renderer/backend/database integration                     |
| Packaged app         | installer, startup, paths, native modules, signing/update behavior              |
| Hardware             | exact scanner/printer/drawer/labeler/scale                                      |
| UAT                  | client performs real agreed workflows and signs result                          |

## 2. Financial and stock reconciliation tests

Every test run with posted data must assert, as applicable:

- Sale total = lines, discounts, tax, rounding according to approved rules.
- Applied payments/refunds/change reconcile to the document balance.
- Shift expected cash reconciles to opening cash and cash movements.
- Ledger sums equal balance projections.
- Source documents have exactly expected stock movements.
- Production consumption/output/wastage/cost reconcile.
- Report totals match authoritative posted records and exclude drafts/training data.

Snapshot-only UI tests are not evidence of accounting correctness.

## 3. Failure and power-loss matrix

Force termination or injected failure:

- Before, during, and after sale commit.
- During goods receipt, refund, production completion, count confirmation, and shift close.
- During local backup, cloud upload, restore staging, and migration.
- After commit but before receipt printing.

Expected result is complete commit or no commit, never half-effects. Startup must safely resume or surface recovery.

## 4. Migration/restore matrix

- Fresh install database.
- Every supported previous schema to current release.
- Realistic large/edge-case database.
- Failed migration and pre-upgrade recovery.
- Local/cloud restore, new-PC restore, wrong client/key/version, corrupt/tampered backup.
- Post-restore integrity, login, posting, reports, backup, and reconciliation.

## 5. Security tests

- Renderer cannot access Node, arbitrary IPC, filesystem, shell, database, or secrets.
- Every command rejects missing/expired session and insufficient permission.
- Actor/approver identity cannot be spoofed in payload.
- PIN/password rate limiting and lock behavior.
- Import/path/filename/payload size abuse and malformed data.
- Backup tenant isolation, token revocation, support-access expiry, and audit.
- Application/update package authenticity verification.

## 6. Full business-day simulation

Simulate at least one complete day:

1. Start offline and open cashier shift.
2. Receive purchases with partial delivery, lots, expiry, and unit conversion.
3. Complete production with actual variance and wastage.
4. Perform cash, non-cash, split, discount, held cart, and custom-order/deposit sales.
5. Trigger scanner and printer failure/fallback.
6. Perform partial refund and manager-approved correction.
7. Count selected stock and resolve a variance.
8. Close shift and reconcile cash/payment reports.
9. Run sales, tax, purchase, inventory, production and order reports.
10. Create local backup, reconnect internet, verify cloud backup.
11. Restart, verify next-day opening state, then restore the backup in the UAT/recovery environment.

## 7. Client UAT checklist

Client must physically perform and accept:

- Installation/first login/onboarding/import.
- Product/barcode creation and label if used.
- Purchase and barcode receiving.
- Production and wastage.
- Sale with every payment method and split payment.
- Discount, refund/void, receipt/reprint, drawer.
- Custom order, deposit, balance, fulfillment/cancellation.
- Stock count/adjustment, shift close, reports/export.
- Local/cloud backup and witnessed restore drill.
- User permissions and manager approval.

Record tester, build, device/hardware versions, date, result, evidence, defect IDs, accepted limitations, training completed, and signatures.

## 8. Release-blocking rules

Do not release with:

- Known money, tax, stock, payment, shift, migration, restore, authorization, or data-loss defect.
- Failed reconciliation.
- Untested target printer/scanner.
- No verified recent backup/restore path.
- Installer or upgrade failure on a clean supported PC.
- A critical workflow depending on internet contrary to local-first requirements.

Minor known issues require documented impact, workaround, owner, due plan, and explicit client acceptance where relevant.
