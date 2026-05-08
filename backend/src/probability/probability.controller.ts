import { Body, Controller, Get, Header, Param, Post, Put, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
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

  @Post('imports/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file: Express.Multer.File) {
    return this.probabilityService.previewImportZip(file);
  }

  @Post('imports/apply')
  applyImport(@Body('uploadId') uploadId: string) {
    return this.probabilityService.applyImportUpload(uploadId);
  }

  @Get('imports')
  getImports() {
    return this.probabilityService.listImportUploads();
  }

  @Get('imports/:uploadId/download')
  @Header('Content-Type', 'application/zip')
  async downloadImport(@Param('uploadId') uploadId: string) {
    const file = await this.probabilityService.getImportFile(uploadId);
    return new StreamableFile(createReadStream(file.path), {
      disposition: `attachment; filename="${encodeURIComponent(file.metadata.originalFilename)}"`,
    });
  }
}
