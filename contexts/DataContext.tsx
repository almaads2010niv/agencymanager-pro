import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppData, Client, Lead, OneTimeDeal, SupplierExpense, Payment, Service,
  AgencySettings, PaymentStatus, LeadStatus, ClientStatus, ClientRating, EffortLevel,
  ActivityEntry, RetainerChange, ClientNote, LeadNote, CallTranscript, AIRecommendation,
  WhatsAppMessage, NoteType, SignalsPersonality, Archetype, ConfidenceLevel, ChurnRisk,
  BusinessIntelV2, CalendarEvent, CalendarEventType, Idea, IdeaStatus, IdeaPriority, KnowledgeArticle,
  CompetitorReport, CompetitorAnalysis, StrategyPlan
} from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS } from '../constants';
import { generateId } from '../utils';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

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
  facebook_url?: string;
  instagram_url?: string;
  website_url?: string;
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
  facebook_url?: string;
  instagram_url?: string;
  website_url?: string;
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

interface StrategyPlanRow {
  id: string;
  client_id: string | null;
  lead_id: string | null;
  entity_name: string;
  plan_data: Record<string, unknown>;
  raw_text: string | null;
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
  receipt_url: string | null;
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
  tenant_id: string;
  agency_name: string;
  owner_name: string;
  target_monthly_revenue: number;
  target_monthly_gross_profit: number;
  employee_salary: number;
  is_salaried: boolean;
  canva_api_key?: string | null;
  canva_template_id?: string | null;
  gemini_api_key?: string | null;
  signals_webhook_secret?: string | null;
  telegram_bot_token?: string | null;
  telegram_chat_id?: string | null;
  logo_storage_path?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  brand_accent_color?: string | null;
  services_json?: string | null;
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
  deleteDeal: (id: string) => Promise<void>;

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

  strategyPlans: StrategyPlan[];
  addStrategyPlan: (plan: Omit<StrategyPlan, 'id' | 'createdAt'>) => Promise<void>;
  deleteStrategyPlan: (id: string) => Promise<void>;

  addWhatsAppMessage: (msg: Omit<WhatsAppMessage, 'id' | 'sentAt'>) => Promise<void>;
  deleteWhatsAppMessage: (id: string) => Promise<void>;

  uploadRecording: (entityType: 'client' | 'lead', entityId: string, file: File) => Promise<{ signedUrl: string; storagePath: string } | null>;

  addCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCalendarEvent: (event: CalendarEvent) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;

