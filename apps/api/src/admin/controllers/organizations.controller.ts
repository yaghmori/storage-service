import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { emptySuccess } from '../../lib/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { OrganizationService } from '../../organizations/organization.service';
import { OrgLimitsService } from '../../organizations/services/org-limits.service';
import { OrgRetentionService } from '../../organizations/services/org-retention.service';
import { OrgUsageService } from '../../organizations/services/org-usage.service';
import { ProcessingSettingsService } from '../../processing/services/processing-settings.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  externalRef?: string | null;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  /** Optional; defaults server-side when omitted. */
  @IsOptional()
  @IsString()
  frontendBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  customDomain?: string | null;

  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  secondaryColor?: string | null;

  @IsOptional()
  @IsString()
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  privacyUrl?: string | null;

  @IsOptional()
  @IsString()
  termsUrl?: string | null;

  @IsOptional()
  @IsString()
  appBaseUrl?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsString()
  externalRef?: string | null;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  frontendBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  customDomain?: string | null;

  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  secondaryColor?: string | null;

  @IsOptional()
  @IsString()
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  privacyUrl?: string | null;

  @IsOptional()
  @IsString()
  termsUrl?: string | null;

  @IsOptional()
  @IsString()
  appBaseUrl?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class ImageVariantSlotDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4096)
  maxEdge?: number;
}

export class ImageVariantsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantSlotDto)
  thumbnail?: ImageVariantSlotDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantSlotDto)
  medium?: ImageVariantSlotDto;
}

export class UpdateProcessingSettingsDto {
  @IsOptional()
  @IsBoolean()
  enableImageProcessing?: boolean;

  @IsOptional()
  @IsBoolean()
  enableVideoProcessing?: boolean;

  @IsOptional()
  @IsBoolean()
  enableMetadataExtraction?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageVariantsDto)
  imageVariants?: ImageVariantsDto;

  /** Legacy: first → thumbnail, second → medium. Prefer imageVariants. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4096, { each: true })
  imageSizes?: number[];

  @IsOptional()
  @IsArray()
  @IsIn(['webp', 'avif'], { each: true })
  imageFormats?: Array<'webp' | 'avif'>;

  @IsOptional()
  @IsBoolean()
  videoThumbnail?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  videoPreviewFrames?: number;
}

export class UpdateOrgLimitsDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFileSizeBytes?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsArray()
  @IsString({ each: true })
  allowedMimeTypes?: string[] | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  storageQuotaBytes?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxObjectCount?: number | null;
}

export class UpdateOrgRetentionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  softDeleteRetentionDays?: number;
}

@Public()
@Controller('admin/api/orgs')
@UseGuards(AdminAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizations: OrganizationService,
    private readonly processingSettings: ProcessingSettingsService,
    private readonly limitsService: OrgLimitsService,
    private readonly retentionService: OrgRetentionService,
    private readonly usageService: OrgUsageService,
  ) {}

  @Get()
  async list() {
    return this.organizations.list();
  }

  /** Check whether a slug is free (used by create-org name debounce). */
  @Get('check-slug')
  async checkSlug(@Query('slug') slug?: string) {
    const normalized = (slug ?? '').trim().toLowerCase();
    if (!normalized) {
      return { available: false, slug: '' };
    }
    if (
      normalized === '~' ||
      normalized === 'onboarding' ||
      normalized === 'platform' ||
      normalized === 'auth'
    ) {
      return { available: false, slug: normalized };
    }
    const existing = await this.organizations.getBySlug(normalized);
    return { available: !existing, slug: normalized };
  }

  @Get(':id/processing-settings')
  async getProcessingSettings(@Param('id') id: string) {
    const settings = await this.processingSettings.getForOrg(id);
    return {
      ...settings,
      defaults: this.processingSettings.getPlatformDefaults(),
    };
  }

  @Put(':id/processing-settings')
  async updateProcessingSettings(
    @Param('id') id: string,
    @Body() body: UpdateProcessingSettingsDto,
  ) {
    return this.processingSettings.updateForOrg(id, body);
  }

  @Get(':id/limits')
  async getLimits(@Param('id') id: string) {
    return this.limitsService.getForOrg(id);
  }

  @Put(':id/limits')
  async updateLimits(@Param('id') id: string, @Body() body: UpdateOrgLimitsDto) {
    return this.limitsService.updateForOrg(id, body);
  }

  @Get(':id/retention')
  async getRetention(@Param('id') id: string) {
    return this.retentionService.getForOrg(id);
  }

  @Put(':id/retention')
  async updateRetention(
    @Param('id') id: string,
    @Body() body: UpdateOrgRetentionDto,
  ) {
    return this.retentionService.updateForOrg(id, body);
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    return this.usageService.getUsage(id);
  }

  @Post(':id/usage/recalculate')
  async recalculateUsage(@Param('id') id: string) {
    return this.usageService.recalculate(id);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const org = await this.organizations.getById(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: CreateOrganizationDto) {
    return this.organizations.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: UpdateOrganizationDto) {
    return this.organizations.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    const deleted = await this.organizations.delete(id);
    if (!deleted) throw new NotFoundException(`Organization ${id} not found`);
    return emptySuccess({ message: 'Organization deleted' });
  }
}
