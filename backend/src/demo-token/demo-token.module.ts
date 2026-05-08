import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayersModule } from '../players/players.module';
import { DemoTokenController } from './demo-token.controller';
import { DemoTokenService } from './demo-token.service';
import { DemoSession } from './entities/demo-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DemoSession]), PlayersModule],
  controllers: [DemoTokenController],
  providers: [DemoTokenService],
  exports: [DemoTokenService],
})
export class DemoTokenModule {}