  addIdea: (idea: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateIdea: (idea: Idea) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;

  addKnowledgeArticle: (article: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateKnowledgeArticle: (article: KnowledgeArticle) => Promise<void>;
  deleteKnowledgeArticle: (id: string) => Promise<void>;
  uploadKnowledgeFile: (file: File) => Promise<string | null>;

  uploadReceiptImage: (file: File) => Promise<string | null>;
  getReceiptUrl: (path: string) => Promise<string | null>;

  updateServices: (services: Service[]) => Promise<void> | void;
  updateSettings: (settings: AgencySettings) => Promise<void>;
  saveApiKeys: (keys: { canvaApiKey?: string; canvaTemplateId?: string; geminiApiKey?: string }) => Promise<void>;
  saveSignalsWebhookSecret: (secret: string) => Promise<void>;
  saveTelegramBotToken: (token: string) => Promise<void>;

  uploadLogo: (file: File) => Promise<string | null>;
  deleteLogo: () => Promise<void>;

  runCompetitorScout: (params: { entityId: string; entityType: 'client' | 'lead'; businessName: string; industry: string; website?: string; services?: string[]; additionalContext?: string }) => Promise<CompetitorReport | null>;
  deleteCompetitorReport: (id: string) => Promise<void>;

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

// Helper: attach tenant_id to a DB row
// CRITICAL: tenant_id must come from AuthContext — never use a hardcoded default!
const withTenant = <T extends Record<string, unknown>>(row: T, tid: string | null): T => {
  if (!tid) {
    console.error('withTenant called without tenantId! Data will not be saved correctly.');
  }
  return { ...row, tenant_id: tid || '00000000-0000-0000-0000-000000000000' }; // impossible UUID if null
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
  facebook_url: client.facebookUrl || null,
  instagram_url: client.instagramUrl || null,
  website_url: client.websiteUrl || null,
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
  facebookUrl: row.facebook_url || undefined,
  instagramUrl: row.instagram_url || undefined,
  websiteUrl: row.website_url || undefined,
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
  facebook_url: lead.facebookUrl || null,
  instagram_url: lead.instagramUrl || null,
  website_url: lead.websiteUrl || null,
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
  facebookUrl: row.facebook_url || undefined,
  instagramUrl: row.instagram_url || undefined,
  websiteUrl: row.website_url || undefined,
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
  receipt_url: expense.receiptUrl || null,
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
  receiptUrl: row.receipt_url || undefined,
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

const transformSettingsToDB = (settings: AgencySettings, tid: string | null) => ({
  // tenant_id is now the PK — each tenant gets exactly one settings row
  tenant_id: tid || '00000000-0000-0000-0000-000000000000',
  agency_name: settings.agencyName,
  owner_name: settings.ownerName,
  target_monthly_revenue: settings.targetMonthlyRevenue,
  target_monthly_gross_profit: settings.targetMonthlyGrossProfit,
  employee_salary: settings.employeeSalary || 0,
  is_salaried: settings.isSalaried || false,
  // PDF Branding colors (logo path saved separately via uploadLogo)
  brand_primary_color: settings.brandPrimaryColor || '#14b8a6',
  brand_secondary_color: settings.brandSecondaryColor || '#0f766e',
  brand_accent_color: settings.brandAccentColor || '#f59e0b',
  // Note: API keys are NOT included here — they are saved via saveApiKeys() directly
});

const transformSettingsFromDB = (row: SettingsRow): AgencySettings => ({
  agencyName: row.agency_name,
  ownerName: row.owner_name,
  targetMonthlyRevenue: row.target_monthly_revenue,
  targetMonthlyGrossProfit: row.target_monthly_gross_profit,
  employeeSalary: row.employee_salary || 0,
  isSalaried: row.is_salaried || false,
  // Security: only send boolean flags to frontend, never actual keys
  hasCanvaKey: !!(row.canva_api_key && row.canva_api_key.length > 0),
  hasGeminiKey: !!(row.gemini_api_key && row.gemini_api_key.length > 0),
  canvaTemplateId: row.canva_template_id || undefined,
  hasSignalsWebhookSecret: !!(row.signals_webhook_secret && row.signals_webhook_secret.length > 0),
  hasTelegramBotToken: !!(row.telegram_bot_token && row.telegram_bot_token.length > 0),
  telegramChatId: row.telegram_chat_id || undefined,
  // PDF Branding
  logoStoragePath: row.logo_storage_path || undefined,
  brandPrimaryColor: row.brand_primary_color || '#14b8a6',
  brandSecondaryColor: row.brand_secondary_color || '#0f766e',
  brandAccentColor: row.brand_accent_color || '#f59e0b',
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

const transformStrategyPlanToDB = (plan: StrategyPlan) => ({
  id: plan.id,
  client_id: plan.clientId || null,
  lead_id: plan.leadId || null,
  entity_name: plan.entityName,
  plan_data: plan.planData,
  raw_text: plan.rawText || null,
  created_by: plan.createdBy,
  created_by_name: plan.createdByName,
  created_at: plan.createdAt,
});

const transformStrategyPlanFromDB = (row: StrategyPlanRow): StrategyPlan => {
  let planData;
  try {
    const raw = typeof row.plan_data === 'string' ? JSON.parse(row.plan_data) : row.plan_data;
    planData = raw && typeof raw === 'object' && 'summary' in raw ? raw : {
      summary: '', situationAnalysis: { whatsWorking: [], whatsNotWorking: [], dependencies: [], risks: [], opportunities: [] },
      actionPlan: [], kpis: []
    };
  } catch {
    planData = {
      summary: '', situationAnalysis: { whatsWorking: [], whatsNotWorking: [], dependencies: [], risks: [], opportunities: [] },
      actionPlan: [], kpis: []
    };
  }
  return {
    id: row.id,
    clientId: row.client_id || undefined,
    leadId: row.lead_id || undefined,
    entityName: row.entity_name || '',
    planData,
    rawText: row.raw_text || undefined,
    createdBy: row.created_by,
    createdByName: row.created_by_name || '',
    createdAt: row.created_at,
  };
};

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
  business_intel_v2: Record<string, unknown> | null;
  result_url: string | null;
  lang: string;
  questionnaire_version: string;
  received_at: string;
  updated_at: string;
}

// --- Calendar Events ---
interface CalendarEventRow {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  description: string;
  client_id: string | null;
  lead_id: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface IdeaRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  client_id: string | null;
  lead_id: string | null;
  category: string;
  tags: string;
  created_by: string;
  created_by_name: string;
  assigned_to: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface KnowledgeArticleRow {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  is_ai_generated: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface CompetitorReportRow {
  id: string;
  entity_id: string;
  entity_type: string;
  business_name: string;
  industry: string | null;
  website: string | null;
  analysis: Record<string, unknown>;
  created_by: string;
  created_at: string;
  tenant_id: string;
}

const transformCompetitorReportFromDB = (row: CompetitorReportRow): CompetitorReport => ({
  id: row.id,
  entityId: row.entity_id,
  entityType: row.entity_type as 'client' | 'lead',
  businessName: row.business_name,
  industry: row.industry || undefined,
  website: row.website || undefined,
  analysis: (row.analysis as unknown as CompetitorAnalysis) || { summary: '', competitors: [], opportunities: [], threats: [], recommendations: [], marketTrends: [] },
  createdBy: row.created_by,
  createdAt: row.created_at,
});

const transformCalendarEventToDB = (event: CalendarEvent) => ({
  id: event.id,
  title: event.title,
  event_type: event.eventType,
  start_time: event.startTime,
  end_time: event.endTime || null,
  all_day: event.allDay,
  description: event.description || '',
  client_id: event.clientId || null,
  lead_id: event.leadId || null,
  created_by: event.createdBy,
  created_by_name: event.createdByName,
  created_at: event.createdAt,
  updated_at: event.updatedAt,
});

const transformCalendarEventFromDB = (row: CalendarEventRow): CalendarEvent => ({
  id: row.id,
  title: row.title,
  eventType: row.event_type as CalendarEventType,
  startTime: row.start_time,
  endTime: row.end_time || undefined,
  allDay: row.all_day ?? false,
  description: row.description || '',
  clientId: row.client_id || undefined,
  leadId: row.lead_id || undefined,
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const transformIdeaToDB = (idea: Idea) => ({
  id: idea.id,
  title: idea.title,
  description: idea.description || '',
  status: idea.status,
  priority: idea.priority,
  client_id: idea.clientId || null,
  lead_id: idea.leadId || null,
  category: idea.category || '',
  tags: JSON.stringify(idea.tags || []),
  created_by: idea.createdBy,
  created_by_name: idea.createdByName,
  assigned_to: idea.assignedTo || null,
  due_date: idea.dueDate || null,
  sort_order: idea.sortOrder || 0,
  created_at: idea.createdAt,
  updated_at: idea.updatedAt,
});

const transformIdeaFromDB = (row: IdeaRow): Idea => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  status: row.status as IdeaStatus,
  priority: row.priority as IdeaPriority,
  clientId: row.client_id || undefined,
  leadId: row.lead_id || undefined,
  category: row.category || '',
  tags: safeJsonParse(row.tags) as string[],
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  assignedTo: row.assigned_to || undefined,
  dueDate: row.due_date || undefined,
  sortOrder: row.sort_order || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const transformKnowledgeArticleToDB = (article: KnowledgeArticle) => ({
  id: article.id,
  title: article.title,
  content: article.content || '',
  summary: article.summary || '',
  category: article.category || 'general',
  tags: JSON.stringify(article.tags || []),
  file_url: article.fileUrl || null,
  file_name: article.fileName || null,
  file_type: article.fileType || null,
  is_ai_generated: article.isAiGenerated || false,
  created_by: article.createdBy,
  created_by_name: article.createdByName,
  created_at: article.createdAt,
  updated_at: article.updatedAt,
});

const transformKnowledgeArticleFromDB = (row: KnowledgeArticleRow): KnowledgeArticle => ({
  id: row.id,
  title: row.title,
  content: row.content || '',
  summary: row.summary || '',
  category: row.category || 'general',
  tags: safeJsonParse(row.tags) as string[],
  fileUrl: row.file_url || undefined,
  fileName: row.file_name || undefined,
  fileType: row.file_type || undefined,
  isAiGenerated: row.is_ai_generated ?? false,
  createdBy: row.created_by,
  createdByName: row.created_by_name || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

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
  businessIntelV2: (row.business_intel_v2 as unknown as BusinessIntelV2) || null,
  resultUrl: row.result_url || undefined,
  lang: row.lang || 'he',
  questionnaireVersion: row.questionnaire_version || '',
  receivedAt: row.received_at,
  updatedAt: row.updated_at,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenantId } = useAuth();

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
    calendarEvents: [],
    ideas: [],
    knowledgeArticles: [],
    competitorReports: [],
    strategyPlans: [],
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
    supabase.from('activity_log').insert(withTenant({
      id: entry.id,
      action_type: entry.actionType,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      description: entry.description,
      created_at: entry.createdAt,
    }, tenantId)).then(({ error }) => {
      if (error) console.warn('Activity log not persisted (table may not exist yet):', error.message);
    });
  }, [tenantId]);

  // Load data from Supabase on mount (only when tenantId is known)
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsLoaded(true);
          return;
        }

        // CRITICAL: Don't load data until we know which tenant the user belongs to
        // RLS uses current_tenant_id() which depends on user_roles.tenant_id
        if (!tenantId) {
          console.warn('DataProvider: tenantId not set, skipping data load');
          setIsLoaded(true);
          return;
        }

        const [clientsRes, leadsRes, dealsRes, expensesRes, paymentsRes, settingsRes, activitiesRes, retainerChangesRes, clientNotesRes, leadNotesRes, callTranscriptsRes, aiRecommendationsRes, whatsappMessagesRes, signalsPersonalitiesRes, calendarEventsRes, ideasRes, knowledgeRes, competitorReportsRes, strategyPlansRes] = await Promise.all([
          supabase.from('clients').select('*').order('added_at', { ascending: false }),
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('deals').select('*').order('deal_date', { ascending: false }),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('payments').select('*').order('period_month', { ascending: false }),
          supabase.from('settings').select('*').eq('tenant_id', tenantId).single(),
          supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('retainer_changes').select('*').order('changed_at', { ascending: false }),
          supabase.from('client_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('lead_notes').select('*').order('created_at', { ascending: false }),
          supabase.from('call_transcripts').select('*').order('call_date', { ascending: false }),
          supabase.from('ai_recommendations').select('*').order('created_at', { ascending: false }),
          supabase.from('whatsapp_messages').select('*').order('sent_at', { ascending: false }),
          supabase.from('signals_personality').select('*').order('received_at', { ascending: false }),
          supabase.from('calendar_events').select('*').order('start_time', { ascending: true }),
          supabase.from('ideas').select('*').order('sort_order', { ascending: true }),
          supabase.from('knowledge_articles').select('*').order('created_at', { ascending: false }),
          supabase.from('competitor_reports').select('*').order('created_at', { ascending: false }),
          supabase.from('strategy_plans').select('*').order('created_at', { ascending: false }),
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
        const calendarEvents: CalendarEvent[] = (calendarEventsRes.data || []).map((row: CalendarEventRow) => transformCalendarEventFromDB(row));
        const ideas: Idea[] = (ideasRes?.data || []).map((row: IdeaRow) => transformIdeaFromDB(row));
        const knowledgeArticles: KnowledgeArticle[] = (knowledgeRes?.data || []).map((row: KnowledgeArticleRow) => transformKnowledgeArticleFromDB(row));
        const competitorReports: CompetitorReport[] = (competitorReportsRes?.data || []).map((row: CompetitorReportRow) => transformCompetitorReportFromDB(row));
        const strategyPlans: StrategyPlan[] = (strategyPlansRes?.data || []).map((row: StrategyPlanRow) => transformStrategyPlanFromDB(row));

        let settings = DEFAULT_SETTINGS;
        let loadedServices: Service[] = INITIAL_SERVICES;
        if (settingsRes.data && !settingsRes.error) {
          settings = transformSettingsFromDB(settingsRes.data);
          // Load services from DB if available
          const rawRow = settingsRes.data as SettingsRow;
          if (rawRow.services_json) {
            try {
              const parsed = JSON.parse(rawRow.services_json);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedServices = parsed;
              }
            } catch { /* use default */ }
          }
        } else {
          // No settings row for this tenant — create one
          const { error: upsertError } = await supabase.from('settings').upsert(
            transformSettingsToDB(DEFAULT_SETTINGS, tenantId),
            { onConflict: 'tenant_id' }
          );
          if (upsertError) console.error('Error initializing settings:', upsertError);
        }

        // Resolve logo public URL if a logo path exists
        if (settings.logoStoragePath) {
          const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(settings.logoStoragePath);
          if (publicUrlData?.publicUrl) {
            settings = { ...settings, logoUrl: publicUrlData.publicUrl };
          }
        }

        setData({
          clients,
          leads,
          oneTimeDeals: deals,
          expenses,
          payments,
          services: loadedServices,
          settings,
          activities,
          retainerHistory,
          clientNotes,
          leadNotes,
          callTranscripts,
          aiRecommendations,
          whatsappMessages,
          signalsPersonalities,
          calendarEvents,
          ideas,
          knowledgeArticles,
          competitorReports,
          strategyPlans,
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
  }, [tenantId]);

  const addClient = async (client: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...client,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('clients')
        .insert(withTenant(transformClientToDB(newClient), tenantId));

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
        supabase.from('retainer_changes').insert(withTenant(transformRetainerChangeToDB(change), tenantId)).then(({ error: rcError }) => {
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
        .insert(withTenant(transformLeadToDB(newLead), tenantId));

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
        .insert(withTenant(transformClientToDB(newClient), tenantId));

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
        .insert(withTenant(transformDealToDB(newDeal), tenantId));

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

  const deleteDeal = async (id: string) => {
    try {
      const deal = data.oneTimeDeals.find(d => d.dealId === id);
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('deal_id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        oneTimeDeals: prev.oneTimeDeals.filter(d => d.dealId !== id)
      }));
      logActivity('deal_deleted', 'deal', `נמחק פרויקט: ${deal?.dealName || id}`, id);
    } catch (err) {
      showError('שגיאה במחיקת פרויקט');
      throw err;
    }
  };

  const addExpense = async (expense: Omit<SupplierExpense, 'expenseId'>) => {
    const newExpense: SupplierExpense = {
      ...expense,
      expenseId: generateId()
    };

    try {
      const row = withTenant(transformExpenseToDB(newExpense), tenantId);
      console.log('[addExpense] inserting row:', JSON.stringify(row));
      const { error } = await supabase
        .from('expenses')
        .insert(row);

      if (error) {
        console.error('[addExpense] Supabase error:', error.code, error.message, error.details, error.hint);
        throw error;
      }

      setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
      logActivity('expense_added', 'expense', `הוצאה חדשה: ${expense.supplierName} - ₪${expense.amount}`, newExpense.expenseId);
    } catch (err) {
      console.error('[addExpense] Full error:', err);
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
      const dbRows = newExpenses.map(e => withTenant(transformExpenseToDB(e), tenantId));
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
        .insert(withTenant(transformPaymentToDB(newPayment), tenantId));

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

      const dbRows = newPayments.map(p => withTenant(transformPaymentToDB(p), tenantId));
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
        .insert(withTenant(transformClientNoteToDB(note), tenantId));

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
        .insert(withTenant(transformLeadNoteToDB(note), tenantId));

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
        .insert(withTenant(transformCallTranscriptToDB(newCT), tenantId));

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
        .insert(withTenant(transformAIRecommendationToDB(newRec), tenantId));

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

  // --- Strategy Plans ---
  const addStrategyPlan = async (plan: Omit<StrategyPlan, 'id' | 'createdAt'>) => {
    const newPlan: StrategyPlan = {
      ...plan,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('strategy_plans')
        .insert(withTenant(transformStrategyPlanToDB(newPlan), tenantId));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        strategyPlans: [newPlan, ...prev.strategyPlans],
      }));

      logActivity('strategy_plan_created', plan.clientId ? 'client' : 'lead',
        `תוכנית אסטרטגית נוצרה עבור ${plan.entityName}`, plan.clientId || plan.leadId);
    } catch (err) {
      showError('שגיאה בשמירת תוכנית אסטרטגית');
      throw err;
    }
  };

  const deleteStrategyPlan = async (id: string) => {
    try {
      const { error } = await supabase
        .from('strategy_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        strategyPlans: prev.strategyPlans.filter(s => s.id !== id),
      }));
    } catch (err) {
      showError('שגיאה במחיקת תוכנית אסטרטגית');
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
        .insert(withTenant(transformWhatsAppMessageToDB(newMsg), tenantId));

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

  // --- Calendar Events ---
  const addCalendarEvent = async (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      ...event,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const { error } = await supabase
        .from('calendar_events')
        .insert(withTenant(transformCalendarEventToDB(newEvent), tenantId));

      if (error) throw error;

      setData(prev => ({
        ...prev,
        calendarEvents: [...prev.calendarEvents, newEvent],
      }));
      logActivity('event_added', 'calendar', `אירוע חדש: ${event.title}`, newEvent.id);
    } catch (err) {
      showError('שגיאה בהוספת אירוע');
      throw err;
    }
  };

  const updateCalendarEvent = async (event: CalendarEvent) => {
    const updated = { ...event, updatedAt: new Date().toISOString() };
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update(transformCalendarEventToDB(updated))
        .eq('id', event.id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map(e => e.id === event.id ? updated : e),
      }));
      logActivity('event_updated', 'calendar', `עודכן אירוע: ${event.title}`, event.id);
    } catch (err) {
      showError('שגיאה בעדכון אירוע');
      throw err;
    }
  };

  const deleteCalendarEvent = async (id: string) => {
    const eventTitle = data.calendarEvents.find(e => e.id === id)?.title || id;
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        calendarEvents: prev.calendarEvents.filter(e => e.id !== id),
      }));
      logActivity('event_deleted', 'calendar', `נמחק אירוע: ${eventTitle}`, id);
    } catch (err) {
      showError('שגיאה במחיקת אירוע');
      throw err;
    }
  };

