import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateSimulationDto } from './dto/create-simulation.dto';
import { SimulationsService } from './simulations.service';

@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulationsService: SimulationsService) {}

  @Post()
  create(@Body() dto: CreateSimulationDto) {
    return this.simulationsService.createJob(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.simulationsService.getJob(id);
  }
}
