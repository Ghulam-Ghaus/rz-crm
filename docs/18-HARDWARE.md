# Hardware Integration

## 1. Supported device classes

- USB HID barcode scanner.
- 58/80 mm receipt printer using Windows printing and/or validated ESC/POS adapter.
- Cash drawer driven by printer kick pulse or documented interface.
- Label printer when barcode labels are required.
- Serial/USB scale only when included in client scope.
- Optional customer display only after explicit scope.

Record an exact supported hardware matrix: manufacturer, model, firmware/driver, connection, Windows version, adapter, and test status. “ESC/POS compatible” is not enough proof.

## 2. Adapter boundary

Business services depend on narrow interfaces:

```ts
interface ReceiptPrinter {
  printReceipt(job: ReceiptPrintJob): Promise<PrintResult>;
}

interface CashDrawer {
  open(reason: DrawerOpenReason): Promise<DeviceResult>;
}
```

Device libraries/protocols stay inside adapters. Sales service commits sales without knowing USB, serial, printer names, or byte commands.

## 3. Receipt printing

- Generate a stable receipt document/model from the committed sale snapshot.
- Persist print job/status separately from financial posting.
- Support original and clearly marked copy/reprint.
- Handle configured paper width, characters, logo limits, tax fields, footer, cut, drawer pulse, and encoding.
- A failed print offers retry/reprint; it never posts another sale.

## 4. Cash drawer

Open automatically only for configured cash-related events or through an authorized manual action. Record manual/no-sale drawer openings with actor and reason when hardware permits the workflow.

## 5. Scanner

Default HID scanners are handled through renderer keystroke buffering as defined in `09-BARCODE-ARCHITECTURE.md`. Setup captures a real scan, identifies prefix/suffix/terminator needs, and saves device settings.

## 6. Scale

If scoped, define stable weight, tare, unit, precision, timeout, disconnect, and manual override behavior. A displayed weight must identify whether it came from the scale or manual entry. Calibrated trade use may have local regulatory requirements; client must confirm them.

## 7. Device health

Diagnostics shows configured device, status, last successful test/use, safe error, and test action. Hardware absence must degrade only dependent features.

## 8. Physical acceptance tests

- 100 rapid barcode scans, duplicates, leading zeroes, unplug/replug, manual fallback.
- Long and short receipts, logo/text, tax/discount/refund/split-payment receipts, paper-out, printer-offline, reprint.
- Cash drawer open on valid cash event and no open on non-cash policy.
- Label alignment, barcode scanability, repeated copies.
- Scale stable/unstable/timeout/disconnect cases if scoped.
- Tests run against packaged production build on the client's actual PC and device models.
