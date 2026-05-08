import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Player } from '../../players/entities/player.entity';

@Entity('spin_records')
@Unique(['playerId', 'businessDate', 'stageNumber'])
export class SpinRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'player_id' })
  playerId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10 })
  businessDate: string;

  @Column({ name: 'stage_number', type: 'tinyint', unsigned: true })
  stageNumber: number;

  @Column({ name: 'probability_table', length: 10, default: 'low' })
  probabilityTable: string;

  @Column({ name: 'prize_config_id', nullable: true })
  prizeConfigId?: number;

  @Column({ name: 'prize_name', length: 120 })
  prizeName: string;

  @Column({ name: 'amount_points', type: 'int', unsigned: true, default: 0 })
  amountPoints: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
