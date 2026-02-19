import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantNav } from '../hooks/useTenantNav';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { LeadStatus, SourceChannel, ClientRating, ClientStatus, EffortLevel, NoteType, Archetype, BusinessIntelV2, HeroCard, ActionItem, QuickScript, ScriptDoor, FullFiveDoorScript, ProfileBriefing } from '../types';
import type { Lead, StrategyPlan, Proposal, ProposalData, ProposalPackage, ProposalPhase } from '../types';
import { formatCurrency, formatDate, formatDateTime, formatPhoneForWhatsApp } from '../utils';
import { MESSAGE_PURPOSES } from '../constants';
import { ArrowRight, Phone, Mail, Calendar, Send, Trash2, MessageCircle, User, Clock, CheckCircle, Tag, Globe, ChevronDown, ChevronUp, Sparkles, Plus, FileText, Mic, Edit3, Target, Brain, Shield, ExternalLink, Upload, Loader2, Zap, Users, Star, AlertTriangle, MessageSquare, ListChecks, Printer, Link2, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getBrandConfig, generatePersonalityPdf, generateCustomPdf, generateStrategyPdf } from '../utils/pdfGenerator';
import { generateAnimatedStrategy, buildAnimatedStrategyHtml } from '../utils/animatedStrategy';
import { buildAnimatedProposalHtml, generateAnimatedProposal } from '../utils/animatedProposal';
import { Input, Textarea, Select, Checkbox } from './ui/Form';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import VoiceRecorderButton from './VoiceRecorderButton';
import SectionReorder from './SectionReorder';
import { useSectionOrder } from '../hooks/useSectionOrder';

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

