# Canonical Database Schema

This document defines the logical V1 schema. Exact TypeORM names may be refined before the first migration, but authorities, relationships, and invariants may not change silently.

## 1. Common columns

Most mutable tables include `id`, `created_at_utc`, `updated_at_utc`, and where needed `version`. Posted transaction tables include `posted_at_utc`, `posted_by_user_id`, `device_id`, `status`, and `idempotency_key`. Audit fields are not copied mechanically when they provide no value.

## 2. System, store, and identity

| Table              | Key fields and purpose                                                         |
| ------------------ | ------------------------------------------------------------------------------ |
| `schema_metadata`  | current application/schema compatibility evidence                              |
| `installations`    | device ID, store ID, install state, app version, service registration metadata |
| `stores`           | bakery identity, timezone, currency, tax/receipt configuration                 |
| `registers`        | logical POS register on the installation                                       |
| `settings`         | typed, scoped settings with validation/versioning                              |
| `users`            | username, display name, password hash/PIN hash, active/lock state              |
| `roles`            | client-defined/system role metadata                                            |
| `permissions`      | stable permission keys                                                         |
| `user_roles`       | user-to-role relation                                                          |
| `role_permissions` | role-to-permission relation                                                    |
| `approval_events`  | manager approvals with action, target, approver, reason, time                  |
| `audit_logs`       | append-only sensitive-action evidence                                          |

Usernames are unique within the store. Provider support identities are not normal rows with implicit access to bakery data.

## 3. Units and catalog

| Table              | Key fields and purpose                                                              |
| ------------------ | ----------------------------------------------------------------------------------- |
| `units`            | code, name, dimension (`MASS`, `VOLUME`, `COUNT`), precision                        |
| `unit_conversions` | from/to unit, multiplier, compatible dimension                                      |
| `categories`       | hierarchical or flat category, active state                                         |
| `tax_classes`      | configured rate/mode identifiers                                                    |
| `items`            | master inventory object: ingredient, packaging, finished good, resale good, service |
| `products`         | customer-facing product identity                                                    |
| `product_variants` | sellable variant, SKU, price, tax class, linked inventory item                      |
| `barcodes`         | barcode value/type, target kind/ID, primary flag, active state                      |
| `price_history`    | effective-dated sale prices and change evidence                                     |

`product_variants.sku` and active `barcodes.value` are unique within a store. A service may be sellable without stock. Each stocked variant resolves to an `items` row.

## 4. Suppliers and purchasing

| Table                   | Key fields and purpose                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `suppliers`             | contact, tax/reference, active state                                    |
| `supplier_items`        | supplier code/barcode, purchase unit, conversion, latest/standard price |
| `purchase_orders`       | document number, supplier, dates, status, totals                        |
| `purchase_order_lines`  | item, ordered qty/unit, cost/tax, received qty snapshot                 |
| `goods_receipts`        | supplier/delivery reference, receipt number, dates, status              |
| `goods_receipt_lines`   | item, quantity/unit/base quantity, cost, tax, lot/expiry input          |
| `purchase_returns`      | original receipt/supplier link, reason, status                          |
| `purchase_return_lines` | returned quantities/cost and stock movement links                       |

Partial receiving is represented by one or more goods receipts linked to a purchase order; order-line received totals are derived/reconciled from posted receipts.

## 5. Inventory

| Table               | Key fields and purpose                                                                |
| ------------------- | ------------------------------------------------------------------------------------- |
| `stock_locations`   | sale floor, ingredient store, production, damaged, etc.                               |
| `inventory_lots`    | item, supplier/production source, lot code, received/produced date, expiry, unit cost |
| `stock_movements`   | item, location, lot, signed base quantity, movement type, source type/ID, time        |
| `stock_balances`    | optional transactional projection/cache per item/location/lot                         |
| `stock_counts`      | count session, scope, freeze/snapshot strategy, status                                |
| `stock_count_lines` | system qty, counted qty, variance, reason                                             |
| `stock_adjustments` | approved correction document and reason                                               |
| `wastage_events`    | item/lot, quantity, reason, cost evidence                                             |
| `stock_transfers`   | from/to location with paired movements                                                |

