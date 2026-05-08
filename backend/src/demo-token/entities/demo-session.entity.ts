import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';
import { Player } from '../../players/entities/player.entity';

@Entity({ name: 'demo_sessions', comment: 'Demo webview session 與短效 token' })
export class DemoSession {
  @PrimaryGeneratedColumn('uuid', { comment: 'Demo session UUID' })
  id: string;

  @Index()
  @Column({ name: 'player_id', comment: '關聯 players.id' })
  playerId: string;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Index({ unique: true })
  @Column({ length: 128, comment: '給 webview 使用的短效 token' })
  token: string;

  @Column({ name: 'expires_at', type: 'int', unsigned: true, comment: 'token 過期 Unix timestamp 秒數' })
  expiresAt: number;

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: 'session 建立 Unix timestamp 秒數' })
  createdAt: number;

  @BeforeInsert()
  setCreateTimestamp() {
    this.createdAt ??= unixTimestampSeconds();
  }
}
