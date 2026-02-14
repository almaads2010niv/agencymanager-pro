import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Lead, LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel } from '../types';
import { formatCurrency, formatPhoneForWhatsApp } from '../utils';
import { Plus, Search, CheckCircle, XCircle, List, LayoutGrid, Phone, MessageCircle, ArrowUpDown, Calendar } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

type ViewMode = 'table' | 'kanban';
type SortField = 'nextContactDate' | 'quotedMonthlyValue' | null;
type SortDir = 'asc' | 'desc';

const KANBAN_STATUSES: LeadStatus[] = [
  LeadStatus.New, LeadStatus.Contacted, LeadStatus.Proposal_sent,
  LeadStatus.Meeting_scheduled, LeadStatus.Pending_decision,
];

const OPEN_STATUSES: LeadStatus[] = [
  LeadStatus.New, LeadStatus.Contacted, LeadStatus.Proposal_sent,
  LeadStatus.Meeting_scheduled, LeadStatus.Pending_decision,
];

type BadgeVariant = 'success' | 'danger' | 'info' | 'neutral' | 'primary' | 'warning';

const getStatusBadgeVariant = (status: LeadStatus): BadgeVariant => {
  switch (status) {
    case LeadStatus.Won: return 'success';
    case LeadStatus.Lost: return 'danger';
    case LeadStatus.Not_relevant: return 'danger';
    case LeadStatus.New: return 'info';
    case LeadStatus.Contacted: return 'primary';
    case LeadStatus.Proposal_sent: return 'warning';
    case LeadStatus.Meeting_scheduled: return 'primary';
    case LeadStatus.Pending_decision: return 'neutral';
    default: return 'neutral';
  }
};

const getSourceBadgeVariant = (source: SourceChannel): BadgeVariant => {
  switch (source) {
    case SourceChannel.Facebook: return 'info';
    case SourceChannel.Instagram: return 'primary';
    case SourceChannel.Referral: return 'success';
    case SourceChannel.Website: return 'warning';
    case SourceChannel.WhatsApp: return 'success';
    case SourceChannel.Other: return 'neutral';
    default: return 'neutral';
  }
};

const isOverdue = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const contactDate = new Date(dateStr);
  contactDate.setHours(0, 0, 0, 0);
  return contactDate < today;
};