`stock_movements` is append-only. Each posted source creates deterministic movements with a uniqueness guard on source/line/effect so retries cannot duplicate stock.

## 6. Recipes and production

| Table                     | Key fields and purpose                                              |
| ------------------------- | ------------------------------------------------------------------- |
| `recipes`                 | product/output identity, name, active version reference             |
| `recipe_versions`         | immutable version, expected yield/unit, effective date, notes       |
| `recipe_ingredients`      | version, input item, quantity/unit/base quantity, wastage allowance |
| `production_runs`         | planned/actual dates, recipe version, status, expected/actual yield |
| `production_consumptions` | run, input item/lot, planned and actual base quantity, cost         |
| `production_outputs`      | run, output item/lot, quantity, calculated unit cost, expiry        |
| `production_wastage`      | run-linked wastage and reason                                       |

A posted run retains the recipe version used even if the active recipe changes later.

## 7. Customers and custom orders

| Table                         | Key fields and purpose                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| `customers`                   | name, phones/emails, optional address, consent/preferences               |
| `custom_orders`               | order number, customer, due/pickup time, status, totals, deposit balance |
| `custom_order_lines`          | product/custom description, qty, price, tax, specifications              |
| `custom_order_notes`          | structured design/allergen/production/communication notes                |
| `custom_order_status_history` | append-only state changes                                                |
| `custom_order_payments`       | relation to authoritative payment record                                 |

Allergen notes are operational information, not a guarantee that cross-contamination is impossible.

## 8. POS, payments, and shifts

| Table            | Key fields and purpose                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| `shifts`         | register, cashier, open/close times, opening cash, status               |
| `cash_movements` | sale/payment, pay-in, payout, refund, opening/closing effects           |
| `sales`          | sale number, shift, customer/order, subtotal/discount/tax/total, status |
| `sale_lines`     | product/variant snapshot, qty, unit price, discount, tax, cost snapshot |
| `payments`       | sale/order/refund link, method, amount, reference, status               |
| `refunds`        | original sale, reason, approval, totals, status                         |
| `refund_lines`   | original sale line, qty, amount, restock/disposition                    |
| `held_carts`     | non-posted resumable cart data with ownership/expiry                    |

Sale lines preserve names, SKU, tax, and pricing snapshots so history does not change when catalog data changes.

## 9. Backup, imports, jobs, and integration evidence

| Table                    | Key fields and purpose                                                  |
| ------------------------ | ----------------------------------------------------------------------- |
| `import_sessions`        | type, source hash, validation result, status, actor                     |
| `import_rows`            | normalized row, errors/warnings, resolved target                        |
| `opening_stock_sessions` | store, status, confirmation/go-live identity                            |
| `backup_runs`            | type, path/object reference, checksum, size, schema/app version, status |
| `restore_runs`           | source backup, authorization, validation, result                        |
| `background_jobs`        | durable retry/next-attempt/status for cloud backup and maintenance      |
| `outbox_events`          | durable post-commit events for cloud/service sync without dual writes   |

## 10. Required indexes and constraints

At minimum:

- Unique store-scoped username, SKU, barcode, sale number, purchase number, receipt number, order number.
- Unique idempotency keys per command scope.
- Unique stock effect per source line/effect type.
- Index movements by item/location/lot/time and source.
- Index sales by business date/shift/status and payments by sale/method/status.
- Index lots by item/expiry and custom orders by due time/status.
- Check nonnegative monetary components where the workflow does not explicitly allow a signed value.
- Check status values through enums/check constraints supported by the migration strategy.
- Foreign keys use deliberate delete behavior; posted-history relationships generally restrict deletion.
