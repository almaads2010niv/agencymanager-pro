import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Client, ClientRating, ClientStatus, EffortLevel } from '../types';
import { formatCurrency } from '../utils';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const Clients: React.FC = () => {
  const navigate = useNavigate();
  const { clients, services, addClient, updateClient, deleteClient } = useData();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>(ClientStatus.Active);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.clientName.includes(searchTerm) || c.businessName.includes(searchTerm);
    const matchesRating = filterRating === 'all' || c.rating === filterRating;
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesRating && matchesStatus;
  }).sort((a, b) => new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    const formData = editingClient as Client; 
    if (formData.clientId) updateClient(formData);
    else addClient(formData);
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const openNewClient = () => {
    setEditingClient({
      clientName: '',
      businessName: '',
      phone: '',
      email: '',
      industry: '',
      rating: ClientRating.B,
      status: ClientStatus.Active,
      joinDate: new Date().toISOString().split('T')[0],
      churnDate: undefined,
      monthlyRetainer: 0,
      billingDay: 1,
      services: [],
      effortLevel: EffortLevel.Medium,
      supplierCostMonthly: 0,
      notes: '',
      nextReviewDate: '',
    });
    setIsModalOpen(true);
  };

  const openEditClient = (client: Client) => {
    setEditingClient({ ...client });
    setIsModalOpen(true);
  };

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
        case ClientStatus.Active: return 'success';
        case ClientStatus.Leaving: return 'danger';
        case ClientStatus.Paused: return 'warning';
        default: return 'neutral';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">ניהול לקוחות</h2>
        <Button onClick={openNewClient} icon={<Plus size={18} />}>לקוח חדש</Button>
      </div>

      <Card className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute right-3 top-3.5 text-gray-500" size={18} />
          <Input 
            placeholder="חיפוש לפי שם לקוח או עסק..." 
            className="pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">כל הסטטוסים</option>
          {Object.values(ClientStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filterRating} onChange={(e) => setFilterRating(e.target.value)}>
          <option value="all">כל הדירוגים</option>
          {Object.values(ClientRating).map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
      </Card>

      <Card noPadding>
        <Table>
            <TableHeader>
              <TableHead>עסק</TableHead>
              <TableHead>איש קשר</TableHead>
              <TableHead>ריטיינר</TableHead>
              <TableHead>רווח</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>דירוג</TableHead>
              <TableHead>פעולות</TableHead>
            </TableHeader>
            <TableBody>
              {filteredClients.map(client => (
                <TableRow key={client.clientId}>
                  <TableCell className="font-bold text-base">
                    <button onClick={() => navigate(`/clients/${client.clientId}`)} className="text-white hover:text-primary transition-colors text-right">{client.businessName}</button>
                  </TableCell>
                  <TableCell>
                    <div className="text-white">{client.clientName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{client.phone}</div>
                  </TableCell>
                  <TableCell className="text-white font-mono">{formatCurrency(client.monthlyRetainer)}</TableCell>
                  <TableCell className="text-emerald-400 font-mono">
                    {formatCurrency(client.monthlyRetainer - client.supplierCostMonthly)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(client.status)}>{client.status}</Badge>
                  </TableCell>
                  <TableCell>
                     <Badge variant={client.rating === 'A_plus' ? 'primary' : 'neutral'}>{client.rating}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => openEditClient(client)} icon={<Edit2 size={16} />} className="p-1" aria-label="ערוך לקוח" />
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(client.clientId)} icon={<Trash2 size={16} />} className="p-1 text-red-400 hover:text-red-300" aria-label="מחק לקוח" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 italic">לא נמצאו לקוחות</td>
                </tr>
              )}
            </TableBody>
          </Table>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient?.clientId ? 'עריכת לקוח' : 'לקוח חדש'} size="xl">
         {editingClient && (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">פרטים אישיים</h4>
                    <div className="space-y-4">
                        <Input label="שם העסק" required value={editingClient.businessName} onChange={e => setEditingClient({...editingClient, businessName: e.target.value})} />
                        <Input label="שם מלא" required value={editingClient.clientName} onChange={e => setEditingClient({...editingClient, clientName: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="טלפון" required value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} />
                            <Input label="אימייל" type="email" value={editingClient.email} onChange={e => setEditingClient({...editingClient, email: e.target.value})} />
                        </div>
                        <Input label="תעשייה" value={editingClient.industry} onChange={e => setEditingClient({...editingClient, industry: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-6">
                    <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">פרטים עסקיים</h4>
                    <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                            <Select label="סטטוס" value={editingClient.status} onChange={e => setEditingClient({...editingClient, status: e.target.value as ClientStatus})}>
                                {Object.values(ClientStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                            <Select label="דירוג הלקוח" value={editingClient.rating} onChange={e => setEditingClient({...editingClient, rating: e.target.value as ClientRating})}>
                                {Object.values(ClientRating).map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <Input label="ריטיינר חודשי (₪)" type="number" value={editingClient.monthlyRetainer || ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setEditingClient({...editingClient, monthlyRetainer: Number(e.target.value) || 0})} />
                            <Input label="עלות ספקים (₪)" type="number" value={editingClient.supplierCostMonthly || ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setEditingClient({...editingClient, supplierCostMonthly: Number(e.target.value) || 0})} />
                         </div>
                         <Input label="תאריך הצטרפות" type="date" value={editingClient.joinDate ? new Date(editingClient.joinDate).toISOString().split('T')[0] : ''} onChange={e => setEditingClient({...editingClient, joinDate: e.target.value})} />
                         <Input label="תאריך נטישה" type="date" value={editingClient.churnDate ? new Date(editingClient.churnDate).toISOString().split('T')[0] : ''} onChange={e => setEditingClient({...editingClient, churnDate: e.target.value || undefined})} />
                         {editingClient.joinDate && editingClient.churnDate && editingClient.monthlyRetainer > 0 && (() => {
                           const joinDate = new Date(editingClient.joinDate);
                           const churnDate = new Date(editingClient.churnDate);
                           const months = Math.max(0, Math.round((churnDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
                           const totalValue = months * editingClient.monthlyRetainer;
                           return (
                             <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                               <div className="text-xs text-gray-400 mb-1">שווי לקוח כולל</div>
                               <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-300">{months} חודשים</span>
                                 <span className="text-lg font-bold text-primary">{formatCurrency(totalValue)}</span>
                               </div>
                             </div>
                           );
                         })()}
                    </div>
                </div>
              </div>

              <div className="space-y-6">
                 <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">שירותים</h4>
                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {services.filter(s => s.isActive).map(service => (
                    <Checkbox 
                        key={service.serviceKey}
                        label={service.label}
                        checked={editingClient.services?.includes(service.serviceKey) || false}
                        onChange={(checked) => {
                            const current = editingClient.services || [];
                            if (checked) setEditingClient({...editingClient, services: [...current, service.serviceKey]});
                            else setEditingClient({...editingClient, services: current.filter(k => k !== service.serviceKey)});
                        }}
                    />
                  ))}
                </div>
                <Textarea label="הערות" value={editingClient.notes} onChange={e => setEditingClient({...editingClient, notes: e.target.value})} />
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                 <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
                 <Button type="submit">שמור לקוח</Button>
               </div>
            </form>
         )}
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="אישור מחיקה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את הלקוח? פעולה זו תמחק גם את כל הפרויקטים וההוצאות המשויכים.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={() => { if (confirmDeleteId) { deleteClient(confirmDeleteId); setConfirmDeleteId(null); } }}>מחק לקוח</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;