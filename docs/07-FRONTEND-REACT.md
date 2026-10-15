# Frontend — React Desktop UI

## 1. Responsibilities

React owns presentation, navigation, forms, focus/keyboard behavior, view state, user feedback, and scanner keystroke buffering. It consumes only the typed preload API and shared contracts.

React does not import entities, calculate authoritative totals, mutate stock, query SQLite, open printers, access the filesystem, or hold cloud secrets.

## 2. Feature structure

```text
src/
├── app/                 # shell, routes, providers, error boundary
├── features/
│   ├── onboarding
│   ├── auth
│   ├── pos
│   ├── catalog
│   ├── purchasing
│   ├── inventory
│   ├── production
│   ├── custom-orders
│   ├── customers
│   ├── shifts
│   ├── reports
│   ├── users
│   └── diagnostics
└── shared/              # UI components, formatting, hooks
```

Feature code may import shared UI and contracts but should not reach into another feature's internal files.

## 3. POS UX priorities

- Keep scan focus reliable without breaking text-entry fields.
- Visible scan success/failure feedback and an undo path before payment.
- Touch targets suitable for the agreed POS screen; complete keyboard operation for speed.
- Product search and category/touch selection always available when scanner fails.
- Cart and totals remain visible; payment screen clearly shows due, tendered, remaining, and change.
- Disable duplicate completion while a command is pending, while still relying on backend idempotency.
- After commit, treat printing as a separate state: `SALE COMPLETE — RECEIPT PENDING/PRINTED/FAILED`.

## 4. Data-fetching and state

- Server/application state comes through IPC query/command methods and is invalidated after mutations.
- Keep transient cart/form state local to the feature; held carts become backend drafts only when explicitly saved/held.
- Do not add a large global state framework until measured complexity requires it.
- Persist only harmless UI preferences locally. Business data belongs in the backend/database.

## 5. Forms and validation

Use shared schemas for boundary validation and UI feedback, but the backend revalidates every command. Imports use a dedicated preview grid with row numbers, errors, warnings, normalized values, and a zero-write confirmation step.

## 6. Permissions and controlled actions

Routes/buttons reflect permissions for usability. Backend enforcement remains authoritative. Refunds, voids, high discounts, stock adjustments, restore, and user administration show the required reason and manager approval flow.

## 7. Offline and failure states

- Do not display normal internet absence as a blocking application failure.
- Show backup/service health separately from POS health.
- Database recovery state replaces ordinary navigation and offers only authorized diagnostics, backup/export where safe, and recovery actions.
- Global error boundaries preserve correlation IDs and recovery guidance.

## 8. Accessibility and locale

- Labels and errors are explicit; status is not color-only.
- Focus order, shortcuts, contrast, and screen scaling are tested.
- Currency, date, time, and quantity formatting use store locale/timezone while persistence remains canonical.
- Text is externalized enough to support future localization without designing a full translation platform in V1.
