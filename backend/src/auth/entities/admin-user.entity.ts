import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'admin_users', comment: '後控管理員帳號' })
export class AdminUser {
  @PrimaryGeneratedColumn('uuid', { comment: '管理員 UUID' })
  id: string;

  @Column({ unique: true, length: 80, comment: '管理員登入帳號' })
  username: string;

  @Column({ name: 'password_hash', length: 255, comment: '管理員密碼雜湊' })
  passwordHash: string;

  @Column({ name: 'is_active', default: true, comment: '帳號是否啟用' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', comment: '帳號建立時間' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '帳號最後更新時間' })
  updatedAt: Date;
}
