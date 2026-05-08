import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { unixTimestampSeconds } from '../../common/unix-timestamp';

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

  @Column({ name: 'created_at', type: 'int', unsigned: true, comment: '帳號建立 Unix timestamp 秒數' })
  createdAt: number;

  @Column({ name: 'updated_at', type: 'int', unsigned: true, comment: '帳號最後更新 Unix timestamp 秒數' })
  updatedAt: number;

  @BeforeInsert()
  setCreateTimestamps() {
    const now = unixTimestampSeconds();
    this.createdAt ??= now;
    this.updatedAt ??= now;
  }

  @BeforeUpdate()
  setUpdateTimestamp() {
    this.updatedAt = unixTimestampSeconds();
  }
}
