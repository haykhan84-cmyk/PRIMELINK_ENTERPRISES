import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface OmniSearchProps {
  type: 'products' | 'routes' | 'customers';
  value: number | string;
  onSelect: (item: any) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  filterRoute?: string | null;
}

export default function OmniSearch({
  type,
  value,
  onSelect,
  onClear,
  placeholder = "Search...",
  className = "",
  id,
  required = false,
  disabled = false,
  filterRoute = null,
}: OmniSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial value name/representation
  const [displayValue, setDisplayValue] = useState('');

  // Suffix/Prefix generator
  const getPrefix = () => {
    if (type === 'products') return 'PRD';
    if (type === 'routes') return 'RUT';
    return 'CST';
  };

  const getEntityName = (item: any) => {
    if (!item) return '';
    if (type === 'products') return item.name || '';
    if (type === 'routes') return item.name || '';
    // For customers, return shop_name or name
    return item.shop_name || item.name || '';
  };

  // Fetch initial name for value if it exists
  useEffect(() => {
    if (value) {
      const fetchInitial = async () => {
        try {
          const endpoint = type === 'products' ? '/api/skus' : type === 'routes' ? '/api/routes' : '/api/customers';
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            const found = data.find((item: any) => item.id === Number(value));
            if (found) {
              setDisplayValue(`[${getPrefix()}-${found.id}] ${getEntityName(found)}`);
              setQuery(getEntityName(found));
            } else {
              setDisplayValue('');
              setQuery('');
            }
          }
        } catch (e) {
          console.error("Error fetching initial name for OmniSearch:", e);
        }
      };
      fetchInitial();
    } else {
      setDisplayValue('');
      setQuery('');
    }
  }, [value, type]);

  // Debounce query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    // Skip redundant search if query already matches selected display name
    if (displayValue && query === displayValue.replace(/^\[[A-Z]+-\d+\]\s*/, '')) {
      return;
    }

    setLoading(true);
    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(query)}`);
        if (res.ok) {
          let data = await res.json();
          // Filter customers by route if route filter is active
          if (type === 'customers' && filterRoute) {
            data = data.filter((item: any) => item.route === filterRoute);
          }
          setResults(data);
          setSelectedIndex(data.length > 0 ? 0 : -1);
        }
      } catch (err) {
        console.error("OmniSearch search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query, type, filterRoute, displayValue]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Reset query to last selected representation
        if (value && displayValue) {
          setQuery(displayValue.replace(/^\[[A-Z]+-\d+\]\s*/, ''));
        } else {
          setQuery('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, displayValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          selectItem(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        // If results exist and one is highlighted, select it on Tab key as well for ultra mouseless flow
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          selectItem(results[selectedIndex]);
        } else {
          setIsOpen(false);
        }
        break;
      default:
        break;
    }
  };

  const selectItem = (item: any) => {
    setDisplayValue(`[${getPrefix()}-${item.id}] ${getEntityName(item)}`);
    setQuery(getEntityName(item));
    setIsOpen(false);
    onSelect(item);
  };

  // Safe escape pattern helper
  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const highlightMatch = (text: string, qStr: string) => {
    if (!qStr) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${escapeRegExp(qStr)})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === qStr.toLowerCase() ? (
            <strong key={i} className="text-amber-600 font-extrabold bg-amber-50/50 underline px-0.5 rounded">{part}</strong>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div id={id || `omni-search-${type}`} className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-slate-50 hover:bg-slate-100/75 focus:bg-white border border-slate-200 rounded-lg p-2 pl-8 pr-8 text-xs font-semibold outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all leading-tight shadow-sm disabled:opacity-50"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value && onClear) {
              onClear();
            }
          }}
          disabled={disabled}
          required={required}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <div className="absolute left-2.5 top-2.5 text-slate-400">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </div>
        
        {value && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDisplayValue('');
              setResults([]);
              if (onClear) onClear();
            }}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-650 p-0.5 rounded-full hover:bg-slate-200/50"
            title="Clear choice"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Floating autocomplete selection list */}
      {isOpen && query && (results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
          {loading && results.length === 0 ? (
            <div className="p-3 text-xs text-center text-slate-400 font-bold flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
              Searching database...
            </div>
          ) : (
            results.map((item, index) => {
              const active = index === selectedIndex;
              const title = getEntityName(item);
              const customCode = `[${getPrefix()}-${item.id}]`;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left p-2.5 text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                    active ? 'bg-amber-500/10 text-slate-900 font-bold border-l-4 border-amber-500 pl-1.5' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1">{customCode}</span>
                  <span className="truncate flex-1 font-semibold">{highlightMatch(title, query)}</span>
                  {type === 'customers' && item.route && (
                    <span className="text-[9px] text-[#222063] font-black uppercase tracking-wide bg-blue-100/50 px-1.5 py-0.5 rounded-sm">{item.route}</span>
                  )}
                  {type === 'products' && item.category && (
                    <span className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1 rounded">{item.category}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
