# Roles, Permissions, Security, and Audit

## 1. Identity separation

Three concepts must not be confused:

1. Bakery user: works in POS/management application.
2. Client super admin: owns bakery users/settings/data access.
3. Provider administrator: manages installation, backup/service health, plan/support metadata; has no default unrestricted access to bakery records.

## 2. Baseline roles

Roles are templates; permission keys are authoritative.

| Role               | Typical access                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Cashier            | open/use own shift, sell, hold cart, reprint receipt                                       |
| Purchase user      | suppliers, POs, draft/post receiving within limits                                         |
| Baker              | recipes view, production runs, wastage within limits                                       |
| Manager            | discounts/refunds/voids, counts, adjustments, shift review, operational reports            |
| Accountant         | financial/report/export read access; no operational posting by default                     |
| Admin              | catalog, users below super-admin level, settings, operational configuration                |
| Client super admin | all client-authorized functions including role assignment, restore approval, service setup |

## 3. Permission keys

Use granular stable keys such as:

```text
sale.create
sale.discount.within_limit
sale.discount.override
sale.refund
sale.void
shift.open
shift.close.own
shift.close.override
purchase.post_receipt
inventory.count.confirm
inventory.adjust
production.complete
report.financial.view
report.export
user.manage
settings.manage
backup.configure
restore.execute
```

## 4. Authentication

- Passwords and PINs are salted/hashed using a suitable current password-hashing function and configurable work factor.
- PIN login is appropriate only with rate limits, lockout, session timeout, and scoped high-risk reauthentication.
- First-run temporary credentials must be changed.
- Account disablement takes effect on the next authorized backend command/session check.
- Recovery avoids hidden universal passwords. Provider-assisted recovery is explicit, client-authorized, time-bounded, and audited.

## 5. Manager approval

High-risk actions may require an approving user to authenticate at the moment of action. The backend verifies approver permission and records action, target, reason, requester, approver, time, and device. A UI boolean like `managerApproved: true` is never trusted.

## 6. Electron security

- Context isolation on; Node integration off in renderer.
- Narrow preload API; no raw IPC, shell, arbitrary file path, or command execution.
- Content Security Policy and navigation/window-open restrictions.
- Validate all inputs/outputs; bound import and attachment sizes.
- Package signing and update authenticity are release requirements.
- Store device/cloud tokens using OS-protected credential storage; rotate/revoke per installation.

## 7. Data and cloud security

- Encrypt traffic and cloud backup objects; use tenant/installation isolation and least-privilege short-lived credentials.
- Never publish backup buckets or put provider-wide secrets in desktop code.
- Backups contain client business data; define ownership, retention, deletion, access, and breach/support procedures contractually.
- Diagnostics exclude passwords, tokens, unnecessary customer data, and full database contents.

## 8. Audit

Audit at minimum:

- login failures/lockouts, role/user/settings changes;
- product price/tax/barcode changes;
- discounts requiring approval, refunds, voids;
- purchase receipt reversals, stock adjustments/count confirmations, production corrections;
- backup configuration, restore, migration, data export;
- support-access grant/use/revoke.

Audit records are append-only to ordinary application users and include reason/correlation information. Audit is evidence, not a replacement for proper transaction records.
