// ============================================
// AgencyManager Pro - PDF Generator (window.print)
// ============================================
// Uses the browser's native print engine to generate branded PDFs.
// Adapted from Signals OS — the ONLY approach that reliably renders
// Hebrew/RTL text on all platforms (PC + mobile).
//
// How it works:
// 1. Build styled HTML for the document
// 2. Wrap in full HTML document with embedded Heebo font (@font-face)
// 3. Open a new window with the preview + print button
// 4. User saves as PDF from print dialog

import { HEEBO_REGULAR_BASE64 } from './heeboFont';
import type { Client, AgencySettings, OneTimeDeal, Payment, SignalsPersonality } from '../types';

// ── Brand Config Interface ───────────────────────────────────────────────

export interface BrandConfig {
  agencyName: string;
  ownerName: string;
  logoUrl?: string;
  primaryColor: string;   // hex
  secondaryColor: string;  // hex
  accentColor: string;     // hex
}

export function getBrandConfig(settings: AgencySettings): BrandConfig {
  return {
    agencyName: settings.agencyName,
    ownerName: settings.ownerName,
    logoUrl: settings.logoUrl,
    primaryColor: settings.brandPrimaryColor || '#14b8a6',
    secondaryColor: settings.brandSecondaryColor || '#0f766e',
    accentColor: settings.brandAccentColor || '#f59e0b',
  };
}

// ── HTML Helpers ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrencyPdf(amount: number): string {
  return '₪' + amount.toLocaleString('he-IL');
}

