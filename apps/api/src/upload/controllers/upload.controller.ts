import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { resolveBoundOrgId } from '../../common/guards/auth.guard';
import { UploadService } from '../services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId?: string,
    @Body('storageKey') storageKey?: string,
    @Body('orgId') bodyOrgId?: string,
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req || {}, bodyOrgId || user?.orgId);
    if (!orgId) {
      throw new BadRequestException(
        'orgId is required (bound API key, AUTH_DEFAULT_ORG_ID, or x-org-id)',
      );
    }
    return await this.uploadService.uploadFile(
      file,
      orgId,
      storageProviderId,
      user?.id,
      storageKey,
    );
  }
}
