import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('Missing RESEND_API_KEY environment variable');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_TEMPLATES = {
  teamInvite: (shopName: string, role: string, inviteUrl: string) => ({
    subject: `Join ${shopName} on Crevis`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; rounded: 8px;">
        <h2 style="color: #333;">You've been invited!</h2>
        <p style="font-size: 16px; color: #555;">
          The owner of <strong>${shopName}</strong> has invited you to join their team as a <strong>${role.replace('_', ' ')}</strong>.
        </p>
        <div style="margin: 30px 0;">
          <a href="${inviteUrl}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p style="font-size: 14px; color: #999;">
          If the button above doesn't work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">
          ${inviteUrl}
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">
          This link will expire in 7 days.
        </p>
      </div>
    `,
  }),
};
