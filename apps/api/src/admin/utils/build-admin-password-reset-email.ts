export type AdminPasswordResetEmailInput = {
  /** Product / console name shown in the header, e.g. "Email Service". */
  serviceName: string;
  temporaryPassword: string;
  recipientEmail: string;
  recipientName?: string | null;
  /** Absolute URL to the admin login page. */
  signInUrl?: string | null;
  supportEmail?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Polished transactional HTML for admin temporary-password resets.
 * Table-based layout for broad email-client support.
 */
export function buildAdminPasswordResetEmail(
  input: AdminPasswordResetEmailInput,
): { subject: string; text: string; html: string } {
  const serviceName = input.serviceName.trim() || 'Admin Console';
  const email = input.recipientEmail.trim();
  const name = (input.recipientName ?? '').trim();
  const greetingName = name || email || 'there';
  const password = input.temporaryPassword;
  const signInUrl = (input.signInUrl ?? '').trim().replace(/\/$/, '');
  const supportEmail = (input.supportEmail ?? '').trim();
  const year = new Date().getFullYear();

  const subject = `${serviceName}: your temporary password`;

  const text = [
    `Hi ${greetingName},`,
    '',
    `We reset your ${serviceName} admin password.`,
    `Temporary password: ${password}`,
    '',
    signInUrl ? `Sign in: ${signInUrl}` : null,
    'After signing in, open Profile and change your password immediately.',
    '',
    'If you did not request this reset, contact your administrator right away.',
    supportEmail ? `Support: ${supportEmail}` : null,
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const safeService = escapeHtml(serviceName);
  const safeGreeting = escapeHtml(greetingName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);
  const safeSignIn = signInUrl ? escapeHtml(signInUrl) : '';
  const safeSupport = supportEmail ? escapeHtml(supportEmail) : '';

  const ctaBlock = safeSignIn
    ? `
                  <tr>
                    <td align="center" style="padding:0 0 28px;">
                      <a href="${safeSignIn}"
                         style="display:inline-block;background-color:#09090b;color:#fafafa;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:600;line-height:1;padding:14px 28px;border-radius:8px;border:1px solid #09090b;">
                        Sign in to ${safeService}
                      </a>
                    </td>
                  </tr>`
    : '';

  const signInFallback = safeSignIn
    ? `
                  <tr>
                    <td style="padding:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#71717a;">
                      Or open this link in your browser:<br />
                      <a href="${safeSignIn}" style="color:#09090b;word-break:break-all;">${safeSignIn}</a>
                    </td>
                  </tr>`
    : '';

  const supportLine = safeSupport
    ? `Questions? Reach us at <a href="mailto:${safeSupport}" style="color:#71717a;text-decoration:underline;">${safeSupport}</a>.`
    : 'If you did not request this change, contact your administrator immediately.';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${safeService} — temporary password</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">
    Your ${safeService} temporary password is ready. Sign in and change it right away.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#18181b 0%,#3f3f46 100%);background-color:#18181b;padding:32px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#a1a1aa;">
                    ${safeService}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:26px;font-weight:700;line-height:1.25;color:#fafafa;">
                    Temporary password ready
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.55;color:#d4d4d8;">
                    Use this one-time sign-in password, then update it from your profile.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#3f3f46;">
                    Hi <strong style="color:#09090b;">${safeGreeting}</strong>,
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;color:#52525b;">
                    A password reset was requested for the admin account
                    <strong style="color:#09090b;">${safeEmail || safeGreeting}</strong>.
                    Your previous password no longer works.
                  </td>
                </tr>

                <!-- Password card -->
                <tr>
                  <td style="padding:0 0 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
                      <tr>
                        <td style="padding:22px 24px;text-align:center;">
                          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#71717a;margin-bottom:12px;">
                            Temporary password
                          </div>
                          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:0.06em;line-height:1.4;color:#09090b;word-break:break-all;">
                            ${safePassword}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${ctaBlock}
                ${signInFallback}

                <!-- Steps -->
                <tr>
                  <td style="padding:0 0 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                      <tr>
                        <td style="padding:20px 22px;">
                          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:12px;">
                            What to do next
                          </div>
                          <ol style="margin:0;padding-left:18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.7;color:#475569;">
                            <li>Sign in with your email and the temporary password above.</li>
                            <li>Open <strong>Profile</strong> and choose a new password.</li>
                            <li>Store the new password securely — this temporary one will stop working after you change it.</li>
                          </ol>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Warning -->
                <tr>
                  <td style="padding:0 0 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;">
                      <tr>
                        <td style="padding:14px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.55;color:#92400e;">
                          <strong style="color:#78350f;">Security note:</strong>
                          Anyone with this password can access the admin console until you change it.
                          Do not forward this email.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;border-top:1px solid #e4e4e7;padding:24px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#a1a1aa;">
                © ${year} ${safeService}. This message was sent because a password reset was requested.
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#a1a1aa;">
                ${supportLine}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function resolveAdminSignInUrl(fallbackPortHint?: string): string {
  const raw =
    process.env.ADMIN_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (fallbackPortHint ? `http://localhost:${fallbackPortHint}` : '');
  if (!raw) return '';
  const base = raw.replace(/\/$/, '');
  if (/\/auth\/login\/?$/i.test(base)) return base;
  return `${base}/auth/login`;
}
