import { Body, Controller, Param, Post } from '@nestjs/common';
import { AddTurnoverAdjustmentDto } from './dto/add-turnover-adjustment.dto';
import { TurnoverService } from './turnover.service';

@Controller('players/:playerId/turnover-adjustments')
export class TurnoverController {
  constructor(private readonly turnoverService: TurnoverService) {}

  @Post()
  addAdjustment(@Param('playerId') playerId: string, @Body() dto: AddTurnoverAdjustmentDto) {
    return this.turnoverService.addAdjustment(playerId, dto);
  }
}
