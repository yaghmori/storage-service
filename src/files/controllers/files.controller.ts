import { Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Query } from '@nestjs/common';
import { success, emptySuccess, notFound } from '@platform/messaging-contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FilesService } from '../services/files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async getFile(@Param('id') id: string) {
    const file = await this.filesService.findById(id);
    if (!file) {
      throw new NotFoundException(notFound(`File with id ${id} not found`));
    }
    return success(file);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @Param('id') id: string,
    @Query('hard') hardDelete?: string,
    @CurrentUser() user?: { id?: string },
  ) {
    await this.filesService.deleteFile(id, hardDelete === 'true', user?.id);
    return emptySuccess();
  }
}

