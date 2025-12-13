import {
  Controller,
  Get,
  Param,
  Res,
  Query,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { Response, Request } from 'express';
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
    const ipAddress = request.ip || request.headers['x-forwarded-for'] as string;
    const userAgent = request.headers['user-agent'];

    await this.servingService.streamFile(
      id,
      variant,
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
      variant,
      expiresIn ? parseInt(expiresIn, 10) : 3600,
    );
    return { url, expiresIn: expiresIn ? parseInt(expiresIn, 10) : 3600 };
  }
}

