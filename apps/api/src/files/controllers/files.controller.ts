import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { success, emptySuccess, notFound } from '../../lib/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { resolveBoundOrgId } from '../../common/guards/auth.guard';
import { FilesService } from '../services/files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Req() req: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req);
    const file = await this.filesService.findById(id, orgId);
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
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req || {}, user?.orgId);
    if (orgId) {
      await this.filesService.findById(id, orgId);
    }
    await this.filesService.deleteFile(id, hardDelete === 'true', user?.id);
    return emptySuccess();
  }
}
