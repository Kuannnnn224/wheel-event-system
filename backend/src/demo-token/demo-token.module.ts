import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersModule } from '../players/players.module';
import { ProbabilityModule } from '../probability/probability.module';
import { DemoTokenController } from './demo-token.controller';
import { DemoTokenService } from './demo-token.service';
import { DemoSession } from './entities/demo-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DemoSession]), PlayersModule, ProbabilityModule],
  controllers: [DemoTokenController],
  providers: [DemoTokenService],
  exports: [DemoTokenService],
})
export class DemoTokenModule {}
