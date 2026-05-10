import { BadRequestException, Body, Controller, Get, Headers, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { CreateDemoSessionDto } from './dto/create-demo-session.dto';
import { DemoTokenService } from './demo-token.service';

@Controller('demo')
export class DemoTokenController {
  constructor(
    private readonly demoTokenService: DemoTokenService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('session')
  createSession(
    @Body() dto: CreateDemoSessionDto,
    @Headers('x-platform-api-key') apiKey: string | undefined,
    @Req() request: Request,
  ) {
    this.assertPlatformApiKey(apiKey);
    return this.demoTokenService.createSession(dto, {
      origin: request.headers.origin,
      referer: request.headers.referer,
    });
  }

  @Post('admin-session')
  createAdminSession(@Body() dto: CreateDemoSessionDto, @Req() request: Request) {
    return this.demoTokenService.createSession(dto, {
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
  getSession(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('token is required.');
    }

    return this.demoTokenService.getSessionState(token);
  }

  private assertPlatformApiKey(apiKey?: string) {
    const expectedApiKey = this.configService.get<string>('PLATFORM_API_KEY')?.trim();

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      throw new UnauthorizedException('Invalid platform API key.');
    }
  }
}
