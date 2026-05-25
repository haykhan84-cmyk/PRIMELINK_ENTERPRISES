import { useState } from 'react';
import { Settings2, Check, X, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface ColumnManagerProps {
  columns: ColumnConfig[];
  onUpdate: (columns: ColumnConfig[]) => void;
  title?: string;
}

export function useColumns(key: string, initialColumns: ColumnConfig[]) {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(`table_columns_${key}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sync with any new columns added in code since last save
        const merged = initialColumns.map(col => {
          const savedCol = parsed.find((p: ColumnConfig) => p.id === col.id);
          return savedCol ? { ...col, ...savedCol } : col;
        });
        return merged;
      } catch {
        return initialColumns;
      }
    }
    return initialColumns;
  });

  const updateColumns = (newCols: ColumnConfig[]) => {
    setColumns(newCols);
    localStorage.setItem(`table_columns_${key}`, JSON.stringify(newCols));
  };

  return { columns, updateColumns };
}

export default function ColumnManager({ columns, onUpdate, title = "Adjust Columns" }: ColumnManagerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (id: string) => {
    const newCols = columns.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    );
    onUpdate(newCols);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-400 hover:text-slate-900 border border-slate-200 rounded-lg bg-white transition-all hover:shadow-sm flex items-center gap-2 group"
        title="Manage Columns"
      >
        <Settings2 className="w-4 h-4" />
        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Columns</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 z-[70] overflow-hidden"
            >
              <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</span>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2 max-h-[300px] overflow-y-auto">
                <div className="space-y-1">
                  {columns.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => toggleColumn(col.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${col.visible ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${col.visible ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                        {col.visible && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs font-bold">{col.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 italic">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight text-center">Settings saved automatically</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
