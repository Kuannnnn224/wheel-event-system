import { Body, Controller, Get, Put } from '@nestjs/common';
import { UpdateStagesDto } from './dto/update-stages.dto';
import { ProbabilityService } from './probability.service';

@Controller('probability')
export class ProbabilityController {
  constructor(private readonly probabilityService: ProbabilityService) {}

  @Get('stages')
  getStages() {
    return this.probabilityService.getStages();
  }

  @Put('stages')
  updateStages(@Body() dto: UpdateStagesDto) {
    return this.probabilityService.updateStages(dto);
  }
}
