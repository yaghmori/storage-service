import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AdminRequestUser } from '../decorators/current-admin.decorator';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { MembershipService } from '../services/membership.service';
import { requireOrgId } from '../utils/require-org-id';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';

  @IsOptional()
  @IsString()
  message?: string;
}

export class ChangeMemberRoleDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}

export class TransferOwnershipDto {
  @IsUUID()
  memberId!: string;
}

@Public()
@Controller('admin/api/orgs/:orgId/members')
@UseGuards(AdminAuthGuard)
export class AdminMembersController {
  constructor(private readonly memberships: MembershipService) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Query('type') type?: 'member' | 'invitation' | 'all',
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'member');
    return {
      items: await this.memberships.listMembers(orgId, type ?? 'all'),
    };
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Body() body: InviteMemberDto,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    return this.memberships.invite({
      orgId,
      email: body.email,
      role: body.role,
      message: body.message,
      invitedByUserId: admin.adminId,
    });
  }

  @Post('transfer')
  async transfer(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Body() body: TransferOwnershipDto,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'owner');
    await this.memberships.transferOwnership(
      orgId,
      admin.adminId,
      body.memberId,
    );
    return { message: 'Ownership transferred' };
  }

  @Post(':memberId/resend')
  async resend(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    return this.memberships.resend(orgId, memberId);
  }

  @Patch(':memberId/role')
  async changeRole(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: ChangeMemberRoleDto,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    return this.memberships.changeRole(orgId, memberId, body.role);
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentAdmin() admin: AdminRequestUser,
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    await this.memberships.remove(orgId, memberId, admin.adminId);
  }
}

/** Convenience routes that take orgId from header (for clients that already set x-org-id). */
@Public()
@Controller('admin/api/members')
@UseGuards(AdminAuthGuard)
export class AdminMembersByHeaderController {
  constructor(private readonly memberships: MembershipService) {}

  @Get()
  async list(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query('orgId') queryOrgId: string | undefined,
    @Headers('x-org-id') headerOrgId: string | undefined,
    @Query('type') type?: 'member' | 'invitation' | 'all',
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.memberships.requireMembership(admin.adminId, orgId, 'member');
    return {
      items: await this.memberships.listMembers(orgId, type ?? 'all'),
    };
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @CurrentAdmin() admin: AdminRequestUser,
    @Query('orgId') queryOrgId: string | undefined,
    @Headers('x-org-id') headerOrgId: string | undefined,
    @Body() body: InviteMemberDto,
  ) {
    const orgId = requireOrgId(queryOrgId, headerOrgId);
    await this.memberships.requireMembership(admin.adminId, orgId, 'admin');
    return this.memberships.invite({
      orgId,
      email: body.email,
      role: body.role,
      message: body.message,
      invitedByUserId: admin.adminId,
    });
  }
}
