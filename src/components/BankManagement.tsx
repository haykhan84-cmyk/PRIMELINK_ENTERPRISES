import React, { useState, useEffect } from 'react';
import { Landmark, Plus, Search, ArrowUpCircle, ArrowDownCircle, History, Filter } from 'lucide-react';
import { motion } from 'motion/react';

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_title: string;
  balance: number;
}

interface Transaction {
  id: number;
  account_id: number;
  bank_name: string;
  account_number: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  date: string;
  description: string;
  reference: string;
}

export default function BankManagement() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [counterBalance, setCounterBalance] = useState(0);
  const [counterLogs, setCounterLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  
  const [newAccount, setNewAccount] = useState({
    bank_name: '',
    account_number: '',
    account_title: '',
    initial_balance: 0
  });

  const [newTx, setNewTx] = useState({
    account_id: 0,
    type: 'Deposit',
    amount: 0,
    description: '',
    reference: ''
  });

  const [depositData, setDepositData] = useState({
    amount: 0,
    bank_account_id: 0,
    description: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, txRes, cashRes] = await Promise.all([
        fetch('/api/bank/accounts'),
        fetch('/api/bank/transactions'),
        fetch('/api/counter-cash')
      ]);
      setAccounts(await accRes.json());
      setTransactions(await txRes.json());
      const cashData = await cashRes.json();
      setCounterBalance(cashData.balance);
      setCounterLogs(cashData.logs);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/bank/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount)
    });
    setIsAccountModalOpen(false);
    setNewAccount({ bank_name: '', account_number: '', account_title: '', initial_balance: 0 });
    fetchData();
  };

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/bank/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTx)
    });
    setIsTxModalOpen(false);
    setNewTx({ account_id: 0, type: 'Deposit', amount: 0, description: '', reference: '' });
    fetchData();
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/counter-cash/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depositData)
    });
    setIsDepositModalOpen(false);
    setDepositData({ amount: 0, bank_account_id: 0, description: '' });
    fetchData();
  };

  const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0) + counterBalance;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            BANKING & <span className="text-amber-600 italic">TREASURY</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Cash Management</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAccountModalOpen(true)}
            className="btn-outline flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Account
          </button>
          <button 
            onClick={() => setIsTxModalOpen(true)}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Post Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="erp-card bg-slate-900 text-white p-8">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Combined Funds</p>
          <h2 className="text-4xl font-black italic">Rs. {totalBalance.toLocaleString()}</h2>
          <div className="mt-6 flex items-center gap-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Across {accounts.length + 1} Storage Units</div>
          </div>
        </div>

        <div className="erp-card p-6 border-l-4 border-l-emerald-500 bg-emerald-50/10">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <button 
              onClick={() => setIsDepositModalOpen(true)}
              className="text-[8px] font-black uppercase border border-emerald-200 text-emerald-600 px-2 py-1 rounded-md hover:bg-emerald-100"
            >
              Deposit to Bank
            </button>
          </div>
          <h3 className="font-black text-slate-900">Counter Cash</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Physical Office Pot</p>
          <p className="text-2xl font-black text-emerald-600 leading-none">Rs. {counterBalance.toLocaleString()}</p>
        </div>

        {accounts.map(acc => (
          <div key={acc.id} className="erp-card p-6 border-l-4 border-l-amber-500">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Landmark className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{acc.account_number}</span>
            </div>
            <h3 className="font-black text-slate-900">{acc.bank_name}</h3>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{acc.account_title}</p>
            <p className="text-2xl font-black text-slate-900 leading-none">Rs. {acc.balance.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Transaction History */}
      <div className="erp-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase tracking-widest text-xs">
            <History className="w-4 h-4 text-amber-500" />
            Recent Fund Movements
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search movements..." 
                className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs font-bold outline-none w-64"
              />
            </div>
            <button className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acc Details</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Type</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="text-xs font-bold text-slate-900">{new Date(tx.date).toLocaleDateString()}</div>
                    <div className="text-[10px] font-medium text-slate-400">{new Date(tx.date).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-black text-slate-900">{tx.bank_name}</div>
                    <div className="text-[10px] font-bold text-slate-500">{tx.account_number}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-medium text-slate-900">{tx.description}</div>
                    {tx.reference && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">REF: {tx.reference}</div>}
                  </td>
                  <td className="p-4 text-right">
                    <div className={`text-sm font-black ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'Deposit' ? '+' : '-'} Rs. {tx.amount.toLocaleString()}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${tx.type === 'Deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {tx.type}
                    </span>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400 italic text-sm">
                    No transactions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isAccountModalOpen && (
        <Modal 
          title="Setup New Bank Account" 
          onClose={() => setIsAccountModalOpen(false)} 
          onSubmit={handleAddAccount}
        >
          <div className="space-y-4">
            <FormInput 
              label="Bank Name" 
              value={newAccount.bank_name} 
              onChange={v => setNewAccount({...newAccount, bank_name: v})} 
              required
            />
            <FormInput 
              label="Account Number / IBAN" 
              value={newAccount.account_number} 
              onChange={v => setNewAccount({...newAccount, account_number: v})} 
              required
            />
            <FormInput 
              label="Account Title" 
              value={newAccount.account_title} 
              onChange={v => setNewAccount({...newAccount, account_title: v})} 
            />
            <FormInput 
              label="Initial Balance (Rs.)" 
              type="number"
              value={newAccount.initial_balance} 
              onChange={v => setNewAccount({...newAccount, initial_balance: Number(v)})} 
            />
          </div>
        </Modal>
      )}

      {isTxModalOpen && (
        <Modal 
          title="Post Bank Transaction" 
          onClose={() => setIsTxModalOpen(false)} 
          onSubmit={handleAddTx}
        >
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Select Account</label>
              <select 
                required
                value={newTx.account_id}
                onChange={e => setNewTx({...newTx, account_id: Number(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                <option value="">Choose Account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Transaction Type</label>
              <select 
                value={newTx.type}
                onChange={e => setNewTx({...newTx, type: e.target.value as any})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                <option value="Deposit">Deposit (Inward)</option>
                <option value="Withdrawal">Withdrawal (Outward)</option>
              </select>
            </div>
            <FormInput 
              label="Amount (Rs.)" 
              type="number"
              value={newTx.amount} 
              onChange={v => setNewTx({...newTx, amount: Number(v)})} 
              required
            />
            <FormInput 
              label="Description" 
              value={newTx.description} 
              onChange={v => setNewTx({...newTx, description: v})} 
              required
            />
            <FormInput 
              label="Reference / Check No." 
              value={newTx.reference} 
              onChange={v => setNewTx({...newTx, reference: v})} 
            />
          </div>
        </Modal>
      )}

      {isDepositModalOpen && (
        <Modal 
          title="Deposit Cash to Bank" 
          onClose={() => setIsDepositModalOpen(false)} 
          onSubmit={handleDeposit}
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Available at Counter</p>
              <p className="text-xl font-black text-emerald-700">Rs. {counterBalance.toLocaleString()}</p>
            </div>
            
            <FormInput 
              label="Amount to Deposit" 
              type="number"
              value={depositData.amount} 
              onChange={v => setDepositData({...depositData, amount: Number(v)})} 
              required
            />
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Target Bank Account</label>
              <select 
                required
                value={depositData.bank_account_id}
                onChange={e => setDepositData({...depositData, bank_account_id: Number(e.target.value)})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
              >
                <option value="">Select Destination...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>)}
              </select>
            </div>
            <FormInput 
              label="Remarks" 
              value={depositData.description} 
              onChange={v => setDepositData({...depositData, description: v})} 
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, onSubmit }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="bg-slate-900 p-6 text-white text-center">
          <h3 className="text-xl font-black uppercase tracking-widest">{title}</h3>
        </div>
        <form onSubmit={onSubmit} className="p-8">
          {children}
          <div className="flex gap-3 pt-8">
            <button type="button" onClick={onClose} className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400">Cancel</button>
            <button type="submit" className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-amber-700 transition-all">Submit</button>
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
        required={required}
        type={type} 
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none"
      />
    </div>
  );
}
