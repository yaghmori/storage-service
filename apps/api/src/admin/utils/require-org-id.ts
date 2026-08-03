import { BadRequestException } from '@nestjs/common';

/** Resolve required orgId from query or x-org-id header for admin tenant APIs. */
export function requireOrgId(
  queryOrgId?: string | null,
  headerOrgId?: string | string[] | null,
): string {
  const header = Array.isArray(headerOrgId) ? headerOrgId[0] : headerOrgId;
  const orgId = (queryOrgId || header || '').trim();
  if (!orgId) {
    throw new BadRequestException('orgId is required (query ?orgId= or header x-org-id)');
  }
  return orgId;
}