  // --- Ideas CRUD ---
  const addIdea = async (idea: Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newIdea: Idea = { ...idea, id: generateId(), createdAt: now, updatedAt: now };
    try {
      const { error } = await supabase.from('ideas').insert(withTenant(transformIdeaToDB(newIdea), tenantId));
      if (error) throw error;
      setData(prev => ({ ...prev, ideas: [...prev.ideas, newIdea] }));
      logActivity('idea_added', 'idea', `רעיון חדש: ${idea.title}`, newIdea.id);
    } catch (err) { showError('שגיאה בהוספת רעיון'); throw err; }
  };

  const updateIdea = async (idea: Idea) => {
    const updated = { ...idea, updatedAt: new Date().toISOString() };
    try {
      const { error } = await supabase.from('ideas').update(transformIdeaToDB(updated)).eq('id', idea.id);
      if (error) throw error;
      setData(prev => ({ ...prev, ideas: prev.ideas.map(i => i.id === idea.id ? updated : i) }));
    } catch (err) { showError('שגיאה בעדכון רעיון'); throw err; }
  };

  const deleteIdea = async (id: string) => {
    const ideaTitle = data.ideas.find(i => i.id === id)?.title || id;
    try {
      const { error } = await supabase.from('ideas').delete().eq('id', id);
      if (error) throw error;
      setData(prev => ({ ...prev, ideas: prev.ideas.filter(i => i.id !== id) }));
      logActivity('idea_deleted', 'idea', `נמחק רעיון: ${ideaTitle}`, id);
    } catch (err) { showError('שגיאה במחיקת רעיון'); throw err; }
  };

