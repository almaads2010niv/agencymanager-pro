import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantNav } from '../hooks/useTenantNav';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import type { ClientFile } from '../contexts/DataContext';
import { ClientStatus, ClientRating, EffortLevel, NoteType, Archetype, BusinessIntelV2, ScriptDoor } from '../types';
import type { Client, StrategyPlan } from '../types';
import { formatCurrency, formatDate, formatDateTime, getMonthName, formatPhoneForWhatsApp } from '../utils';
import { ArrowRight, Phone, Mail, Calendar, Star, Upload, FileText, Trash2, ExternalLink, MessageCircle, User, Send, Clock, ChevronDown, ChevronUp, Sparkles, Plus, Mic, Edit3, Target, Brain, Shield, Zap, AlertTriangle, MessageSquare, ListChecks, CheckCircle, Users, Printer, Globe, Link2, Copy, Check } from 'lucide-react';
import { MESSAGE_PURPOSES } from '../constants';
import { getBrandConfig, generateWorkPlanPdf, generateFinancialSummaryPdf, generatePersonalityPdf, generateStrategyPdf } from '../utils/pdfGenerator';
import { generateAnimatedStrategy, buildAnimatedStrategyHtml } from '../utils/animatedStrategy';
import { supabase } from '../lib/supabaseClient';
import { Input, Textarea, Select, Checkbox } from './ui/Form';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from './ui/Table';
import VoiceRecorderButton from './VoiceRecorderButton';
import SectionReorder from './SectionReorder';
import { useSectionOrder } from '../hooks/useSectionOrder';

