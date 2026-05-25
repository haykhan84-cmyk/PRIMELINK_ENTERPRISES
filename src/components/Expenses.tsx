import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Filter, ArrowDownCircle, Banknote, Receipt, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

interface Expense {
  id: number;
  description: string;
  amount: number;
  category: string;
  date: string;
  payment_method: string;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseRows, setExpenseRows] = useState([{
    description: '',
    amount: 0,
    category: 'General',
    bank_account_id: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash'
  }]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    fetchExpenses();
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    const res = await fetch('/api/bank/accounts');
    setBankAccounts(await res.json());
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const resDet = await fetch('/api/expenses/detailed');
      const data = await resDet.json();
      setExpenses(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const addRow = () => {
    setExpenseRows([...expenseRows, {
      description: '',
      amount: 0,
      category: 'General',
      bank_account_id: '',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash'
    }]);
  };

  const removeRow = (index: number) => {
    if (expenseRows.length > 1) {
      setExpenseRows(expenseRows.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index: number, field: string, value: any) => {
    const newRows = [...expenseRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setExpenseRows(newRows);
  };

  const handleAddExpenses = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = expenseRows.filter(r => r.description && r.amount > 0);
    if (validRows.length === 0) {
      alert("Please enter at least one valid expense row (Description and Amount required)");
      return;
    }

    await fetch('/api/expenses/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRows)
    });
    
    setIsModalOpen(false);
    setExpenseRows([{
      description: '', 
      amount: 0, 
      category: 'General', 
      bank_account_id: '',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash'
    }]);
    fetchExpenses();
  };

  const categories = ['Salary', 'Fuel', 'Utilities', 'Salesman', 'Office Admin', 'Internal', 'Rent', 'Maintenance', 'Marketing', 'General'];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            EXPENSE <span className="text-rose-600 italic">MANAGER</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Cash Outflow Tracking</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-rose-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2 shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Batch Record
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
                <th className="p-4 text-center">Method</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-right">Category</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="text-xs font-bold text-slate-900">{formatDate(e.date)}</div>
                    <div className="text-[10px] text-slate-400">{new Date(e.date).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-medium text-slate-900">{e.description}</div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${e.payment_method === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.payment_method || 'Cash'}
                    </span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-widest leading-none">Batch Recording</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Multi-row Entry Mode • QuickBooks Style</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-100">
                    <th className="p-4">Date</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Method</th>
                    <th className="p-4">Paid From</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {expenseRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2">
                        <input 
                          type="date" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)}
                          className="w-full bg-slate-100/50 border border-transparent focus:border-rose-500 rounded-lg p-2 text-[11px] font-bold outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          placeholder="What was this for?" value={row.description} onChange={e => updateRow(idx, 'description', e.target.value)}
                          className="w-full bg-slate-100/50 border border-transparent focus:border-rose-500 rounded-lg p-2 text-[11px] font-bold outline-none ring-0 placeholder:text-slate-300"
                        />
                      </td>
                      <td className="p-2">
                        <select 
                          value={row.category} onChange={e => updateRow(idx, 'category', e.target.value)}
                          className="w-full bg-slate-100/50 border border-transparent focus:border-rose-500 rounded-lg p-2 text-[11px] font-black uppercase tracking-tight outline-none"
                        >
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <select 
                          value={row.payment_method} 
                          onChange={e => {
                            const method = e.target.value;
                            const newRows = [...expenseRows];
                            newRows[idx] = { 
                              ...newRows[idx], 
                              payment_method: method, 
                              bank_account_id: method === 'Cash' ? '' : newRows[idx].bank_account_id 
                            };
                            setExpenseRows(newRows);
                          }}
                          className="w-full bg-slate-100/50 border border-transparent focus:border-rose-500 rounded-lg p-2 text-[11px] font-black uppercase tracking-tight outline-none"
                        >
                          <option value="Cash">Cash</option>
                          <option value="Online">Online</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {row.payment_method === 'Online' ? (
                          <select 
                            value={row.bank_account_id} onChange={e => updateRow(idx, 'bank_account_id', e.target.value)}
                            className="w-full bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[10px] font-black uppercase outline-none text-emerald-700"
                          >
                            <option value="">Choose Bank</option>
                            {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.bank_name}</option>)}
                          </select>
                        ) : (
                          <div className="p-2 text-[10px] font-black text-slate-300 uppercase italic">Counter Cash</div>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <input 
                          type="number" placeholder="0" value={row.amount || ''} onChange={e => updateRow(idx, 'amount', Number(e.target.value))}
                          className="w-24 bg-slate-100/50 border border-transparent focus:border-rose-500 rounded-lg p-2 text-[11px] font-black text-right outline-none ring-0 text-rose-600 placeholder:text-rose-200"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button onClick={() => removeRow(idx)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <button 
                onClick={addRow}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Row
              </button>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Outflow</span>
                <span className="text-xl font-black text-rose-600 italic leading-none mt-0.5">
                  Rs. {expenseRows.reduce((sum, r) => sum + (r.amount || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-3 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                  Discard
                </button>
                <button 
                  onClick={handleAddExpenses}
                  className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all"
                >
                  Commit Batch
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
