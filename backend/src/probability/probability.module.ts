import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrizeConfig } from './entities/prize-config.entity';
import { StageConfig } from './entities/stage-config.entity';
import { ProbabilityController } from './probability.controller';
import { ProbabilityService } from './probability.service';

@Module({
  imports: [TypeOrmModule.forFeature([StageConfig, PrizeConfig])],
  controllers: [ProbabilityController],
  providers: [ProbabilityService],
  exports: [ProbabilityService],
})
export class ProbabilityModule {}
