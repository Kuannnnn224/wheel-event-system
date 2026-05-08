import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AdminUser } from './entities/admin-user.entity';

export interface AdminJwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    const username = this.configService.get<string>('ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>('ADMIN_PASSWORD', 'admin123');
    const existing = await this.adminUserRepository.findOne({ where: { username } });

    if (!existing) {
      await this.adminUserRepository.save({
        username,
        passwordHash: await bcrypt.hash(password, 10),
        isActive: true,
      });
    }
  }

  async login(username: string, password: string) {
    const admin = await this.adminUserRepository.findOne({ where: { username, isActive: true } });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const payload: AdminJwtPayload = { sub: admin.id, username: admin.username };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin: {
        id: admin.id,
        username: admin.username,
      },
    };
  }
}
