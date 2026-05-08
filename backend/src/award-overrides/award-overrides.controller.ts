import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/auth.service';
import { AwardOverridesService } from './award-overrides.service';
import { CreateAwardOverridesDto } from './dto/create-award-overrides.dto';

type RequestWithAdmin = Request & { admin?: AdminJwtPayload };

@Controller('award-overrides')
export class AwardOverridesController {
  constructor(private readonly awardOverridesService: AwardOverridesService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('externalId') externalId?: string) {
    return {
      rules: await this.awardOverridesService.list(status, externalId),
    };
  }

  @Post()
  async create(@Body() dto: CreateAwardOverridesDto, @Req() request: RequestWithAdmin) {
    return {
      rules: await this.awardOverridesService.create(dto, request.admin?.sub),
    };
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() request: RequestWithAdmin) {
    return {
      rule: await this.awardOverridesService.cancel(id, request.admin?.sub),
    };
  }
}
