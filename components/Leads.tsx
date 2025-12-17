import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Lead, LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel } from '../types';
import { formatCurrency } from '../utils';
import { Plus, Search, CheckCircle, XCircle } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';

const Leads: React.FC = () => {
  const { leads, services, addLead, updateLead, deleteLead, convertLeadToClient } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.leadName.includes(searchTerm) || (l.phone && l.phone.includes(searchTerm));
    const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const formData = editingLead as Lead;
    if (formData.leadId) updateLead(formData);
    else addLead(formData);
    setIsModalOpen(false);
    setEditingLead(null);
  };

  const openNewLead = () => {
    setEditingLead({
      leadName: '',
      businessName: '',
      phone: '',
      email: '',
      sourceChannel: SourceChannel.Facebook,
      interestedServices: [],
      status: LeadStatus.New,
      quotedMonthlyValue: 0,
      nextContactDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleConvertToClient = (lead: Lead) => {
    if (!confirm('האם להפוך ליד זה ללקוח פעיל?')) return;
    convertLeadToClient(lead.leadId, {
      clientName: lead.leadName,
      businessName: lead.businessName || lead.leadName,
      phone: lead.phone,
      email: lead.email || '',
      industry: '',
      rating: ClientRating.B,
      status: ClientStatus.Active,
      joinDate: new Date().toISOString(),
      monthlyRetainer: lead.quotedMonthlyValue,
      billingDay: 1,
      services: lead.interestedServices,
      effortLevel: EffortLevel.Medium,
      supplierCostMonthly: 0,
      notes: `הומר מליד. הערות ליד: ${lead.notes}`,
      nextReviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    });
  };

  const getStatusColor = (status: LeadStatus) => {
      if (status === LeadStatus.Won) return 'success';
      if (status === LeadStatus.Lost) return 'danger';
      if (status === LeadStatus.New) return 'info';
      return 'neutral';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">ניהול לידים</h2>
        <Button onClick={openNewLead} variant="secondary" icon={<Plus size={18} />}>ליד חדש</Button>
      </div>

       <Card className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute right-3 top-3.5 text-gray-500" size={18} />
          <Input 
            placeholder="חיפוש ליד..." 
            className="pr-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">כל הסטטוסים</option>
          {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredLeads.map(lead => (
          <Card key={lead.leadId} hoverEffect className="relative flex flex-col h-full border-t-4 border-t-transparent hover:border-t-primary transition-all">
             <div className="flex justify-between items-start mb-4">
                <Badge variant={getStatusColor(lead.status)}>{lead.status}</Badge>
                {lead.status !== LeadStatus.Won && lead.status !== LeadStatus.Lost && (
                    <div className="flex gap-1">
                        <Button variant="ghost" onClick={() => handleConvertToClient(lead)} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle size={16}/></Button>
                        <Button variant="ghost" onClick={() => updateLead({...lead, status: LeadStatus.Not_relevant})} className="p-1.5 text-gray-500 hover:text-red-400"><XCircle size={16}/></Button>
                    </div>
                )}
             </div>
             
             <h3 className="text-xl font-bold text-white mb-1">{lead.leadName}</h3>
             <p className="text-gray-400 text-sm mb-6">{lead.businessName || 'ללא שם עסק'}</p>
             
             <div className="space-y-3 text-sm text-gray-300 flex-1">
               <div className="flex justify-between border-b border-white/5 pb-2">
                 <span>מקור</span>
                 <span className="text-white">{lead.sourceChannel}</span>
               </div>
               <div className="flex justify-between border-b border-white/5 pb-2">
                 <span>הצעת מחיר</span>
                 <span className="text-secondary font-mono font-bold">{formatCurrency(lead.quotedMonthlyValue)}</span>
               </div>
               <div className="flex justify-between pb-2">
                 <span>יצירת קשר</span>
                 <span className={`${new Date(lead.nextContactDate) < new Date() ? 'text-red-400 font-bold' : 'text-white'}`}>
                   {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
                 </span>
               </div>
               {lead.phone && (
                 <div className="flex justify-between">
                   <span>טלפון</span>
                   <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
                 </div>
               )}
             </div>

             <div className="mt-6 pt-4 border-t border-white/5">
               <Button onClick={() => { setEditingLead(lead); setIsModalOpen(true); }} variant="secondary" className="w-full">ערוך פרטים</Button>
             </div>
          </Card>
        ))}
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="פרטי ליד">
        {editingLead && (
             <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="שם הליד" required value={editingLead.leadName} onChange={e => setEditingLead({...editingLead, leadName: e.target.value})} />
                    <Input label="שם עסק" value={editingLead.businessName} onChange={e => setEditingLead({...editingLead, businessName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="טלפון" value={editingLead.phone} onChange={e => setEditingLead({...editingLead, phone: e.target.value})} />
                    <Select label="מקור" value={editingLead.sourceChannel} onChange={e => setEditingLead({...editingLead, sourceChannel: e.target.value as SourceChannel})}>
                        {Object.values(SourceChannel).map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="הצעת מחיר (₪)" type="number" value={editingLead.quotedMonthlyValue} onChange={e => setEditingLead({...editingLead, quotedMonthlyValue: Number(e.target.value)})} />
                    <Input label="תאריך קשר הבא" type="date" value={editingLead.nextContactDate ? new Date(editingLead.nextContactDate).toISOString().split('T')[0] : ''} onChange={e => setEditingLead({...editingLead, nextContactDate: e.target.value})} />
                </div>
                <Select label="סטטוס" value={editingLead.status} onChange={e => setEditingLead({...editingLead, status: e.target.value as LeadStatus})}>
                    {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
                <div>
                     <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">שירותים מתעניינים</label>
                     <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 border border-white/10 rounded-lg bg-[#0B1121]">
                        {services.filter(s => s.isActive).map(service => (
                            <Checkbox 
                                key={service.serviceKey}
                                label={service.label}
                                checked={editingLead.interestedServices?.includes(service.serviceKey) || false}
                                onChange={(checked) => {
                                    const current = editingLead.interestedServices || [];
                                    if (checked) setEditingLead({...editingLead, interestedServices: [...current, service.serviceKey]});
                                    else setEditingLead({...editingLead, interestedServices: current.filter(k => k !== service.serviceKey)});
                                }}
                            />
                        ))}
                    </div>
                </div>
                <Textarea label="הערות" value={editingLead.notes} onChange={e => setEditingLead({...editingLead, notes: e.target.value})} />
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

export default Leads;