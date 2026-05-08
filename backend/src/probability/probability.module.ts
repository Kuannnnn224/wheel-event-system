import { Module } from '@nestjs/common';
import { ProbabilityController } from './probability.controller';
import { ProbabilityService } from './probability.service';

@Module({
  controllers: [ProbabilityController],
  providers: [ProbabilityService],
  exports: [ProbabilityService],
})
export class ProbabilityModule {}
