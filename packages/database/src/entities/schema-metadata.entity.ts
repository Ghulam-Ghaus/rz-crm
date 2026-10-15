import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('schema_metadata')
export class SchemaMetadataEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'schema_version', type: 'varchar', length: 50 })
  schemaVersion!: string;

  @Column({ name: 'app_version', type: 'varchar', length: 50 })
  appVersion!: string;

  @Column({ name: 'installed_at_utc', type: 'varchar', length: 35 })
  installedAtUtc!: string;

  @Column({ name: 'last_checked_at_utc', type: 'varchar', length: 35 })
  lastCheckedAtUtc!: string;
}
