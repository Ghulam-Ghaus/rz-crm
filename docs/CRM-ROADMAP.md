# RZ Enterprises CRM — Pivot Decision Record and End-to-End Roadmap

> Handoff document. Any contributor/model continuing the work must read this, `AGENTS.md`, and `docs/00-PROJECT-MASTER.md` first. Update the **Status** column as phases complete.
> This record supersedes bakery-specific scope in `docs/01-SCOPE-REQUIREMENTS.md` where they conflict (AGENTS.md rule 2: decision recorded before code).

## 1. Decision record (ADR-CRM-001)

This repository is a **separate copy** of the Bakery Store POS, pivoted into **RZ Enterprises CRM**.

| Decision | Value |
| :--- | :--- |
| Isolation | Never read/write/delete anything in `d:\PL\bakery-app` or `%APPDATA%\@bakery\desktop` (`bakery.db`). |
| Data dir | `%APPDATA%\@rz-crm\desktop`; DB file `data\rz_crm.db`; env override `RZ_CRM_DATA_DIR`. |
| DB identity guard | `app_identity.db_name = 'rz_crm'`; app refuses any other DB. |
| Architecture | Unchanged fixed V1: Electron + React/TS + NestJS context + typed IPC + SQLite/better-sqlite3 + TypeORM. `synchronize=false`. |
| Migrations | Fresh clean chain for `rz_crm` (bakery recipes/production/custom-orders/held-carts dropped). |
| Packages | Rename scope `@rz-crm/*` → `@rz-crm/*`. |
| Repo | `https://github.com/Ghulam-Ghaus/rz-crm.git`, branch `main`, fresh history. Feature branches per phase. |
| Tenancy | Single company/store; keep `store_id` for future. |
| Money | Integer minor units + currency (PKR). Immutable ledgers; corrections by reversal. |

### Identity realms
- **Admins/operators**: `users` + `roles` (RBAC).
- **Stakeholders**: separate login realm (`principal_type='stakeholder'`), read-only portal (own investment, ownership, profit share, distributions, company P&L). Cannot reach sales/stock/staff.
- **Staff**: `staff_members` payroll records, optionally linked to a user and optionally to a stakeholder. Salary ≠ profit distribution.
- **Expenses**: operating costs, separate from payroll and stakeholder payouts.

## 2. Modules
Sales Terminal • Stock & Inventories • Product Catalog • Purchases & GRN • Sales & Reports • Expenses & Salaries • Staff & Roles • **Returns** (sales returns/credit notes, purchase returns/debit notes) • **Stakeholders** (investments, equity, distributions, P&L).

## 3. Payments model
Unified `payments` table (direction IN/OUT; party CUSTOMER|SUPPLIER|STAFF|STAKEHOLDER|EXPENSE; methods CASH|BANK_TRANSFER|CHEQUE|ONLINE|CARD|WALLET|CREDIT), `payment_cheques`, `payment_status_history` (immutable), `bank_accounts`.

| Method | Lifecycle |
| :--- | :--- |
| Cash | UNPAID → PAID / PARTIAL |
| Bank transfer / Online | UNPAID → PENDING_VERIFICATION → PAID / FAILED |
| Cheque received | UNPAID → CHEQUE_RECEIVED → DEPOSITED → CLEARED (=paid) / BOUNCED (reversal, back to UNPAID) |
| Cheque issued | ISSUED → CLEARED / CANCELLED |
| Credit | UNPAID → PARTIAL → PAID |

Invoice status derived: UNPAID | PARTIAL | PAID | OVERDUE. A cheque counts as paid only when CLEARED; post-dated cheques have deposit dates and reminders; Cheque Register screen.

## 4. Stakeholder & P&L model
Tables: `stakeholders`, `stakeholder_equity` (versioned; `share_mode` FIXED_PERCENT | CAPITAL_PROPORTIONAL; bps, no floats), `stakeholder_transactions` (capital in, additional investment, withdrawal, profit distribution, drawings, loan in/repay; immutable), `fiscal_periods`, `profit_distribution_runs/lines` (shares must sum to 10000 bps; snapshotted).

```
Revenue = completed sales − sales returns (net tax)
COGS = stock-ledger cost of goods sold − cost of returned-in goods
Gross profit = Revenue − COGS
Net profit = Gross profit − operating expenses − staff cost (salaries on own line)
```
Distributions/drawings are appropriations of profit, never expenses.

## 5. Roadmap (each phase = own branch off `main`, merged only when gate passes)

