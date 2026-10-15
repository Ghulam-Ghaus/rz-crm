# Purchasing and Goods Receiving

## 1. Goals

Purchasing records supplier intent and cost; receiving is the authority that stock physically entered the bakery. A purchase order alone never increases stock.

## 2. Purchase order lifecycle

```text
DRAFT -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED -> CLOSED
                  \-> CANCELLED (only remaining quantity)
```

The exact approval step may be disabled for a small bakery, but permissions and audit remain.

PO lines record item, ordered quantity/unit, conversion, expected unit cost, tax, discount, due date, and notes. Changes after receiving must not rewrite historical receipt truth.

## 3. Receiving workflow

1. Select supplier and optional PO.
2. Enter supplier invoice/delivery reference and receive date.
3. Scan or search each item.
4. Capture received purchase quantity, unit, conversion to base quantity, accepted/rejected amount, cost, tax, lot, manufacture/expiry dates as required.
5. Compare with PO and show over/under delivery warnings.
6. Save draft without stock effect.
7. Authorized user reviews and posts.
8. Transaction creates receipt, lines, lots, positive stock movements, cost evidence, PO receipt allocation, audit and outbox records.
9. Print/export receipt summary if required.

## 4. Transaction rules

- Posting is idempotent.
- Recalculate base quantities and totals in the backend.
- Required expiry/lot fields depend on item policy.
- Duplicate supplier invoice references are rejected or require a documented override.
- Zero/negative received quantities are not normal receipt lines.
- A partial receipt updates order status from posted allocation, not an editable counter.
- Stock enters a configured location and lot.

## 5. Corrections and returns

Do not edit a posted goods receipt. Use:

- Purchase return for goods sent back, creating negative stock movements and financial evidence.
- Receiving correction/reversal for a posting mistake, linked to the original record and manager-approved.
- Stock adjustment only when the source cannot properly be corrected; require reason and approval.

If stock from the receipt has already been sold or consumed, correction policy must avoid impossible negative lot balances unless negative stock is explicitly allowed.

## 6. Costing

V1 stores historical received unit cost and the cost method chosen for inventory/reporting. The client must approve whether valuation uses weighted average, FIFO by lot, or another supported method. Do not mix methods across reports.

Landed costs such as freight are included only if scoped; allocation rules must be explicit and repeatable.

## 7. Acceptance criteria

- Full and partial PO receiving reconcile.
- Scan and manual search both work.
- Unit conversion creates exact expected base stock.
- Lot and expiry trace back to the receipt.
- Duplicate posting/retry creates no duplicate movement.
- Return/reversal restores stock and reports correctly.
- Power loss before commit writes nothing; after commit the receipt remains complete.
