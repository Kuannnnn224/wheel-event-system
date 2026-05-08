import { BeforeInsert, BeforeUpdate, Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';
import { PlayerDailyProgress } from './player-daily-progress.entity';

@Entity({ name: 'players', comment: '玩家主檔，保存平台玩家外部 ID 與建立時間' })
export class Player {
  @PrimaryGeneratedColumn('uuid', { comment: '系統內部玩家 UUID' })
  id: string;

  @Index({ unique: true })
  @Column({ name: 'external_id', length: 120, comment: '平台或外部系統的玩家 ID' })
  externalId: string;

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: '玩家資料建立 Unix timestamp 秒數' })
  createdAt: number;

  @Column({ name: 'updated_at', type: 'int', unsigned: true, comment: '玩家資料最後更新 Unix timestamp 秒數' })
  updatedAt: number;

  @OneToMany(() => PlayerDailyProgress, (progress) => progress.player)
  dailyProgress: PlayerDailyProgress[];

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
