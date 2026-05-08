import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PrizeConfig } from './prize-config.entity';

@Entity('stage_configs')
export class StageConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'stage_number', type: 'tinyint', unsigned: true, unique: true })
  stageNumber: number;

  @Column({ name: 'turnover_threshold_points', type: 'int', unsigned: true })
  turnoverThresholdPoints: number;

  @Column({ default: true })
  enabled: boolean;

  @OneToMany(() => PrizeConfig, (prize) => prize.stageConfig)
  prizes: PrizeConfig[];
}
