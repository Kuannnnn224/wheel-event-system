import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { CreateDemoSessionDto } from './dto/create-demo-session.dto';
import { DemoTokenService } from './demo-token.service';

@Controller('demo')
export class DemoTokenController {
  constructor(private readonly demoTokenService: DemoTokenService) {}

  @Public()
  @Post('session')
  createSession(@Body() dto: CreateDemoSessionDto) {
    return this.demoTokenService.createSession(dto.externalId);
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
