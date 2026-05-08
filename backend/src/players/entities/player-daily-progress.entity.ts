import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Player } from './player.entity';

@Entity('player_daily_progress')
@Unique(['playerId', 'businessDate'])
export class PlayerDailyProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'player_id' })
  playerId: string;

  @ManyToOne(() => Player, (player) => player.dailyProgress, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10 })
  businessDate: string;

  @Column({ name: 'turnover_points', type: 'int', unsigned: true, default: 0 })
  turnoverPoints: number;

  @Column({ name: 'unlocked_stage', type: 'tinyint', unsigned: true, default: 0 })
  unlockedStage: number;
}