  // --- Knowledge Articles CRUD ---
  const addKnowledgeArticle = async (article: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newArticle: KnowledgeArticle = { ...article, id: generateId(), createdAt: now, updatedAt: now };
    try {
      const { error } = await supabase.from('knowledge_articles').insert(withTenant(transformKnowledgeArticleToDB(newArticle), tenantId));
      if (error) throw error;
      setData(prev => ({ ...prev, knowledgeArticles: [newArticle, ...prev.knowledgeArticles] }));
      logActivity('article_added', 'knowledge', `מאמר חדש: ${article.title}`, newArticle.id);
    } catch (err) { showError('שגיאה בהוספת מאמר'); throw err; }
  };

  const updateKnowledgeArticle = async (article: KnowledgeArticle) => {
    const updated = { ...article, updatedAt: new Date().toISOString() };
    try {
      const { error } = await supabase.from('knowledge_articles').update(transformKnowledgeArticleToDB(updated)).eq('id', article.id);
      if (error) throw error;
      setData(prev => ({ ...prev, knowledgeArticles: prev.knowledgeArticles.map(a => a.id === article.id ? updated : a) }));
    } catch (err) { showError('שגיאה בעדכון מאמר'); throw err; }
  };

  const deleteKnowledgeArticle = async (id: string) => {
    const articleTitle = data.knowledgeArticles.find(a => a.id === id)?.title || id;
    try {
      const { error } = await supabase.from('knowledge_articles').delete().eq('id', id);
      if (error) throw error;
      setData(prev => ({ ...prev, knowledgeArticles: prev.knowledgeArticles.filter(a => a.id !== id) }));
      logActivity('article_deleted', 'knowledge', `נמחק מאמר: ${articleTitle}`, id);
    } catch (err) { showError('שגיאה במחיקת מאמר'); throw err; }
  };

