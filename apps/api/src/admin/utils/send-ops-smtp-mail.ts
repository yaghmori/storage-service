/**
 * Direct nodemailer send for ops flows (invites, forgot-password).
 * Uses SMTP_HOST / INVITE_SMTP_* — when unset, caller should keep logging.
 */
export async function sendOpsSmtpMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  defaultFrom: string;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const host = process.env.SMTP_HOST || process.env.INVITE_SMTP_HOST;
  if (!host?.trim()) {
    return 'skipped';
  }

  const port = Number(process.env.SMTP_PORT || process.env.INVITE_SMTP_PORT || 1025);
  const from =
    process.env.SMTP_FROM || process.env.INVITE_SMTP_FROM || input.defaultFrom;

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
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return 'sent';
  } catch {
    return 'failed';
  }
}