// --- Signals OS Personality Config ---
const ARCHETYPE_CONFIG: Record<string, { nameHe: string; color: string; bgColor: string; borderColor: string; barColor: string; icon: string }> = {
  WINNER:  { nameHe: 'ווינר',  color: 'text-red-400',    bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/20',    barColor: '#EF4444', icon: '🏆' },
  STAR:    { nameHe: 'סטאר',   color: 'text-amber-400',  bgColor: 'bg-amber-500/10',  borderColor: 'border-amber-500/20',  barColor: '#F59E0B', icon: '⭐' },
  DREAMER: { nameHe: 'חולם',   color: 'text-violet-400', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20', barColor: '#8B5CF6', icon: '💫' },
  HEART:   { nameHe: 'לב',     color: 'text-pink-400',   bgColor: 'bg-pink-500/10',   borderColor: 'border-pink-500/20',   barColor: '#EC4899', icon: '❤️' },
  ANCHOR:  { nameHe: 'עוגן',   color: 'text-cyan-400',   bgColor: 'bg-cyan-500/10',   borderColor: 'border-cyan-500/20',   barColor: '#06B6D4', icon: '⚓' },
};

const SALES_SHEET_LABELS: Record<string, string> = {
  how_to_speak: 'איך לדבר',
  what_not_to_do: 'ממה להימנע',
  closing_speed: 'מהירות סגירה',
  followup_plan: 'תוכנית מעקב',
  best_offers: 'הצעות מומלצות',
  best_social_proof: 'הוכחה חברתית',
  red_flags: 'דגלים אדומים',
  closing_line: 'משפט סגירה',
  calibration_questions: 'שאלות מכיילות',
  fomo_message: 'יצירת FOMO',
  call_script: 'תסריט שיחה',
  recommended_channels: 'ערוצים מומלצים',
};

const RETENTION_SHEET_LABELS: Record<string, string> = {
  onboarding_focus: 'דגש באונבורדינג',
  habit_building: 'בניית הרגלים',
  community_hook: 'חיבור קהילתי',
  risk_moments: 'רגעי סיכון',
  save_offer: 'הצעת שימור',
  cadence: 'קצב תקשורת',
};

const CONFIDENCE_HE: Record<string, string> = { HIGH: 'גבוהה', MEDIUM: 'בינונית', LOW: 'נמוכה' };
const CHURN_RISK_HE: Record<string, string> = { HIGH: 'גבוה', MEDIUM: 'בינוני', LOW: 'נמוך' };

const LeadProfile: React.FC = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const { tn } = useTenantNav();
  const { user, displayName: currentUserName, allUsers, isAdmin } = useAuth();
  const {
    leads, services, activities, settings,
    leadNotes, addLeadNote, deleteLeadNote,
    updateLead, deleteLead, convertLeadToClient,
    callTranscripts, addCallTranscript, deleteCallTranscript,
    aiRecommendations, addAIRecommendation, deleteAIRecommendation,
    whatsappMessages, addWhatsAppMessage, deleteWhatsAppMessage, uploadRecording,
    signalsPersonalities, competitorReports, runCompetitorScout, deleteCompetitorReport,
    strategyPlans, addStrategyPlan, updateStrategyPlan, deleteStrategyPlan, publishStrategyPage,
    proposals, addProposal, updateProposal, deleteProposal, publishProposalPage,
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

  // Old Canva proposal state (kept for backward compatibility)
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Animated proposal state
  const [isProposalEditorOpen, setIsProposalEditorOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [confirmDeleteProposalId, setConfirmDeleteProposalId] = useState<string | null>(null);
  const [isPublishingProposal, setIsPublishingProposal] = useState<string | null>(null);
  const [copiedProposalUrl, setCopiedProposalUrl] = useState<string | null>(null);
  const [proposalForm, setProposalForm] = useState<{
    proposalName: string;
    introText: string;
    phases: ProposalPhase[];
    packages: ProposalPackage[];
    terms: string[];
    validUntil: string;
  }>({
    proposalName: '',
    introText: '',
    phases: [],
    packages: [],
    terms: [],
    validUntil: '',
  });

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

  // Signals OS PDF upload state
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const signalsPdfRef = useRef<HTMLInputElement>(null);
  // Track if auto-recommendation was already triggered for this personality
  const [autoRecTriggered, setAutoRecTriggered] = useState(false);
  const [signalsMessageEditing, setSignalsMessageEditing] = useState(false);
  const [signalsMessageText, setSignalsMessageText] = useState('');

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Lead> | null>(null);

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

  // Competitor scout state
  const [scoutLoading, setScoutLoading] = useState(false);
  const [scoutExpanded, setScoutExpanded] = useState(false);

  // PDF dropdown state
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const pdfDropdownRef = useRef<HTMLDivElement>(null);

  // Delete lead state
  const [confirmDeleteLead, setConfirmDeleteLead] = useState(false);

  // Section reorder
  const LEAD_SECTIONS = [
    { id: 'signals', label: 'Signals OS' },
    { id: 'competitor', label: 'סקאוט תחרותי' },
    { id: 'notes', label: 'הערות והיסטוריה' },
    { id: 'transcripts', label: 'תמלולי שיחות' },
    { id: 'ai-recommendations', label: 'המלצות AI' },
    { id: 'ai-summaries', label: 'סיכומי AI' },
    { id: 'notebook', label: 'AI Notebook' },
    { id: 'strategy', label: 'אסטרטגיה ותוכנית עבודה' },
    { id: 'proposals', label: 'הצעות מחיר מונפשות' },
    { id: 'whatsapp', label: 'הודעות WhatsApp' },
    { id: 'activity', label: 'היסטוריית פעילות' },
  ];
  const DEFAULT_LEAD_ORDER = LEAD_SECTIONS.map(s => s.id);
  const { sectionOrder: leadSectionOrder, setOrder: setLeadOrder, resetOrder: resetLeadOrder, getOrder: getLeadOrder } = useSectionOrder('lead', DEFAULT_LEAD_ORDER);

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

  // Signals OS personality data for this lead
  const personality = signalsPersonalities.find(p => p.leadId === leadId);
  const [salesSheetExpanded, setSalesSheetExpanded] = useState(false);
  // V2 Business Intelligence expandable states
  const [v2ScriptExpanded, setV2ScriptExpanded] = useState(false);
  const [v2ActiveDoor, setV2ActiveDoor] = useState<string | null>(null);
  const [businessReportExpanded, setBusinessReportExpanded] = useState(false);
  const [userReportExpanded, setUserReportExpanded] = useState(false);
  const [retentionSheetExpanded, setRetentionSheetExpanded] = useState(false);

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
          personality: personality ? {
            primary: personality.primaryArchetype,
            secondary: personality.secondaryArchetype,
            confidenceLevel: personality.confidenceLevel,
            churnRisk: personality.churnRisk,
            smartTags: personality.smartTags,
            salesCheatSheet: personality.salesCheatSheet,
            retentionCheatSheet: personality.retentionCheatSheet,
          } : null,
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

  // ===== Signals OS PDF Upload → Extract text → AI Recommendations =====
  const handleSignalsPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lead || !user) return;
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      setPdfError('נא להעלות קובץ PDF בלבד');
      return;
    }
    setIsUploadingPDF(true);
    setPdfError(null);
    setPdfSuccess(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // 1. Upload PDF to Gemini via Edge Function for text extraction + recommendations
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'lead');
      formData.append('entityName', lead.businessName || lead.leadName);
      formData.append('leadId', lead.leadId);
      formData.append('additionalContext', `סטטוס: ${lead.status}, מקור: ${lead.sourceChannel}, הצעת מחיר: ₪${lead.quotedMonthlyValue}`);
      // Add existing notes/transcripts for richer context
      const notesJson = leadNotesFiltered.map(n => ({ content: n.content, createdByName: n.createdByName, createdAt: n.createdAt }));
      formData.append('notes', JSON.stringify(notesJson));
      const transcriptsJson = leadTranscripts.map(ct => ({ summary: ct.summary, callDate: ct.callDate }));
      formData.append('transcripts', JSON.stringify(transcriptsJson));

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        await addAIRecommendation({
          leadId: lead.leadId,
          recommendation: result.recommendation,
          createdBy: user.id,
          createdByName: currentUserName,
        });
        // If personality was extracted from PDF, the Edge Function saved it to DB
        // Realtime subscription will auto-update signalsPersonalities
        // Force a small delay to let realtime catch up, then show success
        if (result.extractedPersonality) {
          await new Promise(r => setTimeout(r, 1500));
        }
        setPdfSuccess(true);
        setTimeout(() => setPdfSuccess(false), 5000);
      } else {
        setPdfError(result.error || 'שגיאה בניתוח ה-PDF');
      }
    } catch (err) {
      console.error('PDF upload error:', err);
      setPdfError('שגיאה בהעלאה או בניתוח ה-PDF');
    } finally {
      setIsUploadingPDF(false);
      if (signalsPdfRef.current) signalsPdfRef.current.value = '';
    }
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

  // ===== Auto-trigger AI recommendations when personality data arrives =====
  useEffect(() => {
    if (!personality || !lead || !user || autoRecTriggered) return;
    // Check if there are already recommendations — if yes, don't auto-trigger
    if (leadRecommendations.length > 0) return;
    // Auto-trigger recommendations with personality data
    setAutoRecTriggered(true);
    handleGetRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personality?.receivedAt]);

  // Strategy: Generate
  const handleGenerateStrategy = async () => {
    if (!lead || !user) return;
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
          body: JSON.stringify({ entityId: leadId, entityType: 'lead' }),
        }
      );
      const result = await res.json();
      if (result.success && (result.plan || result.rawText)) {
        await addStrategyPlan({
          leadId: lead.leadId,
          entityName: lead.businessName || lead.leadName,
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
    if (!notebookInput.trim() || notebookLoading || !leadId) return;
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
            entityId: leadId,
            entityType: 'lead',
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
          personality: personality ? {
            primary: personality.primaryArchetype,
            secondary: personality.secondaryArchetype,
            churnRisk: personality.churnRisk,
            confidenceLevel: personality.confidenceLevel,
            smartTags: personality.smartTags,
            salesCheatSheet: personality.salesCheatSheet,
          } : null,
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
        <Button onClick={() => tn('/leads')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה ללידים</Button>
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
        <Button onClick={() => tn('/leads')} variant="ghost" icon={<ArrowRight size={18} />}>חזרה</Button>
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
        {isAdmin && (
          <Button onClick={() => setConfirmDeleteLead(true)} variant="danger" icon={<Trash2 size={16} />}>
            מחק ליד
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
                  const sections: Array<{ title: string; content: string }> = [];
                  // Contact info
                  const contactLines: string[] = [];
                  if (lead.phone) contactLines.push(`טלפון: ${lead.phone}`);
                  if (lead.email) contactLines.push(`אימייל: ${lead.email}`);
                  if (lead.businessName) contactLines.push(`עסק: ${lead.businessName}`);
                  if (lead.source) contactLines.push(`מקור: ${lead.source}`);
                  if (lead.assignedTo) contactLines.push(`אחראי: ${getUserName(lead.assignedTo) || ''}`);
                  if (contactLines.length > 0) sections.push({ title: 'פרטי קשר', content: contactLines.join('\n') });
                  // Services
                  if (activeServiceLabels.length > 0) sections.push({ title: 'שירותים מבוקשים', content: activeServiceLabels.join(', ') });
                  // Budget
                  if (lead.estimatedBudget) sections.push({ title: 'תקציב משוער', content: `₪${lead.estimatedBudget.toLocaleString('he-IL')}` });
                  // Notes
                  if (lead.notes) sections.push({ title: 'הערות', content: lead.notes });
                  // Recent CRM notes
                  const recentNotes = leadNotesFiltered.slice(0, 5).map(n => `${n.createdByName} (${formatDate(n.createdAt)}): ${n.content}`).join('\n\n');
                  if (recentNotes) sections.push({ title: 'הערות אחרונות', content: recentNotes });
                  generateCustomPdf({
                    title: `סיכום ליד — ${lead.leadName}`,
                    subtitle: lead.businessName || undefined,
                    kpis: [
                      { label: 'סטטוס', value: lead.status, color: '#14b8a6' },
                      ...(lead.estimatedBudget ? [{ label: 'תקציב', value: `₪${lead.estimatedBudget.toLocaleString('he-IL')}`, color: '#3b82f6' }] : []),
                      ...(activeServiceLabels.length > 0 ? [{ label: 'שירותים', value: String(activeServiceLabels.length), color: '#f59e0b' }] : []),
                    ],
                    sections,
                  }, brand);
                }}
                className="w-full text-right px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <FileText size={14} className="text-blue-400" />
                📋 סיכום ליד
              </button>
              {personality?.businessIntelV2 && (
                <button
                  onClick={() => {
                    setPdfDropdownOpen(false);
                    const brand = getBrandConfig(settings);
                    generatePersonalityPdf({
                      personality: personality!,
                      entityName: lead.leadName,
                      entityType: 'lead',
                    }, brand);
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
            {/* Social & Web URLs — always show */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">קישורים</span>
              <div className="flex flex-wrap items-center gap-2">
                {lead.facebookUrl ? (
                  <a href={lead.facebookUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs transition-all">
                    <Globe size={12} /> Facebook <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...lead }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-blue-500/30 text-blue-400/50 hover:text-blue-400 hover:border-blue-500/50 text-xs transition-all">
                    <Plus size={10} /> Facebook
                  </button>
                )}
                {lead.instagramUrl ? (
                  <a href={lead.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 text-xs transition-all">
                    <Globe size={12} /> Instagram <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...lead }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-pink-500/30 text-pink-400/50 hover:text-pink-400 hover:border-pink-500/50 text-xs transition-all">
                    <Plus size={10} /> Instagram
                  </button>
                )}
                {lead.websiteUrl ? (
                  <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 text-xs transition-all">
                    <Globe size={12} /> אתר <ExternalLink size={10} />
                  </a>
                ) : (
                  <button onClick={() => { setEditFormData({ ...lead }); setIsEditModalOpen(true); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-cyan-500/30 text-cyan-400/50 hover:text-cyan-400 hover:border-cyan-500/50 text-xs transition-all">
                    <Plus size={10} /> אתר
                  </button>
                )}
              </div>
            </div>
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
            {personality && (
              <button
                onClick={() => document.getElementById('lead-personality-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="p-3 rounded-xl border text-start transition-all hover:bg-white/[0.03] bg-[#0B1121] border-violet-500/20"
              >
                <div className="flex items-center gap-2">
                  <Brain size={14} className="text-violet-400" />
                  <span className="text-sm font-medium text-gray-200">
                    {ARCHETYPE_CONFIG[personality.primaryArchetype]?.icon} מודיעין אישיותי
                  </span>
                </div>
              </button>
            )}
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
                onClick={() => tn(`/clients/${lead.relatedClientId}`)}
              >
                צפה בכרטיס לקוח &larr;
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Section Reorder Controls */}
      <SectionReorder
        sections={LEAD_SECTIONS}
        order={leadSectionOrder}
        onReorder={setLeadOrder}
        onReset={resetLeadOrder}
      />

      {/* Sortable sections container */}
      <div className="flex flex-col gap-6" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ============ Signals OS Block ============ */}
      <div style={{ order: getLeadOrder('signals') }}>
      <Card id="lead-signals-section">
        <CardHeader
          title={<span className="flex items-center gap-2"><Brain size={18} className="text-violet-400" /> Signals OS</span>}
          subtitle={personality ? `נתונים התקבלו · ${formatDateTime(personality.receivedAt)}` : 'שליחת שאלון אישיות'}
        />

        {/* === STATE 1: No personality data — Send questionnaire === */}
        {!personality && (
          <div className="mt-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-sm text-amber-300/80">טרם נשלח שאלון אישיות לליד זה</span>
            </div>

            {/* Questionnaire link */}
            {(() => {
              const questionnaireUrl = `https://signals-os.alma-ads.co.il/widget?questionnaire=v3-biz-owner${lead.email ? `&subject_email=${encodeURIComponent(lead.email)}` : ''}${lead.leadName ? `&subject_name=${encodeURIComponent(lead.leadName)}` : ''}${lead.phone ? `&subject_phone=${encodeURIComponent(lead.phone)}` : ''}&external_id=${encodeURIComponent(lead.leadId)}&source_id=agencymanager-pro`;

              const defaultMessage = `יש לנו כלי אבחון שאנחנו בדרך כלל נותנים ללקוחות בתשלום,
אבל אני רוצה להראות לך את יכולת החשיבה שלנו לעסק שלך -
אז אני נותן לך את זה ללא תשלום.
זה שאלון קצר (3 דקות) שנותן לך דוח מפורט על:
✅ הסגנון הניהולי שלך
✅ החוזקות והאתגרים בעסק
✅ המלצות ספציפיות לצמיחה
אין שם תשובה נכונה או לא נכונה
וגם אם מרגיש לך ששתי התשובות נכונות, תבחר את מה שמרגיש לך יותר נכון.
זה כלי שיכול לתת לך תובנות כבר עכשיו לך, לעסק. אתה תופתע לדעתי
אם יש לך 2 דקות - כנס לפה:

${questionnaireUrl}

ואם בא לך, תשלח לי מה יצא - מעניין לראות`;

              // Initialize message text with default on first render
              const waMessage = signalsMessageText || defaultMessage;

              const waUrl = lead.phone
                ? `https://wa.me/${formatPhoneForWhatsApp(lead.phone)}?text=${encodeURIComponent(waMessage)}`
                : null;

              return (
                <div className="space-y-4">
                  {/* Editable message */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">הודעת שליחת שאלון</span>
                      <button
                        onClick={() => {
                          if (!signalsMessageEditing) {
                            if (!signalsMessageText) setSignalsMessageText(defaultMessage);
                            setSignalsMessageEditing(true);
                          } else {
                            setSignalsMessageEditing(false);
                          }
                        }}
                        className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                      >
                        <Edit3 size={12} />
                        {signalsMessageEditing ? 'סיים עריכה' : 'ערוך הודעה'}
                      </button>
                    </div>

                    {signalsMessageEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={signalsMessageText || defaultMessage}
                          onChange={e => setSignalsMessageText(e.target.value)}
                          className="w-full bg-[#0B1121] border border-violet-500/30 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-violet-500/60 resize-y custom-scrollbar"
                          rows={10}
                          dir="rtl"
                        />
                        <button
                          onClick={() => { setSignalsMessageText(''); setSignalsMessageEditing(false); }}
                          className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
                        >
                          ↩ חזור לטקסט ברירת מחדל
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (!signalsMessageText) setSignalsMessageText(defaultMessage);
                          setSignalsMessageEditing(true);
                        }}
                        className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-gray-400 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto custom-scrollbar cursor-pointer hover:border-violet-500/20 transition-colors"
                        dir="rtl"
                      >
                        {waMessage}
                      </div>
                    )}
                  </div>

                  {/* WhatsApp send button */}
                  {waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-3 w-full px-5 py-3.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 transition-all group"
                    >
                      <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
                      <span className="font-semibold text-sm">שלח שאלון Signals OS בוואטסאפ</span>
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-gray-500/5 border border-gray-500/15 text-gray-500 text-sm text-center">
                      אין מספר טלפון — לא ניתן לשלוח בוואטסאפ
                    </div>
                  )}

                  {/* Copy link button */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(questionnaireUrl);
                      const btn = document.getElementById('signals-copy-btn');
                      if (btn) { btn.textContent = '✓ הלינק הועתק!'; setTimeout(() => { btn.textContent = '🔗 העתק לינק לשאלון'; }, 2000); }
                    }}
                    id="signals-copy-btn"
                    className="w-full text-center px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm hover:bg-violet-500/20 transition-all"
                  >
                    🔗 העתק לינק לשאלון
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-gray-600 uppercase">או</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* PDF Upload — paste existing report */}
                  <div>
                    <input
                      ref={signalsPdfRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleSignalsPdfUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => signalsPdfRef.current?.click()}
                      disabled={isUploadingPDF}
                      className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {isUploadingPDF ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span className="text-sm">מנתח PDF ומייצר המלצות...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span className="text-sm font-medium">יש לך PDF של אבחון? העלה וקבל המלצות AI</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-gray-600 mt-1.5 text-center">העלה PDF של דוח Signals OS → AI ינתח ויייצר המלצות מותאמות</p>
                  </div>

                  {/* PDF Error/Success */}
                  {pdfError && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
                      <span>{pdfError}</span>
                      <button onClick={() => setPdfError(null)} className="text-red-400/60 hover:text-red-300 ms-2">✕</button>
                    </div>
                  )}
                  {pdfSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                      ✓ ה-PDF נותח בהצלחה! המלצות AI נוספו למטה בבלוק ההמלצות.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* === STATE 2: Has personality data — Show intelligence === */}
        {personality && (() => {
          const primaryCfg = ARCHETYPE_CONFIG[personality.primaryArchetype] || ARCHETYPE_CONFIG.WINNER;
          const secondaryCfg = ARCHETYPE_CONFIG[personality.secondaryArchetype] || ARCHETYPE_CONFIG.STAR;
          const archetypes: Archetype[] = ['WINNER', 'STAR', 'DREAMER', 'HEART', 'ANCHOR'];
          const maxScore = Math.max(...Object.values(personality.scores), 1);

          return (
            <div className="mt-4">
              {/* Row 1: Archetype badges + confidence + churn */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${primaryCfg.bgColor} border ${primaryCfg.borderColor}`}>
                  <span className="text-xl">{primaryCfg.icon}</span>
                  <div>
                    <div className={`text-sm font-bold ${primaryCfg.color}`}>{primaryCfg.nameHe}</div>
                    <div className="text-[10px] text-gray-500 uppercase">ראשי</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${secondaryCfg.bgColor} border ${secondaryCfg.borderColor}`}>
                  <span className="text-lg">{secondaryCfg.icon}</span>
                  <div>
                    <div className={`text-xs font-semibold ${secondaryCfg.color}`}>{secondaryCfg.nameHe}</div>
                    <div className="text-[10px] text-gray-500 uppercase">משני</div>
                  </div>
                </div>
                <Badge variant={personality.confidenceLevel === 'HIGH' ? 'success' : personality.confidenceLevel === 'MEDIUM' ? 'warning' : 'danger'}>
                  ביטחון: {CONFIDENCE_HE[personality.confidenceLevel] || personality.confidenceLevel}
                </Badge>
                <Badge variant={personality.churnRisk === 'LOW' ? 'success' : personality.churnRisk === 'MEDIUM' ? 'warning' : 'danger'}>
                  סיכון נטישה: {CHURN_RISK_HE[personality.churnRisk] || personality.churnRisk}
                </Badge>
              </div>

              {/* Row 2: Score bars */}
              <div className="space-y-2.5 mb-6">
                {archetypes.map(arch => {
                  const score = personality.scores[arch] || 0;
                  const pct = (score / maxScore) * 100;
                  const cfg = ARCHETYPE_CONFIG[arch];
                  const isPrimary = arch === personality.primaryArchetype;
                  return (
                    <div key={arch} className="flex items-center gap-3">
                      <span className="text-sm w-16 text-gray-400 shrink-0">{cfg.icon} {cfg.nameHe}</span>
                      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isPrimary ? 'opacity-100' : 'opacity-50'}`}
                          style={{ width: `${pct}%`, backgroundColor: cfg.barColor }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-8 text-end ${isPrimary ? 'text-white font-bold' : 'text-gray-500'}`}>
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Row 3: Smart tags */}
              {personality.smartTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {personality.smartTags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-300 text-xs border border-violet-500/20">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* ============ V2 Business Intelligence ============ */}
              {personality.businessIntelV2 && (() => {
                const v2 = personality.businessIntelV2;
                const hero = v2.heroCard;
                const qs = v2.quickScript;
                const actions = v2.actionItems || [];
                const flags = v2.redFlags || [];
                const script = v2.fullScript;

                return (
                  <div className="space-y-3 mb-6">
                    {/* V2 Hero Card */}
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
                              <Star key={i} size={12} className="text-gray-700" />
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

                    {/* V2 Quick Script */}
                    {qs && (
                      <div className="p-4 rounded-xl bg-[#0B1121] border border-blue-500/15">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquare size={14} className="text-blue-400" />
                          <span className="text-sm font-medium text-gray-200">תסריט מהיר</span>
                        </div>
                        <div className="space-y-2.5">
                          <div className="flex gap-2">
                            <span className="text-xs text-blue-400 w-16 shrink-0 font-medium">פתיחה</span>
                            <span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.opener}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-xs text-blue-400 w-16 shrink-0 font-medium">שאלת מפתח</span>
                            <span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.keyQuestion}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-xs text-blue-400 w-16 shrink-0 font-medium">סגירה</span>
                            <span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{qs.closeLine}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* V2 Action Items */}
                    {actions.length > 0 && (
                      <div className="p-4 rounded-xl bg-[#0B1121] border border-emerald-500/15">
                        <div className="flex items-center gap-2 mb-3">
                          <ListChecks size={14} className="text-emerald-400" />
                          <span className="text-sm font-medium text-gray-200">3 פעולות מומלצות</span>
                        </div>
                        <div className="space-y-3">
                          {actions.map((item, i) => (
                            <div key={i} className="flex gap-3">
                              <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                {item.priority}
                              </div>
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

                    {/* V2 Red Flags */}
                    {flags.length > 0 && (
                      <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle size={13} className="text-red-400" />
                          <span className="text-xs font-medium text-red-300">דגלים אדומים — מה יהרוג את העסקה</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {flags.map((flag, i) => (
                            <span key={i} className="px-2 py-1 rounded-md bg-red-500/10 text-red-300 text-xs">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* V2 Full 5-Door Script (expandable) */}
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
                                {script.profileBriefing.goalForCall && (
                                  <p className="text-xs text-amber-300/80 mt-2">🎯 {script.profileBriefing.goalForCall}</p>
                                )}
                                {script.profileBriefing.timeAllocation && (
                                  <p className="text-xs text-gray-500 mt-1">⏱ {script.profileBriefing.timeAllocation}</p>
                                )}
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
                                          {door.profileInsight && (
                                            <p className="text-[10px] text-violet-400/80 mt-1">💡 {door.profileInsight}</p>
                                          )}
                                          {door.critical && (
                                            <p className="text-[10px] text-red-400/80 mt-1">⚠️ {door.critical}</p>
                                          )}
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
                                    <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                      <span className="text-emerald-400 mt-0.5">☐</span>
                                      {item}
                                    </li>
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

                            {/* Profile Insights + Retention Strategy */}
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
                );
              })()}

              {/* Row 4: Sales Cheat Sheet (expandable) */}
              {Object.keys(personality.salesCheatSheet).length > 0 && (
                <div className="border border-white/5 rounded-xl mb-3 overflow-hidden">
                  <button
                    onClick={() => setSalesSheetExpanded(!salesSheetExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-amber-400" />
                      <span className="text-sm font-medium text-gray-200">גיליון מכירות</span>
                    </div>
                    {salesSheetExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </button>
                  {salesSheetExpanded && (
                    <div className="px-4 pb-4 space-y-0">
                      {Object.entries(personality.salesCheatSheet).map(([key, value]) => {
                        const displayValue = Array.isArray(value) ? value.join(', ') : String(value || '');
                        const isLong = displayValue.length > 80;
                        return (
                          <div key={key} className={`${isLong ? 'flex flex-col gap-1' : 'flex gap-3'} py-2 border-b border-white/5 last:border-0`}>
                            <span className={`text-xs text-gray-500 ${isLong ? '' : 'w-28'} shrink-0 font-medium`}>{SALES_SHEET_LABELS[key] || key}</span>
                            <span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Row 5: Retention Cheat Sheet (expandable) */}
              {Object.keys(personality.retentionCheatSheet).length > 0 && (
                <div className="border border-white/5 rounded-xl mb-3 overflow-hidden">
                  <button
                    onClick={() => setRetentionSheetExpanded(!retentionSheetExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-cyan-400" />
                      <span className="text-sm font-medium text-gray-200">גיליון שימור</span>
                    </div>
                    {retentionSheetExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </button>
                  {retentionSheetExpanded && (
                    <div className="px-4 pb-4 space-y-0">
                      {Object.entries(personality.retentionCheatSheet).map(([key, value]) => {
                        const displayValue = String(value || '');
                        const isLong = displayValue.length > 80;
                        return (
                          <div key={key} className={`${isLong ? 'flex flex-col gap-1' : 'flex gap-3'} py-2 border-b border-white/5 last:border-0`}>
                            <span className={`text-xs text-gray-500 ${isLong ? '' : 'w-28'} shrink-0 font-medium`}>{RETENTION_SHEET_LABELS[key] || key}</span>
                            <span className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Row 5b: Business Report (full text — expandable) */}
              {personality.businessReport && (
                <div className="border border-white/5 rounded-xl mb-3 overflow-hidden">
                  <button
                    onClick={() => setBusinessReportExpanded(!businessReportExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-emerald-400" />
                      <span className="text-sm font-medium text-gray-200">דוח מודיעין עסקי</span>
                    </div>
                    {businessReportExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </button>
                  {businessReportExpanded && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto custom-scrollbar">{personality.businessReport}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Row 5c: User Report (full text — expandable) */}
              {personality.userReport && (
                <div className="border border-white/5 rounded-xl mb-3 overflow-hidden">
                  <button
                    onClick={() => setUserReportExpanded(!userReportExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-violet-400" />
                      <span className="text-sm font-medium text-gray-200">דוח אישי</span>
                    </div>
                    {userReportExpanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                  </button>
                  {userReportExpanded && (
                    <div className="px-4 pb-4">
                      <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto custom-scrollbar">{personality.userReport}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Row 6: Actions — report link + PDF upload + generate recommendations */}
              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                {personality.resultUrl && (
                  <a
                    href={personality.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-xs hover:underline flex items-center gap-1.5"
                  >
                    <ExternalLink size={12} /> צפה בדוח המלא ב-Signals OS
                  </a>
                )}

                {/* PDF upload for deeper analysis */}
                <div className="flex gap-2">
                  <input
                    ref={signalsPdfRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleSignalsPdfUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => signalsPdfRef.current?.click()}
                    disabled={isUploadingPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20 transition-all text-xs disabled:opacity-50"
                  >
                    {isUploadingPDF ? (
                      <><Loader2 size={14} className="animate-spin" /> מנתח PDF...</>
                    ) : (
                      <><Upload size={14} /> העלה PDF לניתוח מעמיק</>
                    )}
                  </button>
                  <button
                    onClick={handleGetRecommendations}
                    disabled={isLoadingAI}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 transition-all text-xs disabled:opacity-50"
                  >
                    {isLoadingAI ? (
                      <><Loader2 size={14} className="animate-spin" /> מייצר...</>
                    ) : (
                      <><Sparkles size={14} /> ייצר המלצות AI</>
                    )}
                  </button>
                </div>

                {pdfError && (
                  <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
                    <span>{pdfError}</span>
                    <button onClick={() => setPdfError(null)} className="text-red-400/60 hover:text-red-300 ms-2">✕</button>
                  </div>
                )}
                {pdfSuccess && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                    ✓ ה-PDF נותח! המלצות נוספו לבלוק ההמלצות.
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Card>
      </div>{/* end signals order wrapper */}

      {/* Competitor Scout */}
      <div style={{ order: getLeadOrder('competitor') }}>
      {(() => {
        const leadReportsScout = competitorReports.filter(r => r.entityId === leadId && r.entityType === 'lead');
        const latestReport = leadReportsScout[0];

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
                    // Build rich context from lead data, notes, and transcripts
                    const contextParts: string[] = [];
                    if (lead.facebookUrl) contextParts.push(`Facebook: ${lead.facebookUrl}`);
                    if (lead.instagramUrl) contextParts.push(`Instagram: ${lead.instagramUrl}`);
                    if (lead.notes) contextParts.push(`הערות: ${lead.notes.substring(0, 300)}`);
                    if (lead.sourceChannel) contextParts.push(`מקור: ${lead.sourceChannel}`);
                    if (lead.quotedMonthlyValue) contextParts.push(`הצעת מחיר: ₪${lead.quotedMonthlyValue}`);
                    // Add recent notes for more context
                    const recentNotes = leadNotesFiltered.slice(0, 3).map(n => n.content.substring(0, 100)).join('; ');
                    if (recentNotes) contextParts.push(`הערות אחרונות: ${recentNotes}`);
                    // Add transcript summaries for industry context
                    const recentSummaries = leadTranscripts.slice(0, 2).map(ct => ct.summary?.substring(0, 150)).filter(Boolean).join('; ');
                    if (recentSummaries) contextParts.push(`סיכומי שיחות: ${recentSummaries}`);

                    await runCompetitorScout({
                      entityId: leadId!,
                      entityType: 'lead',
                      businessName: lead.businessName || lead.leadName,
                      industry: '',
                      website: lead.websiteUrl,
                      services: (lead.interestedServices || []).map(sk => {
                        const svc = services.find(s => s.serviceKey === sk);
                        return svc ? svc.label : sk;
                      }),
                      additionalContext: contextParts.join('\n') || undefined,
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

      {/* Notes History (manual only — AI summaries shown in separate section) */}
      <div style={{ order: getLeadOrder('notes') }}>
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
      </div>{/* end notes order wrapper */}

      {/* Call Transcripts Section */}
      <div style={{ order: getLeadOrder('transcripts') }}>
      <Card id="lead-transcripts-section">
        <div className="flex items-center justify-between mb-4">
          <CardHeader title="תמלולי שיחות" subtitle={`${leadTranscripts.length} תמלולים`} />
          <div className="flex items-center gap-2">
            {settings.hasGeminiKey && (
              <>
                <VoiceRecorderButton
                  entityType="lead"
                  entityId={leadId!}
                  entityName={lead.leadName}
                  businessName={lead.businessName || ''}
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
      </div>{/* end transcripts order wrapper */}

      {/* AI Recommendations */}
      <div style={{ order: getLeadOrder('ai-recommendations') }}>
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
      </div>{/* end ai-recommendations order wrapper */}

      {/* AI Summaries Section */}
      <div style={{ order: getLeadOrder('ai-summaries') }}>
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
              const typeLabel = summary.noteType === 'transcript_summary' ? '📝 סיכום תמלול' : summary.noteType === 'proposal_focus' ? '🎯 מיקוד להצעת מחיר' : summary.noteType === 'personality_insight' ? '🧠 תובנת אישיות' : '💡 סיכום המלצות';
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
      </div>{/* end ai-summaries order wrapper */}

      <div style={{ order: getLeadOrder('notebook') }}>
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
                  <p className="text-gray-600 text-sm">שאל כל שאלה על הליד...</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['מה הסטטוס הנוכחי?', 'איך לדבר עם הליד?', 'מה הצרכים שלו?', 'תמליץ על פעולות'].map(q => (
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
                placeholder="שאל שאלה על הליד..."
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

      <div style={{ order: getLeadOrder('strategy') }}>
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
          const leadStrategies = strategyPlans.filter(s => s.leadId === leadId);
          if (leadStrategies.length === 0 && !isGeneratingStrategy) {
            return (
              <p className="text-gray-600 text-sm text-center py-6 italic">
                לחץ על &quot;צור אסטרטגיה&quot; לקבלת ניתוח מצב מעמיק ותוכנית עבודה מבוססת כל המידע במערכת
              </p>
            );
          }
          return (
            <div className="space-y-3">
              {leadStrategies.map(strategy => {
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
                                  entityType: 'lead',
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
                                  entityType: 'lead',
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
                                    entityType: 'lead',
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
                      entityType: 'lead',
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

      {/* Animated Proposals */}
      <div style={{ order: getLeadOrder('proposals') }}>
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardHeader title={<span className="flex items-center gap-2"><FileText size={18} className="text-amber-400" /> הצעות מחיר מונפשות</span>} />
          <Button
            onClick={() => {
              // Build default form from lead data + settings templates
              const defaultPhases: ProposalPhase[] = settings.proposalPhasesTemplate || [
                { number: 1, title: 'אפיון ומחקר', description: 'הבנת העסק, קהל היעד והתחרות', duration: 'שבוע 1' },
                { number: 2, title: 'בניית אסטרטגיה', description: 'תכנון תוכן, ערוצים ומסרים', duration: 'שבוע 2' },
                { number: 3, title: 'הקמה והשקה', description: 'הקמת קמפיינים, עיצוב חומרים ותחילת עבודה', duration: 'שבוע 3-4' },
              ];
              const leadServices = (lead.interestedServices || []).map(s => {
                const svc = services.find(sv => sv.serviceKey === s);
                return svc?.label || s;
              });
              const defaultPackages: ProposalPackage[] = settings.proposalPackagesTemplate || [
                {
                  name: 'חבילה בסיסית',
                  isRecommended: false,
                  services: leadServices.map(s => ({ label: s, included: true })),
                  monthlyPrice: lead.quotedMonthlyValue || 0,
                },
                {
                  name: 'חבילה מומלצת',
                  isRecommended: true,
                  services: leadServices.map(s => ({ label: s, included: true })),
                  monthlyPrice: lead.quotedMonthlyValue ? Math.round(lead.quotedMonthlyValue * 1.3) : 0,
                },
                {
                  name: 'חבילת פרימיום',
                  isRecommended: false,
                  services: leadServices.map(s => ({ label: s, included: true })),
                  monthlyPrice: lead.quotedMonthlyValue ? Math.round(lead.quotedMonthlyValue * 1.8) : 0,
                },
              ];
              const defaultTerms: string[] = settings.proposalTermsTemplate || [
                'ההצעה בתוקף ל-14 יום מתאריך הפקתה',
                'התשלום יתבצע מדי חודש בהוראת קבע או העברה בנקאית',
                'תקופת ההתקשרות המינימלית: 3 חודשים',
                'ביטול השירות כרוך בהודעה מראש של 30 יום',
              ];
              setProposalForm({
                proposalName: `הצעת מחיר — ${lead.businessName || lead.leadName}`,
                introText: '',
                phases: defaultPhases,
                packages: defaultPackages,
                terms: defaultTerms,
                validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
              });
              setEditingProposal(null);
              setIsProposalEditorOpen(true);
            }}
            icon={<Plus size={16} />}
          >
            צור הצעה חדשה
          </Button>
        </div>

        {(() => {
          const leadProposals = proposals.filter(p => p.leadId === leadId);
          if (leadProposals.length === 0) {
            return <p className="text-gray-600 text-sm text-center py-6 italic">לחץ על "צור הצעה חדשה" כדי ליצור הצעת מחיר מונפשת</p>;
          }

          const statusBadge = (status: string) => {
            const map: Record<string, { color: string; label: string }> = {
              draft: { color: 'bg-gray-500/20 text-gray-300 border-gray-500/30', label: 'טיוטה' },
              sent: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', label: 'נשלחה' },
              viewed: { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', label: 'נצפתה' },
              signed: { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', label: 'נחתמה ✓' },
              rejected: { color: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'נדחתה' },
            };
            const info = map[status] || map.draft;
            return <span className={`px-2 py-0.5 rounded-full text-xs border ${info.color}`}>{info.label}</span>;
          };

          return (
            <div className="space-y-3">
              {leadProposals.map(prop => {
                const isExpanded = expandedProposalId === prop.id;
                return (
                  <div key={prop.id} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                    {/* Collapsed header */}
                    <button
                      className="w-full flex items-center justify-between p-4 text-start hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedProposalId(isExpanded ? null : prop.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText size={16} className="text-amber-400 flex-shrink-0" />
                        <span className="text-white font-medium truncate">{prop.proposalName}</span>
                        {statusBadge(prop.status)}
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-xs">
                        <span>{formatDate(prop.createdAt)}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/5 space-y-3">
                        {/* Package summary */}
                        {prop.proposalData?.packages?.length > 0 && (
                          <div className="pt-3">
                            <p className="text-xs text-gray-400 mb-2">חבילות:</p>
                            <div className="flex flex-wrap gap-2">
                              {prop.proposalData.packages.map((pkg: ProposalPackage, i: number) => (
                                <span key={i} className={`px-2 py-1 rounded-lg text-xs ${pkg.isRecommended ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                                  {pkg.name} — {formatCurrency(pkg.monthlyPrice)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Signature info (if signed) */}
                        {prop.signatureData && (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <p className="text-emerald-300 text-sm font-medium mb-1">✅ נחתמה בהצלחה</p>
                            <div className="text-xs text-gray-400 space-y-0.5">
                              <p>שם: {prop.signatureData.name}</p>
                              <p>אימייל: {prop.signatureData.email}</p>
                              <p>חבילה שנבחרה: {prop.signatureData.selectedPackage}</p>
                              <p>תאריך חתימה: {formatDateTime(prop.signatureData.signedAt)}</p>
                            </div>
                          </div>
                        )}

                        {/* Public URL */}
                        {prop.publicUrl && (
                          <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <Link2 size={14} className="text-blue-400 flex-shrink-0" />
                            <a href={prop.publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs truncate flex-1 hover:underline">{prop.publicUrl}</a>
                            <button
                              className="text-gray-400 hover:text-white transition-colors p-1"
                              onClick={() => {
                                navigator.clipboard.writeText(prop.publicUrl!);
                                setCopiedProposalUrl(prop.id);
                                setTimeout(() => setCopiedProposalUrl(null), 2000);
                              }}
                            >
                              {copiedProposalUrl === prop.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                            </button>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingProposal(prop);
                              setProposalForm({
                                proposalName: prop.proposalName,
                                introText: prop.proposalData?.introText || '',
                                phases: prop.proposalData?.phases || [],
                                packages: prop.proposalData?.packages || [],
                                terms: prop.proposalData?.terms?.items || [],
                                validUntil: prop.proposalData?.validUntil || '',
                              });
                              setIsProposalEditorOpen(true);
                            }}
                            icon={<Edit3 size={14} />}
                          >
                            עריכה
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const brand = getBrandConfig(settings);
                              const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-webhook`;
                              generateAnimatedProposal({
                                proposalId: prop.id,
                                businessName: prop.proposalData?.businessName || lead.businessName || lead.leadName,
                                contactName: prop.proposalData?.contactName || lead.leadName,
                                introText: prop.proposalData?.introText,
                                packages: prop.proposalData?.packages || [],
                                phases: prop.proposalData?.phases || [],
                                terms: prop.proposalData?.terms || { items: [] },
                                validUntil: prop.proposalData?.validUntil,
                                webhookUrl,
                              }, brand);
                            }}
                            icon={<ExternalLink size={14} />}
                          >
                            תצוגה מקדימה
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPublishingProposal === prop.id}
                            onClick={async () => {
                              setIsPublishingProposal(prop.id);
                              try {
                                const brand = getBrandConfig(settings);
                                const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-webhook`;
                                const html = buildAnimatedProposalHtml({
                                  proposalId: prop.id,
                                  businessName: prop.proposalData?.businessName || lead.businessName || lead.leadName,
                                  contactName: prop.proposalData?.contactName || lead.leadName,
                                  introText: prop.proposalData?.introText,
                                  packages: prop.proposalData?.packages || [],
                                  phases: prop.proposalData?.phases || [],
                                  terms: prop.proposalData?.terms || { items: [] },
                                  validUntil: prop.proposalData?.validUntil,
                                  webhookUrl,
                                }, brand);
                                const url = await publishProposalPage(prop.id, html);
                                if (url) {
                                  navigator.clipboard.writeText(url);
                                  setCopiedProposalUrl(prop.id);
                                  setTimeout(() => setCopiedProposalUrl(null), 3000);
                                }
                              } finally {
                                setIsPublishingProposal(null);
                              }
                            }}
                            icon={isPublishingProposal === prop.id ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                          >
                            {prop.publicUrl ? 'עדכן לינק' : 'פרסם לינק'}
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => setConfirmDeleteProposalId(prop.id)}
                              icon={<Trash2 size={14} />}
                            >
                              מחק
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>
      </div>{/* end proposals order wrapper */}

      {/* WhatsApp Messages */}
      <div style={{ order: getLeadOrder('whatsapp') }}>
      <Card id="lead-whatsapp-section">
        <div className="flex items-center justify-between mb-4">
          <CardHeader
            title="הודעות WhatsApp"
            subtitle={leadWAMessages.length > 0 ? `${leadWAMessages.length} הודעות${leadWAMessages[0] ? ` · אחרונה: ${formatDate(leadWAMessages[0].sentAt)}` : ''}` : 'שלח הודעות לליד'}
          />
        </div>

        {/* Personality-aware indicator */}
        {personality?.primaryArchetype && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <Brain size={16} className="text-purple-400 shrink-0" />
            <span className="text-purple-300 text-sm">
              הודעות מותאמות לפרופיל <strong>{personality.primaryArchetype === 'WINNER' ? 'המנצח' : personality.primaryArchetype === 'STAR' ? 'הכוכב' : personality.primaryArchetype === 'DREAMER' ? 'החולם' : personality.primaryArchetype === 'HEART' ? 'הלב' : personality.primaryArchetype === 'ANCHOR' ? 'העוגן' : personality.primaryArchetype}</strong>
              {personality.salesCheatSheet?.how_to_speak && (
                <> · <span className="text-purple-400/70">{personality.salesCheatSheet.how_to_speak.substring(0, 60)}{personality.salesCheatSheet.how_to_speak.length > 60 ? '...' : ''}</span></>
              )}
            </span>
          </div>
        )}

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
                {isGeneratingWA ? 'יוצר...' : personality?.primaryArchetype ? '🧠 צור הודעות מותאמות' : 'צור הודעות'}
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
      </div>{/* end whatsapp order wrapper */}

      {/* Activity Timeline */}
      <div style={{ order: getLeadOrder('activity') }}>
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
      </div>{/* end activity order wrapper */}

      </div>{/* end sortable sections container */}

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
            {/* Social / Web URLs */}
            <div className="grid grid-cols-3 gap-4">
              <Input label="עמוד פייסבוק" placeholder="https://facebook.com/..." value={editFormData.facebookUrl || ''} onChange={e => setEditFormData({...editFormData, facebookUrl: e.target.value})} />
              <Input label="עמוד אינסטגרם" placeholder="https://instagram.com/..." value={editFormData.instagramUrl || ''} onChange={e => setEditFormData({...editFormData, instagramUrl: e.target.value})} />
              <Input label="כתובת אתר" placeholder="https://..." value={editFormData.websiteUrl || ''} onChange={e => setEditFormData({...editFormData, websiteUrl: e.target.value})} />
            </div>
            <Textarea label="הערות" value={editFormData.notes || ''} onChange={e => setEditFormData({...editFormData, notes: e.target.value})} />
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>ביטול</Button>
              <Button type="submit">שמור</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Delete Lead Modal */}
      {/* Confirm Delete Proposal Modal */}
      <Modal isOpen={!!confirmDeleteProposalId} onClose={() => setConfirmDeleteProposalId(null)} title="מחיקת הצעת מחיר" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את הצעת המחיר?</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteProposalId(null)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => {
              if (confirmDeleteProposalId) {
                await deleteProposal(confirmDeleteProposalId);
                setConfirmDeleteProposalId(null);
              }
            }}>מחק</Button>
          </div>
        </div>
      </Modal>

      {/* Proposal Editor Modal */}
      <Modal isOpen={isProposalEditorOpen} onClose={() => setIsProposalEditorOpen(false)} title={editingProposal ? 'עריכת הצעת מחיר' : 'הצעת מחיר חדשה'} size="xl">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar pe-2">
          {/* Proposal name */}
          <Input
            label="שם ההצעה"
            value={proposalForm.proposalName}
            onChange={e => setProposalForm({ ...proposalForm, proposalName: e.target.value })}
            required
          />

          {/* Intro text */}
          <Textarea
            label="טקסט מבוא (אופציונלי)"
            value={proposalForm.introText}
            onChange={e => setProposalForm({ ...proposalForm, introText: e.target.value })}
            rows={2}
            placeholder="פסקה קצרה שתופיע בתחילת ההצעה..."
          />

          {/* Validity date */}
          <Input
            label="תוקף ההצעה"
            type="date"
            value={proposalForm.validUntil}
            onChange={e => setProposalForm({ ...proposalForm, validUntil: e.target.value })}
          />

          {/* Work Phases */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">שלבי עבודה</h4>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => {
                setProposalForm({
                  ...proposalForm,
                  phases: [...proposalForm.phases, { number: proposalForm.phases.length + 1, title: '', description: '', duration: '' }]
                });
              }}>הוסף שלב</Button>
            </div>
            <div className="space-y-3">
              {proposalForm.phases.map((phase, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">שלב {idx + 1}</span>
                    <button
                      className="text-red-400 hover:text-red-300 text-xs"
                      onClick={() => {
                        const newPhases = proposalForm.phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, number: i + 1 }));
                        setProposalForm({ ...proposalForm, phases: newPhases });
                      }}
                    >הסר</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="כותרת השלב"
                      value={phase.title}
                      onChange={e => {
                        const newPhases = [...proposalForm.phases];
                        newPhases[idx] = { ...newPhases[idx], title: e.target.value };
                        setProposalForm({ ...proposalForm, phases: newPhases });
                      }}
                    />
                    <Input
                      placeholder="משך (למשל: שבוע 1)"
                      value={phase.duration || ''}
                      onChange={e => {
                        const newPhases = [...proposalForm.phases];
                        newPhases[idx] = { ...newPhases[idx], duration: e.target.value };
                        setProposalForm({ ...proposalForm, phases: newPhases });
                      }}
                    />
                  </div>
                  <Textarea
                    placeholder="תיאור השלב"
                    value={phase.description}
                    onChange={e => {
                      const newPhases = [...proposalForm.phases];
                      newPhases[idx] = { ...newPhases[idx], description: e.target.value };
                      setProposalForm({ ...proposalForm, phases: newPhases });
                    }}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Packages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">חבילות תמחור</h4>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => {
                setProposalForm({
                  ...proposalForm,
                  packages: [...proposalForm.packages, { name: '', isRecommended: false, services: [], monthlyPrice: 0 }]
                });
              }}>הוסף חבילה</Button>
            </div>
            <div className="space-y-3">
              {proposalForm.packages.map((pkg, idx) => (
                <div key={idx} className={`bg-white/5 rounded-xl p-3 border ${pkg.isRecommended ? 'border-amber-500/40' : 'border-white/10'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">חבילה {idx + 1}</span>
                      <label className="flex items-center gap-1 text-xs text-amber-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pkg.isRecommended}
                          onChange={e => {
                            const newPkgs = proposalForm.packages.map((p, i) => ({ ...p, isRecommended: i === idx ? e.target.checked : false }));
                            setProposalForm({ ...proposalForm, packages: newPkgs });
                          }}
                          className="rounded border-white/20"
                        />
                        מומלצת
                      </label>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300 text-xs"
                      onClick={() => {
                        setProposalForm({ ...proposalForm, packages: proposalForm.packages.filter((_, i) => i !== idx) });
                      }}
                    >הסר</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="שם החבילה"
                      value={pkg.name}
                      onChange={e => {
                        const newPkgs = [...proposalForm.packages];
                        newPkgs[idx] = { ...newPkgs[idx], name: e.target.value };
                        setProposalForm({ ...proposalForm, packages: newPkgs });
                      }}
                    />
                    <Input
                      placeholder="מחיר חודשי"
                      type="number"
                      value={pkg.monthlyPrice || ''}
                      onChange={e => {
                        const newPkgs = [...proposalForm.packages];
                        newPkgs[idx] = { ...newPkgs[idx], monthlyPrice: Number(e.target.value) };
                        setProposalForm({ ...proposalForm, packages: newPkgs });
                      }}
                    />
                    <Input
                      placeholder="עלות הקמה (אופציונלי)"
                      type="number"
                      value={pkg.setupPrice || ''}
                      onChange={e => {
                        const newPkgs = [...proposalForm.packages];
                        newPkgs[idx] = { ...newPkgs[idx], setupPrice: Number(e.target.value) || undefined };
                        setProposalForm({ ...proposalForm, packages: newPkgs });
                      }}
                    />
                  </div>
                  {/* Services checklist */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">שירותים בחבילה:</p>
                    <div className="space-y-1">
                      {pkg.services.map((svc, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={svc.included}
                            onChange={e => {
                              const newPkgs = [...proposalForm.packages];
                              const newServices = [...newPkgs[idx].services];
                              newServices[sIdx] = { ...newServices[sIdx], included: e.target.checked };
                              newPkgs[idx] = { ...newPkgs[idx], services: newServices };
                              setProposalForm({ ...proposalForm, packages: newPkgs });
                            }}
                            className="rounded border-white/20"
                          />
                          <input
                            type="text"
                            value={svc.label}
                            onChange={e => {
                              const newPkgs = [...proposalForm.packages];
                              const newServices = [...newPkgs[idx].services];
                              newServices[sIdx] = { ...newServices[sIdx], label: e.target.value };
                              newPkgs[idx] = { ...newPkgs[idx], services: newServices };
                              setProposalForm({ ...proposalForm, packages: newPkgs });
                            }}
                            className="flex-1 bg-transparent text-sm text-gray-300 border-b border-white/10 focus:border-primary focus:outline-none py-0.5"
                          />
                          <button
                            className="text-red-400 hover:text-red-300 text-xs"
                            onClick={() => {
                              const newPkgs = [...proposalForm.packages];
                              newPkgs[idx] = { ...newPkgs[idx], services: newPkgs[idx].services.filter((_, si) => si !== sIdx) };
                              setProposalForm({ ...proposalForm, packages: newPkgs });
                            }}
                          >✕</button>
                        </div>
                      ))}
                      <button
                        className="text-xs text-primary hover:text-primary/80 mt-1"
                        onClick={() => {
                          const newPkgs = [...proposalForm.packages];
                          newPkgs[idx] = { ...newPkgs[idx], services: [...newPkgs[idx].services, { label: '', included: true }] };
                          setProposalForm({ ...proposalForm, packages: newPkgs });
                        }}
                      >+ הוסף שירות</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">תנאים (שורה אחת לכל תנאי)</label>
            <Textarea
              value={proposalForm.terms.join('\n')}
              onChange={e => setProposalForm({ ...proposalForm, terms: e.target.value.split('\n') })}
              rows={4}
              placeholder="כל שורה תהפוך לפריט ברשימת התנאים..."
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-between items-center gap-3 pt-4 mt-4 border-t border-white/10">
          <Button variant="ghost" onClick={() => setIsProposalEditorOpen(false)}>ביטול</Button>
          <div className="flex gap-2">
            {/* Save as draft */}
            <Button variant="ghost" onClick={async () => {
              const proposalData: ProposalData = {
                businessName: lead.businessName || lead.leadName,
                contactName: lead.leadName,
                introText: proposalForm.introText || undefined,
                packages: proposalForm.packages,
                phases: proposalForm.phases,
                terms: { items: proposalForm.terms.filter(t => t.trim()) },
                validUntil: proposalForm.validUntil || undefined,
              };
              if (editingProposal) {
                await updateProposal({ ...editingProposal, proposalName: proposalForm.proposalName, proposalData });
              } else {
                await addProposal({
                  leadId: leadId!,
                  proposalName: proposalForm.proposalName,
                  proposalData,
                  status: 'draft',
                  createdBy: user?.id || '',
                  createdByName: currentUserName || '',
                });
              }
              setIsProposalEditorOpen(false);
            }}>שמור כטיוטה</Button>

            {/* Preview */}
            <Button variant="ghost" onClick={() => {
              const brand = getBrandConfig(settings);
              const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-webhook`;
              generateAnimatedProposal({
                proposalId: editingProposal?.id || 'preview',
                businessName: lead.businessName || lead.leadName,
                contactName: lead.leadName,
                introText: proposalForm.introText || undefined,
                packages: proposalForm.packages,
                phases: proposalForm.phases,
                terms: { items: proposalForm.terms.filter(t => t.trim()) },
                validUntil: proposalForm.validUntil || undefined,
                webhookUrl,
              }, brand);
            }} icon={<ExternalLink size={14} />}>תצוגה מקדימה</Button>

            {/* Publish & send */}
            <Button onClick={async () => {
              const proposalData: ProposalData = {
                businessName: lead.businessName || lead.leadName,
                contactName: lead.leadName,
                introText: proposalForm.introText || undefined,
                packages: proposalForm.packages,
                phases: proposalForm.phases,
                terms: { items: proposalForm.terms.filter(t => t.trim()) },
                validUntil: proposalForm.validUntil || undefined,
              };

              let proposalId = editingProposal?.id;
              if (editingProposal) {
                await updateProposal({ ...editingProposal, proposalName: proposalForm.proposalName, proposalData });
              } else {
                proposalId = await addProposal({
                  leadId: leadId!,
                  proposalName: proposalForm.proposalName,
                  proposalData,
                  status: 'draft',
                  createdBy: user?.id || '',
                  createdByName: currentUserName || '',
                });
              }

              if (proposalId) {
                const brand = getBrandConfig(settings);
                const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proposal-webhook`;
                const html = buildAnimatedProposalHtml({
                  proposalId,
                  businessName: proposalData.businessName,
                  contactName: proposalData.contactName,
                  introText: proposalData.introText,
                  packages: proposalData.packages,
                  phases: proposalData.phases,
                  terms: proposalData.terms,
                  validUntil: proposalData.validUntil,
                  webhookUrl,
                }, brand);
                const url = await publishProposalPage(proposalId, html);
                if (url) {
                  navigator.clipboard.writeText(url);
                }
              }
              setIsProposalEditorOpen(false);
            }} icon={<Send size={14} />}>פרסם ושלח</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDeleteLead} onClose={() => setConfirmDeleteLead(false)} title="מחיקת ליד">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך למחוק את הליד <b className="text-white">{lead.leadName}</b>?</p>
          <p className="text-sm text-red-400">פעולה זו בלתי הפיכה. כל ההערות, התמלולים וההמלצות הקשורות יישארו במערכת.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button type="button" variant="ghost" onClick={() => setConfirmDeleteLead(false)}>ביטול</Button>
            <Button type="button" variant="danger" onClick={async () => {
              await deleteLead(lead.leadId);
              setConfirmDeleteLead(false);
              tn('/leads');
            }}>מחק ליד</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default LeadProfile;
