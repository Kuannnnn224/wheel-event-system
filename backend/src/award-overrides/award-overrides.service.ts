import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { resolveCurrentBusinessDate } from '../common/business-date';
import { unixTimestampSeconds } from '../common/unix-timestamp';
import { PlayersService } from '../players/players.service';
import { SpinRecord } from '../spins/entities/spin-record.entity';
import { CreateAwardOverridesDto } from './dto/create-award-overrides.dto';
import { AwardOverrideRule, AwardOverrideStatus } from './entities/award-override-rule.entity';

const AWARD_OVERRIDE_STATUSES: AwardOverrideStatus[] = ['pending', 'consumed', 'cancelled'];

@Injectable()
export class AwardOverridesService {
  constructor(
    @InjectRepository(AwardOverrideRule)
    private readonly awardOverrideRepository: Repository<AwardOverrideRule>,
    private readonly dataSource: DataSource,
    private readonly playersService: PlayersService,
  ) {}

  async list(status = 'pending', externalId?: string) {
    const normalizedStatus = this.assertStatus(status);
    const businessDate = resolveCurrentBusinessDate();
    let playerId: string | undefined;

    if (externalId) {
      const player = await this.playersService.findByExternalId(externalId);
      if (!player) {
        return [];
      }
      playerId = player.id;
    }

    return this.awardOverrideRepository.find({
      where: {
        businessDate,
        status: normalizedStatus,
        ...(playerId ? { playerId } : {}),
      },
      relations: { player: true },
      order: { createdAt: 'DESC', stageNumber: 'ASC' },
    });
  }

  async create(dto: CreateAwardOverridesDto, adminId?: string) {
    const player = await this.playersService.findByExternalId(dto.externalId);

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    const stageNumbers = this.normalizeStageNumbers(dto.stageNumbers);
    const businessDate = resolveCurrentBusinessDate();

    return this.dataSource.transaction(async (manager) => {
      const spinRepository = manager.getRepository(SpinRecord);
      const overrideRepository = manager.getRepository(AwardOverrideRule);

      const existingSpins = await spinRepository.find({
        where: {
          playerId: player.id,
          businessDate,
          stageNumber: In(stageNumbers),
        },
      });

      if (existingSpins.length > 0) {
        const playedStages = existingSpins.map((spin) => spin.stageNumber).sort((a, b) => a - b);
        throw new BadRequestException(`Stage ${playedStages.join(', ')} already has spin records for today.`);
      }

      const pendingKeys = stageNumbers.map((stageNumber) => this.buildPendingKey(player.id, businessDate, stageNumber));
      const existingRules = await overrideRepository.find({ where: { pendingKey: In(pendingKeys) } });

      if (existingRules.length > 0) {
        const duplicatedStages = existingRules.map((rule) => rule.stageNumber).sort((a, b) => a - b);
        throw new BadRequestException(`Stage ${duplicatedStages.join(', ')} already has pending award override.`);
      }

      const rules = stageNumbers.map((stageNumber) =>
        overrideRepository.create({
          player,
          playerId: player.id,
          businessDate,
          stageNumber,
          status: 'pending',
          pendingKey: this.buildPendingKey(player.id, businessDate, stageNumber),
          reason: dto.reason,
          createdByAdminId: adminId,
        }),
      );

      return overrideRepository.save(rules);
    });
  }

  async cancel(id: string, adminId?: string) {
    const businessDate = resolveCurrentBusinessDate();
    const rule = await this.awardOverrideRepository.findOne({
      where: { id, businessDate, status: 'pending' },
      relations: { player: true },
    });

    if (!rule) {
      throw new NotFoundException('Pending award override not found.');
    }

    rule.status = 'cancelled';
    rule.pendingKey = null;
    rule.cancelledByAdminId = adminId;
    rule.cancelledAt = unixTimestampSeconds();

    return this.awardOverrideRepository.save(rule);
  }

  async findPendingForSpin(playerId: string, businessDate: string, stageNumber: number, manager?: EntityManager) {
    const repository = this.getRepository(manager);
    return repository.findOne({
      where: {
        playerId,
        businessDate,
        stageNumber,
        status: 'pending',
      },
    });
  }

  async consume(rule: AwardOverrideRule, spinRecordId: string, manager?: EntityManager) {
    const repository = this.getRepository(manager);
    rule.status = 'consumed';
    rule.pendingKey = null;
    rule.consumedSpinRecordId = spinRecordId;
    rule.consumedAt = unixTimestampSeconds();
    return repository.save(rule);
  }

  private getRepository(manager?: EntityManager) {
    return manager ? manager.getRepository(AwardOverrideRule) : this.awardOverrideRepository;
  }

  private normalizeStageNumbers(stageNumbers: number[]) {
    const normalized = [...stageNumbers].sort((a, b) => a - b);

    if (new Set(normalized).size !== normalized.length) {
      throw new BadRequestException('stageNumbers cannot contain duplicates.');
    }

    for (const stageNumber of normalized) {
      if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 5) {
        throw new BadRequestException('stageNumbers must be integers between 1 and 5.');
      }
    }

    return normalized;
  }

  private buildPendingKey(playerId: string, businessDate: string, stageNumber: number) {
    return `${playerId}:${businessDate}:${stageNumber}`;
  }

  private assertStatus(status: string): AwardOverrideStatus {
    if (!AWARD_OVERRIDE_STATUSES.includes(status as AwardOverrideStatus)) {
      throw new BadRequestException('Invalid award override status.');
    }

    return status as AwardOverrideStatus;
  }
}
