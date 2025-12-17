import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  AppData, Client, Lead, OneTimeDeal, SupplierExpense, Payment, Service, 
  AgencySettings, PaymentStatus, LeadStatus 
} from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS, STORAGE_KEY } from '../constants';
import { getMonthKey, generateId } from '../utils';
import { supabase } from '../lib/supabaseClient';

interface DataContextType extends AppData {
  addClient: (client: Omit<Client, 'clientId' | 'addedAt'>) => void;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  
  addLead: (lead: Omit<Lead, 'leadId' | 'createdAt'>) => void;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  convertLeadToClient: (leadId: string, clientData: Omit<Client, 'clientId' | 'addedAt'>) => void;

  addDeal: (deal: Omit<OneTimeDeal, 'dealId'>) => void;
  updateDeal: (deal: OneTimeDeal) => void;
  
  addExpense: (expense: Omit<SupplierExpense, 'expenseId'>) => void;

  addPayment: (payment: Omit<Payment, 'paymentId'>) => void;
  updatePayment: (payment: Payment) => void;
  deletePayment: (id: string) => void;
  
  updateServices: (services: Service[]) => void;
  updateSettings: (settings: AgencySettings) => void;
  
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

// Helper function to migrate status values
const migrateClientStatus = (status: string): string => {
  return CLIENT_STATUS_MIGRATION[status] || status;
};

const migrateLeadStatus = (status: string): string => {
  return LEAD_STATUS_MIGRATION[status] || status;
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

const transformClientFromDB = (row: any): Client => ({
  clientId: row.client_id,
  clientName: row.client_name,
  businessName: row.business_name,
  phone: row.phone,
  email: row.email,
  industry: row.industry,
  rating: row.rating,
  status: migrateClientStatus(row.status) as any,
  joinDate: row.join_date,
  churnDate: row.churn_date || undefined,
  monthlyRetainer: row.monthly_retainer,
  billingDay: row.billing_day,
  services: typeof row.services === 'string' ? JSON.parse(row.services) : (row.services || []),
  effortLevel: row.effort_level,
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

const transformLeadFromDB = (row: any): Lead => ({
  leadId: row.lead_id,
  createdAt: row.created_at,
  leadName: row.lead_name,
  businessName: row.business_name,
  phone: row.phone,
  email: row.email,
  sourceChannel: row.source_channel,
  interestedServices: typeof row.interested_services === 'string' ? JSON.parse(row.interested_services) : (row.interested_services || []),
  notes: row.notes || '',
  nextContactDate: row.next_contact_date,
  status: migrateLeadStatus(row.status) as any,
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

const transformDealFromDB = (row: any): OneTimeDeal => ({
  dealId: row.deal_id,
  clientId: row.client_id,
  dealName: row.deal_name,
  dealType: row.deal_type,
  dealAmount: row.deal_amount,
  dealDate: row.deal_date,
  dealStatus: row.deal_status,
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

const transformExpenseFromDB = (row: any): SupplierExpense => ({
  expenseId: row.expense_id,
  clientId: row.client_id,
  expenseDate: row.expense_date,
  monthKey: row.month_key,
  supplierName: row.supplier_name,
  expenseType: row.expense_type,
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

const transformPaymentFromDB = (row: any): Payment => ({
  paymentId: row.payment_id,
  clientId: row.client_id,
  periodMonth: row.period_month,
  amountDue: row.amount_due,
  amountPaid: row.amount_paid,
  paymentDate: row.payment_date,
  paymentStatus: row.payment_status,
  notes: row.notes || '',
});

const transformSettingsToDB = (settings: AgencySettings) => ({
  id: 1, // Single row for settings
  agency_name: settings.agencyName,
  owner_name: settings.ownerName,
  target_monthly_revenue: settings.targetMonthlyRevenue,
  target_monthly_gross_profit: settings.targetMonthlyGrossProfit,
});

const transformSettingsFromDB = (row: any): AgencySettings => ({
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

  // Load data from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('No session found, skipping data load');
          setIsLoaded(true);
          return;
        }

        // Load all data in parallel
        const [clientsRes, leadsRes, dealsRes, expensesRes, paymentsRes, settingsRes] = await Promise.all([
          supabase.from('clients').select('*').order('added_at', { ascending: false }),
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('deals').select('*').order('deal_date', { ascending: false }),
          supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
          supabase.from('payments').select('*').order('period_month', { ascending: false }),
          supabase.from('settings').select('*').single()
        ]);

        // Handle errors
        if (clientsRes.error) console.error('Error loading clients:', clientsRes.error);
        if (leadsRes.error) console.error('Error loading leads:', leadsRes.error);
        if (dealsRes.error) console.error('Error loading deals:', dealsRes.error);
        if (expensesRes.error) console.error('Error loading expenses:', expensesRes.error);
        if (paymentsRes.error) console.error('Error loading payments:', paymentsRes.error);

        // Transform Supabase data to TypeScript types
        const clients = (clientsRes.data || []).map(transformClientFromDB);
        const leads = (leadsRes.data || []).map(transformLeadFromDB);
        const deals = (dealsRes.data || []).map(transformDealFromDB);
        const expenses = (expensesRes.data || []).map(transformExpenseFromDB);
        const payments = (paymentsRes.data || []).map(transformPaymentFromDB);

        // Load settings or use defaults
        let settings = DEFAULT_SETTINGS;
        if (settingsRes.data && !settingsRes.error) {
          settings = transformSettingsFromDB(settingsRes.data);
        } else {
          // Initialize settings if not exists
          await supabase.from('settings').upsert(transformSettingsToDB(DEFAULT_SETTINGS));
        }

        setData({
          clients,
          leads,
          oneTimeDeals: deals,
          expenses,
          payments,
          services: INITIAL_SERVICES, // Services are static for now
          settings
        });
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
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

      if (error) {
        console.error('Error adding client:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        clients: [...prev.clients, newClient]
      }));
    } catch (error) {
      console.error('Failed to add client:', error);
      throw error;
    }
  };

  const updateClient = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update(transformClientToDB(client))
        .eq('client_id', client.clientId);

      if (error) {
        console.error('Error updating client:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        clients: prev.clients.map(c => c.clientId === client.clientId ? client : c)
      }));
    } catch (error) {
      console.error('Failed to update client:', error);
      throw error;
    }
  };

  const deleteClient = async (id: string) => {
    if(!confirm('האם אתה בטוח? פעולה זו תמחק את כל הנתונים הקשורים ללקוח זה.')) {
      return;
    }

    try {
      // Delete related deals and expenses first (or let DB handle with CASCADE)
      await supabase
        .from('deals')
        .delete()
        .eq('client_id', id);
      
      await supabase
        .from('expenses')
        .delete()
        .eq('client_id', id);

      // Delete client
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('client_id', id);

      if (error) {
        console.error('Error deleting client:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        clients: prev.clients.filter(c => c.clientId !== id),
        oneTimeDeals: prev.oneTimeDeals.filter(d => d.clientId !== id),
        expenses: prev.expenses.filter(e => e.clientId !== id),
        payments: prev.payments.filter(p => p.clientId !== id)
      }));
    } catch (error) {
      console.error('Failed to delete client:', error);
      throw error;
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

      if (error) {
        console.error('Error adding lead:', error);
        throw error;
      }

      setData(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
    } catch (error) {
      console.error('Failed to add lead:', error);
      throw error;
    }
  };

  const updateLead = async (lead: Lead) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update(transformLeadToDB(lead))
        .eq('lead_id', lead.leadId);

      if (error) {
        console.error('Error updating lead:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        leads: prev.leads.map(l => l.leadId === lead.leadId ? lead : l)
      }));
    } catch (error) {
      console.error('Failed to update lead:', error);
      throw error;
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('lead_id', id);

      if (error) {
        console.error('Error deleting lead:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        leads: prev.leads.filter(l => l.leadId !== id)
      }));
    } catch (error) {
      console.error('Failed to delete lead:', error);
      throw error;
    }
  };

