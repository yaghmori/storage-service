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
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DEFAULT_AI_VISION_SETTINGS } from '@workspace/validation';
import { emptySuccess } from '../../lib/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { OrganizationService } from '../../organizations/organization.service';
import { OrgLimitsService } from '../../organizations/services/org-limits.service';
import { OrgRetentionService } from '../../organizations/services/org-retention.service';
import { OrgUsageService } from '../../organizations/services/org-usage.service';
import { OrgProcessorsService } from '../../processing/services/org-processors.service';
import { NotifyWebhookProcessingService } from '../../processing/services/notify-webhook-processing.service';
import { PLATFORM_PROCESSING_DEFAULTS } from '../../processing/types/processing-settings';
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

  @IsOptional()
  @IsBoolean()
  enableAiProcessing?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAiCaption?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAiTags?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAiNsfw?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  nsfwThreshold?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  aiBackendId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsString()
  @MaxLength(255)
  aiVisionModel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  aiSystemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  aiUserPrompt?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  documentOcrBackendId?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsString()
  @MaxLength(255)
  documentOcrVisionModel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  documentOcrSystemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  documentOcrUserPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  documentOcrTesseractLang?: string;

  @IsOptional()
  @IsBoolean()
  enableImageNormalize?: boolean;

  @IsOptional()
  @IsBoolean()
  enableDedupePhash?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(64)
  phashThresholdBits?: number;

  @IsOptional()
  @IsBoolean()
  enableIntegrityVerify?: boolean;

  @IsOptional()
  @IsBoolean()
  enableVirusScan?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  virusScanBackendId?: string | null;

  @IsOptional()
  @IsBoolean()
  enableDocumentPreview?: boolean;

  @IsOptional()
  @IsBoolean()
  enableDocumentText?: boolean;

  @IsOptional()
  @IsBoolean()
  enableDocumentOcr?: boolean;

  @IsOptional()
  @IsIn(['openai_compatible', 'tesseract'])
  documentOcrEngine?: 'openai_compatible' | 'tesseract';

  @IsOptional()
  @IsBoolean()
  enableNotifyWebhook?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  notifyWebhookDestinations?: Array<{
    id?: string;
    name?: string;
    enabled?: boolean;
    url?: string;
    secret?: string;
    bearerToken?: string;
    headers?: Array<{ name: string; value: string }>;
    events?: Array<
      'processing.completed' | 'processing.failed' | 'processing.partial'
    >;
    includeDownloadUrl?: boolean;
    downloadUrlExpiresIn?: number;
  }>;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsString()
  notifyWebhookUrl?: string;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsString()
  notifyWebhookSecret?: string;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  notifyWebhookBearerToken?: string;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  notifyWebhookHeaders?: Array<{ name: string; value: string }>;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsArray()
  @IsIn(['processing.completed', 'processing.failed', 'processing.partial'], {
    each: true,
  })
  notifyWebhookEvents?: Array<
    'processing.completed' | 'processing.failed' | 'processing.partial'
  >;

  /** @deprecated Prefer notifyWebhookDestinations */
  @IsOptional()
  @IsBoolean()
  notifyWebhookIncludeDownloadUrl?: boolean;

  /** Per-processor concurrency / rate limits (org-scoped). */
  @IsOptional()
  @IsObject()
  processorCapacity?: Record<
    string,
    {
      concurrency?: number;
      rateMax?: number | null;
      rateDurationMs?: number | null;
    }
  >;
}

export class TestNotifyWebhookDto {
  @IsOptional()
  @IsString()
  destinationId?: string;

  @IsOptional()
  @IsObject()
  destination?: {
    id?: string;
    name?: string;
    url?: string;
    secret?: string;
    bearerToken?: string;
    headers?: Array<{ name: string; value: string }>;
    events?: Array<
      'processing.completed' | 'processing.failed' | 'processing.partial'
    >;
    includeDownloadUrl?: boolean;
    downloadUrlExpiresIn?: number;
  };

  @IsOptional()
  @IsIn(['processing.completed', 'processing.failed', 'processing.partial'])
  event?: 'processing.completed' | 'processing.failed' | 'processing.partial';

  @IsOptional()
  @IsUUID()
  fileId?: string;
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
    private readonly orgProcessors: OrgProcessorsService,
    private readonly limitsService: OrgLimitsService,
    private readonly retentionService: OrgRetentionService,
    private readonly usageService: OrgUsageService,
    private readonly notifyWebhook: NotifyWebhookProcessingService,
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
    const rows = await this.orgProcessors.ensureDefaults(id);
    const settings = this.orgProcessors.toLegacyProcessingSettings(rows);
    return {
      ...settings,
      defaults: {
        ...PLATFORM_PROCESSING_DEFAULTS,
        enableAiProcessing: false,
        enableAiCaption: DEFAULT_AI_VISION_SETTINGS.enableCaption,
        enableAiTags: DEFAULT_AI_VISION_SETTINGS.enableTags,
        enableAiNsfw: DEFAULT_AI_VISION_SETTINGS.enableNsfw,
        nsfwThreshold: DEFAULT_AI_VISION_SETTINGS.nsfwThreshold,
        aiBackendId: null,
        documentOcrBackendId: null,
      },
    };
  }

  @Put(':id/processing-settings')
  async updateProcessingSettings(
    @Param('id') id: string,
    @Body() body: UpdateProcessingSettingsDto,
  ) {
    return this.orgProcessors.updateFromLegacySettings(id, {
      ...body,
    });
  }

  @Post(':id/processing-settings/test-webhook')
  @HttpCode(HttpStatus.OK)
  async testNotifyWebhook(
    @Param('id') id: string,
    @Body() body: TestNotifyWebhookDto,
  ) {
    const org = await this.organizations.getById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return this.notifyWebhook.sendTest({
      orgId: id,
      fileId: body.fileId,
      destinationId: body.destinationId,
      destination: body.destination,
      event: body.event,
    });
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
    const organization = await this.organizations.create(body);
    await this.orgProcessors.ensureDefaults(organization.id);
    return organization;
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
