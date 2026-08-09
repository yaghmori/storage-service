import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipService } from '../services/membership.service';
import { requireOrgId } from '../utils/require-org-id';

/**
 * Ensures the authenticated admin is an active member of the org from
 * `orgId` query, body, or `x-org-id` header. Sets `request.orgId` + `request.orgRole`.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly memberships: MembershipService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.adminId as string | undefined;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const orgId = requireOrgId(
      (request.query?.orgId as string | undefined) ||
        (request.body?.orgId as string | undefined),
      (request.headers?.['x-org-id'] as string | undefined) ??
        (request.headers?.['X-Org-Id'] as string | undefined),
    );

    const membership = await this.memberships.requireMembership(
      userId,
      orgId,
      'member',
    );
    request.orgId = orgId;
    request.orgRole = membership.role;
    request.orgMembership = membership;
    return true;
  }
}