Status legend: ⬜ todo · 🟨 in progress · ✅ done

| Phase | Branch | Scope | Gate | Status |
| :--- | :--- | :--- | :--- | :--- |
| **0 Repo setup** | `main` | Fresh git repo, README, remote `rz-crm`, push | `main` pushed to GitHub | 🟨 local commit done; push pending auth |
| **1 Foundation** | `phase-1-foundation` | Rename `@bakery`→`@rz-crm`, app id/name, data dir → `@rz-crm\desktop\data\rz_crm.db`; `app_identity` stamp migration + pre-open read-only guard (blocks `bakery.db` and unstamped DBs). **Deferred to Phase 13:** pruning bakery tables/migrations/modules (code still depends on them) and UI rebrand (Phase 11). | Build, typecheck, 43 tests pass (incl. `tests/integration/identity-guard.spec.ts`); bakery.db proven byte-identical | 🟨 code done, awaiting your commit/merge |
| **2 Catalog & Stock** | `phase-2-catalog-stock` | Categories, products/variants, units, barcodes, locations, immutable stock ledger, opening stock, low-stock/reorder | Ledger reconciles to balances; imports atomic/idempotent | ⬜ |
| **3 Customers & Payments core** | `phase-3-payments` | Customers (credit limit/terms/ledger), unified payments, cheque lifecycle, bank accounts, status history, Cheque Register | State-machine tests; bounce reversal reconciles | ⬜ |
| **4 Sales Terminal** | `phase-4-sales` | Cash/walk-in + credit invoices, split payments, shifts/cash drawer, receipt, idempotent sale | Stock, cash, receivables reconcile; duplicate/retry safe | ⬜ |
| **5 Purchasing & GRN** | `phase-5-purchasing` | Suppliers, PO, GRN (partial), lots/expiry, supplier ledger, supplier payments (incl. cheques issued) | GRN raises exact stock; payables reconcile | ⬜ |
| **6 Returns** | `phase-6-returns` | Sales returns (credit notes) + purchase returns (debit notes), restock/waste, refund methods | Stock/cash/ledgers reconcile | ⬜ |
| **7 Expenses & Staff** | `phase-7-expenses-staff` | Expense categories/vouchers, staff members, advances, salaries/payslips (separate from stakeholders) | Salary/advance reconciliation | ⬜ |
| **8 Staff & Roles (RBAC)** | `phase-8-rbac` | Roles/permission matrix, audit UI, manager approvals | Permission tests per module | ⬜ |
| **9 Stakeholders** | `phase-9-stakeholders` | Stakeholders, separate login realm + portal, equity versions, capital/distribution, fiscal periods, period close | Shares sum 10000 bps; portal isolation tests | ⬜ |
| **10 Reports & Dashboard** | `phase-10-reports` | P&L, stakeholder statements, receivables ageing, stock valuation, sales/purchase/returns reports, cheque forecast | Every report reconciles to ledgers | ⬜ |
| **11 CRM UI shell** | `phase-11-ui` | Sidebar navigation, RZ branding/logo, design system, dashboards, empty/loading/error/permission states | UI acceptance per module | ⬜ |
| **12 Backup, installer, hardening** | `phase-12-release` | Backup/restore to `@rz-crm` paths, installer/signing, upgrade tests, full suite, UAT (`docs/19-TESTING-UAT.md`) | All gates in `docs/20-IMPLEMENTATION-ORDER.md` | ⬜ |
| **13 Remove bakery leftovers** | `phase-13-cleanup` | Delete dead bakery code/tests/docs/seed data once CRM modules are complete | Build + tests green without them | ⬜ |

UI work (Phase 11) may be developed incrementally alongside each module's screens; the shell lands early enough that modules plug into the sidebar.

## 6. Per-phase workflow
1. Update docs/ADR for any invariant-affecting change.
2. Freeze migration + contracts, then backend + renderer.
3. Add/adjust tests (unit, integration, migration, IPC).
4. Run format, lint, typecheck, unit, integration, migration, packaging, e2e. Report exact results and remaining risks (never claim "100% bug-free").
5. Commit on the phase branch, merge to `main`, update the Status column above.

## 7. Safety rules for this copy
- Do not touch `d:\PL\bakery-app`, `%APPDATA%\@bakery`, or `bakery.db`.
- Do not push to the `pos-bakery` remote (it was removed from this repo).
- Backup of old git metadata (partial): `d:\PL\rz-enterprises-crm-bakery-git-backup`.
