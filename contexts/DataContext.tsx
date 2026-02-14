import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppData, Client, Lead, OneTimeDeal, SupplierExpense, Payment, Service,
  AgencySettings, PaymentStatus, LeadStatus, ClientStatus, ClientRating, EffortLevel
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
}

export interface DataContextType extends AppData {
  isLoaded: boolean;
  error: string | null;
  clearError: () => void;
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

  addPayment: (payment: Omit<Payment, 'paymentId'>) => Promise<void>;
  updatePayment: (payment: Payment) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;

  updateServices: (services: Service[]) => void;
  updateSettings: (settings: AgencySettings) => Promise<void>;

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
});

const transformSettingsFromDB = (row: SettingsRow): AgencySettings => ({
  agencyName: row.agency_name,
  ownerName: row.owner_name,
  targetMonthlyRevenue: row.target_monthly_revenue,
  targetMonthlyGrossProfit: row.target_monthly_gross_profit,
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
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const showError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 5000);
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

        const [clientsRes, leadsRes, dealsRes, expensesRes, paymentsRes, settingsRes] = await Promise.all([
          supabase.from('clients').select('*').order('added_at', { ascending: false }),
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('deals').select('*').order('deal_date', { ascending: false }),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('payments').select('*').order('period_month', { ascending: false }),
          supabase.from('settings').select('*').single()
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
          settings
        });
      } catch (err) {
        console.error('Error loading data from Supabase:', err);
      } finally {
        setIsLoaded(true);
      }
    };

    loadData();
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
    } catch (err) {
      showError('שגיאה בהוספת לקוח');
      throw err;
    }
  };

  const updateClient = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(transformClientToDB(client))
        .eq('client_id', client.clientId);

      if (error) throw error;

      setData(prev => ({
        ...prev,
        clients: prev.clients.map(c => c.clientId === client.clientId ? client : c)
      }));
    } catch (err) {
      showError('שגיאה בעדכון לקוח');
      throw err;
    }
  };

  const deleteClient = async (id: string) => {
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
    } catch (err) {
      showError('שגיאה בעדכון ליד');
      throw err;
    }
  };

  const deleteLead = async (id: string) => {
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

        setData(prev => ({
          ...prev,
          clients: [...prev.clients, newClient],
          leads: prev.leads.map(l => l.leadId === leadId ? updatedLead : l)
        }));
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
    } catch (err) {
      showError('שגיאה בהוספת הוצאה');
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
    } catch (err) {
      showError('שגיאה במחיקת חוב');
      throw err;
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
      addExpense,
      addPayment, updatePayment, deletePayment,
      updateServices, updateSettings,
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
