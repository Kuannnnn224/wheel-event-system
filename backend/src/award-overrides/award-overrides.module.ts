import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersModule } from '../players/players.module';
import { AwardOverridesController } from './award-overrides.controller';
import { AwardOverridesService } from './award-overrides.service';
import { AwardOverrideRule } from './entities/award-override-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AwardOverrideRule]), PlayersModule],
  controllers: [AwardOverridesController],
  providers: [AwardOverridesService],
  exports: [AwardOverridesService, TypeOrmModule],
})
export class AwardOverridesModule {}