const Leads: React.FC = () => {
  const { leads, services, addLead, updateLead, deleteLead, convertLeadToClient } = useData();
  const { isAdmin, isViewer, user } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // All authenticated users (admin + viewer) see all leads
  const visibleLeads = leads;

  const filteredLeads = useMemo(() => {
    let result = visibleLeads.filter(l => {
      const matchesSearch =
        l.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.businessName && l.businessName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.phone && l.phone.includes(searchTerm));
      const matchesStatus = filterStatus === 'all' || l.status === filterStatus;
      const matchesSource = filterSource === 'all' || l.sourceChannel === filterSource;
      return matchesSearch && matchesStatus && matchesSource;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortField === 'nextContactDate') {
          cmp = new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime();
        } else if (sortField === 'quotedMonthlyValue') {
          cmp = a.quotedMonthlyValue - b.quotedMonthlyValue;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [visibleLeads, searchTerm, filterStatus, filterSource, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = visibleLeads.length;
    const openLeads = visibleLeads.filter(l => OPEN_STATUSES.includes(l.status));
    const openCount = openLeads.length;
    const pipelineValue = openLeads.reduce((sum, l) => sum + l.quotedMonthlyValue, 0);
    const wonCount = visibleLeads.filter(l => l.status === LeadStatus.Won).length;
    const closedCount = visibleLeads.filter(l => l.status === LeadStatus.Won || l.status === LeadStatus.Lost).length;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    return { total, openCount, pipelineValue, conversionRate };
  }, [visibleLeads]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

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
      notes: '',
      createdBy: user?.id || undefined,
    });
    setIsModalOpen(true);
  };

  const doConvertToClient = (lead: Lead) => {
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

  const handleInlineStatusChange = (lead: Lead, newStatus: LeadStatus) => {
    updateLead({ ...lead, status: newStatus });
  };

  const getRowBgClass = (lead: Lead): string => {
    if (lead.status === LeadStatus.Won) return 'bg-emerald-500/[0.04]';
    if (isOverdue(lead.nextContactDate) && OPEN_STATUSES.includes(lead.status)) return 'bg-red-500/[0.06]';
    return '';
  };

  // --- Stats Row ---

  const StatsRow = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">סה"כ לידים</p>
        <p className="text-2xl font-black text-white">{stats.total}</p>
      </Card>
      <Card className="text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">לידים פתוחים</p>
        <p className="text-2xl font-black text-blue-400">{stats.openCount}</p>
      </Card>
      <Card className="text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">ערך צנרת</p>
        <p className="text-2xl font-black text-secondary">{formatCurrency(stats.pipelineValue)}</p>
      </Card>
      <Card className="text-center">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">אחוז המרה</p>
        <p className="text-2xl font-black text-emerald-400">{stats.conversionRate}%</p>
      </Card>
    </div>
  );

  // --- Filters Bar ---

  const FiltersBar = () => (
    <Card className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute right-3 top-3.5 text-gray-500" size={18} />
        <Input
          placeholder="חיפוש לפי שם, עסק או טלפון..."
          className="pr-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="w-full md:w-48">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">כל הסטטוסים</option>
          {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      <div className="w-full md:w-48">
        <Select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option value="all">כל המקורות</option>
          {Object.values(SourceChannel).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
    </Card>
  );

  // --- Table View ---

  const TableView = () => (
    <Card noPadding>
      <Table>
        <TableHeader>
          <TableHead>שם</TableHead>
          <TableHead>עסק</TableHead>
          <TableHead>טלפון</TableHead>
          <TableHead>מקור</TableHead>
          <TableHead>
            <button
              onClick={() => handleSort('quotedMonthlyValue')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              הצעת מחיר
              <ArrowUpDown size={14} className={sortField === 'quotedMonthlyValue' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>סטטוס</TableHead>
          <TableHead>
            <button
              onClick={() => handleSort('nextContactDate')}
              className="inline-flex items-center gap-1 hover:text-white transition-colors"
            >
              תאריך קשר
              <ArrowUpDown size={14} className={sortField === 'nextContactDate' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>פעולות</TableHead>
        </TableHeader>
        <TableBody>
          {filteredLeads.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-12 text-center text-gray-500">
                לא נמצאו לידים
              </td>
            </tr>
          ) : (
            filteredLeads.map(lead => {
              const overdue = isOverdue(lead.nextContactDate) && OPEN_STATUSES.includes(lead.status);
              const rowBg = getRowBgClass(lead);

              return (
                <tr key={lead.leadId} className={`group hover:bg-white/[0.03] transition-colors duration-150 ${rowBg}`}>
                  <TableCell className="font-semibold text-white">{lead.leadName}</TableCell>
                  <TableCell>{lead.businessName || <span className="text-gray-600">-</span>}</TableCell>
                  <TableCell>
                    {lead.phone ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} className="text-gray-300 hover:text-white transition-colors">
                          {lead.phone}
                        </a>
                        <a
                          href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone).replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSourceBadgeVariant(lead.sourceChannel)}>{lead.sourceChannel}</Badge>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-secondary">
                    {formatCurrency(lead.quotedMonthlyValue)}
                  </TableCell>
                  <TableCell>
                    <select
                      value={lead.status}
                      onChange={(e) => handleInlineStatusChange(lead, e.target.value as LeadStatus)}
                      className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-primary/50 cursor-pointer hover:border-white/20 transition-colors"
                    >
                      {Object.values(LeadStatus).map(s => (
                        <option key={s} value={s} className="bg-[#151e32] text-white">{s}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 ${overdue ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                      <Calendar size={14} className={overdue ? 'text-red-400' : 'text-gray-500'} />
                      {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
                    </span>
                  </TableCell>                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="p-1.5 text-gray-400 hover:text-white"
                        onClick={() => { setEditingLead(lead); setIsModalOpen(true); }}
                        title="ערוך"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </Button>
                      {isAdmin && lead.status !== LeadStatus.Won && lead.status !== LeadStatus.Lost && (
                        <Button
                          variant="ghost"
                          className="p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => setConvertingLead(lead)}
                          title="המר ללקוח"
                        >
                          <CheckCircle size={15} />
                        </Button>
                      )}
                      {lead.status !== LeadStatus.Won && lead.status !== LeadStatus.Lost && lead.status !== LeadStatus.Not_relevant && (
                        <Button
                          variant="ghost"
                          className="p-1.5 text-gray-500 hover:text-red-400"
                          onClick={() => updateLead({ ...lead, status: LeadStatus.Not_relevant })}
                          title="לא רלוונטי"
                        >
                          <XCircle size={15} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </tr>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );

  // --- Kanban View ---

  const KanbanView = () => {
    const kanbanLeads = filteredLeads.filter(l => KANBAN_STATUSES.includes(l.status));

    return (
      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar" style={{ minHeight: '400px' }}>
        {KANBAN_STATUSES.map(status => {
          const columnLeads = kanbanLeads.filter(l => l.status === status);
          const totalValue = columnLeads.reduce((sum, l) => sum + l.quotedMonthlyValue, 0);

          return (
            <div
              key={status}
              className="flex-shrink-0 w-72 flex flex-col bg-white/[0.02] border border-white/5 rounded-xl"
            >
              {/* Column header */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white">{status}</h3>
                  <span className="text-xs font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {columnLeads.length}
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono">{formatCurrency(totalValue)}</p>
              </div>

              {/* Column cards */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '60vh' }}>
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-xs">אין לידים</div>
                ) : (
                  columnLeads.map(lead => {
                    const overdue = isOverdue(lead.nextContactDate);

                    return (
                      <div
                        key={lead.leadId}
                        onClick={() => { setEditingLead(lead); setIsModalOpen(true); }}

                        className={`
                          p-3 rounded-lg border cursor-pointer transition-all duration-200
                          hover:border-white/20 hover:bg-white/[0.04]
                          ${overdue
                            ? 'border-red-500/20 bg-red-500/[0.04]'
                            : 'border-white/5 bg-surface/40'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-semibold text-white leading-tight">{lead.leadName}</h4>
                          {lead.phone && (
                            <a
                              href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone).replace('+', '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors flex-shrink-0 ms-2"
                              title="WhatsApp"
                            >
                              <MessageCircle size={12} />
                            </a>
                          )}
                        </div>

                        {lead.businessName && (
                          <p className="text-xs text-gray-500 mb-2">{lead.businessName}</p>
                        )}

                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono font-bold text-secondary">
                            {formatCurrency(lead.quotedMonthlyValue)}
                          </span>
                          <Badge variant={getSourceBadgeVariant(lead.sourceChannel)} className="text-[10px] px-1.5 py-0.5">
                            {lead.sourceChannel}
                          </Badge>
                        </div>

                        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
                          <Calendar size={12} />
                          {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- Main Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">ניהול לידים</h2>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-surface/50 border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-primary text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List size={16} />
              טבלה
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-primary text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={16} />
              קנבן
            </button>
          </div>
          <Button onClick={openNewLead} variant="secondary" icon={<Plus size={18} />}>ליד חדש</Button>
        </div>
      </div>

      <StatsRow />
      <FiltersBar />

      {viewMode === 'table' ? <TableView /> : <KanbanView />}
      {/* Add/Edit Lead Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="פרטי ליד">
        {editingLead && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="שם הליד" required value={editingLead.leadName} onChange={e => setEditingLead({ ...editingLead, leadName: e.target.value })} />
              <Input label="שם עסק" value={editingLead.businessName} onChange={e => setEditingLead({ ...editingLead, businessName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="טלפון" value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} />
              <Select label="מקור" value={editingLead.sourceChannel} onChange={e => setEditingLead({ ...editingLead, sourceChannel: e.target.value as SourceChannel })}>
                {Object.values(SourceChannel).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="הצעת מחיר (₪)" type="number" value={editingLead.quotedMonthlyValue} onChange={e => setEditingLead({ ...editingLead, quotedMonthlyValue: Number(e.target.value) })} />
              <Input label="תאריך קשר הבא" type="date" value={editingLead.nextContactDate ? new Date(editingLead.nextContactDate).toISOString().split('T')[0] : ''} onChange={e => setEditingLead({ ...editingLead, nextContactDate: e.target.value })} />
            </div>
            <Select label="סטטוס" value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value as LeadStatus })}>
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
                      if (checked) setEditingLead({ ...editingLead, interestedServices: [...current, service.serviceKey] });
                      else setEditingLead({ ...editingLead, interestedServices: current.filter(k => k !== service.serviceKey) });
                    }}
                  />
                ))}
              </div>
            </div>
            <Textarea label="הערות" value={editingLead.notes} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} />
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
              <Button type="submit">שמור</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Convert Modal */}
      <Modal isOpen={!!convertingLead} onClose={() => setConvertingLead(null)} title="המרת ליד ללקוח" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם להפוך את <span className="text-white font-bold">{convertingLead?.leadName}</span> ללקוח פעיל?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConvertingLead(null)}>ביטול</Button>
            <Button type="button" onClick={() => { if (convertingLead) { doConvertToClient(convertingLead); setConvertingLead(null); } }}>אשר והמר</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Leads;
