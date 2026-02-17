import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { ClientStatus } from '../types';
import { formatCurrency, getMonthKey } from '../utils';
import { calculateTax } from '../utils/taxCalculator';
import type { TaxBreakdown } from '../utils/taxCalculator';
import { Calculator, ChevronDown, ChevronUp, Info, AlertTriangle, Settings } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Form';

const TaxCalculator: React.FC = () => {
  const { clients, expenses, settings, updateSettings } = useData();
  const [showBrackets, setShowBrackets] = useState(true);
  const [showBL, setShowBL] = useState(true);
  const [editSalary, setEditSalary] = useState(false);
  const [tempSalary, setTempSalary] = useState(settings.employeeSalary || 0);

  const currentDate = new Date();
  const currentMonthKey = getMonthKey(currentDate);

  // Calculate agency gross profit (MRR - expenses)
  const activeClients = clients.filter(c => c.status === ClientStatus.Active || c.status === ClientStatus.Paused);
  const monthlyMRR = activeClients.reduce((sum, c) => sum + (c.monthlyRetainer || 0), 0);
  const monthlyExpenses = expenses
    .filter(e => e.monthKey === currentMonthKey)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const agencyGrossProfit = monthlyMRR - monthlyExpenses;

  const taxData: TaxBreakdown = calculateTax(settings.employeeSalary || 0, agencyGrossProfit);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(0)}%`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Calculator className="text-primary" size={28} />
            מחשבון מס הכנסה
          </h2>
          <p className="text-gray-400 mt-1">חישוב מס על הכנסה משולבת - שכיר + עצמאי (2025-2026)</p>
        </div>
        <Badge variant="primary" className="text-sm py-1.5 px-3">
          {currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
        </Badge>
      </div>

      {/* Salary Configuration Card */}
      <Card className="border border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings size={18} />
            </div>
            <div>
              <div className="text-sm text-gray-400">משכורת שכיר חודשית</div>
              {!editSalary ? (
                <div className="text-xl font-bold text-white">{settings.employeeSalary > 0 ? formatCurrency(settings.employeeSalary) : <span className="text-amber-400">לא הוגדרה</span>}</div>
              ) : (
                <div className="flex items-center gap-3 mt-1">
                  <Input
                    type="number"
                    value={tempSalary || ''}
                    onChange={e => setTempSalary(Number(e.target.value) || 0)}
                    className="w-40"
                    placeholder="₪ סכום חודשי"
                    onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                  />
                  <Button onClick={async () => {
                    await updateSettings({ ...settings, employeeSalary: tempSalary });
                    setEditSalary(false);
                  }}>שמור</Button>
                  <Button variant="ghost" onClick={() => { setEditSalary(false); setTempSalary(settings.employeeSalary || 0); }}>ביטול</Button>
                </div>
              )}
            </div>
          </div>
          {!editSalary && (
            <Button variant="secondary" onClick={() => { setTempSalary(settings.employeeSalary || 0); setEditSalary(true); }}>
              {settings.employeeSalary > 0 ? 'עדכן' : 'הגדר משכורת'}
            </Button>
          )}
        </div>
        {settings.employeeSalary === 0 && !editSalary && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              לא הוגדרה משכורת שכיר. החישוב מתבצע על הכנסה עצמאית בלבד.
              לחץ "הגדר משכורת" כדי להוסיף את המשכורת החודשית שלך ולקבל חישוב מדויק.
            </p>
          </div>
        )}
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-[40px] -mr-8 -mt-8" />
          <div className="relative z-10">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">הכנסה כוללת</div>
            <div className="text-3xl font-bold text-white">{formatCurrency(taxData.totalMonthlyIncome)}</div>
            <div className="mt-2 flex gap-2 text-xs text-gray-400">
              <span>שכיר: {formatCurrency(taxData.employeeSalary)}</span>
              <span className="text-gray-600">|</span>
              <span>עצמאי: {formatCurrency(taxData.selfEmployedIncome)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">מס הכנסה (נטו)</div>
          <div className="text-3xl font-bold text-red-400">{formatCurrency(taxData.incomeTaxAfterCredits)}</div>
          <div className="mt-2 text-xs text-gray-400">
            לפני נקודות: {formatCurrency(taxData.incomeTaxGross)} | נקודות: -{formatCurrency(taxData.creditPoints)}
          </div>
        </Card>

        <Card>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">ביטוח לאומי + בריאות</div>
          <div className="text-3xl font-bold text-amber-400">{formatCurrency(taxData.bituachLeumiTotal)}</div>
          <div className="mt-2 text-xs text-gray-400">
            ב"ל: {formatCurrency(taxData.bituachLeumiNI)} | בריאות: {formatCurrency(taxData.bituachLeumiHealth)}
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-[40px] -mr-8 -mt-8" />
          <div className="relative z-10">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">נטו בכיס</div>
            <div className="text-3xl font-bold text-emerald-400">{formatCurrency(taxData.netIncome)}</div>
            <div className="mt-2 text-xs text-gray-400">
              שיעור מס אפקטיבי: <span className="text-white font-bold">{taxData.effectiveTaxRate}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Visual Income Bar */}
      <Card>
        <CardHeader title="פילוח הכנסה חודשית" />
        {taxData.totalMonthlyIncome > 0 ? (
          <div className="space-y-4">
            <div className="flex h-10 rounded-xl overflow-hidden">
              <div
                className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                style={{ width: `${(taxData.netIncome / taxData.totalMonthlyIncome) * 100}%` }}
              >
                {((taxData.netIncome / taxData.totalMonthlyIncome) * 100).toFixed(0)}%
              </div>
              <div
                className="bg-red-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                style={{ width: `${(taxData.incomeTaxAfterCredits / taxData.totalMonthlyIncome) * 100}%` }}
              >
                {((taxData.incomeTaxAfterCredits / taxData.totalMonthlyIncome) * 100).toFixed(0)}%
              </div>
              <div
                className="bg-amber-500 flex items-center justify-center text-xs font-bold text-white transition-all"
                style={{ width: `${(taxData.bituachLeumiTotal / taxData.totalMonthlyIncome) * 100}%` }}
              >
                {((taxData.bituachLeumiTotal / taxData.totalMonthlyIncome) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-gray-300">נטו</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-300">מס הכנסה</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-gray-300">ביטוח לאומי + בריאות</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 italic">אין הכנסות לחישוב</p>
        )}
      </Card>

      {/* Income Tax Brackets */}
      <Card>
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowBrackets(!showBrackets)}
        >
          <CardHeader title="פירוט מדרגות מס הכנסה" />
          {showBrackets ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {showBrackets && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-4 gap-4 text-xs text-gray-500 uppercase tracking-wider pb-2 border-b border-white/10">
              <span>מדרגה</span>
              <span>סכום במדרגה</span>
              <span>שיעור מס</span>
              <span>מס</span>
            </div>
            {taxData.bracketBreakdown.map((b, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 text-sm py-2 border-b border-white/5">
                <span className="text-gray-300">{b.bracket}</span>
                <span className="text-white font-mono">{formatCurrency(b.amount)}</span>
                <span className="text-gray-400">{formatPercent(b.rate)}</span>
                <span className="text-red-400 font-mono font-bold">{formatCurrency(b.tax)}</span>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-4 text-sm py-3 border-t border-white/10 font-bold">
              <span className="text-gray-300">סה"כ מס ברוטו</span>
              <span></span>
              <span></span>
              <span className="text-red-400 font-mono">{formatCurrency(taxData.incomeTaxGross)}</span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm py-2">
              <span className="text-emerald-400">נקודות זיכוי (2.25)</span>
              <span></span>
              <span></span>
              <span className="text-emerald-400 font-mono">-{formatCurrency(taxData.creditPoints)}</span>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm py-3 border-t border-white/10 font-bold">
              <span className="text-white">מס הכנסה לתשלום</span>
              <span></span>
              <span></span>
              <span className="text-red-400 font-mono text-lg">{formatCurrency(taxData.incomeTaxAfterCredits)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Bituach Leumi */}
      <Card>
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowBL(!showBL)}
        >
          <CardHeader title="ביטוח לאומי ומס בריאות (על הכנסה עצמאית בלבד)" />
          {showBL ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </button>
        {showBL && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <Info size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-400">
                ביטוח לאומי מחושב רק על ההכנסה העצמאית ({formatCurrency(taxData.selfEmployedIncome)}).
                משכורת שכיר ({formatCurrency(taxData.employeeSalary)}) כבר כוללת ניכויי ב"ל ע"י המעסיק.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">ביטוח לאומי</div>
                <div className="text-2xl font-bold text-amber-400 font-mono">{formatCurrency(taxData.bituachLeumiNI)}</div>
                <div className="text-xs text-gray-500 mt-1">עד ₪7,522: 5.97% | מעל: 17.83%</div>
              </div>
              <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">מס בריאות</div>
                <div className="text-2xl font-bold text-amber-400 font-mono">{formatCurrency(taxData.bituachLeumiHealth)}</div>
                <div className="text-xs text-gray-500 mt-1">עד ₪7,522: 3.10% | מעל: 5.00%</div>
              </div>
              <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">סה"כ ב"ל + בריאות</div>
                <div className="text-2xl font-bold text-amber-400 font-mono">{formatCurrency(taxData.bituachLeumiTotal)}</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Final Summary */}
      <Card className="relative overflow-hidden border-t-4 border-t-emerald-500">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[60px] -mr-16 -mt-16" />
        <div className="relative z-10">
          <CardHeader title="סיכום חודשי" />
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-300">הכנסה מעבודה (שכיר)</span>
              <span className="text-white font-mono">{formatCurrency(taxData.employeeSalary)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-gray-300">רווח מהעסק (עצמאי)</span>
              <span className="text-white font-mono">{formatCurrency(taxData.selfEmployedIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5 font-bold">
              <span className="text-white">הכנסה ברוטו כוללת</span>
              <span className="text-white font-mono text-lg">{formatCurrency(taxData.totalMonthlyIncome)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-red-400">מס הכנסה</span>
              <span className="text-red-400 font-mono">-{formatCurrency(taxData.incomeTaxAfterCredits)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <span className="text-amber-400">ביטוח לאומי + בריאות</span>
              <span className="text-amber-400 font-mono">-{formatCurrency(taxData.bituachLeumiTotal)}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-t-2 border-emerald-500/30">
              <span className="text-emerald-400 text-xl font-black">נטו בכיס</span>
              <span className="text-emerald-400 font-mono text-2xl font-black">{formatCurrency(taxData.netIncome)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TaxCalculator;
