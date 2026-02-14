import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { SupplierExpense, ExpenseType } from '../types';
import { formatCurrency, formatDate, getMonthKey } from '../utils';
import { Plus, Edit2, Trash2, Zap, Repeat } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const Expenses: React.FC = () => {
  const { expenses, clients, addExpense, updateExpense, deleteExpense, generateMonthlyExpenses } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Partial<SupplierExpense> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const expenseData = editingExpense as SupplierExpense;
    const d = new Date(expenseData.expenseDate);
    const monthKey = getMonthKey(d);
    const fullData = { ...expenseData, monthKey };

    if (fullData.expenseId) {
      updateExpense(fullData);
    } else {
      addExpense(fullData);
    }
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const openNewExpense = () => {
    setEditingExpense({
      clientId: '',
      expenseDate: new Date().toISOString().split('T')[0],
      supplierName: '',
      expenseType: ExpenseType.Media,
      amount: 0,
      notes: '',
      isRecurring: false,
    });
    setIsModalOpen(true);
  };

  const openEditExpense = (expense: SupplierExpense) => {
    setEditingExpense({ ...expense });
    setIsModalOpen(true);
  };

  const getClientName = (id?: string) => {
    if(!id) return '-';
    const c = clients.find(c => c.clientId === id);
    return c ? c.businessName : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">הוצאות ספקים</h2>
        <div className="flex gap-3">
          <Button onClick={async () => {
            const monthKey = getMonthKey(new Date());
            const count = await generateMonthlyExpenses(monthKey);
            if (count > 0) alert(`נוצרו ${count} הוצאות קבועות לחודש הנוכחי`);
            else alert('כל ההוצאות הקבועות כבר קיימות לחודש זה');
          }} variant="secondary" icon={<Zap size={18} />}>ייצור הוצאות חודשיות</Button>
          <Button onClick={openNewExpense} variant="danger" icon={<Plus size={18} />}>הוצאה חדשה</Button>
        </div>
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
              <TableHead>פעולות</TableHead>
            </TableHeader>
            <TableBody>
              {expenses.sort((a,b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(exp => (
                <TableRow key={exp.expenseId}>
                   <TableCell className="text-gray-400">{formatDate(exp.expenseDate)}</TableCell>
                   <TableCell className="font-medium text-white">
                     <div className="flex items-center gap-2">
                       {exp.supplierName}
                       {exp.isRecurring && (
                         <Badge variant="info">
                           <span className="flex items-center gap-1"><Repeat size={12} />קבועה</span>
                         </Badge>
                       )}
                     </div>
                   </TableCell>
                   <TableCell>{exp.expenseType}</TableCell>
                   <TableCell>{getClientName(exp.clientId)}</TableCell>
                   <TableCell className="font-mono text-red-400 font-bold">{formatCurrency(exp.amount)}</TableCell>
                   <TableCell className="text-xs text-gray-500 max-w-xs truncate">{exp.notes}</TableCell>
                   <TableCell>
                     <div className="flex gap-2">
                       <Button
                         variant="ghost"
                         onClick={() => openEditExpense(exp)}
                         icon={<Edit2 size={16} />}
                         className="p-1"
                         aria-label="ערוך הוצאה"
                       />
                       <Button
                         variant="ghost"
                         onClick={() => setConfirmDeleteId(exp.expenseId)}
                         icon={<Trash2 size={16} />}
                         className="p-1 text-red-400 hover:text-red-300"
                         aria-label="מחק הוצאה"
                       />
                     </div>
                   </TableCell>
                </TableRow>
              ))}
               {expenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 italic">אין הוצאות רשומות</td>
                </tr>
              )}
            </TableBody>
          </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense?.expenseId ? 'עריכת הוצאה' : 'הוספת הוצאה'} size="md">
        {editingExpense && (
         <form onSubmit={handleSubmit} className="space-y-6">
             <div className="grid grid-cols-2 gap-4">
               <Input label="תאריך" type="date" required value={editingExpense.expenseDate} onChange={e => setEditingExpense({...editingExpense, expenseDate: e.target.value})} />
               <Input label="סכום (₪)" type="number" required value={editingExpense.amount || ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setEditingExpense({...editingExpense, amount: Number(e.target.value) || 0})} />
             </div>
             <Input label="שם ספק" required value={editingExpense.supplierName} onChange={e => setEditingExpense({...editingExpense, supplierName: e.target.value})} />
             <div className="grid grid-cols-2 gap-4">
                <Select label="סוג הוצאה" value={editingExpense.expenseType} onChange={e => setEditingExpense({...editingExpense, expenseType: e.target.value as ExpenseType})}>
                    {Object.values(ExpenseType).map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Select label="לקוח מקושר" value={editingExpense.clientId} onChange={e => setEditingExpense({...editingExpense, clientId: e.target.value})}>
                    <option value="">כללי</option>
                    {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.businessName}</option>)}
                </Select>
             </div>
             <Input label="הערות" value={editingExpense.notes} onChange={e => setEditingExpense({...editingExpense, notes: e.target.value})} />

             <Checkbox
               label="הוצאה קבועה (חוזרת מדי חודש)"
               checked={editingExpense.isRecurring || false}
               onChange={(checked) => setEditingExpense({...editingExpense, isRecurring: checked})}
             />

             <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
              <Button type="submit" variant="danger">שמור הוצאה</Button>
            </div>
         </form>
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="אישור מחיקה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק הוצאה זו?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={() => { if (confirmDeleteId) { deleteExpense(confirmDeleteId); setConfirmDeleteId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Expenses;
