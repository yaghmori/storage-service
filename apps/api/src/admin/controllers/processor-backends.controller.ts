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
import { AdminAuthGuard } from '../guards/admin-auth.guard';

class CreateProcessorBackendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsIn([ProcessorBackendKind.OPENAI_COMPATIBLE])
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
  @IsIn([ProcessorBackendKind.OPENAI_COMPATIBLE])
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
@Controller('admin/api/orgs/:orgId/processor-backends')
@UseGuards(AdminAuthGuard)
export class ProcessorBackendsController {
  constructor(private readonly backends: ProcessorBackendsService) {}

  @Get()
  async list(@Param('orgId') orgId: string) {
    const rows = await this.backends.listByOrg(orgId);
    return rows.map((row) => this.backends.toPublic(row));
  }

  @Get(':id/models')
  async listModels(@Param('orgId') orgId: string, @Param('id') id: string) {
    const items = await this.backends.listModels(orgId, id);
    return { items, total: items.length };
  }

  @Get(':id')
  async get(@Param('orgId') orgId: string, @Param('id') id: string) {
    const row = await this.backends.getById(id, orgId);
    if (!row) throw new NotFoundException('Processor backend not found');
    return this.backends.toPublic(row);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('orgId') orgId: string,
    @Body() body: CreateProcessorBackendDto,
  ) {
    const row = await this.backends.create(orgId, body);
    return this.backends.toPublic(row);
  }

  @Put(':id')
  async update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() body: UpdateProcessorBackendDto,
  ) {
    const row = await this.backends.update(id, orgId, body);
    return this.backends.toPublic(row);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    const row = await this.backends.delete(id, orgId);
    if (!row) throw new NotFoundException('Processor backend not found');
  }
}
