// @ts-nocheck
import { invokeEdgeFunction } from '../utils/edgeFunctions';

const MARKETING_INBOX = 'director@hakikarealestate.co.ke';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type MarketingField = {
  label: string;
  value: string;
};

type MarketingEmailPayload = {
  subject: string;
  fields: MarketingField[];
  message?: string;
};

const renderEmailHtml = ({ subject, fields, message }: MarketingEmailPayload) => {
  const fieldsMarkup = fields
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:10px 0;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;color:#0f172a;font-size:15px;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join('');

  const messageMarkup = message
    ? `
      <div style="margin-top:24px;padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
        <div style="color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Message</div>
        <div style="color:#0f172a;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</div>
      </div>
    `
    : '';

  return `
    <div style="background:#f8fafc;padding:32px;font-family:Outfit,Segoe UI,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.18em;color:#ec4899;margin-bottom:12px;">HAKIKA Website</div>
        <h1 style="margin:0 0 20px;color:#0f172a;font-size:28px;line-height:1.2;">${escapeHtml(subject)}</h1>
        <table style="width:100%;border-collapse:collapse;">
          ${fieldsMarkup}
        </table>
        ${messageMarkup}
      </div>
    </div>
  `;
};

const renderEmailText = ({ subject, fields, message }: MarketingEmailPayload) => {
  const lines = [subject, ''];
  for (const field of fields) {
    lines.push(`${field.label}: ${field.value}`);
  }
  if (message) {
    lines.push('', 'Message:', message);
  }
  return lines.join('\n');
};

export const sendMarketingEmail = async (payload: MarketingEmailPayload) =>
  invokeEdgeFunction(
    'send-email',
    {
      to: MARKETING_INBOX,
      subject: payload.subject,
      html: renderEmailHtml(payload),
      text: renderEmailText(payload),
      module: 'public-site',
    },
    { allowAnon: true },
  );
