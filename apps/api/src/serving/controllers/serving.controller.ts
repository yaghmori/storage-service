import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { success } from '../../lib/contracts';
import { VariantType } from '../../variants/repositories/variants.repository';
import { ServingService } from '../services/serving.service';
import { SignedUrlService } from '../services/signed-url.service';

/**
 * File serving API.
 *
 * Prefer `?variant=thumbnail|medium` for image previews. Omit `variant` for the original.
 * The unused `size` query is not supported — use named variants from org processing settings.
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
    @Req() request: Request,
    @Query('variant') variant?: string,
  ) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]) : undefined);
    const userAgent = request.headers['user-agent'];

    const variantType = variant?.trim()
      ? (variant.trim() as VariantType)
      : undefined;

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
