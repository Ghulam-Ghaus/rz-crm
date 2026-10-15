import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

export type UserRole = string;

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'store_id', type: 'integer', default: 1 })
  @Index('idx_users_store_id')
  storeId!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  @Index('idx_users_username')
  username!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ type: 'varchar', length: 50, default: 'cashier' })
  role!: UserRole;

  @Column({ name: 'permissions_json', type: 'text', nullable: true })
  permissionsJson!: string | null;

  @Column({ name: 'pin_hash', type: 'varchar', length: 128, nullable: true })
  pinHash!: string | null;

  @Column({ name: 'pin_salt', type: 'varchar', length: 64, nullable: true })
  pinSalt!: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 128, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'password_salt', type: 'varchar', length: 64, nullable: true })
  passwordSalt!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at_utc', type: 'varchar', length: 35, nullable: true })
  lastLoginAtUtc!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;

  @Column({ name: 'updated_at_utc', type: 'varchar', length: 35 })
  updatedAtUtc!: string;
}
