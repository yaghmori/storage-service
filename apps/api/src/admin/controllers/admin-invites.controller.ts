import { Body, Controller, Get, Param, Post, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtService } from '../services/admin-jwt.service';
import { MembershipService } from '../services/membership.service';

export class AcceptInviteDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

@Public()
@Controller({ path: 'admin/api/invites', version: VERSION_NEUTRAL })
export class AdminInvitesController {
  constructor(
    private readonly memberships: MembershipService,
    private readonly jwt: AdminJwtService,
  ) {}

  @Get(':token')
  async preview(@Param('token') token: string) {
    return this.memberships.getInviteByToken(token);
  }

  /**
   * Accept invite. If Authorization bearer is present and valid, attach that user.
   * Otherwise create/login via password on the invite email.
   */
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInviteDto,
    @Req() req: { headers?: { authorization?: string } },
  ) {
    let userId: string | undefined;
    const auth = req.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      const payload = this.jwt.verifyAdminJWT(auth.slice(7));
      if (payload?.adminId) userId = payload.adminId;
    }

    const result = await this.memberships.acceptInvite({
      token,
      userId,
      password: body.password,
      name: body.name,
    });

    const jwt = this.jwt.generateAdminJWT(
      result.user.id,
      result.user.email,
      result.user.role,
    );

    return {
      token: jwt,
      createdUser: result.createdUser,
      orgId: result.membership.orgId,
      role: result.membership.role,
      admin: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        name: result.user.name,
        avatar: result.user.avatar,
      },
    };
  }
}
