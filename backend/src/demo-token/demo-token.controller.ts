import { Body, Controller, Post } from '@nestjs/common';
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
}
