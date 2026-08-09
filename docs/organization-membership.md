# Organization membership

Canonical patterns match notification-service. See also the [README membership section](../README.md#organization-membership).

## Role model

1. **Platform role** (`users.role`): `admin` = can create organizations; default for new users is `member`.
2. **Org role** (`organization_members.role`): `owner` | `admin` | `member`.

## Invite environment

| Env | Purpose |
| --- | ------- |
| `ADMIN_APP_URL` | Base URL for invite accept links |
| `SMTP_HOST` / `SMTP_PORT` | Invite SMTP |
| `INVITE_SMTP_HOST` / `INVITE_SMTP_PORT` / `INVITE_SMTP_FROM` | Invite-specific overrides |

If SMTP is unset, the API logs the accept URL instead of sending mail.

## Guarded org-scoped admin surfaces

Membership is required for: files, jobs, providers, processor-backends, analytics, dashboard, api-keys, org limits/usage/processors, and org settings mutations.
