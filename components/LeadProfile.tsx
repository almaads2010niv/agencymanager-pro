import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel, NoteType } from '../types';
import type { Lead } from '../types';
import { formatCurrency, formatDate, formatDateTime, formatPhoneForWhatsApp } from '../utils';
import { MESSAGE_PURPOSES } from '../constants';
import { ArrowRight, Phone, Mail, Calendar, Send, Trash2, MessageCircle, User, Clock, CheckCircle, Tag, Globe, ChevronDown, ChevronUp, Sparkles, Plus, FileText, Mic, Edit3, Target } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Input, Textarea, Select, Checkbox } from './ui/Form';
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
    aiRecommendations, addAIRecommendation, deleteAIRecommendation,
    whatsappMessages, addWhatsAppMessage, deleteWhatsAppMessage, uploadRecording,
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
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [expandedRecommendationId, setExpandedRecommendationId] = useState<string | null>(null);
  const [confirmDeleteRecommendationId, setConfirmDeleteRecommendationId] = useState<string | null>(null);

  // Proposal state
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // WhatsApp state
  const [waMessagePurpose, setWaMessagePurpose] = useState('follow_up');
  const [waGeneratedMessages, setWaGeneratedMessages] = useState<string[]>([]);
  const [isGeneratingWA, setIsGeneratingWA] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waCustomMessage, setWaCustomMessage] = useState('');
  const [expandedWAHistoryId, setExpandedWAHistoryId] = useState<string | null>(null);
  const [confirmDeleteWAId, setConfirmDeleteWAId] = useState<string | null>(null);

  // Audio transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // AI Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);
  const [confirmDeleteSummaryId, setConfirmDeleteSummaryId] = useState<string | null>(null);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Lead> | null>(null);

  // Expand/collapse for long notes in contact info
  const [notesExpanded, setNotesExpanded] = useState(false);
  const NOTES_PREVIEW_LENGTH = 150;

  // Filter notes for this lead — separate manual notes from AI summaries
  const leadNotesAll = leadNotes.filter(n => n.leadId === leadId);
  const leadNotesFiltered = leadNotesAll.filter(n => n.noteType === 'manual' || !n.noteType);
  const leadAISummaries = leadNotesAll.filter(n => n.noteType && n.noteType !== 'manual');

  // Filter transcripts for this lead
  const leadTranscripts = callTranscripts.filter(ct => ct.leadId === leadId);

  // Filter AI recommendations for this lead
  const leadRecommendations = aiRecommendations.filter(r => r.leadId === leadId);

  // Filter WhatsApp messages for this lead
  const leadWAMessages = whatsappMessages.filter(m => m.leadId === leadId);

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

  // Edit modal handlers
  const openEditModal = () => {
    if (!lead) return;
    setEditFormData({ ...lead });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData || !lead) return;
    await updateLead({ ...lead, ...editFormData } as Lead);
    setIsEditModalOpen(false);
    setEditFormData(null);
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
    if (!lead || !user) return;
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
        const recId = crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}`;
        // Auto-save recommendation to DB
        await addAIRecommendation({
          leadId: lead.leadId,
          recommendation: result.recommendation,
          createdBy: user.id,
          createdByName: currentUserName,
        });
        // Auto-generate recommendation summary note (fire and forget)
        try {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          const sRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${s2?.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              summaryType: 'recommendation_summary',
              recommendation: result.recommendation,
              entityName: lead.businessName || lead.leadName,
              additionalContext: `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`,
            }),
          });
          const sResult = await sRes.json();
          if (sResult.success && sResult.summary) {
            await addLeadNote(lead.leadId, sResult.summary, user.id, currentUserName, 'recommendation_summary', recId);
          }
        } catch { /* silent */ }
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

  // WhatsApp: Generate AI messages
  const handleGenerateWAMessages = async () => {
    if (!lead || !user) return;
    setIsGeneratingWA(true);
    setWaError(null);
    setWaGeneratedMessages([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const purposeObj = MESSAGE_PURPOSES.find(p => p.key === waMessagePurpose);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-whatsapp-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'lead',
          entityName: lead.businessName || lead.leadName,
          purpose: waMessagePurpose,
          purposeLabel: purposeObj?.label || waMessagePurpose,
          notes: leadNotesFiltered.map(n => ({ content: n.content, createdByName: n.createdByName, createdAt: n.createdAt })),
          transcripts: leadTranscripts.map(ct => ({ summary: ct.summary, callDate: ct.callDate })),
          additionalContext: `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`,
        }),
      });
      const result = await res.json();
      if (result.success && result.messages) {
        setWaGeneratedMessages(result.messages);
      } else {
        setWaError(result.error || 'שגיאה ביצירת הודעות');
      }
    } catch {
      setWaError('שגיאת רשת - ודא שמפתח Gemini API מוגדר בהגדרות');
    } finally {
      setIsGeneratingWA(false);
    }
  };

  // WhatsApp: Send message
  const handleSendWA = async (messageText: string, isAiGenerated: boolean) => {
    if (!lead?.phone || !user) return;
    const phone = formatPhoneForWhatsApp(lead.phone).replace('+', '');
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');

    const purposeObj = MESSAGE_PURPOSES.find(p => p.key === waMessagePurpose);
    await addWhatsAppMessage({
      leadId: lead.leadId,
      messageText,
      messagePurpose: purposeObj?.label || waMessagePurpose,
      phoneNumber: lead.phone,
      sentBy: user.id,
      sentByName: currentUserName,
      isAiGenerated,
    });
  };

  // Audio: Upload recording for transcription
  const handleUploadRecording = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead || !user) return;
    setIsTranscribing(true);
    setTranscribeError(null);
    try {
      // 1. Upload to storage
      const uploadResult = await uploadRecording('lead', lead.leadId, file);
      if (!uploadResult) {
        setTranscribeError('שגיאה בהעלאת הקובץ לאחסון. בדוק שהקובץ תקין ונסה שוב.');
        return;
      }

      // 2. Call transcribe Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setTranscribeError('שגיאת אימות - נסה להתחבר מחדש.');
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: uploadResult.signedUrl,
          entityName: lead.leadName,
          businessName: lead.businessName || lead.leadName,
          mimeType: file.type || 'audio/mpeg',
        }),
      });
      let result;
      try {
        result = await res.json();
      } catch {
        setTranscribeError(`שגיאת שרת (${res.status}). נסה שוב.`);
        return;
      }
      if (!res.ok || !result.success) {
        setTranscribeError(result.error || `שגיאה בתמלול ההקלטה (${res.status})`);
        return;
      }
      // 3. Auto-save as CallTranscript
      const transcriptId = crypto.randomUUID ? crypto.randomUUID() : `t_${Date.now()}`;
      await addCallTranscript({
        leadId: lead.leadId,
        callDate: new Date().toISOString().split('T')[0],
        participants: `ניב, ${lead.leadName}`,
        transcript: result.transcript,
        summary: result.summary,
        createdBy: user.id,
        createdByName: currentUserName,
      });
      // 4. Auto-generate AI summary note from transcript (fire and forget)
      if (result.summary || result.transcript) {
        try {
          const { data: { session: s2 } } = await supabase.auth.getSession();
          const sBody: Record<string, string> = {
            summaryType: 'transcript_summary',
            entityName: lead.businessName || lead.leadName,
            additionalContext: `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`,
          };
          if (result.summary) sBody.transcriptSummary = result.summary;
          sBody.transcript = result.transcript || '';
          const sRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${s2?.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(sBody),
          });
          const sResult = await sRes.json();
          if (sResult.success && sResult.summary) {
            await addLeadNote(lead.leadId, sResult.summary, user.id, currentUserName, 'transcript_summary', transcriptId);
          }
        } catch { /* silent — auto-gen failure shouldn't block the user */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Transcription error:', err);
      setTranscribeError(`שגיאה בהעלאה או בתמלול ההקלטה: ${msg}`);
    } finally {
      setIsTranscribing(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // AI Summary: Generate summary for a transcript or recommendation
  const handleGenerateAISummary = async (summaryType: NoteType, sourceId: string, sourceText: string, existingSummary?: string) => {
    if (!lead || !user) return;
    // Check for duplicate
    if (leadAISummaries.find(n => n.sourceId === sourceId)) return;
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body: Record<string, string> = {
        summaryType,
        entityName: lead.businessName || lead.leadName,
        additionalContext: `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`,
      };
      if (summaryType === 'transcript_summary') {
        body.transcript = sourceText;
        if (existingSummary) body.transcriptSummary = existingSummary;
      } else if (summaryType === 'proposal_focus') {
        body.transcript = sourceText;
        if (existingSummary) body.transcriptSummary = existingSummary;
        // Also include latest recommendation if available for richer context
        const latestRec = leadRecommendations[0];
        if (latestRec) body.recommendation = latestRec.recommendation;
      } else {
        body.recommendation = sourceText;
      }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success && result.summary) {
        await addLeadNote(lead.leadId, result.summary, user.id, currentUserName, summaryType as NoteType, sourceId);
      } else {
        setSummaryError(result.error || 'שגיאה ביצירת סיכום AI');
      }
    } catch {
      setSummaryError('שגיאת רשת - ודא שמפתח Gemini API מוגדר בהגדרות');
    } finally {
      setIsGeneratingSummary(false);
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
      <div id="lead-header" className="flex items-center gap-4">
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
        {isAdmin && (
          <Button onClick={openEditModal} variant="ghost" icon={<Edit3 size={16} />}>
            עריכת ליד
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
                {lead.notes.length > NOTES_PREVIEW_LENGTH ? (
                  <>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">
                      {notesExpanded ? lead.notes : lead.notes.substring(0, NOTES_PREVIEW_LENGTH) + '...'}
                    </p>
                    <button
                      onClick={() => setNotesExpanded(!notesExpanded)}
                      className="text-primary text-xs mt-1 hover:underline flex items-center gap-1"
                    >
                      {notesExpanded ? <><ChevronUp size={12} /> הצג פחות</> : <><ChevronDown size={12} /> הצג עוד</>}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{lead.notes}</p>
                )}
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

          {/* Quick Summary Shortcuts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <button
              onClick={() => document.getElementById('lead-notes-section')?.scrollIntoView({ behavior: 'smooth' })}
              className={`p-3 rounded-xl border text-start transition-all hover:bg-white/[0.03] ${leadNotesFiltered.length > 0 ? 'bg-[#0B1121] border-primary/20' : 'bg-[#0B1121] border-white/5'}`}
            >
              <div className="flex items-center gap-2">
                <Send size={14} className={leadNotesFiltered.length > 0 ? 'text-primary' : 'text-gray-600'} />
                <span className={`text-sm font-medium ${leadNotesFiltered.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                  {leadNotesFiltered.length} הערות
                </span>
              </div>
            </button>
            <button
              onClick={() => document.getElementById('lead-transcripts-section')?.scrollIntoView({ behavior: 'smooth' })}
              className={`p-3 rounded-xl border text-start transition-all hover:bg-white/[0.03] ${leadTranscripts.length > 0 ? 'bg-[#0B1121] border-amber-500/20' : 'bg-[#0B1121] border-white/5'}`}
            >
              <div className="flex items-center gap-2">
                <Phone size={14} className={leadTranscripts.length > 0 ? 'text-amber-400' : 'text-gray-600'} />
                <span className={`text-sm font-medium ${leadTranscripts.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                  {leadTranscripts.length} תמלולים
                </span>
              </div>
            </button>
            {settings.hasCanvaKey && (
              <button
                onClick={() => document.getElementById('lead-header')?.scrollIntoView({ behavior: 'smooth' })}
                className="p-3 bg-[#0B1121] rounded-xl border border-white/5 text-start transition-all hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-500">הצעת מחיר</span>
                </div>
              </button>
            )}
            <button
              onClick={() => document.getElementById('lead-ai-section')?.scrollIntoView({ behavior: 'smooth' })}
              className={`p-3 rounded-xl border text-start transition-all hover:bg-white/[0.03] ${leadRecommendations.length > 0 ? 'bg-[#0B1121] border-purple-500/20' : 'bg-[#0B1121] border-white/5'}`}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className={leadRecommendations.length > 0 ? 'text-purple-400' : 'text-gray-600'} />
                <span className={`text-sm font-medium ${leadRecommendations.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                  {leadRecommendations.length} המלצות AI
                </span>
              </div>
            </button>
            <button
              onClick={() => document.getElementById('lead-whatsapp-section')?.scrollIntoView({ behavior: 'smooth' })}
              className={`p-3 rounded-xl border text-start transition-all hover:bg-white/[0.03] ${leadWAMessages.length > 0 ? 'bg-[#0B1121] border-emerald-500/20' : 'bg-[#0B1121] border-white/5'}`}
            >
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className={leadWAMessages.length > 0 ? 'text-emerald-400' : 'text-gray-600'} />
                <span className={`text-sm font-medium ${leadWAMessages.length > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                  {leadWAMessages.length} הודעות WA
                </span>
              </div>
            </button>
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

      {/* Notes History (manual only — AI summaries shown in separate section) */}
      <Card id="lead-notes-section">
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
      <Card id="lead-transcripts-section">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="תמלולי שיחות" subtitle={`${leadTranscripts.length} תמלולים`} />
          <div className="flex items-center gap-2">
            {settings.hasGeminiKey && (
              <>
                <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleUploadRecording} className="hidden" />
                <Button onClick={() => audioInputRef.current?.click()} disabled={isTranscribing} variant="ghost" icon={<Mic size={16} />}>
                  {isTranscribing ? 'מתמלל...' : 'העלה הקלטה'}
                </Button>
              </>
            )}
            <Button onClick={() => setShowAddTranscript(true)} icon={<Plus size={16} />}>הוסף תמלול</Button>
          </div>
        </div>
        {isTranscribing && (
          <div className="flex items-center justify-center py-4 gap-3 mb-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">מתמלל הקלטה... (2-5 דקות עבור שיחות ארוכות)</span>
          </div>
        )}
        {transcribeError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
            {transcribeError}
          </div>
        )}

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
      <Card id="lead-ai-section">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="המלצות AI" subtitle={leadRecommendations.length > 0 ? `${leadRecommendations.length} המלצות` : 'מנוע Gemini'} />
          <Button onClick={handleGetRecommendations} disabled={isLoadingAI || !settings.hasGeminiKey} icon={<Sparkles size={16} />}>
            {isLoadingAI ? 'מנתח...' : 'קבל המלצות'}
          </Button>
        </div>
        {aiError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
            {aiError}
          </div>
        )}
        {isLoadingAI && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">מנתח מידע...</span>
          </div>
        )}
        {leadRecommendations.length > 0 ? (
          <div className="space-y-3">
            {leadRecommendations.map(rec => {
              const isExpanded = expandedRecommendationId === rec.id;
              const preview = rec.recommendation.length > 150 ? rec.recommendation.substring(0, 150) + '...' : rec.recommendation;
              return (
                <div key={rec.id} className="bg-[#0B1121] rounded-xl border border-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedRecommendationId(isExpanded ? null : rec.id)}
                    className="w-full text-start p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-amber-400" />
                        <span className="text-xs text-gray-400">{formatDateTime(rec.createdAt)}</span>
                        <span className="text-xs text-gray-600">· {rec.createdByName}</span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                    {!isExpanded && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{preview}</p>
                    )}
                  </button>
                  {isExpanded && (
                    <div>
                      <div className="px-4 pb-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{rec.recommendation}</p>
                      </div>
                      {isAdmin && (
                        <div className="px-4 pb-3 border-t border-white/5 pt-2 flex justify-end">
                          <button onClick={() => setConfirmDeleteRecommendationId(rec.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1">
                            <Trash2 size={12} /> מחק
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : !isLoadingAI && (
          <p className="text-gray-600 text-sm text-center py-6 italic">
            לחץ על &quot;קבל המלצות&quot; לקבלת ניתוח AI מבוסס הערות ותמלולי שיחות.
          </p>
        )}
      </Card>

      {/* AI Summaries Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="סיכומי AI" subtitle={leadAISummaries.length > 0 ? `${leadAISummaries.length} סיכומים` : 'סיכומים אוטומטיים'} />
        </div>
        {summaryError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
            {summaryError}
          </div>
        )}
        {isGeneratingSummary && (
          <div className="flex items-center justify-center py-4 gap-3 mb-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">מייצר סיכום AI...</span>
          </div>
        )}
        {leadAISummaries.length > 0 ? (
          <div className="space-y-3">
            {leadAISummaries.map(summary => {
              const isExpanded = expandedSummaryId === summary.id;
              const typeLabel = summary.noteType === 'transcript_summary' ? '📝 סיכום תמלול' : summary.noteType === 'proposal_focus' ? '🎯 מיקוד להצעת מחיר' : '💡 סיכום המלצות';
              const preview = summary.content.length > 200 ? summary.content.substring(0, 200) + '...' : summary.content;
              return (
                <div key={summary.id} className="bg-[#0B1121] rounded-xl border border-purple-500/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedSummaryId(isExpanded ? null : summary.id)}
                    className="w-full text-start p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{typeLabel}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(summary.createdAt)}</span>
                        <span className="text-xs text-gray-600">· {summary.createdByName}</span>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                    </div>
                    {!isExpanded && (
                      <p className="text-gray-400 text-sm mt-1 line-clamp-2">{preview}</p>
                    )}
                  </button>
                  {isExpanded && (
                    <div>
                      <div className="px-4 pb-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{summary.content}</p>
                      </div>
                      {isAdmin && (
                        <div className="px-4 pb-3 border-t border-white/5 pt-2 flex justify-end">
                          <button onClick={() => setConfirmDeleteSummaryId(summary.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1">
                            <Trash2 size={12} /> מחק
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600 text-sm text-center py-4 italic">
            סיכומי AI ייווצרו אוטומטית לאחר תמלול הקלטה או יצירת המלצות.
          </p>
        )}
        {/* Manual generate buttons */}
        {settings.hasGeminiKey && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
            {leadTranscripts.length > 0 && (
              <Button
                onClick={() => {
                  const latestTranscript = leadTranscripts[0];
                  if (latestTranscript) {
                    handleGenerateAISummary('transcript_summary', latestTranscript.id, latestTranscript.transcript, latestTranscript.summary);
                  }
                }}
                disabled={isGeneratingSummary || (leadTranscripts.length > 0 && !!leadAISummaries.find(n => n.sourceId === leadTranscripts[0]?.id))}
                variant="ghost"
                icon={<FileText size={14} />}
              >
                צור סיכום תמלול
              </Button>
            )}
            {leadRecommendations.length > 0 && (
              <Button
                onClick={() => {
                  const latestRec = leadRecommendations[0];
                  if (latestRec) {
                    handleGenerateAISummary('recommendation_summary', latestRec.id, latestRec.recommendation);
                  }
                }}
                disabled={isGeneratingSummary || (leadRecommendations.length > 0 && !!leadAISummaries.find(n => n.sourceId === leadRecommendations[0]?.id))}
                variant="ghost"
                icon={<Sparkles size={14} />}
              >
                צור סיכום המלצות
              </Button>
            )}
            {leadTranscripts.length > 0 && (
              <Button
                onClick={() => {
                  const latestTranscript = leadTranscripts[0];
                  if (latestTranscript) {
                    handleGenerateAISummary('proposal_focus', `pf_${latestTranscript.id}`, latestTranscript.transcript, latestTranscript.summary);
                  }
                }}
                disabled={isGeneratingSummary || (leadTranscripts.length > 0 && !!leadAISummaries.find(n => n.sourceId === `pf_${leadTranscripts[0]?.id}`))}
                variant="ghost"
                icon={<Target size={14} />}
              >
                צור מיקוד להצעת מחיר
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* WhatsApp Messages */}
      <Card id="lead-whatsapp-section">
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            title="הודעות WhatsApp"
            subtitle={leadWAMessages.length > 0 ? `${leadWAMessages.length} הודעות${leadWAMessages[0] ? ` · אחרונה: ${formatDate(leadWAMessages[0].sentAt)}` : ''}` : 'שלח הודעות לליד'}
          />
        </div>

        {!lead?.phone ? (
          <p className="text-gray-600 text-sm text-center py-6 italic">לא ניתן לשלוח הודעות - לא הוזן מספר טלפון</p>
        ) : (
          <div className="space-y-4">
            {/* Purpose selector + Generate button */}
            <div className="flex items-center gap-3">
              <select
                value={waMessagePurpose}
                onChange={e => setWaMessagePurpose(e.target.value)}
                className="flex-1 bg-[#0B1121] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary/50"
              >
                {MESSAGE_PURPOSES.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <Button onClick={handleGenerateWAMessages} disabled={isGeneratingWA || !settings.hasGeminiKey} icon={<Sparkles size={16} />}>
                {isGeneratingWA ? 'יוצר...' : 'צור הודעות'}
              </Button>
            </div>

            {waError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{waError}</div>
            )}
            {isGeneratingWA && (
              <div className="flex items-center justify-center py-6 gap-3">
                <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <span className="text-gray-400 text-sm">מייצר הודעות...</span>
              </div>
            )}

            {/* AI Generated Messages */}
            {waGeneratedMessages.length > 0 && (
              <div className="space-y-2">
                {waGeneratedMessages.map((msg, idx) => (
                  <div key={idx} className="bg-[#0B1121] border border-emerald-500/10 rounded-xl p-3">
                    <p className="text-gray-300 text-sm mb-2 whitespace-pre-wrap">{msg}</p>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setWaCustomMessage(msg)}
                        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                      >
                        <Edit3 size={12} /> עריכה
                      </button>
                      <button
                        onClick={() => handleSendWA(msg, true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Send size={12} /> שלח בוואטסאפ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom / Edit message textarea */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{waCustomMessage ? 'עריכת הודעה' : 'הודעה חופשית'}</p>
              <textarea
                value={waCustomMessage}
                onChange={e => setWaCustomMessage(e.target.value)}
                placeholder="כתוב הודעה חופשית או ערוך הודעת AI..."
                rows={3}
                className="w-full bg-[#0B1121] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                dir="rtl"
              />
              {waCustomMessage.trim() && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { handleSendWA(waCustomMessage, false); setWaCustomMessage(''); }}
                    className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Send size={14} /> שלח בוואטסאפ
                  </button>
                </div>
              )}
            </div>

            {/* Message History */}
            {leadWAMessages.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">היסטוריית הודעות ({leadWAMessages.length})</p>
                {leadWAMessages.map(msg => {
                  const isExpanded = expandedWAHistoryId === msg.id;
                  return (
                    <div key={msg.id} className="bg-[#0B1121] rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedWAHistoryId(isExpanded ? null : msg.id)}
                        className="w-full text-start p-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">{formatDateTime(msg.sentAt)}</span>
                            <span className="text-gray-600">· {msg.sentByName}</span>
                            <Badge variant={msg.isAiGenerated ? 'info' : 'neutral'}>{msg.messagePurpose}</Badge>
                            {msg.isAiGenerated && <span className="text-amber-400/60 text-[10px]">AI</span>}
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                        {!isExpanded && (
                          <p className="text-gray-500 text-xs mt-1 line-clamp-1">{msg.messageText}</p>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3">
                          <p className="text-gray-300 text-sm whitespace-pre-wrap mb-2">{msg.messageText}</p>
                          <div className="flex justify-between items-center pt-2 border-t border-white/5">
                            <button
                              onClick={() => handleSendWA(msg.messageText, msg.isAiGenerated)}
                              className="text-xs text-emerald-400/60 hover:text-emerald-400 flex items-center gap-1"
                            >
                              <Send size={11} /> שלח שוב
                            </button>
                            {isAdmin && (
                              <button onClick={() => setConfirmDeleteWAId(msg.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1">
                                <Trash2 size={11} /> מחק
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* Confirm Delete AI Recommendation Modal */}
      <Modal isOpen={!!confirmDeleteRecommendationId} onClose={() => setConfirmDeleteRecommendationId(null)} title="מחיקת המלצת AI" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את המלצת ה-AI?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteRecommendationId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteRecommendationId) { await deleteAIRecommendation(confirmDeleteRecommendationId); setConfirmDeleteRecommendationId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete WhatsApp Message Modal */}
      <Modal isOpen={!!confirmDeleteWAId} onClose={() => setConfirmDeleteWAId(null)} title="מחיקת הודעה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את ההודעה מההיסטוריה?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteWAId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteWAId) { await deleteWhatsAppMessage(confirmDeleteWAId); setConfirmDeleteWAId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete AI Summary Modal */}
      <Modal isOpen={!!confirmDeleteSummaryId} onClose={() => setConfirmDeleteSummaryId(null)} title="מחיקת סיכום AI" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את סיכום ה-AI?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteSummaryId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteSummaryId) { await deleteLeadNote(confirmDeleteSummaryId); setConfirmDeleteSummaryId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="עריכת ליד">
        {editFormData && (
          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Input label="שם הליד" required value={editFormData.leadName || ''} onChange={e => setEditFormData({...editFormData, leadName: e.target.value})} />
              <Input label="שם עסק" value={editFormData.businessName || ''} onChange={e => setEditFormData({...editFormData, businessName: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="טלפון" value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
              <Input label="אימייל" type="email" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="מקור" value={editFormData.sourceChannel || ''} onChange={e => setEditFormData({...editFormData, sourceChannel: e.target.value as SourceChannel})}>
                {Object.values(SourceChannel).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Input label="הצעת מחיר (₪)" type="number" value={editFormData.quotedMonthlyValue ?? ''} onChange={e => setEditFormData({...editFormData, quotedMonthlyValue: Number(e.target.value) || 0})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="תאריך קשר הבא" type="date" value={editFormData.nextContactDate ? new Date(editFormData.nextContactDate).toISOString().split('T')[0] : ''} onChange={e => setEditFormData({...editFormData, nextContactDate: e.target.value})} />
              <Select label="סטטוס" value={editFormData.status || ''} onChange={e => setEditFormData({...editFormData, status: e.target.value as LeadStatus})}>
                {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <Select label="מטפל אחראי" value={editFormData.assignedTo || ''} onChange={e => setEditFormData({...editFormData, assignedTo: e.target.value || undefined})}>
              <option value="">לא משויך</option>
              {allUsers.map(u => (
                <option key={u.user_id} value={u.user_id}>{u.display_name}</option>
              ))}
            </Select>
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">שירותים מתעניינים</label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 border border-white/10 rounded-lg bg-[#0B1121]">
                {services.filter(s => s.isActive).map(service => (
                  <Checkbox
                    key={service.serviceKey}
                    label={service.label}
                    checked={editFormData.interestedServices?.includes(service.serviceKey) || false}
                    onChange={(checked) => {
                      const current = editFormData.interestedServices || [];
                      if (checked) setEditFormData({...editFormData, interestedServices: [...current, service.serviceKey]});
                      else setEditFormData({...editFormData, interestedServices: current.filter((k: string) => k !== service.serviceKey)});
                    }}
                  />
                ))}
              </div>
            </div>
            <Textarea label="הערות" value={editFormData.notes || ''} onChange={e => setEditFormData({...editFormData, notes: e.target.value})} />
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>ביטול</Button>
              <Button type="submit">שמור</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default LeadProfile;
