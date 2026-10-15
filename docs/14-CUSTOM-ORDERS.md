# Custom and Advance Orders

## 1. Purpose

Custom orders manage cakes and bakery work prepared for a future pickup/delivery time. They combine customer communication, specifications, production scheduling, deposits, balance, and fulfillment without turning V1 into a full project-management system.

## 2. Required information

- Order number and customer/contact details.
- Pickup/delivery method, due date/time, event date if different.
- Product/size/flavor/quantity and free-form design notes.
- Reference image attachment policy if scoped.
- Allergens and customer-provided dietary requirements, with clear operational warnings.
- Agreed price, discount/tax, deposit, remaining balance, payment history.
- Production/decorator assignment or notes where enabled.
- Status history and cancellation reason.

## 3. Lifecycle

```text
DRAFT -> QUOTED -> CONFIRMED -> IN_PRODUCTION -> READY -> COLLECTED
   \-> CANCELLED / NO_SHOW
```

Permitted transitions, required deposit, edit cutoff, and cancellation/refund rules are store-configured and permission-controlled.

## 4. Payments

Deposits are authoritative payment records linked to the order. The remaining balance is derived from posted order charges, payments, refunds, and adjustments. Never store an independently editable “balance due” as the only authority.

Final pickup may complete payment through POS and link the sale to the order. Avoid double-counting deposits in sales/payment reports.

## 5. Production and inventory boundary

An order may create production demand, but confirming an order does not automatically consume ingredients. Inventory effects occur through production completion or sale according to the configured fulfillment model.

## 6. Calendar/Kanban views

Views query the same order authority and support filters by due date, status, assignment, and overdue state. Dragging a card is a status/date command subject to transition rules, validation, and audit—not a client-side-only change.

## 7. Acceptance criteria

- Deposit, balance, refund, cancellation, and final payment reconcile.
- Unauthorized or invalid status transitions are blocked.
- Due-time timezone/business-day behavior is correct.
- Order notes/specifications remain available after catalog changes.
- Collected/cancelled/no-show records remain auditable.
