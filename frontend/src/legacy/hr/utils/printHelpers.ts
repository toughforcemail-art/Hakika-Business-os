// @ts-nocheck
type PrintWorkspaceOptions = {
  title?: string;
  subtitle?: string;
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const resolveDefaultTitle = () => {
  const heading = document.querySelector('main h1');
  const text = heading?.textContent?.trim();
  return text || document.title || 'Workspace Statement';
};

const resolveDefaultSubtitle = () => {
  const today = new Date();
  return `Generated ${today.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
};

const resolveCompanyBrand = () => {
  const companyNameNode =
    document.querySelector('[data-print-company-name]') ||
    document.querySelector('[data-company-name]') ||
    document.querySelector('header h1, header h2');
  const logoNode =
    document.querySelector('[data-print-company-logo]') ||
    document.querySelector('header img[alt*="logo" i]') ||
    document.querySelector('header img[src*="logo"]') ||
    document.querySelector('img[alt*="logo" i]') ||
    document.querySelector('img[src*="logo"]');

  const companyName =
    companyNameNode?.getAttribute?.('data-print-company-name')?.trim() ||
    companyNameNode?.getAttribute?.('data-company-name')?.trim() ||
    companyNameNode?.textContent?.trim() ||
    document.title;

  const logoSrc =
    logoNode?.getAttribute?.('data-print-company-logo')?.trim() ||
    logoNode?.getAttribute?.('src') ||
    '/tough_force_logo.webp';

  return {
    companyName,
    logoSrc,
  };
};

const collectStyles = () => {
  const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  return styleNodes
    .map((node) => {
      if (node.tagName.toLowerCase() === 'style') {
        return `<style>${(node as HTMLStyleElement).innerHTML}</style>`;
      }
      const link = node as HTMLLinkElement;
      return `<link rel="stylesheet" href="${link.href}" />`;
    })
    .join('\n');
};

export const printDocument = (options: { title: string; subtitle?: string; bodyHtml: string; footerHtml?: string }) => {
  const brand = resolveCompanyBrand();
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(options.title)}</title>
        ${collectStyles()}
        <style>
          body { background: #ffffff; color: #0f172a; margin: 0; padding: 32px; }
          .print-header { margin-bottom: 24px; }
          .print-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
          .print-brand img { width: 48px; height: 48px; object-fit: contain; border-radius: 12px; }
          .print-brand .print-brand-copy { min-width: 0; }
          .print-brand .print-brand-copy strong { display: block; font-size: 15px; line-height: 1.2; }
          .print-brand .print-brand-copy span { display: block; margin-top: 3px; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .18em; }
          .print-header h1 { font-size: 24px; margin: 0 0 6px; }
          .print-header p { margin: 0; font-size: 12px; color: #475569; }
          .print-footer { margin-top: 24px; font-size: 11px; color: #64748b; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="print-brand">
          <img src="${escapeHtml(brand.logoSrc)}" alt="Company logo" />
          <div class="print-brand-copy">
            <strong>${escapeHtml(brand.companyName)}</strong>
            <span>Company details</span>
          </div>
        </div>
        <div class="print-header">
          <h1>${escapeHtml(options.title)}</h1>
          ${options.subtitle ? `<p>${escapeHtml(options.subtitle)}</p>` : ''}
        </div>
        <div class="print-body">
          ${options.bodyHtml}
        </div>
        ${options.footerHtml ? `<div class="print-footer">${options.footerHtml}</div>` : ''}
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

export const printWorkspacePage = (options: PrintWorkspaceOptions = {}) => {
  const title = options.title || resolveDefaultTitle();
  const subtitle = options.subtitle || resolveDefaultSubtitle();
  const main = document.querySelector('main');
  const contentHtml = main ? main.innerHTML : document.body.innerHTML;
  printDocument({ title, subtitle, bodyHtml: contentHtml });
};
