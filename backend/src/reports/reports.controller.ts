import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  getDaily(@Query('date') date: string) {
    return this.reportsService.getDailyReport(date);
  }

  @Get('range')
  getRange(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportsService.getRangeReport(startDate, endDate);
  }

  @Get('player')
  getPlayer(@Query('externalId') externalId: string, @Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.reportsService.getPlayerReport(externalId, startDate, endDate);
  }
}
