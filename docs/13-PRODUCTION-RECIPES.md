# Recipes, Costing, and Production

## 1. Recipe model

A recipe points to immutable versions. Each version defines input items and quantities, expected output item/quantity, units, optional wastage allowance, and effective metadata.

Changing a recipe creates a new version. Historical production and cost reports retain the version actually used.

## 2. Example

```text
Chocolate Cake 2 lb — Recipe v3
Inputs:
  Flour      500 g
  Sugar      350 g
  Butter     220 g
  Eggs         5 pc
  Cream      300 ml
  Chocolate  180 g
Expected output: 1 cake
```

Packaging can be a recipe input if it must affect stock/cost.

## 3. Production lifecycle

```text
PLANNED -> RELEASED -> IN_PROGRESS -> COMPLETED
       \-> CANCELLED       \-> ABORTED/CORRECTED
```

Planned/released runs may reserve ingredients if that feature is explicitly enabled. Only completed/posting effects change on-hand stock.

## 4. Completion transaction

1. Lock/load run and recipe version.
2. Validate actual inputs, units, lots, available stock, outputs, yield, wastage, actor, and idempotency.
3. Allocate input lots under approved policy.
4. Create negative consumption movements.
5. Create positive finished-goods movements and output lot/expiry where used.
6. Calculate actual batch/output cost from consumed cost plus scoped overhead.
7. Record expected-versus-actual variance, audit and outbox evidence.
8. Commit atomically.

If the transaction fails, neither ingredients nor finished goods move.

## 5. Yield and substitution

- Actual yield may differ; variance is reported, not hidden by editing the recipe.
- Ingredient substitution requires a configured allowed substitute or manager approval, and records the actual item/quantity/cost.
- Rework/by-product handling is out of scope unless explicitly added.
- Recipe cost preview is advisory; posted production actual cost is historical truth under the selected costing method.

## 6. Corrections

Do not edit a completed run. Use a controlled reversal/correction that considers whether outputs were already sold and whether ingredients can realistically be restored. When physical stock no longer matches a clean reversal, use documented adjustment/disposition workflows with approval.

## 7. Acceptance criteria

- Standard and scaled batches convert units correctly.
- Ingredient movements, output movements, lot allocation, wastage, and actual cost reconcile.
- Recipe version remains historically stable.
- Insufficient stock and prohibited substitution are blocked.
- Retry creates one completed run.
- Forced termination creates either no effects or the complete posted run.
