import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Users, UserPlus, DollarSign, Receipt, Settings, Briefcase, CreditCard, Calculator, Search, LogOut, Shield, Eye } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { LeadStatus, PaymentStatus } from '../types';
import { tokens } from '../design/tokens';
import CommandPalette from './CommandPalette';

interface SidebarItemProps {
  to: string;
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon: Icon, label, isActive, onClick, badge }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
      ${isActive
        ? 'text-white font-medium bg-gradient-to-r from-primary/20 to-transparent border-r-2 border-primary'
        : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
  >
    <div className="relative">
      <Icon size={20} className={`relative z-10 transition-transform duration-300 ${isActive ? 'text-primary scale-110' : 'group-hover:text-gray-200'}`} />
      {badge != null && badge > 0 && (
        <span className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center leading-none px-1 z-20">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
    <span className="relative z-10">{label}</span>
    {isActive && <div className="absolute inset-0 bg-primary/5 blur-lg" />}
  </Link>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const location = useLocation();
  const { settings, leads, payments } = useData();
  const { isAdmin, isViewer, displayName, role, logout } = useAuth();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Ctrl+K / Cmd+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate notification badges
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueLeads = leads.filter(l => {
    if ([LeadStatus.Won, LeadStatus.Lost, LeadStatus.Not_relevant].includes(l.status)) return false;
    return new Date(l.nextContactDate) < today;
  }).length;

  const unpaidDebts = payments.filter(p => p.paymentStatus !== PaymentStatus.Paid).length;

  return (
    <div className="min-h-screen bg-background text-gray-100 flex overflow-hidden font-sans selection:bg-primary/30 selection:text-white">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 w-72 bg-surface/30 backdrop-blur-xl border-l border-white/5 transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div className="h-full flex flex-col">
          <div className="h-24 flex items-center justify-between px-8">
            <div>
              <h1 className="text-2xl font-black tracking-tight bg-gradient-to-l from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
                {settings.agencyName}
              </h1>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mt-1">Agency OS</div>
            </div>
            <button onClick={closeSidebar} className="lg:hidden text-gray-400 hover:text-white" aria-label="סגור תפריט">
              <X size={24} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            <SidebarItem to="/" icon={LayoutDashboard} label="דשבורד" isActive={location.pathname === '/'} onClick={closeSidebar} />
            {isAdmin && <SidebarItem to="/clients" icon={Users} label="לקוחות" isActive={location.pathname === '/clients'} onClick={closeSidebar} />}
            <SidebarItem to="/leads" icon={UserPlus} label="לידים" isActive={location.pathname === '/leads'} onClick={closeSidebar} badge={overdueLeads} />
            {isAdmin && <SidebarItem to="/deals" icon={Briefcase} label="פרויקטים" isActive={location.pathname === '/deals'} onClick={closeSidebar} />}
            {isAdmin && <SidebarItem to="/expenses" icon={Receipt} label="הוצאות" isActive={location.pathname === '/expenses'} onClick={closeSidebar} />}
            {isAdmin && <SidebarItem to="/debts" icon={CreditCard} label="חובות לקוחות" isActive={location.pathname === '/debts'} onClick={closeSidebar} badge={unpaidDebts} />}
            {isAdmin && <SidebarItem to="/tax-calculator" icon={Calculator} label="מחשבון מס" isActive={location.pathname === '/tax-calculator'} onClick={closeSidebar} />}
            {isAdmin && <SidebarItem to="/settings" icon={Settings} label="הגדרות" isActive={location.pathname === '/settings'} onClick={closeSidebar} />}

            {/* Search shortcut - admin only */}
            {isAdmin && (
              <button
                onClick={() => setIsCommandPaletteOpen(true)}
                className="mt-4 w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 text-gray-500 hover:text-gray-300 transition-all text-sm"
              >
                <Search size={16} />
                <span className="flex-1 text-right">חיפוש...</span>
                <kbd className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
              </button>
            )}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-white/5 space-y-3">
             <div className="flex items-center gap-3 px-2">
               <div className={`p-1.5 rounded-lg ${isAdmin ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-400'}`}>
                 {isAdmin ? <Shield size={14} /> : <Eye size={14} />}
               </div>
               <div className="flex-1 min-w-0">
                 <div className="text-sm text-white font-medium truncate">{displayName}</div>
                 <div className="text-[10px] text-gray-500">{isAdmin ? 'מנהל' : 'צופה'}</div>
               </div>
             </div>
             <button
               onClick={logout}
               className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/5 hover:border-red-500/30 hover:bg-red-500/5 text-gray-500 hover:text-red-400 transition-all text-xs"
             >
               <LogOut size={14} />
               <span>התנתק</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Background Ambience */}
        <div className="absolute top-0 left-0 w-full h-96 bg-primary/5 blur-[100px] pointer-events-none" />

        {/* Mobile Header */}
        <header className="h-16 bg-surface/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 lg:hidden relative z-10">
          <button onClick={toggleSidebar} className="text-gray-300" aria-label="פתח תפריט">
            <Menu size={24} />
          </button>
          <span className="font-bold text-white">{settings.agencyName}</span>
          <div className="w-6"></div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 lg:p-10 relative z-10">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
};

export default Layout;