function formatDatePdf(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ── Shared Components ────────────────────────────────────────────────────

function buildHeader(brand: BrandConfig, title: string, subtitle?: string): string {
  const logoHtml = brand.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" style="height:48px;width:auto;object-fit:contain;" alt="logo" />`
    : '';

  return `
    <!-- Accent bar -->
    <div style="height:6px;background:linear-gradient(to left,${brand.primaryColor},${brand.secondaryColor});width:100%;"></div>

    <div style="padding:20px 28px 0;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-direction:row-reverse;margin-bottom:12px;">
        <div style="text-align:right;">
          <div style="font-size:20px;font-weight:700;color:#1e293b;">${escapeHtml(title)}</div>
          ${subtitle ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          ${logoHtml}
          <div style="text-align:left;">
            <div style="font-size:11px;font-weight:600;color:${brand.primaryColor};">${escapeHtml(brand.agencyName)}</div>
            <div style="font-size:9px;color:#94a3b8;">${escapeHtml(brand.ownerName)}</div>
          </div>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">
    </div>
  `;
}

function buildSection(brand: BrandConfig, title: string, content: string): string {
  return `
    <div style="margin:14px 28px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-direction:row-reverse;">
        <div style="width:3px;height:16px;background:${brand.primaryColor};border-radius:2px;flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:600;color:#1e293b;">${escapeHtml(title)}</span>
      </div>
      <div style="font-size:10px;color:#475569;line-height:1.8;white-space:pre-wrap;text-align:right;">${content}</div>
    </div>
  `;
}

function buildKpiRow(items: Array<{ label: string; value: string; color?: string }>): string {
  const boxes = items.map(item => `
    <div style="flex:1;text-align:center;padding:10px 6px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <div style="font-size:16px;font-weight:700;color:${item.color || '#1e293b'};">${escapeHtml(item.value)}</div>
      <div style="font-size:9px;color:#94a3b8;margin-top:3px;">${escapeHtml(item.label)}</div>
    </div>
  `).join('');

  return `
    <div style="display:flex;gap:10px;margin:12px 28px;direction:ltr;">
      ${boxes}
    </div>
  `;
}

function buildTable(headers: string[], rows: string[][], brand: BrandConfig): string {
  const thStyle = `font-size:9px;font-weight:600;color:#64748b;padding:8px 10px;text-align:right;border-bottom:2px solid ${brand.primaryColor}20;background:#f8fafc;`;
  const tdStyle = `font-size:10px;color:#475569;padding:7px 10px;text-align:right;border-bottom:1px solid #f1f5f9;`;

  const headerCells = headers.map(h => `<th style="${thStyle}">${escapeHtml(h)}</th>`).join('');
  const bodyRows = rows.map((row, i) => {
    const bg = i % 2 === 0 ? '' : 'background:#fafbfc;';
    const cells = row.map(cell => `<td style="${tdStyle}${bg}">${escapeHtml(cell)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <div style="margin:12px 28px;page-break-inside:avoid;">
      <table style="width:100%;border-collapse:collapse;direction:rtl;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function buildFooter(brand: BrandConfig): string {
  const now = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `
    <div style="margin:20px 28px 16px;padding-top:12px;border-top:1px solid #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:center;direction:rtl;">
        <div style="font-size:8px;color:#94a3b8;">מסמך זה הופק באופן אוטומטי · ${escapeHtml(now)}</div>
        <div style="font-size:8px;color:${brand.primaryColor};font-weight:600;">${escapeHtml(brand.agencyName)}</div>
      </div>
    </div>
  `;
}

// ── Print Document Wrapper ───────────────────────────────────────────────

function wrapInPrintDocument(reportHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @font-face {
      font-family: 'Heebo';
      src: url(data:font/truetype;base64,${HEEBO_REGULAR_BASE64}) format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Heebo', 'Segoe UI', 'Arial', sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      padding-top: 60px;
      direction: rtl;
    }
    .report-container {
      max-width: 210mm;
      margin: 16px auto;
      background: #fff;
      box-shadow: 0 1px 6px rgba(0,0,0,0.08);
      border-radius: 8px;
      overflow: hidden;
    }
    .print-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 50px;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      direction: rtl;
    }
    .print-bar button {
      background: #14b8a6;
      color: #fff;
      border: none;
      padding: 8px 28px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Heebo', 'Segoe UI', 'Arial', sans-serif;
      cursor: pointer;
      transition: background 0.2s;
    }
    .print-bar button:hover {
      background: #0d9488;
    }
    .print-bar span {
      color: #94a3b8;
      font-size: 12px;
      font-family: 'Heebo', 'Segoe UI', 'Arial', sans-serif;
    }
    @page {
      size: A4;
      margin: 10mm;
    }
    @media print {
      body { padding-top: 0; background: #fff; }
      .print-bar { display: none !important; }
      .report-container { box-shadow: none; border-radius: 0; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button onclick="window.print()">🖨️ שמור כ-PDF</button>
    <span>לחץ לשמירה כ-PDF או הדפסה</span>
  </div>
  <div class="report-container">
    ${reportHtml}
  </div>
</body>
</html>`;
}

// ── Window Management ────────────────────────────────────────────────────

function openPreviewWindow(fullHtml: string): void {
  const previewWindow = window.open('', '_blank');

  if (!previewWindow) {
    // Popup blocker — fallback: blob URL
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }

  previewWindow.document.open();
  previewWindow.document.write(fullHtml);
  previewWindow.document.close();
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC API — Document Types
// ══════════════════════════════════════════════════════════════════════════

// ── 1. Client Work Plan (תוכנית עבודה) ──────────────────────────────────

export interface WorkPlanData {
  client: Client;
  services: string[];
  deals: OneTimeDeal[];
  monthlyPayments: Payment[];
  notes?: string;
  goals?: string[];
  timeline?: Array<{ month: string; task: string }>;
}

export function generateWorkPlanPdf(data: WorkPlanData, brand: BrandConfig): void {
  const { client } = data;

  // Header
  let html = buildHeader(brand, `תוכנית עבודה — ${client.clientName}`, `${client.businessName || ''} · ${formatDatePdf(new Date().toISOString())}`);

  // Client KPIs
  html += buildKpiRow([
    { label: 'ריטיינר חודשי', value: formatCurrencyPdf(client.monthlyRetainer), color: brand.primaryColor },
    { label: 'דירוג', value: client.rating.replace('_', '+') },
    { label: 'סטטוס', value: client.status },
    { label: 'תאריך הצטרפות', value: formatDatePdf(client.joinDate) },
  ]);

  // Services
  if (data.services.length > 0) {
    const servicesList = data.services.map(s => `<div style="display:inline-block;background:${brand.primaryColor}12;color:${brand.primaryColor};font-size:10px;padding:4px 12px;border-radius:6px;margin:2px;">${escapeHtml(s)}</div>`).join('');
    html += `
      <div style="margin:14px 28px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-direction:row-reverse;">
          <div style="width:3px;height:16px;background:${brand.primaryColor};border-radius:2px;flex-shrink:0;"></div>
          <span style="font-size:13px;font-weight:600;color:#1e293b;">שירותים פעילים</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;direction:rtl;">${servicesList}</div>
      </div>
    `;
  }

  // Goals
  if (data.goals && data.goals.length > 0) {
    const goalsHtml = data.goals.map((g, i) => `<div style="font-size:10px;color:#475569;margin-bottom:4px;">🎯 ${i + 1}. ${escapeHtml(g)}</div>`).join('');
    html += buildSection(brand, 'יעדים', goalsHtml);
  }

  // Timeline
  if (data.timeline && data.timeline.length > 0) {
    html += buildTable(
      ['חודש', 'משימה / אבן דרך'],
      data.timeline.map(t => [t.month, t.task]),
      brand
    );
  }

  // Deals
  if (data.deals.length > 0) {
    html += buildSection(brand, 'פרויקטים חד-פעמיים', '');
    html += buildTable(
      ['שם פרויקט', 'סכום', 'תאריך', 'סטטוס'],
      data.deals.map(d => [d.dealName, formatCurrencyPdf(d.dealAmount), formatDatePdf(d.dealDate), d.dealStatus]),
      brand
    );
  }

  // Notes
  if (data.notes) {
    html += buildSection(brand, 'הערות', escapeHtml(data.notes));
  }

  html += buildFooter(brand);

  const fullHtml = wrapInPrintDocument(html, `תוכנית עבודה — ${client.clientName}`);
  openPreviewWindow(fullHtml);
}

// ── 2. Client Financial Summary (סיכום כספי) ────────────────────────────

export interface FinancialSummaryData {
  client: Client;
  deals: OneTimeDeal[];
  payments: Payment[];
  expenses: Array<{ date: string; supplier: string; amount: number; type: string }>;
  monthsActive: number;
  ltv: number;
}

export function generateFinancialSummaryPdf(data: FinancialSummaryData, brand: BrandConfig): void {
  const { client } = data;
  const totalDeals = data.deals.reduce((s, d) => s + d.dealAmount, 0);
  const totalPaid = data.payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
  const profit = data.ltv - totalExpenses;

  let html = buildHeader(brand, `סיכום כספי — ${client.clientName}`, `${client.businessName || ''} · ${formatDatePdf(new Date().toISOString())}`);

  html += buildKpiRow([
    { label: 'LTV כולל', value: formatCurrencyPdf(data.ltv), color: brand.primaryColor },
    { label: 'פרויקטים', value: formatCurrencyPdf(totalDeals) },
    { label: 'שולם', value: formatCurrencyPdf(totalPaid), color: '#10b981' },
    { label: 'רווח נקי', value: formatCurrencyPdf(profit), color: profit >= 0 ? '#10b981' : '#ef4444' },
  ]);

  html += buildKpiRow([
    { label: 'ריטיינר חודשי', value: formatCurrencyPdf(client.monthlyRetainer) },
    { label: 'עלות ספקים חודשית', value: formatCurrencyPdf(client.supplierCostMonthly) },
    { label: 'חודשים פעילים', value: String(data.monthsActive) },
    { label: 'הוצאות סה"כ', value: formatCurrencyPdf(totalExpenses), color: '#ef4444' },
  ]);

  // Payments table
  if (data.payments.length > 0) {
    html += buildSection(brand, 'היסטוריית תשלומים', '');
    html += buildTable(
      ['תקופה', 'חיוב', 'שולם', 'סטטוס'],
      data.payments.slice(0, 12).map(p => [
        p.periodMonth,
        formatCurrencyPdf(p.amountDue),
        formatCurrencyPdf(p.amountPaid),
        p.paymentStatus === 'Paid' ? '✓ שולם' : p.paymentStatus === 'Partial' ? '⚠ חלקי' : '✗ לא שולם'
      ]),
      brand
    );
  }

  // Deals table
  if (data.deals.length > 0) {
    html += buildSection(brand, 'פרויקטים חד-פעמיים', '');
    html += buildTable(
      ['שם', 'סכום', 'תאריך', 'סטטוס'],
      data.deals.map(d => [d.dealName, formatCurrencyPdf(d.dealAmount), formatDatePdf(d.dealDate), d.dealStatus]),
      brand
    );
  }

  html += buildFooter(brand);

  const fullHtml = wrapInPrintDocument(html, `סיכום כספי — ${client.clientName}`);
  openPreviewWindow(fullHtml);
}

// ── 3. Personality Intelligence Report (דוח מודיעין אישיותי) ─────────

const ARCHETYPE_COLORS_PDF: Record<string, string> = {
  WINNER: '#f43f5e',
  STAR: '#f59e0b',
  DREAMER: '#8b5cf6',
  HEART: '#ec4899',
  ANCHOR: '#14b8a6',
};

const ARCHETYPE_NAMES_HE: Record<string, string> = {
  WINNER: 'ווינר',
  STAR: 'סטאר',
  DREAMER: 'חולם',
  HEART: 'לב',
  ANCHOR: 'עוגן',
};

export interface PersonalityPdfData {
  personality: SignalsPersonality;
  entityName: string;
  entityType: 'client' | 'lead';
}

export function generatePersonalityPdf(data: PersonalityPdfData, brand: BrandConfig): void {
  const { personality: p } = data;
  const v2 = p.businessIntelV2;
  const primaryColor = ARCHETYPE_COLORS_PDF[p.primaryArchetype] || brand.primaryColor;
  const primaryNameHe = ARCHETYPE_NAMES_HE[p.primaryArchetype] || p.primaryArchetype;
  const secondaryNameHe = ARCHETYPE_NAMES_HE[p.secondaryArchetype] || p.secondaryArchetype;

  let html = buildHeader(brand, `דוח מודיעין אישיותי — ${data.entityName}`, `${primaryNameHe} / ${secondaryNameHe} · Signals OS`);

  // Archetype badge + KPIs
  html += `
    <div style="text-align:center;margin:8px 28px 12px;">
      <span style="display:inline-block;background:${primaryColor};color:#fff;font-size:13px;font-weight:600;padding:6px 28px;border-radius:8px;">
        ${escapeHtml(primaryNameHe)} / ${escapeHtml(secondaryNameHe)}
      </span>
    </div>
  `;

  // Hero card from V2
  if (v2?.heroCard) {
    const hero = v2.heroCard;
    html += buildKpiRow([
      { label: 'סיכוי סגירה', value: `${hero.closeRate}%`, color: hero.closeRate >= 70 ? '#10b981' : hero.closeRate >= 40 ? '#f59e0b' : '#ef4444' },
      { label: 'דחיפות', value: hero.urgency, color: brand.accentColor },
      { label: 'רמת סיכון', value: hero.riskLevel },
      { label: 'כוכבי עדיפות', value: '⭐'.repeat(hero.priorityStars) },
    ]);

    if (hero.profileLine) {
      html += buildSection(brand, 'פרופיל', escapeHtml(hero.profileLine));
    }
    html += `
      <div style="margin:8px 28px;display:flex;gap:10px;direction:rtl;">
        <div style="flex:1;padding:8px 12px;background:#f0fdf4;border-radius:6px;border:1px solid #bbf7d0;">
          <div style="font-size:9px;color:#15803d;font-weight:600;margin-bottom:3px;">💪 חוזקה מובילה</div>
          <div style="font-size:10px;color:#166534;">${escapeHtml(hero.topStrength)}</div>
        </div>
        <div style="flex:1;padding:8px 12px;background:#fef2f2;border-radius:6px;border:1px solid #fecaca;">
          <div style="font-size:9px;color:#dc2626;font-weight:600;margin-bottom:3px;">⚠️ סיכון מוביל</div>
          <div style="font-size:10px;color:#991b1b;">${escapeHtml(hero.topRisk)}</div>
        </div>
      </div>
    `;
  }

  // Score bars
  const archetypes = ['WINNER', 'STAR', 'DREAMER', 'HEART', 'ANCHOR'];
  const maxScore = Math.max(...Object.values(p.scores), 1);
  const scoreBarsHtml = archetypes.map(arch => {
    const score = p.scores[arch as keyof typeof p.scores] || 0;
    const pct = Math.round((score / maxScore) * 100);
    const color = ARCHETYPE_COLORS_PDF[arch] || '#94a3b8';
    const isPrimary = arch === p.primaryArchetype;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;direction:ltr;">
        <span style="width:60px;font-size:9px;color:${isPrimary ? '#1e293b' : '#94a3b8'};font-weight:${isPrimary ? '700' : '400'};text-align:left;">${ARCHETYPE_NAMES_HE[arch] || arch}</span>
        <div style="flex:1;height:12px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;"></div>
        </div>
        <span style="width:24px;font-size:9px;color:${isPrimary ? '#1e293b' : '#94a3b8'};font-weight:${isPrimary ? '700' : '400'};text-align:right;">${score}</span>
      </div>
    `;
  }).join('');

  html += `<div style="margin:12px 28px;">${scoreBarsHtml}</div>`;

  // Quick Script from V2
  if (v2?.quickScript) {
    const qs = v2.quickScript;
    html += `
      <div style="margin:12px 28px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-direction:row-reverse;">
          <div style="width:3px;height:16px;background:${brand.primaryColor};border-radius:2px;flex-shrink:0;"></div>
          <span style="font-size:13px;font-weight:600;color:#1e293b;">תסריט מהיר</span>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:10px 14px;border:1px solid #e2e8f0;direction:rtl;">
          <div style="margin-bottom:6px;"><span style="font-size:9px;font-weight:600;color:${brand.primaryColor};">💬 פתיחה:</span> <span style="font-size:10px;color:#475569;">${escapeHtml(qs.opener)}</span></div>
          <div style="margin-bottom:6px;"><span style="font-size:9px;font-weight:600;color:${brand.accentColor};">❓ שאלת מפתח:</span> <span style="font-size:10px;color:#475569;">${escapeHtml(qs.keyQuestion)}</span></div>
          <div><span style="font-size:9px;font-weight:600;color:#10b981;">✅ סגירה:</span> <span style="font-size:10px;color:#475569;">${escapeHtml(qs.closeLine)}</span></div>
        </div>
      </div>
    `;
  }

  // Action Items from V2
  if (v2?.actionItems && v2.actionItems.length > 0) {
    const itemsHtml = v2.actionItems.map(item => `
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px;direction:rtl;">
        <div style="width:22px;height:22px;border-radius:50%;background:${brand.primaryColor};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${item.priority}</div>
        <div>
          <div style="font-size:10px;font-weight:600;color:#1e293b;">${escapeHtml(item.action)}</div>
          <div style="font-size:9px;color:#64748b;">למה: ${escapeHtml(item.why)}</div>
          <div style="font-size:9px;color:#64748b;">איך: ${escapeHtml(item.how)}</div>
        </div>
      </div>
    `).join('');
    html += buildSection(brand, 'פעולות מומלצות', itemsHtml);
  }

  // Red Flags
  if (v2?.redFlags && v2.redFlags.length > 0) {
    const flagsHtml = v2.redFlags.map(f => `<div style="font-size:10px;color:#dc2626;margin-bottom:3px;">🚩 ${escapeHtml(f)}</div>`).join('');
    html += buildSection(brand, 'דגלים אדומים', flagsHtml);
  }

  // Smart Tags
  if (p.smartTags && p.smartTags.length > 0) {
    const tagsHtml = p.smartTags.map(t => `<span style="display:inline-block;background:#f1f5f9;color:#64748b;font-size:9px;padding:3px 10px;border-radius:4px;margin:2px;">${escapeHtml(t)}</span>`).join('');
    html += `<div style="margin:12px 28px;direction:rtl;">${tagsHtml}</div>`;
  }

  // Sales Cheat Sheet
  if (p.salesCheatSheet) {
    const sheet = p.salesCheatSheet;
    let sheetHtml = '';
    if (sheet.how_to_speak) sheetHtml += `<div style="font-size:10px;color:#475569;margin-bottom:4px;">💬 <strong>איך לדבר:</strong> ${escapeHtml(String(sheet.how_to_speak))}</div>`;
    if (sheet.what_not_to_do) sheetHtml += `<div style="font-size:10px;color:#475569;margin-bottom:4px;">🚫 <strong>ממה להימנע:</strong> ${escapeHtml(String(sheet.what_not_to_do))}</div>`;
    if (sheet.red_flags) sheetHtml += `<div style="font-size:10px;color:#475569;margin-bottom:4px;">🚩 <strong>דגלים אדומים:</strong> ${escapeHtml(String(sheet.red_flags))}</div>`;
    if (sheet.closing_strategy) sheetHtml += `<div style="font-size:10px;color:#475569;margin-bottom:4px;">🎯 <strong>אסטרטגיית סגירה:</strong> ${escapeHtml(String(sheet.closing_strategy))}</div>`;
    if (sheetHtml) html += buildSection(brand, 'גיליון מכירות', sheetHtml);
  }

  // Result URL
  if (p.resultUrl) {
    html += `<div style="margin:8px 28px;font-size:9px;color:#94a3b8;direction:ltr;">📊 ${escapeHtml(p.resultUrl)}</div>`;
  }

  html += buildFooter(brand);

  const fullHtml = wrapInPrintDocument(html, `דוח אישיותי — ${data.entityName}`);
  openPreviewWindow(fullHtml);
}

// ── 4. Custom Document (מסמך מותאם) ─────────────────────────────────────

export interface CustomDocData {
  title: string;
  subtitle?: string;
  sections: Array<{ title: string; content: string }>;
  kpis?: Array<{ label: string; value: string; color?: string }>;
  tables?: Array<{ title: string; headers: string[]; rows: string[][] }>;
}

export function generateCustomPdf(data: CustomDocData, brand: BrandConfig): void {
  let html = buildHeader(brand, data.title, data.subtitle);

  if (data.kpis && data.kpis.length > 0) {
    html += buildKpiRow(data.kpis);
  }

  for (const section of data.sections) {
    html += buildSection(brand, section.title, escapeHtml(section.content));
  }

  if (data.tables) {
    for (const table of data.tables) {
      html += buildSection(brand, table.title, '');
      html += buildTable(table.headers, table.rows, brand);
    }
  }

  html += buildFooter(brand);

  const fullHtml = wrapInPrintDocument(html, data.title);
  openPreviewWindow(fullHtml);
}

// ── 5. Strategy & Action Plan (אסטרטגיה ותוכנית עבודה) ──────────────────

import type { StrategyPlanData } from '../types';

export interface StrategyPdfData {
  entityName: string;
  entityType: 'client' | 'lead';
  planData: StrategyPlanData;
  createdAt: string;
}

function buildColoredList(brand: BrandConfig, title: string, items: string[], emoji: string, color: string): string {
  if (!items || items.length === 0) return '';
  const listItems = items.map(item =>
    `<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:4px;flex-direction:row-reverse;">
      <span style="flex-shrink:0;">${emoji}</span>
      <span style="font-size:10px;color:#475569;line-height:1.6;text-align:right;">${escapeHtml(item)}</span>
    </div>`
  ).join('');

  return `
    <div style="margin:10px 0;page-break-inside:avoid;">
      <div style="font-size:11px;font-weight:600;color:${color};margin-bottom:6px;text-align:right;">${escapeHtml(title)}</div>
      ${listItems}
    </div>
  `;
}

function buildPhaseSection(brand: BrandConfig, phase: { phaseLabel: string; phaseSummary: string; actions: Array<{ number: number; title: string; description: string; owner: string; kpi: string }> }, phaseColor: string): string {
  // Phase header band
  let html = `
    <div style="margin:18px 28px 8px;page-break-inside:avoid;">
      <div style="background:linear-gradient(to left,${phaseColor},${phaseColor}cc);padding:10px 16px;border-radius:8px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:#ffffff;text-align:right;">${escapeHtml(phase.phaseLabel)}</div>
        <div style="font-size:9px;color:#ffffffcc;margin-top:2px;text-align:right;">${escapeHtml(phase.phaseSummary)}</div>
      </div>
    </div>
  `;

  // Actions table
  if (phase.actions?.length) {
    const headers = ['#', 'פעולה', 'תיאור', 'אחראי', 'מדד הצלחה'];
    const rows = phase.actions.map(a => [
      String(a.number),
      a.title,
      a.description,
      a.owner,
      a.kpi,
    ]);
    html += buildTable(headers, rows, brand);
  }

  return html;
}

export function generateStrategyPdf(data: StrategyPdfData, brand: BrandConfig): void {
  const { planData, entityName, entityType } = data;
  const entityLabel = entityType === 'client' ? 'לקוח' : 'ליד';
  const title = `אסטרטגיה ותוכנית עבודה — ${entityName}`;

  let html = buildHeader(brand, title, `${entityLabel} · ${new Date(data.createdAt).toLocaleDateString('he-IL')}`);

  // Summary KPIs
  const totalActions = planData.actionPlan.reduce((sum, p) => sum + (p.actions?.length || 0), 0);
  html += buildKpiRow([
    { label: 'שלבים', value: String(planData.actionPlan.length), color: brand.primaryColor },
    { label: 'פעולות', value: String(totalActions), color: '#3b82f6' },
    { label: 'מדדים', value: String(planData.kpis?.length || 0), color: '#f59e0b' },
  ]);

  // Executive Summary
  if (planData.summary) {
    html += buildSection(brand, 'סיכום מנהלים', escapeHtml(planData.summary));
  }

  // Situation Analysis
  const sa = planData.situationAnalysis;
  if (sa) {
    html += `<div style="margin:14px 28px;page-break-inside:avoid;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-direction:row-reverse;">
        <div style="width:3px;height:16px;background:${brand.primaryColor};border-radius:2px;flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:600;color:#1e293b;">ניתוח מצב קיים</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>${buildColoredList(brand, 'מה עובד', sa.whatsWorking, '✅', '#16a34a')}</div>
        <div>${buildColoredList(brand, 'מה לא עובד', sa.whatsNotWorking, '❌', '#dc2626')}</div>
        <div>${buildColoredList(brand, 'הזדמנויות', sa.opportunities, '💡', '#2563eb')}</div>
        <div>${buildColoredList(brand, 'סיכונים', sa.risks, '⚠️', '#d97706')}</div>
      </div>
      ${buildColoredList(brand, 'תלויות', sa.dependencies, '🔗', '#6b7280')}
    </div>`;
  }

  // Action Plan Phases
  const phaseColors = ['#0d9488', '#3b82f6', '#8b5cf6', '#ec4899'];
  for (let i = 0; i < planData.actionPlan.length; i++) {
    html += buildPhaseSection(brand, planData.actionPlan[i], phaseColors[i % phaseColors.length]);
  }

  // KPIs
  if (planData.kpis?.length) {
    html += buildSection(brand, 'מדדי הצלחה (KPIs)', '');
    const kpiHeaders = ['מדד', 'יעד', 'מסגרת זמן'];
    const kpiRows = planData.kpis.map(k => [k.label, k.target, k.timeframe]);
    html += buildTable(kpiHeaders, kpiRows, brand);
  }

  html += buildFooter(brand);

  const fullHtml = wrapInPrintDocument(html, title);
  openPreviewWindow(fullHtml);
}
