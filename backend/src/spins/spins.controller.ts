import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { RealSpinDto } from './dto/real-spin.dto';
import { SimulateSpinDto } from './dto/simulate-spin.dto';
import { SpinsService } from './spins.service';

@Controller('spins')
export class SpinsController {
  constructor(private readonly spinsService: SpinsService) {}

  @Post('simulate')
  simulate(@Body() dto: SimulateSpinDto) {
    return this.spinsService.simulate(dto);
  }

  @Public()
  @Post('real')
  realSpin(@Body() dto: RealSpinDto) {
    return this.spinsService.realSpin(dto);
  }
}
