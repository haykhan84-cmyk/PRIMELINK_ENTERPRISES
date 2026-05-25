import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  DollarSign, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Search, 
  Coins, 
  Calendar, 
  User, 
  CheckSquare, 
  Receipt, 
  ArrowUpRight, 
  TrendingUp, 
  TrendingDown,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

interface SettlementRecord {
  id: number;
  salesman_name: string;
  salesman_id: number;
  date: string;
  stock_issued_val: number;
  returns_val: number;
  booked_val: number;
  cash_recovered: number;
  variance: number;
  status: string;
}

export default function Settlement() {
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [settlementData, setSettlementData] = useState({
    stockIssued: 150000,
    returns: 12500,
    bookedInvoices: 125000,
    cashRecovered: 0,
  });

  // Tabs management
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'balanced' | 'shortage' | 'surplus'>('all');
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Printed item state
  const [printData, setPrintData] = useState<any>(null);

  // Cash Denomination Helper Tool state
  const [showDenomHelper, setShowDenomHelper] = useState(false);
  const [denoms, setDenoms] = useState({
    d5000: '',
    d1000: '',
    d500: '',
    d100: '',
    d50: '',
    d20: '',
    d10: '',
    coins: '',
  });

  // Calculate denomination sum
  const calcDenomSum = () => {
    return (
      (Number(denoms.d5000) * 5000) +
      (Number(denoms.d1000) * 1000) +
      (Number(denoms.d500) * 500) +
      (Number(denoms.d100) * 100) +
      (Number(denoms.d50) * 50) +
      (Number(denoms.d20) * 20) +
      (Number(denoms.d10) * 10) +
      Number(denoms.coins || 0)
    );
  };

  const applyDenomSum = () => {
    const total = calcDenomSum();
    setSettlementData(prev => ({ ...prev, cashRecovered: total }));
    setShowDenomHelper(false);
  };

  const resetDenoms = () => {
    setDenoms({
      d5000: '',
      d1000: '',
      d500: '',
      d100: '',
      d50: '',
      d20: '',
      d10: '',
      coins: '',
    });
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      const salesmenRes = await fetch('/api/salesmen');
      const salesmenData = await salesmenRes.json();
      setSalesmen(Array.isArray(salesmenData) ? salesmenData : []);

      setLoadingHistory(true);
      const settlementsRes = await fetch('/api/settlements');
      const settlementsData = await settlementsRes.json();
      setHistory(Array.isArray(settlementsData) ? settlementsData : []);
    } catch (err) {
      console.error("Error loading settlement data: ", err);
      setSalesmen([]);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalToRecover = settlementData.stockIssued - settlementData.returns - settlementData.bookedInvoices;
  const variance = settlementData.cashRecovered - totalToRecover;

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Salesman on Alt+S
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('salesman-select')?.focus();
      }
      // Focus Cash input on Alt+C (Cash)
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        document.getElementById('cash-input')?.focus();
      }
      // Finalize on Ctrl+Enter
      if (e.ctrlKey && e.key === 'Enter') {
        if (selectedSalesman && activeTab === 'new') {
          handleFinalize();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSalesman, settlementData, variance, activeTab]);

  const handleFinalize = async () => {
    if (!selectedSalesman) return;
    
    // Save state for live print action
    const currentPrintDoc = {
      receiptNo: `PRS-${Math.floor(Math.random() * 89999 + 10000)}`,
      date: new Date().toISOString(),
      salesman_name: selectedSalesman.name,
      stock_issued_val: settlementData.stockIssued,
      returns_val: settlementData.returns,
      booked_val: settlementData.bookedInvoices,
      cash_recovered: settlementData.cashRecovered,
      variance: variance,
    };

    const res = await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salesman_id: selectedSalesman.id,
        stock_issued_val: settlementData.stockIssued,
        returns_val: settlementData.returns,
        booked_val: settlementData.bookedInvoices,
        cash_recovered: settlementData.cashRecovered,
        variance: variance
      })
    });

    if (res.ok) {
      // Trigger native print with prepared printData template
      setPrintData(currentPrintDoc);
      fetchData(); // reload history
      
      // Auto switch to history to view log
      setActiveTab('history');
      
      // Reset state for new entry
      setSettlementData({
        stockIssued: 0,
        returns: 0,
        bookedInvoices: 0,
        cashRecovered: 0,
      });
      setSelectedSalesman(null);
      resetDenoms();

      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  const handlePrintPast = (item: SettlementRecord) => {
    setPrintData({
      receiptNo: `PRS-HIST-${item.id}`,
      date: item.date,
      salesman_name: item.salesman_name,
      stock_issued_val: item.stock_issued_val,
      returns_val: item.returns_val,
      booked_val: item.booked_val,
      cash_recovered: item.cash_recovered,
      variance: item.variance,
    });
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Filter and Search calculations for history
  const filteredHistory = history.filter(item => {
    const salesmanName = (item.salesman_name || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = salesmanName.includes(query) || String(item.id).includes(query);
    
    if (!matchesSearch) return false;

    if (statusFilter === 'balanced') return item.variance === 0;
    if (statusFilter === 'shortage') return item.variance < 0;
    if (statusFilter === 'surplus') return item.variance > 0;
    
    return true;
  });

  // Statistics for history log
  const statsHistory = {
    totalCount: history.length,
    totalCashCollected: history.reduce((sum, item) => sum + (item.cash_recovered || 0), 0),
    netVariance: history.reduce((sum, item) => sum + (item.variance || 0), 0),
    shortageCount: history.filter(item => item.variance < 0).length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in relative">
      {/* 🧾 Elegant Printable Receipt Form (Invisible on screen/Visible on print) */}
      {printData && (
        <div className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-hidden printing-page font-sans text-slate-900 p-8">
          <div className="border border-slate-900 p-6 h-full flex flex-col justify-between">
            <div>
              <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none">PRIMELINK ENTERPRISES</h2>
                <p className="text-[10px] font-black uppercase mt-1 tracking-widest text-slate-500">Route Settlement Voucher Slip</p>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Automated Multi-Channel Audit Solution</p>
              </div>
              
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-[10px] mb-8 font-black uppercase border-b border-slate-100 pb-5">
                <div>
                  <span className="text-slate-400 block text-[8px] tracking-wider">PRS VOUCHER NUMBER</span>
                  <span className="text-slate-900 text-xs">{printData.receiptNo}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[8px] tracking-wider">DATE OF RECONCILIATION</span>
                  <span className="text-slate-900">{formatDate(printData.date)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] tracking-wider">FIELD EXECUTIVE NAME</span>
                  <span className="text-slate-900 text-xs">{printData.salesman_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[8px] tracking-wider">STATION/TERRITORY</span>
                  <span className="text-slate-900">Swat, KP Division</span>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Reconciliation Summary</h4>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Total Stock Assigned (Load-out)</span>
                  <span className="text-sm font-bold font-mono">Rs. {Number(printData.stock_issued_val || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Unsold Stock Returned (Physical)</span>
                  <span className="text-sm font-bold font-mono">- Rs. {Number(printData.returns_val || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Registered Digital Credit Orders</span>
                  <span className="text-sm font-bold font-mono">- Rs. {Number(printData.booked_val || 0).toLocaleString()}</span>
                </div>
                
                <div className="mt-8 bg-slate-50 p-5 border border-slate-200 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="text-[10px] font-black uppercase tracking-widest">Expected Recovery Cash</span>
                    <span className="text-md font-black font-mono">
                      Rs. {(Number(printData.stock_issued_val || 0) - Number(printData.returns_val || 0) - Number(printData.booked_val || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-900 border-t border-slate-200 pt-3">
                    <span className="text-xs font-black uppercase tracking-widest">Net Actual Cash Deposited</span>
                    <span className="text-xl font-black font-mono text-[#222063]">
                      Rs. {Number(printData.cash_recovered || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-black uppercase px-2 pt-3">
                  <span className="text-slate-400">Recovery Cash Variance</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] text-white ${
                    Number(printData.variance || 0) === 0 
                      ? 'bg-emerald-600' 
                      : Number(printData.variance || 0) > 0 
                        ? 'bg-amber-600' 
                        : 'bg-rose-600'
                  }`}>
                    {Number(printData.variance || 0) === 0 
                      ? 'Balanced' 
                      : `Rs. ${Number(printData.variance || 0).toLocaleString()} ${Number(printData.variance || 0) > 0 ? '(Excess Surplus)' : '(Shortage Liability)'}`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-12 px-6 pt-12 border-t border-slate-100 mb-8">
                <div className="text-center pt-2">
                  <div className="w-full border-b border-slate-400 mb-1" />
                  <p className="text-[8px] font-black uppercase text-slate-400">Accountant / Audit Officer</p>
                </div>
                <div className="text-center pt-2">
                  <div className="w-full border-b border-slate-400 mb-1" />
                  <p className="text-[8px] font-black uppercase text-slate-400">Sales Executive Signature</p>
                </div>
              </div>

              <div className="text-center opacity-40">
                <p className="text-[6px] font-black uppercase tracking-[0.3em]">
                  PrimeLink ERP • Route Audit Engine • System Time: {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#222063]/10 text-[#222063] rounded-2.5xl flex items-center justify-center shadow-inner shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">PRS Route Settlement</h1>
            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
              Daily reconciliation engine for stock assigned, unsold returns, and cash deposit audits.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'new' 
                ? 'bg-[#222063] text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            New Settlement Worksheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'bg-[#222063] text-white shadow-lg' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Audit Logs/Archives ({history.length})
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
          {/* Main Reconciliation Worksheet Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="erp-card bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#222063]">
                  Route Reconciliation Input
                </h3>
                <span className="text-[9px] font-bold text-slate-400 uppercase font-mono">
                  All metrics in Pakistani Rupee (Rs.)
                </span>
              </div>
              
              <div className="space-y-5">
                {/* Salesman Selector */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#222063]/5 rounded-xl flex items-center justify-center">
                        <User className="w-4 h-4 text-[#222063]" />
                      </div>
                      <div>
                        <label htmlFor="salesman-select" className="text-[10px] font-black uppercase text-slate-400">Assigned Salesman</label>
                        <p className="text-[11px] text-slate-500 font-bold mt-0.5">Select field executive to reconcile daily route</p>
                      </div>
                    </div>
                    
                    <select 
                      id="salesman-select"
                      value={selectedSalesman ? selectedSalesman.id : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setSelectedSalesman(null);
                        } else {
                          setSelectedSalesman(salesmen.find(s => s.id === Number(val)) || null);
                        }
                      }}
                      className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#222063] transition-all cursor-pointer text-slate-800 w-full md:w-64 shadow-sm"
                    >
                      <option value="">Select executive...</option>
                      {salesmen.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} (ID: {s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Main reconciliation metrics list */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stock Issued */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-[#222063]/5 flex items-center justify-center text-[#222063]">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Stock Issued</p>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">LOAD-OUT AGGREGATE</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-black">Rs.</span>
                      <input 
                        type="number" 
                        value={settlementData.stockIssued || ''} 
                        onChange={(e) => setSettlementData({...settlementData, stockIssued: Number(e.target.value)})}
                        placeholder="0"
                        className="bg-white border border-slate-100 rounded-xl py-2.5 pl-9 pr-3 text-right font-black text-sm w-full focus:ring-2 focus:ring-[#222063] transition-all outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Returns Value */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-red-500/5 flex items-center justify-center text-red-500">
                        <RotateCcw className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Returned Stock</p>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">UNSOLD & DAMAGED</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-red-400 font-black">Rs.</span>
                      <input 
                        type="number" 
                        value={settlementData.returns || ''} 
                        onChange={(e) => setSettlementData({...settlementData, returns: Number(e.target.value)})}
                        placeholder="0"
                        className="bg-white border border-slate-100 rounded-xl py-2.5 pl-9 pr-3 text-right font-black text-sm w-full focus:ring-2 focus:ring-[#222063] transition-all outline-none text-red-600"
                      />
                    </div>
                  </div>

                  {/* Booked Invoices Value */}
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Credit Bookings</p>
                        <p className="text-[8px] font-bold text-slate-400 mt-0.5">FIELD CREDIT INVOICED</p>
                      </div>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-emerald-400 font-black">Rs.</span>
                      <input 
                        type="number" 
                        value={settlementData.bookedInvoices || ''} 
                        onChange={(e) => setSettlementData({...settlementData, bookedInvoices: Number(e.target.value)})}
                        placeholder="0"
                        className="bg-white border border-slate-100 rounded-xl py-2.5 pl-9 pr-3 text-right font-black text-sm w-full focus:ring-2 focus:ring-[#222063] transition-all outline-none text-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-100 pt-5">
                  <div className="flex flex-col sm:flex-row items-center justify-between text-slate-500 text-xs px-2 mb-3 font-bold uppercase">
                    <span>Summary of Intermediate Flow:</span>
                    <span className="text-[10.5px]">
                      Gross Net Sales: <span className="font-mono font-black text-slate-800">Rs. {(settlementData.stockIssued - settlementData.returns).toLocaleString()}</span>
                    </span>
                  </div>
                </div>

                {/* Primary expectation visual */}
                <div className="p-6 bg-[#222063] rounded-2.5xl text-white flex items-center justify-between shadow-lg relative overflow-hidden transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <DollarSign className="w-24 h-24" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#9d9be3] mb-1">Estimated Cash to Deposit Target</p>
                    <p className="text-3xl font-black italic tracking-tight font-mono">
                      Rs. {totalToRecover.toLocaleString()}
                    </p>
                    <p className="text-[8px] text-[#9d9be3]/60 font-medium mt-1 uppercase tracking-wider">
                      Target = (Stock Issued - Returns - Credit Bookings)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block bg-[#4846b4] text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-inner text-white/90">
                      Auto-Calculated Target
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cash Denomination Helper Tool */}
            <div className="erp-card bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Cash Denomination Helper</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Quickly compute bag total from physical note counts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDenomHelper(!showDenomHelper)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  {showDenomHelper ? 'Close Drawer' : 'Open Drawer & count'}
                </button>
              </div>

              {showDenomHelper && (
                <div className="mt-5 border-t border-slate-100 pt-5 space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 5,000</label>
                      <input 
                        type="number" 
                        value={denoms.d5000} 
                        onChange={(e) => setDenoms({...denoms, d5000: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 1,000</label>
                      <input 
                        type="number" 
                        value={denoms.d1000} 
                        onChange={(e) => setDenoms({...denoms, d1000: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 500</label>
                      <input 
                        type="number" 
                        value={denoms.d500} 
                        onChange={(e) => setDenoms({...denoms, d500: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 100</label>
                      <input 
                        type="number" 
                        value={denoms.d100} 
                        onChange={(e) => setDenoms({...denoms, d100: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 50</label>
                      <input 
                        type="number" 
                        value={denoms.d50} 
                        onChange={(e) => setDenoms({...denoms, d50: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 20</label>
                      <input 
                        type="number" 
                        value={denoms.d20} 
                        onChange={(e) => setDenoms({...denoms, d20: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Rs. 10</label>
                      <input 
                        type="number" 
                        value={denoms.d10} 
                        onChange={(e) => setDenoms({...denoms, d10: e.target.value})}
                        placeholder="Qty"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block mb-1">Coins / Loose</label>
                      <input 
                        type="number" 
                        value={denoms.coins} 
                        onChange={(e) => setDenoms({...denoms, coins: e.target.value})}
                        placeholder="Sum"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center font-bold text-xs outline-none focus:ring-2 focus:ring-[#222063]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-150 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase">Sum Total:</span>
                      <span className="text-sm font-black text-amber-800 font-mono">
                        Rs. {calcDenomSum().toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={resetDenoms}
                        className="px-3 py-1.5 border border-slate-200 text-[#222063] font-bold text-[9px] uppercase tracking-wide rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={applyDenomSum}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-[9px] uppercase tracking-wide rounded-lg shadow-sm transition-all cursor-pointer"
                      >
                        Copy to Deposited Cash
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Audit Actions and Variance Panel */}
          <div className="space-y-6">
            <div className="erp-card p-8 bg-white rounded-3xl border-2 border-[#222063]/10 shadow-sm">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-800">
                  Cash Reconciliation Deposit
                </h3>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="cash-input" className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                    Actual Cash Received (Alt+C)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4.5 text-base text-slate-400 font-black">Rs.</span>
                    <input 
                      id="cash-input"
                      type="number" 
                      placeholder="Enter aggregate cash..."
                      value={settlementData.cashRecovered || ''}
                      onChange={(e) => setSettlementData({...settlementData, cashRecovered: Number(e.target.value)})}
                      className="w-full bg-slate-50 border-2 border-slate-150 rounded-2xl py-4 pl-10 pr-4 text-3xl font-black focus:border-[#222063] focus:bg-white outline-none transition-all text-slate-800"
                    />
                  </div>
                </div>

                {/* Live Real-time Variance Visualizer */}
                <div className={`p-6 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-300 ${
                  variance === 0 
                    ? 'bg-slate-50 border-slate-100' 
                    : variance > 0 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600 animate-pulse' 
                      : 'bg-rose-50 border-rose-100 text-rose-600'
                }`}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                    Settlement Variance (Diff)
                  </p>
                  <p className="text-3xl font-black italic font-mono tracking-tight">
                    Rs. {variance.toLocaleString()}
                  </p>
                  
                  {variance === 0 ? (
                    <div className="mt-3 flex items-center gap-1.5 bg-emerald-100/50 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ledges Balanced
                    </div>
                  ) : variance > 0 ? (
                    <div className="mt-3 flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border border-emerald-700 shadow-md">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Excess Cash Surplus (+Rs. {variance})
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border border-rose-700 shadow-md">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Cash Shortage Liability (-Rs. {Math.abs(variance)})
                    </div>
                  )}
                </div>

                <button 
                  disabled={!selectedSalesman}
                  type="button"
                  onClick={handleFinalize}
                  className="w-full mt-4 py-5 bg-[#222063] text-white rounded-2.5xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Printer className="w-4.5 h-4.5" />
                  Finalize & Print Slip
                </button>

                {!selectedSalesman && (
                  <p className="text-[9px] text-[#222063] font-bold text-center uppercase tracking-wide mt-2">
                    * Select salesman in input form to enable final submission
                  </p>
                )}
              </div>
            </div>

            {/* Quick Informational card */}
            <div className="erp-card bg-slate-900 border-none p-6 rounded-3xl relative overflow-hidden text-slate-100">
               <div className="relative z-10 space-y-3">
                 <div className="flex items-center gap-2">
                   <Info className="w-4.5 h-4.5 text-[#9d9be3]" />
                   <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em]">Compliance Policy</h4>
                 </div>
                 <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-accent/30 pl-4 font-mono">
                   PRS reconciliation holds salesmen legally responsible for shortfalls. All variances greater than Rs. 100 are reviewed by accounting before the salesman is dispatched on their next segment.
                 </p>
               </div>
            </div>
          </div>
        </div>
      ) : (
        /* Settlement Archives / Historical records Tab */
        <div className="space-y-6 no-print">
          {/* Statistics summary top bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="erp-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Audited Runs</p>
              <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {statsHistory.totalCount}
              </p>
              <span className="text-[9px] font-semibold text-slate-450 uppercase mt-1 block">
                Logged in SQLite
              </span>
            </div>

            <div className="erp-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Real Cash Recovered</p>
              <p className="text-2xl font-black text-emerald-600 mt-2 font-mono">
                Rs. {statsHistory.totalCashCollected.toLocaleString()}
              </p>
              <span className="text-[9px] font-black text-emerald-600 uppercase mt-1 block">
                Deposited in Safe Vault
              </span>
            </div>

            <div className="erp-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aggregated Cash Variance</p>
              <p className={`text-2xl font-black mt-2 font-mono ${statsHistory.netVariance === 0 ? 'text-slate-800' : statsHistory.netVariance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                Rs. {statsHistory.netVariance.toLocaleString()}
              </p>
              <span className="text-[9px] font-semibold text-slate-450 uppercase mt-1 block">
                Net deficit or surplus
              </span>
            </div>

            <div className="erp-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">Shortage Incidents</p>
              <p className="text-2xl font-black text-rose-600 mt-2 font-mono">
                {statsHistory.shortageCount}
              </p>
              <span className="text-[9px] font-black text-rose-600 uppercase mt-1 block">
                Accounts flagged
              </span>
            </div>
          </div>

          {/* Filtering and Search Controls */}
          <div className="bg-white p-6 rounded-2.5xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-3.5 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search salesman name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-[#222063] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-start md:self-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-2">Status Audit:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === 'all' 
                      ? 'bg-[#222063] text-white shadow' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('balanced')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === 'balanced' 
                      ? 'bg-[#222063] text-white shadow' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('shortage')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'shortage' 
                      ? 'bg-rose-600 text-white shadow' 
                      : 'text-rose-600 hover:bg-rose-50'
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Shortage
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('surplus')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'surplus' 
                      ? 'bg-emerald-600 text-white shadow' 
                      : 'text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Surplus
                </button>
              </div>
            </div>
          </div>

          {/* Historical Audited Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[#222063]">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">ID</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date / Time</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Sales Representative</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Stock Issued</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Returns</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Credit Bills</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Cash Deposited</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Variance</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs font-black uppercase text-slate-400 tracking-wider">
                        Running system database fetch...
                      </td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                        No reconciled route settlements found
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const expectedCash = (item.stock_issued_val || 0) - (item.returns_val || 0) - (item.booked_val || 0);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono font-bold text-xs text-slate-450">
                            #{item.id}
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-450" />
                              {formatDate(item.date)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800 text-xs">
                              {item.salesman_name || `ID: ${item.salesman_id}`}
                            </div>
                          </td>
                          <td className="p-4 text-right font-mono font-semibold text-xs text-slate-500">
                            Rs. {Number(item.stock_issued_val || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-mono font-semibold text-xs text-red-500">
                            Rs. {Number(item.returns_val || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-mono font-semibold text-xs text-emerald-600">
                            Rs. {Number(item.booked_val || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-xs text-slate-900">
                            Rs. {Number(item.cash_recovered || 0).toLocaleString()}
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                              item.variance === 0 
                                ? 'bg-slate-100 text-slate-600' 
                                : item.variance > 0 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-rose-100 text-rose-700'
                            }`}>
                              Rs. {Number(item.variance || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => handlePrintPast(item)}
                              className="px-3 py-1.5 bg-[#222063]/5 hover:bg-[#222063]/15 text-[#222063] font-black text-[9px] uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 mx-auto cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Reprint
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
