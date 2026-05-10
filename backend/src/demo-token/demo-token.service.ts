import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { resolveCurrentBusinessDate } from '../common/business-date';
import { unixTimestampSeconds } from '../common/unix-timestamp';
import { calculateUnlockedStage } from '../domain/stage-progress';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { Player } from '../players/entities/player.entity';
import { PlayersService } from '../players/players.service';
import type { ProbabilityStageConfig } from '../probability/probability-config.types';
import { ProbabilityService } from '../probability/probability.service';
import { CreateDemoSessionDto } from './dto/create-demo-session.dto';
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
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly playersService: PlayersService,
    private readonly probabilityService: ProbabilityService,
  ) {}

  async createSession(dto: CreateDemoSessionDto, context: WebviewUrlContext = {}) {
    const player = await this.playersService.getOrCreateByExternalId(dto.externalId);
    const businessDate = resolveCurrentBusinessDate();
    const stageThresholds = await this.probabilityService.getStageThresholds();
    const token = randomBytes(32).toString('hex');
    const ttlMinutes = Number(this.configService.get<string>('DEMO_TOKEN_TTL_MINUTES', '30'));
    const expiresAt = unixTimestampSeconds() + ttlMinutes * 60;

    const session = await this.dataSource.transaction(async (manager) => {
      const progressRepository = manager.getRepository(PlayerDailyProgress);
      const demoSessionRepository = manager.getRepository(DemoSession);
      let progress = await progressRepository.findOne({
        where: { playerId: player.id, businessDate },
      });
      const turnoverPoints = Math.max(progress?.turnoverPoints ?? 0, dto.turnoverPoints);
      const unlockedStage = Math.max(
        progress?.unlockedStage ?? 0,
        calculateUnlockedStage(turnoverPoints, stageThresholds),
      );

      if (progress) {
        progress.turnoverPoints = turnoverPoints;
        progress.unlockedStage = unlockedStage;
      } else {
        progress = progressRepository.create({
          playerId: player.id,
          player,
          businessDate,
          turnoverPoints,
          unlockedStage,
        });
      }
      await progressRepository.save(progress);

      return demoSessionRepository.save(
        demoSessionRepository.create({
          playerId: player.id,
          player,
          token,
          expiresAt,
        }),
      );
    });
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

  async getSessionState(token: string) {
    const session = await this.findValidSession(token);
    const businessDate = resolveCurrentBusinessDate();
    const [progress, stages] = await Promise.all([
      this.playersService.getDailyProgress(session.playerId, businessDate),
      this.probabilityService.getStages(),
    ]);

    return {
      player: session.player,
      expiresAt: session.expiresAt,
      businessDate,
      progress: this.toPublicProgress(progress),
      stages: this.toPublicStages(stages),
    };
  }

  private toPublicProgress(progress: Awaited<ReturnType<PlayersService['getDailyProgress']>>) {
    return {
      player: progress.player,
      businessDate: progress.businessDate,
      turnoverPoints: progress.turnoverPoints,
      unlockedStage: progress.unlockedStage,
      playedStages: progress.playedStages,
      totalWinPoints: progress.totalWinPoints,
      spins: progress.spins.map((spin) => ({
        id: spin.id,
        businessDate: spin.businessDate,
        stageNumber: spin.stageNumber,
        prizeName: spin.prizeName,
        amountPoints: spin.amountPoints,
        createdAt: spin.createdAt,
      })),
    };
  }

  private toPublicStages(stages: ProbabilityStageConfig[]) {
    return stages.map((stage) => ({
      stageNumber: stage.stageNumber,
      turnoverThresholdPoints: stage.turnoverThresholdPoints,
      prizes: stage.prizes.map((prize) => ({
        rewardCode: prize.rewardCode,
        name: prize.name,
        amountPoints: prize.amountPoints,
        sortOrder: prize.sortOrder,
      })),
    }));
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
