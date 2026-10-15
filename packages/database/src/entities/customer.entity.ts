import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer' })
  storeId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'company_name', type: 'varchar', length: 150, nullable: true })
  companyName!: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 50, nullable: true })
  taxNumber!: string | null;

  @Column({ name: 'credit_limit_minor_units', type: 'integer', default: 0 })
  creditLimitMinorUnits!: number;

  @Column({ name: 'payment_terms_days', type: 'integer', default: 0 })
  paymentTermsDays!: number;

  @Column({ name: 'outstanding_balance_minor_units', type: 'integer', default: 0 })
  outstandingBalanceMinorUnits!: number;

  @Column({ name: 'customer_type', type: 'varchar', length: 20, default: 'retail' })
  customerType!: 'retail' | 'wholesale';

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
