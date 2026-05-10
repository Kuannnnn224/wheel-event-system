import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { resolveCurrentBusinessDate } from '../common/business-date';
import { unixTimestampSeconds } from '../common/unix-timestamp';
import { Player } from '../players/entities/player.entity';
import { PlayersService } from '../players/players.service';
import { ProbabilityService } from '../probability/probability.service';
import { DemoSession } from './entities/demo-session.entity';

interface WebviewUrlContext {
  origin?: string;
  referer?: string;
}

@Injectable()
export class DemoTokenService {
  constructor(
    @InjectRepository(DemoSession)
    private readonly demoSessionRepository: Repository<DemoSession>,
    private readonly configService: ConfigService,
    private readonly playersService: PlayersService,
    private readonly probabilityService: ProbabilityService,
  ) {}

  async createSession(externalId: string, context: WebviewUrlContext = {}) {
    const player = await this.playersService.getOrCreateByExternalId(externalId);
    const token = randomBytes(32).toString('hex');
    const ttlMinutes = Number(this.configService.get<string>('DEMO_TOKEN_TTL_MINUTES', '30'));
    const expiresAt = unixTimestampSeconds() + ttlMinutes * 60;

    const session = await this.demoSessionRepository.save(
      this.demoSessionRepository.create({
        playerId: player.id,
        player,
        token,
        expiresAt,
      }),
    );
    const baseUrl = this.resolveWebviewBaseUrl(context);
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
    return (await this.findValidSession(token)).player;
  }

  getClientConfig() {
    return {
      apiBaseUrl: this.resolveWebviewApiBaseUrl(),
    };
  }

  async getSessionState(token: string, date?: string) {
    const session = await this.findValidSession(token);
    const businessDate = resolveCurrentBusinessDate(date);
    const [progress, stages] = await Promise.all([
      this.playersService.getDailyProgress(session.playerId, businessDate),
      this.probabilityService.getStages(),
    ]);

    return {
      player: session.player,
      expiresAt: session.expiresAt,
      businessDate,
      progress,
      stages,
    };
  }

  private resolveWebviewBaseUrl(context: WebviewUrlContext) {
    const configuredBaseUrl = this.configService.get<string>('WEBVIEW_BASE_URL')?.trim();
    if (configuredBaseUrl) {
      return configuredBaseUrl;
    }

    const requestOrigin = this.resolveRequestOrigin(context);
    if (requestOrigin) {
      return new URL('/webview.html', requestOrigin).toString();
    }

    return 'http://localhost:5173/webview.html';
  }

  private resolveWebviewApiBaseUrl() {
    return this.configService.get<string>('WEBVIEW_API_BASE_URL')?.trim() || '/api';
  }

  private resolveRequestOrigin(context: WebviewUrlContext) {
    const origin = this.normalizeOrigin(context.origin);
    if (origin) {
      return origin;
    }

    if (!context.referer) {
      return undefined;
    }

    try {
      return new URL(context.referer).origin;
    } catch {
      return undefined;
    }
  }

  private normalizeOrigin(origin?: string) {
    if (!origin) {
      return undefined;
    }

    try {
      return new URL(origin).origin;
    } catch {
      return undefined;
    }
  }

  private async findValidSession(token: string) {
    const session = await this.demoSessionRepository.findOne({
      where: { token },
      relations: { player: true },
    });

    if (!session) {
      throw new NotFoundException('Demo session not found.');
    }

    if (session.expiresAt <= unixTimestampSeconds()) {
      throw new UnauthorizedException('Demo session expired.');
    }

    return session;
  }
}
