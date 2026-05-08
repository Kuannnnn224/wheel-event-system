import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PlayerDailyProgress } from './player-daily-progress.entity';

@Entity({ name: 'players', comment: '玩家主檔，保存平台玩家外部 ID 與建立時間' })
export class Player {
  @PrimaryGeneratedColumn('uuid', { comment: '系統內部玩家 UUID' })
  id: string;

  @Index({ unique: true })
  @Column({ name: 'external_id', length: 120, comment: '平台或外部系統的玩家 ID' })
  externalId: string;

  @CreateDateColumn({ name: 'created_at', comment: '玩家資料建立時間' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '玩家資料最後更新時間' })
  updatedAt: Date;

  @OneToMany(() => PlayerDailyProgress, (progress) => progress.player)
  dailyProgress: PlayerDailyProgress[];
}
