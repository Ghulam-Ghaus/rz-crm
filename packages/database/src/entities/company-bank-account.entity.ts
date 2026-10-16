import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('company_bank_accounts')
export class CompanyBankAccountEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  @Index('idx_bank_account_store_id')
  storeId!: number;

  @Column({ name: 'bank_name', type: 'varchar', length: 100 })
  bankName!: string;

  @Column({ name: 'account_title', type: 'varchar', length: 150 })
  accountTitle!: string;

  @Column({ name: 'account_number', type: 'varchar', length: 50 })
  accountNumber!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  iban!: string | null;

  @Column({ name: 'branch_name', type: 'varchar', length: 100, nullable: true })
  branchName!: string | null;

  @Column({ name: 'opening_balance_minor_units', type: 'integer', default: 0 })
  openingBalanceMinorUnits!: number;

  @Column({ name: 'current_balance_minor_units', type: 'integer', default: 0 })
  currentBalanceMinorUnits!: number;

  @Column({ name: 'is_active', type: 'integer', default: 1 })
  isActive!: number;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
