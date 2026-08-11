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
import { FileInsightsService } from '../services/file-insights.service';
import { FilesService } from '../services/files.service';

@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly insights: FileInsightsService,
  ) {}

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

  /** EXIF/IPTC/XMP sidecar from metadata.exif processor (API key). */
  @Get(':id/metadata')
  async getMetadata(
    @Param('id') id: string,
    @Req() req: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req);
    if (!orgId) {
      throw new NotFoundException(notFound('Organization context required'));
    }
    return success(await this.insights.getMetadata(id, orgId));
  }

  /** All processor results for a file (OCR text, AI vision, EXIF, …). */
  @Get(':id/processor-results')
  async listProcessorResults(
    @Param('id') id: string,
    @Req() req: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req);
    if (!orgId) {
      throw new NotFoundException(notFound('Organization context required'));
    }
    return success(await this.insights.listProcessorResults(id, orgId));
  }

  /** Single processor result by key, e.g. document.ocr / ai.vision. */
  @Get(':id/processor-results/:processorKey')
  async getProcessorResult(
    @Param('id') id: string,
    @Param('processorKey') processorKey: string,
    @Req() req: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req);
    if (!orgId) {
      throw new NotFoundException(notFound('Organization context required'));
    }
    return success(
      await this.insights.getProcessorResult(id, orgId, processorKey),
    );
  }

  /** Generated delivery variants (thumbnail, medium, normalized, …). */
  @Get(':id/variants')
  async listVariants(
    @Param('id') id: string,
    @Req() req: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = resolveBoundOrgId(req);
    if (!orgId) {
      throw new NotFoundException(notFound('Organization context required'));
    }
    return success(await this.insights.listVariants(id, orgId));
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
