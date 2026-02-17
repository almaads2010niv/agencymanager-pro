import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppData, Client, Lead, OneTimeDeal, SupplierExpense, Payment, Service,
  AgencySettings, PaymentStatus, LeadStatus, ClientStatus, ClientRating, EffortLevel,
  ActivityEntry, RetainerChange, ClientNote, LeadNote, CallTranscript, AIRecommendation,
  WhatsAppMessage, NoteType, SignalsPersonality, Archetype, ConfidenceLevel, ChurnRisk
} from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS } from '../constants';
import { generateId } from '../utils';
import { supabase } from '../lib/supabaseClient';

// --- DB Row types (snake_case) ---
interface ClientRow {
  client_id: string;
  client_name: string;
  business_name: string;
  phone: string;
  email: string;
  industry: string;
  rating: string;
  status: string;
  join_date: string;
  churn_date: string | null;
  monthly_retainer: number;
  billing_day: number;
  services: string | string[];
  effort_level: string;
  supplier_cost_monthly: number;
  notes: string;
  next_review_date: string;
  added_at: string;
  assigned_to: string | null;
}

interface ClientNoteRow {
  id: string;
  client_id: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  note_type?: string;
  source_id?: string | null;
}

interface LeadRow {
  lead_id: string;
  created_at: string;
  lead_name: string;
  business_name: string;
  phone: string;
  email: string;
  source_channel: string;
  interested_services: string | string[];
  notes: string;
  next_contact_date: string;
  status: string;
  quoted_monthly_value: number;
  related_client_id: string;
  created_by?: string;
  assigned_to: string | null;
}

interface LeadNoteRow {
  id: string;
  lead_id: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  note_type?: string;
  source_id?: string | null;
}

