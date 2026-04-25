import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Filter, ArrowDownCircle, Banknote, Receipt, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'General',
    bank_account_id: ''
  });
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchExpenses();
    fetchBankAccounts();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/expenses/daily'); // This returns grouped, let's add a detailed one
      // Wait, let's add a detailed endpoint in server first
      const resDet = await fetch('/api/expenses/detailed');
      setExpenses(await resDet.json());
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchBankAccounts = async () => {
    const res = await fetch('/api/bank/accounts');
    setBankAccounts(await res.json());
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newExpense)
    });
    setIsModalOpen(false);
    setNewExpense({ description: '', amount: 0, category: 'General', bank_account_id: '' });
    fetchExpenses();
  };

  const categories = ['Salary', 'Fuel', 'Utilities', 'Rent', 'Maintenance', 'Entertainment', 'Marketing', 'General'];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            DAILY <span className="text-rose-600 italic">EXPENSES</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Cash Outflow Tracking</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Record Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="erp-card bg-slate-900 text-white p-6 md:col-span-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Today's Spend</p>
          <h3 className="text-2xl font-black italic">
            Rs. {expenses.filter(e => new Date(e.date).toDateString() === new Date().toDateString()).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
          </h3>
        </div>
        {categories.slice(0,3).map(cat => (
          <div key={cat} className="erp-card p-6 bg-white border border-slate-100 uppercase tracking-tighter">
            <p className="text-[8px] font-black text-slate-400 mb-1">{cat} Total (MTD)</p>
            <h4 className="text-lg font-black text-slate-900">
              Rs. {expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            </h4>
          </div>
        ))}
      </div>

      <div className="erp-card p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-500" />
            Recent Vouchers
          </h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search expenses..." className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-right">Category</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="text-xs font-bold text-slate-900">{new Date(e.date).toLocaleDateString()}</div>
                    <div className="text-[10px] text-slate-400">{new Date(e.date).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-medium text-slate-900">{e.description}</div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="text-sm font-black text-rose-600">Rs. {e.amount.toLocaleString()}</div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="text-[8px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{e.category}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <Modal title="Record New Expense" onClose={() => setIsModalOpen(false)} onSubmit={handleAddExpense}>
          <div className="space-y-4">
            <FormInput label="Description" value={newExpense.description} onChange={v => setNewExpense({...newExpense, description: v})} required />
            <FormInput label="Amount (PKR)" type="number" value={newExpense.amount} onChange={v => setNewExpense({...newExpense, amount: Number(v)})} required />
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
              <select 
                value={newExpense.category}
                onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Payment Source (Optional)</label>
              <select 
                value={newExpense.bank_account_id}
                onChange={e => setNewExpense({...newExpense, bank_account_id: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                <option value="">Counter Cash (Physical)</option>
                {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} ({a.account_number})</option>)}
              </select>
            </div>
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
            <button type="submit" className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Confirm Outflow</button>
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
