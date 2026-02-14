/**
 * Israel Tax Calculator 2025-2026
 * Tax brackets are frozen for this period.
 * Handles combined salary + self-employed income.
 */

// Monthly tax brackets (annual ÷ 12)
const TAX_BRACKETS = [
  { upTo: 7010, rate: 0.10 },
  { upTo: 10060, rate: 0.14 },
  { upTo: 16150, rate: 0.20 },
  { upTo: 22440, rate: 0.31 },
  { upTo: 33190, rate: 0.35 },
  { upTo: 42910, rate: 0.47 },
  { upTo: Infinity, rate: 0.50 },
];

// Credit points: 2.25 points × 242 NIS per point = 544.50 NIS/month
const CREDIT_POINTS_MONTHLY = 2.25 * 242;

// Bituach Leumi self-employed rates (applied only to self-employed income)
const BL_BRACKETS = [
  { upTo: 7522, niRate: 0.0597, healthRate: 0.0310 },   // 9.07% total
  { upTo: 49030, niRate: 0.1783, healthRate: 0.0500 },   // 22.83% total
];

export interface BracketDetail {
  bracket: string;
  amount: number;
  tax: number;
  rate: number;
}

export interface TaxBreakdown {
  employeeSalary: number;
  selfEmployedIncome: number;
  totalMonthlyIncome: number;
  // Income Tax
  incomeTaxGross: number;
  creditPoints: number;
  incomeTaxAfterCredits: number;
  bracketBreakdown: BracketDetail[];
  // Bituach Leumi (on self-employed income only)
  bituachLeumiNI: number;
  bituachLeumiHealth: number;
  bituachLeumiTotal: number;
  // Totals
  totalDeductions: number;
  netIncome: number;
  effectiveTaxRate: number;
}

/**
 * Calculate progressive income tax on total monthly income.
 */
function calculateIncomeTax(totalIncome: number): { tax: number; breakdown: BracketDetail[] } {
  let remaining = totalIncome;
  let tax = 0;
  let prevLimit = 0;
  const breakdown: BracketDetail[] = [];

  for (const bracket of TAX_BRACKETS) {
    if (remaining <= 0) break;

    const bracketSize = bracket.upTo === Infinity ? remaining : bracket.upTo - prevLimit;
    const taxableInBracket = Math.min(remaining, bracketSize);
    const bracketTax = Math.round(taxableInBracket * bracket.rate);

    if (taxableInBracket > 0) {
      const fromStr = prevLimit === 0 ? '0' : (prevLimit + 1).toLocaleString('he-IL');
      const toStr = bracket.upTo === Infinity ? '∞' : bracket.upTo.toLocaleString('he-IL');
      breakdown.push({
        bracket: `₪${fromStr} - ₪${toStr}`,
        amount: Math.round(taxableInBracket),
        tax: bracketTax,
        rate: bracket.rate,
      });
    }

    tax += bracketTax;
    remaining -= taxableInBracket;
    prevLimit = bracket.upTo;
  }

  return { tax, breakdown };
}

/**
 * Calculate Bituach Leumi + Health Tax on self-employed income only.
 */
function calculateBituachLeumi(selfEmployedIncome: number): { ni: number; health: number } {
  if (selfEmployedIncome <= 0) return { ni: 0, health: 0 };

  let remaining = selfEmployedIncome;
  let ni = 0;
  let health = 0;
  let prevLimit = 0;

  for (const bracket of BL_BRACKETS) {
    if (remaining <= 0) break;

    const bracketSize = bracket.upTo - prevLimit;
    const taxableInBracket = Math.min(remaining, bracketSize);

    ni += taxableInBracket * bracket.niRate;
    health += taxableInBracket * bracket.healthRate;

    remaining -= taxableInBracket;
    prevLimit = bracket.upTo;
  }

  return { ni: Math.round(ni), health: Math.round(health) };
}

/**
 * Main calculation function.
 * @param employeeSalary - Monthly salary from employment (gross)
 * @param selfEmployedMonthlyProfit - Monthly gross profit from agency (MRR - expenses)
 */
export function calculateTax(employeeSalary: number, selfEmployedMonthlyProfit: number): TaxBreakdown {
  const salary = Math.max(0, employeeSalary);
  const selfEmployed = Math.max(0, selfEmployedMonthlyProfit);
  const totalIncome = salary + selfEmployed;

  // 1. Progressive income tax on COMBINED income
  const { tax: incomeTaxGross, breakdown } = calculateIncomeTax(totalIncome);

  // 2. Credit points deduction
  const creditPoints = CREDIT_POINTS_MONTHLY;
  const incomeTaxAfterCredits = Math.max(0, incomeTaxGross - creditPoints);

  // 3. Bituach Leumi on self-employed portion only
  const bl = calculateBituachLeumi(selfEmployed);

  // 4. Total deductions
  const totalDeductions = incomeTaxAfterCredits + bl.ni + bl.health;
  const netIncome = totalIncome - totalDeductions;
  const effectiveTaxRate = totalIncome > 0 ? (totalDeductions / totalIncome) * 100 : 0;

  return {
    employeeSalary: salary,
    selfEmployedIncome: selfEmployed,
    totalMonthlyIncome: totalIncome,
    incomeTaxGross,
    creditPoints: Math.round(creditPoints),
    incomeTaxAfterCredits,
    bracketBreakdown: breakdown,
    bituachLeumiNI: bl.ni,
    bituachLeumiHealth: bl.health,
    bituachLeumiTotal: bl.ni + bl.health,
    totalDeductions,
    netIncome,
    effectiveTaxRate: Math.round(effectiveTaxRate * 10) / 10,
  };
}
