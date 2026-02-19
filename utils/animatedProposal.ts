// ============================================
// AgencyManager Pro — Animated Proposal Generator
// ============================================
// Produces a standalone animated HTML page for a price proposal (הצעת מחיר).
// Features: dark theme, CSS scroll-reveal animations, pricing cards with
// radio selection, canvas signature pad, webhook submission, and "viewed" beacon.
// Fully RTL Hebrew with Heebo font. Completely standalone HTML (no external JS).
//
// Output: opens in a new window — client-ready shareable document.

import { PROPOSAL_TESTIMONIALS, PROPOSAL_STATS, FULL_TERMS_TEXT, type ProposalTestimonial } from './proposalSocialProof';

// ── Logo URLs (Supabase Storage) ────────────────────────────────
const LOGO_BASE = 'https://rxckkozbkrabpjdgyxqm.supabase.co/storage/v1/object/public/proposal-pages/logos';
const PROPOSAL_LOGO_URLS = [
  { name: 'B-Cure Laser', url: `${LOGO_BASE}/B-Cure-Laser.png` },
  { name: 'Smoovee', url: `${LOGO_BASE}/Smoovee.png` },
  { name: 'UFC', url: `${LOGO_BASE}/UFC.png` },
  { name: 'Great Shape', url: `${LOGO_BASE}/great-shape.png` },
  { name: 'Kiki Party', url: `${LOGO_BASE}/kiki-party.png` },
  { name: 'Body Star', url: `${LOGO_BASE}/body-star.jpg` },
  { name: 'גוסטינו', url: `${LOGO_BASE}/gustino.png` },
  { name: 'קאנטרי נשר', url: `${LOGO_BASE}/country-nesher.png` },
  { name: 'קאנטרי רמות', url: `${LOGO_BASE}/country-ramot.png` },
];

// ── Interfaces ──────────────────────────────────────────────────

export interface ProposalPageConfig {
  proposalId: string;
  businessName: string;
  contactName: string;
  introText?: string;
  packages: Array<{
    name: string;
    isRecommended: boolean;
    services: Array<{ label: string; included: boolean }>;
    monthlyPrice: number;
    setupPrice?: number;
  }>;
  phases: Array<{
    number: number;
    title: string;
    description: string;
    duration?: string;
  }>;
  terms: { items: string[] };
  validUntil?: string;
  webhookUrl: string;
  /** Website URL for "discover our approach" CTA */
  websiteUrl?: string;
  /** Show social proof sections (logos, testimonials, stats) — default true */
  showSocialProof?: boolean;
  /** Show full legal terms overlay — default true */
  showFullTerms?: boolean;
}

export interface ProposalBrandConfig {
  agencyName: string;
  ownerName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** Contact phone number */
  phone?: string;
  /** Contact address */
  address?: string;
}

// ── Helpers ─────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtCurrency(n: number): string {
  return `₪${n.toLocaleString('he-IL')}`;
}

// ── Builder ─────────────────────────────────────────────────────

