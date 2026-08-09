import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/drizzle/schema';
import type { OrgMemberRole } from '../../database/drizzle/schema';

export type UnifiedMember = {
  id: string;
  type: 'member' | 'invitation';
  orgId: string;
  role: OrgMemberRole;
  status: 'active' | 'invited';
  email: string;
  message: string | null;
  invitedAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  } | null;
};

const ROLE_RANK: Record<OrgMemberRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async listOrgsForUser(userId: string): Promise<schema.Organization[]> {
    const rows = await this.db
      .select({ org: schema.organizations })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMembers.orgId, schema.organizations.id),
      )
      .where(
        and(
          eq(schema.organizationMembers.userId, userId),
          eq(schema.organizationMembers.status, 'active'),
        ),
      )
      .orderBy(asc(schema.organizations.name));
    return rows.map((r) => r.org);
  }

  async getActiveMembership(
    userId: string,
    orgId: string,
  ): Promise<schema.OrganizationMember | null> {
    const [row] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.orgId, orgId),
          eq(schema.organizationMembers.userId, userId),
          eq(schema.organizationMembers.status, 'active'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async requireMembership(
    userId: string,
    orgId: string,
    minRole: OrgMemberRole = 'member',
  ): Promise<schema.OrganizationMember> {
    const membership = await this.getActiveMembership(userId, orgId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException('Insufficient organization permissions');
    }
    return membership;
  }

  async addOwner(
    orgId: string,
    user: schema.User,
  ): Promise<schema.OrganizationMember> {
    const [row] = await this.db
      .insert(schema.organizationMembers)
      .values({
        orgId,
        userId: user.id,
        role: 'owner',
        status: 'active',
        email: user.email.trim().toLowerCase(),
        acceptedAt: new Date(),
        token: null,
      })
      .returning();
    return row;
  }

  async listMembers(
    orgId: string,
    type?: 'member' | 'invitation' | 'all',
  ): Promise<UnifiedMember[]> {
    const rows = await this.db
      .select({
        member: schema.organizationMembers,
        user: schema.users,
      })
      .from(schema.organizationMembers)
      .leftJoin(
        schema.users,
        eq(schema.organizationMembers.userId, schema.users.id),
      )
      .where(eq(schema.organizationMembers.orgId, orgId))
      .orderBy(asc(schema.organizationMembers.createdAt));

    return rows
      .map(({ member, user }) => {
        const isInvitation = member.status === 'invited';
        return {
          id: member.id,
          type: (isInvitation ? 'invitation' : 'member') as
            | 'member'
            | 'invitation',
          orgId: member.orgId,
          role: member.role,
          status: member.status,
          email: member.email,
          message: member.message,
          invitedAt: member.invitedAt,
          acceptedAt: member.acceptedAt,
          createdAt: member.createdAt,
          user: user
            ? {
                id: user.id,
                email: user.email,
                name: user.name ?? null,
                avatar: user.avatar ?? null,
              }
            : null,
        };
      })
      .filter((row) => {
        if (!type || type === 'all') return true;
        return row.type === type;
      });
  }

  async invite(input: {
    orgId: string;
    email: string;
    role: 'admin' | 'member';
    message?: string;
    invitedByUserId: string;
  }): Promise<UnifiedMember> {
    const email = input.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('Email is required');

    const [existing] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.orgId, input.orgId),
          eq(schema.organizationMembers.email, email),
        ),
      )
      .limit(1);

    if (existing?.status === 'active') {
      throw new ConflictException('This user is already a member');
    }
    if (existing?.status === 'invited') {
      throw new ConflictException(
        'An invitation is already pending for this email',
      );
    }

    const existingUser = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existingUser) {
      const [activeElsewhere] = await this.db
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.orgId, input.orgId),
            eq(schema.organizationMembers.userId, existingUser.id),
            eq(schema.organizationMembers.status, 'active'),
          ),
        )
        .limit(1);
      if (activeElsewhere) {
        throw new ConflictException('This user is already a member');
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const [row] = await this.db
      .insert(schema.organizationMembers)
      .values({
        orgId: input.orgId,
        userId: null,
        role: input.role,
        status: 'invited',
        email,
        token,
        message: input.message?.trim() || null,
        invitedByUserId: input.invitedByUserId,
        invitedAt: new Date(),
      })
      .returning();

    await this.sendInviteEmail({
      email,
      token,
      orgId: input.orgId,
      role: input.role,
      message: input.message,
    });

    return {
      id: row.id,
      type: 'invitation',
      orgId: row.orgId,
      role: row.role,
      status: row.status,
      email: row.email,
      message: row.message,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt,
      createdAt: row.createdAt,
      user: null,
    };
  }

  async resend(orgId: string, memberId: string): Promise<UnifiedMember> {
    const member = await this.getById(orgId, memberId);
    if (member.status !== 'invited' || !member.token) {
      throw new BadRequestException('Only pending invitations can be resent');
    }
    const token = crypto.randomBytes(32).toString('hex');
    const [row] = await this.db
      .update(schema.organizationMembers)
      .set({
        token,
        invitedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.organizationMembers.id, memberId))
      .returning();

    await this.sendInviteEmail({
      email: row.email,
      token,
      orgId,
      role: row.role === 'owner' ? 'admin' : row.role,
      message: row.message ?? undefined,
    });

    return {
      id: row.id,
      type: 'invitation',
      orgId: row.orgId,
      role: row.role,
      status: row.status,
      email: row.email,
      message: row.message,
      invitedAt: row.invitedAt,
      acceptedAt: row.acceptedAt,
      createdAt: row.createdAt,
      user: null,
    };
  }

  async remove(
    orgId: string,
    memberId: string,
    actorUserId: string,
  ): Promise<void> {
    const member = await this.getById(orgId, memberId);
    if (member.userId && member.userId === actorUserId) {
      throw new BadRequestException('You cannot remove yourself');
    }
    if (member.role === 'owner' && member.status === 'active') {
      throw new BadRequestException(
        'Cannot remove an owner. Transfer ownership first.',
      );
    }
    await this.db
      .delete(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, memberId));
  }

  async changeRole(
    orgId: string,
    memberId: string,
    role: 'admin' | 'member',
  ): Promise<UnifiedMember> {
    const member = await this.getById(orgId, memberId);
    if (member.status !== 'active') {
      throw new BadRequestException('Can only change role for active members');
    }
    if (member.role === 'owner') {
      throw new BadRequestException(
        'Use transfer ownership to change the owner',
      );
    }
    const [row] = await this.db
      .update(schema.organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.organizationMembers.id, memberId))
      .returning();
    return this.toUnified(row);
  }

  async transferOwnership(
    orgId: string,
    fromUserId: string,
    toMemberId: string,
  ): Promise<void> {
    const actor = await this.requireMembership(fromUserId, orgId, 'owner');
    const target = await this.getById(orgId, toMemberId);
    if (target.status !== 'active' || !target.userId) {
      throw new BadRequestException('Target must be an active member');
    }
    if (target.userId === fromUserId) {
      throw new BadRequestException('Already the owner');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.organizationMembers)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(schema.organizationMembers.id, actor.id));
      await tx
        .update(schema.organizationMembers)
        .set({ role: 'owner', updatedAt: new Date() })
        .where(eq(schema.organizationMembers.id, target.id));
    });
  }

  async getInviteByToken(token: string): Promise<{
    id: string;
    email: string;
    role: OrgMemberRole;
    org: { id: string; name: string; slug: string };
    status: 'active' | 'invited';
  }> {
    const [row] = await this.db
      .select({
        member: schema.organizationMembers,
        org: schema.organizations,
      })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMembers.orgId, schema.organizations.id),
      )
      .where(eq(schema.organizationMembers.token, token))
      .limit(1);

    if (!row) throw new NotFoundException('Invitation not found');
    if (row.member.status !== 'invited') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    return {
      id: row.member.id,
      email: row.member.email,
      role: row.member.role,
      status: row.member.status,
      org: {
        id: row.org.id,
        name: row.org.name,
        slug: row.org.slug,
      },
    };
  }

  async acceptInvite(input: {
    token: string;
    userId?: string;
    password?: string;
    name?: string;
  }): Promise<{
    membership: schema.OrganizationMember;
    user: schema.User;
    createdUser: boolean;
  }> {
    const [row] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.token, input.token))
      .limit(1);

    if (!row || row.status !== 'invited') {
      throw new NotFoundException('Invitation not found or already accepted');
    }

    let user: schema.User | null = null;
    let createdUser = false;

    if (input.userId) {
      user = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, input.userId))
        .limit(1)
        .then((r) => r[0] ?? null);
      if (!user) throw new ForbiddenException('Not authenticated');
      if (user.email.trim().toLowerCase() !== row.email) {
        throw new ForbiddenException(
          'Signed-in email does not match the invitation',
        );
      }
    } else {
      user = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, row.email))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!user) {
        if (!input.password || input.password.length < 8) {
          throw new BadRequestException(
            'Password is required to create your account (min 8 characters)',
          );
        }
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(input.password, 10);
        const [created] = await this.db
          .insert(schema.users)
          .values({
            email: row.email,
            passwordHash,
            name: input.name?.trim() || null,
            role: 'member',
            isActive: true,
          })
          .returning();
        user = created;
        createdUser = true;
      } else if (input.password) {
        const bcrypt = await import('bcryptjs');
        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) {
          throw new ForbiddenException('Invalid password for existing account');
        }
      } else {
        throw new BadRequestException(
          'Sign in or provide your password to accept this invitation',
        );
      }
    }

    const [updated] = await this.db
      .update(schema.organizationMembers)
      .set({
        userId: user.id,
        status: 'active',
        acceptedAt: new Date(),
        token: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.organizationMembers.id, row.id))
      .returning();

    return { membership: updated, user, createdUser };
  }

  private async getById(
    orgId: string,
    memberId: string,
  ): Promise<schema.OrganizationMember> {
    const [row] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.id, memberId),
          eq(schema.organizationMembers.orgId, orgId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  private async countOwners(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ id: schema.organizationMembers.id })
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.orgId, orgId),
          eq(schema.organizationMembers.role, 'owner'),
          eq(schema.organizationMembers.status, 'active'),
        ),
      );
    return rows.length;
  }

  private async toUnified(
    member: schema.OrganizationMember,
  ): Promise<UnifiedMember> {
    let user: UnifiedMember['user'] = null;
    if (member.userId) {
      const [u] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, member.userId))
        .limit(1);
      if (u) {
        user = {
          id: u.id,
          email: u.email,
          name: u.name ?? null,
          avatar: u.avatar ?? null,
        };
      }
    }
    return {
      id: member.id,
      type: member.status === 'invited' ? 'invitation' : 'member',
      orgId: member.orgId,
      role: member.role,
      status: member.status,
      email: member.email,
      message: member.message,
      invitedAt: member.invitedAt,
      acceptedAt: member.acceptedAt,
      createdAt: member.createdAt,
      user,
    };
  }

  private async sendInviteEmail(input: {
    email: string;
    token: string;
    orgId: string;
    role: string;
    message?: string | null;
  }): Promise<void> {
    const org = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, input.orgId))
      .limit(1)
      .then((r) => r[0]);

    const adminAppUrl = (
      process.env.ADMIN_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'http://localhost:6200'
    ).replace(/\/$/, '');
    const acceptUrl = `${adminAppUrl}/auth/invitation/${input.token}`;
    const orgName = org?.name ?? 'the organization';
    const subject = `You've been invited to join ${orgName}`;
    const text = [
      `You've been invited to join ${orgName} as ${input.role}.`,
      input.message ? `\nMessage: ${input.message}\n` : '',
      `Accept your invitation: ${acceptUrl}`,
    ].join('\n');

    const host = process.env.SMTP_HOST || process.env.INVITE_SMTP_HOST;
    if (!host) {
      this.logger.warn(
        `No SMTP_HOST configured. Invite for ${input.email}: ${acceptUrl}`,
      );
      return;
    }

    const port = Number(
      process.env.SMTP_PORT || process.env.INVITE_SMTP_PORT || 1025,
    );
    const from =
      process.env.SMTP_FROM ||
      process.env.INVITE_SMTP_FROM ||
      'noreply@storage.local';

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer') as {
        createTransport: (opts: Record<string, unknown>) => {
          sendMail: (opts: Record<string, unknown>) => Promise<unknown>;
        };
      };
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        ...(process.env.SMTP_USER
          ? {
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            }
          : {}),
      });
      await transporter.sendMail({
        from,
        to: input.email,
        subject,
        text,
        html: `<p>You've been invited to join <strong>${orgName}</strong> as <strong>${input.role}</strong>.</p>
${input.message ? `<p>${input.message}</p>` : ''}
<p><a href="${acceptUrl}">Accept invitation</a></p>`,
      });
    } catch (error) {
      this.logger.warn(
        {
          email: input.email,
          acceptUrl,
          error: error instanceof Error ? error.message : String(error),
        },
        'Invite email send failed; link logged for recovery',
      );
    }
  }
}
