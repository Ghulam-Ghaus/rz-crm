# Backup, Restore, and Managed Service Control

## 1. Objectives

Protect the bakery against device failure, corruption, bad upgrades, accidental deletion, ransomware impact, and loss of the installation while preserving offline POS operation and client data rights.

Use independent layers:

1. Live local SQLite database.
2. Automatic local backups on a separate configured destination where possible.
3. Encrypted cloud backup copies when the managed service is enabled.

Sync is not backup. A synchronized corrupt/deleted file can spread the damage.

## 2. Backup schedule

Baseline policy, configurable during client agreement:

- Automatic daily local backup.
- Pre-migration backup before every schema upgrade.
- Manual “Back up now.”
- Cloud queue after a verified eligible local backup.
- Retention tiers such as recent daily/weekly/monthly generations; exact periods are contractual/configurable.

Do not retain only the newest backup.

## 3. Safe SQLite backup

Use SQLite's supported online backup API or a coordinated snapshot/checkpoint approach validated with WAL mode. Never assume copying only the main `.db` file during active writes is complete.

For each backup:

1. Allocate a non-colliding destination and manifest.
2. Create a consistent snapshot without blocking POS longer than the agreed budget.
3. Run/record integrity verification on the snapshot.
4. Calculate a strong checksum and record byte size.
5. Record app version, schema version, installation/store identity, creation time, encryption/key version, and status.
6. Apply retention only after the new backup is verified.

## 4. Cloud backup

- Encrypt before or during upload with per-client/per-installation key separation.
- Use TLS, private storage, short-lived scoped credentials, object/version isolation, checksums, and server-side retention controls where available.
- Desktop never contains a provider-wide master credential.
- Upload jobs retry when internet returns and do not block transactions.
- A success state requires remote completion plus checksum/metadata verification, not merely an HTTP response.
- Display last successful local backup, last successful cloud backup, pending age, failures, and retention health.

## 5. Restore workflow

Restore is destructive to the current live state and requires client-super-admin permission, reauthentication, reason, and confirmation.

1. Close/lock operational screens and active commands.
2. Inspect selected backup manifest, identity, version, checksum, encryption, and compatibility.
3. Create a safety backup of current database when it is readable.
4. Restore to a temporary location.
5. Verify checksum, decrypt, run SQLite integrity/foreign-key checks, and validate schema compatibility.
6. Migrate the restored copy if required under the normal protected migration procedure.
7. Atomically activate the validated copy and preserve the replaced database for rollback/recovery.
8. Reopen, run reconciliation, record restore audit/evidence, and require user verification.

Do not overwrite the live database before validating the restore candidate.

## 6. Required restore drills

- Restore yesterday's local backup.
- Restore a cloud backup on the original PC.
- Reinstall/replace PC and restore with authorized device re-registration.
- Recover from a missing/corrupt database.
- Reject corrupt, tampered, wrong-client, unsupported-version, and wrong-key backup files.
- Recover from failed migration using the pre-upgrade backup.

A backup feature is not complete until these drills pass.

## 7. Service and license model

For the agreed one-time installation:

- Perpetual local operational entitlement for the licensed device/store unless the sales contract says otherwise.
- Optional recurring cloud backup, support, upgrades, extra devices, or new modules.
- Service check-in uses signed entitlement data and a reasonable offline grace period where subscription features exist.
- Internet loss never disables local POS.
- Expired optional service stops new cloud/service benefits after policy/grace; it does not block login, reports, data export, local backup, or access to existing client data.

Future monthly subscription customers may use active/past-due/suspended states, but operational lock behavior must be explicit and must not trap data.

## 8. Provider administration

Provider dashboard may manage client identity, plan/service state, registered devices, app version, last check-in, and backup health. It does not grant silent database access. Support access to business records is client-authorized, time-limited, least-privilege, visible, and audited.

## 9. Recovery material and key ownership

Before launch, decide contractually:

- Who owns encryption keys and how keys are recovered/rotated.
- What happens if the provider closes or the service ends.
- Client export/backup handoff process.
- Retention and deletion after termination.
- Support identity verification for device replacement.

If losing one provider secret makes all client backups unrecoverable, the design is not production-ready.
