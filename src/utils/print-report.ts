/**
 * Universal Isolated Print & PDF Engine for AccountFlow ERP Reports & Documents
 * Creates a clean, standalone printable iframe/window with exact styling,
 * avoiding layout interference, sidebar overflow, and unwanted page breaks.
 */

export interface PrintReportOptions {
  targetId?: string
  title?: string
  businessName?: string
  isAr?: boolean
  customCss?: string
}

export function printElement(elementIdOrElement: string | HTMLElement, options: PrintReportOptions = {}) {
  let element: HTMLElement | null = null

  if (typeof elementIdOrElement === 'string') {
    element = document.getElementById(elementIdOrElement)
  } else {
    element = elementIdOrElement
  }

  if (!element) {
    window.print()
    return
  }

  const isAr = options.isAr ?? document.documentElement.getAttribute('dir') === 'rtl'
  const title = options.title || document.title || 'AccountFlow Report'
  const businessName = options.businessName || 'AccountFlow ERP'

  const printWindow = window.open('', '_blank', 'width=1024,height=1200')
  if (!printWindow) {
    window.print()
    return
  }

  const contentHtml = element.innerHTML

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="utf-8" />
      <title>${title} - ${businessName}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
      <style>
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          margin: 0;
          padding: 0;
        }

        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        body {
          font-family: ${isAr ? "'Cairo', " : ""}'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #ffffff !important;
          color: #0f172a !important;
          padding: 0;
          margin: 0;
          font-size: 11px;
          line-height: 1.35;
        }

        .no-print, button, form, nav, aside, header {
          display: none !important;
        }

        .report-paper-card, .printable-card, .document-paper {
          width: 100% !important;
          max-width: 100% !important;
          background: #ffffff !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        .brand-logo-badge {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .meta-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 8px;
        }

        .meta-pill-label {
          font-size: 9px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
        }

        .meta-pill-val {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
        }

        .kpi-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
          margin-bottom: 16px;
        }

        .kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kpi-card-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .kpi-card-label {
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .kpi-card-value {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          font-family: 'Outfit', sans-serif;
          margin: 2px 0;
        }

        .growth-badge {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 10px;
          font-weight: 700;
          color: #16a34a;
        }

        .statement-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }

        .section-header-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 6px;
          font-family: 'Outfit', sans-serif;
        }

        .statement-table, table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
        }

        thead tr {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        th {
          padding: 6px 8px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
        }

        td {
          padding: 5px 8px;
          color: #334155;
          border-bottom: 1px solid #f1f5f9;
        }

        .group-header-row td {
          padding: 5px 8px;
          font-size: 10.5px;
          background: #f8fafc;
          font-weight: 700;
        }

        .total-bar-blue {
          background: #2563eb !important;
          color: #ffffff !important;
          padding: 8px 12px;
          border-radius: 8px;
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .analytics-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
        }

        .analytics-title {
          font-size: 12px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 0;
          margin-bottom: 8px;
          font-family: 'Outfit', sans-serif;
        }

        .report-footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          color: #64748b;
        }

        ${options.customCss || ''}
      </style>
    </head>
    <body>
      <div class="report-paper-card">
        ${contentHtml}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 300);
        };
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
}
