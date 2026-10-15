# Installation, Diagnostics, Updates, and Handoff

## 1. Installer outcome

The client receives one signed Windows installer. It packages Electron, renderer, NestJS business application, native SQLite driver, migrations, and required assets. The client must not separately install Node.js, npm, NestJS, SQLite, Python, containers, or a database server.

## 2. Data locations

Use OS-approved per-machine/per-user application-data locations chosen for the installation model. Keep separate:

- live database/WAL files;
- local backups;
- logs and support bundles;
- exports;
- update staging/cache;
- protected device credentials.

Never store client data inside the application installation directory. Backup destination should be on a separate disk/folder/device where practical and must be writable/tested.

## 3. Installation modes

Baseline supports one installation/device/store. Decide during discovery whether install is per-machine or per-user and whether Windows standard users can operate after administrator-assisted installation.

First run generates device identity, initializes/migrates database, launches onboarding, registers optional service securely, and performs hardware/backup tests.

## 4. Diagnostics screen

Show at minimum:

```text
Application version and build
Contract/schema version and compatibility
Database open, foreign-key and integrity state
Last reconciliation state
Last successful local backup
Last successful cloud backup and pending age
Configured backup destination/retention summary
Scanner/printer/drawer/labeler/scale status
Internet/service state without blocking local POS
Installation/device identity
Safe log/support-bundle action
```

Never display or export secrets. Support bundles minimize customer data and require client action/consent.

## 5. Update process

1. Obtain a signed/authenticated update package.
2. Verify platform/build/schema compatibility and available disk space.
3. Notify/coordinate restart outside active critical workflow.
4. Close/finish active transactions and create verified pre-update/pre-migration backup.
5. Install application update.
6. On first launch, run protected migration sequence and integrity/reconciliation smoke checks.
7. Record evidence and launch.

Do not auto-update in the middle of an open transaction or silently migrate while a cashier is selling.

## 6. Failure recovery

- Package verification/install failure leaves prior working version/data intact where installer technology permits.
- Migration failure blocks normal operation and exposes controlled recovery/support guidance.
- Never repeatedly rerun an unknown partial migration without inspecting migration state.
- Recovery uses the verified pre-upgrade backup when forward repair is unsafe.
- Keep installer/version compatibility records so restored older databases are handled deliberately.

## 7. Client handoff package

- Installed and verified production build.
- Supported PC/device and hardware configuration record.
- Client super-admin ownership/recovery process.
- Quick-start cashier guide and admin/backup/restore guide.
- Backup retention/service agreement and data ownership/export terms.
- Release notes, known accepted limitations, support contacts/SLA if purchased.
- UAT evidence and sign-off.
- Recovery drill record and last verified backup identifiers.

## 8. Post-go-live plan

Use a defined stabilization period. Track actual backup health, device errors, performance, stock/report reconciliation, user questions, and defects. Operational support does not authorize unlogged remote access or direct database edits. Any emergency data correction uses a reviewed, backed-up, auditable procedure.
