import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Users, UserPlus, DollarSign, Receipt, Settings, Briefcase, CreditCard } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { tokens } from '../design/tokens';

interface SidebarItemProps {
  to: string;
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ to, icon: Icon, label, isActive, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden
      ${isActive 
        ? 'text-white font-medium bg-gradient-to-r from-primary/20 to-transparent border-r-2 border-primary' 
        : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
  >
    <Icon size={20} className={`relative z-10 transition-transform duration-300 ${isActive ? 'text-primary scale-110' : 'group-hover:text-gray-200'}`} />
    <span className="relative z-10">{label}</span>
    {isActive && <div className="absolute inset-0 bg-primary/5 blur-lg" />}
  </Link>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { settings } = useData();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

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
            <SidebarItem to="/clients" icon={Users} label="לקוחות" isActive={location.pathname === '/clients'} onClick={closeSidebar} />
            <SidebarItem to="/leads" icon={UserPlus} label="לידים" isActive={location.pathname === '/leads'} onClick={closeSidebar} />
            <SidebarItem to="/deals" icon={Briefcase} label="פרויקטים" isActive={location.pathname === '/deals'} onClick={closeSidebar} />
            <SidebarItem to="/expenses" icon={Receipt} label="הוצאות" isActive={location.pathname === '/expenses'} onClick={closeSidebar} />
            <SidebarItem to="/debts" icon={CreditCard} label="חובות לקוחות" isActive={location.pathname === '/debts'} onClick={closeSidebar} />
            <SidebarItem to="/settings" icon={Settings} label="הגדרות" isActive={location.pathname === '/settings'} onClick={closeSidebar} />
          </nav>

          <div className="p-6 border-t border-white/5 text-center">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Online</span>
             </div>
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
    </div>
  );
};

export default Layout;