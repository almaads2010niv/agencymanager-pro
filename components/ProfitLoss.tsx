import React, { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { formatCurrency, getMonthKey, getMonthName, exportToCSV } from '../utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, TrendingUp, Target } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

interface MonthlyRow {
  monthKey: string;
  label: string;
  mrr: number;
  deals: number;
  totalRevenue: number;
  supplierExpenses: number;
  grossProfit: number;
  marginPercent: number;
}

const getLast12Months = (): string[] => {
  const result: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(getMonthKey(d));
  }
  return result;
};

const ProfitLoss: React.FC = () => {
  const { clients, oneTimeDeals, expenses, settings } = useData();

  const months = useMemo(() => getLast12Months(), []);

  const calculateMRR = (monthKey: string): number => {
    const year = parseInt(monthKey.substring(0, 4));
    const month = parseInt(monthKey.substring(4, 6));
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    return clients
      .filter((c) => {
        const joinDate = new Date(c.joinDate);
        joinDate.setHours(0, 0, 0, 0);
        if (joinDate > monthEnd) return false;
        if (!c.churnDate) return true;
        const churnDate = new Date(c.churnDate);
        churnDate.setHours(0, 0, 0, 0);
        return churnDate >= monthStart;
      })
      .reduce((sum, c) => sum + (c.monthlyRetainer || 0), 0);
  };

  const calculateDeals = (monthKey: string): number =>
    oneTimeDeals
      .filter((d) => {
        if (!d.dealDate) return false;
        return getMonthKey(new Date(d.dealDate)) === monthKey;
      })
      .reduce((sum, d) => sum + (d.dealAmount || 0), 0);

  const calculateExpenses = (monthKey: string): number =>
    expenses
      .filter((e) => e.monthKey === monthKey)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

  const rows: MonthlyRow[] = useMemo(() => {
    return months.map((mk) => {
      const mrr = calculateMRR(mk);
      const deals = calculateDeals(mk);
      const totalRevenue = mrr + deals;
      const supplierExpenses = calculateExpenses(mk);
      const grossProfit = totalRevenue - supplierExpenses;
      const marginPercent = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;
      return { monthKey: mk, label: getMonthName(mk), mrr, deals, totalRevenue, supplierExpenses, grossProfit, marginPercent };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, clients, oneTimeDeals, expenses]);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => ({
        mrr: acc.mrr + r.mrr,
        deals: acc.deals + r.deals,
        totalRevenue: acc.totalRevenue + r.totalRevenue,
        supplierExpenses: acc.supplierExpenses + r.supplierExpenses,
        grossProfit: acc.grossProfit + r.grossProfit,
      }),
      { mrr: 0, deals: 0, totalRevenue: 0, supplierExpenses: 0, grossProfit: 0 },
    );
    const marginPercent = t.totalRevenue > 0 ? Math.round((t.grossProfit / t.totalRevenue) * 100) : 0;
    return { ...t, marginPercent };
  }, [rows]);

  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.label, revenue: r.totalRevenue, expenses: r.supplierExpenses, profit: r.grossProfit })),
    [rows],
  );

  const currentMonthRow = rows[rows.length - 1];

  const revenueProgress =
    settings.targetMonthlyRevenue > 0
      ? Math.min(100, Math.round((currentMonthRow.totalRevenue / settings.targetMonthlyRevenue) * 100))
      : 0;

  const profitProgress =
    settings.targetMonthlyGrossProfit > 0
      ? Math.min(100, Math.round((currentMonthRow.grossProfit / settings.targetMonthlyGrossProfit) * 100))
      : 0;

  const handleExportCSV = () => {
    const headers = [
      'חודש',
      'ריטיינרים MRR',
      'פרויקטים',
      'סה"כ הכנסות',
      'הוצאות ספקים',
      'רווח גולמי',
      'מרג׳ין %',
    ];
    const csvRows = rows.map((r) => [
      r.label,
      String(r.mrr),
      String(r.deals),
      String(r.totalRevenue),
      String(r.supplierExpenses),
      String(r.grossProfit),
      r.marginPercent + '%',
    ]);
    csvRows.push([
      'סה"כ',
      String(totals.mrr),
      String(totals.deals),
      String(totals.totalRevenue),
      String(totals.supplierExpenses),
      String(totals.grossProfit),
      totals.marginPercent + '%',
    ]);
    exportToCSV(headers, csvRows, 'profit-loss-' + getMonthKey(new Date()) + '.csv');
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">דו״ח רווח והפסד</h2>
          <p className="text-gray-400 mt-1">סקירת הכנסות, הוצאות ורווחיות ב-12 החודשים האחרונים</p>
        </div>
        <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
          ייצוא CSV
        </Button>
      </div>

      {/* Target Progress Bars */}
      {(settings.targetMonthlyRevenue > 0 || settings.targetMonthlyGrossProfit > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settings.targetMonthlyRevenue > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Target size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">יעד הכנסות חודשי</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(currentMonthRow.totalRevenue)} / {formatCurrency(settings.targetMonthlyRevenue)}
                  </div>
                </div>
                <span className="ms-auto text-lg font-bold font-mono text-primary">{revenueProgress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-primary transition-all duration-700"
                  style={{ width: revenueProgress + '%' }}
                />
              </div>
            </Card>
          )}

          {settings.targetMonthlyGrossProfit > 0 && (
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">יעד רווח גולמי חודשי</div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(currentMonthRow.grossProfit)} / {formatCurrency(settings.targetMonthlyGrossProfit)}
                  </div>
                </div>
                <span className="ms-auto text-lg font-bold font-mono text-emerald-400">{profitProgress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-green-400 to-emerald-500 transition-all duration-700"
                  style={{ width: profitProgress + '%' }}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Line Chart */}
      <Card>
        <CardHeader title="הכנסות מול הוצאות ורווח" subtitle="מגמות 12 חודשים אחרונים" />
        <div className="h-80" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => Math.round(v / 1000) + 'k'}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#151e32',
                  borderColor: '#ffffff20',
                  color: '#f1f5f9',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend iconType="circle" />
              <Line
                type="monotone"
                dataKey="revenue"
                name="הכנסות"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ r: 0, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#fff' }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
                name="הוצאות"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 0 }}
                activeDot={{ r: 4, fill: '#ef4444' }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                name="רווח גולמי"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 0, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#10b981' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* P&L Table */}
      <Card noPadding>
        <div className="p-6 pb-0">
          <CardHeader title="טבלת רווח והפסד" subtitle="פירוט חודשי - 12 חודשים אחרונים" />
        </div>
        <Table>
          <TableHeader>
            <TableHead>חודש</TableHead>
            <TableHead>ריטיינרים MRR</TableHead>
            <TableHead>פרויקטים</TableHead>
            <TableHead>סה״כ הכנסות</TableHead>
            <TableHead>הוצאות ספקים</TableHead>
            <TableHead>רווח גולמי</TableHead>
            <TableHead>מרג׳ין %</TableHead>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.monthKey}>
                <TableCell className="font-medium text-white">{row.label}</TableCell>
                <TableCell className="font-mono">{formatCurrency(row.mrr)}</TableCell>
                <TableCell className="font-mono">{formatCurrency(row.deals)}</TableCell>
                <TableCell className="font-mono font-semibold text-white">
                  {formatCurrency(row.totalRevenue)}
                </TableCell>
                <TableCell className="font-mono text-red-400">{formatCurrency(row.supplierExpenses)}</TableCell>
                <TableCell
                  className={'font-mono font-semibold ' + (row.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}
                >
                  {formatCurrency(row.grossProfit)}
                </TableCell>
                <TableCell
                  className={'font-mono font-semibold ' + (row.marginPercent >= 50 ? 'text-emerald-400' : row.marginPercent >= 30 ? 'text-amber-400' : 'text-red-400')}
                >
                  {row.marginPercent}%
                </TableCell>
              </TableRow>
            ))}

            {/* Totals Row */}
            <tr className="border-t-2 border-white/10 bg-white/[0.03]">
              <td className="p-4 text-sm font-black text-white">סה״כ</td>
              <td className="p-4 text-sm font-mono font-bold text-white">{formatCurrency(totals.mrr)}</td>
              <td className="p-4 text-sm font-mono font-bold text-white">{formatCurrency(totals.deals)}</td>
              <td className="p-4 text-sm font-mono font-bold text-white">{formatCurrency(totals.totalRevenue)}</td>
              <td className="p-4 text-sm font-mono font-bold text-red-400">{formatCurrency(totals.supplierExpenses)}</td>
              <td className={'p-4 text-sm font-mono font-bold ' + (totals.grossProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {formatCurrency(totals.grossProfit)}
              </td>
              <td className={'p-4 text-sm font-mono font-bold ' + (totals.marginPercent >= 50 ? 'text-emerald-400' : totals.marginPercent >= 30 ? 'text-amber-400' : 'text-red-400')}>
                {totals.marginPercent}%
              </td>
            </tr>
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default ProfitLoss;
