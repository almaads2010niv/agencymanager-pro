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
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
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
  facebookUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
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
  receiptUrl?: string;
}

// ── Calendar Event Types ──────────────────────────────────────
export type CalendarEventType = 'call' | 'meeting' | 'zoom' | 'task' | 'reminder';

export interface CalendarEvent {
  id: string;
  title: string;
  eventType: CalendarEventType;
  startTime: string; // ISO Date string
  endTime?: string; // ISO Date string
  allDay: boolean;
  description: string;
  clientId?: string;
  leadId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
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
  isSalaried: boolean;
  // Security: only boolean flags reach the frontend — actual keys stay server-side
  hasCanvaKey: boolean;
  hasGeminiKey: boolean;
  canvaTemplateId?: string;
  hasSignalsWebhookSecret: boolean;
  hasTelegramBotToken: boolean;
  telegramChatId?: string;
  hasResendKey: boolean;
  notificationEmail?: string;
  // PDF Branding
  logoStoragePath?: string;
  logoUrl?: string; // resolved public URL for the logo (computed, not stored)
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  // Proposal templates
  proposalPhasesTemplate?: ProposalPhase[];
  proposalPackagesTemplate?: ProposalPackage[];
  proposalTermsTemplate?: string[];
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

export type NoteType = 'manual' | 'transcript_summary' | 'recommendation_summary' | 'proposal_focus' | 'personality_insight';

// ── Signals OS Personality Types ──────────────────────────────
export type Archetype = 'WINNER' | 'STAR' | 'DREAMER' | 'HEART' | 'ANCHOR';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ChurnRisk = 'HIGH' | 'MEDIUM' | 'LOW';

// ── Signals OS Business Intelligence V2 ─────────────────────
export interface HeroCard {
  profileLine: string;
  archetype: string;
  secondaryArchetype: string;
  riskLevel: string;
  riskExplanation: string;
  topStrength: string;
  topRisk: string;
  priorityStars: number;
  urgency: string;
  closeRate: number;
}

export interface ActionItem {
  priority: number;
  action: string;
  why: string;
  how: string;
}

export interface QuickScript {
  opener: string;
  keyQuestion: string;
  closeLine: string;
}

export interface ProfileBriefing {
  whoIsThis: string;
  strengths: string[];
  weaknesses: string[];
  goalForCall: string;
  timeAllocation: string;
}

export interface ScriptDoor {
  title: string;
  youSay: string;
  customerSays?: string;
  profileInsight: string;
  critical?: string;
}

export interface FullFiveDoorScript {
  profileBriefing: ProfileBriefing;
  door1Opening: ScriptDoor;
  door2DeepListening: ScriptDoor;
  door3TheOffer: ScriptDoor;
  door4aYes: ScriptDoor;
  door4bHesitant: ScriptDoor;
  door5aObjectionFear: ScriptDoor;
  door5bObjectionPrice: ScriptDoor;
  postCallChecklist: string[];
  retentionNotes: string;
}

export interface BusinessIntelV2 {
  // Layer 1 — Quick Scan (30 seconds)
  heroCard: HeroCard;
  actionItems: ActionItem[];
  quickScript: QuickScript;
  redFlags: string[];
  // Layer 2 — Deep Dive (5 minutes)
  fullScript: FullFiveDoorScript;
  profileInsights: string;
  retentionStrategy: string;
}

export interface SignalsPersonality {
  id: string;
  leadId: string;
  clientId?: string;
  analysisId: string;
  tenantId: string;
  subjectName: string;
  subjectEmail: string;
  subjectPhone?: string;
  scores: Record<Archetype, number>;
  primaryArchetype: Archetype;
  secondaryArchetype: Archetype;
  confidenceLevel: ConfidenceLevel;
  churnRisk: ChurnRisk;
  smartTags: string[];
  userReport?: string;
  businessReport?: string;
  salesCheatSheet: Record<string, string | string[]>;
  retentionCheatSheet: Record<string, string>;
  businessIntelV2?: BusinessIntelV2 | null;
  resultUrl?: string;
  lang: string;
  questionnaireVersion: string;
  receivedAt: string;
  updatedAt: string;
}

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

// ── Strategy Plan Types ─────────────────────────────────────
export interface StrategyAction {
  number: number;
  title: string;
  description: string;
  owner: string;
  kpi: string;
}

export interface StrategyPhase {
  phaseLabel: string;
  phaseSummary: string;
  actions: StrategyAction[];
}

export interface StrategySituationAnalysis {
  whatsWorking: string[];
  whatsNotWorking: string[];
  dependencies: string[];
  risks: string[];
  opportunities: string[];
}

export interface StrategyKPI {
  label: string;
  target: string;
  timeframe: string;
}

export interface StrategyPlanData {
  summary: string;
  situationAnalysis: StrategySituationAnalysis;
  actionPlan: StrategyPhase[];
  kpis: StrategyKPI[];
}

export interface StrategyPlan {
  id: string;
  clientId?: string;
  leadId?: string;
  entityName: string;
  planData: StrategyPlanData;
  rawText?: string;
  publicUrl?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

// -- Animated Proposal Types --
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'rejected';

export interface ProposalPackageService {
  label: string;
  included: boolean;
}

export interface ProposalPackage {
  name: string;
  isRecommended: boolean;
  services: ProposalPackageService[];
  monthlyPrice: number;
  setupPrice?: number;
}

export interface ProposalPhase {
  number: number;
  title: string;
  description: string;
  duration?: string;
}

export interface ProposalTerms {
  items: string[];
}

export interface ProposalSignature {
  name: string;
  idNumber: string;
  email: string;
  signatureImage: string;
  signedAt: string;
  selectedPackage: string;
}

export interface ProposalData {
  businessName: string;
  contactName: string;
  introText?: string;
  packages: ProposalPackage[];
  phases: ProposalPhase[];
  terms: ProposalTerms;
  validUntil?: string;
}

export interface Proposal {
  id: string;
  leadId: string;
  proposalName: string;
  proposalData: ProposalData;
  status: ProposalStatus;
  publicUrl?: string;
  signatureData?: ProposalSignature;
  viewedAt?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
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

// ── Multi-Tenant ─────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface TenantWithUsers extends Tenant {
  userCount: number;
  users?: TenantUser[];
}

export interface TenantUser {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'viewer' | 'freelancer';
  isSuperAdmin: boolean;
  pagePermissions?: string[];
  createdAt: string;
}

// ── Ideas Kanban ─────────────────────────────────────────────
export type IdeaStatus = 'draft' | 'active' | 'in_progress' | 'done' | 'archived';
export type IdeaPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  priority: IdeaPriority;
  clientId?: string;
  leadId?: string;
  category: string;
  tags: string[];
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  dueDate?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── Knowledge Base ───────────────────────────────────────────
export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  isAiGenerated: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

// ── Competitor Scout ─────────────────────────────────────────
export interface CompetitorEntry {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  estimatedSize: string;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  differentiator: string;
}

export interface CompetitorRecommendation {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface CompetitorAnalysis {
  summary: string;
  competitors: CompetitorEntry[];
  opportunities: string[];
  threats: string[];
  recommendations: CompetitorRecommendation[];
  marketTrends: string[];
}

export interface CompetitorReport {
  id: string;
  entityId: string;
  entityType: 'client' | 'lead';
  businessName: string;
  industry?: string;
  website?: string;
  analysis: CompetitorAnalysis;
  createdBy: string;
  createdAt: string;
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
  signalsPersonalities: SignalsPersonality[];
  calendarEvents: CalendarEvent[];
  ideas: Idea[];
  knowledgeArticles: KnowledgeArticle[];
  competitorReports: CompetitorReport[];
  strategyPlans: StrategyPlan[];
  proposals: Proposal[];
}