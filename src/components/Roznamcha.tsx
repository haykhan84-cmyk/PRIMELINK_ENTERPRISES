import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  MinusCircle, 
  BookOpen, 
  Lock, 
  Unlock, 
  Image as ImageIcon, 
  Camera, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Check, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  User, 
  HelpCircle,
  FileSpreadsheet,
  Trash2,
  Calendar,
  X,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useWorkspace } from '../lib/WorkspaceContext';

interface RoznamchaRow {
  id: number;
  voucher_no: string;
  entry_type: 'Cash In' | 'Cash Out' | 'Bank Transfer' | 'Adjustment';
  category: string;
  narration: string;
  debit: number;
  credit: number;
  running_balance: number;
  employee_id: number | null;
  employee_name: string | null;
  customer_id: number | null;
  customer_name: string | null;
  photo_url: string | null;
  is_locked: number;
  created_at: string;
}

interface SummaryData {
  opening_balance: number;
  total_cash_in: number;
  total_cash_out: number;
  closing_balance: number;
}

export default function Roznamcha() {
  const { currentUserRole } = useWorkspace();
  
  // View mode State: 'desktop' vs 'mobile'
  const isFieldStaff = currentUserRole && ['salesman', 'driver', 'deliveryman', 'staff'].includes(currentUserRole.toLowerCase());
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(isFieldStaff ? 'mobile' : 'desktop');

  // Core Data sets
  const [entries, setEntries] = useState<RoznamchaRow[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    opening_balance: 0,
    total_cash_in: 0,
    total_cash_out: 0,
    closing_balance: 0
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  // Selected photo for modal viewer
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  // --- DESKTOP QUICK ENTRY STATE ---
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<'Cash In' | 'Cash Out' | 'Bank Transfer' | 'Adjustment'>('Cash In');
  const [category, setCategory] = useState('Sales Recovery');
  const [narration, setNarration] = useState('');
  const [amount, setAmount] = useState('');
  const [entityType, setEntityType] = useState<'none' | 'customer' | 'employee'>('none');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  // --- MOBILE SCREEN STATE ---
  const [mobileTab, setMobileTab] = useState<'recovery' | 'expense' | 'recent'>('recovery');
  const [mobileCustomerSearch, setMobileCustomerSearch] = useState('');
  const [showMobileCustomerList, setShowMobileCustomerList] = useState(false);
  
  // Mobile Forms state
  const [mobileCustomerId, setMobileCustomerId] = useState('');
  const [mobileCustomerShop, setMobileCustomerShop] = useState('');
  const [mobileRecoveryAmount, setMobileRecoveryAmount] = useState('');
  const [mobileRecoveryNotes, setMobileRecoveryNotes] = useState('');

  const [mobileExpenseCategory, setMobileExpenseCategory] = useState('Route Gas & Fuel');
  const [mobileExpenseAmount, setMobileExpenseAmount] = useState('');
  const [mobileExpenseEmployeeId, setMobileExpenseEmployeeId] = useState('');
  const [mobileExpenseNotes, setMobileExpenseNotes] = useState('');
  const [mobilePhotoBase64, setMobilePhotoBase64] = useState<string | null>(null);

  // Keyboard navigation input REFs
  const dateInputRef = useRef<HTMLInputElement>(null);
  const typeInputRef = useRef<HTMLSelectElement>(null);
  const categoryInputRef = useRef<HTMLSelectElement>(null);
  const entityTypeInputRef = useRef<HTMLSelectElement>(null);
  const entityIdInputRef = useRef<HTMLSelectElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const narrationInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // List of Categories mapped by Entry Type
  const categoriesByType = {
    'Cash In': [
      'Sales Recovery',
      'Opening Balance Correction',
      'Direct Cash Sale',
      'Bank Cash Withdrawal',
      'Owner Equity Contribution',
      'Retail Settlement',
      'Miscellaneous Recovery'
    ],
    'Cash Out': [
      'Route Gas & Fuel',
      'Tolls & Taxes',
      'Vehicle Repair / Maintenance',
      'Supplier Settlement Payment',
      'Employee Salary / Advance',
      'Bank Cash Deposit',
      'Office Utilities & Rent',
      'Entertainment & Hospitality',
      'Loading & Logistics Charges',
      'Stationery & Office expense',
      'General Outflow'
    ],
    'Bank Transfer': [
      'Cash-to-Bank',
      'Bank-to-Cash',
      'Interbank Ledger Adjustment'
    ],
    'Adjustment': [
      'Debit Correction',
      'Credit Correction',
      'Ledger Balancing entry',
      'Distributor Scheme adjustment'
    ]
  };

  // Pre-load default categories on type change
  useEffect(() => {
    setCategory(categoriesByType[entryType][0]);
  }, [entryType]);

  // Load backend database sets
  const fetchData = async () => {
    setLoading(true);
    try {
      const [rozRes, custRes, empRes] = await Promise.all([
        fetch('/api/roznamcha'),
        fetch('/api/customers'),
        fetch('/api/employees')
      ]);

      if (rozRes.ok) {
        const rozData = await rozRes.json();
        setEntries(rozData.entries || []);
        setSummary(rozData.summary || {
          opening_balance: 0,
          total_cash_in: 0,
          total_cash_out: 0,
          closing_balance: 0
        });
      }

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData || []);
      }

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData || []);
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to synchronize Ledger network records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const clearMessages = () => {
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4500);
  };

  // Image upload base64 converter
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, isMobile: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Receipt snapshot image size exceeds 2MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMobile) {
          setMobilePhotoBase64(reader.result as string);
        } else {
          setPhotoBase64(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Keyboard navigation wizard mapping
  const handleKeyboardNavigation = (e: React.KeyboardEvent, currentField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch (currentField) {
        case 'date':
          typeInputRef.current?.focus();
          break;
        case 'type':
          categoryInputRef.current?.focus();
          break;
        case 'category':
          entityTypeInputRef.current?.focus();
          break;
        case 'entityType':
          if (entityType !== 'none') {
            entityIdInputRef.current?.focus();
          } else {
            amountInputRef.current?.focus();
          }
          break;
        case 'entityId':
          amountInputRef.current?.focus();
          break;
        case 'amount':
          narrationInputRef.current?.focus();
          break;
        case 'narration':
          submitButtonRef.current?.focus();
          break;
        default:
          break;
      }
    }
  };

  // Post entry from Desktop Pane
  const submitDesktopEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMsg("Please enter a valid ledger transaction amount.");
      clearMessages();
      return;
    }
    
    setSubmitting(true);
    setErrorMsg(null);

    // Mappings:
    // Cash In = debit, Cash Out = credit
    // Cash-to-Bank = Cash Out (Credit), Bank-to-Cash = Cash In (Debit)
    let finalDebit = 0;
    let finalCredit = 0;

    if (entryType === 'Cash In') {
      finalDebit = Number(amount);
    } else if (entryType === 'Cash Out') {
      finalCredit = Number(amount);
    } else if (entryType === 'Bank Transfer') {
      if (category === 'Bank-to-Cash') {
        finalDebit = Number(amount);
      } else {
        // Cash-to-Bank or other transfer is cash-leaving-hand (Credit)
        finalCredit = Number(amount);
      }
    } else { // Adjustment
      // Ask or make a smart guess: standard error corrections can go either way, default debit
      if (category.toLowerCase().includes('credit')) {
        finalCredit = Number(amount);
      } else {
        finalDebit = Number(amount);
      }
    }

    const payload = {
      entry_type: entryType,
      category,
      narration: narration || `${category} registered`,
      debit: finalDebit,
      credit: finalCredit,
      employee_id: entityType === 'employee' ? selectedEntityId : null,
      customer_id: entityType === 'customer' ? selectedEntityId : null,
      photo_url: photoBase64,
      created_at: formDate ? `${formDate} 12:00:00` : undefined
    };

    try {
      const res = await fetch('/api/roznamcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg("Roznamcha entry logged successfully.");
        // reset fields
        setCategory(categoriesByType[entryType][0]);
        setNarration('');
        setAmount('');
        setEntityType('none');
        setSelectedEntityId('');
        setPhotoBase64(null);
        
        // Reload Ledger state
        await fetchData();
        // Return focus to type select for rapid keying
        typeInputRef.current?.focus();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Failed to catalog daybook transactions.");
      }
    } catch (e) {
      setErrorMsg("Ledger link lost. Run check of internet connectivity.");
    } finally {
      setSubmitting(false);
      clearMessages();
    }
  };

  // Lock Day & Carry Forward opening balances
  const handleDayCloseFinish = async () => {
    if (!window.confirm("ARE YOU SURE YOU WANT TO LOCK ALL DAY ENTRIES?\nThis generates a ledger checkpoint and carries forward the closing hand balance as opening balance of the next period.")) {
      return;
    }

    try {
      const res = await fetch('/api/roznamcha/close-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_by: currentUserRole || 'System Admin' })
      });

      if (res.ok) {
        setSuccessMsg("Day successfully locked and balance rolled over.");
        await fetchData();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || "Fail in processing day closing operations.");
      }
    } catch (e) {
      setErrorMsg("Synchronization failure reporting closure.");
    } finally {
      clearMessages();
    }
  };

  // --- MOBILE SUBMIT RECOVERS ---
  const handleMobileSubmitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileCustomerId) {
      setErrorMsg("Please select a valid customer outlet to recovery from.");
      clearMessages();
      return;
    }
    if (!mobileRecoveryAmount || Number(mobileRecoveryAmount) <= 0) {
      setErrorMsg("Verify and insert collection amount.");
      clearMessages();
      return;
    }

    setSubmitting(true);
    const finalNotes = mobileRecoveryNotes || `Recovery collected cash receipt from ${mobileCustomerShop}`;

    const payload = {
      entry_type: 'Cash In',
      category: 'Sales Recovery',
      narration: finalNotes,
      debit: Number(mobileRecoveryAmount),
      credit: 0,
      customer_id: Number(mobileCustomerId),
      employee_id: null
    };

    try {
      const res = await fetch('/api/roznamcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg("Recovery receipt logged successfully.");
        setMobileCustomerId('');
        setMobileCustomerShop('');
        setMobileRecoveryAmount('');
        setMobileRecoveryNotes('');
        setMobileCustomerSearch('');
        await fetchData();
      } else {
        setErrorMsg("Failed database register of field recovery.");
      }
    } catch (e) {
      setErrorMsg("Could not process recovery. Verify connection.");
    } finally {
      setSubmitting(false);
      clearMessages();
    }
  };

  // --- MOBILE SUBMIT CODES ROUTE EXPENSES ---
  const handleMobileSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileExpenseAmount || Number(mobileExpenseAmount) <= 0) {
      setErrorMsg("Please type in physical cash spent amount.");
      clearMessages();
      return;
    }
    if (!mobilePhotoBase64) {
      setErrorMsg("MANDATORY: You must snap/upload physical fuel/tolls receipt photo to submit route expenses.");
      clearMessages();
      return;
    }

    setSubmitting(true);
    const categoryName = mobileExpenseCategory;
    const notesStr = mobileExpenseNotes || `${categoryName} logging record.`;

    const payload = {
      entry_type: 'Cash Out',
      category: categoryName,
      narration: notesStr,
      debit: 0,
      credit: Number(mobileExpenseAmount),
      employee_id: mobileExpenseEmployeeId ? Number(mobileExpenseEmployeeId) : null,
      photo_url: mobilePhotoBase64
    };

    try {
      const res = await fetch('/api/roznamcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccessMsg("Route expense logged successfully.");
        setMobileExpenseAmount('');
        setMobileExpenseEmployeeId('');
        setMobileExpenseNotes('');
        setMobilePhotoBase64(null);
        await fetchData();
      } else {
        setErrorMsg("Failed to catalog route expense.");
      }
    } catch (e) {
      setErrorMsg("Network error trying to transmit receipt.");
    } finally {
      setSubmitting(false);
      clearMessages();
    }
  };

  // Filters mapping
  const filteredEntries = entries.filter(row => {
    // 1. Filter Type
    if (filterType !== 'All' && row.entry_type !== filterType) return false;
    
    // 2. Filter Category
    if (filterCategory !== 'All' && row.category !== filterCategory) return false;

    // 3. Search query (Voucher, description, employee, customer)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const valVouch = (row.voucher_no || '').toLowerCase();
      const valNarr = (row.narration || '').toLowerCase();
      const valEmp = (row.employee_name || '').toLowerCase();
      const valCust = (row.customer_name || '').toLowerCase();
      const valCat = (row.category || '').toLowerCase();
      
      return valVouch.includes(q) || valNarr.includes(q) || valEmp.includes(q) || valCust.includes(q) || valCat.includes(q);
    }
    return true;
  });

  // Filter mobile staff logs (only their own field uploads of today, or general entries they created)
  const mobileStaffEntries = entries.filter(row => {
    // Return standard active entries, mapped nicely
    // staff can view any cash recovery or route expense registered
    return row.category === 'Sales Recovery' || row.entry_type === 'Cash Out';
  });

  // Unique list of categories in overall data to filter by
  const uniqueCategories = Array.from(new Set(entries.map(r => r.category)));

  // Autocomplete mobile customer search
  const filteredCustomersForMobile = customers.filter(c => {
    const term = mobileCustomerSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(term) || (c.shop_name || '').toLowerCase().includes(term) || (c.route || '').toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6 md:p-6" id="roznamcha-system">
      {/* HEADER RIBBON BLOCK */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#222063] text-[#facc15] rounded-xl shadow-md">
              <BookOpen className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                ROZNAMCHA JOURNAL <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">DIGITAL DAYBOOK</span>
              </h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest leading-none">
                Real-time Hand Cash Ledger & Automated Sales Recovery Ledger System
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Day Lock toggle utilities */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Layout switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
            <button
              onClick={() => setViewMode('desktop')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                viewMode === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${
                viewMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile Staff
            </button>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-white border rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Day Close Lock button - available for admin/accountant */}
          {!isFieldStaff && (
            <button
              onClick={handleDayCloseFinish}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" /> Lock & Close Day
            </button>
          )}
        </div>
      </div>

      {/* ALERT STRIPS */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-center gap-3 text-rose-800 text-xs no-print"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <span className="font-extrabold uppercase tracking-wide">{errorMsg}</span>
          </motion.div>
        )}
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs no-print"
          >
            <Check className="w-5 h-5 flex-shrink-0 text-emerald-600" />
            <span className="font-extrabold uppercase tracking-wide">{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW PANEL 1: DESKTOP PROFESSIONAL ACCOUNTING VIEW */}
      {viewMode === 'desktop' && (
        <div className="space-y-6">
          {/* DAILY SUMMARY STATUS CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Opening Balance */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Opening Balance (CFWD)</span>
              <p className="text-xl md:text-2xl font-black text-slate-500 font-mono mt-2">
                Rs. {(summary.opening_balance || 0).toLocaleString()}
              </p>
              <span className="absolute bottom-3 right-3 bg-slate-50 p-1.5 rounded-full text-slate-400">
                <Unlock className="w-4 h-4" />
              </span>
            </div>

            {/* Total Inflow */}
            <div className="bg-emerald-50/60 border border-emerald-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Total Cash In (Debit)</span>
              <p className="text-xl md:text-2xl font-black text-emerald-700 font-mono mt-2">
                Rs. {(summary.total_cash_in || 0).toLocaleString()}
              </p>
              <span className="absolute bottom-3 right-3 bg-emerald-100 p-1.5 rounded-full text-emerald-600">
                <ArrowDownLeft className="w-4 h-4" />
              </span>
            </div>

            {/* Total Outflow */}
            <div className="bg-rose-50/65 border border-rose-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider block font-black">Total Cash Out (Credit)</span>
              <p className="text-xl md:text-2xl font-black text-rose-700 font-mono mt-2">
                Rs. {(summary.total_cash_out || 0).toLocaleString()}
              </p>
              <span className="absolute bottom-3 right-3 bg-rose-100 p-1.5 rounded-full text-rose-600">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </div>

            {/* Closing Balance */}
            <div className="bg-[#222063] text-white border border-slate-900 rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">Closing Cash in Hand</span>
              <p className="text-2xl md:text-3xl font-black text-[#facc15] font-mono mt-1">
                Rs. {(summary.closing_balance || 0).toLocaleString()}
              </p>
              <span className="absolute bottom-3 right-3 bg-white/10 p-1.5 rounded-full text-[#facc15]">
                <FileSpreadsheet className="w-4 h-4" />
              </span>
            </div>
          </div>

          {/* DUAL PANE LAYOUT */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* LEFT SIDEBAR PANE: KEYBOARD OPTIMIZED QUICK ENTRY */}
            <div className="xl:col-span-1">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-4 relative sticky top-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <PlusCircle className="text-[#222063] w-4 h-4" /> Rapid Journal Vouching Entry
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Use 'Enter' key to step forward through inputs smoothly</p>
                </div>

                <form onSubmit={submitDesktopEntry} className="space-y-4">
                  {/* Select Voucher Stamp date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Stamp Date</label>
                      <div className="relative">
                        <input
                          ref={dateInputRef}
                          type="date"
                          value={formDate}
                          onChange={e => setFormDate(e.target.value)}
                          onKeyDown={e => handleKeyboardNavigation(e, 'date')}
                          className="w-full bg-slate-55 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Entry Type</label>
                      <select
                        ref={typeInputRef}
                        value={entryType}
                        onChange={e => setEntryType(e.target.value as any)}
                        onKeyDown={e => handleKeyboardNavigation(e, 'type')}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black outline-none"
                      >
                        <option value="Cash In">Cash In (Debit)</option>
                        <option value="Cash Out">Cash Out (Credit)</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Adjustment">Adjustment</option>
                      </select>
                    </div>
                  </div>

                  {/* Operational Category selector */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Accounting Ledger Category</label>
                    <select
                      ref={categoryInputRef}
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      onKeyDown={e => handleKeyboardNavigation(e, 'category')}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      {categoriesByType[entryType].map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Linking profiles settings */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Link Profile</label>
                      <select
                        ref={entityTypeInputRef}
                        value={entityType}
                        onChange={e => {
                          setEntityType(e.target.value as any);
                          setSelectedEntityId('');
                        }}
                        onKeyDown={e => handleKeyboardNavigation(e, 'entityType')}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                      >
                        <option value="none">No Link (General)</option>
                        <option value="customer">Customer outlet</option>
                        <option value="employee">Employee / staff</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Associated Entity</label>
                      <select
                        ref={entityIdInputRef}
                        disabled={entityType === 'none'}
                        value={selectedEntityId}
                        onChange={e => setSelectedEntityId(e.target.value)}
                        onKeyDown={e => handleKeyboardNavigation(e, 'entityId')}
                        className="w-full bg-slate-100 border border-slate-200 disabled:opacity-50 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      >
                        <option value="">-- Choose Profile --</option>
                        {entityType === 'customer' && customers.map(c => (
                          <option key={c.id} value={c.id}>{c.shop_name || c.name}</option>
                        ))}
                        {entityType === 'employee' && employees.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Numerical Entry */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Transaction Amount (PKR)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 font-mono">Rs.</span>
                      <input
                        ref={amountInputRef}
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        onKeyDown={e => handleKeyboardNavigation(e, 'amount')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-9 text-xs font-mono font-black text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/10"
                        required
                      />
                    </div>
                  </div>

                  {/* Specific details */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Narration / Description Remarks</label>
                    <input
                      ref={narrationInputRef}
                      type="text"
                      placeholder="e.g. Cash recovery from Mughal Biryani"
                      value={narration}
                      onChange={e => setNarration(e.target.value)}
                      onKeyDown={e => handleKeyboardNavigation(e, 'narration')}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>

                  {/* Photo attachments for Desktop logging (Optional) */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Attach Receipt (Optional Doc)</label>
                    <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-200">
                      <Camera className="w-5 h-5 text-slate-400 flex-shrink-0" />
                      <div className="text-left">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleImageFileChange(e, false)}
                          className="text-[9px] text-slate-500 max-w-full cursor-pointer"
                        />
                        <span className="text-[8px] text-slate-400 block font-bold uppercase leading-none mt-1">PNG, JPG up to 2MB allowed</span>
                      </div>
                    </div>
                    {photoBase64 && (
                      <div className="flex items-center justify-between bg-amber-50 p-2 border rounded-xl mt-2 text-[9px]">
                        <span className="truncate font-mono">Attached Image Captured.</span>
                        <button type="button" onClick={() => setPhotoBase64(null)} className="text-rose-600 hover:text-rose-800 font-bold shrink-0">✕ Remove</button>
                      </div>
                    )}
                  </div>

                  <button
                    ref={submitButtonRef}
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 select-none shadow-md cursor-pointer"
                  >
                    {submitting ? 'LOGGING...' : 'POST JOURNAL ENTRY'}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT MAIN PANEL: LIVE DIGITAL DATA GRID LEDGER */}
            <div className="xl:col-span-2 space-y-4">
              
              {/* FILTERING CONTROLS */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between no-print">
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Voucher, narration..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-1 focus:ring-amber-500/10"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="bg-slate-50 border rounded-xl px-2 py-1.5 text-[10px] font-bold outline-none"
                  >
                    <option value="All">All Types</option>
                    <option value="Cash In">Cash In (Debit)</option>
                    <option value="Cash Out">Cash Out (Credit)</option>
                    <option value="Bank Transfer">Bank Transfers</option>
                    <option value="Adjustment">Adjustments</option>
                  </select>

                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="bg-slate-50 border rounded-xl px-2 py-1.5 text-[10px] font-bold outline-none max-w-40"
                  >
                    <option value="All">All Categories</option>
                    {uniqueCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ACCOUNTING LEDGER DATA GRID */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest border-b">
                        <th className="p-4">Ref/Vouch No</th>
                        <th className="p-4">Date & Stamp</th>
                        <th className="p-4">Ledger Category</th>
                        <th className="p-4 max-w-72">Description / Narration</th>
                        <th className="p-4">Linked Profile / Employee</th>
                        <th className="p-4 text-right pr-6">DEBIT (CASH IN)</th>
                        <th className="p-4 text-right pr-6">CREDIT (CASH OUT)</th>
                        <th className="p-4 text-right pr-6">RUNNING BALANCE</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="p-12 text-center text-slate-400 font-extrabold uppercase tracking-widest animate-pulse">Syncing transactions ledger...</td>
                        </tr>
                      ) : filteredEntries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-12 text-center text-slate-405 italic text-slate-400">No journal bookings recorded match this filter criteria.</td>
                        </tr>
                      ) : (
                        filteredEntries.map((row) => (
                          <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${row.is_locked ? 'bg-slate-50/50' : ''}`}>
                            {/* Ref/Vouch Code */}
                            <td className="p-4 font-mono font-black text-[#222063]">
                              {row.voucher_no}
                            </td>
                            {/* Timestamp */}
                            <td className="p-4 font-bold text-slate-400 text-[10px] leading-tight">
                              {new Date(row.created_at).toLocaleDateString()}
                              <span className="block font-mono text-[8px] font-medium text-slate-300">
                                {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            {/* Category dropdown identifier */}
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border leading-none ${
                                row.entry_type === 'Cash In' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : row.entry_type === 'Cash Out'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                {row.category}
                              </span>
                            </td>
                            {/* Narration */}
                            <td className="p-4 max-w-72 font-semibold text-slate-800 break-words leading-relaxed text-[11px]">
                              {row.narration}
                              {row.photo_url && (
                                <button
                                  type="button"
                                  onClick={() => setViewPhoto(row.photo_url)}
                                  className="ml-2 inline-flex items-center gap-1 text-[9px] text-amber-600 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold tracking-widest cursor-pointer uppercase font-sans"
                                >
                                  <ImageIcon className="w-3 h-3" /> Photo Receipt
                                </button>
                              )}
                            </td>
                            {/* Entity Link row */}
                            <td className="p-4 text-[10px] font-bold text-slate-400 truncate">
                              {row.customer_name && (
                                <span className="text-indigo-600 block">Out: {row.customer_name}</span>
                              )}
                              {row.employee_name && (
                                <span className="text-slate-600 block">Staff: {row.employee_name}</span>
                              )}
                              {!row.customer_name && !row.employee_name && (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            {/* Debit amount */}
                            <td className="p-4 text-right pr-6 font-mono font-bold text-emerald-600 text-sm">
                              {row.debit > 0 ? `Rs. ${row.debit.toLocaleString()}` : <span className="text-slate-200">-</span>}
                            </td>
                            {/* Credit amount */}
                            <td className="p-4 text-right pr-6 font-mono font-bold text-rose-600 text-sm">
                              {row.credit > 0 ? `Rs. ${row.credit.toLocaleString()}` : <span className="text-slate-200">-</span>}
                            </td>
                            {/* Dynamic Cumulative running total */}
                            <td className="p-4 text-right pr-6 font-mono font-extrabold text-slate-900 text-sm">
                              Rs. {row.running_balance.toLocaleString()}
                            </td>
                            {/* Status label lock */}
                            <td className="p-3 text-center">
                              {row.is_locked ? (
                                <span className="inline-flex p-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full" title="Locked during Day Close">
                                  <Lock className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="inline-flex p-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full" title="Active ledger. Editable">
                                  <Unlock className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW PANEL 2: MOBILE VIEW (Optimized for Route recovery collections & field expense snap logs) */}
      {viewMode === 'mobile' && (
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Tabs for fast access */}
          <div className="grid grid-cols-3 bg-slate-100 p-1.5 rounded-2xl shadow-inner border no-print">
            <button
              onClick={() => setMobileTab('recovery')}
              className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                mobileTab === 'recovery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💸 Collect cash
            </button>
            <button
              onClick={() => setMobileTab('expense')}
              className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                mobileTab === 'expense' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ⛽ route expense
            </button>
            <button
              onClick={() => setMobileTab('recent')}
              className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${
                mobileTab === 'recent' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📋 Today Logs
            </button>
          </div>

          {/* ACTIVE TAB CONTENT CONTAINER */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 relative overflow-hidden">
            
            {/* SUBTAB 1: LOG ROUTE CASH RECOVERY COLLECTION FROM OUTLET */}
            {mobileTab === 'recovery' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-black uppercase text-emerald-700 flex items-center gap-1.5 tracking-tight">
                    <ArrowDownLeft className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full p-0.5" /> Log Sales Route Recovery
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Record daily collections collected directly from outlet shops.</p>
                </div>

                <form onSubmit={handleMobileSubmitRecovery} className="space-y-4">
                  
                  {/* Outlet Selector with Auto-Search combo */}
                  <div className="space-y-1 relative">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">1. Find Outlet / Shop Name</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search Shop name, route..."
                        value={mobileCustomerSearch}
                        onChange={e => {
                          setMobileCustomerSearch(e.target.value);
                          setShowMobileCustomerList(true);
                        }}
                        className="w-full bg-slate-50 border rounded-2xl py-3 pl-10 pr-4 text-xs font-bold outline-none"
                      />
                    </div>

                    {showMobileCustomerList && mobileCustomerSearch && (
                      <div className="absolute left-0 right-0 max-h-48 overflow-y-auto bg-white border rounded-2xl shadow-2xl z-20 mt-1 divide-y divide-slate-150">
                        {filteredCustomersForMobile.length === 0 ? (
                          <div className="p-3 text-xs text-slate-400 text-center italic">No shops matches search criteria.</div>
                        ) : (
                          filteredCustomersForMobile.map(cust => (
                            <button
                              key={cust.id}
                              type="button"
                              onClick={() => {
                                setMobileCustomerId(cust.id);
                                setMobileCustomerShop(cust.shop_name || cust.name);
                                setMobileCustomerSearch(cust.shop_name || cust.name);
                                setMobileRecoveryNotes(`Recovered Recovery collected cash from ${cust.shop_name || cust.name} (${cust.route || 'Local Swat'})`);
                                setShowMobileCustomerList(false);
                              }}
                              className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between"
                            >
                              <div className="text-xs">
                                <span className="font-extrabold text-slate-900 block">{cust.shop_name || cust.name}</span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{cust.route || 'No Route'}</span>
                              </div>
                              <span className="text-[10px] font-mono font-bold text-amber-600">O/S: Rs. {(cust.balance || 0).toLocaleString()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {mobileCustomerShop && (
                    <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-[9px] block text-emerald-600 font-extrabold uppercase">Selected Outlet</span>
                        <span className="font-bold text-slate-800">{mobileCustomerShop}</span>
                      </div>
                      <button type="button" onClick={() => {
                        setMobileCustomerId('');
                        setMobileCustomerShop('');
                        setMobileCustomerSearch('');
                      }} className="text-rose-600 text-xs font-black">Change</button>
                    </div>
                  )}

                  {/* Cash Amount Recovers */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">2. Recovery Amount Collected (PKR)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">Rs.</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={mobileRecoveryAmount}
                        onChange={e => setMobileRecoveryAmount(e.target.value)}
                        className="w-full bg-slate-50 border rounded-2xl py-3.5 px-9 text-base font-black font-mono text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/10"
                        required
                      />
                    </div>
                  </div>

                  {/* Narration Notes */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">3. Narration Description Remarks</label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared invoice recovery collection"
                      value={mobileRecoveryNotes}
                      onChange={e => setMobileRecoveryNotes(e.target.value)}
                      className="w-full bg-slate-50 border rounded-2xl px-3.5 py-3 text-xs font-bold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 select-none cursor-pointer"
                  >
                    {submitting ? 'TRANSMITTING RECOVERY...' : 'SUBMIT RECOVERY DEPOSIT'}
                  </button>

                </form>
              </div>
            )}

            {/* SUBTAB 2: SUBMIT ROUTE ACTIVE EXPENSE SNAP SHEET WITH RECEIPTS */}
            {mobileTab === 'expense' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-black uppercase text-rose-700 flex items-center gap-1.5 tracking-tight animate-pulse">
                    <ArrowUpRight className="w-5 h-5 bg-rose-100 text-rose-600 rounded-full p-0.5" /> Log Route Expense & Snap Receipt
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Capture fuel or road bills to request clearance reimbursement.</p>
                </div>

                <form onSubmit={handleMobileSubmitExpense} className="space-y-4">
                  
                  {/* Select Category */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">1. Choose Expense Category</label>
                    <select
                      value={mobileExpenseCategory}
                      onChange={e => setMobileExpenseCategory(e.target.value)}
                      className="w-full bg-slate-100 border text-slate-800 rounded-2xl px-3.5 py-3 text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Route Gas & Fuel">⛽ Fuel / Diesel Expense</option>
                      <option value="Tolls & Taxes">🛣️ Road Tolls / Taxes</option>
                      <option value="Vehicle Repair / Maintenance">🔧 Vehicle Repair & Maint.</option>
                      <option value="Employee Salary / Advance">💵 Driver Food & Advance</option>
                      <option value="Entertainment & Hospitality">☕ Customer Entertainment / Chai</option>
                      <option value="General Outflow">📦 Other Route Expense</option>
                    </select>
                  </div>

                  {/* Cash Spent Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">2. Cash Spent (PKR)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">Rs.</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={mobileExpenseAmount}
                          onChange={e => setMobileExpenseAmount(e.target.value)}
                          className="w-full bg-slate-50 border rounded-2xl py-3 px-8 text-xs font-black font-mono text-rose-600 outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">3. Identify Account Profile</label>
                      <select
                        value={mobileExpenseEmployeeId}
                        onChange={e => setMobileExpenseEmployeeId(e.target.value)}
                        className="w-full bg-slate-100 border rounded-2xl px-3 py-3 text-xs font-bold outline-none"
                      >
                        <option value="">Choose Staff employee...</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Snap Receipt Image - MANDATORY */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-rose-600 block font-black flex items-center gap-1 uppercase">
                      ⚠️ 4. Physical Receipt Image Snapshot (MANDATORY)
                    </label>
                    <div className="relative border-2 border-dashed border-rose-300 bg-rose-50/50 p-5 rounded-2xl text-center hover:bg-rose-50 transition-all">
                      {mobilePhotoBase64 ? (
                        <div className="space-y-3">
                          <img 
                            src={mobilePhotoBase64} 
                            alt="Snapped Receipt Thumbnail" 
                            className="max-h-24 mx-auto rounded-xl border object-cover shadow-md" 
                          />
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-[8px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">SUCCESSFULLY SNAPPED ✓</span>
                            <button
                              type="button"
                              onClick={() => setMobilePhotoBase64(null)}
                              className="text-[9px] text-rose-600 font-black hover:underline"
                            >
                              ✕ Remove Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Camera className="w-8 h-8 text-rose-400 mx-auto animate-bounce" />
                          <div className="text-slate-600 text-xs font-bold">Tap to Snap/Upload Physical Bill</div>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment" // trigger direct device camera back lenses!
                            onChange={e => handleImageFileChange(e, true)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full"
                            required
                          />
                          <span className="text-[8px] text-slate-400 font-medium block">Driver must snap a clear picture of toll ticket or fuel slip</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Narration Description */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block font-bold">5. Notes / Specifics description</label>
                    <input
                      type="text"
                      placeholder="e.g. Fuel purchase for vehicle Swat-449"
                      value={mobileExpenseNotes}
                      onChange={e => setMobileExpenseNotes(e.target.value)}
                      className="w-full bg-slate-50 border rounded-2xl px-3.5 py-3 text-xs font-bold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 select-none cursor-pointer"
                  >
                    {submitting ? 'REPROLOGGING EXPENSE RECORD...' : 'TRANSMIT ROUTE EXPENSE'}
                  </button>

                </form>
              </div>
            )}

            {/* SUBTAB 3: RECENT STAFF LOGS TODAY */}
            {mobileTab === 'recent' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-black uppercase text-[#222063] flex items-center gap-1.5 tracking-tight">
                    <BookOpen className="w-5 h-5 text-indigo-500" /> Today Post Log Registry
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Historical audit tracker. Hiding corporate master balances for security.</p>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {mobileStaffEntries.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl italic text-xs">No entries posted under your route session today.</div>
                  ) : (
                    mobileStaffEntries.map(row => (
                      <div key={row.id} className="p-4 bg-slate-50 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-sm">
                        <div className="space-y-1 self-start">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-[#222063] text-[10px]">{row.voucher_no}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide leading-none ${
                              row.entry_type === 'Cash In' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.category}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-700 leading-tight pr-4 text-[11px]">{row.narration}</p>
                          <span className="text-[9px] text-slate-450 text-slate-450 block font-bold text-slate-400">
                            {new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • Status: {row.is_locked ? '🔒 Locked' : '✓ Transmitted'}
                          </span>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <p className={`font-mono text-sm font-black ${row.entry_type === 'Cash In' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {row.entry_type === 'Cash In' ? `+Rs. ${row.debit.toLocaleString()}` : `-Rs. ${row.credit.toLocaleString()}`}
                          </p>
                          {row.photo_url && (
                            <button
                              type="button"
                              onClick={() => setViewPhoto(row.photo_url)}
                              className="mt-1 text-[8px] bg-indigo-50 text-indigo-700 font-bold px-1 py-0.5 rounded uppercase cursor-pointer block text-center"
                            >
                              View Bill
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* --- POPUP RECEIPTS PHOTO VIEWERS IN HIGHEST FIDELITY --- */}
      <AnimatePresence>
        {viewPhoto && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 no-print">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-w-lg w-full relative"
            >
              <div className="flex justify-between items-center pb-4 border-b">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5 leading-none">
                  <ImageIcon className="w-4 h-4 text-amber-500" /> Daybook Attached Receipt Picture
                </h3>
                <button
                  onClick={() => setViewPhoto(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 border"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-4 flex items-center justify-center">
                <img 
                  src={viewPhoto} 
                  alt="Full proof receipt slip"
                  className="max-h-[50vh] rounded-2xl border shadow-lg object-contain bg-slate-50 w-full" 
                />
              </div>

              <div className="mt-4 pt-3 border-t text-center">
                <button
                  onClick={() => setViewPhoto(null)}
                  className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-md leading-none"
                >
                  Close Document preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
