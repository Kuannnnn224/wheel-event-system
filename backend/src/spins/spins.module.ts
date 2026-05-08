import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AwardOverridesModule } from '../award-overrides/award-overrides.module';
import { DemoTokenModule } from '../demo-token/demo-token.module';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { ProbabilityModule } from '../probability/probability.module';
import { SpinRecord } from './entities/spin-record.entity';
import { SpinsController } from './spins.controller';
import { SpinsService } from './spins.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpinRecord, PlayerDailyProgress]), ProbabilityModule, DemoTokenModule, AwardOverridesModule],
  controllers: [SpinsController],
  providers: [SpinsService],
  exports: [SpinsService],
})
export class SpinsModule {}
