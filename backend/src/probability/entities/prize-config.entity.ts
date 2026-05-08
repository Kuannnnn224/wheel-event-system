import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StageConfig } from './stage-config.entity';

@Entity('prize_configs')
export class PrizeConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'stage_number', type: 'tinyint', unsigned: true })
  stageNumber: number;

  @ManyToOne(() => StageConfig, (stage) => stage.prizes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_number', referencedColumnName: 'stageNumber' })
  stageConfig: StageConfig;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'int', unsigned: true })
  weight: number;

  @Column({ name: 'amount_points', type: 'int', unsigned: true, default: 0 })
  amountPoints: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
