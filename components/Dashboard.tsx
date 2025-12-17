import React from 'react';
import { useData } from '../contexts/DataContext';
import { ClientStatus, LeadStatus, PaymentStatus } from '../types';
import { formatCurrency, getMonthKey, getMonthName } from '../utils';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import { Users, UserPlus, UserMinus, DollarSign, TrendingUp, AlertCircle, FileText } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const KPICard = ({ title, value, subtitle, icon: Icon, highlight = false, color = "primary" }: any) => {
  const isPrimary = color === 'primary' || highlight;
  
  return (
    <Card className="relative overflow-hidden group" noPadding>
      {/* Background Gradient for specific cards */}
      {isPrimary && <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] -mr-10 -mt-10 transition-all group-hover:bg-primary/20" />}
      
      <div className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2 rounded-lg ${isPrimary ? 'bg-primary/10 text-primary' : 'bg-white/5 text-gray-400'}`}>
            {Icon && <Icon size={20} />}
          </div>
          {isPrimary && <div className="w-2 h-2 rounded-full bg-primary shadow-glow-primary" />}
        </div>
        
        <div className="text-3xl font-bold text-white tracking-tight mb-1">{value}</div>
        <div className="flex items-center justify-between">
            <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
            {subtitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/5">{subtitle}</span>}
        </div>
      </div>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const { clients, leads, expenses, payments, settings } = useData();
  const currentDate = new Date();
  const currentMonthKey = getMonthKey(currentDate);

  // --- Calculations ---
  const activeClients = clients.filter(c => c.status === ClientStatus.Active);
  const activeClientsCount = activeClients.length;
  const newClientsThisMonth = clients.filter(c => getMonthKey(new Date(c.joinDate)) === currentMonthKey).length;
  const churnedClientsThisMonth = clients.filter(c => c.status === ClientStatus.Left && c.churnDate && getMonthKey(new Date(c.churnDate)) === currentMonthKey).length;
  const monthlyMRR = activeClients.reduce((sum, c) => sum + (c.monthlyRetainer || 0), 0) + 
                     clients.filter(c => c.status === ClientStatus.Paused).reduce((sum, c) => sum + (c.monthlyRetainer || 0), 0);
  const totalSupplierCostCurrentMonth = expenses
    .filter(e => e.monthKey === currentMonthKey)
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const grossProfitCurrentMonth = monthlyMRR - totalSupplierCostCurrentMonth;
  const leadsOpenCount = leads.filter(l => ![LeadStatus.Won, LeadStatus.Lost, LeadStatus.Not_relevant].includes(l.status)).length;
  const hotLeadsCount = leads.filter(l => [LeadStatus.Proposal_sent, LeadStatus.Meeting_scheduled, LeadStatus.Pending_decision].includes(l.status)).length;
  const unpaidInvoicesTotal = payments
    .filter(p => p.paymentStatus !== PaymentStatus.Paid)
    .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);
  const mrrChangePercent = 10; 

  // --- Charts Data ---
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    months.push(getMonthKey(d));
  }

  // Calculate MRR for a specific month based on active clients
  const calculateMRRForMonth = (monthKey: string) => {
    const year = parseInt(monthKey.substring(0, 4));
    const month = parseInt(monthKey.substring(4, 6));
    const monthEnd = new Date(year, month, 0); // Last day of the month
    
    return clients
      .filter(c => {
        const joinDate = new Date(c.joinDate);
        const churnDate = c.churnDate ? new Date(c.churnDate) : null;
        
        // Client was active if they joined before/during this month AND didn't churn before this month
        const joinedBeforeOrDuring = joinDate <= monthEnd;
        const didNotChurnBefore = !churnDate || churnDate >= new Date(year, month - 1, 1);
        
        return joinedBeforeOrDuring && didNotChurnBefore;
      })
      .reduce((sum, c) => sum + (c.monthlyRetainer || 0), 0);
  };

  // Get last year's month key for comparison
  const getLastYearMonthKey = (monthKey: string) => {
    const year = parseInt(monthKey.substring(0, 4)) - 1;
    const month = monthKey.substring(4, 6);
    return `${year}${month}`;
  };

  const mrrData = months.map(mKey => {
    const lastYearMKey = getLastYearMonthKey(mKey);
    return {
      name: getMonthName(mKey),
      mrr: calculateMRRForMonth(mKey),
      mrrLastYear: calculateMRRForMonth(lastYearMKey)
    };
  });

  const clientFlowData = months.map(mKey => ({
    name: getMonthName(mKey),
    new: clients.filter(c => getMonthKey(new Date(c.joinDate)) === mKey).length,
    left: clients.filter(c => c.status === ClientStatus.Left && c.churnDate && getMonthKey(new Date(c.churnDate)) === mKey).length
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">דשבורד ראשי</h2>
          <p className="text-gray-400 mt-1">סקירה פיננסית ותפעולית בזמן אמת</p>
        </div>
        <div className="flex items-center gap-3">
            <Badge variant="neutral" className="text-sm py-1.5 px-3">
                {new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
            </Badge>
            <Badge variant="primary" className="text-sm py-1.5 px-3 shadow-glow-primary">
                לקוחות פעילים: {activeClientsCount}
            </Badge>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <KPICard title="ריטיינר (MRR)" value={formatCurrency(monthlyMRR)} subtitle="חודשי" icon={TrendingUp} highlight />
        <KPICard title="רווח גולמי" value={formatCurrency(grossProfitCurrentMonth)} icon={DollarSign} color="accent" />
        <KPICard title="הוצאות ספקים" value={formatCurrency(totalSupplierCostCurrentMonth)} icon={DollarSign} color="danger" />
        <KPICard title="לקוחות חדשים" value={newClientsThisMonth} icon={UserPlus} color="accent" />
        <KPICard title="לקוחות שעזבו" value={churnedClientsThisMonth} icon={UserMinus} color="danger" />
        <KPICard title="לידים פתוחים" value={leadsOpenCount} icon={FileText} />
        <KPICard title="לידים חמים" value={hotLeadsCount} icon={AlertCircle} color="secondary" />
        <KPICard title="חוב פתוח" value={formatCurrency(unpaidInvoicesTotal)} icon={AlertCircle} color="danger" />
        <KPICard title="לקוחות פעילים" value={activeClientsCount} icon={Users} color="primary" />
        <KPICard 
          title="צמיחה (YOY)" 
          value={`${mrrChangePercent > 0 ? '+' : ''}${mrrChangePercent}%`} 
          color={mrrChangePercent >= 0 ? "accent" : "danger"} 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="צמיחת ריטיינרים שנתית" />
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mrrData}>
                <defs>
                  <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151e32', borderColor: '#ffffff20', color: '#f1f5f9', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="mrr" name="השנה" stroke="#06b6d4" strokeWidth={3} dot={{r: 0, strokeWidth: 2}} activeDot={{r: 6, fill: "#fff"}} />
                <Line type="monotone" dataKey="mrrLastYear" name="שנה שעברה" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{r: 0}} activeDot={{r: 4, fill: "#f59e0b"}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="גיוסים לעומת נטישות" />
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientFlowData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#151e32', borderColor: '#ffffff20', color: '#f1f5f9', borderRadius: '8px' }} />
                <Legend iconType="circle" />
                <Bar dataKey="new" name="גיוסים" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="left" name="נטישות" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tables Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="לקוחות מובילים" subtitle="מדורג לפי רווח חודשי" />
          </div>
          <Table>
            <TableHeader>
              <TableHead>שם</TableHead>
              <TableHead>דירוג</TableHead>
              <TableHead>רווח חודשי</TableHead>
            </TableHeader>
            <TableBody>
              {activeClients
                .sort((a, b) => (b.monthlyRetainer - b.supplierCostMonthly) - (a.monthlyRetainer - a.supplierCostMonthly))
                .slice(0, 5)
                .map(client => (
                <TableRow key={client.clientId}>
                  <TableCell className="font-medium text-white">{client.businessName}</TableCell>
                  <TableCell>
                    <Badge variant={client.rating === 'A_plus' ? 'primary' : client.rating === 'A' ? 'success' : 'neutral'}>
                        {client.rating}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-emerald-400 font-mono tracking-wider font-bold">
                    {formatCurrency(client.monthlyRetainer - client.supplierCostMonthly)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="לידים חדשים" subtitle="נדרש טיפול מיידי" />
          </div>
          <Table>
            <TableHeader>
              <TableHead>שם</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>תאריך קשר</TableHead>
            </TableHeader>
            <TableBody>
              {leads
                .filter(l => ![LeadStatus.Won, LeadStatus.Lost, LeadStatus.Not_relevant].includes(l.status))
                .sort((a, b) => new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime())
                .slice(0, 5)
                .map(lead => (
                <TableRow key={lead.leadId}>
                  <TableCell className="font-medium text-white">{lead.leadName}</TableCell>
                  <TableCell>
                    <Badge variant="info">{lead.status.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell className="text-gray-400 font-mono">
                    {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;