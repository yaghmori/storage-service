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

@Controller('files')
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
    @Query('size') size?: string,
  ) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const ipAddress = (forwardedFor ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]) : undefined);
    const userAgent = request.headers['user-agent'];

    await this.servingService.streamFile(
      id,
      variant as VariantType | undefined,
      size ? parseInt(size, 10) : undefined,
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
    const url = await this.signedUrlService.generateSignedUrl(
      id,
      variant as VariantType | undefined,
      expiresIn ? parseInt(expiresIn, 10) : 3600,
    );
    return success({ url, expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600 });
  }
}

