import type { OrgMemberRole } from '../../database/drizzle/schema';
import type { MembershipService } from '../services/membership.service';
import { requireOrgId } from './require-org-id';

/**
 * Resolve orgId from query/header and ensure the admin is an active member.
 */
export async function requireOrgMembership(
  memberships: MembershipService,
  userId: string,
  queryOrgId: string | undefined,
  headerOrgId: string | undefined,
  minRole: OrgMemberRole = 'member',
) {
  const orgId = requireOrgId(queryOrgId, headerOrgId);
  const membership = await memberships.requireMembership(
    userId,
    orgId,
    minRole,
  );
  return { orgId, membership };
}
