import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  forwardRef,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { and, count, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { emptySuccess } from '../../lib/contracts';
import { Public } from '../../common/decorators/public.decorator';
import * as schema from '../../database/drizzle/schema';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminUserService } from '../services/admin-user.service';

export class CreateAdminUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['admin', 'viewer'])
  role?: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'viewer'])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Public()
@Controller('admin/api/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(
    @Inject(forwardRef(() => AdminUserService))
    private readonly users: AdminUserService,
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  @Get()
  async list() {
    const rows = await this.users.list();
    return rows.map((u) => this.publicUser(u));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.publicUser(user);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateAdminUserDto,
    @CurrentAdmin() admin: { role: string },
  ) {
    this.requireAdminRole(admin.role);
    const existing = await this.users.findByEmail(body.email);
    if (existing) {
      throw new BadRequestException(`User with email ${body.email} already exists`);
    }
    const user = await this.users.create({
      email: body.email,
      password: body.password,
      role: body.role || 'admin',
    });
    return this.publicUser(user);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAdminUserDto,
    @CurrentAdmin() admin: { adminId: string; role: string },
  ) {
    this.requireAdminRole(admin.role);
    if (body.isActive === false) {
      await this.ensureNotLastActiveAdmin(id);
    }
    const user = await this.users.update(id, body);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.publicUser(user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: { adminId: string; role: string },
  ) {
    this.requireAdminRole(admin.role);
    if (admin.adminId === id) {
      throw new BadRequestException('Cannot delete your own account');
    }
    await this.ensureNotLastActiveAdmin(id);
    const ok = await this.users.delete(id);
    if (!ok) throw new NotFoundException(`User ${id} not found`);
    return emptySuccess({ message: 'User deleted' });
  }

  private requireAdminRole(role: string) {
    if (role !== 'admin') {
      throw new BadRequestException('Only admin role can manage users');
    }
  }

  private async ensureNotLastActiveAdmin(targetId: string) {
    const [activeAdmins] = await this.db
      .select({ value: count() })
      .from(schema.adminUsers)
      .where(
        and(eq(schema.adminUsers.isActive, true), eq(schema.adminUsers.role, 'admin')),
      );
    const target = await this.users.findById(targetId);
    if (
      target?.isActive &&
      target.role === 'admin' &&
      Number(activeAdmins?.value ?? 0) <= 1
    ) {
      throw new BadRequestException('Cannot disable or delete the last active admin');
    }
  }

  private publicUser(user: schema.AdminUser) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
