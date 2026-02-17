import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { useTenantNav } from '../hooks/useTenantNav';
import { Search, Users, UserPlus, Briefcase, X } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'client' | 'lead' | 'deal';
  title: string;
  subtitle?: string;
  path: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { tn } = useTenantNav();
  const { clients, leads, oneTimeDeals } = useData();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const getResults = useCallback((): SearchResult[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search clients
    clients.forEach(c => {
      if (c.clientName.toLowerCase().includes(q) || c.businessName.toLowerCase().includes(q)) {
        results.push({
          id: c.clientId,
          type: 'client',
          title: c.businessName,
          subtitle: c.clientName,
          path: `/clients/${c.clientId}`,
        });
      }
    });

    // Search leads
    leads.forEach(l => {
      if (l.leadName.toLowerCase().includes(q) || (l.businessName && l.businessName.toLowerCase().includes(q))) {
        results.push({
          id: l.leadId,
          type: 'lead',
          title: l.leadName,
          subtitle: l.businessName || l.status,
          path: '/leads',
        });
      }
    });

    // Search deals
    oneTimeDeals.forEach(d => {
      if (d.dealName.toLowerCase().includes(q)) {
        const client = clients.find(c => c.clientId === d.clientId);
        results.push({
          id: d.dealId,
          type: 'deal',
          title: d.dealName,
          subtitle: client?.businessName || '',
          path: '/deals',
        });
      }
    });

    return results.slice(0, 12);
  }, [query, clients, leads, oneTimeDeals]);

  const results = getResults();

  const handleSelect = (result: SearchResult) => {
    tn(result.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'client': return <Users size={16} className="text-primary" />;
      case 'lead': return <UserPlus size={16} className="text-emerald-400" />;
      case 'deal': return <Briefcase size={16} className="text-violet-400" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'client': return 'לקוח';
      case 'lead': return 'ליד';
      case 'deal': return 'פרויקט';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          <Search size={20} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="חיפוש לקוחות, לידים, פרויקטים..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-base"
            dir="rtl"
          />
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {query && results.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              לא נמצאו תוצאות
            </div>
          )}

          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-right transition-colors ${
                index === selectedIndex
                  ? 'bg-primary/10 text-white'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-white/5">
                {getIcon(result.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{result.title}</div>
                {result.subtitle && (
                  <div className="text-xs text-gray-500 truncate">{result.subtitle}</div>
                )}
              </div>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider flex-shrink-0">{getTypeLabel(result.type)}</span>
            </button>
          ))}

          {!query && (
            <div className="p-6 text-center text-gray-600 text-sm">
              התחל להקליד כדי לחפש...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2 border-t border-white/5 text-[10px] text-gray-600">
          <span>↑↓ ניווט</span>
          <span>Enter לבחירה</span>
          <span>Esc לסגירה</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
