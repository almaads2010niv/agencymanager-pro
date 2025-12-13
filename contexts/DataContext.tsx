import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  AppData, Client, Lead, OneTimeDeal, SupplierExpense, Payment, Service, 
  AgencySettings, PaymentStatus 
} from '../types';
import { INITIAL_SERVICES, DEFAULT_SETTINGS, STORAGE_KEY } from '../constants';
import { getMonthKey, generateId } from '../utils';

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
  
  updateServices: (services: Service[]) => void;
  updateSettings: (settings: AgencySettings) => void;
  
  importData: (json: string) => boolean;
  exportData: () => string;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData({
          ...parsed,
          services: parsed.services || INITIAL_SERVICES, // Fallback for schema updates
          settings: parsed.settings || DEFAULT_SETTINGS
        });
      } catch (e) {
        console.error("Failed to parse storage", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, isLoaded]);

  const addClient = (client: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...client,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };
    
    // Auto-create payment record for current month
    const newPayment: Payment = {
      paymentId: generateId(),
      clientId: newClient.clientId,
      periodMonth: getMonthKey(new Date()),
      amountDue: newClient.monthlyRetainer,
      amountPaid: 0,
      paymentStatus: PaymentStatus.Unpaid,
      notes: 'נוצר אוטומטית עם הקמת לקוח'
    };

    setData(prev => ({
      ...prev,
      clients: [...prev.clients, newClient],
      payments: [...prev.payments, newPayment]
    }));
  };

  const updateClient = (client: Client) => {
    setData(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.clientId === client.clientId ? client : c)
    }));
  };

  const deleteClient = (id: string) => {
    if(confirm('האם אתה בטוח? פעולה זו תמחק את כל הנתונים הקשורים ללקוח זה.')) {
      setData(prev => ({
        ...prev,
        clients: prev.clients.filter(c => c.clientId !== id),
        oneTimeDeals: prev.oneTimeDeals.filter(d => d.clientId !== id),
        expenses: prev.expenses.filter(e => e.clientId !== id),
        payments: prev.payments.filter(p => p.clientId !== id)
      }));
    }
  };

  const addLead = (lead: Omit<Lead, 'leadId' | 'createdAt'>) => {
    const newLead: Lead = {
      ...lead,
      leadId: generateId(),
      createdAt: new Date().toISOString()
    };
    setData(prev => ({ ...prev, leads: [...prev.leads, newLead] }));
  };

  const updateLead = (lead: Lead) => {
    setData(prev => ({
      ...prev,
      leads: prev.leads.map(l => l.leadId === lead.leadId ? lead : l)
    }));
  };

  const deleteLead = (id: string) => {
    setData(prev => ({
      ...prev,
      leads: prev.leads.filter(l => l.leadId !== id)
    }));
  };

  const convertLeadToClient = (leadId: string, clientData: Omit<Client, 'clientId' | 'addedAt'>) => {
    const newClient: Client = {
      ...clientData,
      clientId: generateId(),
      addedAt: new Date().toISOString()
    };

    const newPayment: Payment = {
      paymentId: generateId(),
      clientId: newClient.clientId,
      periodMonth: getMonthKey(new Date()),
      amountDue: newClient.monthlyRetainer,
      amountPaid: 0,
      paymentStatus: PaymentStatus.Unpaid,
      notes: 'נוצר אוטומטית המרה מליד'
    };

    setData(prev => ({
      ...prev,
      clients: [...prev.clients, newClient],
      payments: [...prev.payments, newPayment],
      leads: prev.leads.map(l => l.leadId === leadId ? { ...l, status: 'Won' as any, relatedClientId: newClient.clientId } : l)
    }));
  };

  const addDeal = (deal: Omit<OneTimeDeal, 'dealId'>) => {
    const newDeal: OneTimeDeal = {
      ...deal,
      dealId: generateId()
    };
    setData(prev => ({ ...prev, oneTimeDeals: [...prev.oneTimeDeals, newDeal] }));
  };

  const updateDeal = (deal: OneTimeDeal) => {
    setData(prev => ({
      ...prev,
      oneTimeDeals: prev.oneTimeDeals.map(d => d.dealId === deal.dealId ? deal : d)
    }));
  };

  const addExpense = (expense: Omit<SupplierExpense, 'expenseId'>) => {
    const newExpense: SupplierExpense = {
      ...expense,
      expenseId: generateId()
    };
    setData(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
  };

  const updateServices = (services: Service[]) => {
    setData(prev => ({ ...prev, services }));
  };

  const updateSettings = (settings: AgencySettings) => {
    setData(prev => ({ ...prev, settings }));
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