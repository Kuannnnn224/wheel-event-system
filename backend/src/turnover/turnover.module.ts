import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TurnoverAdjustment } from './entities/turnover-adjustment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TurnoverAdjustment])],
})
export class TurnoverModule {}
