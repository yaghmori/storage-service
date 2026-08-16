import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { success } from '../../lib/contracts';
import { VariantType } from '../../variants/repositories/variants.repository';
import { ServingService } from '../services/serving.service';
import { SignedUrlService } from '../services/signed-url.service';
import { remainingTtlSeconds } from '../utils/file-download-hmac';

type DownloadRequest = Request & {
  fileDownloadHmac?: { fileId: string; exp: number; variant?: string };
};

/**
 * File serving API.
 *
 * Prefer `?variant=thumbnail|medium` for image previews. Omit `variant` for the original.
 * The unused `size` query is not supported — use named variants from org processing settings.
 *
 * GET /download is HMAC-authenticated (or API key/JWT). Clients only ever see FILES_PUBLIC_BASE_URL.
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
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]) : undefined);
    const userAgent = request.headers['user-agent'];

    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;

    const { provider, key } = await this.signedUrlService.resolveDownloadTarget(
      id,
      variantType,
    );

    if (provider.canPresignForBrowser()) {
      const hmacExp = request.fileDownloadHmac?.exp ?? Number(exp);
      const ttl = remainingTtlSeconds(hmacExp);
      const url = await provider.getSignedUrl(key, ttl);
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
    );
  }

  @Get(':id/signed-url')
  async getSignedUrl(
    @Param('id') id: string,
    @Query('variant') variant?: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const requested = expiresIn ? parseInt(expiresIn, 10) : undefined;
    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;
    const result = await this.signedUrlService.generateSignedUrl(
      id,
      variantType,
      Number.isFinite(requested) ? requested : undefined,
    );
    return success({ url: result.url, expiresIn: result.expiresIn });
  }
}
