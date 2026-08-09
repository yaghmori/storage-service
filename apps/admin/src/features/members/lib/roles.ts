export const ORG_ROLES = [
  {
    name: "owner" as const,
    label: "Owner",
    description: "Full access to all organization settings and resources",
  },
  {
    name: "admin" as const,
    label: "Admin",
    description: "Can manage organization settings and team members",
  },
  {
    name: "member" as const,
    label: "Member",
    description: "Can view and work with organization resources",
  },
] as const;

export type OrgRoleName = (typeof ORG_ROLES)[number]["name"];

export const INVITE_ROLES = ORG_ROLES.filter((r) => r.name !== "owner");

export function roleLabel(role: string): string {
  return ORG_ROLES.find((r) => r.name === role)?.label ?? role;
}
