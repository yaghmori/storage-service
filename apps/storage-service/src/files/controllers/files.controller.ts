import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from '../services/files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.filesService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('id') id: string,
    @Query('hard') hardDelete?: string,
    @CurrentUser() user?: { id?: string },
  ) {
    return this.filesService.deleteFile(id, hardDelete === 'true', user?.id);
  }
}

