# Bakery Store Agent Rules

This file governs every coding agent and contributor working in this repository.

## Source of truth

1. Read `docs/00-PROJECT-MASTER.md` and the relevant workflow documents before changing code.
2. A documented invariant may not be weakened silently. Record a decision change first.
3. Do not introduce a second architecture, framework, ORM, database, transport, or state-management stack without an approved architecture decision record.
4. When documents disagree, stop and report the conflict. Do not choose whichever rule is easier to implement.

## Fixed V1 architecture

- Windows desktop app: Electron.
- Renderer: React and TypeScript.
- Business application: NestJS application context in the Electron main process.
- Desktop transport: typed, allow-listed Electron IPC through preload.
- Local database: SQLite through `better-sqlite3` and TypeORM.
- Runtime operation is local-first. A sale must not require internet or a cloud service.
- Shared boundary schemas/types live in `packages/contracts`. React must never import TypeORM entities.
- Next.js, a local HTTP server, microservices, containers on the client PC, and a second database are out of scope for V1.

## Non-negotiable data rules

- `synchronize` must be `false` outside disposable tests. Released schemas change only through reviewed migrations.
- Never store money in floating-point values. Store integer minor units plus currency code.
- Never overwrite inventory quantity as an ordinary operation. Purchases, sales, refunds, production, wastage, opening stock, transfers, and adjustments create immutable stock-ledger movements.
- Posted financial, stock, receiving, production, and shift records are not edited or deleted. Correct them with explicit reversal/correction workflows.
- Business operations that affect more than one record must use one database transaction.
- Every write command that can be retried must have an idempotency key or an equivalent duplicate guard.
- All mutable business tables use stable IDs and timestamps. Audit-sensitive actions include actor and device identity.
- Opening stock is a controlled, one-time session. After go-live, corrections use stock counts or adjustments.
- Backups are not considered successful until their integrity/checksum is verified. Restore must be tested.

## Security rules

- Renderer code has no Node.js, filesystem, database, shell, or unrestricted IPC access.
- Keep `contextIsolation: true`, `nodeIntegration: false`, sandboxing enabled where compatible, and a narrow preload API.
- Validate every IPC request and response with the shared runtime schema.
- Use password hashing, short inactivity locks, least-privilege RBAC, and manager approval for controlled actions.
- Never embed master cloud-storage credentials or provider-wide secrets in the desktop package.
- Provider/platform administration and bakery-client administration are separate identities and permissions.
- Remote access to client business data requires explicit client authorization and must be audited.

## Delivery discipline

- Work in the implementation order defined in `docs/20-IMPLEMENTATION-ORDER.md`.
- A module is not complete because it compiles or its UI renders. Its acceptance tests and ledger/report reconciliation must pass.
- Freeze the database migration and shared contract for a vertical slice before backend and frontend implementation proceed in parallel.
- Add or update tests with every behavior change.
- Use the real scanner and printer models during hardware acceptance; mocks alone are insufficient.
- Never bypass a failing test, migration, integrity check, backup check, permission check, or release gate to make a build green.
- Never include test/training transactions in production financial reports.
- Preserve user data during upgrades. Create and verify a pre-migration backup before applying migrations.

## Required verification before handoff

Run the repository's format, lint, typecheck, unit, integration, migration, packaging, and end-to-end commands. Then verify the applicable manual/UAT cases in `docs/19-TESTING-UAT.md`. Report exact results and remaining risks; never claim “100% bug-free.”
