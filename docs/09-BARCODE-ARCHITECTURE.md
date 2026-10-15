# Barcode and Scanner Architecture

## 1. Scanner model

Most USB HID barcode scanners behave like fast keyboards. The renderer captures timed keystrokes, detects a configured terminator, and submits one string to the backend barcode resolver. Device-specific raw HID support is an optional adapter only if the agreed hardware requires it.

```mermaid
flowchart LR
    S["Scanner"] --> R["Renderer scan buffer"]
    R --> P["Preload IPC"]
    P --> B["Barcode service"]
    B --> C["Catalog or inventory item"]
    C --> X["Current screen action"]
```

## 2. Responsibility split

Renderer:

- Buffer keystrokes using configured timing/terminator rules.
- Avoid capturing ordinary typing in focused editable fields.
- Provide audio/visual success, not-found, and ambiguous feedback.
- Route resolution to the current context: POS, receiving, stock count, product setup.

Backend:

- Normalize only according to explicit symbology/business rules; never casually strip leading zeroes.
- Resolve active unique barcodes.
- Parse configured weighted/price-embedded formats.
- Enforce target type and active/sellable/receivable status.
- Return a contract response with item/variant, unit, price/cost context, and warnings.

## 3. Barcode targets

- Product variant for POS.
- Inventory item/supplier item for purchasing and stock count.
- Generated label for bakery-made finished goods.
- Weighted barcode rule that resolves a product plus encoded quantity/price.

One barcode cannot silently resolve to two active targets in the same store.

## 4. POS scan

1. Capture complete scan.
2. Resolve in backend.
3. Confirm active sellable variant and current price/tax.
4. Parse embedded weight/price only under an enabled rule.
5. Add/increment cart line.
6. Show feedback and keep scan loop ready.

If not found, do not create a product automatically from the POS screen. Offer manual search or an authorized catalog-assignment workflow.

## 5. Receiving scan

1. Resolve supplier/global/internal barcode.
2. Match an expected PO line where possible.
3. Display purchase unit, conversion, ordered/received quantities, cost, lot, and expiry requirements.
4. Add to a draft receipt only.
5. Posting the receipt performs all validation and stock writes transactionally.

Repeated scans increment the draft quantity only when configured and visible to the user.

## 6. Barcode assignment and labels

- Scan an existing supplier/manufacturer code or generate an internal code from an allocated namespace.
- Validate uniqueness before save and again in the database transaction.
- Record replacement/deactivation history where operationally useful.
- Label templates define size, fields, symbology, copies, printer, and preview.
- Never invent EAN/UPC values for external distribution without a valid allocation policy. Internal codes remain clearly internal.

## 7. Tests

- Leading zeroes, long codes, rapid repeated scans, pasted text, slow human typing, missing terminator, scanner prefix/suffix.
- Unknown/inactive/duplicate barcode behavior.
- Weighted barcode boundary values and checksum/format failures.
- Scanner unplug during use and fallback to search.
- Same code across receiving and POS contexts.
- Real target scanners after packaging, not browser-only tests.
