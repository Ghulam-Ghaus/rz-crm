import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stakeholders')
export class StakeholderEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  storeId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName!: string;

  @Column({ name: 'cnic_or_tax_id', type: 'varchar', length: 50, nullable: true })
  cnicOrTaxId!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'stakeholder_type', type: 'varchar', length: 30, default: 'PARTNER' })
  stakeholderType!: 'OWNER' | 'PARTNER' | 'INVESTOR' | 'SILENT_PARTNER';

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE' | 'EXITED';

  @Column({ name: 'joined_date', type: 'varchar', length: 35 })
  joinedDate!: string;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
