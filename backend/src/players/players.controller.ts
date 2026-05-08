import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlayersService } from './players.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  async search(@Query('externalId') externalId?: string, @Query('limit') limit?: string) {
    if (externalId) {
      return { player: await this.playersService.findByExternalId(externalId) };
    }

    return { players: await this.playersService.listPlayers(Number(limit ?? 50)) };
  }

  @Get(':id/daily-progress')
  getDailyProgress(@Param('id') id: string, @Query('date') date?: string) {
    return this.playersService.getDailyProgress(id, date);
  }
}
