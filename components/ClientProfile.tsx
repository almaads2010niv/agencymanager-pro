import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import type { ClientFile } from '../contexts/DataContext';
import { ClientStatus, ClientRating, EffortLevel, NoteType } from '../types';
import type { Client } from '../types';
import { formatCurrency, formatDate, formatDateTime, getMonthName, formatPhoneForWhatsApp } from '../utils';
import { ArrowRight, Phone, Mail, Calendar, Star, Upload, FileText, Trash2, ExternalLink, MessageCircle, User, Send, Clock, ChevronDown, ChevronUp, Sparkles, Plus, Mic, Edit3, Target } from 'lucide-react';
import { MESSAGE_PURPOSES } from '../constants';
import { supabase } from '../lib/supabaseClient';
import { Input, Textarea, Select, Checkbox } from './ui/Form';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';

const ClientProfile: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user, displayName: currentUserName, allUsers, isAdmin } = useAuth();
  const {
    clients, oneTimeDeals, expenses, payments, services, retainerHistory,
    uploadClientFile, listClientFiles, deleteClientFile,
    clientNotes, addClientNote, deleteClientNote, updateClient, activities,
    callTranscripts, addCallTranscript, deleteCallTranscript,
    aiRecommendations, addAIRecommendation, deleteAIRecommendation, settings,
    whatsappMessages, addWhatsAppMessage, deleteWhatsAppMessage, uploadRecording
  } = useData();

  const [clientFiles, setClientFiles] = useState<ClientFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

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
  const [editFormData, setEditFormData] = useState<Partial<Client> | null>(null);

  // Expand/collapse for long notes in contact info
  const [notesExpanded, setNotesExpanded] = useState(false);
  const NOTES_PREVIEW_LENGTH = 150;

  // Filter notes for this client — separate manual notes from AI summaries
  const clientNotesAll = clientNotes.filter(n => n.clientId === clientId);
  const clientNotesFiltered = clientNotesAll.filter(n => n.noteType === 'manual' || !n.noteType);
  const clientAISummaries = clientNotesAll.filter(n => n.noteType && n.noteType !== 'manual');

  // Filter transcripts for this client
  const clientTranscripts = callTranscripts.filter(ct => ct.clientId === clientId);

  // Filter AI recommendations for this client
  const clientRecommendations = aiRecommendations.filter(r => r.clientId === clientId);

  // Filter WhatsApp messages for this client
  const clientWAMessages = whatsappMessages.filter(m => m.clientId === clientId);

  // Filter activities for this client
  const clientActivities = activities.filter(a => a.entityId === clientId).slice(0, 20);

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

  // Load files when clientId changes
  useEffect(() => {
    if (clientId) {
      listClientFiles(clientId).then(setClientFiles);
    }
  }, [clientId, listClientFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !clientId) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        await uploadClientFile(clientId, file);
      }
      // Refresh file list
      const files = await listClientFiles(clientId);
      setClientFiles(files);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!clientId) return;
    await deleteClientFile(clientId, fileName);
    const files = await listClientFiles(clientId);
    setClientFiles(files);
    setConfirmDeleteFile(null);
  };

  // Handle note submission
  const handleAddNote = async () => {
    if (!newNoteContent.trim() || !user) return;
    setIsAddingNote(true);
    try {
      await addClientNote(clientId!, newNoteContent.trim(), user.id, currentUserName);
      setNewNoteContent('');
    } finally {
      setIsAddingNote(false);
    }
  };

  // Quick-edit handlers for status and rating
  const handleStatusChange = async (newStatus: string) => {
    if (!client) return;
    await updateClient({ ...client, status: newStatus as ClientStatus });
  };

  const handleRatingChange = async (newRating: string) => {
    if (!client) return;
    await updateClient({ ...client, rating: newRating as ClientRating });
  };

  // Edit modal handlers
  const openEditModal = () => {
    if (!client) return;
    setEditFormData({ ...client });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData || !client) return;
    await updateClient({ ...client, ...editFormData } as Client);
    setIsEditModalOpen(false);
    setEditFormData(null);
  };

  const handleAddTranscript = async () => {
    if (!newTranscript.transcript.trim() || !user) return;
    await addCallTranscript({
      clientId: clientId!,
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
    if (!client || !user) return;
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
          entityType: 'client',
          entityName: client.businessName,
          notes: clientNotesFiltered.map(n => ({ content: n.content, createdByName: n.createdByName, createdAt: n.createdAt })),
          transcripts: clientTranscripts.map(ct => ({ summary: ct.summary, callDate: ct.callDate, transcript: ct.transcript })),
          additionalContext: `סטטוס: ${client.status}, ריטיינר: ₪${client.monthlyRetainer}, דירוג: ${client.rating}`,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const recId = crypto.randomUUID ? crypto.randomUUID() : `r_${Date.now()}`;
        // Auto-save recommendation to DB
        await addAIRecommendation({
          clientId: client.clientId,
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
              entityName: client.businessName || client.clientName,
              additionalContext: `סטטוס: ${client.status}, ריטיינר: ₪${client.monthlyRetainer}, דירוג: ${client.rating}`,
            }),
          });
          const sResult = await sRes.json();
          if (sResult.success && sResult.summary) {
            await addClientNote(client.clientId, sResult.summary, user.id, currentUserName, 'recommendation_summary', recId);
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

  // WhatsApp: Generate AI messages
  const handleGenerateWAMessages = async () => {
    if (!client || !user) return;
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
          entityType: 'client',
          entityName: client.businessName || client.clientName,
          purpose: waMessagePurpose,
          purposeLabel: purposeObj?.label || waMessagePurpose,
          notes: clientNotesFiltered.map(n => ({ content: n.content, createdByName: n.createdByName, createdAt: n.createdAt })),
          transcripts: clientTranscripts.map(ct => ({ summary: ct.summary, callDate: ct.callDate })),
          additionalContext: `סטטוס: ${client.status}, ריטיינר: ₪${client.monthlyRetainer}, דירוג: ${client.rating}`,
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
    if (!client?.phone || !user) return;
    const phone = formatPhoneForWhatsApp(client.phone).replace('+', '');
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');

    const purposeObj = MESSAGE_PURPOSES.find(p => p.key === waMessagePurpose);
    await addWhatsAppMessage({
      clientId: client.clientId,
      messageText,
      messagePurpose: purposeObj?.label || waMessagePurpose,
      phoneNumber: client.phone,
      sentBy: user.id,
      sentByName: currentUserName,
      isAiGenerated,
    });
  };

  // Audio: Upload recording for transcription
  const handleUploadRecording = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client || !user) return;
    setIsTranscribing(true);
    setTranscribeError(null);
    try {
      // 1. Upload to storage
      const uploadResult = await uploadRecording('client', client.clientId, file);
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
          entityName: client.clientName,
          businessName: client.businessName,
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
        clientId: client.clientId,
        callDate: new Date().toISOString().split('T')[0],
        participants: `ניב, ${client.clientName}`,
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
            entityName: client.businessName || client.clientName,
            additionalContext: `סטטוס: ${client.status}, ריטיינר: ₪${client.monthlyRetainer}, דירוג: ${client.rating}`,
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
            await addClientNote(client.clientId, sResult.summary, user.id, currentUserName, 'transcript_summary', transcriptId);
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
    if (!client || !user) return;
    // Check for duplicate
    if (clientAISummaries.find(n => n.sourceId === sourceId)) return;
    setIsGeneratingSummary(true);
    setSummaryError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body: Record<string, string> = {
        summaryType,
        entityName: client.businessName || client.clientName,
        additionalContext: `סטטוס: ${client.status}, ריטיינר: ₪${client.monthlyRetainer}, דירוג: ${client.rating}`,
      };
      if (summaryType === 'transcript_summary') {
        body.transcript = sourceText;
        if (existingSummary) body.transcriptSummary = existingSummary;
      } else if (summaryType === 'proposal_focus') {
        body.transcript = sourceText;
        if (existingSummary) body.transcriptSummary = existingSummary;
        // Also include latest recommendation if available for richer context
        const latestRec = clientRecommendations[0];
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
        await addClientNote(client.clientId, result.summary, user.id, currentUserName, summaryType as NoteType, sourceId);
      } else {
        setSummaryError(result.error || 'שגיאה ביצירת סיכום AI');
      }
    } catch {
      setSummaryError('שגיאת רשת - ודא שמפתח Gemini API מוגדר בהגדרות');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const client = clients.find(c => c.clientId === clientId);

  if (!client) {
    return (
      <div className="space-y-6">
        <Button onClick={() => navigate('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה ללקוחות</Button>
        <Card>
          <p className="text-gray-400 text-center py-12">לקוח לא נמצא</p>
        </Card>
      </div>
    );
  }

  const clientDeals = oneTimeDeals.filter(d => d.clientId === clientId);
  const clientExpenses = expenses.filter(e => e.clientId === clientId);
  const clientPayments = payments.filter(p => p.clientId === clientId);
  const clientRetainerHistory = retainerHistory.filter(rc => rc.clientId === clientId);

  const monthlyProfit = client.monthlyRetainer - client.supplierCostMonthly;
  const totalDealValue = clientDeals.reduce((sum, d) => sum + d.dealAmount, 0);
  const totalExpenses = clientExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = clientPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalOwed = clientPayments.reduce((sum, p) => sum + (p.amountDue - p.amountPaid), 0);

  const activeServiceKeys = client.services || [];
  const activeServiceLabels = services
    .filter(s => activeServiceKeys.includes(s.serviceKey))
    .map(s => s.label);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה</Button>
        <div className="flex-1">
          <h2 className="text-3xl font-black text-white tracking-tight">{client.businessName}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-400">{client.clientName}</span>
            {getUserName(client.assignedTo) && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10">
                <User size={12} className="text-violet-400" />
                <span className="text-violet-400 text-xs">{getUserName(client.assignedTo)}</span>
              </div>
            )}
          </div>
        </div>
        <select
          value={client.status}
          onChange={e => handleStatusChange(e.target.value)}
          className="bg-[#0B1121] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none cursor-pointer"
        >
          {Object.values(ClientStatus).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={client.rating}
          onChange={e => handleRatingChange(e.target.value)}
          className="bg-[#0B1121] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 outline-none cursor-pointer"
        >
          {Object.values(ClientRating).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {isAdmin && (
          <Button onClick={openEditModal} variant="ghost" icon={<Edit3 size={16} />}>
            עריכת לקוח
          </Button>
        )}
      </div>

      {/* Contact + Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader title="פרטי קשר" />
          <div className="space-y-4 mt-4">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-primary" />
                <a href={`tel:${client.phone}`} className="text-primary hover:underline">{client.phone}</a>
                <a href={`https://wa.me/${formatPhoneForWhatsApp(client.phone).replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all" title="WhatsApp">
                  <MessageCircle size={14} />
                </a>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-gray-400" />
                <span className="text-gray-300">{client.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-gray-300">הצטרף: {formatDate(client.joinDate)}</span>
            </div>
            {client.industry && (
              <div className="flex items-center gap-3">
                <Star size={16} className="text-gray-400" />
                <span className="text-gray-300">תעשייה: {client.industry}</span>
              </div>
            )}
            {client.notes && (
              <div className="pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">הערות</p>
                {client.notes.length > NOTES_PREVIEW_LENGTH ? (
                  <>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">
                      {notesExpanded ? client.notes : client.notes.substring(0, NOTES_PREVIEW_LENGTH) + '...'}
                    </p>
                    <button
                      onClick={() => setNotesExpanded(!notesExpanded)}
                      className="text-primary text-xs mt-1 hover:underline flex items-center gap-1"
                    >
                      {notesExpanded ? <><ChevronUp size={12} /> הצג פחות</> : <><ChevronDown size={12} /> הצג עוד</>}
                    </button>
                  </>
                ) : (
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{client.notes}</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Financial Summary */}
        <Card className="lg:col-span-2">
          <CardHeader title="סיכום פיננסי" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">ריטיינר חודשי</div>
              <div className="text-xl font-bold text-white font-mono mt-1">{formatCurrency(client.monthlyRetainer)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">עלות ספקים</div>
              <div className="text-xl font-bold text-red-400 font-mono mt-1">{formatCurrency(client.supplierCostMonthly)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">רווח חודשי</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{formatCurrency(monthlyProfit)}</div>
            </div>
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">חוב פתוח</div>
              <div className={`text-xl font-bold font-mono mt-1 ${totalOwed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(totalOwed)}</div>
            </div>
          </div>

          {/* Services */}
          {activeServiceLabels.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">שירותים פעילים</p>
              <div className="flex flex-wrap gap-2">
                {activeServiceLabels.map(label => (
                  <Badge key={label} variant="primary">{label}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Notes History (manual only — AI summaries shown in separate section) */}
      <Card>
        <CardHeader title="הערות והיסטוריה" subtitle={`${clientNotesFiltered.length} הערות`} />
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
          {clientNotesFiltered.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6 italic">אין הערות עדיין. הוסף הערה ראשונה למעלה.</p>
          ) : (
            clientNotesFiltered.map(note => (
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
          <CardHeader title="תמלולי שיחות" subtitle={`${clientTranscripts.length} תמלולים`} />
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

        {clientTranscripts.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-6 italic">אין תמלולי שיחות עדיין.</p>
        ) : (
          <div className="space-y-4">
            {clientTranscripts.map(ct => {
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
          <CardHeader title="המלצות AI" subtitle={clientRecommendations.length > 0 ? `${clientRecommendations.length} המלצות` : 'מנוע Gemini'} />
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
        {clientRecommendations.length > 0 ? (
          <div className="space-y-3">
            {clientRecommendations.map(rec => {
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
          <CardHeader title="סיכומי AI" subtitle={clientAISummaries.length > 0 ? `${clientAISummaries.length} סיכומים` : 'סיכומים אוטומטיים'} />
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
        {clientAISummaries.length > 0 ? (
          <div className="space-y-3">
            {clientAISummaries.map(summary => {
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
            {clientTranscripts.length > 0 && (
              <Button
                onClick={() => {
                  const latestTranscript = clientTranscripts[0];
                  if (latestTranscript) {
                    handleGenerateAISummary('transcript_summary', latestTranscript.id, latestTranscript.transcript, latestTranscript.summary);
                  }
                }}
                disabled={isGeneratingSummary || (clientTranscripts.length > 0 && !!clientAISummaries.find(n => n.sourceId === clientTranscripts[0]?.id))}
                variant="ghost"
                icon={<FileText size={14} />}
              >
                צור סיכום תמלול
              </Button>
            )}
            {clientRecommendations.length > 0 && (
              <Button
                onClick={() => {
                  const latestRec = clientRecommendations[0];
                  if (latestRec) {
                    handleGenerateAISummary('recommendation_summary', latestRec.id, latestRec.recommendation);
                  }
                }}
                disabled={isGeneratingSummary || (clientRecommendations.length > 0 && !!clientAISummaries.find(n => n.sourceId === clientRecommendations[0]?.id))}
                variant="ghost"
                icon={<Sparkles size={14} />}
              >
                צור סיכום המלצות
              </Button>
            )}
            {clientTranscripts.length > 0 && (
              <Button
                onClick={() => {
                  const latestTranscript = clientTranscripts[0];
                  if (latestTranscript) {
                    handleGenerateAISummary('proposal_focus', `pf_${latestTranscript.id}`, latestTranscript.transcript, latestTranscript.summary);
                  }
                }}
                disabled={isGeneratingSummary || (clientTranscripts.length > 0 && !!clientAISummaries.find(n => n.sourceId === `pf_${clientTranscripts[0]?.id}`))}
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
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            title="הודעות WhatsApp"
            subtitle={clientWAMessages.length > 0 ? `${clientWAMessages.length} הודעות${clientWAMessages[0] ? ` · אחרונה: ${formatDate(clientWAMessages[0].sentAt)}` : ''}` : 'שלח הודעות ללקוח'}
          />
        </div>

        {!client?.phone ? (
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
            {clientWAMessages.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">היסטוריית הודעות ({clientWAMessages.length})</p>
                {clientWAMessages.map(msg => {
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
                            <Badge variant={msg.isAiGenerated ? 'info' : 'default'}>{msg.messagePurpose}</Badge>
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

      {/* Deals History */}
      {clientDeals.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="פרויקטים" subtitle={`${clientDeals.length} פרויקטים | סה"כ ${formatCurrency(totalDealValue)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>שם</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>סטטוס</TableHead>
            </TableHeader>
            <TableBody>
              {clientDeals.map(deal => (
                <TableRow key={deal.dealId}>
                  <TableCell className="font-medium text-white">{deal.dealName}</TableCell>
                  <TableCell className="text-gray-400">{deal.dealType}</TableCell>
                  <TableCell className="text-white font-mono">{formatCurrency(deal.dealAmount)}</TableCell>
                  <TableCell className="text-gray-400">{formatDate(deal.dealDate)}</TableCell>
                  <TableCell><Badge variant="neutral">{deal.dealStatus}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Expenses History */}
      {clientExpenses.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="הוצאות" subtitle={`${clientExpenses.length} הוצאות | סה"כ ${formatCurrency(totalExpenses)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>תאריך</TableHead>
              <TableHead>ספק</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
            </TableHeader>
            <TableBody>
              {clientExpenses.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime()).map(exp => (
                <TableRow key={exp.expenseId}>
                  <TableCell className="text-gray-400">{formatDate(exp.expenseDate)}</TableCell>
                  <TableCell className="font-medium text-white">{exp.supplierName}</TableCell>
                  <TableCell className="text-gray-400">{exp.expenseType}</TableCell>
                  <TableCell className="text-red-400 font-mono font-bold">{formatCurrency(exp.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Payment History */}
      {clientPayments.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="היסטוריית תשלומים" subtitle={`שולם: ${formatCurrency(totalPaid)} | חוב: ${formatCurrency(totalOwed)}`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>חודש</TableHead>
              <TableHead>חוב</TableHead>
              <TableHead>שולם</TableHead>
              <TableHead>יתרה</TableHead>
              <TableHead>סטטוס</TableHead>
            </TableHeader>
            <TableBody>
              {clientPayments.sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)).map(pay => (
                <TableRow key={pay.paymentId}>
                  <TableCell className="text-gray-300">{getMonthName(pay.periodMonth)}</TableCell>
                  <TableCell className="text-white font-mono">{formatCurrency(pay.amountDue)}</TableCell>
                  <TableCell className="text-emerald-400 font-mono">{formatCurrency(pay.amountPaid)}</TableCell>
                  <TableCell className="text-red-400 font-mono">{formatCurrency(pay.amountDue - pay.amountPaid)}</TableCell>
                  <TableCell>
                    <Badge variant={pay.paymentStatus === 'Paid' ? 'success' : pay.paymentStatus === 'Partial' ? 'warning' : 'danger'}>
                      {pay.paymentStatus === 'Paid' ? 'שולם' : pay.paymentStatus === 'Partial' ? 'חלקי' : 'לא שולם'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Retainer Change History */}
      {clientRetainerHistory.length > 0 && (
        <Card noPadding>
          <div className="p-6 pb-2">
            <CardHeader title="היסטוריית שינויי ריטיינר" subtitle={`${clientRetainerHistory.length} שינויים`} />
          </div>
          <Table>
            <TableHeader>
              <TableHead>תאריך</TableHead>
              <TableHead>ריטיינר ישן</TableHead>
              <TableHead>ריטיינר חדש</TableHead>
              <TableHead>עלות ספקים ישנה</TableHead>
              <TableHead>עלות ספקים חדשה</TableHead>
            </TableHeader>
            <TableBody>
              {clientRetainerHistory.map(rc => (
                <TableRow key={rc.id}>
                  <TableCell className="text-gray-400">{formatDate(rc.changedAt)}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{formatCurrency(rc.oldRetainer)}</TableCell>
                  <TableCell className="text-white font-mono font-bold">{formatCurrency(rc.newRetainer)}</TableCell>
                  <TableCell className="text-gray-400 font-mono">{formatCurrency(rc.oldSupplierCost)}</TableCell>
                  <TableCell className="text-white font-mono font-bold">{formatCurrency(rc.newSupplierCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Activity Timeline */}
      {clientActivities.length > 0 && (
        <Card>
          <CardHeader title="היסטוריית פעילות" subtitle={`${clientActivities.length} פעולות אחרונות`} />
          <div className="mt-4 space-y-3">
            {clientActivities.map(activity => (
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

      {/* Client Files / Contracts */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="קבצים והסכמים" subtitle={`${clientFiles.length} קבצים`} />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload size={16} />}
              disabled={isUploading}
            >
              {isUploading ? 'מעלה...' : 'העלאת קובץ'}
            </Button>
          </div>
        </div>

        {clientFiles.length > 0 ? (
          <div className="space-y-2">
            {clientFiles.map(file => (
              <div key={file.name} className="flex items-center justify-between p-3 rounded-lg bg-[#0B1121] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText size={18} className="text-primary shrink-0" />
                  <span className="text-white text-sm truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                    title="פתח קובץ"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={() => setConfirmDeleteFile(file.name)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="מחק קובץ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-6 italic">אין קבצים. העלה הסכמים, חשבוניות או מסמכים.</p>
        )}
      </Card>

      {/* Confirm Delete File Modal */}
      <Modal isOpen={!!confirmDeleteFile} onClose={() => setConfirmDeleteFile(null)} title="מחיקת קובץ" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את הקובץ &quot;{confirmDeleteFile}&quot;?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteFile(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={() => confirmDeleteFile && handleDeleteFile(confirmDeleteFile)}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Note Modal */}
      <Modal isOpen={!!confirmDeleteNoteId} onClose={() => setConfirmDeleteNoteId(null)} title="מחיקת הערה" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את ההערה?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteNoteId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteNoteId) { await deleteClientNote(confirmDeleteNoteId); setConfirmDeleteNoteId(null); } }}>מחק</Button>
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
            <Button type="button" variant="danger" onClick={async () => { if (confirmDeleteSummaryId) { await deleteClientNote(confirmDeleteSummaryId); setConfirmDeleteSummaryId(null); } }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Client Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="עריכת לקוח" size="xl">
        {editFormData && (
          <form onSubmit={handleEditSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Personal Details */}
              <div className="space-y-6">
                <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">פרטים אישיים</h4>
                <div className="space-y-4">
                  <Input label="שם העסק" required value={editFormData.businessName || ''} onChange={e => setEditFormData({...editFormData, businessName: e.target.value})} />
                  <Input label="שם מלא" required value={editFormData.clientName || ''} onChange={e => setEditFormData({...editFormData, clientName: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="טלפון" required value={editFormData.phone || ''} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} />
                    <Input label="אימייל" type="email" value={editFormData.email || ''} onChange={e => setEditFormData({...editFormData, email: e.target.value})} />
                  </div>
                  <Input label="תעשייה" value={editFormData.industry || ''} onChange={e => setEditFormData({...editFormData, industry: e.target.value})} />
                </div>
              </div>
              {/* Business Details */}
              <div className="space-y-6">
                <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">פרטים עסקיים</h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="סטטוס" value={editFormData.status || ''} onChange={e => setEditFormData({...editFormData, status: e.target.value as ClientStatus})}>
                      {Object.values(ClientStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                    <Select label="דירוג הלקוח" value={editFormData.rating || ''} onChange={e => setEditFormData({...editFormData, rating: e.target.value as ClientRating})}>
                      {Object.values(ClientRating).map(r => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="ריטיינר חודשי (₪)" type="number" value={editFormData.monthlyRetainer ?? ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setEditFormData({...editFormData, monthlyRetainer: Number(e.target.value) || 0})} />
                    <Input label="עלות ספקים (₪)" type="number" value={editFormData.supplierCostMonthly ?? ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setEditFormData({...editFormData, supplierCostMonthly: Number(e.target.value) || 0})} />
                  </div>
                  <Input label="תאריך הצטרפות" type="date" value={editFormData.joinDate ? new Date(editFormData.joinDate).toISOString().split('T')[0] : ''} onChange={e => setEditFormData({...editFormData, joinDate: e.target.value})} />
                  <Input label="תאריך נטישה" type="date" value={editFormData.churnDate ? new Date(editFormData.churnDate).toISOString().split('T')[0] : ''} onChange={e => setEditFormData({...editFormData, churnDate: e.target.value || undefined})} />
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="רמת מאמץ" value={editFormData.effortLevel || ''} onChange={e => setEditFormData({...editFormData, effortLevel: e.target.value as EffortLevel})}>
                      {Object.values(EffortLevel).map(el => <option key={el} value={el}>{el}</option>)}
                    </Select>
                    <Input label="יום חיוב" type="number" min={1} max={31} value={editFormData.billingDay ?? 1} onChange={e => setEditFormData({...editFormData, billingDay: Number(e.target.value) || 1})} />
                  </div>
                </div>
              </div>
            </div>
            {/* Services & Handler */}
            <div className="space-y-6">
              <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">שירותים ומטפל</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {services.filter(s => s.isActive).map(service => (
                  <Checkbox
                    key={service.serviceKey}
                    label={service.label}
                    checked={editFormData.services?.includes(service.serviceKey) || false}
                    onChange={(checked) => {
                      const current = editFormData.services || [];
                      if (checked) setEditFormData({...editFormData, services: [...current, service.serviceKey]});
                      else setEditFormData({...editFormData, services: current.filter((k: string) => k !== service.serviceKey)});
                    }}
                  />
                ))}
              </div>
              <Select label="מטפל אחראי" value={editFormData.assignedTo || ''} onChange={e => setEditFormData({...editFormData, assignedTo: e.target.value || undefined})}>
                <option value="">לא משויך</option>
                {allUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.display_name} ({u.role === 'admin' ? 'מנהל' : 'צופה'})</option>
                ))}
              </Select>
              <Textarea label="הערות" value={editFormData.notes || ''} onChange={e => setEditFormData({...editFormData, notes: e.target.value})} />
            </div>
            <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>ביטול</Button>
              <Button type="submit">שמור לקוח</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default ClientProfile;