interface CallTranscriptRow {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  call_date: string;
  participants: string;
  transcript: string;
  summary: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface AIRecommendationRow {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  recommendation: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

interface WhatsAppMessageRow {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  message_text: string;
  message_purpose: string;
  phone_number: string;
  sent_by: string;
  sent_by_name: string;
  is_ai_generated: boolean;
  sent_at: string;
}

interface DealRow {
  deal_id: string;
  client_id: string;
  deal_name: string;
  deal_type: string;
  deal_amount: number;
  deal_date: string;
  deal_status: string;
  supplier_cost: number;
  notes: string;
}

interface ExpenseRow {
  expense_id: string;
  client_id: string;
  expense_date: string;
  month_key: string;
  supplier_name: string;
  expense_type: string;
  amount: number;
  notes: string;
  is_recurring: boolean;
}

interface PaymentRow {
  payment_id: string;
  client_id: string;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  payment_date: string | null;
  payment_status: string;
  notes: string;
}

interface SettingsRow {
  id?: number;
  agency_name: string;
  owner_name: string;
  target_monthly_revenue: number;
  target_monthly_gross_profit: number;
  employee_salary: number;
  canva_api_key?: string | null;
  canva_template_id?: string | null;
  gemini_api_key?: string | null;
  signals_webhook_secret?: string | null;
}

interface RetainerChangeRow {
  id: string;
  client_id: string;
  old_retainer: number;
  new_retainer: number;
  old_supplier_cost: number;
  new_supplier_cost: number;
  changed_at: string;
  notes: string;
}

export interface ClientFile {
  name: string;
  url: string;
  createdAt: string;
}

export interface DataContextType extends AppData {
  isLoaded: boolean;
  error: string | null;
  clearError: () => void;
  retainerHistory: RetainerChange[];
  addClient: (client: Omit<Client, 'clientId' | 'addedAt'>) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  addLead: (lead: Omit<Lead, 'leadId' | 'createdAt'>) => Promise<void>;
  updateLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertLeadToClient: (leadId: string, clientData: Omit<Client, 'clientId' | 'addedAt'>) => Promise<void>;

  addDeal: (deal: Omit<OneTimeDeal, 'dealId'>) => Promise<void>;
  updateDeal: (deal: OneTimeDeal) => Promise<void>;

  addExpense: (expense: Omit<SupplierExpense, 'expenseId'>) => Promise<void>;
  updateExpense: (expense: SupplierExpense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  generateMonthlyExpenses: (monthKey: string) => Promise<number>;

  addPayment: (payment: Omit<Payment, 'paymentId'>) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  generateMonthlyPayments: (monthKey: string) => Promise<number>;

  uploadClientFile: (clientId: string, file: File) => Promise<string | null>;
  listClientFiles: (clientId: string) => Promise<ClientFile[]>;
  deleteClientFile: (clientId: string, fileName: string) => Promise<void>;

  addClientNote: (clientId: string, content: string, userId: string, userName: string, noteType?: NoteType, sourceId?: string) => Promise<void>;
  deleteClientNote: (noteId: string) => Promise<void>;

  addLeadNote: (leadId: string, content: string, userId: string, userName: string, noteType?: NoteType, sourceId?: string) => Promise<void>;
  deleteLeadNote: (noteId: string) => Promise<void>;

  addCallTranscript: (transcript: Omit<CallTranscript, 'id' | 'createdAt'>) => Promise<void>;
  deleteCallTranscript: (id: string) => Promise<void>;

  addAIRecommendation: (rec: Omit<AIRecommendation, 'id' | 'createdAt'>) => Promise<void>;
  deleteAIRecommendation: (id: string) => Promise<void>;

  addWhatsAppMessage: (msg: Omit<WhatsAppMessage, 'id' | 'sentAt'>) => Promise<void>;
  deleteWhatsAppMessage: (id: string) => Promise<void>;

  uploadRecording: (entityType: 'client' | 'lead', entityId: string, file: File) => Promise<{ signedUrl: string; storagePath: string } | null>;

  updateServices: (services: Service[]) => void;
  updateSettings: (settings: AgencySettings) => Promise<void>;
  saveApiKeys: (keys: { canvaApiKey?: string; canvaTemplateId?: string; geminiApiKey?: string }) => Promise<void>;
  saveSignalsWebhookSecret: (secret: string) => Promise<void>;

  importData: (json: string) => boolean;
  exportData: () => string;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Migration mappings: Old English values -> New Hebrew values
const CLIENT_STATUS_MIGRATION: Record<string, string> = {
  'Active': 'פעיל',
  'Paused': 'מושהה',
  'Leaving': 'בתהליך עזיבה',
  'Left': 'עזב',
};

const LEAD_STATUS_MIGRATION: Record<string, string> = {
  'New': 'חדש',
  'Contacted': 'נוצר קשר',
  'Proposal_sent': 'נשלחה הצעה',
  'Meeting_scheduled': 'נקבעה פגישה',
  'Pending_decision': 'ממתין להחלטה',
  'Won': 'נסגר בהצלחה',
  'Lost': 'אבוד',
  'Not_relevant': 'לא רלוונטי',
};

const migrateClientStatus = (status: string): string => {
  return CLIENT_STATUS_MIGRATION[status] || status;
};

const migrateLeadStatus = (status: string): string => {
  return LEAD_STATUS_MIGRATION[status] || status;
};

// Safe JSON parse helper
const safeJsonParse = (value: string | unknown, fallback: unknown[] = []): unknown[] => {
  if (typeof value !== 'string') return Array.isArray(value) ? value : fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// Transformation functions: DB (snake_case) <-> TypeScript (camelCase)
const transformClientToDB = (client: Client) => ({
  client_id: client.clientId,
  client_name: client.clientName,
  business_name: client.businessName,
  phone: client.phone,
  email: client.email,
  industry: client.industry,
  rating: client.rating,
  status: client.status,
  join_date: client.joinDate,
  churn_date: client.churnDate || null,
  monthly_retainer: client.monthlyRetainer,
  billing_day: client.billingDay,
  services: JSON.stringify(client.services),
  effort_level: client.effortLevel,
  supplier_cost_monthly: client.supplierCostMonthly,
  notes: client.notes,
  next_review_date: client.nextReviewDate,
  added_at: client.addedAt,
  assigned_to: client.assignedTo || null,
});

const transformClientFromDB = (row: ClientRow): Client => ({
  clientId: row.client_id,
  clientName: row.client_name,
  businessName: row.business_name,
  phone: row.phone,
  email: row.email,
  industry: row.industry,
  rating: row.rating as ClientRating,
  status: migrateClientStatus(row.status) as ClientStatus,
  joinDate: row.join_date,
  churnDate: row.churn_date || undefined,
  monthlyRetainer: row.monthly_retainer,
  billingDay: row.billing_day,
  services: safeJsonParse(row.services) as string[],
  effortLevel: row.effort_level as EffortLevel,
  supplierCostMonthly: row.supplier_cost_monthly,
  notes: row.notes || '',
  nextReviewDate: row.next_review_date || '',
  addedAt: row.added_at,
  assignedTo: row.assigned_to || undefined,
});

const transformLeadToDB = (lead: Lead) => ({
  lead_id: lead.leadId,
  created_at: lead.createdAt,
  lead_name: lead.leadName,
  business_name: lead.businessName,
  phone: lead.phone,
  email: lead.email,
  source_channel: lead.sourceChannel,
  interested_services: JSON.stringify(lead.interestedServices),
  notes: lead.notes,
  next_contact_date: lead.nextContactDate,
  status: lead.status,
  quoted_monthly_value: lead.quotedMonthlyValue,
  related_client_id: lead.relatedClientId,
  created_by: lead.createdBy || null,
  assigned_to: lead.assignedTo || null,
});

const transformLeadFromDB = (row: LeadRow): Lead => ({
  leadId: row.lead_id,
  createdAt: row.created_at,
  leadName: row.lead_name,
  businessName: row.business_name,
  phone: row.phone,
  email: row.email,
  sourceChannel: row.source_channel as Lead['sourceChannel'],
  interestedServices: safeJsonParse(row.interested_services) as string[],
  notes: row.notes || '',
  nextContactDate: row.next_contact_date,
  status: migrateLeadStatus(row.status) as LeadStatus,
  quotedMonthlyValue: row.quoted_monthly_value,
  relatedClientId: row.related_client_id,
  createdBy: row.created_by || undefined,
  assignedTo: row.assigned_to || undefined,
});

const transformDealToDB = (deal: OneTimeDeal) => ({
  deal_id: deal.dealId,
  client_id: deal.clientId,
  deal_name: deal.dealName,
  deal_type: deal.dealType,
  deal_amount: deal.dealAmount,
  deal_date: deal.dealDate,
  deal_status: deal.dealStatus,
  supplier_cost: deal.supplierCost,
  notes: deal.notes,
});

const transformDealFromDB = (row: DealRow): OneTimeDeal => ({
  dealId: row.deal_id,
  clientId: row.client_id,
  dealName: row.deal_name,
  dealType: row.deal_type,
  dealAmount: row.deal_amount,
  dealDate: row.deal_date,
  dealStatus: row.deal_status as OneTimeDeal['dealStatus'],
  supplierCost: row.supplier_cost,
  notes: row.notes || '',
});

const transformExpenseToDB = (expense: SupplierExpense) => ({
  expense_id: expense.expenseId,
  client_id: expense.clientId || null,
  expense_date: expense.expenseDate,
  month_key: expense.monthKey,
  supplier_name: expense.supplierName,
  expense_type: expense.expenseType,
  amount: expense.amount,
  notes: expense.notes,
  is_recurring: expense.isRecurring,
});

const transformExpenseFromDB = (row: ExpenseRow): SupplierExpense => ({
  expenseId: row.expense_id,
  clientId: row.client_id,
  expenseDate: row.expense_date,
  monthKey: row.month_key,
  supplierName: row.supplier_name,
  expenseType: row.expense_type as SupplierExpense['expenseType'],
  amount: row.amount,
  notes: row.notes || '',
  isRecurring: row.is_recurring ?? false,
});

const transformPaymentToDB = (payment: Payment) => ({
  payment_id: payment.paymentId,
  client_id: payment.clientId,
  period_month: payment.periodMonth,
  amount_due: payment.amountDue,
  amount_paid: payment.amountPaid,
  payment_date: payment.paymentDate || null,
  payment_status: payment.paymentStatus,
  notes: payment.notes,
});

const transformPaymentFromDB = (row: PaymentRow): Payment => ({
  paymentId: row.payment_id,
  clientId: row.client_id,
  periodMonth: row.period_month,
  amountDue: row.amount_due,
  amountPaid: row.amount_paid,
  paymentDate: row.payment_date || undefined,
  paymentStatus: row.payment_status as PaymentStatus,
  notes: row.notes || '',
});

const transformSettingsToDB = (settings: AgencySettings) => ({
  id: 1,
  agency_name: settings.agencyName,
  owner_name: settings.ownerName,
  target_monthly_revenue: settings.targetMonthlyRevenue,
  target_monthly_gross_profit: settings.targetMonthlyGrossProfit,
  employee_salary: settings.employeeSalary || 0,
  // Note: API keys are NOT included here — they are saved via saveApiKeys() directly
});

const transformSettingsFromDB = (row: SettingsRow): AgencySettings => ({
  agencyName: row.agency_name,
  ownerName: row.owner_name,
  targetMonthlyRevenue: row.target_monthly_revenue,
  targetMonthlyGrossProfit: row.target_monthly_gross_profit,
  employeeSalary: row.employee_salary || 0,
  // Security: only send boolean flags to frontend, never actual keys
  hasCanvaKey: !!(row.canva_api_key && row.canva_api_key.length > 0),
  hasGeminiKey: !!(row.gemini_api_key && row.gemini_api_key.length > 0),
  canvaTemplateId: row.canva_template_id || undefined,
  hasSignalsWebhookSecret: !!(row.signals_webhook_secret && row.signals_webhook_secret.length > 0),
});

const transformRetainerChangeToDB = (rc: RetainerChange) => ({
  id: rc.id,
  client_id: rc.clientId,
  old_retainer: rc.oldRetainer,
  new_retainer: rc.newRetainer,
  old_supplier_cost: rc.oldSupplierCost,
  new_supplier_cost: rc.newSupplierCost,
  changed_at: rc.changedAt,
  notes: rc.notes,
});

const transformRetainerChangeFromDB = (row: RetainerChangeRow): RetainerChange => ({
  id: row.id,
  clientId: row.client_id,
  oldRetainer: row.old_retainer,
  newRetainer: row.new_retainer,
  oldSupplierCost: row.old_supplier_cost,
  newSupplierCost: row.new_supplier_cost,
  changedAt: row.changed_at,
  notes: row.notes || '',
});

const transformClientNoteToDB = (note: ClientNote) => ({
  id: note.id,
  client_id: note.clientId,
  content: note.content,
  created_by: note.createdBy,
  created_by_name: note.createdByName,
  created_at: note.createdAt,
  note_type: note.noteType || 'manual',
  source_id: note.sourceId || null,
});

const transformClientNoteFromDB = (row: ClientNoteRow): ClientNote => ({
  id: row.id,
  clientId: row.client_id,
  content: row.content,
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
  noteType: (row.note_type as NoteType) || 'manual',
  sourceId: row.source_id || undefined,
});

const transformLeadNoteToDB = (note: LeadNote) => ({
  id: note.id,
  lead_id: note.leadId,
  content: note.content,
  created_by: note.createdBy,
  created_by_name: note.createdByName,
  created_at: note.createdAt,
  note_type: note.noteType || 'manual',
  source_id: note.sourceId || null,
});

const transformLeadNoteFromDB = (row: LeadNoteRow): LeadNote => ({
  id: row.id,
  leadId: row.lead_id,
  content: row.content,
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
  noteType: (row.note_type as NoteType) || 'manual',
  sourceId: row.source_id || undefined,
});

const transformCallTranscriptToDB = (ct: CallTranscript) => ({
  id: ct.id,
  client_id: ct.clientId || null,
  lead_id: ct.leadId || null,
  call_date: ct.callDate,
  participants: ct.participants,
  transcript: ct.transcript,
  summary: ct.summary,
  created_by: ct.createdBy,
  created_by_name: ct.createdByName,
  created_at: ct.createdAt,
});

const transformCallTranscriptFromDB = (row: CallTranscriptRow): CallTranscript => ({
  id: row.id,
  clientId: row.client_id || undefined,
  leadId: row.lead_id || undefined,
  callDate: row.call_date,
  participants: row.participants || '',
  transcript: row.transcript || '',
  summary: row.summary || '',
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
});

const transformAIRecommendationToDB = (rec: AIRecommendation) => ({
  id: rec.id,
  client_id: rec.clientId || null,
  lead_id: rec.leadId || null,
  recommendation: rec.recommendation,
  created_by: rec.createdBy,
  created_by_name: rec.createdByName,
  created_at: rec.createdAt,
});

const transformAIRecommendationFromDB = (row: AIRecommendationRow): AIRecommendation => ({
  id: row.id,
  clientId: row.client_id || undefined,
  leadId: row.lead_id || undefined,
  recommendation: row.recommendation || '',
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
});

const transformWhatsAppMessageToDB = (msg: WhatsAppMessage) => ({
  id: msg.id,
  client_id: msg.clientId || null,
  lead_id: msg.leadId || null,
  message_text: msg.messageText,
  message_purpose: msg.messagePurpose,
  phone_number: msg.phoneNumber,
  sent_by: msg.sentBy,
  sent_by_name: msg.sentByName,
  is_ai_generated: msg.isAiGenerated,
  sent_at: msg.sentAt,
});

const transformWhatsAppMessageFromDB = (row: WhatsAppMessageRow): WhatsAppMessage => ({
  id: row.id,
  clientId: row.client_id || undefined,
  leadId: row.lead_id || undefined,
  messageText: row.message_text || '',
  messagePurpose: row.message_purpose || '',
  phoneNumber: row.phone_number || '',
  sentBy: row.sent_by,
  sentByName: row.sent_by_name || '',
  isAiGenerated: row.is_ai_generated ?? false,
  sentAt: row.sent_at,
});

// --- Signals OS Personality ---
interface SignalsPersonalityRow {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  analysis_id: string;
  tenant_id: string;
  subject_name: string;
  subject_email: string;
  subject_phone: string | null;
  scores: Record<string, number>;
  primary_archetype: string;
  secondary_archetype: string;
  confidence_level: string;
  churn_risk: string;
  smart_tags: string[];
  user_report: string | null;
  business_report: string | null;
  sales_cheat_sheet: Record<string, string | string[]>;
  retention_cheat_sheet: Record<string, string>;
  result_url: string | null;
  lang: string;
  questionnaire_version: string;
  received_at: string;
  updated_at: string;
}

const transformSignalsPersonalityFromDB = (row: SignalsPersonalityRow): SignalsPersonality => ({
  id: row.id,
  leadId: row.lead_id || '',
  clientId: row.client_id || undefined,
  analysisId: row.analysis_id,
  tenantId: row.tenant_id,
  subjectName: row.subject_name,
  subjectEmail: row.subject_email,
  subjectPhone: row.subject_phone || undefined,
  scores: row.scores as Record<Archetype, number>,
  primaryArchetype: row.primary_archetype as Archetype,
  secondaryArchetype: row.secondary_archetype as Archetype,
  confidenceLevel: row.confidence_level as ConfidenceLevel,
  churnRisk: row.churn_risk as ChurnRisk,
  smartTags: row.smart_tags || [],
  userReport: row.user_report || undefined,
  businessReport: row.business_report || undefined,
  salesCheatSheet: row.sales_cheat_sheet || {},
  retentionCheatSheet: row.retention_cheat_sheet || {},
  resultUrl: row.result_url || undefined,
  lang: row.lang || 'he',
  questionnaireVersion: row.questionnaire_version || '',
  receivedAt: row.received_at,
  updatedAt: row.updated_at,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>({
    clients: [],
    leads: [],
    oneTimeDeals: [],
    expenses: [],
    payments: [],
    services: INITIAL_SERVICES,
    settings: DEFAULT_SETTINGS,
    activities: [],
    retainerHistory: [],
    clientNotes: [],
    leadNotes: [],
    callTranscripts: [],
    aiRecommendations: [],
    whatsappMessages: [],
    signalsPersonalities: [],
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  // Activity logging helper - logs locally (Supabase table optional)
  const logActivity = useCallback((actionType: string, entityType: string, description: string, entityId?: string) => {
    const entry: ActivityEntry = {
      id: generateId(),
      actionType,
      entityType,
      entityId,
      description,
      createdAt: new Date().toISOString(),
    };
    setData(prev => ({
      ...prev,
      activities: [entry, ...prev.activities].slice(0, 100), // Keep last 100
    }));
    // Optional: persist to Supabase activity_log table if it exists
    supabase.from('activity_log').insert({
      id: entry.id,
      action_type: entry.actionType,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      description: entry.description,
      created_at: entry.createdAt,
    }).then(({ error }) => {
      if (error) console.warn('Activity log not persisted (table may not exist yet):', error.message);
    });
  }, []);

  // Load data from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoaded(true);
          return;
        }

        const [clientsRes, leadsRes, dealsRes, expensesRes, paymentsRes, settingsRes, activitiesRes, retainerChangesRes, clientNotesRes, leadNotesRes, callTranscriptsRes, aiRecommendationsRes, whatsappMessagesRes, signalsPersonalitiesRes] = await Promise.all([
          supabase.from('clients').select('*').order('added_at', { ascending: false }),
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('deals').select('*').order('deal_date', { ascending: false }),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('payments').select('*').order('period_month', { ascending: false }),
          supabase.from('settings').select('*').single(),
          supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('retainer_changes').select('*').order('changed_at', { ascending: false }),
          supabase.from('client_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('lead_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('call_transcripts').select('*').order('call_date', { ascending: false }),
          supabase.from('ai_recommendations').select('*').order('created_at', { ascending: false }),
          supabase.from('whatsapp_messages').select('*').order('sent_at', { ascending: false }),
          supabase.from('signals_personality').select('*').order('received_at', { ascending: false }),
        ]);

        if (clientsRes.error) console.error('Error loading clients:', clientsRes.error);
        if (leadsRes.error) console.error('Error loading leads:', leadsRes.error);
        if (dealsRes.error) console.error('Error loading deals:', dealsRes.error);
        if (expensesRes.error) console.error('Error loading expenses:', expensesRes.error);
        if (paymentsRes.error) console.error('Error loading payments:', paymentsRes.error);

        const clients = (clientsRes.data || []).map(transformClientFromDB);
        const leads = (leadsRes.data || []).map(transformLeadFromDB);
        const deals = (dealsRes.data || []).map(transformDealFromDB);
        const expenses = (expensesRes.data || []).map(transformExpenseFromDB);
        const payments = (paymentsRes.data || []).map(transformPaymentFromDB);
        const activities: ActivityEntry[] = (activitiesRes.data || []).map((row: { id: string; action_type: string; entity_type: string; entity_id?: string; description: string; created_at: string }) => ({
          id: row.id,
          actionType: row.action_type,
          entityType: row.entity_type,
          entityId: row.entity_id || undefined,
          description: row.description,
          createdAt: row.created_at,
        }));
        const retainerHistory: RetainerChange[] = (retainerChangesRes.data || []).map((row: RetainerChangeRow) => transformRetainerChangeFromDB(row));
        const clientNotes: ClientNote[] = (clientNotesRes.data || []).map((row: ClientNoteRow) => transformClientNoteFromDB(row));
        const leadNotes: LeadNote[] = (leadNotesRes.data || []).map((row: LeadNoteRow) => transformLeadNoteFromDB(row));
        const callTranscripts: CallTranscript[] = (callTranscriptsRes.data || []).map((row: CallTranscriptRow) => transformCallTranscriptFromDB(row));
        const aiRecommendations: AIRecommendation[] = (aiRecommendationsRes.data || []).map((row: AIRecommendationRow) => transformAIRecommendationFromDB(row));
        const whatsappMessages: WhatsAppMessage[] = (whatsappMessagesRes.data || []).map((row: WhatsAppMessageRow) => transformWhatsAppMessageFromDB(row));
        const signalsPersonalities: SignalsPersonality[] = (signalsPersonalitiesRes.data || []).map((row: SignalsPersonalityRow) => transformSignalsPersonalityFromDB(row));

        let settings = DEFAULT_SETTINGS;
        if (settingsRes.data && !settingsRes.error) {
          settings = transformSettingsFromDB(settingsRes.data);
        } else {
          const { error: upsertError } = await supabase.from('settings').upsert(transformSettingsToDB(DEFAULT_SETTINGS));
          if (upsertError) console.error('Error initializing settings:', upsertError);
        }

        setData({
          clients,
          leads,
          oneTimeDeals: deals,
          expenses,
          payments,
          services: INITIAL_SERVICES,
          settings,
          activities,
          retainerHistory,
          clientNotes,
          leadNotes,
          callTranscripts,
          aiRecommendations,
          whatsappMessages,
          signalsPersonalities,
        });
      } catch (err) {
        console.error('Error loading data from Supabase:', err);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();

    // Realtime subscription for Signals OS personality data
    const personalityChannel = supabase
      .channel('signals_personality_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'signals_personality',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newPersonality = transformSignalsPersonalityFromDB(payload.new as SignalsPersonalityRow);
          setData(prev => ({
            ...prev,
            signalsPersonalities: [newPersonality, ...prev.signalsPersonalities],
          }));
        } else if (payload.eventType === 'UPDATE') {
          const updated = transformSignalsPersonalityFromDB(payload.new as SignalsPersonalityRow);
          setData(prev => ({
            ...prev,
            signalsPersonalities: prev.signalsPersonalities.map(p => p.id === updated.id ? updated : p),
          }));
        }
      })
      .subscribe();

    // Also listen for new leads created by webhook
    const leadsChannel = supabase
      .channel('leads_webhook_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
      }, (payload) => {
        const newLead = transformLeadFromDB(payload.new as LeadRow);
        setData(prev => {
          // Only add if not already in state
          if (prev.leads.find(l => l.leadId === newLead.leadId)) return prev;
          return { ...prev, leads: [newLead, ...prev.leads] };
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(personalityChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const addClient = async (client: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...client,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('clients')
        .insert(transformClientToDB(newClient));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        clients: [...prev.clients, newClient]
      }));
      logActivity('client_added', 'client', `לקוח חדש: ${client.businessName}`, newClient.clientId);
    } catch (err) {
      showError('שגיאה בהוספת לקוח');
      throw err;
    }
  };

  const updateClient = async (client: Client) => {
    try {
      // Detect retainer changes
      const oldClient = data.clients.find(c => c.clientId === client.clientId);
      const retainerChanged = oldClient && (
        oldClient.monthlyRetainer !== client.monthlyRetainer ||
        oldClient.supplierCostMonthly !== client.supplierCostMonthly
      );

      const { error } = await supabase
        .from('clients')
        .update(transformClientToDB(client))
        .eq('client_id', client.clientId);

      if (error) throw error;

      // Log retainer change if applicable
      if (retainerChanged && oldClient) {
        const change: RetainerChange = {
          id: generateId(),
          clientId: client.clientId,
          oldRetainer: oldClient.monthlyRetainer,
          newRetainer: client.monthlyRetainer,
          oldSupplierCost: oldClient.supplierCostMonthly,
          newSupplierCost: client.supplierCostMonthly,
          changedAt: new Date().toISOString(),
          notes: '',
        };
        // Try to persist - don't fail if table doesn't exist
        supabase.from('retainer_changes').insert(transformRetainerChangeToDB(change)).then(({ error: rcError }) => {
          if (rcError) console.warn('Retainer change not persisted:', rcError.message);
        });
        setData(prev => ({
          ...prev,
          clients: prev.clients.map(c => c.clientId === client.clientId ? client : c),
          retainerHistory: [change, ...prev.retainerHistory],
        }));
        logActivity('retainer_changed', 'client', `שינוי ריטיינר: ${oldClient.businessName} ₪${oldClient.monthlyRetainer} → ₪${client.monthlyRetainer}`, client.clientId);
      } else {
        setData(prev => ({
          ...prev,
          clients: prev.clients.map(c => c.clientId === client.clientId ? client : c)
        }));
      }

      logActivity('client_updated', 'client', `עודכן לקוח: ${client.businessName}`, client.clientId);
    } catch (err) {
      showError('שגיאה בעדכון לקוח');
      throw err;
    }
  };

  const deleteClient = async (id: string) => {
    const clientName = data.clients.find(c => c.clientId === id)?.businessName || id;
    try {
      await supabase.from('deals').delete().eq('client_id', id);
      await supabase.from('expenses').delete().eq('client_id', id);

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('client_id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        clients: prev.clients.filter(c => c.clientId !== id),
        oneTimeDeals: prev.oneTimeDeals.filter(d => d.clientId !== id),
        expenses: prev.expenses.filter(e => e.clientId !== id),
        payments: prev.payments.filter(p => p.clientId !== id)
      }));
      logActivity('client_deleted', 'client', `נמחק לקוח: ${clientName}`, id);
    } catch (err) {
      showError('שגיאה במחיקת לקוח');
      throw err;
    }
  };

  const addLead = async (lead: Omit<Lead, 'leadId' | 'createdAt'>) => {
    const newLead: Lead = {
      ...lead,
      leadId: generateId(),
      createdAt: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('leads')
        .insert(transformLeadToDB(newLead));

      if (error) throw error;

      setData(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
      logActivity('lead_added', 'lead', `ליד חדש: ${lead.leadName}`, newLead.leadId);
    } catch (err) {
      showError('שגיאה בהוספת ליד');
      throw err;
    }
  };

  const updateLead = async (lead: Lead) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update(transformLeadToDB(lead))
        .eq('lead_id', lead.leadId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        leads: prev.leads.map(l => l.leadId === lead.leadId ? lead : l)
      }));
      logActivity('lead_updated', 'lead', `עודכן ליד: ${lead.leadName}`, lead.leadId);
    } catch (err) {
      showError('שגיאה בעדכון ליד');
      throw err;
    }
  };

  const deleteLead = async (id: string) => {
    const leadName = data.leads.find(l => l.leadId === id)?.leadName || id;
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('lead_id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        leads: prev.leads.filter(l => l.leadId !== id)
      }));
      logActivity('lead_deleted', 'lead', `נמחק ליד: ${leadName}`, id);
    } catch (err) {
      showError('שגיאה במחיקת ליד');
      throw err;
    }
  };

  const convertLeadToClient = async (leadId: string, clientData: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...clientData,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };

    try {
      const { error: clientError } = await supabase
        .from('clients')
        .insert(transformClientToDB(newClient));

      if (clientError) throw clientError;

      const lead = data.leads.find(l => l.leadId === leadId);
      if (lead) {
        const updatedLead = { ...lead, status: LeadStatus.Won, relatedClientId: newClient.clientId };
        const { error: leadError } = await supabase
          .from('leads')
          .update(transformLeadToDB(updatedLead))
          .eq('lead_id', leadId);

        if (leadError) {
          // Rollback: delete the client we just created
          await supabase.from('clients').delete().eq('client_id', newClient.clientId);
          throw leadError;
        }

        // Link Signals personality data to the new client
        await supabase
          .from('signals_personality')
          .update({ client_id: newClient.clientId })
          .eq('lead_id', leadId);

        setData(prev => ({
          ...prev,
          clients: [...prev.clients, newClient],
          leads: prev.leads.map(l => l.leadId === leadId ? updatedLead : l),
          signalsPersonalities: prev.signalsPersonalities.map(p =>
            p.leadId === leadId ? { ...p, clientId: newClient.clientId } : p
          ),
        }));
        logActivity('lead_converted', 'lead', `ליד הומר ללקוח: ${lead.leadName} → ${clientData.businessName}`, leadId);
      }
    } catch (err) {
      showError('שגיאה בהמרת ליד ללקוח');
      throw err;
    }
  };

  const addDeal = async (deal: Omit<OneTimeDeal, 'dealId'>) => {
    const newDeal: OneTimeDeal = {
      ...deal,
      dealId: generateId()
    };

    try {
      const { error } = await supabase
        .from('deals')
        .insert(transformDealToDB(newDeal));

      if (error) throw error;

      setData(prev => ({ ...prev, oneTimeDeals: [...prev.oneTimeDeals, newDeal] }));
      logActivity('deal_added', 'deal', `פרויקט חדש: ${deal.dealName}`, newDeal.dealId);
    } catch (err) {
      showError('שגיאה בהוספת פרויקט');
      throw err;
    }
  };

  const updateDeal = async (deal: OneTimeDeal) => {
    try {
      const { error } = await supabase
        .from('deals')
        .update(transformDealToDB(deal))
        .eq('deal_id', deal.dealId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        oneTimeDeals: prev.oneTimeDeals.map(d => d.dealId === deal.dealId ? deal : d)
      }));
      logActivity('deal_updated', 'deal', `עודכן פרויקט: ${deal.dealName}`, deal.dealId);
    } catch (err) {
      showError('שגיאה בעדכון פרויקט');
      throw err;
    }
  };

  const addExpense = async (expense: Omit<SupplierExpense, 'expenseId'>) => {
    const newExpense: SupplierExpense = {
      ...expense,
      expenseId: generateId()
    };

    try {
      const { error } = await supabase
        .from('expenses')
        .insert(transformExpenseToDB(newExpense));

      if (error) throw error;

      setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
      logActivity('expense_added', 'expense', `הוצאה חדשה: ${expense.supplierName} - ₪${expense.amount}`, newExpense.expenseId);
    } catch (err) {
      showError('שגיאה בהוספת הוצאה');
      throw err;
    }
  };

  const updateExpense = async (expense: SupplierExpense) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update(transformExpenseToDB(expense))
        .eq('expense_id', expense.expenseId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        expenses: prev.expenses.map(e => e.expenseId === expense.expenseId ? expense : e)
      }));
      logActivity('expense_updated', 'expense', `עודכנה הוצאה: ${expense.supplierName}`, expense.expenseId);
    } catch (err) {
      showError('שגיאה בעדכון הוצאה');
      throw err;
    }
  };

  const deleteExpense = async (id: string) => {
    const expenseName = data.expenses.find(e => e.expenseId === id)?.supplierName || id;
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('expense_id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        expenses: prev.expenses.filter(e => e.expenseId !== id)
      }));
      logActivity('expense_deleted', 'expense', `נמחקה הוצאה: ${expenseName}`, id);
    } catch (err) {
      showError('שגיאה במחיקת הוצאה');
      throw err;
    }
  };

  const generateMonthlyExpenses = async (monthKey: string): Promise<number> => {
    try {
      // 1. Get all recurring expenses (from any month)
      const recurringExpenses = data.expenses.filter(e => e.isRecurring);

      // 2. Build dedup set for target month
      const existingForMonth = data.expenses.filter(e => e.monthKey === monthKey);
      const existingKeys = new Set(
        existingForMonth.map(e => `${e.supplierName}_${e.clientId || ''}`)
      );

      // 3. Create new expenses, skipping duplicates
      const newExpenses: SupplierExpense[] = recurringExpenses
        .filter(e => !existingKeys.has(`${e.supplierName}_${e.clientId || ''}`))
        .map(e => ({
          expenseId: generateId(),
          clientId: e.clientId,
          expenseDate: `${monthKey.substring(0, 4)}-${monthKey.substring(4, 6)}-01`,
          monthKey: monthKey,
          supplierName: e.supplierName,
          expenseType: e.expenseType,
          amount: e.amount,
          notes: e.notes,
          isRecurring: true,
        }));

      if (newExpenses.length === 0) return 0;

      // 4. Batch insert to Supabase
      const dbRows = newExpenses.map(e => transformExpenseToDB(e));
      const { error } = await supabase.from('expenses').insert(dbRows);
      if (error) throw error;

      // 5. Update local state
      setData(prev => ({ ...prev, expenses: [...prev.expenses, ...newExpenses] }));

      // 6. Log activity
      logActivity('expenses_generated', 'expense',
        `יוצרו ${newExpenses.length} הוצאות קבועות לחודש ${monthKey}`);

      return newExpenses.length;
    } catch (err) {
      showError('שגיאה בייצור הוצאות חודשיות');
      throw err;
    }
  };

  const addPayment = async (payment: Omit<Payment, 'paymentId'>) => {
    const newPayment: Payment = {
      ...payment,
      paymentId: generateId()
    };

    try {
      const { error } = await supabase
        .from('payments')
        .insert(transformPaymentToDB(newPayment));

      if (error) throw error;

      setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
      logActivity('payment_added', 'payment', `חוב חדש: ₪${payment.amountDue}`, newPayment.paymentId);
    } catch (err) {
      showError('שגיאה בהוספת חוב');
      throw err;
    }
  };

  const updatePayment = async (payment: Payment) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update(transformPaymentToDB(payment))
        .eq('payment_id', payment.paymentId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.paymentId === payment.paymentId ? payment : p)
      }));
      logActivity('payment_updated', 'payment', `עודכן חוב: ₪${payment.amountPaid}/${payment.amountDue}`, payment.paymentId);
    } catch (err) {
      showError('שגיאה בעדכון חוב');
      throw err;
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('payment_id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.paymentId !== id)
      }));
      logActivity('payment_deleted', 'payment', `נמחק חוב`, id);
    } catch (err) {
      showError('שגיאה במחיקת חוב');
      throw err;
    }
  };

  const generateMonthlyPayments = async (monthKey: string): Promise<number> => {
    try {
      const activeClients = data.clients.filter(c => c.status === ClientStatus.Active);
      const existingPayments = data.payments.filter(p => p.periodMonth === monthKey);
      const clientsWithPayments = new Set(existingPayments.map(p => p.clientId));

      const newPayments: Payment[] = activeClients
        .filter(c => !clientsWithPayments.has(c.clientId) && c.monthlyRetainer > 0)
        .map(c => ({
          paymentId: generateId(),
          clientId: c.clientId,
          periodMonth: monthKey,
          amountDue: c.monthlyRetainer,
          amountPaid: 0,
          paymentStatus: PaymentStatus.Unpaid,
          notes: '',
        }));

      if (newPayments.length === 0) return 0;

      const dbRows = newPayments.map(p => transformPaymentToDB(p));
      const { error } = await supabase.from('payments').insert(dbRows);
      if (error) throw error;

      setData(prev => ({ ...prev, payments: [...prev.payments, ...newPayments] }));
      logActivity('payments_generated', 'payment', `יוצרו ${newPayments.length} חובות חודשיים לחודש ${monthKey}`);
      return newPayments.length;
    } catch (err) {
      showError('שגיאה בייצור חובות חודשיים');
      throw err;
    }
  };

  // --- Client File Upload (Supabase Storage) ---
  const uploadClientFile = async (clientId: string, file: File): Promise<string | null> => {
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
      const filePath = `${clientId}/${safeName}`;

      const { error } = await supabase.storage
        .from('contracts')
        .upload(filePath, file, { upsert: false });

      if (error) {
        showError('שגיאה בהעלאת קובץ: ' + error.message);
        return null;
      }

      const clientName = data.clients.find(c => c.clientId === clientId)?.businessName || clientId;
      logActivity('file_uploaded', 'client', `הועלה קובץ "${file.name}" ללקוח ${clientName}`, clientId);
      return safeName;
    } catch (err) {
      showError('שגיאה בהעלאת קובץ');
      return null;
    }
  };

  const listClientFiles = async (clientId: string): Promise<ClientFile[]> => {
    try {
      const { data: files, error } = await supabase.storage
        .from('contracts')
        .list(clientId, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error || !files) return [];

      const results: ClientFile[] = [];
      for (const f of files.filter(f => f.name !== '.emptyFolderPlaceholder')) {
        const { data: urlData } = await supabase.storage
          .from('contracts')
          .createSignedUrl(`${clientId}/${f.name}`, 3600); // 1 hour expiry

        results.push({
          name: f.name.replace(/^\d+_/, ''), // Remove timestamp prefix for display
          url: urlData?.signedUrl || '',
          createdAt: f.created_at || '',
        });
      }
      return results;
    } catch {
      return [];
    }
  };

  const deleteClientFile = async (clientId: string, fileName: string): Promise<void> => {
    try {
      // We need the full storage name (with timestamp prefix)
      const { data: files } = await supabase.storage
        .from('contracts')
        .list(clientId);

      const match = files?.find(f => f.name === fileName || f.name.replace(/^\d+_/, '') === fileName);
      if (!match) {
        showError('הקובץ לא נמצא');
        return;
      }

      const { error } = await supabase.storage
        .from('contracts')
        .remove([`${clientId}/${match.name}`]);

      if (error) throw error;

      logActivity('file_deleted', 'client', `נמחק קובץ "${fileName}"`, clientId);
    } catch (err) {
      showError('שגיאה במחיקת קובץ');
    }
  };

  // --- Client Notes ---
  const addClientNote = async (clientId: string, content: string, userId: string, userName: string, noteType: NoteType = 'manual', sourceId?: string) => {
    const note: ClientNote = {
      id: generateId(),
      clientId,
      content,
      createdBy: userId,
      createdByName: userName,
      createdAt: new Date().toISOString(),
      noteType,
      sourceId,
    };

    try {
      const { error } = await supabase
        .from('client_notes')
        .insert(transformClientNoteToDB(note));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        clientNotes: [note, ...prev.clientNotes],
      }));

      const clientName = data.clients.find(c => c.clientId === clientId)?.businessName || clientId;
      logActivity('note_added', 'client', `הערה חדשה ללקוח ${clientName}`, clientId);
    } catch (err) {
      showError('שגיאה בהוספת הערה');
      throw err;
    }
  };

  const deleteClientNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('client_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        clientNotes: prev.clientNotes.filter(n => n.id !== noteId),
      }));
    } catch (err) {
      showError('שגיאה במחיקת הערה');
      throw err;
    }
  };

  // --- Lead Notes ---
  const addLeadNote = async (leadId: string, content: string, userId: string, userName: string, noteType: NoteType = 'manual', sourceId?: string) => {
    const note: LeadNote = {
      id: generateId(),
      leadId,
      content,
      createdBy: userId,
      createdByName: userName,
      createdAt: new Date().toISOString(),
      noteType,
      sourceId,
    };

    try {
      const { error } = await supabase
        .from('lead_notes')
        .insert(transformLeadNoteToDB(note));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        leadNotes: [note, ...prev.leadNotes],
      }));

      const leadName = data.leads.find(l => l.leadId === leadId)?.leadName || leadId;
      logActivity('note_added', 'lead', `הערה חדשה לליד ${leadName}`, leadId);
    } catch (err) {
      showError('שגיאה בהוספת הערה');
      throw err;
    }
  };

  const deleteLeadNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('lead_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        leadNotes: prev.leadNotes.filter(n => n.id !== noteId),
      }));
    } catch (err) {
      showError('שגיאה במחיקת הערה');
      throw err;
    }
  };

  // --- Call Transcripts ---
  const addCallTranscript = async (ct: Omit<CallTranscript, 'id' | 'createdAt'>) => {
    const newCT: CallTranscript = {
      ...ct,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('call_transcripts')
        .insert(transformCallTranscriptToDB(newCT));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        callTranscripts: [newCT, ...prev.callTranscripts],
      }));

      const entityName = ct.clientId
        ? data.clients.find(c => c.clientId === ct.clientId)?.businessName
        : data.leads.find(l => l.leadId === ct.leadId)?.leadName;
      logActivity('transcript_added', ct.clientId ? 'client' : 'lead',
        `תמלול שיחה חדש: ${entityName || ''}`, ct.clientId || ct.leadId);
    } catch (err) {
      showError('שגיאה בהוספת תמלול שיחה');
      throw err;
    }
  };

  const deleteCallTranscript = async (id: string) => {
    try {
      const { error } = await supabase
        .from('call_transcripts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        callTranscripts: prev.callTranscripts.filter(ct => ct.id !== id),
      }));
    } catch (err) {
      showError('שגיאה במחיקת תמלול');
      throw err;
    }
  };

  // --- AI Recommendations ---
  const addAIRecommendation = async (rec: Omit<AIRecommendation, 'id' | 'createdAt'>) => {
    const newRec: AIRecommendation = {
      ...rec,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .insert(transformAIRecommendationToDB(newRec));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        aiRecommendations: [newRec, ...prev.aiRecommendations],
      }));

      const entityName = rec.clientId
        ? data.clients.find(c => c.clientId === rec.clientId)?.businessName
        : data.leads.find(l => l.leadId === rec.leadId)?.leadName;
      logActivity('ai_recommendation_added', rec.clientId ? 'client' : 'lead',
        `המלצת AI חדשה: ${entityName || ''}`, rec.clientId || rec.leadId);
    } catch (err) {
      showError('שגיאה בשמירת המלצת AI');
      throw err;
    }
  };

  const deleteAIRecommendation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_recommendations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        aiRecommendations: prev.aiRecommendations.filter(r => r.id !== id),
      }));
    } catch (err) {
      showError('שגיאה במחיקת המלצת AI');
      throw err;
    }
  };

  // --- WhatsApp Messages ---
  const addWhatsAppMessage = async (msg: Omit<WhatsAppMessage, 'id' | 'sentAt'>) => {
    const newMsg: WhatsAppMessage = {
      ...msg,
      id: generateId(),
      sentAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .insert(transformWhatsAppMessageToDB(newMsg));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        whatsappMessages: [newMsg, ...prev.whatsappMessages],
      }));

      const entityName = msg.clientId
        ? data.clients.find(c => c.clientId === msg.clientId)?.businessName
        : data.leads.find(l => l.leadId === msg.leadId)?.leadName;
      logActivity('whatsapp_sent', msg.clientId ? 'client' : 'lead',
        `הודעת WhatsApp נשלחה (${msg.messagePurpose}): ${entityName || ''}`, msg.clientId || msg.leadId);
    } catch (err) {
      showError('שגיאה בשמירת הודעת WhatsApp');
      throw err;
    }
  };

  const deleteWhatsAppMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        whatsappMessages: prev.whatsappMessages.filter(m => m.id !== id),
      }));
    } catch (err) {
      showError('שגיאה במחיקת הודעת WhatsApp');
      throw err;
    }
  };

  // --- Audio Recording Upload ---
  const uploadRecording = async (entityType: 'client' | 'lead', entityId: string, file: File): Promise<{ signedUrl: string; storagePath: string; error?: string } | null> => {
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
      const storagePath = `${entityId}/${safeName}`;

      // Determine correct MIME type — browsers often report wrong type for audio files
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const mimeMap: Record<string, string> = {
        'mp3': 'audio/mpeg',
        'm4a': 'audio/mp4',
        'mp4': 'audio/mp4',
        'wav': 'audio/wav',
        'webm': 'audio/webm',
        'ogg': 'audio/ogg',
        'aac': 'audio/mp4',
        'wma': 'audio/mpeg',
        'flac': 'audio/wav',
      };
      const contentType = mimeMap[ext] || file.type || 'audio/mpeg';
      console.log('Upload recording:', { fileName: file.name, fileSize: file.size, fileType: file.type, ext, contentType, storagePath });

      const { error } = await supabase.storage
        .from('recordings')
        .upload(storagePath, file, { upsert: false, contentType });

      if (error) {
        console.error('Storage upload error:', error);
        showError('שגיאה בהעלאת הקלטה: ' + error.message);
        return null;
      }

      const { data: urlData, error: urlError } = await supabase.storage
        .from('recordings')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (urlError || !urlData?.signedUrl) {
        console.error('Signed URL error:', urlError);
        showError('שגיאה ביצירת קישור להקלטה');
        return null;
      }

      const entityName = entityType === 'client'
        ? data.clients.find(c => c.clientId === entityId)?.businessName || entityId
        : data.leads.find(l => l.leadId === entityId)?.leadName || entityId;
      logActivity('recording_uploaded', entityType, `הועלתה הקלטה "${file.name}" עבור ${entityName}`, entityId);

      return { signedUrl: urlData.signedUrl, storagePath };
    } catch (err) {
      console.error('Upload recording exception:', err);
      showError('שגיאה בהעלאת הקלטה: ' + (err instanceof Error ? err.message : 'Unknown'));
      return null;
    }
  };

  const updateServices = (services: Service[]) => {
    setData(prev => ({ ...prev, services }));
  };

  const updateSettings = async (settings: AgencySettings) => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(transformSettingsToDB(settings));

      if (error) throw error;

      setData(prev => ({ ...prev, settings }));
    } catch (err) {
      showError('שגיאה בשמירת הגדרות');
      throw err;
    }
  };

  // Save API keys directly to DB without exposing them in React state
  const saveApiKeys = async (keys: { canvaApiKey?: string; canvaTemplateId?: string; geminiApiKey?: string }) => {
    try {
      const updatePayload: Record<string, string | null> = {};
      if (keys.canvaApiKey !== undefined) updatePayload.canva_api_key = keys.canvaApiKey || null;
      if (keys.canvaTemplateId !== undefined) updatePayload.canva_template_id = keys.canvaTemplateId || null;
      if (keys.geminiApiKey !== undefined) updatePayload.gemini_api_key = keys.geminiApiKey || null;

      const { error } = await supabase
        .from('settings')
        .update(updatePayload)
        .eq('id', 1);

      if (error) throw error;

      // Update only the boolean flags in local state (never the actual keys)
      setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          hasCanvaKey: !!(keys.canvaApiKey ?? (prev.settings.hasCanvaKey ? 'exists' : '')),
          hasGeminiKey: !!(keys.geminiApiKey ?? (prev.settings.hasGeminiKey ? 'exists' : '')),
          canvaTemplateId: keys.canvaTemplateId !== undefined ? (keys.canvaTemplateId || undefined) : prev.settings.canvaTemplateId,
        },
      }));
    } catch (err) {
      showError('שגיאה בשמירת מפתחות API');
      throw err;
    }
  };

  // Save Signals OS webhook secret
  const saveSignalsWebhookSecret = async (secret: string) => {
    try {
      const { error } = await supabase
        .from('settings')
        .update({ signals_webhook_secret: secret || null })
        .eq('id', 1);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          hasSignalsWebhookSecret: !!secret,
        },
      }));
    } catch (err) {
      showError('שגיאה בשמירת סוד Webhook');
      throw err;
    }
  };

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object') throw new Error("Invalid format");
      if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.leads)) {
        throw new Error("Invalid format: missing clients or leads arrays");
      }
      setData({
        clients: parsed.clients,
        leads: parsed.leads,
        oneTimeDeals: parsed.oneTimeDeals || [],
        expenses: parsed.expenses || [],
        payments: parsed.payments || [],
        services: parsed.services || INITIAL_SERVICES,
        settings: parsed.settings || DEFAULT_SETTINGS,
        activities: parsed.activities || [],
        retainerHistory: parsed.retainerHistory || [],
        clientNotes: parsed.clientNotes || [],
        leadNotes: parsed.leadNotes || [],
        callTranscripts: parsed.callTranscripts || [],
        aiRecommendations: parsed.aiRecommendations || [],
        whatsappMessages: parsed.whatsappMessages || [],
        signalsPersonalities: parsed.signalsPersonalities || [],
      });
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  };

  const exportData = () => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <DataContext.Provider value={{
      ...data,
      isLoaded,
      error,
      clearError,
      addClient, updateClient, deleteClient,
      addLead, updateLead, deleteLead, convertLeadToClient,
      addDeal, updateDeal,
      addExpense, updateExpense, deleteExpense, generateMonthlyExpenses,
      addPayment, updatePayment, deletePayment, generateMonthlyPayments,
      uploadClientFile, listClientFiles, deleteClientFile,
      addClientNote, deleteClientNote,
      addLeadNote, deleteLeadNote,
      addCallTranscript, deleteCallTranscript,
      addAIRecommendation, deleteAIRecommendation,
      addWhatsAppMessage, deleteWhatsAppMessage,
      uploadRecording,
      updateServices, updateSettings, saveApiKeys, saveSignalsWebhookSecret,
      importData, exportData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used within a DataProvider");
  return context;
};
