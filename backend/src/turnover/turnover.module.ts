import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersModule } from '../players/players.module';
import { ProbabilityModule } from '../probability/probability.module';
import { TurnoverAdjustment } from './entities/turnover-adjustment.entity';
import { TurnoverController } from './turnover.controller';
import { TurnoverService } from './turnover.service';

@Module({
  imports: [TypeOrmModule.forFeature([TurnoverAdjustment]), PlayersModule, ProbabilityModule],
  controllers: [TurnoverController],
  providers: [TurnoverService],
  exports: [TurnoverService],
})
export class TurnoverModule {}
