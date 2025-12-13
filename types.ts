export enum ClientRating {
  A_PLUS = "A_plus",
  A = "A",
  B = "B",
  C = "C"
}

export enum ClientStatus {
  Active = "Active",
  Paused = "Paused",
  Leaving = "Leaving",
  Left = "Left"
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
  monthlyRetainer: number;
  billingDay: number;
  services: string[]; // Service keys
  effortLevel: EffortLevel;
  supplierCostMonthly: number;
  notes: string;
  nextReviewDate: string; // ISO Date string
  addedAt: string; // ISO Date string
}

export enum LeadStatus {
  New = "New",
  Contacted = "Contacted",
  Proposal_sent = "Proposal_sent",
  Meeting_scheduled = "Meeting_scheduled",
  Pending_decision = "Pending_decision",
  Won = "Won",
  Lost = "Lost",
  Not_relevant = "Not_relevant"
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
}

export interface AppData {
  clients: Client[];
  leads: Lead[];
  oneTimeDeals: OneTimeDeal[];
  expenses: SupplierExpense[];
  payments: Payment[];
  services: Service[];
  settings: AgencySettings;
}