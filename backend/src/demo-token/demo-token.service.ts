import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Player } from '../players/entities/player.entity';
import { PlayersService } from '../players/players.service';
import { DemoSession } from './entities/demo-session.entity';

@Injectable()
export class DemoTokenService {
  constructor(
    @InjectRepository(DemoSession)
    private readonly demoSessionRepository: Repository<DemoSession>,
    private readonly configService: ConfigService,
    private readonly playersService: PlayersService,
  ) {}

  async createSession(externalId: string) {
    const player = await this.playersService.getOrCreateByExternalId(externalId);
    const token = randomBytes(32).toString('hex');
    const ttlMinutes = Number(this.configService.get<string>('DEMO_TOKEN_TTL_MINUTES', '30'));
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    const session = await this.demoSessionRepository.save(
      this.demoSessionRepository.create({
        playerId: player.id,
        player,
        token,
        expiresAt,
      }),
    );
    const baseUrl = this.configService.get<string>('WEBVIEW_BASE_URL', 'http://localhost:5173/webview.html');
    const url = new URL(baseUrl);
    url.searchParams.set('token', token);

    return {
      player,
      token: session.token,
      expiresAt: session.expiresAt,
      webviewUrl: url.toString(),
    };
  }

  async validateToken(token: string): Promise<Player> {
    const session = await this.demoSessionRepository.findOne({
      where: { token },
      relations: { player: true },
    });

    if (!session) {
      throw new NotFoundException('Demo session not found.');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Demo session expired.');
    }

    return session.player;
  }
}
