import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Idea, IdeaStatus, IdeaPriority } from '../types';
import { Plus, Search, Lightbulb, Sparkles, Trash2, Edit3, GripVertical, Calendar as CalendarIcon, User, Tag } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { supabase } from '../lib/supabaseClient';
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

const IDEA_STATUSES: { key: IdeaStatus; label: string; color: string }[] = [
  { key: 'draft', label: 'טיוטה', color: 'bg-gray-500/20 text-gray-300' },
  { key: 'active', label: 'פעיל', color: 'bg-blue-500/20 text-blue-300' },
  { key: 'in_progress', label: 'בתהליך', color: 'bg-yellow-500/20 text-yellow-300' },
  { key: 'done', label: 'בוצע', color: 'bg-green-500/20 text-green-300' },
  { key: 'archived', label: 'ארכיון', color: 'bg-purple-500/20 text-purple-300' },
];

const PRIORITY_LABELS: Record<IdeaPriority, { label: string; color: string }> = {
  low: { label: 'נמוך', color: 'bg-gray-500/20 text-gray-400' },
  medium: { label: 'בינוני', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'גבוה', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'דחוף', color: 'bg-red-500/20 text-red-400' },
};

const CATEGORIES = ['content', 'social', 'advertising', 'email', 'seo', 'branding', 'automation', 'events', 'general'];

// --- Droppable Column ---
const DroppableColumn: React.FC<{ status: IdeaStatus; label: string; color: string; children: React.ReactNode; count: number }> = ({ status, label, color, children, count }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex flex-col rounded-xl border transition-colors ${isOver ? 'border-primary/50 bg-primary/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
          <span className="text-xs text-gray-500">({count})</span>
        </div>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-260px)]">
        {children}
      </div>
    </div>
  );
};

