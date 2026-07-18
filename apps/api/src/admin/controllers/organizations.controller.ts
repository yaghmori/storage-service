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
import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { emptySuccess } from '../../lib/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { OrganizationService } from '../../organizations/organization.service';
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

@Public()
@Controller('admin/api/orgs')
@UseGuards(AdminAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationService) {}

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
