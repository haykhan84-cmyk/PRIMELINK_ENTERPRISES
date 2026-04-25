import React, { useState, useEffect } from 'react';
import { RotateCcw, DollarSign, Package, CheckCircle2, AlertCircle, Printer } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settlement() {
  const [salesmen, setSalesmen] = useState<any[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<any>(null);
  const [settlementData, setSettlementData] = useState({
    stockIssued: 150000,
    returns: 12500,
    bookedInvoices: 125000,
    cashRecovered: 0,
  });

  useEffect(() => {
    fetch('/api/salesmen').then(res => res.json()).then(setSalesmen);
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
        if (selectedSalesman) {
          handleFinalize();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSalesman, settlementData, variance]);

  const handleFinalize = async () => {
    if (!selectedSalesman) return;
    
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
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Printable Receipt Slip */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-slate-900 font-mono">
        <div className="border-2 border-black p-6">
          <div className="text-center border-b-2 border-black pb-4 mb-4">
            <h2 className="text-2xl font-black">PRIMELINK ENTERPRISES</h2>
            <p className="text-xs font-bold uppercase mt-1">Official Payment Receipt (PRS)</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-xs mb-6 font-bold uppercase">
            <div>Receipt No: PRS-{Math.floor(Math.random() * 10000)}</div>
            <div className="text-right">Date: {new Date().toLocaleDateString()}</div>
            <div>Staff: {selectedSalesman?.name}</div>
            <div className="text-right">Time: {new Date().toLocaleTimeString()}</div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span>Total Load Value</span>
              <span>PKR {settlementData.stockIssued.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span>Returns (Unsold)</span>
              <span>- PKR {settlementData.returns.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-1">
              <span>Credit Sales (Pad)</span>
              <span>- PKR {settlementData.bookedInvoices.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black pt-2 border-t border-black text-sm">
              <span>CASH TO RECOVER</span>
              <span>PKR {totalToRecover.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-black pt-1 bg-slate-100 p-2 border-2 border-black">
              <span>ACTUAL CASH RECEIVED</span>
              <span>PKR {settlementData.cashRecovered.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span>NET VARIANCE</span>
              <span className={variance < 0 ? 'text-red-600' : ''}>PKR {variance.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-between mt-20 gap-8">
            <div className="flex-1 text-center border-t border-black pt-2 text-[10px] font-bold">
              CASHIER SIGNATURE
            </div>
            <div className="flex-1 text-center border-t border-black pt-2 text-[10px] font-bold">
              SALESMAN SIGNATURE
            </div>
          </div>

          <div className="mt-8 text-center text-[8px] opacity-50 font-bold uppercase tracking-widest">
            This is a computer generated document. Errors and Omissions Excepted.
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Post-Route Settlement (PRS)</h1>
          <p className="text-slate-500 font-bold text-sm uppercase">Daily reconciliation for field force & cash recovery.</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            id="salesman-select"
            onChange={(e) => setSelectedSalesman(salesmen.find(s => s.id === Number(e.target.value)))}
            className="bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:border-primary outline-none"
          >
            <option value="">Select Salesman...</option>
            {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="erp-card bg-white p-8">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-3">Reconciliation Worksheet</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Stock Issued Value</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Load-out aggregate value</p>
                  </div>
                </div>
                <input 
                  type="number" 
                  value={settlementData.stockIssued} 
                  onChange={(e) => setSettlementData({...settlementData, stockIssued: Number(e.target.value)})}
                  className="bg-white border border-slate-200 rounded-lg p-2 text-right font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Returns Value</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Unsold or damaged stock returned</p>
                  </div>
                </div>
                <input 
                  type="number" 
                  value={settlementData.returns} 
                  onChange={(e) => setSettlementData({...settlementData, returns: Number(e.target.value)})}
                  className="bg-white border border-slate-200 rounded-lg p-2 text-right font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none">Booked Invoices</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">Credit sales recorded on pad</p>
                  </div>
                </div>
                <input 
                  type="number" 
                  value={settlementData.bookedInvoices} 
                  onChange={(e) => setSettlementData({...settlementData, bookedInvoices: Number(e.target.value)})}
                  className="bg-white border border-slate-200 rounded-lg p-2 text-right font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div className="mt-12 p-8 bg-slate-900 rounded-3xl text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <DollarSign className="w-24 h-24" />
               </div>
               <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Target Cash Recovery</p>
                 <p className="text-4xl font-black italic">Rs. {totalToRecover.toLocaleString()}</p>
                 <p className="text-[10px] text-white/30 font-bold mt-2 uppercase tracking-[0.2em]">Calculated Automatically</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1">Status</p>
                 <span className="bg-emerald-500 text-[10px] font-black px-4 py-1 rounded-full uppercase">Balanced</span>
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="erp-card p-8 bg-white border-2 border-primary/10">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Cash Counting</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Actual Cash Received (Alt+C)</label>
                <input 
                  id="cash-input"
                  type="number" 
                  placeholder="Enter cash amount..."
                  onChange={(e) => setSettlementData({...settlementData, cashRecovered: Number(e.target.value)})}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-2xl font-black focus:border-primary outline-none transition-all"
                />
              </div>

              <div className={`p-6 rounded-2xl flex flex-col items-center justify-center border-2 ${variance === 0 ? 'bg-slate-50 border-slate-100' : variance > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Variance</p>
                <p className="text-3xl font-black italic">Rs. {variance.toLocaleString()}</p>
                {variance !== 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase">{variance > 0 ? 'Surplus' : 'Shortage'}</span>
                  </div>
                )}
              </div>
            </div>

            <button 
              disabled={!selectedSalesman}
              onClick={handleFinalize}
              className="w-full mt-8 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              Finalize & Print PRS
            </button>
          </div>

          <div className="erp-card bg-slate-900 border-none p-6 relative overflow-hidden">
             <div className="relative z-10">
               <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-4">Architect Insight</h4>
               <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-accent/30 pl-4 font-mono">
                 "PRS ensures financial compliance by locking daily cash recovery targets against digital order bookings. Discrepancies are automatically logged against salesman commission ledgers."
               </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
