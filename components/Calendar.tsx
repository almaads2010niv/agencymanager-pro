import React, { useState, useMemo, useCallback } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns';
import { he } from 'date-fns/locale';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { CalendarEvent, CalendarEventType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
import { Modal } from './ui/Modal';
import {
  Plus, Phone, Users, Video, CheckSquare, Bell, X, Trash2, Edit3,
} from 'lucide-react';

// --- date-fns localizer for Hebrew ---
const locales = { 'he': he };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// --- Event type config ---
const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; color: string; icon: React.FC<{ size?: number }> }> = {
  call: { label: 'שיחה', color: '#06b6d4', icon: Phone },
  meeting: { label: 'פגישה', color: '#8b5cf6', icon: Users },
  zoom: { label: 'זום', color: '#3b82f6', icon: Video },
  task: { label: 'משימה', color: '#10b981', icon: CheckSquare },
  reminder: { label: 'תזכורת', color: '#f59e0b', icon: Bell },
};

// Hebrew messages for react-big-calendar
const heMessages = {
  allDay: 'כל היום',
  previous: 'הקודם',
  next: 'הבא',
  today: 'היום',
  month: 'חודש',
  week: 'שבוע',
  day: 'יום',
  agenda: 'רשימה',
  date: 'תאריך',
  time: 'שעה',
  event: 'אירוע',
  noEventsInRange: 'אין אירועים בטווח זה',
  showMore: (count: number) => `+${count} נוספים`,
};

// --- BigCalendar event shape ---
interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  resource: {
    eventType: CalendarEventType;
    isVirtual?: boolean;
    original?: CalendarEvent;
    leadId?: string;
    clientId?: string;
    description?: string;
  };
}

