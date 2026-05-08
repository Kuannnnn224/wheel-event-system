import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
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

  @Column({ name: 'expires_at', comment: 'token 過期時間' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', comment: 'session 建立時間' })
  createdAt: Date;
}
