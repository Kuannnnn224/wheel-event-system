import { BadRequestException, Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { CreateDemoSessionDto } from './dto/create-demo-session.dto';
import { DemoTokenService } from './demo-token.service';

@Controller('demo')
export class DemoTokenController {
  constructor(private readonly demoTokenService: DemoTokenService) {}

  @Public()
  @Post('session')
  createSession(@Body() dto: CreateDemoSessionDto, @Req() request: Request) {
    return this.demoTokenService.createSession(dto.externalId, {
      origin: request.headers.origin,
      referer: request.headers.referer,
    });
  }

  @Public()
  @Get('client-config')
  getClientConfig() {
    return this.demoTokenService.getClientConfig();
  }

  @Public()
  @Get('session')
  getSession(@Query('token') token: string, @Query('date') date?: string) {
    if (!token) {
      throw new BadRequestException('token is required.');
    }

    return this.demoTokenService.getSessionState(token, date);
  }
}
