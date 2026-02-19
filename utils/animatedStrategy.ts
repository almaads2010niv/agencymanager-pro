// ============================================
// AgencyManager Pro — Animated Strategy Generator
// ============================================
// Produces a standalone animated HTML page for a strategy & action plan.
// Uses CSS animations, scroll-triggered reveals, SVG arrows,
// gradient backgrounds, and the agency's brand colors.
// The template is fixed; the content changes per client/lead.
//
// Output: opens in a new window — client-ready shareable document.

import type { StrategyPlanData } from '../types';

export interface AnimatedStrategyData {
  entityName: string;
  entityType: 'client' | 'lead';
  planData: StrategyPlanData;
  createdAt: string;
}

export interface AnimatedBrandConfig {
  agencyName: string;
  ownerName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generateAnimatedStrategy(data: AnimatedStrategyData, brand: AnimatedBrandConfig): void {
  const { planData: pd, entityName } = data;
  const entityLabel = data.entityType === 'client' ? 'לקוח' : 'ליד';
  const dateStr = new Date(data.createdAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const totalActions = pd.actionPlan.reduce((sum, p) => sum + (p.actions?.length || 0), 0);

  // Phase colors (4 cycling)
  const phaseColors = [brand.primaryColor, '#3b82f6', '#8b5cf6', '#ec4899'];

  // Build situation analysis cards
  const saCards = [
    { title: 'מה עובד', items: pd.situationAnalysis?.whatsWorking || [], emoji: '✅', color: '#10b981' },
    { title: 'מה לא עובד', items: pd.situationAnalysis?.whatsNotWorking || [], emoji: '❌', color: '#ef4444' },
    { title: 'הזדמנויות', items: pd.situationAnalysis?.opportunities || [], emoji: '💡', color: '#3b82f6' },
    { title: 'סיכונים', items: pd.situationAnalysis?.risks || [], emoji: '⚠️', color: '#f59e0b' },
  ].filter(c => c.items.length > 0);

  const dependenciesHtml = (pd.situationAnalysis?.dependencies?.length > 0)
    ? `<div class="reveal" style="animation-delay:0.6s">
        <div class="dep-bar">
          <span class="dep-label">🔗 תלויות</span>
          ${pd.situationAnalysis.dependencies.map(d => `<span class="dep-chip">${esc(d)}</span>`).join('')}
        </div>
       </div>` : '';

  // Build phases HTML
  const phasesHtml = pd.actionPlan.map((phase, pi) => {
    const color = phaseColors[pi % phaseColors.length];
    const actionsHtml = (phase.actions || []).map((a, ai) => `
      <div class="action-row reveal" style="animation-delay:${0.1 * (ai + 1)}s">
        <div class="action-num" style="background:${color}22;color:${color};border:1px solid ${color}44">${a.number}</div>
        <div class="action-body">
          <div class="action-title">${esc(a.title)}</div>
          <div class="action-desc">${esc(a.description)}</div>
          <div class="action-meta">
            <span class="owner-badge">${esc(a.owner)}</span>
            ${a.kpi ? `<span class="kpi-badge">📊 ${esc(a.kpi)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    // Arrow SVG between phases
    const arrowHtml = pi < pd.actionPlan.length - 1 ? `
      <div class="phase-arrow reveal">
        <svg width="40" height="60" viewBox="0 0 40 60">
          <path d="M20 5 L20 45" stroke="${color}" stroke-width="2" stroke-dasharray="4,4" fill="none" class="arrow-dash"/>
          <polygon points="12,42 20,55 28,42" fill="${color}" opacity="0.7" class="arrow-head"/>
        </svg>
      </div>` : '';

    return `
      <div class="phase-block reveal" style="animation-delay:${0.2 * pi}s">
        <div class="phase-header" style="background:linear-gradient(135deg, ${color}18, ${color}08);border-right:4px solid ${color}">
          <div class="phase-icon" style="background:${color};box-shadow:0 0 20px ${color}44">
            <span>${pi + 1}</span>
          </div>
          <div class="phase-info">
            <div class="phase-label">${esc(phase.phaseLabel)}</div>
            <div class="phase-summary">${esc(phase.phaseSummary)}</div>
          </div>
          <div class="phase-count">${phase.actions?.length || 0} פעולות</div>
        </div>
        <div class="actions-list">
          ${actionsHtml}
        </div>
      </div>
      ${arrowHtml}
    `;
  }).join('');

  // KPIs HTML
  const kpisHtml = (pd.kpis || []).map((k, i) => `
    <div class="kpi-card reveal" style="animation-delay:${0.15 * i}s">
      <div class="kpi-value">${esc(k.target)}</div>
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-time">${esc(k.timeframe)}</div>
      <div class="kpi-glow" style="background:${phaseColors[i % phaseColors.length]}"></div>
    </div>
  `).join('');

  const logoHtml = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="logo" class="header-logo" />`
    : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>תוכנית עבודה — ${esc(entityName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary: ${brand.primaryColor};
    --secondary: ${brand.secondaryColor};
    --accent: ${brand.accentColor};
    --bg: #0B1121;
    --surface: #151e32;
    --surface2: #1a2540;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --text-subtle: #64748b;
    --border: rgba(255,255,255,0.08);
  }

  body {
    font-family: 'Heebo', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.7;
    overflow-x: hidden;
  }

  /* ── BG Animation ── */
  .bg-grid {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-image:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 60px 60px;
    z-index: 0;
    pointer-events: none;
  }
  .bg-glow {
    position: fixed; top: -200px; right: -200px;
    width: 600px; height: 600px;
    background: radial-gradient(circle, ${brand.primaryColor}15, transparent 70%);
    border-radius: 50%;
    z-index: 0;
    animation: floatGlow 12s ease-in-out infinite alternate;
  }
  .bg-glow2 {
    position: fixed; bottom: -200px; left: -200px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, ${brand.secondaryColor}10, transparent 70%);
    border-radius: 50%;
    z-index: 0;
    animation: floatGlow 15s ease-in-out infinite alternate-reverse;
  }
  @keyframes floatGlow {
    from { transform: translate(0,0) scale(1); }
    to { transform: translate(40px, 30px) scale(1.15); }
  }

  .container {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  /* ── Reveal Animation ── */
  .reveal {
    opacity: 0;
    transform: translateY(24px);
    animation: revealUp 0.6s ease forwards;
  }
  @keyframes revealUp {
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Header ── */
  .header {
    text-align: center;
    margin-bottom: 48px;
    padding-bottom: 32px;
    border-bottom: 1px solid var(--border);
  }
  .header-logo { height: 48px; margin-bottom: 16px; }
  .header-agency {
    font-size: 12px; color: var(--primary); font-weight: 500;
    letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
  }
  .header-title {
    font-size: 36px; font-weight: 900; line-height: 1.2;
    background: linear-gradient(135deg, var(--text), var(--primary));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; margin-bottom: 8px;
  }
  .header-sub {
    font-size: 14px; color: var(--text-subtle);
  }

  /* ── Hero KPI Bar ── */
  .hero-kpi {
    display: flex; gap: 16px; justify-content: center;
    margin-bottom: 48px; flex-wrap: wrap;
  }
  .hero-kpi-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 28px;
    text-align: center;
    min-width: 140px;
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .hero-kpi-item:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .hero-kpi-value { font-size: 28px; font-weight: 900; color: var(--primary); }
  .hero-kpi-label { font-size: 11px; color: var(--text-subtle); margin-top: 4px; }

  /* ── Section Header ── */
  .section-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 24px; margin-top: 48px;
  }
  .section-header .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--primary);
    box-shadow: 0 0 10px var(--primary);
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  .section-header h2 {
    font-size: 22px; font-weight: 700; color: var(--text);
  }

  /* ── Summary Card ── */
  .summary-card {
    background: linear-gradient(135deg, var(--surface), var(--surface2));
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    font-size: 15px;
    color: var(--text-muted);
    line-height: 1.8;
    position: relative;
    overflow: hidden;
  }
  .summary-card::before {
    content: ''; position: absolute; top: 0; right: 0;
    width: 4px; height: 100%;
    background: linear-gradient(to bottom, var(--primary), var(--secondary));
    border-radius: 0 0 0 4px;
  }

  /* ── Situation Analysis Grid ── */
  .sa-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  @media (max-width: 640px) { .sa-grid { grid-template-columns: 1fr; } }

  .sa-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    transition: transform 0.3s, border-color 0.3s;
  }
  .sa-card:hover {
    transform: translateY(-2px);
  }
  .sa-card-title {
    font-size: 13px; font-weight: 700; margin-bottom: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .sa-item {
    font-size: 12px; color: var(--text-muted); margin-bottom: 6px;
    padding-right: 12px; position: relative; line-height: 1.6;
  }
  .sa-item::before {
    content: '•'; position: absolute; right: 0; top: 0;
    font-weight: 700;
  }

  /* Dependencies bar */
  .dep-bar {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .dep-label { font-size: 12px; font-weight: 600; color: var(--text-subtle); }
  .dep-chip {
    font-size: 11px; padding: 3px 10px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 20px; color: var(--text-muted);
  }

  /* ── Phase Block ── */
  .phase-block {
    margin-bottom: 8px;
  }
  .phase-header {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid var(--border);
    margin-bottom: 12px;
    transition: transform 0.3s;
  }
  .phase-header:hover { transform: scale(1.01); }
  .phase-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 900; color: white;
    flex-shrink: 0;
  }
  .phase-info { flex: 1; }
  .phase-label { font-size: 16px; font-weight: 700; color: var(--text); }
  .phase-summary { font-size: 12px; color: var(--text-subtle); margin-top: 2px; }
  .phase-count {
    font-size: 11px; color: var(--text-subtle);
    background: rgba(255,255,255,0.04);
    padding: 4px 12px; border-radius: 20px;
    white-space: nowrap;
  }

  /* ── Action Row ── */
  .actions-list { padding: 0 8px 16px; }
  .action-row {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 12px 14px; margin-bottom: 6px;
    border-radius: 10px;
    border: 1px solid transparent;
    transition: all 0.25s;
  }
  .action-row:hover {
    background: rgba(255,255,255,0.02);
    border-color: var(--border);
  }
  .action-num {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; flex-shrink: 0;
  }
  .action-body { flex: 1; }
  .action-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .action-desc { font-size: 12px; color: var(--text-muted); }
  .action-meta { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .owner-badge {
    font-size: 10px; padding: 2px 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 12px; color: var(--text-subtle);
  }
  .kpi-badge {
    font-size: 10px; padding: 2px 8px;
    background: var(--accent)10;
    border: 1px solid var(--accent)22;
    border-radius: 12px; color: var(--accent);
  }

  /* ── Phase Arrow ── */
  .phase-arrow {
    display: flex; justify-content: center;
    margin: -4px 0;
  }
  .arrow-dash { animation: dashFlow 1.5s linear infinite; }
  @keyframes dashFlow { to { stroke-dashoffset: -16; } }
  .arrow-head { animation: arrowBounce 2s ease-in-out infinite; }
  @keyframes arrowBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }

  /* ── KPI Cards ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
    margin-top: 16px;
  }
  .kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 16px;
    text-align: center;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .kpi-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .kpi-value { font-size: 22px; font-weight: 900; color: var(--text); position: relative; z-index: 1; }
  .kpi-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; position: relative; z-index: 1; }
  .kpi-time { font-size: 10px; color: var(--text-subtle); margin-top: 2px; position: relative; z-index: 1; }
  .kpi-glow {
    position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%);
    width: 80px; height: 80px; border-radius: 50%;
    opacity: 0.08; filter: blur(20px);
  }

  /* ── Footer ── */
  .footer {
    text-align: center; padding-top: 40px; margin-top: 48px;
    border-top: 1px solid var(--border);
  }
  .footer-agency { font-size: 12px; color: var(--primary); font-weight: 500; }
  .footer-date { font-size: 10px; color: var(--text-subtle); margin-top: 4px; }
  .footer-badge {
    display: inline-block; margin-top: 12px;
    font-size: 9px; padding: 4px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px; color: var(--text-subtle);
  }

  /* ── Print styles ── */
  @media print {
    body { background: white; color: #1e293b; }
    .bg-grid, .bg-glow, .bg-glow2 { display: none; }
    .reveal { opacity: 1 !important; transform: none !important; animation: none !important; }
    .sa-card, .phase-header, .summary-card, .kpi-card, .action-row {
      background: #f8fafc; border-color: #e2e8f0;
    }
    .header-title { -webkit-text-fill-color: #1e293b; }
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>
  <div class="bg-glow2"></div>

  <div class="container">
    <!-- Header -->
    <div class="header reveal">
      ${logoHtml}
      <div class="header-agency">${esc(brand.agencyName)}</div>
      <div class="header-title">תוכנית עבודה אסטרטגית</div>
      <div class="header-sub">${esc(entityName)} · ${entityLabel} · ${dateStr}</div>
    </div>

    <!-- Hero KPIs -->
    <div class="hero-kpi">
      <div class="hero-kpi-item reveal" style="animation-delay:0.1s">
        <div class="hero-kpi-value">${pd.actionPlan.length}</div>
        <div class="hero-kpi-label">שלבים</div>
      </div>
      <div class="hero-kpi-item reveal" style="animation-delay:0.2s">
        <div class="hero-kpi-value">${totalActions}</div>
        <div class="hero-kpi-label">פעולות</div>
      </div>
      <div class="hero-kpi-item reveal" style="animation-delay:0.3s">
        <div class="hero-kpi-value">${pd.kpis?.length || 0}</div>
        <div class="hero-kpi-label">מדדי הצלחה</div>
      </div>
    </div>

    ${pd.summary ? `
    <!-- Executive Summary -->
    <div class="section-header reveal">
      <div class="dot"></div>
      <h2>סיכום מנהלים</h2>
    </div>
    <div class="summary-card reveal" style="animation-delay:0.2s">
      ${esc(pd.summary)}
    </div>
    ` : ''}

    ${saCards.length > 0 ? `
    <!-- Situation Analysis -->
    <div class="section-header reveal">
      <div class="dot" style="background:${brand.secondaryColor};box-shadow:0 0 10px ${brand.secondaryColor}"></div>
      <h2>ניתוח מצב קיים</h2>
    </div>
    <div class="sa-grid">
      ${saCards.map((card, ci) => `
        <div class="sa-card reveal" style="animation-delay:${0.15 * ci}s;border-right:3px solid ${card.color}">
          <div class="sa-card-title" style="color:${card.color}">
            <span>${card.emoji}</span> ${esc(card.title)}
          </div>
          ${card.items.map(item => `<div class="sa-item">${esc(item)}</div>`).join('')}
        </div>
      `).join('')}
    </div>
    ${dependenciesHtml}
    ` : ''}

    ${pd.actionPlan?.length > 0 ? `
    <!-- Action Plan -->
    <div class="section-header reveal">
      <div class="dot" style="background:${brand.accentColor};box-shadow:0 0 10px ${brand.accentColor}"></div>
      <h2>תוכנית עבודה</h2>
    </div>
    ${phasesHtml}
    ` : ''}

    ${pd.kpis?.length > 0 ? `
    <!-- KPIs -->
    <div class="section-header reveal">
      <div class="dot" style="background:${brand.accentColor};box-shadow:0 0 10px ${brand.accentColor}"></div>
      <h2>מדדי הצלחה</h2>
    </div>
    <div class="kpi-grid">
      ${kpisHtml}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer reveal">
      <div class="footer-agency">${esc(brand.agencyName)}</div>
      <div class="footer-date">${esc(brand.ownerName)} · ${dateStr}</div>
      <div class="footer-badge">Powered by AgencyManager Pro</div>
    </div>
  </div>

  <script>
    // Intersection Observer for scroll-triggered reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    // Pause all reveals initially, then trigger on scroll
    document.querySelectorAll('.reveal').forEach(el => {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });

    // Immediately reveal above-fold elements
    setTimeout(() => {
      document.querySelectorAll('.header .reveal, .hero-kpi .reveal').forEach(el => {
        el.style.animationPlayState = 'running';
      });
      // Also force the header itself
      document.querySelector('.header')?.style && (document.querySelector('.header').style.animationPlayState = 'running');
    }, 100);
  </script>
</body>
</html>`;

  // Open in new window
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