  const convertLeadToClient = async (leadId: string, clientData: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...clientData,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };

    try {
      // Add client
      const { error: clientError } = await supabase
        .from('clients')
        .insert(transformClientToDB(newClient));

      if (clientError) {
        console.error('Error adding client from lead:', clientError);
        throw clientError;
      }

      // Update lead status
      const lead = data.leads.find(l => l.leadId === leadId);
      if (lead) {
        const updatedLead = { ...lead, status: LeadStatus.Won, relatedClientId: newClient.clientId };
        const { error: leadError } = await supabase
          .from('leads')
          .update(transformLeadToDB(updatedLead))
          .eq('lead_id', leadId);

        if (leadError) {
          console.error('Error updating lead:', leadError);
          throw leadError;
        }

        setData(prev => ({
          ...prev,
          clients: [...prev.clients, newClient],
          leads: prev.leads.map(l => l.leadId === leadId ? updatedLead : l)
        }));
      }
    } catch (error) {
      console.error('Failed to convert lead to client:', error);
      throw error;
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

      if (error) {
        console.error('Error adding deal:', error);
        throw error;
      }

      setData(prev => ({ ...prev, oneTimeDeals: [...prev.oneTimeDeals, newDeal] }));
    } catch (error) {
      console.error('Failed to add deal:', error);
      throw error;
    }
  };

  const updateDeal = async (deal: OneTimeDeal) => {
    try {
      const { error } = await supabase
        .from('deals')
        .update(transformDealToDB(deal))
        .eq('deal_id', deal.dealId);

      if (error) {
        console.error('Error updating deal:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        oneTimeDeals: prev.oneTimeDeals.map(d => d.dealId === deal.dealId ? deal : d)
      }));
    } catch (error) {
      console.error('Failed to update deal:', error);
      throw error;
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

      if (error) {
        console.error('Error adding expense:', error);
        throw error;
      }

      setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
    } catch (error) {
      console.error('Failed to add expense:', error);
      throw error;
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

      if (error) {
        console.error('Error adding payment:', error);
        throw error;
      }

      setData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
    } catch (error) {
      console.error('Failed to add payment:', error);
      throw error;
    }
  };

  const updatePayment = async (payment: Payment) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update(transformPaymentToDB(payment))
        .eq('payment_id', payment.paymentId);

      if (error) {
        console.error('Error updating payment:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p.paymentId === payment.paymentId ? payment : p)
      }));
    } catch (error) {
      console.error('Failed to update payment:', error);
      throw error;
    }
  };

  const deletePayment = async (id: string) => {
    if(!confirm('האם אתה בטוח שברצונך למחוק חוב זה?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('payment_id', id);

      if (error) {
        console.error('Error deleting payment:', error);
        throw error;
      }

      setData(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.paymentId !== id)
      }));
    } catch (error) {
      console.error('Failed to delete payment:', error);
      throw error;
    }
  };

  const updateServices = (services: Service[]) => {
    // Services are static for now, but keep in state for UI
    setData(prev => ({ ...prev, services }));
  };

  const updateSettings = async (settings: AgencySettings) => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert(transformSettingsToDB(settings));

      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }

      setData(prev => ({ ...prev, settings }));
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      // Basic validation
      if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.leads)) {
        throw new Error("Invalid format");
      }
      setData(parsed);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const exportData = () => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <DataContext.Provider value={{
      ...data,
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