const ClientProfile: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { tn } = useTenantNav();
  const { user, displayName: currentUserName, allUsers, isAdmin } = useAuth();
  const {
    clients, oneTimeDeals, expenses, payments, services, retainerHistory,
    uploadClientFile, listClientFiles, deleteClientFile,
    clientNotes, addClientNote, deleteClientNote, updateClient, activities,
    callTranscripts, addCallTranscript, deleteCallTranscript,
    aiRecommendations, addAIRecommendation, deleteAIRecommendation, settings,
    whatsappMessages, addWhatsAppMessage, deleteWhatsAppMessage, uploadRecording,
    signalsPersonalities, competitorReports, runCompetitorScout, deleteCompetitorReport,
    strategyPlans, addStrategyPlan, updateStrategyPlan, deleteStrategyPlan, publishStrategyPage
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

  // Signals OS V2 state
  const [v2ScriptExpanded, setV2ScriptExpanded] = useState(false);
  const [v2ActiveDoor, setV2ActiveDoor] = useState<string | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutExpanded, setScoutExpanded] = useState(false);
  // PDF dropdown state
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const pdfDropdownRef = useRef<HTMLDivElement>(null);

  // Strategy state
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [expandedStrategyId, setExpandedStrategyId] = useState<string | null>(null);
  const [confirmDeleteStrategyId, setConfirmDeleteStrategyId] = useState<string | null>(null);
  const [editingStrategyId, setEditingStrategyId] = useState<string | null>(null);
  const [editStrategyData, setEditStrategyData] = useState<import('../types').StrategyPlanData | null>(null);
  const [isPublishingStrategy, setIsPublishingStrategy] = useState<string | null>(null);
  const [copiedStrategyUrl, setCopiedStrategyUrl] = useState<string | null>(null);

  // AI Notebook state
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [notebookMessages, setNotebookMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [notebookInput, setNotebookInput] = useState('');
  const [notebookLoading, setNotebookLoading] = useState(false);
  const notebookEndRef = useRef<HTMLDivElement>(null);

  // Section reorder
  const CLIENT_SECTIONS = [
    { id: 'notes', label: 'הערות והיסטוריה' },
    { id: 'transcripts', label: 'תמלולי שיחות' },
    { id: 'ai-recommendations', label: 'המלצות AI' },
    { id: 'ai-summaries', label: 'סיכומי AI' },
    { id: 'signals', label: 'Signals OS' },
    { id: 'competitor', label: 'סקאוט תחרותי' },
    { id: 'whatsapp', label: 'הודעות WhatsApp' },
    { id: 'notebook', label: 'AI Notebook' },
    { id: 'strategy', label: 'אסטרטגיה ותוכנית עבודה' },
    { id: 'financial', label: 'פרויקטים והוצאות' },
    { id: 'activity', label: 'היסטוריית פעילות' },
    { id: 'files', label: 'קבצים והסכמים' },
  ];
  const DEFAULT_CLIENT_ORDER = CLIENT_SECTIONS.map(s => s.id);
  const { sectionOrder: clientSectionOrder, setOrder: setClientOrder, resetOrder: resetClientOrder, getOrder: getClientOrder } = useSectionOrder('client', DEFAULT_CLIENT_ORDER);

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

  // Close PDF dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(e.target as Node)) {
        setPdfDropdownOpen(false);
      }
    };
    if (pdfDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pdfDropdownOpen]);

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
        const debugInfo = result.debug ? ` [debug: ${result.debug.substring(0, 100)}]` : '';
        setWaError((result.error || 'שגיאה ביצירת הודעות') + debugInfo);
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

  // Strategy: Generate
  const handleGenerateStrategy = async () => {
    if (!client || !user) return;
    setIsGeneratingStrategy(true);
    setStrategyError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ entityId: clientId, entityType: 'client' }),
        }
      );
      const result = await res.json();
      if (result.success && (result.plan || result.rawText)) {
        await addStrategyPlan({
          clientId: client.clientId,
          entityName: client.businessName || client.clientName,
          planData: result.plan || { summary: '', situationAnalysis: { whatsWorking: [], whatsNotWorking: [], dependencies: [], risks: [], opportunities: [] }, actionPlan: [], kpis: [] },
          rawText: result.rawText,
          createdBy: user.id,
          createdByName: currentUserName,
        });
      } else {
        setStrategyError(result.error || 'שגיאה ביצירת אסטרטגיה');
      }
    } catch {
      setStrategyError('שגיאת רשת — ודא שמפתח Gemini API מוגדר בהגדרות');
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  // AI Notebook: Send message
  const handleNotebookSend = async () => {
    if (!notebookInput.trim() || notebookLoading || !clientId) return;
    const userMessage = notebookInput.trim();
    setNotebookInput('');
    setNotebookMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setNotebookLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-notebook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            entityId: clientId,
            entityType: 'client',
            message: userMessage,
            chatHistory: notebookMessages.slice(-10),
          }),
        }
      );

      const result = await response.json();
      if (result.success && result.reply) {
        setNotebookMessages(prev => [...prev, { role: 'assistant', content: result.reply }]);
      } else {
        setNotebookMessages(prev => [...prev, { role: 'assistant', content: `❌ ${result.error || 'שגיאה'}` }]);
      }
    } catch {
      setNotebookMessages(prev => [...prev, { role: 'assistant', content: '❌ שגיאה בתקשורת עם AI' }]);
    } finally {
      setNotebookLoading(false);
      setTimeout(() => notebookEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
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
        <Button onClick={() => tn('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה ללקוחות</Button>
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

  // ── LTV Calculation ──
  const joinDateMs = new Date(client.joinDate).getTime();
  const nowMs = Date.now();
  const monthsActive = Math.max(1, Math.round((nowMs - joinDateMs) / (1000 * 60 * 60 * 24 * 30.44)));
  const cumulativeRetainer = client.monthlyRetainer * monthsActive;
  const ltv = cumulativeRetainer + totalDealValue;

  // ── Unified Purchase History Timeline ──
  type PurchaseEntry = { date: string; description: string; amount: number; type: 'retainer' | 'deal' | 'payment'; status?: string };
  const purchaseHistory: PurchaseEntry[] = [
    ...clientDeals.map(d => ({ date: d.dealDate, description: `פרויקט: ${d.dealName}`, amount: d.dealAmount, type: 'deal' as const, status: d.dealStatus })),
    ...clientPayments.map(p => ({ date: p.paymentDate || p.periodMonth, description: `תשלום חודשי — ${getMonthName(p.periodMonth)}`, amount: p.amountPaid, type: 'payment' as const, status: p.paymentStatus })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Signals OS Personality (for V2 scripts) ──
  const personality = signalsPersonalities.find(p => p.clientId === clientId);
  const v2 = personality?.businessIntelV2 || null;

  const ARCHETYPE_CONFIG: Record<string, { nameHe: string; color: string; bgColor: string; borderColor: string; barColor: string; icon: string }> = {
    WINNER:  { nameHe: 'ווינר',  color: 'text-red-400',    bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/20',    barColor: '#ef4444', icon: '🏆' },
    STAR:    { nameHe: 'סטאר',   color: 'text-amber-400',  bgColor: 'bg-amber-500/10',  borderColor: 'border-amber-500/20',  barColor: '#f59e0b', icon: '⭐' },
    DREAMER: { nameHe: 'חולם',   color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20', barColor: '#8b5cf6', icon: '💫' },
    HEART:   { nameHe: 'לב',     color: 'text-pink-400',   bgColor: 'bg-pink-500/10',   borderColor: 'border-pink-500/20',   barColor: '#ec4899', icon: '❤️' },
    ANCHOR:  { nameHe: 'עוגן',   color: 'text-cyan-400',   bgColor: 'bg-cyan-500/10',   borderColor: 'border-cyan-500/20',   barColor: '#06b6d4', icon: '⚓' },
  };

  const activeServiceKeys = client.services || [];
  const activeServiceLabels = services
    .filter(s => activeServiceKeys.includes(s.serviceKey))
    .map(s => s.label);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button onClick={() => tn('/clients')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה</Button>
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
        {/* PDF Export Dropdown */}
        <div className="relative" ref={pdfDropdownRef}>
          <Button
            variant="ghost"
            icon={<Printer size={16} />}
            className={`${pdfDropdownOpen ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setPdfDropdownOpen(!pdfDropdownOpen)}
          >
            ייצוא PDF
          </Button>
          {pdfDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 bg-[#0D1526] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[200px] z-[60]">
              <button
                onClick={() => {
                  setPdfDropdownOpen(false);
                  const brand = getBrandConfig(settings);
                  generateWorkPlanPdf({
                    client,
                    services: client.services.map(sk => {
                      const svc = services.find(s => s.serviceKey === sk);
                      return svc ? svc.label : sk;
                    }),
                    deals: clientDeals,
                    monthlyPayments: clientPayments,
                  }, brand);
                }}
                className="w-full text-right px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <FileText size={14} className="text-blue-400" />
                📋 תוכנית עבודה
              </button>
              <button
                onClick={() => {
                  setPdfDropdownOpen(false);
                  const brand = getBrandConfig(settings);
                  const nowMs = Date.now();
                  const joinMs = new Date(client.joinDate).getTime();
                  const months = Math.max(1, Math.round((nowMs - joinMs) / (1000 * 60 * 60 * 24 * 30.44)));
                  const totalDealValue = clientDeals.reduce((s, d) => s + d.dealAmount, 0);
                  const cumRetainer = client.monthlyRetainer * months;
                  generateFinancialSummaryPdf({
                    client,
                    deals: clientDeals,
                    payments: clientPayments,
                    expenses: clientExpenses.map(e => ({ date: e.expenseDate, supplier: e.supplierName, amount: e.amount, type: e.expenseType })),
                    monthsActive: months,
                    ltv: cumRetainer + totalDealValue,
                  }, brand);
                }}
                className="w-full text-right px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <FileText size={14} className="text-emerald-400" />
                💰 סיכום כספי
              </button>
              {personality?.businessIntelV2 && (
                <button
                  onClick={() => {
                    setPdfDropdownOpen(false);
                    const brand = getBrandConfig(settings);
                    if (personality) {
                      generatePersonalityPdf({
                        personality,
                        entityName: client.clientName,
                        entityType: 'client',
                      }, brand);
                    }
                  }}
                  className="w-full text-right px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Brain size={14} className="text-purple-400" />
                  🧠 דוח אישיותי
                </button>
              )}
            </div>
          )}
        </div>
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
            {/* Social & Web URLs — always show */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">קישורים</span>
              <div className="flex flex-wrap items-center gap-2">
                {client.facebookUrl ? (
                  <a href={client.facebookUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs transition-all">
                    <Globe size={12} /> Facebook <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...client }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-blue-500/30 text-blue-400/50 hover:text-blue-400 hover:border-blue-500/50 text-xs transition-all">
                    <Plus size={10} /> Facebook
                  </button>
                )}
                {client.instagramUrl ? (
                  <a href={client.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 text-xs transition-all">
                    <Globe size={12} /> Instagram <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...client }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-pink-500/30 text-pink-400/50 hover:text-pink-400 hover:border-pink-500/50 text-xs transition-all">
                    <Plus size={10} /> Instagram
                  </button>
                )}
                {client.websiteUrl ? (
                  <a href={client.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs transition-all">
                    <Globe size={12} /> אתר <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...client }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-cyan-500/30 text-cyan-400/50 hover:text-cyan-400 hover:border-cyan-500/50 text-xs transition-all">
                    <Plus size={10} /> אתר
                  </button>
                )}
              </div>
            </div>
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

      {/* Section Reorder Controls */}
      <SectionReorder
        sections={CLIENT_SECTIONS}
        order={clientSectionOrder}
        onReorder={setClientOrder}
        onReset={resetClientOrder}
      />

      {/* Sortable sections container */}
      <div className="flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* Notes History (manual only — AI summaries shown in separate section) */}
      <div style={{ order: getClientOrder('notes') }}>
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
      </div>{/* end notes order wrapper */}

      {/* Call Transcripts Section */}
      <div style={{ order: getClientOrder('transcripts') }}>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="תמלולי שיחות" subtitle={`${clientTranscripts.length} תמלולים`} />
          <div className="flex items-center gap-2">
            {settings.hasGeminiKey && (
              <>
                <VoiceRecorderButton
                  entityType="client"
                  entityId={clientId!}
                  entityName={client.clientName}
                  businessName={client.businessName}
                  disabled={isTranscribing}
                />
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
      </div>{/* end transcripts order wrapper */}

      {/* AI Recommendations */}
      <div style={{ order: getClientOrder('ai-recommendations') }}>
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
      </div>{/* end ai-recommendations order wrapper */}

      {/* AI Summaries Section */}
      <div style={{ order: getClientOrder('ai-summaries') }}>
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
      </div>{/* end ai-summaries order wrapper */}

      <div style={{ order: getClientOrder('whatsapp') }}>
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

      {/* ============ LTV & Purchase History ============ */}
      <Card>
        <CardHeader title="ערך לקוח (LTV)" subtitle={`${monthsActive} חודשים פעילים`} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="p-4 bg-gradient-to-bl from-violet-500/10 to-blue-500/5 rounded-xl border border-violet-500/15">
            <div className="text-[10px] text-gray-500 uppercase">LTV כולל</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{formatCurrency(ltv)}</div>
          </div>
          <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase">ריטיינר מצטבר</div>
            <div className="text-lg font-bold text-blue-400 font-mono mt-1">{formatCurrency(cumulativeRetainer)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{formatCurrency(client.monthlyRetainer)} × {monthsActive} חודשים</div>
          </div>
          <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase">פרויקטים (חד פעמי)</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{formatCurrency(totalDealValue)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{clientDeals.length} פרויקטים</div>
          </div>
          <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase">שולם בפועל</div>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{formatCurrency(totalPaid)}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{totalOwed > 0 ? `חוב: ${formatCurrency(totalOwed)}` : 'ללא חוב'}</div>
          </div>
        </div>

        {/* Purchase History Timeline */}
        {purchaseHistory.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">היסטוריית רכישות</p>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
              {purchaseHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    entry.type === 'deal' ? 'bg-emerald-400' : 'bg-blue-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 truncate">{entry.description}</p>
                    <span className="text-[10px] text-gray-600">{formatDate(entry.date)}</span>
                  </div>
                  <span className={`font-mono text-sm font-bold shrink-0 ${
                    entry.type === 'deal' ? 'text-emerald-400' : 'text-blue-400'
                  }`}>
                    {formatCurrency(entry.amount)}
                  </span>
                  {entry.status && (
                    <Badge variant={entry.status === 'Paid' || entry.status === 'Completed' ? 'success' : entry.status === 'Partial' ? 'warning' : 'neutral'}>
                      {entry.status === 'Paid' ? 'שולם' : entry.status === 'Partial' ? 'חלקי' : entry.status === 'Completed' ? 'הושלם' : entry.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      </div>{/* end whatsapp order wrapper */}

      <div style={{ order: getClientOrder('signals') }}>
      {/* ============ Signals OS V2 — Dynamic Call Script (Step 3) ============ */}
      {v2 && (() => {
        const hero = v2.heroCard;
        const qs = v2.quickScript;
        const actions = v2.actionItems || [];
        const flags = v2.redFlags || [];
        const script = v2.fullScript;
        const primaryCfg = personality ? ARCHETYPE_CONFIG[personality.primaryArchetype] || ARCHETYPE_CONFIG.WINNER : ARCHETYPE_CONFIG.WINNER;

        return (
          <Card id="client-script-section">
            <CardHeader
              title={<span className="flex items-center gap-2"><Brain size={18} className="text-violet-400" /> מודיעין אישיותי + תסריט שיחה</span>}
              subtitle={personality ? `${primaryCfg.icon} ${primaryCfg.nameHe} · סיכוי סגירה ${hero.closeRate}%` : undefined}
            />

            <div className="mt-4 space-y-3">
              {/* Hero Card */}
              <div className="p-4 rounded-xl bg-gradient-to-l from-violet-500/5 via-blue-500/5 to-cyan-500/5 border border-violet-500/15">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-200 font-medium leading-relaxed">{hero.profileLine}</p>
                    {hero.riskExplanation && (
                      <p className="text-xs text-gray-500 mt-1">{hero.riskExplanation}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 ms-4 shrink-0">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: hero.priorityStars || 0 }).map((_, i) => (
                        <Star key={i} size={12} className="text-amber-400 fill-amber-400" />
                      ))}
                      {Array.from({ length: 5 - (hero.priorityStars || 0) }).map((_, i) => (
                        <Star key={`e${i}`} size={12} className="text-gray-700" />
                      ))}
                    </div>
                    <div className="text-xl font-bold text-emerald-400">{hero.closeRate}%</div>
                    <span className="text-[10px] text-gray-500">סיכוי סגירה</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hero.urgency && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 text-xs border border-amber-500/15">
                      <Zap size={11} /> {hero.urgency}
                    </span>
                  )}
                  {hero.topStrength && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs border border-emerald-500/15">
                      <CheckCircle size={11} /> {hero.topStrength}
                    </span>
                  )}
                  {hero.topRisk && (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-red-300 text-xs border border-red-500/15">
                      <AlertTriangle size={11} /> {hero.topRisk}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Script */}
              {qs && (
                <div className="p-4 rounded-xl bg-[#0B1121] border border-blue-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare size={14} className="text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">תסריט מהיר</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex gap-2"><span className="text-xs text-blue-400 w-16 shrink-0 font-medium">פתיחה</span><span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.opener}</span></div>
                    <div className="flex gap-2"><span className="text-xs text-blue-400 w-16 shrink-0 font-medium">שאלת מפתח</span><span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.keyQuestion}</span></div>
                    <div className="flex gap-2"><span className="text-xs text-blue-400 w-16 shrink-0 font-medium">סגירה</span><span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.closeLine}</span></div>
                  </div>
                </div>
              )}

              {/* Action Items */}
              {actions.length > 0 && (
                <div className="p-4 rounded-xl bg-[#0B1121] border border-emerald-500/15">
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks size={14} className="text-emerald-400" />
                    <span className="text-sm font-medium text-gray-200">פעולות מומלצות</span>
                  </div>
                  <div className="space-y-3">
                    {actions.map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{item.priority}</div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-200 font-medium">{item.action}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.why}</p>
                          {item.how && <p className="text-xs text-emerald-400/70 mt-0.5">{item.how}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {flags.length > 0 && (
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-red-400" />
                    <span className="text-xs font-medium text-red-300">דגלים אדומים</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {flags.map((flag, i) => (
                      <span key={i} className="px-2 py-1 rounded-md bg-red-500/10 text-red-300 text-xs">{flag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full 5-Door Script (expandable) */}
              {script && (
                <div className="border border-violet-500/15 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setV2ScriptExpanded(!v2ScriptExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Brain size={14} className="text-violet-400" />
                      <span className="text-sm font-medium text-gray-200">תסריט 5 דלתות מלא</span>
                      <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">Deep Dive</span>
                    </div>
                    {v2ScriptExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </button>
                  {v2ScriptExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Profile Briefing */}
                      {script.profileBriefing && (
                        <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
                          <div className="flex items-center gap-2 mb-2">
                            <Users size={13} className="text-violet-400" />
                            <span className="text-xs font-bold text-violet-300">מי מולך?</span>
                          </div>
                          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed mb-2">{script.profileBriefing.whoIsThis}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-emerald-400 font-medium">חוזקות</span>
                              <ul className="mt-1 space-y-0.5">
                                {script.profileBriefing.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-gray-400 flex gap-1"><span className="text-emerald-400">+</span>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span className="text-[10px] text-red-400 font-medium">אל תעשה</span>
                              <ul className="mt-1 space-y-0.5">
                                {script.profileBriefing.weaknesses.map((w, i) => (
                                  <li key={i} className="text-xs text-gray-400 flex gap-1"><span className="text-red-400">-</span>{w}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          {script.profileBriefing.goalForCall && <p className="text-xs text-amber-300/80 mt-2">🎯 {script.profileBriefing.goalForCall}</p>}
                          {script.profileBriefing.timeAllocation && <p className="text-xs text-gray-500 mt-1">⏱ {script.profileBriefing.timeAllocation}</p>}
                        </div>
                      )}

                      {/* Door buttons */}
                      {(() => {
                        const doors: { key: string; door: ScriptDoor; color: string }[] = [
                          { key: 'door1', door: script.door1Opening, color: 'blue' },
                          { key: 'door2', door: script.door2DeepListening, color: 'cyan' },
                          { key: 'door3', door: script.door3TheOffer, color: 'emerald' },
                          { key: 'door4a', door: script.door4aYes, color: 'green' },
                          { key: 'door4b', door: script.door4bHesitant, color: 'amber' },
                          { key: 'door5a', door: script.door5aObjectionFear, color: 'orange' },
                          { key: 'door5b', door: script.door5bObjectionPrice, color: 'red' },
                        ].filter(d => d.door);

                        return (
                          <div className="space-y-2">
                            {doors.map(({ key, door, color }) => (
                              <div key={key} className="border border-white/5 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setV2ActiveDoor(v2ActiveDoor === key ? null : key)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
                                >
                                  <span className={`text-xs font-medium text-${color}-300`}>{door.title}</span>
                                  {v2ActiveDoor === key ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                                </button>
                                {v2ActiveDoor === key && (
                                  <div className="px-3 pb-3 space-y-2">
                                    <div>
                                      <span className="text-[10px] text-blue-400 font-medium block mb-1">אתה אומר:</span>
                                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed bg-blue-500/5 rounded-lg p-2 border border-blue-500/10">{door.youSay}</p>
                                    </div>
                                    {door.customerSays && (
                                      <div>
                                        <span className="text-[10px] text-gray-500 font-medium block mb-1">הלקוח עונה:</span>
                                        <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed bg-white/[0.02] rounded-lg p-2">{door.customerSays}</p>
                                      </div>
                                    )}
                                    {door.profileInsight && <p className="text-[10px] text-violet-400/80 mt-1">💡 {door.profileInsight}</p>}
                                    {door.critical && <p className="text-[10px] text-red-400/80 mt-1">⚠️ {door.critical}</p>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Post-Call Checklist */}
                      {script.postCallChecklist?.length > 0 && (
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                          <span className="text-xs font-bold text-emerald-300 block mb-2">✅ צ'קליסט אחרי שיחה</span>
                          <ul className="space-y-1">
                            {script.postCallChecklist.map((item, i) => (
                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2"><span className="text-emerald-400 mt-0.5">☐</span>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Retention Notes */}
                      {script.retentionNotes && (
                        <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                          <span className="text-xs font-bold text-cyan-300 block mb-1">🔒 הערות שימור</span>
                          <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{script.retentionNotes}</p>
                        </div>
                      )}

                      {v2.profileInsights && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-xs font-bold text-gray-300 block mb-1">🧠 ניתוח מעמיק</span>
                          <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{v2.profileInsights}</p>
                        </div>
                      )}
                      {v2.retentionStrategy && (
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-xs font-bold text-gray-300 block mb-1">📈 אסטרטגיית שימור</span>
                          <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{v2.retentionStrategy}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })()}
      </div>{/* end signals order wrapper */}

      <div style={{ order: getClientOrder('notebook') }}>
      {/* AI Notebook */}
      <Card>
        <div className="flex items-center justify-between">
          <CardHeader title="AI Notebook" subtitle="צ'אט חכם עם הקשר CRM" />
          <Button
            variant="ghost"
            onClick={() => setNotebookOpen(!notebookOpen)}
            icon={notebookOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          >
            {notebookOpen ? 'סגור' : 'פתח'}
          </Button>
        </div>

        {notebookOpen && (
          <div className="mt-3">
            {/* Chat Messages */}
            <div className="h-72 overflow-y-auto custom-scrollbar space-y-2 p-3 rounded-xl bg-[#0B1121] border border-white/5 mb-3">
              {notebookMessages.length === 0 && (
                <div className="text-center py-10">
                  <Brain size={32} className="mx-auto text-violet-400/30 mb-2" />
                  <p className="text-gray-600 text-sm">שאל כל שאלה על הלקוח...</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['מה המצב הכספי?', 'איך לדבר עם הלקוח?', 'מה הבעיות העיקריות?', 'תמליץ על פעולות'].map(q => (
                      <button
                        key={q}
                        onClick={() => { setNotebookInput(q); }}
                        className="text-[10px] px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {notebookMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary/10 text-gray-200'
                      : 'bg-violet-500/10 text-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {notebookLoading && (
                <div className="flex justify-end">
                  <div className="px-3 py-2 rounded-xl bg-violet-500/10">
                    <Sparkles size={14} className="text-violet-400 animate-pulse" />
                  </div>
                </div>
              )}
              <div ref={notebookEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                value={notebookInput}
                onChange={e => setNotebookInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleNotebookSend(); } }}
                placeholder="שאל שאלה על הלקוח..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#0B1121] border border-white/10 text-gray-200 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50"
                disabled={notebookLoading || !settings.hasGeminiKey}
              />
              <Button
                onClick={handleNotebookSend}
                disabled={notebookLoading || !notebookInput.trim() || !settings.hasGeminiKey}
                icon={<Send size={14} />}
              >
                שלח
              </Button>
            </div>
            {!settings.hasGeminiKey && (
              <p className="text-xs text-gray-500 mt-1">נדרש מפתח Gemini בהגדרות</p>
            )}
          </div>
        )}
      </Card>
      </div>{/* end notebook order wrapper */}

      <div style={{ order: getClientOrder('strategy') }}>
      {/* Strategy & Action Plan */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title={<span className="flex items-center gap-2"><Target size={18} className="text-teal-400" /> אסטרטגיה ותוכנית עבודה</span>} />
          <Button
            onClick={handleGenerateStrategy}
            disabled={isGeneratingStrategy || !settings.hasGeminiKey}
            icon={<Sparkles size={16} />}
          >
            {isGeneratingStrategy ? 'מנתח...' : 'צור אסטרטגיה'}
          </Button>
        </div>

        {strategyError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
            {strategyError}
          </div>
        )}

        {isGeneratingStrategy && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">מנתח מצב ובונה תוכנית עבודה...</span>
          </div>
        )}

        {(() => {
          const clientStrategies = strategyPlans.filter(s => s.clientId === clientId);
          if (clientStrategies.length === 0 && !isGeneratingStrategy) {
            return (
              <p className="text-gray-600 text-sm text-center py-6 italic">
                לחץ על &quot;צור אסטרטגיה&quot; לקבלת ניתוח מצב מעמיק ותוכנית עבודה מבוססת כל המידע במערכת
              </p>
            );
          }
          return (
            <div className="space-y-3">
              {clientStrategies.map(strategy => {
                const isExpanded = expandedStrategyId === strategy.id;
                const pd = strategy.planData;
                const hasPlan = pd && (pd.summary || pd.actionPlan?.length > 0);
                return (
                  <div key={strategy.id} className="bg-[#0B1121] rounded-xl border border-white/5 overflow-hidden">
                    <button
                      onClick={() => setExpandedStrategyId(isExpanded ? null : strategy.id)}
                      className="w-full text-start p-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Target size={14} className="text-teal-400" />
                          <span className="text-xs text-gray-400">{formatDateTime(strategy.createdAt)}</span>
                          <span className="text-xs text-gray-600">· {strategy.createdByName}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                      </div>
                      {!isExpanded && pd.summary && (
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">{pd.summary}</p>
                      )}
                    </button>

                    {isExpanded && hasPlan && (
                      <div className="px-4 pb-4">
                        {/* Summary */}
                        {pd.summary && (
                          <div className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-lg mb-4">
                            <p className="text-gray-300 text-sm leading-relaxed">{pd.summary}</p>
                          </div>
                        )}

                        {/* Situation Analysis */}
                        {pd.situationAnalysis && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><ListChecks size={14} className="text-teal-400" /> ניתוח מצב קיים</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {pd.situationAnalysis.whatsWorking?.length > 0 && (
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                  <h5 className="text-xs font-semibold text-emerald-400 mb-2">✅ מה עובד</h5>
                                  {pd.situationAnalysis.whatsWorking.map((item, i) => (
                                    <p key={i} className="text-gray-400 text-xs mb-1">• {item}</p>
                                  ))}
                                </div>
                              )}
                              {pd.situationAnalysis.whatsNotWorking?.length > 0 && (
                                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                                  <h5 className="text-xs font-semibold text-red-400 mb-2">❌ מה לא עובד</h5>
                                  {pd.situationAnalysis.whatsNotWorking.map((item, i) => (
                                    <p key={i} className="text-gray-400 text-xs mb-1">• {item}</p>
                                  ))}
                                </div>
                              )}
                              {pd.situationAnalysis.opportunities?.length > 0 && (
                                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                  <h5 className="text-xs font-semibold text-blue-400 mb-2">💡 הזדמנויות</h5>
                                  {pd.situationAnalysis.opportunities.map((item, i) => (
                                    <p key={i} className="text-gray-400 text-xs mb-1">• {item}</p>
                                  ))}
                                </div>
                              )}
                              {pd.situationAnalysis.risks?.length > 0 && (
                                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                                  <h5 className="text-xs font-semibold text-amber-400 mb-2">⚠️ סיכונים</h5>
                                  {pd.situationAnalysis.risks.map((item, i) => (
                                    <p key={i} className="text-gray-400 text-xs mb-1">• {item}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                            {pd.situationAnalysis.dependencies?.length > 0 && (
                              <div className="p-3 bg-gray-500/5 border border-gray-500/10 rounded-lg mt-3">
                                <h5 className="text-xs font-semibold text-gray-400 mb-2">🔗 תלויות</h5>
                                {pd.situationAnalysis.dependencies.map((item, i) => (
                                  <p key={i} className="text-gray-400 text-xs mb-1">• {item}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Action Plan Phases */}
                        {pd.actionPlan?.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Zap size={14} className="text-teal-400" /> תוכנית עבודה</h4>
                            <div className="space-y-4">
                              {pd.actionPlan.map((phase, pi) => {
                                const phaseColors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500'];
                                const bgColor = phaseColors[pi % phaseColors.length];
                                return (
                                  <div key={pi}>
                                    <div className={`${bgColor}/10 border ${bgColor}/20 rounded-lg p-3 mb-2`}>
                                      <h5 className="text-sm font-semibold text-white">{phase.phaseLabel}</h5>
                                      {phase.phaseSummary && <p className="text-xs text-gray-400 mt-1">{phase.phaseSummary}</p>}
                                    </div>
                                    {phase.actions?.length > 0 && (
                                      <div className="space-y-2 me-4">
                                        {phase.actions.map((action, ai) => (
                                          <div key={ai} className="flex gap-3 p-2 rounded-lg hover:bg-white/[0.02]">
                                            <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                              <span className="text-teal-400 text-xs font-bold">{action.number}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm text-gray-200 font-medium">{action.title}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{action.owner}</span>
                                              </div>
                                              <p className="text-xs text-gray-500">{action.description}</p>
                                              {action.kpi && <p className="text-[10px] text-teal-400/80 mt-1">📊 {action.kpi}</p>}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* KPIs */}
                        {pd.kpis?.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Target size={14} className="text-amber-400" /> מדדי הצלחה</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {pd.kpis.map((kpi, ki) => (
                                <div key={ki} className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg text-center">
                                  <div className="text-sm font-bold text-amber-400">{kpi.target}</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5">{kpi.label}</div>
                                  <div className="text-[9px] text-gray-600">{kpi.timeframe}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Public URL display */}
                        {strategy.publicUrl && (
                          <div className="flex items-center gap-2 p-2.5 bg-violet-500/5 border border-violet-500/10 rounded-lg mb-3">
                            <Link2 size={14} className="text-violet-400 flex-shrink-0" />
                            <a href={strategy.publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-400 hover:text-violet-300 truncate flex-1" dir="ltr">{strategy.publicUrl}</a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(strategy.publicUrl!);
                                setCopiedStrategyUrl(strategy.id);
                                setTimeout(() => setCopiedStrategyUrl(null), 2000);
                              }}
                              className="flex-shrink-0 p-1 rounded hover:bg-white/5"
                              title="העתק לינק"
                            >
                              {copiedStrategyUrl === strategy.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-gray-400" />}
                            </button>
                          </div>
                        )}

                        {/* Actions: Edit + Export + Publish + Delete */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button
                              variant="ghost"
                              icon={<Edit3 size={14} />}
                              onClick={() => {
                                setEditingStrategyId(strategy.id);
                                setEditStrategyData(JSON.parse(JSON.stringify(strategy.planData)));
                              }}
                            >
                              עריכה
                            </Button>
                            <Button
                              variant="ghost"
                              icon={<Printer size={14} />}
                              onClick={() => {
                                const brand = getBrandConfig(settings);
                                generateStrategyPdf({
                                  entityName: strategy.entityName,
                                  entityType: 'client',
                                  planData: strategy.planData,
                                  createdAt: strategy.createdAt,
                                }, brand);
                              }}
                            >
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              icon={<Zap size={14} />}
                              className="text-violet-400 hover:text-violet-300"
                              onClick={() => {
                                const brand = getBrandConfig(settings);
                                generateAnimatedStrategy({
                                  entityName: strategy.entityName,
                                  entityType: 'client',
                                  planData: strategy.planData,
                                  createdAt: strategy.createdAt,
                                }, brand);
                              }}
                            >
                              מונפש
                            </Button>
                            <Button
                              variant="ghost"
                              icon={isPublishingStrategy === strategy.id ? <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" /> : <Link2 size={14} />}
                              className="text-violet-400 hover:text-violet-300"
                              disabled={isPublishingStrategy === strategy.id}
                              onClick={async () => {
                                setIsPublishingStrategy(strategy.id);
                                try {
                                  const brand = getBrandConfig(settings);
                                  const html = buildAnimatedStrategyHtml({
                                    entityName: strategy.entityName,
                                    entityType: 'client',
                                    planData: strategy.planData,
                                    createdAt: strategy.createdAt,
                                  }, brand);
                                  const url = await publishStrategyPage(strategy.id, html);
                                  if (url) {
                                    navigator.clipboard.writeText(url);
                                    setCopiedStrategyUrl(strategy.id);
                                    setTimeout(() => setCopiedStrategyUrl(null), 3000);
                                  }
                                } finally {
                                  setIsPublishingStrategy(null);
                                }
                              }}
                            >
                              {strategy.publicUrl ? 'עדכן לינק' : 'פרסם לינק'}
                            </Button>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmDeleteStrategyId(strategy.id)}
                              className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1"
                            >
                              <Trash2 size={12} /> מחיקה
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Raw text fallback */}
                    {isExpanded && !hasPlan && strategy.rawText && (
                      <div className="px-4 pb-4 max-h-96 overflow-y-auto custom-scrollbar">
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{strategy.rawText}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Delete confirm modal */}
        {confirmDeleteStrategyId && (
          <Modal
            isOpen={true}
            onClose={() => setConfirmDeleteStrategyId(null)}
            title="מחיקת תוכנית אסטרטגית"
          >
            <p className="text-gray-400 mb-4">האם למחוק את התוכנית האסטרטגית?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setConfirmDeleteStrategyId(null)}>ביטול</Button>
              <Button variant="danger" onClick={async () => {
                await deleteStrategyPlan(confirmDeleteStrategyId);
                setConfirmDeleteStrategyId(null);
              }}>מחק</Button>
            </div>
          </Modal>
        )}

        {/* Edit strategy modal */}
        {editingStrategyId && editStrategyData && (
          <Modal
            isOpen={true}
            onClose={() => { setEditingStrategyId(null); setEditStrategyData(null); }}
            title="עריכת תוכנית אסטרטגית"
            size="xl"
          >
            <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pe-2">
              {/* Summary */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">תקציר מנהלים</label>
                <Textarea
                  value={editStrategyData.summary}
                  onChange={(e) => setEditStrategyData({ ...editStrategyData, summary: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Situation Analysis */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">ניתוח מצב קיים</h4>
                {(['whatsWorking', 'whatsNotWorking', 'opportunities', 'risks', 'dependencies'] as const).map(key => {
                  const labels: Record<string, string> = {
                    whatsWorking: '✅ מה עובד',
                    whatsNotWorking: '❌ מה לא עובד',
                    opportunities: '💡 הזדמנויות',
                    risks: '⚠️ סיכונים',
                    dependencies: '🔗 תלויות'
                  };
                  const items = editStrategyData.situationAnalysis?.[key] || [];
                  return (
                    <div key={key}>
                      <label className="block text-xs text-gray-400 mb-1">{labels[key]}</label>
                      <Textarea
                        value={items.join('\n')}
                        onChange={(e) => {
                          const newItems = e.target.value.split('\n');
                          setEditStrategyData({
                            ...editStrategyData,
                            situationAnalysis: {
                              ...editStrategyData.situationAnalysis,
                              [key]: newItems,
                            }
                          });
                        }}
                        rows={Math.max(2, items.length)}
                        placeholder="שורה אחת לכל פריט"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Action Plan Phases */}
              {editStrategyData.actionPlan?.map((phase, pi) => (
                <div key={pi} className="p-3 bg-[#0B1121] rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-teal-400">{phase.phaseLabel}</h4>
                    <button
                      onClick={() => {
                        const newPlan = [...editStrategyData.actionPlan];
                        newPlan.splice(pi, 1);
                        setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                      }}
                      className="text-red-400/60 hover:text-red-400 text-xs"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <Input
                    value={phase.phaseLabel}
                    onChange={(e) => {
                      const newPlan = [...editStrategyData.actionPlan];
                      newPlan[pi] = { ...newPlan[pi], phaseLabel: e.target.value };
                      setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                    }}
                    placeholder="שם שלב"
                  />
                  <Textarea
                    value={phase.phaseSummary}
                    onChange={(e) => {
                      const newPlan = [...editStrategyData.actionPlan];
                      newPlan[pi] = { ...newPlan[pi], phaseSummary: e.target.value };
                      setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                    }}
                    rows={2}
                    placeholder="תיאור שלב"
                  />
                  {phase.actions?.map((action, ai) => (
                    <div key={ai} className="flex gap-2 items-start p-2 bg-white/[0.02] rounded-lg">
                      <span className="text-teal-400 text-xs font-bold mt-2 flex-shrink-0 w-4">{action.number}</span>
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={action.title}
                          onChange={(e) => {
                            const newPlan = [...editStrategyData.actionPlan];
                            const newActions = [...newPlan[pi].actions];
                            newActions[ai] = { ...newActions[ai], title: e.target.value };
                            newPlan[pi] = { ...newPlan[pi], actions: newActions };
                            setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                          }}
                          placeholder="כותרת פעולה"
                        />
                        <Textarea
                          value={action.description}
                          onChange={(e) => {
                            const newPlan = [...editStrategyData.actionPlan];
                            const newActions = [...newPlan[pi].actions];
                            newActions[ai] = { ...newActions[ai], description: e.target.value };
                            newPlan[pi] = { ...newPlan[pi], actions: newActions };
                            setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                          }}
                          rows={2}
                          placeholder="תיאור"
                        />
                        <div className="flex gap-2">
                          <Input
                            value={action.owner}
                            onChange={(e) => {
                              const newPlan = [...editStrategyData.actionPlan];
                              const newActions = [...newPlan[pi].actions];
                              newActions[ai] = { ...newActions[ai], owner: e.target.value };
                              newPlan[pi] = { ...newPlan[pi], actions: newActions };
                              setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                            }}
                            placeholder="אחראי"
                          />
                          <Input
                            value={action.kpi}
                            onChange={(e) => {
                              const newPlan = [...editStrategyData.actionPlan];
                              const newActions = [...newPlan[pi].actions];
                              newActions[ai] = { ...newActions[ai], kpi: e.target.value };
                              newPlan[pi] = { ...newPlan[pi], actions: newActions };
                              setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                            }}
                            placeholder="KPI"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const newPlan = [...editStrategyData.actionPlan];
                          const newActions = [...newPlan[pi].actions];
                          newActions.splice(ai, 1);
                          newPlan[pi] = { ...newPlan[pi], actions: newActions };
                          setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                        }}
                        className="text-red-400/40 hover:text-red-400 mt-2 flex-shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const newPlan = [...editStrategyData.actionPlan];
                      const actions = newPlan[pi].actions || [];
                      newPlan[pi] = { ...newPlan[pi], actions: [...actions, { number: actions.length + 1, title: '', description: '', owner: '', kpi: '' }] };
                      setEditStrategyData({ ...editStrategyData, actionPlan: newPlan });
                    }}
                    className="text-teal-400/60 hover:text-teal-400 text-xs flex items-center gap-1"
                  >
                    <Plus size={12} /> הוסף פעולה
                  </button>
                </div>
              ))}

              {/* KPIs */}
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">מדדי הצלחה (KPIs)</h4>
                {editStrategyData.kpis?.map((kpi, ki) => (
                  <div key={ki} className="flex gap-2 items-center mb-2">
                    <Input
                      value={kpi.label}
                      onChange={(e) => {
                        const newKpis = [...(editStrategyData.kpis || [])];
                        newKpis[ki] = { ...newKpis[ki], label: e.target.value };
                        setEditStrategyData({ ...editStrategyData, kpis: newKpis });
                      }}
                      placeholder="מדד"
                    />
                    <Input
                      value={kpi.target}
                      onChange={(e) => {
                        const newKpis = [...(editStrategyData.kpis || [])];
                        newKpis[ki] = { ...newKpis[ki], target: e.target.value };
                        setEditStrategyData({ ...editStrategyData, kpis: newKpis });
                      }}
                      placeholder="יעד"
                    />
                    <Input
                      value={kpi.timeframe}
                      onChange={(e) => {
                        const newKpis = [...(editStrategyData.kpis || [])];
                        newKpis[ki] = { ...newKpis[ki], timeframe: e.target.value };
                        setEditStrategyData({ ...editStrategyData, kpis: newKpis });
                      }}
                      placeholder="מסגרת זמן"
                    />
                    <button
                      onClick={() => {
                        const newKpis = [...(editStrategyData.kpis || [])];
                        newKpis.splice(ki, 1);
                        setEditStrategyData({ ...editStrategyData, kpis: newKpis });
                      }}
                      className="text-red-400/40 hover:text-red-400 flex-shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-4 border-t border-white/5 pt-4">
              <Button variant="ghost" onClick={() => { setEditingStrategyId(null); setEditStrategyData(null); }}>ביטול</Button>
              <Button onClick={async () => {
                if (editingStrategyId && editStrategyData) {
                  await updateStrategyPlan(editingStrategyId, { planData: editStrategyData });
                  // If a public URL exists, re-publish with updated content
                  const strategy = strategyPlans.find(s => s.id === editingStrategyId);
                  if (strategy?.publicUrl) {
                    const brand = getBrandConfig(settings);
                    const html = buildAnimatedStrategyHtml({
                      entityName: strategy.entityName,
                      entityType: 'client',
                      planData: editStrategyData,
                      createdAt: strategy.createdAt,
                    }, brand);
                    await publishStrategyPage(editingStrategyId, html);
                  }
                  setEditingStrategyId(null);
                  setEditStrategyData(null);
                }
              }}>שמור שינויים</Button>
            </div>
          </Modal>
        )}
      </Card>
      </div>{/* end strategy order wrapper */}

      <div style={{ order: getClientOrder('competitor') }}>
      {/* Competitor Scout */}
      {(() => {
        const clientReports = competitorReports.filter(r => r.entityId === clientId && r.entityType === 'client');
        const latestReport = clientReports[0];

        const THREAT_COLORS: Record<string, string> = { HIGH: 'text-red-400 bg-red-500/10', MEDIUM: 'text-amber-400 bg-amber-500/10', LOW: 'text-emerald-400 bg-emerald-500/10' };
        const PRIORITY_COLORS: Record<string, string> = { HIGH: 'border-red-500/30 bg-red-500/5', MEDIUM: 'border-amber-500/30 bg-amber-500/5', LOW: 'border-emerald-500/30 bg-emerald-500/5' };

        return (
          <Card>
            <CardHeader
              title="סקאוט תחרותי"
              subtitle={latestReport ? `עדכון אחרון: ${formatDate(latestReport.createdAt)}` : 'ניתוח AI של הנוף התחרותי'}
            />
            <div className="mt-4 space-y-3">
              {/* Run button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={async () => {
                    setScoutLoading(true);
                    // Build rich context for competitor analysis
                    const scoutContext: string[] = [];
                    if (client.facebookUrl) scoutContext.push(`Facebook: ${client.facebookUrl}`);
                    if (client.instagramUrl) scoutContext.push(`Instagram: ${client.instagramUrl}`);
                    if (client.notes) scoutContext.push(`הערות: ${client.notes.substring(0, 300)}`);
                    const recentClientNotes = clientNotesFiltered.slice(0, 3).map(n => n.content.substring(0, 100)).join('; ');
                    if (recentClientNotes) scoutContext.push(`הערות אחרונות: ${recentClientNotes}`);
                    const recentClientSummaries = clientTranscripts.slice(0, 2).map(ct => ct.summary?.substring(0, 150)).filter(Boolean).join('; ');
                    if (recentClientSummaries) scoutContext.push(`סיכומי שיחות: ${recentClientSummaries}`);

                    await runCompetitorScout({
                      entityId: clientId!,
                      entityType: 'client',
                      businessName: client.businessName || client.clientName,
                      industry: client.industry || '',
                      website: client.websiteUrl,
                      services: client.services.map(sk => {
                        const svc = services.find(s => s.serviceKey === sk);
                        return svc ? svc.label : sk;
                      }),
                      additionalContext: scoutContext.join('\n') || undefined,
                    });
                    setScoutLoading(false);
                    setScoutExpanded(true);
                  }}
                  disabled={scoutLoading || !settings.hasGeminiKey}
                  icon={scoutLoading ? <Sparkles size={16} className="animate-spin" /> : <Target size={16} />}
                  variant="secondary"
                >
                  {scoutLoading ? 'מנתח...' : latestReport ? 'ניתוח מחדש' : 'הפעל ניתוח תחרותי'}
                </Button>
                {!settings.hasGeminiKey && (
                  <span className="text-xs text-gray-500">נדרש מפתח Gemini בהגדרות</span>
                )}
              </div>

              {/* Latest report display */}
              {latestReport && (
                <div className="space-y-3">
                  {/* Summary */}
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                    <p className="text-gray-300 text-sm leading-relaxed">{latestReport.analysis.summary}</p>
                  </div>

                  {/* Competitors */}
                  {latestReport.analysis.competitors?.length > 0 && (
                    <div>
                      <button
                        onClick={() => setScoutExpanded(!scoutExpanded)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                      >
                        <Shield size={14} className="text-violet-400" />
                        {latestReport.analysis.competitors.length} מתחרים זוהו
                        {scoutExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {scoutExpanded && (
                        <div className="mt-2 space-y-2">
                          {latestReport.analysis.competitors.map((comp, i) => (
                            <div key={i} className="p-3 rounded-xl bg-[#0B1121] border border-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-white font-medium text-sm">{comp.name}</span>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${THREAT_COLORS[comp.threatLevel] || 'text-gray-400'}`}>
                                  {comp.threatLevel === 'HIGH' ? 'איום גבוה' : comp.threatLevel === 'MEDIUM' ? 'איום בינוני' : 'איום נמוך'}
                                </span>
                              </div>
                              <p className="text-gray-400 text-xs mb-2">{comp.description}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="text-[10px] text-emerald-400 font-medium mb-1">חוזקות</div>
                                  {comp.strengths?.map((s, j) => <div key={j} className="text-[10px] text-gray-500">• {s}</div>)}
                                </div>
                                <div>
                                  <div className="text-[10px] text-red-400 font-medium mb-1">חולשות</div>
                                  {comp.weaknesses?.map((w, j) => <div key={j} className="text-[10px] text-gray-500">• {w}</div>)}
                                </div>
                              </div>
                              {comp.differentiator && (
                                <div className="mt-2 text-[10px] text-violet-400">מבדל: {comp.differentiator}</div>
                              )}
                            </div>
                          ))}

                          {/* Opportunities & Threats */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            {latestReport.analysis.opportunities?.length > 0 && (
                              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                <div className="text-xs font-medium text-emerald-400 mb-2">🎯 הזדמנויות</div>
                                {latestReport.analysis.opportunities.map((o, i) => (
                                  <div key={i} className="text-[10px] text-gray-400 mb-1">• {o}</div>
                                ))}
                              </div>
                            )}
                            {latestReport.analysis.threats?.length > 0 && (
                              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                                <div className="text-xs font-medium text-red-400 mb-2">⚠️ איומים</div>
                                {latestReport.analysis.threats.map((t, i) => (
                                  <div key={i} className="text-[10px] text-gray-400 mb-1">• {t}</div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Recommendations */}
                          {latestReport.analysis.recommendations?.length > 0 && (
                            <div className="space-y-2 mt-3">
                              <div className="text-xs font-medium text-gray-300">💡 המלצות</div>
                              {latestReport.analysis.recommendations.map((rec, i) => (
                                <div key={i} className={`p-3 rounded-xl border ${PRIORITY_COLORS[rec.priority] || 'border-white/5'}`}>
                                  <div className="text-sm font-medium text-white">{rec.title}</div>
                                  <p className="text-xs text-gray-400 mt-1">{rec.description}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Market Trends */}
                          {latestReport.analysis.marketTrends?.length > 0 && (
                            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 mt-3">
                              <div className="text-xs font-medium text-blue-400 mb-2">📈 מגמות שוק</div>
                              {latestReport.analysis.marketTrends.map((t, i) => (
                                <div key={i} className="text-[10px] text-gray-400 mb-1">• {t}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })()}
      </div>{/* end competitor order wrapper */}

      <div style={{ order: getClientOrder('financial') }}>
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
      </div>{/* end financial order wrapper */}

      <div style={{ order: getClientOrder('activity') }}>
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
      </div>{/* end activity order wrapper */}

      <div style={{ order: getClientOrder('files') }}>
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
      </div>{/* end files order wrapper */}
      </div>{/* end sortable sections container */}

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
            {/* Social / Web URLs */}
            <div className="space-y-6">
              <h4 className="text-primary text-sm font-bold uppercase tracking-wider border-b border-white/10 pb-2">קישורים חברתיים ואתר</h4>
              <div className="grid grid-cols-3 gap-4">
                <Input label="עמוד פייסבוק" placeholder="https://facebook.com/..." value={editFormData.facebookUrl || ''} onChange={e => setEditFormData({...editFormData, facebookUrl: e.target.value})} />
                <Input label="עמוד אינסטגרם" placeholder="https://instagram.com/..." value={editFormData.instagramUrl || ''} onChange={e => setEditFormData({...editFormData, instagramUrl: e.target.value})} />
                <Input label="כתובת אתר" placeholder="https://..." value={editFormData.websiteUrl || ''} onChange={e => setEditFormData({...editFormData, websiteUrl: e.target.value})} />
              </div>
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
