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
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { randomBytes } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminJwtService } from '../services/admin-jwt.service';
import { AdminUserService } from '../services/admin-user.service';
import {
  buildAdminPasswordResetEmail,
  resolveAdminSignInUrl,
} from '../utils/build-admin-password-reset-email';
import { sendOpsSmtpMail } from '../utils/send-ops-smtp-mail';

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

export class UpdateProfileDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(255)
  name?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(5_000_000)
  avatar?: string | null;
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
@Controller({ path: 'admin/api/auth', version: VERSION_NEUTRAL })
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
        name: adminUser.name,
        avatar: adminUser.avatar,
      },
    };
  }

  /**
   * Ops-style reset: generates a temporary password, stores the hash,
   * always prints plaintext to container stdout, and emails via SMTP when configured.
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

    const mail = buildAdminPasswordResetEmail({
      serviceName: process.env.PRODUCT_NAME || 'Storage Service',
      temporaryPassword,
      recipientEmail: adminUser.email,
      recipientName: adminUser.name,
      signInUrl: resolveAdminSignInUrl('6200'),
      supportEmail: process.env.SUPPORT_EMAIL || null,
    });

    const mailResult = await sendOpsSmtpMail({
      to: adminUser.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      defaultFrom: 'noreply@storage.local',
    });

    if (mailResult === 'failed') {
      this.logger.warn(
        `ADMIN PASSWORD RESET — SMTP send failed; password remains in logs email=${adminUser.email}`,
      );
    }

    return {
      message:
        mailResult === 'sent'
          ? 'Temporary password emailed and written to the service container logs. Sign in with it, then change your password.'
          : 'Temporary password written to the service container logs. Sign in with it, then change your password.',
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
      name: adminUser.name,
      avatar: adminUser.avatar,
      isActive: adminUser.isActive,
      createdAt: adminUser.createdAt,
      lastLoginAt: adminUser.lastLoginAt,
    };
  }

  @UseGuards(AdminAuthGuard)
  @Put('me')
  async updateProfile(
    @CurrentUser() user: { adminId: string; email: string; role: string } | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!user?.adminId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const adminUser = await this.adminUserService.findById(user.adminId);
    if (!adminUser) {
      throw new UnauthorizedException('Admin user not found');
    }

    const patch: { name?: string | null; avatar?: string | null } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.avatar !== undefined) patch.avatar = dto.avatar;

    const updated = await this.adminUserService.update(adminUser.id, patch);
    if (!updated) {
      throw new UnauthorizedException('Admin user not found');
    }

    return {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      name: updated.name,
      avatar: updated.avatar,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      lastLoginAt: updated.lastLoginAt,
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
