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
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ProcessorBackendKind } from '@workspace/validation';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { ProcessorBackendsService } from '../../processing/services/processor-backends.service';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AdminRequestUser } from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { MembershipService } from '../services/membership.service';

class CreateProcessorBackendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsIn([
    ProcessorBackendKind.OPENAI_COMPATIBLE,
    ProcessorBackendKind.CLAMAV,
  ])
  kind!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  baseUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  visionModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  textModel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1_000)
  @Max(600_000)
  timeoutMs?: number;
}

class UpdateProcessorBackendDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn([
    ProcessorBackendKind.OPENAI_COMPATIBLE,
    ProcessorBackendKind.CLAMAV,
  ])
  kind?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  visionModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  textModel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1_000)
  @Max(600_000)
  timeoutMs?: number;
}

@Public()
@Controller({ path: 'admin/api/orgs/:orgId/processor-backends', version: VERSION_NEUTRAL })
@UseGuards(AdminAuthGuard)
export class ProcessorBackendsController {
  constructor(
    private readonly backends: ProcessorBackendsService,
    private readonly memberships: MembershipService,
  ) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'member');
    const rows = await this.backends.listByOrg(orgId);
    return rows.map((row) => this.backends.toPublic(row));
  }

  @Get(':id/models')
  async listModels(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'member');
    const items = await this.backends.listModels(orgId, id);
    return { items, total: items.length };
  }

  @Post(':id/test')
  async test(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    return this.backends.testConnectivity(orgId, id);
  }

  @Get(':id')
  async get(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'member');
    const row = await this.backends.getById(id, orgId);
    if (!row) throw new NotFoundException('Processor backend not found');
    return this.backends.toPublic(row);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Body() body: CreateProcessorBackendDto,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    const row = await this.backends.create(orgId, {
      ...body,
      actorUserId: admin.adminId,
    });
    return this.backends.toPublic(row);
  }

  @Put(':id')
  async update(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateProcessorBackendDto,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    const row = await this.backends.update(id, orgId, {
      ...body,
      actorUserId: admin.adminId,
    });
    return this.backends.toPublic(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    const row = await this.backends.delete(id, orgId);
    if (!row) throw new NotFoundException('Processor backend not found');
  }
}
