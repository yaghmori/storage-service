import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { emptySuccess } from '../../lib/contracts';
import { IsBoolean, IsDateString, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { AdminApiKeyService } from '../services/admin-api-key.service';
import { requireOrgId } from '../utils/require-org-id';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  serviceName!: string;

  @IsOptional()
  @IsString()
  orgId?: string;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Public()
@Controller('admin/api/api-keys')
@UseGuards(AdminAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeyService: AdminApiKeyService) {}

  @Get()
  async listApiKeys(
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    return this.apiKeyService.list(orgId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(dto.orgId || queryOrgId, headerOrgId);
    const { apiKey, plainKey } = await this.apiKeyService.create({
      serviceName: dto.serviceName,
      orgId,
      permissions: dto.permissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return {
      id: apiKey.id,
      orgId: apiKey.orgId,
      serviceName: apiKey.serviceName,
      key: plainKey,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    };
  }

  @Put(':id')
  async updateApiKey(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const apiKey = await this.apiKeyService.update(
      id,
      {
        permissions: dto.permissions,
        expiresAt: dto.expiresAt
          ? dto.expiresAt === 'null'
            ? null
            : new Date(dto.expiresAt)
          : undefined,
        isActive: dto.isActive,
      },
      orgId,
    );

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found`);
    }

    return apiKey;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteApiKey(
    @Param('id') id: string,
    @Query('orgId') queryOrgId?: string,
    @Headers('x-org-id') headerOrgId?: string,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    const deleted = await this.apiKeyService.delete(id, orgId);

    if (!deleted) {
      throw new NotFoundException(`API key with id ${id} not found`);
    }

    return emptySuccess({ message: 'API key deleted successfully' });
  }
}