// --- Sortable Idea Card ---
const SortableIdeaCard: React.FC<{ idea: Idea; clientName?: string; onClick: () => void }> = ({ idea, clientName, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="bg-[#0B1121] border border-white/10 rounded-lg p-3 cursor-pointer hover:border-white/20 transition-colors group">
      <div className="flex items-start gap-2">
        <div {...listeners} className="mt-1 opacity-0 group-hover:opacity-50 cursor-grab"><GripVertical size={14} /></div>
        <div className="flex-1 min-w-0" onClick={onClick}>
          <div className="font-medium text-sm text-white truncate">{idea.title}</div>
          {clientName && <div className="text-xs text-gray-500 mt-0.5">{clientName}</div>}
          {idea.description && <div className="text-xs text-gray-400 mt-1 line-clamp-2">{idea.description}</div>}
          <div className="flex flex-wrap gap-1 mt-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_LABELS[idea.priority].color}`}>
              {PRIORITY_LABELS[idea.priority].label}
            </span>
            {idea.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">{idea.category}</span>
            )}
            {idea.dueDate && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 flex items-center gap-0.5">
                <CalendarIcon size={8} />{new Date(idea.dueDate).toLocaleDateString('he-IL')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Ghost Card for DragOverlay ---
const GhostCard: React.FC<{ idea: Idea }> = ({ idea }) => (
  <div className="bg-[#0B1121] border-2 border-primary/50 rounded-lg p-3 shadow-xl shadow-primary/10 w-64">
    <div className="font-medium text-sm text-white">{idea.title}</div>
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIORITY_LABELS[idea.priority].color}`}>
      {PRIORITY_LABELS[idea.priority].label}
    </span>
  </div>
);

const Ideas: React.FC = () => {
  const { ideas, clients, leads, addIdea, updateIdea, deleteIdea } = useData();
  const { user, displayName, isAdmin } = useAuth();

  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateClientId, setGenerateClientId] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<IdeaStatus>('draft');
  const [formPriority, setFormPriority] = useState<IdeaPriority>('medium');
  const [formClientId, setFormClientId] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const clientMap = useMemo(() => new Map(clients.map(c => [c.clientId, c.clientName])), [clients]);

  const filteredIdeas = useMemo(() => {
    let result = ideas;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(s) || i.description.toLowerCase().includes(s));
    }
    if (clientFilter) {
      result = result.filter(i => i.clientId === clientFilter);
    }
    return result;
  }, [ideas, search, clientFilter]);

  const openForm = (idea?: Idea) => {
    if (idea) {
      setEditingIdea(idea);
      setFormTitle(idea.title);
      setFormDescription(idea.description);
      setFormStatus(idea.status);
      setFormPriority(idea.priority);
      setFormClientId(idea.clientId || '');
      setFormCategory(idea.category);
      setFormDueDate(idea.dueDate ? idea.dueDate.split('T')[0] : '');
    } else {
      setEditingIdea(null);
      setFormTitle('');
      setFormDescription('');
      setFormStatus('draft');
      setFormPriority('medium');
      setFormClientId(clientFilter || '');
      setFormCategory('');
      setFormDueDate('');
    }
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !user) return;
    const ideaData = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      status: formStatus,
      priority: formPriority,
      clientId: formClientId || undefined,
      category: formCategory,
      tags: [] as string[],
      createdBy: user.id,
      createdByName: displayName,
      sortOrder: editingIdea?.sortOrder ?? ideas.length,
      dueDate: formDueDate ? new Date(formDueDate).toISOString() : undefined,
    };

    if (editingIdea) {
      await updateIdea({ ...editingIdea, ...ideaData, updatedAt: new Date().toISOString() });
    } else {
      await addIdea(ideaData);
    }
    setIsFormOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteIdea(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(String(event.active.id));
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const idea = ideas.find(i => i.id === active.id);
    if (!idea) return;
    const newStatus = String(over.id) as IdeaStatus;
    if (IDEA_STATUSES.some(s => s.key === newStatus) && idea.status !== newStatus) {
      await updateIdea({ ...idea, status: newStatus });
    }
  };

  // AI Idea Generation
  const handleGenerateIdeas = async () => {
    if (!generateClientId || !user) return;
    setIsGenerating(true);
    try {
      const client = clients.find(c => c.clientId === generateClientId);
      if (!client) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-idea`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: client.clientName,
          businessName: client.businessName,
          industry: client.industry,
          services: client.services,
          notes: client.notes,
        }),
      });
      const result = await res.json();
      if (result.success && Array.isArray(result.ideas)) {
        for (const ai of result.ideas) {
          await addIdea({
            title: ai.title,
            description: ai.description,
            status: 'draft' as IdeaStatus,
            priority: 'medium' as IdeaPriority,
            clientId: generateClientId,
            category: ai.category || '',
            tags: [],
            createdBy: user.id,
            createdByName: displayName,
            sortOrder: ideas.length,
          });
        }
      }
      setShowGenerateModal(false);
    } catch { /* silent */ }
    finally { setIsGenerating(false); }
  };

  const draggedIdea = activeDragId ? ideas.find(i => i.id === activeDragId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Lightbulb className="text-yellow-400" size={28} />
          רעיונות
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => setShowGenerateModal(true)}>
            AI יצירת רעיונות
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => openForm()}>רעיון חדש</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
          <input
            type="text"
            placeholder="חיפוש רעיונות..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary/50 focus:outline-none"
        >
          <option value="">כל הלקוחות</option>
          {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.clientName}</option>)}
        </select>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-5 gap-4">
          {IDEA_STATUSES.map(({ key, label, color }) => {
            const columnIdeas = filteredIdeas.filter(i => i.status === key);
            return (
              <DroppableColumn key={key} status={key} label={label} color={color} count={columnIdeas.length}>
                <SortableContext items={columnIdeas.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {columnIdeas.map(idea => (
                    <SortableIdeaCard
                      key={idea.id}
                      idea={idea}
                      clientName={idea.clientId ? clientMap.get(idea.clientId) : undefined}
                      onClick={() => openForm(idea)}
                    />
                  ))}
                </SortableContext>
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>{draggedIdea ? <GhostCard idea={draggedIdea} /> : null}</DragOverlay>
      </DndContext>

      {/* Add/Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingIdea ? 'עריכת רעיון' : 'רעיון חדש'}>
        <div className="space-y-4">
          <Input label="כותרת" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="כותרת הרעיון" />
          <Textarea label="תיאור" value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="תיאור מפורט..." />
          <div className="grid grid-cols-2 gap-4">
            <Select label="סטטוס" value={formStatus} onChange={e => setFormStatus(e.target.value as IdeaStatus)}>
              {IDEA_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
            <Select label="עדיפות" value={formPriority} onChange={e => setFormPriority(e.target.value as IdeaPriority)}>
              <option value="low">נמוך</option>
              <option value="medium">בינוני</option>
              <option value="high">גבוה</option>
              <option value="urgent">דחוף</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="לקוח" value={formClientId} onChange={e => setFormClientId(e.target.value)}>
              <option value="">ללא לקוח</option>
              {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.clientName}</option>)}
            </Select>
            <Select label="קטגוריה" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
              <option value="">ללא</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <Input label="תאריך יעד" type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
          <div className="flex gap-3 justify-end pt-2">
            {editingIdea && isAdmin && (
              <Button variant="ghost" className="text-red-400 me-auto" icon={<Trash2 size={14} />}
                onClick={() => { setIsFormOpen(false); setConfirmDeleteId(editingIdea.id); }}>
                מחק
              </Button>
            )}
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>ביטול</Button>
            <Button onClick={handleSave}>{editingIdea ? 'עדכן' : 'צור רעיון'}</Button>
          </div>
        </div>
      </Modal>

      {/* AI Generate Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="יצירת רעיונות AI">
        <div className="space-y-4">
          <p className="text-sm text-gray-400">בחר לקוח ו-AI ייצור 5 רעיונות שיווקיים מותאמים אישית.</p>
          <Select label="לקוח" value={generateClientId} onChange={e => setGenerateClientId(e.target.value)}>
            <option value="">בחר לקוח</option>
            {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.clientName} — {c.businessName}</option>)}
          </Select>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>ביטול</Button>
            <Button onClick={handleGenerateIdeas} disabled={!generateClientId || isGenerating} icon={<Sparkles size={16} />}>
              {isGenerating ? 'מייצר...' : 'צור רעיונות'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="מחיקת רעיון">
        <p className="text-sm text-gray-300 mb-4">האם למחוק את הרעיון? פעולה זו לא ניתנת לביטול.</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>ביטול</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>מחק</Button>
        </div>
      </Modal>
    </div>
  );
};

export default Ideas;
