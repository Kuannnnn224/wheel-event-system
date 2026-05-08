import { Controller, ForbiddenException, Get, Put } from '@nestjs/common';
import { ProbabilityService } from './probability.service';

@Controller('probability')
export class ProbabilityController {
  constructor(private readonly probabilityService: ProbabilityService) {}

  @Get('stages')
  getStages() {
    return this.probabilityService.getStages();
  }

  @Put('stages')
  updateStages() {
    throw new ForbiddenException('機率設定只能透過機率表 ZIP 匯入，不允許手動更新。');
  }
}
