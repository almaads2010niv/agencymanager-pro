import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Lead, LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel, Archetype } from '../types';
import { formatCurrency, formatPhoneForWhatsApp } from '../utils';
import { Plus, Search, CheckCircle, XCircle, List, LayoutGrid, Phone, MessageCircle, ArrowUpDown, Calendar, User, GripVertical, Brain } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ViewMode = 'table' | 'kanban';
type SortField = 'leadName' | 'businessName' | 'phone' | 'sourceChannel' | 'quotedMonthlyValue' | 'status' | 'assignedTo' | 'nextContactDate' | null;
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

// --- Kanban Components (MUST be defined OUTSIDE the main component to avoid remounts) ---

const ARCHETYPE_COLORS: Record<Archetype, string> = {
  WINNER: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  STAR: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  DREAMER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  HEART: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  ANCHOR: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

const ARCHETYPE_LABELS: Record<Archetype, string> = {
  WINNER: 'מנצח', STAR: 'כוכב', DREAMER: 'חולם', HEART: 'לב', ANCHOR: 'עוגן',
};

// --- Sortable Lead Card (top-level) ---
const SortableLeadCard: React.FC<{
  lead: Lead;
  personalityArchetype?: Archetype;
  onNavigate: (leadId: string) => void;
  getUserName: (userId?: string) => string | null;
}> = ({ lead, personalityArchetype, onNavigate, getUserName }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.leadId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const overdue = isOverdue(lead.nextContactDate);
  const handlerName = getUserName(lead.assignedTo);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        p-4 rounded-xl border cursor-grab active:cursor-grabbing transition-all duration-200
        hover:border-white/20 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/20
        ${overdue
          ? 'border-red-500/20 bg-red-500/[0.04]'
          : 'border-white/5 bg-surface/40'
        }
        ${isDragging ? 'shadow-2xl shadow-primary/20 border-primary/30 scale-[1.02]' : ''}
      `}
    >
      {/* Drag handle + name + WhatsApp */}
      <div className="flex items-start gap-2 mb-2">
        <div className="mt-0.5 text-gray-600 hover:text-gray-400 flex-shrink-0">
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0" onClick={() => onNavigate(lead.leadId)}>
          <h4 className="text-sm font-bold text-white leading-tight truncate cursor-pointer">{lead.leadName}</h4>
        </div>
        {lead.phone && (
          <a
            href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone).replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors flex-shrink-0"
            title="WhatsApp"
          >
            <MessageCircle size={14} />
          </a>
        )}
      </div>

      {/* Business name */}
      {lead.businessName && (
        <p className="text-xs text-gray-500 mb-2 mr-6 truncate">{lead.businessName}</p>
      )}

      {/* Phone */}
      {lead.phone && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2 mr-6">
          <Phone size={11} />
          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="hover:text-white transition-colors">
            {lead.phone}
          </a>
        </div>
      )}

      {/* Value + source */}
      <div className="flex items-center justify-between mb-2 mr-6">
        <span className="text-sm font-mono font-bold text-secondary">
          {formatCurrency(lead.quotedMonthlyValue)}
        </span>
        <Badge variant={getSourceBadgeVariant(lead.sourceChannel)} className="text-[10px] px-1.5 py-0.5">
          {lead.sourceChannel}
        </Badge>
      </div>

      {/* Next contact date */}
      <div className="flex items-center justify-between mr-6">
        <div className={`flex items-center gap-1.5 text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
          <Calendar size={12} />
          {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
        </div>
        {handlerName && (
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
              <User size={10} className="text-violet-400" />
            </div>
            <span className="text-[10px] text-gray-500 truncate max-w-[70px]">{handlerName}</span>
          </div>
        )}
      </div>

      {/* Signals personality badge */}
      {personalityArchetype && (
        <div className={`mt-2 mr-6 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${ARCHETYPE_COLORS[personalityArchetype]}`}>
          <Brain size={10} />
          {ARCHETYPE_LABELS[personalityArchetype]}
        </div>
      )}
    </div>
  );
};

// --- Droppable Column (top-level) ---
const KanbanColumn: React.FC<{
  status: LeadStatus;
  leads: Lead[];
  personalityMap: Map<string, Archetype>;
  onNavigate: (leadId: string) => void;
  getUserName: (userId?: string) => string | null;
}> = ({ status, leads: columnLeads, personalityMap, onNavigate, getUserName }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const totalValue = columnLeads.reduce((sum, l) => sum + l.quotedMonthlyValue, 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-white/[0.02] border rounded-xl min-h-[400px] transition-colors duration-200
        ${isOver ? 'border-primary/40 bg-primary/[0.03]' : 'border-white/5'}
      `}
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
      <SortableContext items={columnLeads.map(l => l.leadId)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar" style={{ maxHeight: '65vh' }}>
          {columnLeads.length === 0 ? (
            <div className={`text-center py-8 text-xs rounded-lg border border-dashed transition-colors ${isOver ? 'text-primary/60 border-primary/30' : 'text-gray-600 border-transparent'}`}>
              {isOver ? 'שחרר כאן' : 'אין לידים'}
            </div>
          ) : (
            columnLeads.map(lead => (
              <SortableLeadCard
                key={lead.leadId}
                lead={lead}
                personalityArchetype={personalityMap.get(lead.leadId)}
                onNavigate={onNavigate}
                getUserName={getUserName}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// --- Ghost Card for DragOverlay (top-level) ---
const LeadGhostCard: React.FC<{ lead: Lead }> = ({ lead }) => (
  <div className="p-4 rounded-xl border border-primary/30 bg-surface shadow-2xl shadow-primary/20 w-72 opacity-90">
    <div className="flex items-start gap-2 mb-2">
      <GripVertical size={16} className="text-primary mt-0.5" />
      <h4 className="text-sm font-bold text-white leading-tight truncate flex-1">{lead.leadName}</h4>
    </div>
    {lead.businessName && (
      <p className="text-xs text-gray-500 mb-2 mr-6">{lead.businessName}</p>
    )}
    <div className="flex items-center justify-between mr-6">
      <span className="text-sm font-mono font-bold text-secondary">
        {formatCurrency(lead.quotedMonthlyValue)}
      </span>
      <Badge variant={getSourceBadgeVariant(lead.sourceChannel)} className="text-[10px] px-1.5 py-0.5">
        {lead.sourceChannel}
      </Badge>
    </div>
  </div>
);

const Leads: React.FC = () => {
  const { leads, services, addLead, updateLead, deleteLead, convertLeadToClient, signalsPersonalities } = useData();
  const { isAdmin, isViewer, user, allUsers } = useAuth();
  const navigate = useNavigate();

  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const u = allUsers.find(u => u.user_id === userId);
    return u?.display_name || null;
  };

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Partial<Lead> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('open');
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
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'open' && OPEN_STATUSES.includes(l.status)) ||
        l.status === filterStatus;
      const matchesSource = filterSource === 'all' || l.sourceChannel === filterSource;
      return matchesSearch && matchesStatus && matchesSource;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'leadName':
            cmp = (a.leadName || '').localeCompare(b.leadName || '', 'he');
            break;
          case 'businessName':
            cmp = (a.businessName || '').localeCompare(b.businessName || '', 'he');
            break;
          case 'phone':
            cmp = (a.phone || '').localeCompare(b.phone || '');
            break;
          case 'sourceChannel':
            cmp = (a.sourceChannel || '').localeCompare(b.sourceChannel || '', 'he');
            break;
          case 'quotedMonthlyValue':
            cmp = a.quotedMonthlyValue - b.quotedMonthlyValue;
            break;
          case 'status':
            cmp = (a.status || '').localeCompare(b.status || '', 'he');
            break;
          case 'assignedTo': {
            const nameA = getUserName(a.assignedTo) || 'תתתת';
            const nameB = getUserName(b.assignedTo) || 'תתתת';
            cmp = nameA.localeCompare(nameB, 'he');
            break;
          }
          case 'nextContactDate':
            cmp = new Date(a.nextContactDate).getTime() - new Date(b.nextContactDate).getTime();
            break;
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
      assignedTo: undefined,
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
          <option value="open">לידים פתוחים</option>
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
          <TableHead>
            <button onClick={() => handleSort('leadName')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              שם
              <ArrowUpDown size={14} className={sortField === 'leadName' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('businessName')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              עסק
              <ArrowUpDown size={14} className={sortField === 'businessName' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('phone')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              טלפון
              <ArrowUpDown size={14} className={sortField === 'phone' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('sourceChannel')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              מקור
              <ArrowUpDown size={14} className={sortField === 'sourceChannel' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('quotedMonthlyValue')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              הצעת מחיר
              <ArrowUpDown size={14} className={sortField === 'quotedMonthlyValue' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              סטטוס
              <ArrowUpDown size={14} className={sortField === 'status' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('assignedTo')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              מטפל
              <ArrowUpDown size={14} className={sortField === 'assignedTo' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>
            <button onClick={() => handleSort('nextContactDate')} className="inline-flex items-center gap-1 hover:text-white transition-colors">
              תאריך קשר
              <ArrowUpDown size={14} className={sortField === 'nextContactDate' ? 'text-primary' : 'text-gray-600'} />
            </button>
          </TableHead>
          <TableHead>פעולות</TableHead>
        </TableHeader>
        <TableBody>
          {filteredLeads.length === 0 ? (
            <tr>
              <td colSpan={9} className="p-12 text-center text-gray-500">
                לא נמצאו לידים
              </td>
            </tr>
          ) : (
            filteredLeads.map(lead => {
              const overdue = isOverdue(lead.nextContactDate) && OPEN_STATUSES.includes(lead.status);
              const rowBg = getRowBgClass(lead);
              const handlerName = getUserName(lead.assignedTo);

              return (
                <TableRow
                  key={lead.leadId}
                  className={`cursor-pointer ${rowBg}`}
                  onClick={() => navigate(`/leads/${lead.leadId}`)}
                >
                  <TableCell className="font-semibold text-white">{lead.leadName}</TableCell>
                  <TableCell>{lead.businessName || <span className="text-gray-600">-</span>}</TableCell>
                  <TableCell>
                    {lead.phone ? (
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-gray-300 hover:text-white transition-colors">
                          {lead.phone}
                        </a>
                        <a
                          href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone).replace('+', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
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
                      onClick={e => e.stopPropagation()}
                      onChange={(e) => handleInlineStatusChange(lead, e.target.value as LeadStatus)}
                      className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-primary/50 cursor-pointer hover:border-white/20 transition-colors"
                    >
                      {Object.values(LeadStatus).map(s => (
                        <option key={s} value={s} className="bg-[#151e32] text-white">{s}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {handlerName ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <User size={12} className="text-violet-400" />
                        </div>
                        <span className="text-xs text-gray-300 truncate max-w-[80px]">{handlerName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">לא משויך</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 ${overdue ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                      <Calendar size={14} className={overdue ? 'text-red-400' : 'text-gray-500'} />
                      {new Date(lead.nextContactDate).toLocaleDateString('he-IL')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );

  // --- Kanban State & Handlers ---
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const kanbanSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const kanbanLeads = useMemo(() =>
    filteredLeads.filter(l => KANBAN_STATUSES.includes(l.status)),
    [filteredLeads]
  );

  const personalityMap = useMemo(() => {
    const map = new Map<string, Archetype>();
    signalsPersonalities.forEach(p => {
      if (p.leadId) map.set(p.leadId, p.primaryArchetype);
    });
    return map;
  }, [signalsPersonalities]);

  const activeLead = activeDragId ? kanbanLeads.find(l => l.leadId === activeDragId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const lead = kanbanLeads.find(l => l.leadId === leadId);
    if (!lead) return;

    // Determine target status — "over" could be a column (status) or another card
    let targetStatus: LeadStatus | undefined;
    if (KANBAN_STATUSES.includes(over.id as LeadStatus)) {
      targetStatus = over.id as LeadStatus;
    } else {
      // Dropped on another card — find that card's status
      const targetLead = kanbanLeads.find(l => l.leadId === over.id);
      if (targetLead) targetStatus = targetLead.status;
    }

    if (targetStatus && targetStatus !== lead.status) {
      updateLead({ ...lead, status: targetStatus });
    }
  }, [kanbanLeads, updateLead]);

  const handleNavigateToLead = useCallback((leadId: string) => {
    navigate(`/leads/${leadId}`);
  }, [navigate]);

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

      {viewMode === 'table' ? <TableView /> : (
        <DndContext
          sensors={kanbanSensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4" style={{ minHeight: '400px' }}>
            {KANBAN_STATUSES.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                leads={kanbanLeads.filter(l => l.status === status)}
                personalityMap={personalityMap}
                onNavigate={handleNavigateToLead}
                getUserName={getUserName}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead ? <LeadGhostCard lead={activeLead} /> : null}
          </DragOverlay>
        </DndContext>
      )}
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
            <div className="grid grid-cols-2 gap-4">
              <Select label="סטטוס" value={editingLead.status} onChange={e => setEditingLead({ ...editingLead, status: e.target.value as LeadStatus })}>
                {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select
                label="מטפל אחראי"
                value={editingLead.assignedTo || ''}
                onChange={e => setEditingLead({ ...editingLead, assignedTo: e.target.value || undefined })}
              >
                <option value="">לא משויך</option>
                {allUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.display_name}</option>
                ))}
              </Select>
            </div>
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
