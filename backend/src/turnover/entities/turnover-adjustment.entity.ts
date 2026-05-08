import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Player } from '../../players/entities/player.entity';

@Entity('turnover_adjustments')
export class TurnoverAdjustment {
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

  @Column({ name: 'amount_points', type: 'int', unsigned: true })
  amountPoints: number;

  @Column({ length: 40, default: 'admin' })
  source: string;

  @Column({ length: 255, nullable: true })
  reason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
