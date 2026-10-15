# Inventory Ledger and Stock Control

## 1. Authority

`stock_movements` is the authoritative history. A balance table may be maintained transactionally for speed, but it is a projection that must reconcile to the ledger.

```text
On hand = sum(signed base quantity of posted movements)
```

Never expose a normal “edit stock total” operation.

## 2. Movement types

- `OPENING`
- `PURCHASE_RECEIPT`
- `PURCHASE_RETURN`
- `SALE`
- `SALE_REFUND`
- `PRODUCTION_CONSUMPTION`
- `PRODUCTION_OUTPUT`
- `WASTAGE`
- `TRANSFER_OUT` / `TRANSFER_IN`
- `COUNT_ADJUSTMENT`
- `CORRECTION_REVERSAL`

Every movement references source type, source record/line, actor, time, item, location, optional lot, signed base quantity, and cost evidence.

## 3. Units and precision

- Each item has a base unit from one dimension.
- Purchase, recipe, count, and sale units convert deterministically to base quantity.
- Do not convert mass to volume or count without an explicit item-specific conversion rule approved for that use.
- Decimal scale and rounding are defined per unit/dimension. Repeated conversions must not create material drift.

## 4. Lot and expiry

Items configured for lot/expiry tracking require lots at receiving/production. Consumption allocation follows the approved method, commonly FEFO for expiring ingredients and FIFO/cost policy where appropriate. Users may override only with permission and reason.

Expired stock remains visible but is not automatically treated as sellable/usable. Disposal creates wastage movements.

## 5. Negative stock

Default policy is to block negative stock at posting. If the client explicitly enables it, the UI warns and audit records the exception; reports expose negative balances. Negative stock is not a substitute for delayed receiving or broken production recording.

## 6. Stock counts

1. Create count session and scope.
2. Snapshot or define handling of movements during count.
3. Enter/scan counted quantities without showing expected values when blind count is enabled.
4. Recount variances above thresholds.
5. Manager confirms.
6. Transaction creates count-adjustment movements and locks the session.

Opening stock is a distinct first-go-live session; later counts cannot rewrite it.

## 7. Reconciliation

Required checks:

- Ledger sum equals balance projection by item/location/lot.
- Every stock-affecting posted source has exactly its expected movements.
- Every movement references a valid posted source or documented administrative correction.
- Lot balances roll up to item/location totals.
- Valuation report uses the selected cost method consistently.
- Reversal pairs net to the expected correction.

Run targeted reconciliation after upgrades/restores and full reconciliation in release/UAT test suites.
