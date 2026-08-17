import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIp } from '../../common/logging/http-log.utils';
import { resolveBoundOrgId } from '../../common/guards/auth.guard';
import { success } from '../../lib/contracts';
import { VariantType } from '../../variants/repositories/variants.repository';
import { ServingService } from '../services/serving.service';
import { SignedUrlService } from '../services/signed-url.service';
import { remainingTtlSeconds } from '../utils/file-download-hmac';

type DownloadRequest = Request & {
  orgId?: string;
  fileDownloadHmac?: { fileId: string; exp: number; variant?: string };
};

/**
 * File serving API.
 *
 * Prefer `?variant=thumbnail|medium` for image previews. Omit `variant` for the original.
 * The unused `size` query is not supported — use named variants from org processing settings.
 *
 * Signed-URL minting is org-scoped (API key / JWT / x-org-id). After mint,
 * GET /download is HMAC-authenticated by fileId alone (capability URL) — that
 * path intentionally does not re-check org. Clients only ever see FILES_PUBLIC_BASE_URL.
 */
@Controller({ path: 'files', version: '1' })
export class ServingController {
  constructor(
    private readonly servingService: ServingService,
    private readonly signedUrlService: SignedUrlService,
  ) {}

  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res() response: Response,
    @Req() request: DownloadRequest,
    @Query('variant') variant?: string,
    @Query('exp') exp?: string,
  ) {
    // HMAC (or auth) already validated in AuthGuard. Download stays fileId-based
    // after a signed URL was issued; do not require orgId here.
    const ipAddress = clientIp({
      headers: request.headers as Record<string, string | string[] | undefined>,
      ip: typeof request.ip === "string" ? request.ip : undefined,
      socket: request.socket,
    });
    const userAgent = request.headers['user-agent'];
    const refererHeader = request.headers['referer'] ?? request.headers['referrer'];
    const referer =
      typeof refererHeader === 'string'
        ? refererHeader
        : Array.isArray(refererHeader)
          ? refererHeader[0]
          : undefined;

    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;

    const { provider, key, file, variant: resolvedVariant } =
      await this.signedUrlService.resolveDownloadTarget(id, variantType);

    if (provider.canPresignForBrowser()) {
      const hmacExp = request.fileDownloadHmac?.exp ?? Number(exp);
      const ttl = remainingTtlSeconds(hmacExp);
      const url = await provider.getSignedUrl(key, ttl);

      const bytes =
        resolvedVariant?.size != null
          ? Number(resolvedVariant.size)
          : Number(file.size);
      await this.servingService.logPresignedDownload({
        fileId: file.id,
        variantId: resolvedVariant?.id,
        ipAddress,
        userAgent,
        referer,
        bytesDownloaded: Number.isFinite(bytes) ? bytes : undefined,
        headers: request.headers as Record<
          string,
          string | string[] | undefined
        >,
      });

      response.setHeader('Cache-Control', 'private, no-store');
      response.redirect(302, url);
      return;
    }

    await this.servingService.streamFile(
      id,
      variantType,
      undefined,
      response,
      ipAddress,
      userAgent,
      false,
      {
        headers: request.headers as Record<
          string,
          string | string[] | undefined
        >,
        referer,
        downloadMethod: 'direct',
      },
    );
  }

  @Get(':id/signed-url')
  async getSignedUrl(
    @Param('id') id: string,
    @Req() request: DownloadRequest,
    @Query('variant') variant?: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const orgId = resolveBoundOrgId(request);
    if (!orgId) {
      throw new ForbiddenException(
        'Organization context required to mint a signed URL',
      );
    }
    const requested = expiresIn ? parseInt(expiresIn, 10) : undefined;
    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;
    const result = await this.signedUrlService.generateSignedUrl(
      id,
      variantType,
      Number.isFinite(requested) ? requested : undefined,
      orgId,
    );
    return success({ url: result.url, expiresIn: result.expiresIn });
  }
}
