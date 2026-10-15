import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('installations')
export class InstallationEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'device_id', type: 'varchar', length: 100, unique: true })
  deviceId!: string;

  @Column({ name: 'store_id', type: 'integer', nullable: true })
  storeId!: number | null;

  @Column({ name: 'app_version', type: 'varchar', length: 50 })
  appVersion!: string;

  @Column({ name: 'install_state', type: 'varchar', length: 50, default: 'pending_onboarding' })
  installState!: string;

  @Column({ name: 'registered_at_utc', type: 'varchar', length: 35, nullable: true })
  registeredAtUtc!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
