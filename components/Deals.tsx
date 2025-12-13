import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { OneTimeDeal, DealStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Edit2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const Deals: React.FC = () => {
  const { oneTimeDeals, clients, addDeal, updateDeal } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<OneTimeDeal> | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    const formData = editingDeal as OneTimeDeal;
    if (formData.dealId) updateDeal(formData);
    else addDeal(formData);
    setIsModalOpen(false);
    setEditingDeal(null);
  };

  const openNewDeal = () => {
    setEditingDeal({
      clientId: clients.length > 0 ? clients[0].clientId : '',
      dealName: '',
      dealType: '',
      dealAmount: 0,
      dealDate: new Date().toISOString().split('T')[0],
      dealStatus: DealStatus.In_progress,
      supplierCost: 0,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const getClientName = (id: string) => {
    const c = clients.find(c => c.clientId === id);
    return c ? c.businessName : 'לא ידוע';
  };

  const getStatusBadge = (status: DealStatus) => {
      switch(status) {
          case DealStatus.Paid: return 'success';
          case DealStatus.Completed: return 'info';
          case DealStatus.In_progress: return 'warning';
          default: return 'neutral';
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-white tracking-tight">פרויקטים חד פעמיים</h2>
        <Button onClick={openNewDeal} icon={<Plus size={18} />}>פרויקט חדש</Button>
      </div>

      <Card noPadding>
        <Table>
            <TableHeader>
              <TableHead>שם הפרויקט</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>עלות ספקים</TableHead>
              <TableHead>רווח</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableHeader>
            <TableBody>
              {oneTimeDeals.map(deal => (
                <TableRow key={deal.dealId}>
                  <TableCell className="font-medium text-white">{deal.dealName}</TableCell>
                  <TableCell>{getClientName(deal.clientId)}</TableCell>
                  <TableCell className="font-mono text-white font-bold">{formatCurrency(deal.dealAmount)}</TableCell>
                  <TableCell className="font-mono text-red-300">{formatCurrency(deal.supplierCost)}</TableCell>
                  <TableCell className="font-mono text-emerald-400 font-bold">{formatCurrency(deal.dealAmount - deal.supplierCost)}</TableCell>
                  <TableCell className="text-gray-500">{formatDate(deal.dealDate)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(deal.dealStatus)}>{deal.dealStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" onClick={() => { setEditingDeal(deal); setIsModalOpen(true); }} icon={<Edit2 size={16} />} className="p-1 text-primary" />
                  </TableCell>
                </TableRow>
              ))}
               {oneTimeDeals.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gray-500 italic">אין פרויקטים להצגה</td>
                </tr>
              )}
            </TableBody>
          </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="פרויקט חדש / עריכה" size="md">
        {editingDeal && (
             <form onSubmit={handleSubmit} className="space-y-6">
                <Input label="שם הפרויקט" required value={editingDeal.dealName} onChange={e => setEditingDeal({...editingDeal, dealName: e.target.value})} />
                <Select label="לקוח" value={editingDeal.clientId} onChange={e => setEditingDeal({...editingDeal, clientId: e.target.value})}>
                     {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.businessName}</option>)}
                </Select>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="סכום עסקה (₪)" type="number" value={editingDeal.dealAmount} onChange={e => setEditingDeal({...editingDeal, dealAmount: Number(e.target.value)})} />
                    <Input label="עלות ספק (₪)" type="number" value={editingDeal.supplierCost} onChange={e => setEditingDeal({...editingDeal, supplierCost: Number(e.target.value)})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="תאריך" type="date" value={editingDeal.dealDate ? new Date(editingDeal.dealDate).toISOString().split('T')[0] : ''} onChange={e => setEditingDeal({...editingDeal, dealDate: e.target.value})} />
                    <Select label="סטטוס" value={editingDeal.dealStatus} onChange={e => setEditingDeal({...editingDeal, dealStatus: e.target.value as DealStatus})}>
                       {Object.values(DealStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
                  <Button type="submit">שמור</Button>
                </div>
              </form>
        )}
      </Modal>
    </div>
  );
};

export default Deals;