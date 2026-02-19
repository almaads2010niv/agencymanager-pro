import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { OneTimeDeal, DealStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Plus, Edit2, LayoutGrid, List, Trash2, GripVertical, TrendingUp, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
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

// ── Status Config ────────────────────────────────────────────
const DEAL_STATUSES: { key: DealStatus; label: string; color: string; badgeVariant: 'warning' | 'info' | 'success' | 'danger' }[] = [
  { key: DealStatus.In_progress, label: 'בתהליך', color: 'bg-amber-500/20 text-amber-300', badgeVariant: 'warning' },
  { key: DealStatus.Completed, label: 'הושלם', color: 'bg-blue-500/20 text-blue-300', badgeVariant: 'info' },
  { key: DealStatus.Paid, label: 'שולם', color: 'bg-emerald-500/20 text-emerald-300', badgeVariant: 'success' },
  { key: DealStatus.Unpaid, label: 'לא שולם', color: 'bg-red-500/20 text-red-300', badgeVariant: 'danger' },
];

const STATUS_LABEL_MAP: Record<string, string> = Object.fromEntries(DEAL_STATUSES.map(s => [s.key, s.label]));

const getStatusBadgeVariant = (status: DealStatus) => {
  return DEAL_STATUSES.find(s => s.key === status)?.badgeVariant ?? 'neutral';
};

// ── Droppable Column ─────────────────────────────────────────
const DroppableColumn: React.FC<{
  status: DealStatus;
  label: string;
  color: string;
  children: React.ReactNode;
  count: number;
  totalAmount: number;
}> = ({ status, label, color, children, count, totalAmount }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border transition-colors min-w-[250px] ${
        isOver ? 'border-primary/50 bg-primary/5' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>{label}</span>
          <span className="text-xs text-gray-500">({count})</span>
        </div>
        <span className="text-xs font-mono text-gray-500">{formatCurrency(totalAmount)}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-340px)] custom-scrollbar">
        {children}
      </div>
    </div>
  );
};

