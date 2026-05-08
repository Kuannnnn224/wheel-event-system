import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';
import { Player } from '../../players/entities/player.entity';
import { SpinRecord } from '../../spins/entities/spin-record.entity';

export type AwardOverrideStatus = 'pending' | 'consumed' | 'cancelled';

@Entity({ name: 'award_override_rules', comment: '後控指定派獎規則，指定玩家當日特定階段走 prize 機率表' })
export class AwardOverrideRule {
  @PrimaryGeneratedColumn('uuid', { comment: '指定派獎規則 UUID' })
  id: string;

  @Index()
  @Column({ name: 'player_id', comment: '關聯 players.id' })
  playerId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10, comment: '指定派獎生效業務日期，依部署業務時區計算的 YYYY-MM-DD' })
  businessDate: string;

  @Column({ name: 'stage_number', type: 'tinyint', unsigned: true, comment: '指定派獎階段，1 到 5' })
  stageNumber: number;

  @Index()
  @Column({ length: 20, default: 'pending', comment: '規則狀態：pending、consumed、cancelled' })
  status: AwardOverrideStatus;

  @Index({ unique: true })
  @Column({ name: 'pending_key', type: 'varchar', length: 180, nullable: true, comment: 'pending 狀態唯一鍵，格式 playerId:businessDate:stageNumber' })
  pendingKey?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '指定派獎原因或備註' })
  reason?: string | null;

  @Column({ name: 'created_by_admin_id', type: 'varchar', length: 36, nullable: true, comment: '建立規則的 admin_users.id' })
  createdByAdminId?: string | null;

  @Column({ name: 'cancelled_by_admin_id', type: 'varchar', length: 36, nullable: true, comment: '取消規則的 admin_users.id' })
  cancelledByAdminId?: string | null;

  @Column({ name: 'consumed_spin_record_id', type: 'varchar', length: 36, nullable: true, comment: '消耗此規則的 spin_records.id' })
  consumedSpinRecordId?: string | null;

  @ManyToOne(() => SpinRecord, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'consumed_spin_record_id' })
  consumedSpinRecord?: SpinRecord | null;

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: '規則建立 Unix timestamp 秒數' })
  createdAt: number;

  @Column({ name: 'updated_at', type: 'int', unsigned: true, comment: '規則最後更新 Unix timestamp 秒數' })
  updatedAt: number;

  @Column({ name: 'consumed_at', type: 'int', unsigned: true, nullable: true, comment: '規則消耗 Unix timestamp 秒數' })
  consumedAt?: number | null;

  @Column({ name: 'cancelled_at', type: 'int', unsigned: true, nullable: true, comment: '規則取消 Unix timestamp 秒數' })
  cancelledAt?: number | null;

  @BeforeInsert()
  setCreateTimestamps() {
    const now = unixTimestampSeconds();
    this.createdAt ??= now;
    this.updatedAt ??= now;
  }

  @BeforeUpdate()
  setUpdateTimestamp() {
    this.updatedAt = unixTimestampSeconds();
  }
}
