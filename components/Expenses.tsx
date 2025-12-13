import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { SupplierExpense, ExpenseType } from '../types';
import { formatCurrency, formatDate, getMonthKey } from '../utils';
import { Plus } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { Modal } from './ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const Expenses: React.FC = () => {
  const { expenses, clients, addExpense } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<SupplierExpense>>({
    clientId: '',
    expenseDate: new Date().toISOString().split('T')[0],
    supplierName: '',
    expenseType: ExpenseType.Media,
    amount: 0,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expenseData = newExpense as SupplierExpense;
    const d = new Date(expenseData.expenseDate);
    const monthKey = getMonthKey(d);

    addExpense({
      ...expenseData,
      monthKey
    });
    setIsModalOpen(false);
    setNewExpense({ ...newExpense, amount: 0, supplierName: '', notes: '' });
  };

  const getClientName = (id?: string) => {
    if(!id) return '-';
    const c = clients.find(c => c.clientId === id);
    return c ? c.businessName : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-white tracking-tight">הוצאות ספקים</h2>
        <Button onClick={() => setIsModalOpen(true)} variant="danger" icon={<Plus size={18} />}>הוצאה חדשה</Button>
      </div>

      <Card noPadding>
        <Table>
            <TableHeader>
              <TableHead>תאריך</TableHead>
              <TableHead>ספק</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>לקוח מקושר</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>הערות</TableHead>
            </TableHeader>
            <TableBody>
              {expenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(exp => (
                <TableRow key={exp.expenseId}>
                   <TableCell className="text-gray-400">{formatDate(exp.expenseDate)}</TableCell>
                   <TableCell className="font-medium text-white">{exp.supplierName}</TableCell>
                   <TableCell>{exp.expenseType}</TableCell>
                   <TableCell>{getClientName(exp.clientId)}</TableCell>
                   <TableCell className="font-mono text-red-400 font-bold">{formatCurrency(exp.amount)}</TableCell>
                   <TableCell className="text-xs text-gray-500 max-w-xs truncate">{exp.notes}</TableCell>
                </TableRow>
              ))}
               {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-500 italic">אין הוצאות רשומות</td>
                </tr>
              )}
            </TableBody>
          </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="הוספת הוצאה" size="md">
         <form onSubmit={handleSubmit} className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
               <Input label="תאריך" type="date" required value={newExpense.expenseDate} onChange={e => setNewExpense({...newExpense, expenseDate: e.target.value})} />
               <Input label="סכום (₪)" type="number" required value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: Number(e.target.value)})} />
             </div>
             <Input label="שם ספק" required value={newExpense.supplierName} onChange={e => setNewExpense({...newExpense, supplierName: e.target.value})} />
             <div className="grid grid-cols-2 gap-4">
                <Select label="סוג הוצאה" value={newExpense.expenseType} onChange={e => setNewExpense({...newExpense, expenseType: e.target.value as ExpenseType})}>
                    {Object.values(ExpenseType).map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Select label="לקוח מקושר" value={newExpense.clientId} onChange={e => setNewExpense({...newExpense, clientId: e.target.value})}>
                    <option value="">כללי</option>
                    {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.businessName}</option>)}
                </Select>
             </div>
             <Input label="הערות" value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} />
             
             <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
              <Button type="submit" variant="danger">שמור הוצאה</Button>
            </div>
         </form>
      </Modal>
    </div>
  );
};

export default Expenses;