import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { PlayersModule } from '../players/players.module';
import { ProbabilityModule } from '../probability/probability.module';
import { SpinRecord } from '../spins/entities/spin-record.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpinRecord, PlayerDailyProgress]), PlayersModule, ProbabilityModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
