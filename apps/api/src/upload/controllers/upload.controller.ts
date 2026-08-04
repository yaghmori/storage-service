import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  looksLikeUuid,
  resolveBoundOrgId,
} from '../../common/guards/auth.guard';
import { OrganizationService } from '../../organizations/organization.service';
import { platformMulterFileLimits } from '../multer-limits';
import { DirectUploadService } from '../services/direct-upload.service';
import { UploadService } from '../services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly directUpload: DirectUploadService,
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
    @Body('skipProcessing') skipProcessingRaw?: string | boolean,
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
      { skipProcessing: this.parseSkipProcessing(skipProcessingRaw, req) },
    );
  }

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Body()
    body: {
      filename?: string;
      mimeType?: string;
      size?: number;
      storageProviderId?: string;
      storageKey?: string;
      skipProcessing?: boolean | string;
      multipart?: boolean | string;
      orgId?: string;
    },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = await this.resolveUploadOrgId(req || {}, body.orgId || user?.orgId);
    if (!orgId) {
      throw new BadRequestException(
        'orgId is required (bound API key, AUTH_DEFAULT_ORG_ID, or x-org-id)',
      );
    }
    if (!body.filename || body.size == null || !body.mimeType) {
      throw new BadRequestException('filename, mimeType, and size are required');
    }

    return this.directUpload.initiate(
      orgId,
      {
        filename: body.filename,
        mimeType: body.mimeType,
        size: Number(body.size),
        storageProviderId: body.storageProviderId,
        storageKey: body.storageKey,
        skipProcessing: this.parseSkipProcessing(body.skipProcessing, req),
        multipart:
          body.multipart === true ||
          body.multipart === 'true' ||
          body.multipart === '1',
      },
      user?.id,
    );
  }

  @Post('multipart/part-url')
  @HttpCode(HttpStatus.OK)
  async multipartPartUrl(
    @Body() body: { fileId?: string; partNumber?: number; orgId?: string },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = await this.resolveUploadOrgId(req || {}, body.orgId || user?.orgId);
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }
    if (!body.fileId || body.partNumber == null) {
      throw new BadRequestException('fileId and partNumber are required');
    }
    return this.directUpload.getPartUrl(orgId, {
      fileId: body.fileId,
      partNumber: Number(body.partNumber),
    });
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  async complete(
    @Body()
    body: {
      fileId?: string;
      sha256Hash?: string;
      skipProcessing?: boolean | string;
      parts?: Array<{ partNumber: number; etag: string }>;
      orgId?: string;
    },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = await this.resolveUploadOrgId(req || {}, body.orgId || user?.orgId);
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }
    if (!body.fileId || !body.sha256Hash) {
      throw new BadRequestException('fileId and sha256Hash are required');
    }
    return this.directUpload.complete(
      orgId,
      {
        fileId: body.fileId,
        sha256Hash: body.sha256Hash,
        skipProcessing: this.parseSkipProcessing(body.skipProcessing, req),
        parts: body.parts,
      },
      user?.id,
    );
  }

  @Post('abort')
  @HttpCode(HttpStatus.OK)
  async abort(
    @Body() body: { fileId?: string; orgId?: string },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    const orgId = await this.resolveUploadOrgId(req || {}, body.orgId || user?.orgId);
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }
    if (!body.fileId) {
      throw new BadRequestException('fileId is required');
    }
    return this.directUpload.abort(orgId, body.fileId);
  }

  /** Convenience alias matching multipart naming in the plan. */
  @Post('multipart/initiate')
  @HttpCode(HttpStatus.CREATED)
  async multipartInitiate(
    @Body()
    body: {
      filename?: string;
      mimeType?: string;
      size?: number;
      storageProviderId?: string;
      storageKey?: string;
      skipProcessing?: boolean | string;
      orgId?: string;
    },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.initiate(
      { ...body, multipart: true },
      user,
      req,
    );
  }

  @Post('multipart/complete')
  @HttpCode(HttpStatus.CREATED)
  async multipartComplete(
    @Body()
    body: {
      fileId?: string;
      sha256Hash?: string;
      skipProcessing?: boolean | string;
      parts?: Array<{ partNumber: number; etag: string }>;
      orgId?: string;
    },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.complete(body, user, req);
  }

  @Post('multipart/abort')
  @HttpCode(HttpStatus.OK)
  async multipartAbort(
    @Body() body: { fileId?: string; orgId?: string },
    @CurrentUser() user?: { id?: string; orgId?: string },
    @Req() req?: { orgId?: string; headers?: Record<string, string | string[] | undefined> },
  ) {
    return this.abort(body, user, req);
  }

  private parseSkipProcessing(
    skipProcessingRaw?: string | boolean,
    req?: { headers?: Record<string, string | string[] | undefined> },
  ): boolean {
    const headerSkip = req?.headers?.['x-skip-processing'];
    const headerSkipValue = Array.isArray(headerSkip) ? headerSkip[0] : headerSkip;
    return (
      skipProcessingRaw === true ||
      skipProcessingRaw === 'true' ||
      skipProcessingRaw === '1' ||
      headerSkipValue === 'true' ||
      headerSkipValue === '1'
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
