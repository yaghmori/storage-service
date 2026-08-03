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
import {
  looksLikeUuid,
  resolveBoundOrgId,
} from '../../common/guards/auth.guard';
import { OrganizationService } from '../../organizations/organization.service';
import { platformMulterFileLimits } from '../multer-limits';
import { UploadService } from '../services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly organizations: OrganizationService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: platformMulterFileLimits() }))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('storageProviderId') storageProviderId?: string,
    @Body('storageKey') storageKey?: string,
    @Body('orgId') bodyOrgId?: string,
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = await this.resolveUploadOrgId(
      req || {},
      bodyOrgId || user?.orgId,
    );
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

  /**
   * API key org wins. Callers may send org UUID or slug in body/x-org-id;
   * slug is resolved so `STORAGE_SERVICE_ORG_ID=eallyfe` works.
   */
  private async resolveUploadOrgId(
    request: {
      orgId?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    bodyOrgId?: string | null,
  ): Promise<string | undefined> {
    const headerRaw = request.headers?.['x-org-id'];
    const headerOrgId = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    const requestedRaw = (bodyOrgId || headerOrgId || undefined)?.trim();

    let requestedUuid: string | undefined;
    if (requestedRaw) {
      if (looksLikeUuid(requestedRaw)) {
        requestedUuid = requestedRaw;
      } else {
        requestedUuid = await this.organizations.resolveOrgRef({
          orgSlug: requestedRaw,
        });
      }
    }

    // Re-run bound check with resolved UUID (slug already converted).
    return resolveBoundOrgId(
      {
        orgId: request.orgId,
        headers: requestedUuid
          ? { 'x-org-id': requestedUuid }
          : request.headers,
      },
      undefined,
    );
  }
}
