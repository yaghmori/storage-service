import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService } from '../services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED) // Default to 201, will be handled by interceptor if needed
  async uploadFile(
    @UploadedFile() file: any,
    @Body('storageProviderId')
    storageProviderId?: string,
    @CurrentUser() user?: { id?: string },
  ) {
    // Return data directly - transform interceptor will wrap with data and meta
    return await this.uploadService.uploadFile(file, storageProviderId, user?.id);
  }
}

