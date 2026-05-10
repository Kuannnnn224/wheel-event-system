import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';
import { Player } from '../../players/entities/player.entity';

@Entity({ name: 'turnover_adjustments', comment: '舊版流水異動紀錄，目前保留作為歷史資料相容' })
export class TurnoverAdjustment {
  @PrimaryGeneratedColumn('uuid', { comment: '流水異動 UUID' })
  id: string;

  @Index()
  @Column({ name: 'player_id', comment: '關聯 players.id' })
  playerId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10, comment: '套用流水的業務日期，依部署業務時區計算的 YYYY-MM-DD' })
  businessDate: string;

  @Column({ name: 'amount_points', type: 'int', unsigned: true, comment: '舊版本次新增流水點數' })
  amountPoints: number;

  @Column({ length: 40, default: 'admin', comment: '流水來源，例如 admin 或 platform' })
  source: string;

  @Column({ length: 255, nullable: true, comment: '異動原因或備註' })
  reason?: string;

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: '異動建立 Unix timestamp 秒數' })
  createdAt: number;

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt ??= unixTimestampSeconds();
  }
}
