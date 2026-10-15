# Shared Contracts and Secure IPC

## 1. Contract package

`packages/contracts` contains transport-neutral Zod schemas, inferred TypeScript types, stable error envelopes, command/query identifiers, and API version metadata.

It must not depend on Electron, NestJS, React, TypeORM, or Node-only APIs.

```text
packages/contracts/src/
├── common/
├── auth/
├── catalog/
├── purchasing/
├── inventory/
├── production/
├── sales/
├── orders/
├── reports/
├── backup/
└── ipc-api.ts
```

## 2. Boundary types

Keep these concepts separate:

| Concept                      | Example                                   | Location              |
| ---------------------------- | ----------------------------------------- | --------------------- |
| Persistence entity           | `SaleEntity`                              | database/backend only |
| Backend DTO/internal command | `CompleteSaleDto` / `CompleteSaleCommand` | backend               |
| Boundary input/output        | `CompleteSaleInput`, `SaleResponse`       | contracts             |
| UI model                     | derived view state                        | renderer              |

React never receives an entity instance.

## 3. IPC API shape

Expose named methods, not a generic `invoke(channel, payload)`:

```ts
window.bakery.catalog.resolveBarcode(input);
window.bakery.sales.complete(input);
window.bakery.purchasing.postReceipt(input);
window.bakery.backup.getHealth();
```

Each handler:

1. Matches an allow-listed channel/method.
2. Validates input with its schema.
3. obtains authenticated session/actor context from trusted main-process state, not from user-supplied IDs alone.
4. Invokes one application service.
5. Validates the response envelope before returning it.
6. Converts unexpected errors to a safe correlation-ID response.

## 4. Command requirements

Posting commands contain:

- `requestId`/idempotency key generated once and reused on retry.
- Editable aggregate version when applicable.
- Reason/approval token for controlled actions.
- Business payload using IDs and canonical values.

Do not trust renderer-calculated totals, taxes, permission flags, stock, costs, or actor identity. These may be shown as a preview but are recalculated/verified in the backend.

## 5. Versioning

- Contract changes are reviewed with their migration and both consumers.
- Additive optional response fields are preferred within a compatible release line.
- Renames/removals require coordinated desktop/renderer deployment because both ship together.
- Store app build, contract version, and schema compatibility ranges for diagnostics.

## 6. Events

Main-to-renderer events are allow-listed and validated, for example:

- backup health changed
- printer status changed
- update/restart required
- session locked

Events are notifications, not alternative write authorities. The renderer refreshes authoritative state after relevant events.

## 7. Contract tests

- Every method has valid/invalid input fixtures and output validation.
- Unknown channels and prototype-pollution-shaped payloads are rejected.
- Oversized payloads/imports are bounded.
- Permission and session context cannot be spoofed by supplying another user ID.
- Serialization of dates, decimals, and integer money is deterministic.
