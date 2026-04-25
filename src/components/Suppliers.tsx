import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, History, CreditCard, Landmark, ArrowRightLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  category: string;
  balance: number;
}

interface LedgerEntry {
  id: number;
  type: string;
  amount: number;
  date: string;
  description: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact_person: '',
    phone: '',
    category: '',
    address: '',
    initial_balance: 0
  });

  const [payment, setPayment] = useState({
    amount: 0,
    description: '',
    bank_account_id: ''
  });

  useEffect(() => {
    fetchSuppliers();
    fetchBankAccounts();
  }, []);

  const fetchSuppliers = async () => {
    const res = await fetch('/api/suppliers');
    setSuppliers(await res.json());
  };

  const fetchBankAccounts = async () => {
    const res = await fetch('/api/bank/accounts');
    setBankAccounts(await res.json());
  };

  const fetchLedger = async (id: number) => {
    const res = await fetch(`/api/suppliers/${id}/ledger`);
    setLedger(await res.json());
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSupplier)
    });
    setIsModalOpen(false);
    fetchSuppliers();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    
    await fetch(`/api/suppliers/${selectedSupplier.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });
    setIsPaymentModalOpen(false);
    fetchSuppliers();
    fetchLedger(selectedSupplier.id);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            SUPPLIER <span className="text-amber-600 italic">ACCOUNTS</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Procurement & Payables</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Onboard Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Supplier List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none"
            />
          </div>
          
          <div className="space-y-3">
            {suppliers.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedSupplier(s);
                  fetchLedger(s.id);
                }}
                className={`w-full p-4 rounded-2xl text-left border-2 transition-all ${
                  selectedSupplier?.id === s.id 
                    ? 'border-amber-500 bg-amber-50/50 shadow-md scale-[1.02]' 
                    : 'border-white bg-white hover:border-slate-100 hover:bg-slate-50/50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.category}</span>
                  <Truck className={`w-4 h-4 ${selectedSupplier?.id === s.id ? 'text-amber-500' : 'text-slate-300'}`} />
                </div>
                <h3 className="font-black text-slate-900">{s.name}</h3>
                <div className="mt-4 flex justify-between items-end">
                  <div className="text-[10px] font-bold text-slate-500">{s.contact_person}</div>
                  <div className="text-right">
                    <div className="text-[8px] font-black uppercase text-slate-400">Balance Due</div>
                    <div className="text-sm font-black text-amber-600">Rs. {s.balance.toLocaleString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Supplier Ledger */}
        <div className="lg:col-span-2">
          {selectedSupplier ? (
            <div className="space-y-6">
              <div className="erp-card bg-slate-900 text-white p-8 flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Outstanding Payable</p>
                  <h2 className="text-4xl font-black italic text-amber-500">Rs. {selectedSupplier.balance.toLocaleString()}</h2>
                  <div className="mt-6 flex items-center gap-6">
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Contact</p>
                      <p className="text-xs font-bold">{selectedSupplier.phone}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Representative</p>
                      <p className="text-xs font-bold">{selectedSupplier.contact_person}</p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl relative z-10"
                >
                  Settle Payment
                </button>
                <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                  <CreditCard className="w-48 h-48" />
                </div>
              </div>

              <div className="erp-card !p-0">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-xs">
                    <History className="w-4 h-4 text-amber-500" />
                    Transaction Ledger
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Debit</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map(entry => (
                        <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-4">
                            <div className="text-xs font-bold text-slate-900">{new Date(entry.date).toLocaleDateString()}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-xs font-medium text-slate-900">{entry.description}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{entry.type}</div>
                          </td>
                          <td className="p-4 text-right">
                            {entry.type === 'Purchase' ? (
                              <span className="text-sm font-black text-rose-600">Rs. {entry.amount.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                          <td className="p-4 text-right">
                            {entry.type === 'Payment' ? (
                              <span className="text-sm font-black text-emerald-600">Rs. {entry.amount.toLocaleString()}</span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-100 text-slate-400 italic">
              <Landmark className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">Select a supplier account from the left to view financial statements</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isModalOpen && (
        <Modal title="Onboard Supplier" onClose={() => setIsModalOpen(false)} onSubmit={handleAddSupplier}>
          <div className="space-y-4">
            <FormInput label="Supplier Name" value={newSupplier.name} onChange={v => setNewSupplier({...newSupplier, name: v})} required />
            <FormInput label="Primary Category" value={newSupplier.category} onChange={v => setNewSupplier({...newSupplier, category: v})} placeholder="e.g. Beverages, Packaging" />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Contact Person" value={newSupplier.contact_person} onChange={v => setNewSupplier({...newSupplier, contact_person: v})} />
              <FormInput label="Phone Number" value={newSupplier.phone} onChange={v => setNewSupplier({...newSupplier, phone: v})} />
            </div>
            <FormInput label="Initial Opening Balance (Rs.)" type="number" value={newSupplier.initial_balance} onChange={v => setNewSupplier({...newSupplier, initial_balance: Number(v)})} />
          </div>
        </Modal>
      )}

      {isPaymentModalOpen && (
        <Modal title="Post Supplier Payment" onClose={() => setIsPaymentModalOpen(false)} onSubmit={handlePayment}>
          <div className="space-y-4">
            <FormInput label="Amount (PKR)" type="number" value={payment.amount} onChange={v => setPayment({...payment, amount: Number(v)})} required />
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Payment Source</label>
              <select 
                value={payment.bank_account_id}
                onChange={e => setPayment({...payment, bank_account_id: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                <option value="">Select Account...</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} ({a.account_number})</option>)}
              </select>
            </div>
            <FormInput label="Reference / Description" value={payment.description} onChange={v => setPayment({...payment, description: v})} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center">
          <h3 className="text-xl font-black uppercase tracking-widest">{title}</h3>
        </div>
        <form onSubmit={onSubmit} className="p-8">
          {children}
          <div className="flex gap-3 pt-8">
            <button type="button" onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400">Cancel</button>
            <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Confirm</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function FormInput({ label, type = 'text', value, onChange, required, placeholder }: any) {
  return (
    <div>
      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">{label}</label>
      <input 
        required={required} type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none shadow-sm"
      />
    </div>
  );
}