const CalendarPage: React.FC = () => {
  const { calendarEvents, leads, clients, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useData();
  const { user, displayName } = useAuth();

  const [currentView, setCurrentView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null);

  // Build events for BigCalendar
  const events = useMemo<CalEvent[]>(() => {
    // Real calendar events
    const real: CalEvent[] = calendarEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: new Date(e.startTime),
      end: e.endTime ? new Date(e.endTime) : addHours(new Date(e.startTime), 1),
      allDay: e.allDay,
      resource: {
        eventType: e.eventType,
        original: e,
        leadId: e.leadId,
        clientId: e.clientId,
        description: e.description,
      },
    }));

    // Virtual events from leads nextContactDate
    const virtual: CalEvent[] = leads
      .filter(l => l.nextContactDate && !['נסגר בהצלחה', 'אבוד', 'לא רלוונטי'].includes(l.status))
      .map(l => {
        const date = new Date(l.nextContactDate);
        date.setHours(9, 0, 0, 0);
        return {
          id: `lead-${l.leadId}`,
          title: `📞 ${l.leadName}`,
          start: date,
          end: addHours(date, 0.5),
          allDay: false,
          resource: {
            eventType: 'call' as CalendarEventType,
            isVirtual: true,
            leadId: l.leadId,
            description: l.businessName ? `${l.businessName} — מעקב ליד` : 'מעקב ליד',
          },
        };
      });

    return [...real, ...virtual];
  }, [calendarEvents, leads]);

  // Event styling
  const eventStyleGetter = useCallback((event: CalEvent) => {
    const config = EVENT_TYPE_CONFIG[event.resource.eventType] || EVENT_TYPE_CONFIG.task;
    const isVirtual = event.resource.isVirtual;

    return {
      style: {
        backgroundColor: isVirtual ? 'transparent' : config.color,
        color: isVirtual ? config.color : '#fff',
        border: isVirtual ? `1px dashed ${config.color}` : 'none',
        opacity: isVirtual ? 0.7 : 1,
        fontSize: '11px',
        fontWeight: 500,
      },
    };
  }, []);

  // Click on existing event → show detail
  const handleSelectEvent = useCallback((event: CalEvent) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  }, []);

  // Click on empty slot → create new event
  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setEditingEvent({
      title: '',
      eventType: 'task',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      allDay: false,
      description: '',
      clientId: undefined,
      leadId: undefined,
      createdBy: user?.id || '',
      createdByName: displayName || '',
    });
    setIsFormOpen(true);
  }, [user, displayName]);

  // Open edit form from detail view
  const handleEdit = () => {
    if (!selectedEvent?.resource.original) return;
    setEditingEvent(selectedEvent.resource.original);
    setIsDetailOpen(false);
    setIsFormOpen(true);
  };

  // Delete event
  const handleDelete = async () => {
    if (!selectedEvent?.resource.original) return;
    await deleteCalendarEvent(selectedEvent.resource.original.id);
    setIsDetailOpen(false);
    setSelectedEvent(null);
  };

  // Save (add or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent?.title || !editingEvent.startTime) return;

    if (editingEvent.id) {
      // Update
      await updateCalendarEvent(editingEvent as CalendarEvent);
    } else {
      // Add
      await addCalendarEvent({
        title: editingEvent.title,
        eventType: (editingEvent.eventType || 'task') as CalendarEventType,
        startTime: editingEvent.startTime,
        endTime: editingEvent.endTime,
        allDay: editingEvent.allDay || false,
        description: editingEvent.description || '',
        clientId: editingEvent.clientId || undefined,
        leadId: editingEvent.leadId || undefined,
        createdBy: user?.id || '',
        createdByName: displayName || '',
      });
    }
    setIsFormOpen(false);
    setEditingEvent(null);
  };

  const openNewEvent = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    setEditingEvent({
      title: '',
      eventType: 'task',
      startTime: now.toISOString(),
      endTime: addHours(now, 1).toISOString(),
      allDay: false,
      description: '',
      createdBy: user?.id || '',
      createdByName: displayName || '',
    });
    setIsFormOpen(true);
  };

  // Format datetime-local input value
  const toDateTimeLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight">לוח שנה</h2>
        <div className="flex items-center gap-3">
          {/* Event type legend */}
          <div className="hidden lg:flex items-center gap-3">
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                <span className="text-xs text-gray-400">{cfg.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border border-dashed border-cyan-500" />
              <span className="text-xs text-gray-500">מעקב ליד</span>
            </div>
          </div>
          <Button onClick={openNewEvent} variant="secondary" icon={<Plus size={18} />}>אירוע חדש</Button>
        </div>
      </div>

      {/* Calendar */}
      <Card className="p-4" noPadding={false}>
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          allDayAccessor="allDay"
          style={{ minHeight: '70vh' }}
          view={currentView}
          onView={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
          views={['month', 'week', 'day']}
          messages={heMessages}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          popup
          rtl
        />
      </Card>

      {/* Event Form Modal (Create / Edit) */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingEvent?.id ? 'עריכת אירוע' : 'אירוע חדש'} size="md">
        {editingEvent && (
          <form onSubmit={handleSave} className="space-y-5">
            <Input
              label="כותרת"
              required
              value={editingEvent.title || ''}
              onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="סוג"
                value={editingEvent.eventType || 'task'}
                onChange={e => setEditingEvent({ ...editingEvent, eventType: e.target.value as CalendarEventType })}
              >
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </Select>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEvent.allDay || false}
                    onChange={e => setEditingEvent({ ...editingEvent, allDay: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                  />
                  כל היום
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="התחלה"
                type="datetime-local"
                required
                value={toDateTimeLocal(editingEvent.startTime)}
                onChange={e => setEditingEvent({ ...editingEvent, startTime: new Date(e.target.value).toISOString() })}
              />
              <Input
                label="סיום"
                type="datetime-local"
                value={toDateTimeLocal(editingEvent.endTime)}
                onChange={e => setEditingEvent({ ...editingEvent, endTime: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="לקוח משויך"
                value={editingEvent.clientId || ''}
                onChange={e => setEditingEvent({ ...editingEvent, clientId: e.target.value || undefined })}
              >
                <option value="">ללא</option>
                {clients.map(c => <option key={c.clientId} value={c.clientId}>{c.businessName}</option>)}
              </Select>
              <Select
                label="ליד משויך"
                value={editingEvent.leadId || ''}
                onChange={e => setEditingEvent({ ...editingEvent, leadId: e.target.value || undefined })}
              >
                <option value="">ללא</option>
                {leads.map(l => <option key={l.leadId} value={l.leadId}>{l.leadName}</option>)}
              </Select>
            </div>
            <Textarea
              label="תיאור"
              value={editingEvent.description || ''}
              onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>ביטול</Button>
              <Button type="submit">{editingEvent.id ? 'עדכן' : 'צור אירוע'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Event Detail Modal */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="פרטי אירוע" size="md">
        {selectedEvent && (() => {
          const config = EVENT_TYPE_CONFIG[selectedEvent.resource.eventType] || EVENT_TYPE_CONFIG.task;
          const Icon = config.icon;
          const isVirtual = selectedEvent.resource.isVirtual;
          const linkedClient = selectedEvent.resource.clientId
            ? clients.find(c => c.clientId === selectedEvent.resource.clientId)
            : null;
          const linkedLead = selectedEvent.resource.leadId
            ? leads.find(l => l.leadId === selectedEvent.resource.leadId)
            : null;

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: config.color + '20' }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedEvent.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: config.color + '20', color: config.color }}>
                      {config.label}
                    </span>
                    {isVirtual && <span className="text-gray-500">(מעקב ליד אוטומטי)</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-gray-500 w-16">מתי:</span>
                  <span>
                    {format(selectedEvent.start, 'EEEE, d MMMM yyyy', { locale: he })}
                    {!selectedEvent.allDay && ` · ${format(selectedEvent.start, 'HH:mm')} - ${format(selectedEvent.end, 'HH:mm')}`}
                  </span>
                </div>

                {selectedEvent.resource.description && (
                  <div className="flex items-start gap-2 text-gray-300">
                    <span className="text-gray-500 w-16">תיאור:</span>
                    <span>{selectedEvent.resource.description}</span>
                  </div>
                )}

                {linkedClient && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500 w-16">לקוח:</span>
                    <span className="text-primary">{linkedClient.businessName}</span>
                  </div>
                )}

                {linkedLead && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-gray-500 w-16">ליד:</span>
                    <span className="text-secondary">{linkedLead.leadName}</span>
                  </div>
                )}
              </div>

              {!isVirtual && (
                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <Button variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={handleDelete} icon={<Trash2 size={14} />}>
                    מחק
                  </Button>
                  <Button variant="ghost" onClick={handleEdit} icon={<Edit3 size={14} />}>
                    ערוך
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default CalendarPage;