export function buildAnimatedProposalHtml(config: ProposalPageConfig, brand: ProposalBrandConfig): string {
  const dateStr = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const validStr = config.validUntil
    ? new Date(config.validUntil).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  const logoHtml = brand.logoUrl
    ? `<img src="${esc(brand.logoUrl)}" alt="logo" class="header-logo" />`
    : '';

  // Phase colors (cycling)
  const phaseColors = [brand.primaryColor, '#3b82f6', '#8b5cf6', '#ec4899'];

  // ── Build Phases HTML ──
  const phasesHtml = config.phases.map((phase, pi) => {
    const color = phaseColors[pi % phaseColors.length];
    const durationHtml = phase.duration ? `<span class="phase-duration">${esc(phase.duration)}</span>` : '';

    const arrowHtml = pi < config.phases.length - 1 ? `
      <div class="phase-arrow reveal">
        <svg width="40" height="60" viewBox="0 0 40 60">
          <path d="M20 5 L20 45" stroke="${color}" stroke-width="2" stroke-dasharray="4,4" fill="none" class="arrow-dash"/>
          <polygon points="12,42 20,55 28,42" fill="${color}" opacity="0.7" class="arrow-head"/>
        </svg>
      </div>` : '';

    return `
      <div class="phase-card reveal" style="animation-delay:${0.15 * pi}s">
        <div class="phase-header" style="background:linear-gradient(135deg, ${color}18, ${color}08);border-right:4px solid ${color}">
          <div class="phase-icon" style="background:${color};box-shadow:0 0 20px ${color}44">
            <span>${phase.number}</span>
          </div>
          <div class="phase-info">
            <div class="phase-label">${esc(phase.title)}</div>
            <div class="phase-desc">${esc(phase.description)}</div>
          </div>
          ${durationHtml}
        </div>
      </div>
      ${arrowHtml}
    `;
  }).join('');

  // ── Build Packages HTML ──
  const packagesHtml = config.packages.map((pkg, i) => {
    const isRec = pkg.isRecommended;
    const servicesHtml = pkg.services.map(s => `
      <div class="pkg-service ${s.included ? 'included' : 'excluded'}">
        <span class="pkg-check">${s.included ? '&#10003;' : '&#10007;'}</span>
        <span>${esc(s.label)}</span>
      </div>
    `).join('');

    const setupHtml = pkg.setupPrice != null && pkg.setupPrice > 0
      ? `<div class="pkg-setup">דמי הקמה: ${fmtCurrency(pkg.setupPrice)}</div>`
      : '';

    return `
      <div class="pkg-card ${isRec ? 'pkg-recommended' : ''} reveal" style="animation-delay:${0.15 * i}s" data-pkg-name="${esc(pkg.name)}">
        ${isRec ? '<div class="pkg-badge">מומלץ</div>' : ''}
        <div class="pkg-name">${esc(pkg.name)}</div>
        <div class="pkg-price">${fmtCurrency(pkg.monthlyPrice)}<span class="pkg-per">/חודש</span></div>
        ${setupHtml}
        <div class="pkg-services">${servicesHtml}</div>
        <label class="pkg-radio-label">
          <input type="radio" name="selectedPackage" value="${esc(pkg.name)}" class="pkg-radio" ${isRec ? 'checked' : ''} />
          <span class="pkg-radio-text">בחירת חבילה</span>
        </label>
      </div>
    `;
  }).join('');

  // ── Build Terms HTML ──
  const termsItems = (config.terms?.items || []).map(t => `<li>${esc(t)}</li>`).join('');

  // ── Build Intro HTML ──
  const introHtml = config.introText ? `
    <div class="section-header reveal">
      <div class="dot"></div>
      <h2>הקדמה</h2>
    </div>
    <div class="intro-card reveal" style="animation-delay:0.2s">
      ${esc(config.introText)}
    </div>
  ` : '';

  // ── Validity HTML ──
  const validityHtml = validStr ? `<span class="header-valid">בתוקף עד ${validStr}</span>` : '';

  // ── Build Social Proof (Logos Marquee) ──
  const showSocial = config.showSocialProof !== false;
  const logoItems = PROPOSAL_LOGO_URLS.map(l =>
    `<div class="marquee-logo"><img src="${esc(l.url)}" alt="${esc(l.name)}" loading="lazy" onerror="this.parentElement.style.display='none'" /></div>`
  ).join('');
  const logosHtml = showSocial ? `
    <div class="logos-section reveal" style="animation-delay:0.1s">
      <div class="logos-title">לקוחות שבחרו בנו</div>
      <div class="marquee-wrap">
        <div class="marquee-track">${logoItems}${logoItems}${logoItems}</div>
      </div>
    </div>
  ` : '';

  // ── Build Stats Bar ──
  const statsHtml = showSocial ? `
    <div class="stats-bar reveal" style="animation-delay:0.15s">
      <div class="stat-item"><div class="stat-value">${PROPOSAL_STATS.clients}</div><div class="stat-label">${esc(PROPOSAL_STATS.clientsLabel)}</div></div>
      <div class="stat-item"><div class="stat-value">${PROPOSAL_STATS.stories}</div><div class="stat-label">${esc(PROPOSAL_STATS.storiesLabel)}</div></div>
      <div class="stat-item"><div class="stat-value">${PROPOSAL_STATS.years}</div><div class="stat-label">${esc(PROPOSAL_STATS.yearsLabel)}</div></div>
      <div class="stat-item"><div class="stat-value">${PROPOSAL_STATS.personal}</div><div class="stat-label">${esc(PROPOSAL_STATS.personalLabel)}</div></div>
    </div>
  ` : '';

  // ── Build Testimonials Carousel ──
  const testimonialsToShow = PROPOSAL_TESTIMONIALS.slice(0, 6);
  const testimonialCards = testimonialsToShow.map((t: ProposalTestimonial, i: number) => {
    const stars = Array.from({ length: t.stars }, () => '★').join('');
    return `
      <div class="testi-card" data-testi="${i}">
        <div class="testi-stars">${stars}</div>
        <div class="testi-content">"${esc(t.content)}"</div>
        <div class="testi-author">
          <div class="testi-name">${esc(t.name)}</div>
          <div class="testi-role">${esc(t.role)}</div>
        </div>
      </div>`;
  }).join('');
  const testiDotsHtml = testimonialsToShow.map((_: ProposalTestimonial, i: number) =>
    `<button class="testi-dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></button>`
  ).join('');

  const testimonialsHtml = showSocial ? `
    <div class="section-header reveal">
      <div class="dot" style="background:#f59e0b;box-shadow:0 0 10px #f59e0b"></div>
      <h2>מה הלקוחות שלנו אומרים</h2>
    </div>
    <div class="testi-carousel reveal" style="animation-delay:0.1s">
      <div class="testi-viewport">
        <div class="testi-track">${testimonialCards}</div>
      </div>
      <div class="testi-dots">${testiDotsHtml}</div>
    </div>
  ` : '';

  // ── Build Full Legal Terms Overlay ──
  const showLegal = config.showFullTerms !== false;
  const fullTermsSanitized = esc(FULL_TERMS_TEXT).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
  const fullTermsHtml = showLegal ? `
    <div class="full-terms-link reveal" style="animation-delay:0.15s">
      <button class="btn-terms-open" id="openFullTerms">📋 לצפייה בתנאים המלאים לחץ כאן</button>
    </div>
    <div class="terms-overlay" id="termsOverlay">
      <div class="terms-modal">
        <div class="terms-modal-header">
          <h3>תנאי שירות כלליים</h3>
          <button class="terms-close" id="closeFullTerms">&times;</button>
        </div>
        <div class="terms-modal-body">
          <p>${fullTermsSanitized}</p>
        </div>
        <div class="terms-modal-footer">
          ${brand.agencyName} &middot; www.alma-ads.co.il &middot; ${brand.phone || ''}
        </div>
      </div>
    </div>
  ` : '';

  // ── Build Website CTA ──
  const websiteUrl = config.websiteUrl || 'https://www.alma-ads.co.il';
  const websiteCtaHtml = showSocial ? `
    <div class="website-cta reveal" style="animation-delay:0.1s">
      <div class="website-cta-inner">
        <div class="website-cta-text">
          <div class="website-cta-title">רוצים להכיר את הגישה שלנו?</div>
          <div class="website-cta-sub">גלו את דרכי החשיבה, המתודולוגיה והשירותים שלנו</div>
        </div>
        <a href="${esc(websiteUrl)}" target="_blank" rel="noopener" class="btn btn-primary website-cta-btn">
          בקרו באתר שלנו &#8592;
        </a>
      </div>
    </div>
  ` : '';

  // ── Full HTML ──
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>הצעת מחיר — ${esc(config.businessName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary: ${brand.primaryColor};
    --secondary: ${brand.secondaryColor};
    --accent: ${brand.accentColor};
    --bg: #0a0e1a;
    --surface: #151e32;
    --surface2: #1a2540;
    --text: #f1f5f9;
    --text-muted: #94a3b8;
    --text-subtle: #64748b;
    --border: rgba(255,255,255,0.08);
    --success: #10b981;
    --error: #ef4444;
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
    z-index: 0; pointer-events: none;
  }
  .bg-glow {
    position: fixed; top: -200px; right: -200px;
    width: 600px; height: 600px;
    background: radial-gradient(circle, ${brand.primaryColor}15, transparent 70%);
    border-radius: 50%; z-index: 0;
    animation: floatGlow 12s ease-in-out infinite alternate;
  }
  .bg-glow2 {
    position: fixed; bottom: -200px; left: -200px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, ${brand.secondaryColor}10, transparent 70%);
    border-radius: 50%; z-index: 0;
    animation: floatGlow 15s ease-in-out infinite alternate-reverse;
  }
  @keyframes floatGlow {
    from { transform: translate(0,0) scale(1); }
    to { transform: translate(40px, 30px) scale(1.15); }
  }

  .container {
    position: relative; z-index: 1;
    max-width: 960px;
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
  .header-logo { height: 52px; margin-bottom: 16px; }
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
    font-size: 14px; color: var(--text-subtle); margin-bottom: 6px;
  }
  .header-valid {
    display: inline-block; font-size: 12px; color: var(--accent);
    background: var(--accent)12; border: 1px solid var(--accent)22;
    padding: 4px 14px; border-radius: 20px; margin-top: 8px;
  }

  /* ── Section Header ── */
  .section-header {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 24px; margin-top: 56px;
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

  /* ── Intro Card ── */
  .intro-card {
    background: linear-gradient(135deg, var(--surface), var(--surface2));
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    font-size: 15px; color: var(--text-muted);
    line-height: 1.8;
    position: relative; overflow: hidden;
  }
  .intro-card::before {
    content: ''; position: absolute; top: 0; right: 0;
    width: 4px; height: 100%;
    background: linear-gradient(to bottom, var(--primary), var(--secondary));
    border-radius: 0 0 0 4px;
  }

  /* ── Phase Cards ── */
  .phase-card { margin-bottom: 8px; }
  .phase-header {
    display: flex; align-items: center; gap: 16px;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid var(--border);
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
  .phase-desc { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
  .phase-duration {
    font-size: 11px; color: var(--text-subtle);
    background: rgba(255,255,255,0.04);
    padding: 4px 12px; border-radius: 20px;
    white-space: nowrap;
  }

  /* ── Phase Arrow ── */
  .phase-arrow {
    display: flex; justify-content: center; margin: -4px 0;
  }
  .arrow-dash { animation: dashFlow 1.5s linear infinite; }
  @keyframes dashFlow { to { stroke-dashoffset: -16; } }
  .arrow-head { animation: arrowBounce 2s ease-in-out infinite; }
  @keyframes arrowBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }

  /* ── Pricing Packages ── */
  .pkg-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px; align-items: start;
  }
  @media (max-width: 640px) { .pkg-grid { grid-template-columns: 1fr; } }

  .pkg-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px 24px;
    position: relative; overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
    cursor: pointer;
  }
  .pkg-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  }
  .pkg-card.pkg-selected {
    border-color: var(--primary);
    box-shadow: 0 0 24px ${brand.primaryColor}22;
  }

  .pkg-recommended {
    border-color: var(--accent);
    transform: scale(1.03);
    box-shadow: 0 0 30px ${brand.accentColor}18;
  }
  .pkg-recommended:hover { transform: scale(1.03) translateY(-4px); }
  .pkg-recommended.pkg-selected {
    border-color: var(--accent);
    box-shadow: 0 0 30px ${brand.accentColor}30;
  }

  .pkg-badge {
    position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
    background: var(--accent); color: white;
    font-size: 11px; font-weight: 700;
    padding: 4px 18px;
    border-radius: 0 0 10px 10px;
  }

  .pkg-name {
    font-size: 20px; font-weight: 700; color: var(--text);
    margin-bottom: 8px; text-align: center;
  }
  .pkg-price {
    font-size: 32px; font-weight: 900; text-align: center;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; margin-bottom: 4px;
  }
  .pkg-per {
    font-size: 14px; font-weight: 400;
  }
  .pkg-setup {
    font-size: 12px; color: var(--text-subtle);
    text-align: center; margin-bottom: 16px;
  }

  .pkg-services {
    margin: 20px 0 16px;
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
  .pkg-service {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 0; font-size: 13px; color: var(--text-muted);
  }
  .pkg-service.included .pkg-check { color: var(--success); }
  .pkg-service.excluded .pkg-check { color: var(--error); opacity: 0.5; }
  .pkg-service.excluded { opacity: 0.5; }
  .pkg-check { font-size: 14px; font-weight: 700; width: 18px; text-align: center; flex-shrink: 0; }

  .pkg-radio-label {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; margin-top: 16px;
    cursor: pointer;
  }
  .pkg-radio {
    accent-color: var(--primary);
    width: 18px; height: 18px; cursor: pointer;
  }
  .pkg-radio-text {
    font-size: 13px; font-weight: 500; color: var(--text-muted);
  }

  /* ── Terms Accordion ── */
  .terms-details {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
  }
  .terms-summary {
    padding: 16px 20px;
    cursor: pointer; user-select: none;
    font-size: 14px; font-weight: 600; color: var(--text);
    list-style: none;
    display: flex; align-items: center; gap: 8px;
  }
  .terms-summary::-webkit-details-marker { display: none; }
  .terms-summary::before {
    content: '\\25C0'; font-size: 10px; color: var(--text-subtle);
    transition: transform 0.3s; display: inline-block;
  }
  details[open] .terms-summary::before { transform: rotate(-90deg); }
  .terms-list {
    padding: 0 24px 20px 24px;
    list-style: none;
  }
  .terms-list li {
    font-size: 13px; color: var(--text-muted);
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    position: relative; padding-right: 16px;
  }
  .terms-list li:last-child { border-bottom: none; }
  .terms-list li::before {
    content: '\\2022'; position: absolute; right: 0; top: 6px;
    color: var(--text-subtle); font-weight: 700;
  }

  /* ── Signature Section ── */
  .sig-section {
    background: linear-gradient(135deg, var(--surface), var(--surface2));
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 32px 28px;
    margin-top: 16px;
  }
  .sig-title {
    font-size: 18px; font-weight: 700; color: var(--text);
    margin-bottom: 24px; text-align: center;
  }
  .sig-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px; margin-bottom: 16px;
  }
  @media (max-width: 640px) { .sig-row { grid-template-columns: 1fr; } }

  .sig-field { display: flex; flex-direction: column; gap: 6px; }
  .sig-label {
    font-size: 12px; font-weight: 600; color: var(--text-muted);
  }
  .sig-input {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px;
    font-size: 14px; color: var(--text);
    font-family: 'Heebo', sans-serif;
    outline: none; transition: border-color 0.2s;
  }
  .sig-input:focus { border-color: var(--primary); }
  .sig-input.sig-error { border-color: var(--error); }

  .sig-selected-pkg {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 14px;
    font-size: 14px; color: var(--primary);
    font-weight: 600;
  }

  .sig-canvas-wrap {
    margin: 20px 0 16px; text-align: center;
  }
  .sig-canvas-label {
    font-size: 12px; color: var(--text-muted); margin-bottom: 8px;
    font-weight: 600;
  }
  .sig-canvas {
    border: 2px dashed var(--border);
    border-radius: 12px; cursor: crosshair;
    background: white; display: block; margin: 0 auto;
    touch-action: none;
    max-width: 100%;
  }

  .sig-btns {
    display: flex; gap: 12px; justify-content: center;
    margin-top: 16px; flex-wrap: wrap;
  }
  .btn {
    font-family: 'Heebo', sans-serif;
    padding: 12px 32px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    transition: all 0.3s;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--accent));
    color: white;
    box-shadow: 0 4px 16px ${brand.primaryColor}33;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px ${brand.primaryColor}44;
  }
  .btn-primary:disabled {
    opacity: 0.5; cursor: not-allowed; transform: none;
    box-shadow: none;
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .btn-ghost:hover {
    background: rgba(255,255,255,0.04);
  }

  .sig-error-msg {
    color: var(--error); font-size: 12px;
    text-align: center; margin-top: 8px;
    min-height: 18px;
  }

  /* ── Spinner ── */
  .spinner {
    display: inline-block; width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Success State ── */
  .success-overlay {
    display: none;
    position: fixed; inset: 0; z-index: 100;
    background: var(--bg);
    flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; text-align: center; padding: 24px;
  }
  .success-overlay.active { display: flex; }
  .success-icon {
    font-size: 64px; margin-bottom: 8px;
    animation: successPop 0.5s ease;
  }
  @keyframes successPop {
    0% { transform: scale(0); }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  .success-title {
    font-size: 28px; font-weight: 900; color: var(--success);
  }
  .success-sub {
    font-size: 15px; color: var(--text-muted); max-width: 400px;
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

  /* ── Logo Marquee ── */
  .logos-section {
    margin-top: 56px; text-align: center;
  }
  .logos-title {
    font-size: 13px; font-weight: 700; color: var(--text-subtle);
    text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px;
  }
  .marquee-wrap {
    overflow: hidden; position: relative;
    mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
  }
  .marquee-track {
    display: flex; align-items: center; gap: 48px;
    animation: marqueeScroll 30s linear infinite;
    width: max-content;
  }
  @keyframes marqueeScroll {
    from { transform: translateX(0); }
    to { transform: translateX(-33.333%); }
  }
  .marquee-logo {
    flex-shrink: 0;
  }
  .marquee-logo img {
    height: 40px; width: auto; object-fit: contain;
    filter: grayscale(100%) brightness(2); opacity: 0.4;
    transition: all 0.4s;
  }
  .marquee-logo img:hover {
    filter: grayscale(0%) brightness(1); opacity: 1;
  }

  /* ── Stats Bar ── */
  .stats-bar {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
    margin-top: 24px;
  }
  @media (max-width: 640px) { .stats-bar { grid-template-columns: repeat(2, 1fr); } }
  .stat-item {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px 12px; text-align: center;
    transition: transform 0.3s;
  }
  .stat-item:hover { transform: translateY(-2px); }
  .stat-value {
    font-size: 28px; font-weight: 900;
    background: linear-gradient(135deg, var(--primary), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .stat-label {
    font-size: 11px; color: var(--text-subtle); font-weight: 600;
    margin-top: 4px;
  }

  /* ── Testimonials Carousel ── */
  .testi-carousel { position: relative; overflow: hidden; }
  .testi-viewport {
    overflow: hidden; border-radius: 16px;
  }
  .testi-track {
    display: flex; transition: transform 0.5s ease;
  }
  .testi-card {
    min-width: 100%; box-sizing: border-box;
    background: linear-gradient(135deg, var(--surface), var(--surface2));
    border: 1px solid var(--border); border-radius: 16px;
    padding: 32px 28px; text-align: center;
  }
  .testi-stars {
    font-size: 20px; color: #f59e0b; margin-bottom: 16px;
    letter-spacing: 4px;
  }
  .testi-content {
    font-size: 16px; color: var(--text-muted); line-height: 1.8;
    font-style: italic; max-width: 600px; margin: 0 auto 20px;
  }
  .testi-author { border-top: 1px solid var(--border); padding-top: 16px; }
  .testi-name { font-size: 16px; font-weight: 700; color: var(--text); }
  .testi-role { font-size: 12px; color: var(--primary); font-weight: 500; margin-top: 2px; }
  .testi-dots {
    display: flex; justify-content: center; gap: 8px; margin-top: 16px;
  }
  .testi-dot {
    width: 10px; height: 10px; border-radius: 50%;
    border: 1px solid var(--text-subtle); background: transparent;
    cursor: pointer; transition: all 0.3s; padding: 0;
  }
  .testi-dot.active {
    background: var(--primary); border-color: var(--primary);
    box-shadow: 0 0 8px var(--primary);
  }

  /* ── Full Terms Modal/Overlay ── */
  .full-terms-link { text-align: center; margin-top: 12px; }
  .btn-terms-open {
    font-family: 'Heebo', sans-serif;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--primary); font-size: 14px; font-weight: 600;
    padding: 12px 28px; border-radius: 12px; cursor: pointer;
    transition: all 0.3s;
  }
  .btn-terms-open:hover {
    background: var(--primary); color: white;
    box-shadow: 0 4px 16px ${brand.primaryColor}33;
  }
  .terms-overlay {
    display: none; position: fixed; inset: 0; z-index: 90;
    background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
    align-items: center; justify-content: center; padding: 24px;
  }
  .terms-overlay.active { display: flex; }
  .terms-modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; max-width: 700px; width: 100%;
    max-height: 80vh; display: flex; flex-direction: column;
    overflow: hidden;
  }
  .terms-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px; border-bottom: 1px solid var(--border);
  }
  .terms-modal-header h3 {
    font-size: 18px; font-weight: 700; color: var(--text);
  }
  .terms-close {
    background: none; border: none; color: var(--text-muted);
    font-size: 28px; cursor: pointer; padding: 0 8px;
    transition: color 0.2s;
  }
  .terms-close:hover { color: var(--error); }
  .terms-modal-body {
    padding: 24px; overflow-y: auto; flex: 1;
    font-size: 13px; color: var(--text-muted); line-height: 1.9;
  }
  .terms-modal-body p { margin-bottom: 12px; }
  .terms-modal-footer {
    padding: 14px 24px; border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-subtle); text-align: center;
  }

  /* ── Website CTA ── */
  .website-cta { margin-top: 32px; }
  .website-cta-inner {
    background: linear-gradient(135deg, var(--primary)15, var(--accent)10);
    border: 1px solid var(--primary)22;
    border-radius: 16px; padding: 28px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; flex-wrap: wrap;
  }
  .website-cta-title {
    font-size: 18px; font-weight: 700; color: var(--text);
  }
  .website-cta-sub {
    font-size: 13px; color: var(--text-muted); margin-top: 4px;
  }
  .website-cta-btn {
    white-space: nowrap; text-decoration: none;
  }

  /* ── Print styles ── */
  @media print {
    body { background: white; color: #1e293b; }
    .bg-grid, .bg-glow, .bg-glow2, .success-overlay, .terms-overlay, .marquee-wrap, .testi-carousel { display: none !important; }
    .sig-section { display: none !important; }
    .reveal { opacity: 1 !important; transform: none !important; animation: none !important; }
    .phase-header, .intro-card, .pkg-card, .terms-details {
      background: #f8fafc; border-color: #e2e8f0;
    }
    .header-title { -webkit-text-fill-color: #1e293b; }
    .pkg-price { -webkit-text-fill-color: #1e293b; }
    .stat-value { -webkit-text-fill-color: #1e293b; }
    .container { padding: 20px; }
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="bg-glow"></div>
  <div class="bg-glow2"></div>

  <!-- Success Overlay (hidden) -->
  <div class="success-overlay" id="successOverlay">
    <div class="success-icon">&#10004;&#65039;</div>
    <div class="success-title">תודה! ההצעה נחתמה בהצלחה</div>
    <div class="success-sub">קיבלנו את החתימה שלך. ניצור איתך קשר בהקדם.</div>
  </div>

  <div class="container">

    <!-- Header -->
    <div class="header reveal">
      ${logoHtml}
      <div class="header-agency">${esc(brand.agencyName)}</div>
      <div class="header-title">הצעת מחיר עבור ${esc(config.businessName)}</div>
      <div class="header-sub">${esc(config.contactName)} &middot; ${dateStr}</div>
      ${validityHtml}
    </div>

    ${introHtml}

    ${config.phases.length > 0 ? `
    <!-- Work Phases -->
    <div class="section-header reveal">
      <div class="dot" style="background:${brand.secondaryColor};box-shadow:0 0 10px ${brand.secondaryColor}"></div>
      <h2>שלבי עבודה</h2>
    </div>
    ${phasesHtml}
    ` : ''}

    ${config.packages.length > 0 ? `
    <!-- Pricing Packages -->
    <div class="section-header reveal">
      <div class="dot" style="background:${brand.accentColor};box-shadow:0 0 10px ${brand.accentColor}"></div>
      <h2>חבילות מחיר</h2>
    </div>
    <div class="pkg-grid">
      ${packagesHtml}
    </div>
    ` : ''}

    ${config.terms?.items?.length > 0 ? `
    <!-- Terms & Conditions -->
    <div class="section-header reveal">
      <div class="dot"></div>
      <h2>תנאים</h2>
    </div>
    <details class="terms-details reveal" style="animation-delay:0.1s">
      <summary class="terms-summary">לחצו לצפייה בתנאים</summary>
      <ul class="terms-list">
        ${termsItems}
      </ul>
    </details>
    ` : ''}

    <!-- Full Legal Terms Link -->
    ${fullTermsHtml}

    <!-- Social Proof: Logo Marquee -->
    ${logosHtml}

    <!-- Stats Bar -->
    ${statsHtml}

    <!-- Testimonials Carousel -->
    ${testimonialsHtml}

    <!-- Website CTA -->
    ${websiteCtaHtml}

    <!-- Signature Form -->
    <div class="section-header reveal">
      <div class="dot" style="background:var(--success);box-shadow:0 0 10px var(--success)"></div>
      <h2>חתימה דיגיטלית</h2>
    </div>
    <div class="sig-section reveal" style="animation-delay:0.15s">
      <div class="sig-title">אישור וחתימה על ההצעה</div>

      <div class="sig-row">
        <div class="sig-field">
          <label class="sig-label">שם מלא *</label>
          <input type="text" id="sigName" class="sig-input" placeholder="שם מלא" autocomplete="name" />
        </div>
        <div class="sig-field">
          <label class="sig-label">ת.ז *</label>
          <input type="text" id="sigId" class="sig-input" placeholder="מספר תעודת זהות" inputmode="numeric" autocomplete="off" />
        </div>
      </div>

      <div class="sig-row">
        <div class="sig-field">
          <label class="sig-label">אימייל *</label>
          <input type="email" id="sigEmail" class="sig-input" placeholder="example@email.com" autocomplete="email" dir="ltr" />
        </div>
        <div class="sig-field">
          <label class="sig-label">חבילה נבחרת</label>
          <div class="sig-selected-pkg" id="sigPkgDisplay">-</div>
        </div>
      </div>

      <div class="sig-canvas-wrap">
        <div class="sig-canvas-label">חתימה (ציירו עם העכבר או האצבע)</div>
        <canvas id="sigCanvas" class="sig-canvas" width="400" height="150"></canvas>
      </div>

      <div class="sig-error-msg" id="sigError"></div>

      <div class="sig-btns">
        <button type="button" class="btn btn-primary" id="sigSubmit">
          <span id="sigSubmitText">אישור ושליחה</span>
        </button>
        <button type="button" class="btn btn-ghost" id="sigClear">נקה חתימה</button>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer reveal">
      <div class="footer-agency">${esc(brand.agencyName)}</div>
      <div class="footer-date">${esc(brand.ownerName)} &middot; ${dateStr}</div>
      <div class="footer-badge">Powered by AgencyManager Pro</div>
    </div>
  </div>

  <script>
  (function() {
    // ── Config ──
    var WEBHOOK_URL = ${JSON.stringify(config.webhookUrl)};
    var PROPOSAL_ID = ${JSON.stringify(config.proposalId)};

    // ── Scroll Reveal ──
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function(el) {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });

    // Immediately reveal above-fold
    setTimeout(function() {
      var hdr = document.querySelector('.header');
      if (hdr) hdr.style.animationPlayState = 'running';
      document.querySelectorAll('.header .reveal').forEach(function(el) {
        el.style.animationPlayState = 'running';
      });
    }, 100);

    // ── Viewed Beacon ──
    setTimeout(function() {
      try {
        fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposalId: PROPOSAL_ID, action: 'viewed' })
        }).catch(function() {});
      } catch(e) {}
    }, 2000);

    // ── Package Selection ──
    var pkgCards = document.querySelectorAll('.pkg-card');
    var pkgRadios = document.querySelectorAll('.pkg-radio');
    var pkgDisplay = document.getElementById('sigPkgDisplay');

    function updatePkgSelection() {
      var selected = document.querySelector('.pkg-radio:checked');
      var selectedName = selected ? selected.value : '';
      pkgCards.forEach(function(card) {
        var cardName = card.getAttribute('data-pkg-name');
        if (cardName === selectedName) {
          card.classList.add('pkg-selected');
        } else {
          card.classList.remove('pkg-selected');
        }
      });
      pkgDisplay.textContent = selectedName || '-';
    }

    pkgRadios.forEach(function(radio) {
      radio.addEventListener('change', updatePkgSelection);
    });

    // Click anywhere on card to select
    pkgCards.forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.tagName === 'INPUT') return;
        var radio = card.querySelector('.pkg-radio');
        if (radio) {
          radio.checked = true;
          updatePkgSelection();
        }
      });
    });

    // Init selection
    updatePkgSelection();

    // ── Signature Canvas ──
    var canvas = document.getElementById('sigCanvas');
    var ctx = canvas.getContext('2d');
    var drawing = false;
    var hasSignature = false;

    // Scale canvas for retina
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';

    function getPos(e) {
      var r = canvas.getBoundingClientRect();
      var clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return { x: clientX - r.left, y: clientY - r.top };
    }

    canvas.addEventListener('pointerdown', function(e) {
      drawing = true;
      hasSignature = true;
      var pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function(e) {
      if (!drawing) return;
      var pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      e.preventDefault();
    });

    canvas.addEventListener('pointerup', function() { drawing = false; });
    canvas.addEventListener('pointerleave', function() { drawing = false; });

    // ── Clear Signature ──
    document.getElementById('sigClear').addEventListener('click', function() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasSignature = false;
    });

    // ── Form Validation & Submit ──
    var sigError = document.getElementById('sigError');
    var sigSubmit = document.getElementById('sigSubmit');
    var sigSubmitText = document.getElementById('sigSubmitText');
    var submitting = false;

    function clearErrors() {
      sigError.textContent = '';
      document.querySelectorAll('.sig-error').forEach(function(el) {
        el.classList.remove('sig-error');
      });
    }

    sigSubmit.addEventListener('click', function() {
      if (submitting) return;
      clearErrors();

      var name = document.getElementById('sigName').value.trim();
      var idNum = document.getElementById('sigId').value.trim();
      var email = document.getElementById('sigEmail').value.trim();
      var selectedPkg = document.querySelector('.pkg-radio:checked');
      var pkgName = selectedPkg ? selectedPkg.value : '';

      // Validate
      var errors = [];
      if (!name) {
        errors.push('נא למלא שם מלא');
        document.getElementById('sigName').classList.add('sig-error');
      }
      if (!idNum) {
        errors.push('נא למלא תעודת זהות');
        document.getElementById('sigId').classList.add('sig-error');
      }
      if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        errors.push('נא למלא אימייל תקין');
        document.getElementById('sigEmail').classList.add('sig-error');
      }
      if (!pkgName) {
        errors.push('נא לבחור חבילה');
      }
      if (!hasSignature) {
        errors.push('נא לחתום בתיבת החתימה');
      }

      if (errors.length > 0) {
        sigError.textContent = errors.join(' | ');
        return;
      }

      // Get signature image
      var sigImage = canvas.toDataURL('image/png');

      // Show loading
      submitting = true;
      sigSubmitText.innerHTML = '<span class="spinner"></span> שולח...';
      sigSubmit.disabled = true;

      // POST to webhook
      fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: PROPOSAL_ID,
          action: 'signed',
          signature: {
            name: name,
            idNumber: idNum,
            email: email,
            signatureImage: sigImage,
            selectedPackage: pkgName,
            signedAt: new Date().toISOString()
          }
        })
      })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        // Show success
        document.getElementById('successOverlay').classList.add('active');
      })
      .catch(function(err) {
        sigError.textContent = 'שגיאה בשליחה. נסו שוב. (' + err.message + ')';
        submitting = false;
        sigSubmitText.textContent = 'אישור ושליחה';
        sigSubmit.disabled = false;
      });
    });

    // Remove error styling on input
    ['sigName', 'sigId', 'sigEmail'].forEach(function(id) {
      document.getElementById(id).addEventListener('input', function() {
        this.classList.remove('sig-error');
        sigError.textContent = '';
      });
    });

    // ── Testimonials Carousel ──
    var testiTrack = document.querySelector('.testi-track');
    var testiDots = document.querySelectorAll('.testi-dot');
    var testiCards = document.querySelectorAll('.testi-card');
    var currentTesti = 0;
    var testiCount = testiCards.length;
    var testiAutoTimer = null;

    function showTesti(idx) {
      if (idx < 0) idx = testiCount - 1;
      if (idx >= testiCount) idx = 0;
      currentTesti = idx;
      if (testiTrack) {
        testiTrack.style.transform = 'translateX(' + (idx * 100) + '%)';
      }
      testiDots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === idx);
      });
    }

    testiDots.forEach(function(dot) {
      dot.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx') || '0');
        showTesti(idx);
        resetTestiAuto();
      });
    });

    function resetTestiAuto() {
      if (testiAutoTimer) clearInterval(testiAutoTimer);
      testiAutoTimer = setInterval(function() {
        showTesti(currentTesti + 1);
      }, 5000);
    }

    if (testiCount > 1) resetTestiAuto();

    // ── Full Terms Modal ──
    var openTermsBtn = document.getElementById('openFullTerms');
    var termsOverlay = document.getElementById('termsOverlay');
    var closeTermsBtn = document.getElementById('closeFullTerms');

    if (openTermsBtn && termsOverlay) {
      openTermsBtn.addEventListener('click', function() {
        termsOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }
    if (closeTermsBtn && termsOverlay) {
      closeTermsBtn.addEventListener('click', function() {
        termsOverlay.classList.remove('active');
        document.body.style.overflow = '';
      });
      termsOverlay.addEventListener('click', function(e) {
        if (e.target === termsOverlay) {
          termsOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  })();
  </script>
</body>
</html>`;

  return html;
}

// ── Launcher ────────────────────────────────────────────────────

/** Generate the animated proposal HTML and open it in a new browser window */
export function generateAnimatedProposal(config: ProposalPageConfig, brand: ProposalBrandConfig): void {
  const html = buildAnimatedProposalHtml(config, brand);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
