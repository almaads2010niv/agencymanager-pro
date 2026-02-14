import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Payment, PaymentStatus } from '../types';
import { formatCurrency, getMonthName, getMonthKey, exportToCSV } from '../utils';
import { Plus, Search, Edit2, Trash2, Check, Zap, Download, CheckCheck } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const Debts: React.FC = () => {
  const { clients, payments, addPayment, updatePayment, deletePayment, generateMonthlyPayments } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Partial<Payment> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('unpaid');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkMarkAsPaid = async () => {
    for (const id of selectedIds) {
      const payment = payments.find(p => p.paymentId === id);
      if (payment && payment.paymentStatus !== PaymentStatus.Paid) {
        await updatePayment({
          ...payment,
          amountPaid: payment.amountDue,
          paymentStatus: PaymentStatus.Paid,
          paymentDate: new Date().toISOString().split('T')[0]
        });
      }
    }
    setSelectedIds(new Set());
  };

  // Filter only active clients for selection
  const activeClients = clients.filter(c => c.status !== 'עזב');

  const filteredPayments = payments.filter(p => {
    const client = clients.find(c => c.clientId === p.clientId);
    const matchesSearch = client?.businessName?.includes(searchTerm) || client?.clientName?.includes(searchTerm);
    let matchesStatus = true;
    if (filterStatus === 'unpaid') {
      matchesStatus = p.paymentStatus !== PaymentStatus.Paid;
    } else if (filterStatus !== 'all') {
      matchesStatus = p.paymentStatus === filterStatus;
    }
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalDebt = payments
    .filter(p => p.paymentStatus !== PaymentStatus.Paid)
    .reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !editingPayment.clientId) return;
    
    const formData = editingPayment as Payment;
    if (formData.paymentId) {
      updatePayment(formData);
    } else {
      addPayment(formData);
    }
    setIsModalOpen(false);
    setEditingPayment(null);
  };

  const openNewPayment = () => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    setEditingPayment({
      clientId: '',
      periodMonth: monthKey,
      amountDue: 0,
      amountPaid: 0,
      paymentStatus: PaymentStatus.Unpaid,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditPayment = (payment: Payment) => {
    setEditingPayment({ ...payment });
    setIsModalOpen(true);
  };

  const markAsPaid = (payment: Payment) => {
    updatePayment({
      ...payment,
      amountPaid: payment.amountDue,
      paymentStatus: PaymentStatus.Paid,
      paymentDate: new Date().toISOString().split('T')[0]
    });
  };

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.Paid: return 'success';
      case PaymentStatus.Partial: return 'warning';
      case PaymentStatus.Unpaid: return 'danger';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.Paid: return 'שולם';
      case PaymentStatus.Partial: return 'שולם חלקית';
      case PaymentStatus.Unpaid: return 'לא שולם';
      default: return status;
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.clientId === clientId);
    return client?.businessName || 'לקוח לא נמצא';
  };

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      options.push({ value: monthKey, label: getMonthName(monthKey) });
    }
    return options;
  };

  const handleExportCSV = () => {
    const headers = ['לקוח', 'חודש', 'סכום חוב', 'שולם', 'יתרה', 'סטטוס'];
    const rows = filteredPayments.map(p => [
      getClientName(p.clientId),
      getMonthName(p.periodMonth),
      p.amountDue.toString(),
      p.amountPaid.toString(),
      (p.amountDue - p.amountPaid).toString(),
      getStatusLabel(p.paymentStatus),
    ]);
    exportToCSV(headers, rows, `debts_${getMonthKey(new Date())}.csv`);
  };

  const unpaidInFiltered = filteredPayments.filter(p => p.paymentStatus !== PaymentStatus.Paid);
  const toggleSelectAll = () => {
    if (selectedIds.size === unpaidInFiltered.length && unpaidInFiltered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unpaidInFiltered.map(p => p.paymentId)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">חובות לקוחות</h2>
          <p className="text-gray-400 mt-1">סה"כ חוב פתוח: <span className="text-red-400 font-bold">{formatCurrency(totalDebt)}</span></p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleExportCSV} variant="ghost" icon={<Download size={16} />}>CSV</Button>
          {selectedIds.size > 0 && (
            <Button onClick={bulkMarkAsPaid} variant="secondary" icon={<CheckCheck size={16} />}>
              סמן {selectedIds.size} כשולם
            </Button>
          )}
          <Button onClick={async () => {
            const monthKey = getMonthKey(new Date());
            const count = await generateMonthlyPayments(monthKey);
            if (count > 0) alert(`נוצרו ${count} חובות חדשים לחודש הנוכחי`);
            else alert('כל הלקוחות כבר מופיעים בחובות החודש');
          }} variant="secondary" icon={<Zap size={18} />}>ייצור חובות</Button>
          <Button onClick={openNewPayment} icon={<Plus size={18} />}>הוסף חוב</Button>
        </div>
      </div>

      <Card className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute right-3 top-3.5 text-gray-500" size={18} />
          <Input 
            placeholder="חיפוש לפי שם לקוח..." 
            className="pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="unpaid">חובות פתוחים (ברירת מחדל)</option>
          <option value="all">כל הסטטוסים</option>
          <option value={PaymentStatus.Unpaid}>לא שולם</option>
          <option value={PaymentStatus.Partial}>שולם חלקית</option>
          <option value={PaymentStatus.Paid}>שולם</option>
        </Select>
      </Card>

      <Card noPadding>
        <Table>
          <TableHeader>
            <TableHead>
              <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === unpaidInFiltered.length} onChange={toggleSelectAll} className="rounded bg-white/5 border-white/20 text-primary focus:ring-primary cursor-pointer" />
            </TableHead>
            <TableHead>לקוח</TableHead>
            <TableHead>חודש שירות</TableHead>
            <TableHead>סכום חוב</TableHead>
            <TableHead>שולם</TableHead>
            <TableHead>יתרה</TableHead>
            <TableHead>סטטוס</TableHead>
            <TableHead>פעולות</TableHead>
          </TableHeader>
          <TableBody>
            {filteredPayments.map(payment => (
              <TableRow key={payment.paymentId}>
                <TableCell>
                  {payment.paymentStatus !== PaymentStatus.Paid && (
                    <input type="checkbox" checked={selectedIds.has(payment.paymentId)} onChange={() => toggleSelect(payment.paymentId)} className="rounded bg-white/5 border-white/20 text-primary focus:ring-primary cursor-pointer" />
                  )}
                </TableCell>
                <TableCell className="font-bold text-white text-base">
                  {getClientName(payment.clientId)}
                </TableCell>
                <TableCell className="text-gray-300">
                  {getMonthName(payment.periodMonth)}
                </TableCell>
                <TableCell className="text-white font-mono">
                  {formatCurrency(payment.amountDue)}
                </TableCell>
                <TableCell className="text-emerald-400 font-mono">
                  {formatCurrency(payment.amountPaid)}
                </TableCell>
                <TableCell className="text-red-400 font-mono font-bold">
                  {formatCurrency(payment.amountDue - payment.amountPaid)}
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadge(payment.paymentStatus)}>
                    {getStatusLabel(payment.paymentStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {payment.paymentStatus !== PaymentStatus.Paid && (
                      <Button 
                        variant="ghost" 
                        onClick={() => markAsPaid(payment)} 
                        icon={<Check size={16} />} 
                        className="p-1 text-emerald-400 hover:text-emerald-300" 
                        title="סמן כשולם"
                      />
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => openEditPayment(payment)}
                      icon={<Edit2 size={16} />}
                      className="p-1"
                      aria-label="ערוך חוב"
                    />
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDeleteId(payment.paymentId)}
                      icon={<Trash2 size={16} />}
                      className="p-1 text-red-400 hover:text-red-300"
                      aria-label="מחק חוב"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-500 italic">
                  אין חובות רשומים
                </td>
              </tr>
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPayment?.paymentId ? 'עריכת חוב' : 'הוספת חוב חדש'}>
        {editingPayment && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Select 
              label="בחר לקוח" 
              required 
              value={editingPayment.clientId} 
              onChange={e => setEditingPayment({...editingPayment, clientId: e.target.value})}
            >
              <option value="">-- בחר לקוח --</option>
              {activeClients.map(client => (
                <option key={client.clientId} value={client.clientId}>
                  {client.businessName} ({client.clientName})
                </option>
              ))}
            </Select>

            <Select 
              label="חודש שירות" 
              required
              value={editingPayment.periodMonth} 
              onChange={e => setEditingPayment({...editingPayment, periodMonth: e.target.value})}
            >
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="סכום חוב (₪)" 
                type="number" 
                required
                value={editingPayment.amountDue || ''} 
                onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                onChange={e => setEditingPayment({...editingPayment, amountDue: Number(e.target.value) || 0})} 
              />
              <Input 
                label="סכום ששולם (₪)" 
                type="number" 
                value={editingPayment.amountPaid || ''} 
                onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                onChange={e => {
                  const amountPaid = Number(e.target.value) || 0;
                  const amountDue = editingPayment.amountDue || 0;
                  let status = PaymentStatus.Unpaid;
                  if (amountPaid >= amountDue && amountDue > 0) status = PaymentStatus.Paid;
                  else if (amountPaid > 0) status = PaymentStatus.Partial;
                  setEditingPayment({...editingPayment, amountPaid, paymentStatus: status});
                }} 
              />
            </div>

            <Select 
              label="סטטוס" 
              value={editingPayment.paymentStatus} 
              onChange={e => setEditingPayment({...editingPayment, paymentStatus: e.target.value as PaymentStatus})}
            >
              <option value={PaymentStatus.Unpaid}>לא שולם</option>
              <option value={PaymentStatus.Partial}>שולם חלקית</option>
              <option value={PaymentStatus.Paid}>שולם</option>
            </Select>

            <Textarea 
              label="הערות" 
              value={editingPayment.notes} 
              onChange={e => setEditingPayment({...editingPayment, notes: e.target.value})} 
            />

            <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
              <Button type="submit">שמור</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="אישור מחיקה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק חוב זה?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={() => { if (confirmDeleteId) { deletePayment(confirmDeleteId); setConfirmDeleteId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Debts;
