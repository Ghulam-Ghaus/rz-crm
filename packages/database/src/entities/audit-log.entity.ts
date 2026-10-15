import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ name: 'user_id', type: 'integer', nullable: true })
  @Index('idx_audit_user_id')
  userId!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  username!: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  resource!: string | null;

  @Column({ name: 'details_json', type: 'text', nullable: true })
  detailsJson!: string | null;

  @Column({ name: 'created_at_utc', type: 'varchar', length: 35 })
  createdAtUtc!: string;
}
