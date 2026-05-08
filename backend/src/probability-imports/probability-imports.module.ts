import { Module } from '@nestjs/common';
import { ProbabilityModule } from '../probability/probability.module';
import { ProbabilityImportsController } from './probability-imports.controller';
import { ProbabilityImportsService } from './probability-imports.service';

@Module({
  imports: [ProbabilityModule],
  controllers: [ProbabilityImportsController],
  providers: [ProbabilityImportsService],
})
export class ProbabilityImportsModule {}
