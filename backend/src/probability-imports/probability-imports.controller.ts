import { Body, Controller, Get, Header, Param, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { Public } from '../common/public.decorator';
import { ProbabilityImportsService } from './probability-imports.service';

@Controller('probability/imports')
export class ProbabilityImportsController {
  constructor(private readonly probabilityImportsService: ProbabilityImportsService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file: Express.Multer.File) {
    return this.probabilityImportsService.previewImportZip(file);
  }

  @Post('apply')
  applyImport(@Body('uploadId') uploadId: string) {
    return this.probabilityImportsService.applyImportUpload(uploadId);
  }

  @Get()
  getImports() {
    return this.probabilityImportsService.listImportUploads();
  }

  @Post(':uploadId/download-token')
  createDownloadToken(@Param('uploadId') uploadId: string) {
    return this.probabilityImportsService.createDownloadToken(uploadId);
  }

  @Public()
  @Get('download/:token')
  @Header('Content-Type', 'application/zip')
  async downloadImportByToken(@Param('token') token: string) {
    const file = await this.probabilityImportsService.getImportFileByDownloadToken(token);
    return new StreamableFile(createReadStream(file.path), {
      disposition: `attachment; filename="${encodeURIComponent(file.metadata.originalFilename)}"`,
    });
  }

  @Get(':uploadId/download')
  @Header('Content-Type', 'application/zip')
  async downloadImport(@Param('uploadId') uploadId: string) {
    const file = await this.probabilityImportsService.getImportFile(uploadId);
    return new StreamableFile(createReadStream(file.path), {
      disposition: `attachment; filename="${encodeURIComponent(file.metadata.originalFilename)}"`,
    });
  }
}
