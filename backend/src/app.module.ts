import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { DemoTokenModule } from './demo-token/demo-token.module';
import { PlayersModule } from './players/players.module';
import { ProbabilityModule } from './probability/probability.module';
import { ReportsModule } from './reports/reports.module';
import { SimulationsModule } from './simulations/simulations.module';
import { SpinsModule } from './spins/spins.module';
import { TurnoverModule } from './turnover/turnover.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'wheel_app'),
        password: config.get<string>('DB_PASSWORD', 'wheel_password'),
        database: config.get<string>('DB_DATABASE', 'wheel_event'),
        autoLoadEntities: true,
        synchronize: config.get<string>('TYPEORM_SYNC', 'true') === 'true',
        timezone: 'Z',
      }),
    }),
    AuthModule,
    PlayersModule,
    ProbabilityModule,
    TurnoverModule,
    SpinsModule,
    ReportsModule,
    SimulationsModule,
    DemoTokenModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
