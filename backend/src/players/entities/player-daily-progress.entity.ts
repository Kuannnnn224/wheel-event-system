import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Player } from './player.entity';

@Entity({ name: 'player_daily_progress', comment: '玩家每日流水與階段解鎖進度' })
@Unique(['playerId', 'businessDate'])
export class PlayerDailyProgress {
  @PrimaryGeneratedColumn('uuid', { comment: '每日進度 UUID' })
  id: string;

  @Index()
  @Column({ name: 'player_id', comment: '關聯 players.id' })
  playerId: string;

  @ManyToOne(() => Player, (player) => player.dailyProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10, comment: '業務日期，Asia/Taipei YYYY-MM-DD' })
  businessDate: string;

  @Column({ name: 'turnover_points', type: 'int', unsigned: true, default: 0, comment: '當日累積流水點數' })
  turnoverPoints: number;

  @Column({ name: 'unlocked_stage', type: 'tinyint', unsigned: true, default: 0, comment: '當日已解鎖最高階段，0 表示尚未解鎖' })
  unlockedStage: number;
}
