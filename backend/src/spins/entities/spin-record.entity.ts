import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';
import { Player } from '../../players/entities/player.entity';

@Entity({ name: 'spin_records', comment: '真實抽獎紀錄，每位玩家每日每階段最多一筆' })
@Unique(['playerId', 'businessDate', 'stageNumber'])
export class SpinRecord {
  @PrimaryGeneratedColumn('uuid', { comment: '抽獎紀錄 UUID' })
  id: string;

  @Index()
  @Column({ name: 'player_id', comment: '關聯 players.id' })
  playerId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index()
  @Column({ name: 'business_date', length: 10, comment: '抽獎業務日期，Asia/Taipei YYYY-MM-DD' })
  businessDate: string;

  @Column({ name: 'stage_number', type: 'tinyint', unsigned: true, comment: '抽獎階段，1 到 5' })
  stageNumber: number;

  @Column({ name: 'probability_table', length: 10, default: 'low', comment: '本次命中的機率分流表，low 或 high' })
  probabilityTable: string;

  @Column({ name: 'prize_config_id', nullable: true, comment: '獎項設定識別，JSON 設定來源時可為空' })
  prizeConfigId?: number;

  @Column({ name: 'prize_name', length: 120, comment: '抽中的獎項名稱快照' })
  prizeName: string;

  @Column({ name: 'amount_points', type: 'int', unsigned: true, default: 0, comment: '本次送出的獎金點數，0 可代表未中獎' })
  amountPoints: number;

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: '抽獎建立 Unix timestamp 秒數' })
  createdAt: number;

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt ??= unixTimestampSeconds();
  }
}
