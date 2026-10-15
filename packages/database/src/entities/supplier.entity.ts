import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('suppliers')
export class SupplierEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'contact_person', type: 'varchar', length: 100, nullable: true })
  contactPerson!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email!: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 50, nullable: true })
  taxNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'payment_terms_days', type: 'integer', default: 0 })
  paymentTermsDays!: number;

  @Column({ name: 'credit_limit_minor_units', type: 'integer', default: 0 })
  creditLimitMinorUnits!: number;

  @Column({ name: 'outstanding_balance_minor_units', type: 'integer', default: 0 })
  outstandingBalanceMinorUnits!: number;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  isActive!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
