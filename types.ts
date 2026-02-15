export enum ClientRating {
  A_PLUS = "A_plus",
  A = "A",
  B = "B",
  C = "C"
}

export enum ClientStatus {
  Active = "פעיל",
  Paused = "מושהה",
  Leaving = "בתהליך עזיבה",
  Left = "עזב"
}

export enum EffortLevel {
  Low = "Low",
  Medium = "Medium",
  High = "High"
}

export interface Client {
  clientId: string;
  clientName: string;
  businessName: string;
  phone: string;
  email: string;
  industry: string;
  rating: ClientRating;
  status: ClientStatus;
  joinDate: string; // ISO Date string
  churnDate?: string; // ISO Date string - תאריך נטישה
  monthlyRetainer: number;
  billingDay: number;
  services: string[]; // Service keys
  effortLevel: EffortLevel;
  supplierCostMonthly: number;
  notes: string;
  nextReviewDate: string; // ISO Date string
  addedAt: string; // ISO Date string
  assignedTo?: string; // UUID of assigned handler (user_id from user_roles)
}

export enum LeadStatus {
  New = "חדש",
  Contacted = "נוצר קשר",
  Proposal_sent = "נשלחה הצעה",
  Meeting_scheduled = "נקבעה פגישה",
  Pending_decision = "ממתין להחלטה",
  Won = "נסגר בהצלחה",
  Lost = "אבוד",
  Not_relevant = "לא רלוונטי"
}

export enum SourceChannel {
  Facebook = "Facebook",
  Instagram = "Instagram",
  Referral = "Referral",
  Website = "Website",
  WhatsApp = "WhatsApp",
  Other = "Other"
}

export interface Lead {
  leadId: string;
  createdAt: string;
  leadName: string;
  businessName?: string;
  phone: string;
  email?: string;
  sourceChannel: SourceChannel;
  interestedServices: string[];
  notes: string;
  nextContactDate: string;
  status: LeadStatus;
  quotedMonthlyValue: number;
  relatedClientId?: string;
  createdBy?: string;
  assignedTo?: string; // UUID of assigned handler (user_id from user_roles)
}

export enum DealStatus {
  In_progress = "In_progress",
  Completed = "Completed",
  Paid = "Paid",
  Unpaid = "Unpaid"
}

export interface OneTimeDeal {
  dealId: string;
  clientId: string;
  dealName: string;
  dealType: string;
  dealAmount: number;
  dealDate: string;
  dealStatus: DealStatus;
  supplierCost: number;
  notes: string;
}

export enum ExpenseType {
  Media = "Media",
  Freelancer = "Freelancer",
  Tool = "Tool",
  Other = "Other"
}

export interface SupplierExpense {
  expenseId: string;
  clientId?: string;
  expenseDate: string;
  monthKey: string; // YYYYMM
  supplierName: string;
  expenseType: ExpenseType;
  amount: number;
  notes: string;
  isRecurring: boolean;
}

export enum PaymentStatus {
  Paid = "Paid",
  Partial = "Partial",
  Unpaid = "Unpaid"
}

export interface Payment {
  paymentId: string;
  clientId: string;
  periodMonth: string; // YYYYMM
  amountDue: number;
  amountPaid: number;
  paymentDate?: string;
  paymentStatus: PaymentStatus;
  notes: string;
}

export interface Service {
  serviceKey: string;
  label: string;
  isActive: boolean;
}

export interface AgencySettings {
  agencyName: string;
  ownerName: string;
  targetMonthlyRevenue: number;
  targetMonthlyGrossProfit: number;
  employeeSalary: number;
  // Security: only boolean flags reach the frontend — actual keys stay server-side
  hasCanvaKey: boolean;
  hasGeminiKey: boolean;
  canvaTemplateId?: string;
}

export interface ActivityEntry {
  id: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  description: string;
  createdAt: string;
}

export interface RetainerChange {
  id: string;
  clientId: string;
  oldRetainer: number;
  newRetainer: number;
  oldSupplierCost: number;
  newSupplierCost: number;
  changedAt: string;
  notes: string;
}

export type NoteType = 'manual' | 'transcript_summary' | 'recommendation_summary' | 'proposal_focus';

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  noteType: NoteType;
  sourceId?: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  noteType: NoteType;
  sourceId?: string;
}

export interface CallTranscript {
  id: string;
  clientId?: string;
  leadId?: string;
  callDate: string;
  participants: string;
  transcript: string;
  summary: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface AIRecommendation {
  id: string;
  clientId?: string;
  leadId?: string;
  recommendation: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface WhatsAppMessage {
  id: string;
  clientId?: string;
  leadId?: string;
  messageText: string;
  messagePurpose: string;
  phoneNumber: string;
  sentBy: string;
  sentByName: string;
  isAiGenerated: boolean;
  sentAt: string;
}

export interface AppData {
  clients: Client[];
  leads: Lead[];
  oneTimeDeals: OneTimeDeal[];
  expenses: SupplierExpense[];
  payments: Payment[];
  services: Service[];
  settings: AgencySettings;
  activities: ActivityEntry[];
  retainerHistory: RetainerChange[];
  clientNotes: ClientNote[];
  leadNotes: LeadNote[];
  callTranscripts: CallTranscript[];
  aiRecommendations: AIRecommendation[];
  whatsappMessages: WhatsAppMessage[];
}