  const uploadKnowledgeFile = async (file: File): Promise<string | null> => {
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
      const { error } = await supabase.storage.from('knowledge').upload(safeName, file, { upsert: false });
      if (error) { showError('שגיאה בהעלאת קובץ: ' + error.message); return null; }
      const { data: urlData } = await supabase.storage.from('knowledge').createSignedUrl(safeName, 3600);
      return urlData?.signedUrl || null;
    } catch (err) { showError('שגיאה בהעלאת קובץ'); return null; }
  };

  // --- Receipt Image Upload ---
  const uploadReceiptImage = async (file: File): Promise<string | null> => {
    try {
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._\-]/g, '_')}`;
      const { error } = await supabase.storage
        .from('receipts')
        .upload(safeName, file, { upsert: false });

      if (error) {
        showError('שגיאה בהעלאת קבלה: ' + error.message);
        return null;
      }

      return safeName;
    } catch (err) {
      showError('שגיאה בהעלאת קבלה');
      return null;
    }
  };

  const getReceiptUrl = async (path: string): Promise<string | null> => {
    try {
      const { data: urlData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path, 3600);
      return urlData?.signedUrl || null;
    } catch {
      return null;
    }
  };

  const updateServices = async (services: Service[]) => {
    setData(prev => ({ ...prev, services }));
    // Persist services to settings.services_json
    try {
      await supabase
        .from('settings')
        .update({ services_json: JSON.stringify(services) })
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Failed to persist services:', err);
    }
  };

  const updateSettings = async (settings: AgencySettings) => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(transformSettingsToDB(settings, tenantId), { onConflict: 'tenant_id' });

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
        .eq('tenant_id', tenantId);

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
        .eq('tenant_id', tenantId);

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

  // Save Telegram Bot Token
  const saveTelegramBotToken = async (token: string) => {
    try {
      const { error } = await supabase
        .from('settings')
        .update({ telegram_bot_token: token || null })
        .eq('tenant_id', tenantId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          hasTelegramBotToken: !!token,
        },
      }));
    } catch (err) {
      showError('שגיאה בשמירת טוקן Telegram');
      throw err;
    }
  };

  // Upload logo to storage and save path to settings
  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeName = `${tenantId || 'default'}/logo_${Date.now()}.${ext}`;

      // Delete old logo if exists
      if (data.settings.logoStoragePath) {
        await supabase.storage.from('logos').remove([data.settings.logoStoragePath]);
      }

      const { error: uploadErr } = await supabase.storage
        .from('logos')
        .upload(safeName, file, { upsert: true, contentType: file.type });

      if (uploadErr) {
        showError('שגיאה בהעלאת הלוגו: ' + uploadErr.message);
        return null;
      }

      // Save path to settings
      const { error: updateErr } = await supabase
        .from('settings')
        .update({ logo_storage_path: safeName })
        .eq('tenant_id', tenantId);

      if (updateErr) {
        showError('שגיאה בשמירת נתיב הלוגו');
        return null;
      }

      // Resolve public URL
      const { data: publicUrlData } = supabase.storage
        .from('logos')
        .getPublicUrl(safeName);

      const logoUrl = publicUrlData?.publicUrl || undefined;

      setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          logoStoragePath: safeName,
          logoUrl,
        },
      }));

      return logoUrl || null;
    } catch (err) {
      showError('שגיאה בהעלאת הלוגו');
      return null;
    }
  };

  // Delete logo
  const deleteLogo = async (): Promise<void> => {
    try {
      if (data.settings.logoStoragePath) {
        await supabase.storage.from('logos').remove([data.settings.logoStoragePath]);
      }

      await supabase
        .from('settings')
        .update({ logo_storage_path: null })
        .eq('tenant_id', tenantId);

      setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          logoStoragePath: undefined,
          logoUrl: undefined,
        },
      }));
    } catch (err) {
      showError('שגיאה במחיקת הלוגו');
    }
  };

  // Run competitor scout analysis via Edge Function
  const runCompetitorScout = async (params: {
    entityId: string;
    entityType: 'client' | 'lead';
    businessName: string;
    industry: string;
    website?: string;
    services?: string[];
    additionalContext?: string;
  }): Promise<CompetitorReport | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('נדרשת התחברות');
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/competitor-scout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(params),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        showError(result.error || 'שגיאה בביצוע ניתוח תחרותי');
        return null;
      }

      // Add to local state
      const newReport: CompetitorReport = {
        id: result.reportId,
        entityId: params.entityId,
        entityType: params.entityType,
        businessName: params.businessName,
        industry: params.industry,
        website: params.website,
        analysis: result.analysis as CompetitorAnalysis,
        createdBy: session.user.id,
        createdAt: new Date().toISOString(),
      };

      setData(prev => ({
        ...prev,
        competitorReports: [newReport, ...prev.competitorReports],
      }));

      return newReport;
    } catch (err) {
      showError('שגיאה בביצוע ניתוח תחרותי');
      return null;
    }
  };

  // Delete competitor report
  const deleteCompetitorReport = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('competitor_reports').delete().eq('id', id);
      if (error) throw error;
      setData(prev => ({
        ...prev,
        competitorReports: prev.competitorReports.filter(r => r.id !== id),
      }));
    } catch (err) {
      showError('שגיאה במחיקת דוח תחרותי');
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
        calendarEvents: parsed.calendarEvents || [],
        ideas: parsed.ideas || [],
        knowledgeArticles: parsed.knowledgeArticles || [],
        competitorReports: parsed.competitorReports || [],
        strategyPlans: parsed.strategyPlans || [],
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
      addDeal, updateDeal, deleteDeal,
      addExpense, updateExpense, deleteExpense, generateMonthlyExpenses,
      addPayment, updatePayment, deletePayment, generateMonthlyPayments,
      uploadClientFile, listClientFiles, deleteClientFile,
      addClientNote, deleteClientNote,
      addLeadNote, deleteLeadNote,
      addCallTranscript, deleteCallTranscript,
      addAIRecommendation, deleteAIRecommendation,
      addStrategyPlan, deleteStrategyPlan,
      addWhatsAppMessage, deleteWhatsAppMessage,
      uploadRecording,
      addCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
      addIdea, updateIdea, deleteIdea,
      addKnowledgeArticle, updateKnowledgeArticle, deleteKnowledgeArticle, uploadKnowledgeFile,
      uploadReceiptImage, getReceiptUrl,
      updateServices, updateSettings, saveApiKeys, saveSignalsWebhookSecret, saveTelegramBotToken,
      uploadLogo, deleteLogo,
      runCompetitorScout, deleteCompetitorReport,
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
