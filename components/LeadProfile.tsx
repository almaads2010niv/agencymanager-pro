import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel } from '../types';
import { formatCurrency, formatDate, formatDateTime, formatPhoneForWhatsApp } from '../utils';
import { ArrowRight, Phone, Mail, Calendar, Send, Trash2, MessageCircle, User, Clock, CheckCircle, Tag, Globe, ChevronDown, ChevronUp, Sparkles, Plus, FileText } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Input, Textarea } from './ui/Form';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

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

const LeadProfile: React.FC = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const { user, displayName: currentUserName, allUsers, isAdmin } = useAuth();
  const {
    leads, services, activities, settings,
    leadNotes, addLeadNote, deleteLeadNote,
    updateLead, convertLeadToClient,
    callTranscripts, addCallTranscript, deleteCallTranscript,
  } = useData();

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [convertingLead, setConvertingLead] = useState(false);

  // Transcript state
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);
  const [showAddTranscript, setShowAddTranscript] = useState(false);
  const [newTranscript, setNewTranscript] = useState({ callDate: new Date().toISOString().split('T')[0], participants: '', transcript: '', summary: '' });
  const [confirmDeleteTranscriptId, setConfirmDeleteTranscriptId] = useState<string | null>(null);

  // AI state
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Proposal state
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Filter notes for this lead
  const leadNotesFiltered = leadNotes.filter(n => n.leadId === leadId);

  // Filter transcripts for this lead
  const leadTranscripts = callTranscripts.filter(ct => ct.leadId === leadId);

  // Filter activities for this lead
  const leadActivities = activities.filter(a => a.entityId === leadId).slice(0, 20);

  // Helper to get user name from allUsers
  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const u = allUsers.find(u => u.user_id === userId);
    return u?.display_name || null;
  };

  // Relative time helper
  const getRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return formatDate(dateStr);
  };

  // Handle note submission
  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !user) return;
    setIsAddingNote(true);
    try {
      await addLeadNote(leadId!, newNoteContent.trim(), user.id, currentUserName);
      setNewNoteContent('');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Quick-edit handlers
  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    await updateLead({ ...lead, status: newStatus as LeadStatus });
  };

  const handleSourceChange = async (newSource: string) => {
    if (!lead) return;
    await updateLead({ ...lead, sourceChannel: newSource as SourceChannel });
  };

  const handleAssignedToChange = async (newAssigned: string) => {
    if (!lead) return;
    await updateLead({ ...lead, assignedTo: newAssigned || undefined });
  };

  const handleAddTranscript = async () => {
    if (!newTranscript.transcript.trim() || !user) return;
    await addCallTranscript({
      leadId: leadId!,
      callDate: newTranscript.callDate,
      participants: newTranscript.participants,
      transcript: newTranscript.transcript,
      summary: newTranscript.summary,
      createdBy: user.id,
      createdByName: currentUserName,
    });
    setNewTranscript({ callDate: new Date().toISOString().split('T')[0], participants: '', transcript: '', summary: '' });
    setShowAddTranscript(false);
  };

  const handleGetRecommendations = async () => {
    if (!lead) return;
    setIsLoadingAI(true);
    setAiError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'lead',
          entityName: lead.businessName || lead.leadName,
          notes: leadNotesFiltered.map(n => ({ content: n.content, createdByName: n.createdByName, createdAt: n.createdAt })),
          transcripts: leadTranscripts.map(ct => ({ summary: ct.summary, callDate: ct.callDate, transcript: ct.transcript })),
          additionalContext: `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAiRecommendation(result.recommendation);
      } else {
        setAiError(result.error || 'שגיאה בקבלת המלצות');
      }
    } catch {
      setAiError('שגיאת רשת - ודא שמפתח Gemini API מוגדר בהגדרות');
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleGenerateProposal = async () => {
    if (!lead) return;
    setIsGeneratingProposal(true);
    setProposalError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const activeServiceLabels = services
        .filter(s => (lead.interestedServices || []).includes(s.serviceKey))
        .map(s => s.label);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-proposal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadName: lead.leadName,
          businessName: lead.businessName || lead.leadName,
          quotedMonthlyValue: lead.quotedMonthlyValue,
          services: activeServiceLabels.join(', '),
          phone: lead.phone,
          email: lead.email || '',
        }),
      });
      const result = await res.json();
      if (result.success) {
        const url = result.pdfUrl || result.designUrl;
        if (url) window.open(url, '_blank');
      } else {
        setProposalError(result.error || 'שגיאה ביצירת הצעת מחיר');
      }
    } catch {
      setProposalError('שגיאת רשת - ודא שמפתח Canva API מוגדר בהגדרות');
    } finally {
      setIsGeneratingProposal(false);
    }
  };

  const doConvertToClient = () => {
    if (!lead) return;
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
    setConvertingLead(false);
  };

  const lead = leads.find(l => l.leadId === leadId);

  if (!lead) {
    return (
      <div className="space-y-6">
        <Button onClick={() => navigate('/leads')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה ללידים</Button>
        <Card>
          <p className="text-gray-400 text-center py-12">ליד לא נמצא</p>
        </Card>
      </div>
    );
  }

  const isOverdue = lead.nextContactDate && new Date(lead.nextContactDate) < new Date();
  const isOpen = [LeadStatus.New, LeadStatus.Contacted, LeadStatus.Proposal_sent, LeadStatus.Meeting_scheduled, LeadStatus.Pending_decision].includes(lead.status);

  const activeServiceKeys = lead.interestedServices || [];
  const activeServiceLabels = services
    .filter(s => activeServiceKeys.includes(s.serviceKey))
    .map(s => s.label);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/leads')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה</Button>
        <div className="flex-1">
          <h2 className="text-3xl font-black text-white tracking-tight">{lead.leadName}</h2>
          <div className="flex items-center gap-3 mt-1">
            {lead.businessName && <span className="text-gray-400">{lead.businessName}</span>}
            {getUserName(lead.assignedTo) && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10">
                <User size={12} className="text-violet-400" />
                <span className="text-violet-400 text-xs">{getUserName(lead.assignedTo)}</span>
              </div>
            )}
          </div>
        </div>
        <select
          value={lead.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="bg-[#0B1121] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none cursor-pointer"
        >
          {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {settings.hasCanvaKey && (
          <Button
            onClick={handleGenerateProposal}
            disabled={isGeneratingProposal}
            variant="ghost"
            icon={<FileText size={16} />}
          >
            {isGeneratingProposal ? 'מייצר...' : 'צור הצעת מחיר'}
          </Button>
        )}
        {isAdmin && isOpen && (
          <Button
            onClick={() => setConvertingLead(true)}
            variant="secondary"
            icon={<CheckCircle size={16} />}
          >
            המר ללקוח
          </Button>
        )}
      </div>

      {/* Proposal Error */}
      {proposalError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{proposalError}</span>
          <button onClick={() => setProposalError(null)} className="text-red-400/60 hover:text-red-300 ms-3">✕</button>
        </div>
      )}

      {/* Contact + Lead Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader title="פרטי קשר" />
          <div className="space-y-4 mt-4">
            {lead.phone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-primary" />
                <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
                <a href={`https://wa.me/${formatPhoneForWhatsApp(lead.phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all" title="WhatsApp">
                  <MessageCircle size={14} />
                </a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-gray-400" />
                <span className="text-gray-300">{lead.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-gray-400" />
              <span className="text-gray-300">מקור: </span>
              <select
                value={lead.sourceChannel}
                onChange={e => handleSourceChange(e.target.value)}
                className="bg-transparent border border-white/10 rounded-md px-2 py-0.5 text-xs text-gray-300 outline-none cursor-pointer"
              >
                {Object.values(SourceChannel).map(s => <option key={s} value={s} className="bg-[#151e32] text-white">{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-gray-300">נוצר: {formatDate(lead.createdAt)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar size={16} className={isOverdue && isOpen ? 'text-red-400' : 'text-gray-400'} />
              <span className={isOverdue && isOpen ? 'text-red-400 font-bold' : 'text-gray-300'}>
                קשר הבא: {formatDate(lead.nextContactDate)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <User size={16} className="text-gray-400" />
              <span className="text-gray-300">מטפל: </span>
              <select
                value={lead.assignedTo || ''}
                onChange={e => handleAssignedToChange(e.target.value)}
                className="bg-transparent border border-white/10 rounded-md px-2 py-0.5 text-xs text-gray-300 outline-none cursor-pointer"
              >
                <option value="" className="bg-[#151e32] text-white">לא משויך</option>
                {allUsers.map(u => (
                  <option key={u.user_id} value={u.user_id} className="bg-[#151e32] text-white">{u.display_name}</option>
                ))}
              </select>
            </div>
            {lead.notes && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">הערות</p>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Financial & Services Summary */}
        <Card className="lg:col-span-2">
          <CardHeader title="פרטי ליד" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">הצעת מחיר חודשית</div>
              <div className="text-xl font-bold text-secondary font-mono mt-1">{formatCurrency(lead.quotedMonthlyValue)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">סטטוס</div>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(lead.status)}>{lead.status}</Badge>
              </div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">מקור</div>
              <div className="mt-1">
                <Badge variant={getSourceBadgeVariant(lead.sourceChannel)}>{lead.sourceChannel}</Badge>
              </div>
            </div>
          </div>

          {/* Services */}
          {activeServiceLabels.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">שירותים מתעניינים</p>
              <div className="flex flex-wrap gap-2">
                {activeServiceLabels.map(label => (
                  <Badge key={label} variant="primary">{label}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Related client link */}
          {lead.relatedClientId && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">לקוח משויך</p>
              <Button
                variant="ghost"
                className="text-primary hover:underline"
                onClick={() => navigate(`/clients/${lead.relatedClientId}`)}
              >
                צפה בכרטיס לקוח &larr;
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Notes History */}
      <Card>
        <CardHeader title="הערות והיסטוריה" subtitle={`${leadNotesFiltered.length} הערות`} />
        {/* Add note form */}
        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <textarea
              value={newNoteContent}
              onChange={e => setNewNoteContent(e.target.value)}
              placeholder="הוסף הערה..."
              rows={2}
              className="w-full bg-[#0B1121] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-primary/50 resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
            />
          </div>
          <Button onClick={handleAddNote} disabled={isAddingNote || !newNoteContent.trim()} icon={<Send size={16} />} className="self-end">
            {isAddingNote ? '...' : 'שלח'}
          </Button>
        </div>

        {/* Notes list */}
        <div className="mt-6 space-y-4">
          {leadNotesFiltered.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6 italic">אין הערות עדיין. הוסף הערה ראשונה למעלה.</p>
          ) : (
            leadNotesFiltered.map(note => (
              <div key={note.id} className="flex gap-3 group">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {note.createdByName.charAt(0) || '?'}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{note.createdByName}</span>
                    <span className="text-gray-600 text-[10px]">{getRelativeTime(note.createdAt)} · {formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{note.content}</p>
                </div>
                {/* Delete button (admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDeleteNoteId(note.id)}
                    className="p-1 rounded text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="מחק הערה"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Call Transcripts Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="תמלולי שיחות" subtitle={`${leadTranscripts.length} תמלולים`} />
          <Button onClick={() => setShowAddTranscript(true)} icon={<Plus size={16} />}>הוסף תמלול</Button>
        </div>

        {leadTranscripts.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6 italic">אין תמלולי שיחות עדיין.</p>
        ) : (
          <div className="space-y-4">
            {leadTranscripts.map(ct => {
              const isExpanded = expandedTranscriptId === ct.id;
              return (
                <div key={ct.id} className="border border-white/5 rounded-xl bg-[#0B1121] overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedTranscriptId(isExpanded ? null : ct.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-white text-sm font-semibold">{formatDateTime(ct.callDate)}</span>
                        {ct.participants && <span className="text-gray-500 text-xs">· {ct.participants}</span>}
                      </div>
                      {ct.summary && <p className="text-gray-400 text-xs line-clamp-2">{ct.summary.substring(0, 200)}{ct.summary.length > 200 ? '...' : ''}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ms-4">
                      {isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteTranscriptId(ct.id); }}
                          className="p-1.5 rounded text-gray-700 hover:text-red-400 transition-colors"
                          title="מחק תמלול"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-white/5">
                      {ct.summary && (
                        <div className="p-4 bg-primary/5 border-b border-white/5">
                          <p className="text-xs text-primary uppercase tracking-wider mb-2 font-bold">סיכום CRM</p>
                          <p className="text-gray-300 text-sm whitespace-pre-wrap">{ct.summary}</p>
                        </div>
                      )}
                      <div className="p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold">תמלול מלא</p>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                          <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{ct.transcript}</p>
                        </div>
                      </div>
                      <div className="px-4 pb-3 text-[10px] text-gray-600">
                        נוסף ע"י {ct.createdByName} · {formatDateTime(ct.createdAt)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* AI Recommendations */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="המלצות AI" subtitle="מנוע Gemini" />
          <Button onClick={handleGetRecommendations} disabled={isLoadingAI} icon={<Sparkles size={16} />}>
            {isLoadingAI ? 'מנתח...' : 'קבל המלצות'}
          </Button>
        </div>
        {aiError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
            {aiError}
          </div>
        )}
        {aiRecommendation ? (
          <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
            <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{aiRecommendation}</p>
          </div>
        ) : !isLoadingAI && (
          <p className="text-gray-600 text-sm text-center py-6 italic">
            לחץ על &quot;קבל המלצות&quot; לקבלת ניתוח AI מבוסס הערות ותמלולי שיחות.
          </p>
        )}
        {isLoadingAI && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">מנתח מידע...</span>
          </div>
        )}
      </Card>

      {/* Activity Timeline */}
      {leadActivities.length > 0 && (
        <Card>
          <CardHeader title="היסטוריית פעילות" subtitle={`${leadActivities.length} פעולות אחרונות`} />
          <div className="mt-4 space-y-3">
            {leadActivities.map(activity => (
              <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5">
                  <Clock size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-300 text-sm">{activity.description}</p>
                  <span className="text-gray-600 text-[10px]">{getRelativeTime(activity.createdAt)} · {formatDateTime(activity.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirm Convert Modal */}
      <Modal isOpen={convertingLead} onClose={() => setConvertingLead(false)} title="המרת ליד ללקוח" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם להפוך את <span className="text-white font-bold">{lead.leadName}</span> ללקוח פעיל?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConvertingLead(false)}>ביטול</Button>
            <Button type="button" onClick={doConvertToClient}>אשר והמר</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Note Modal */}
      <Modal isOpen={!!confirmDeleteNoteId} onClose={() => setConfirmDeleteNoteId(null)} title="מחיקת הערה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את ההערה?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteNoteId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteNoteId) { await deleteLeadNote(confirmDeleteNoteId); setConfirmDeleteNoteId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Add Transcript Modal */}
      <Modal isOpen={showAddTranscript} onClose={() => setShowAddTranscript(false)} title="הוספת תמלול שיחה" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="תאריך שיחה" type="date" value={newTranscript.callDate} onChange={e => setNewTranscript({ ...newTranscript, callDate: e.target.value })} />
            <Input label="משתתפים" value={newTranscript.participants} onChange={e => setNewTranscript({ ...newTranscript, participants: e.target.value })} placeholder="ניב, אביב" />
          </div>
          <Textarea label="סיכום CRM" value={newTranscript.summary} onChange={e => setNewTranscript({ ...newTranscript, summary: e.target.value })} rows={4} placeholder="סיכום קצר של השיחה, צרכי הלקוח, מה כדאי לעשות הלאה..." />
          <Textarea label="תמלול מלא" value={newTranscript.transcript} onChange={e => setNewTranscript({ ...newTranscript, transcript: e.target.value })} rows={12} placeholder="הדבק כאן את התמלול המלא של השיחה..." />
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setShowAddTranscript(false)}>ביטול</Button>
            <Button type="button" onClick={handleAddTranscript} disabled={!newTranscript.transcript.trim()}>שמור תמלול</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Transcript Modal */}
      <Modal isOpen={!!confirmDeleteTranscriptId} onClose={() => setConfirmDeleteTranscriptId(null)} title="מחיקת תמלול" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את תמלול השיחה?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteTranscriptId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteTranscriptId) { await deleteCallTranscript(confirmDeleteTranscriptId); setConfirmDeleteTranscriptId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeadProfile;
