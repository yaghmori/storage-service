import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminJwtService } from '../services/admin-jwt.service';
import { AdminUserService } from '../services/admin-user.service';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

/** Temporary password that satisfies admin password policy (upper/lower/digit/special). */
function generateTemporaryPassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = lower + upper + digits + special;

  const pick = (chars: string) => chars[randomBytes(1)[0]! % chars.length]!;
  const required = [pick(lower), pick(upper), pick(digits), pick(special)];
  const rest = Array.from({ length: 12 }, () => pick(all));
  const chars = [...required, ...rest];

  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Public()
@Controller('admin/api/auth')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(
    private readonly adminUserService: AdminUserService,
    private readonly jwtService: AdminJwtService,
  ) {}

  @Post('login')
  async adminLogin(@Body() dto: LoginDto) {
    const email = normalizeEmail(dto.email);
    const adminUser = await this.adminUserService.findByEmail(email);

    if (!adminUser || !adminUser.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await this.adminUserService.verifyPassword(adminUser, dto.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.adminUserService.updateLastLogin(adminUser.id);

    const token = this.jwtService.generateAdminJWT(adminUser.id, adminUser.email, adminUser.role);

    return {
      token,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      },
    };
  }

  /**
   * Ops-style reset: generates a temporary password, stores the hash, and
   * prints the plaintext password to container stdout (docker logs).
   */
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const email = normalizeEmail(dto.email);
    const adminUser = await this.adminUserService.findByEmail(email);

    if (!adminUser) {
      throw new NotFoundException('No admin account found for that email');
    }
    if (!adminUser.isActive) {
      throw new UnauthorizedException('This admin account is inactive');
    }

    const temporaryPassword = generateTemporaryPassword();
    await this.adminUserService.update(adminUser.id, { password: temporaryPassword });

    // Intentionally logged in plaintext for self-hosted ops recovery via `docker logs`.
    this.logger.warn(
      `ADMIN PASSWORD RESET — temporary password (read from docker logs, then change after login) email=${adminUser.email} adminId=${adminUser.id} temporaryPassword=${temporaryPassword}`,
    );

    return {
      message:
        'Temporary password written to the service container logs. Sign in with it, then change your password.',
    };
  }

  @UseGuards(AdminAuthGuard)
  @Get('me')
  async getAdminMe(@CurrentUser() user: { adminId: string; email: string; role: string } | undefined) {
    if (!user?.adminId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const adminUser = await this.adminUserService.findById(user.adminId);
    if (!adminUser) {
      throw new UnauthorizedException('Admin user not found');
    }

    return {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      isActive: adminUser.isActive,
      createdAt: adminUser.createdAt,
      lastLoginAt: adminUser.lastLoginAt,
    };
  }

  @UseGuards(AdminAuthGuard)
  @Put('me/password')
  async changePassword(
    @CurrentUser() user: { adminId: string; email: string; role: string } | undefined,
    @Body() dto: ChangePasswordDto,
  ) {
    if (!user?.adminId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const adminUser = await this.adminUserService.findById(user.adminId);
    if (!adminUser) {
      throw new UnauthorizedException('Admin user not found');
    }

    const valid = await this.adminUserService.verifyPassword(adminUser, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.adminUserService.update(adminUser.id, { password: dto.newPassword });
    return { message: 'Password updated' };
  }

  @Post('logout')
  adminLogout() {
    return {
      message: 'Logged out successfully',
    };
  }
}