// ── Sortable Deal Card ───────────────────────────────────────
const SortableDealCard: React.FC<{
  deal: OneTimeDeal;
  clientName: string;
  onClick: () => void;
}> = ({ deal, clientName, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.dealId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const profit = deal.dealAmount - deal.supplierCost;
  const margin = deal.dealAmount > 0 ? Math.round((profit / deal.dealAmount) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-[#0B1121] border border-white/10 rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <div {...listeners} className="mt-1 opacity-0 group-hover:opacity-50 cursor-grab">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="font-medium text-sm text-white truncate">{deal.dealName}</div>
          <div className="text-xs text-gray-500 mt-0.5">{clientName}</div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-mono font-bold text-white">{formatCurrency(deal.dealAmount)}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              profit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {margin}% רווח
            </span>
          </div>

          {deal.supplierCost > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-gray-500">עלות ספק: {formatCurrency(deal.supplierCost)}</span>
              <span className="text-[10px] font-mono text-emerald-400">{formatCurrency(profit)}</span>
            </div>
          )}

          <div className="text-[10px] text-gray-600 mt-1.5">{formatDate(deal.dealDate)}</div>
        </div>
      </div>
    </div>
  );
};

// ── Ghost Card for DragOverlay ───────────────────────────────
const GhostCard: React.FC<{ deal: OneTimeDeal }> = ({ deal }) => (
  <div className="bg-[#0B1121] border-2 border-primary/50 rounded-lg p-3 shadow-xl shadow-primary/10 w-64">
    <div className="font-medium text-sm text-white">{deal.dealName}</div>
    <span className="text-xs font-mono text-white">{formatCurrency(deal.dealAmount)}</span>
  </div>
);

// ── Main Component ───────────────────────────────────────────
const Deals: React.FC = () => {
  const { oneTimeDeals, clients, addDeal, updateDeal, deleteDeal } = useData();
  const { isAdmin } = useAuth();

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Partial<OneTimeDeal> | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const clientMap = useMemo(
    () => new Map(clients.map(c => [c.clientId, c.businessName])),
    [clients]
  );

  const getClientName = (id: string) => clientMap.get(id) || 'לא ידוע';

  // ── KPI calculations ────────────────────────────────────
  const kpis = useMemo(() => {
    const totalRevenue = oneTimeDeals.reduce((sum, d) => sum + d.dealAmount, 0);
    const totalCost = oneTimeDeals.reduce((sum, d) => sum + d.supplierCost, 0);
    const totalProfit = totalRevenue - totalCost;
    const inProgress = oneTimeDeals.filter(d => d.dealStatus === DealStatus.In_progress).length;
    const paid = oneTimeDeals.filter(d => d.dealStatus === DealStatus.Paid);
    const paidRevenue = paid.reduce((sum, d) => sum + d.dealAmount, 0);
    const unpaid = oneTimeDeals.filter(d => d.dealStatus === DealStatus.Unpaid || d.dealStatus === DealStatus.Completed);
    const unpaidRevenue = unpaid.reduce((sum, d) => sum + d.dealAmount, 0);
    return { totalRevenue, totalProfit, inProgress, paidRevenue, unpaidRevenue, count: oneTimeDeals.length };
  }, [oneTimeDeals]);

  // ── Modal handlers ──────────────────────────────────────
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

  const openEditDeal = (deal: OneTimeDeal) => {
    setEditingDeal(deal);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    const formData = editingDeal as OneTimeDeal;
    if (formData.dealId) updateDeal(formData);
    else addDeal(formData);
    setIsModalOpen(false);
    setEditingDeal(null);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteDeal(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  // ── DnD handlers ────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const deal = oneTimeDeals.find(d => d.dealId === active.id);
    if (!deal) return;
    const newStatus = String(over.id) as DealStatus;
    if (DEAL_STATUSES.some(s => s.key === newStatus) && deal.dealStatus !== newStatus) {
      await updateDeal({ ...deal, dealStatus: newStatus });
    }
  };

  const draggedDeal = activeDragId ? oneTimeDeals.find(d => d.dealId === activeDragId) : null;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">פרויקטים חד פעמיים</h2>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'
              }`}
            >
              <List size={14} /> טבלה
            </button>
          </div>
          <Button onClick={openNewDeal} icon={<Plus size={18} />}>פרויקט חדש</Button>
        </div>
      </div>

      {/* ── KPI Bar ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface/80 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <DollarSign size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">סה"כ הכנסות</div>
            <div className="text-lg font-bold font-mono text-white">{formatCurrency(kpis.totalRevenue)}</div>
          </div>
        </div>
        <div className="bg-surface/80 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp size={20} className="text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">סה"כ רווח</div>
            <div className="text-lg font-bold font-mono text-emerald-400">{formatCurrency(kpis.totalProfit)}</div>
          </div>
        </div>
        <div className="bg-surface/80 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Clock size={20} className="text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">בתהליך</div>
            <div className="text-lg font-bold text-white">{kpis.inProgress} <span className="text-xs text-gray-500 font-normal">פרויקטים</span></div>
          </div>
        </div>
        <div className="bg-surface/80 backdrop-blur-md border border-white/5 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">שולם / ממתין</div>
            <div className="text-sm font-bold font-mono text-white">
              <span className="text-emerald-400">{formatCurrency(kpis.paidRevenue)}</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-400">{formatCurrency(kpis.unpaidRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Kanban View ─────────────────────────────────── */}
      {viewMode === 'kanban' && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4">
            {DEAL_STATUSES.map(({ key, label, color }) => {
              const columnDeals = oneTimeDeals.filter(d => d.dealStatus === key);
              const columnTotal = columnDeals.reduce((sum, d) => sum + d.dealAmount, 0);
              return (
                <DroppableColumn key={key} status={key} label={label} color={color} count={columnDeals.length} totalAmount={columnTotal}>
                  <SortableContext items={columnDeals.map(d => d.dealId)} strategy={verticalListSortingStrategy}>
                    {columnDeals.map(deal => (
                      <SortableDealCard
                        key={deal.dealId}
                        deal={deal}
                        clientName={getClientName(deal.clientId)}
                        onClick={() => openEditDeal(deal)}
                      />
                    ))}
                    {columnDeals.length === 0 && (
                      <div className="text-center text-gray-600 text-xs py-8 italic">גרור פרויקטים לכאן</div>
                    )}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
          </div>
          <DragOverlay>{draggedDeal ? <GhostCard deal={draggedDeal} /> : null}</DragOverlay>
        </DndContext>
      )}

      {/* ── Table View ──────────────────────────────────── */}
      {viewMode === 'table' && (
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
                    <Badge variant={getStatusBadgeVariant(deal.dealStatus)}>
                      {STATUS_LABEL_MAP[deal.dealStatus] || deal.dealStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => openEditDeal(deal)}
                        icon={<Edit2 size={16} />}
                        className="p-1 text-primary"
                      />
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(deal.dealId)}
                          icon={<Trash2 size={16} />}
                          className="p-1 text-red-400"
                        />
                      )}
                    </div>
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
      )}

      {/* ── Add/Edit Modal ──────────────────────────────── */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingDeal(null); }} title={editingDeal?.dealId ? 'עריכת פרויקט' : 'פרויקט חדש'} size="md">
        {editingDeal && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input label="שם הפרויקט" required value={editingDeal.dealName} onChange={e => setEditingDeal({ ...editingDeal, dealName: e.target.value })} />
            <Select label="לקוח" value={editingDeal.clientId} onChange={e => setEditingDeal({ ...editingDeal, clientId: e.target.value })}>
              {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.businessName}</option>)}
            </Select>
            <Input label="סוג פרויקט" value={editingDeal.dealType || ''} onChange={e => setEditingDeal({ ...editingDeal, dealType: e.target.value })} placeholder="בניית אתר, קמפיין חד פעמי..." />
            <div className="grid grid-cols-2 gap-4">
              <Input label="סכום עסקה (₪)" type="number" value={editingDeal.dealAmount} onChange={e => setEditingDeal({ ...editingDeal, dealAmount: Number(e.target.value) })} />
              <Input label="עלות ספק (₪)" type="number" value={editingDeal.supplierCost} onChange={e => setEditingDeal({ ...editingDeal, supplierCost: Number(e.target.value) })} />
            </div>
            {/* Profit preview */}
            {(editingDeal.dealAmount || 0) > 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">רווח צפוי</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  {formatCurrency((editingDeal.dealAmount || 0) - (editingDeal.supplierCost || 0))}
                  <span className="text-gray-500 ms-2 text-[10px]">
                    ({Math.round((((editingDeal.dealAmount || 0) - (editingDeal.supplierCost || 0)) / (editingDeal.dealAmount || 1)) * 100)}%)
                  </span>
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="תאריך" type="date" value={editingDeal.dealDate ? new Date(editingDeal.dealDate).toISOString().split('T')[0] : ''} onChange={e => setEditingDeal({ ...editingDeal, dealDate: e.target.value })} />
              <Select label="סטטוס" value={editingDeal.dealStatus} onChange={e => setEditingDeal({ ...editingDeal, dealStatus: e.target.value as DealStatus })}>
                {DEAL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
            <Textarea label="הערות" value={editingDeal.notes || ''} onChange={e => setEditingDeal({ ...editingDeal, notes: e.target.value })} placeholder="הערות נוספות..." />
            <div className="flex justify-between items-center pt-4 border-t border-white/10">
              <div>
                {editingDeal.dealId && isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-400"
                    icon={<Trash2 size={14} />}
                    onClick={() => { setIsModalOpen(false); setConfirmDeleteId(editingDeal.dealId!); }}
                  >
                    מחק
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => { setIsModalOpen(false); setEditingDeal(null); }}>ביטול</Button>
                <Button type="submit">שמור</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Confirm Delete Modal ────────────────────────── */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="מחיקת פרויקט">
        <p className="text-sm text-gray-300 mb-4">האם למחוק את הפרויקט? פעולה זו לא ניתנת לביטול.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>ביטול</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>מחק</Button>
        </div>
      </Modal>
    </div>
  );
};

export default Deals;
