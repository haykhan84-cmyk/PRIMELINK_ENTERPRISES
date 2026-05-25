import React, { useState, useEffect, useRef } from 'react';
import { 
  Landmark, 
  Plus, 
  Search, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  Filter, 
  Coins, 
  Keyboard, 
  Sliders, 
  Check, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

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

interface CounterCashLog {
  id: number;
  type: 'In' | 'Out';
  amount: number;
  date: string;
  description: string;
  source: string;
}

export default function BankManagement() {
  const [activeTab, setActiveTab] = useState<'overview' | 'post-tx' | 'movements' | 'counter-cash'>('overview');
  
  // Datasets
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [counterBalance, setCounterBalance] = useState(0);
  const [counterLogs, setCounterLogs] = useState<CounterCashLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Success/Error toast notifications for different actions
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [depSuccess, setDepSuccess] = useState<string | null>(null);
  const [depError, setDepError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Deposit' | 'Withdrawal'>('All');
  const [filterAccount, setFilterAccount] = useState<number | 'All'>('All');

  // Interactive Panel Forms Status
  const [showAccountForm, setShowAccountForm] = useState(false);

  // 1. Setup New Bank Account state
  const [newAccount, setNewAccount] = useState({
    bank_name: '',
    account_number: '',
    account_title: '',
    initial_balance: ''
  });

  // 2. Post Bank Transaction keyboard-optimized state
  const [newTx, setNewTx] = useState({
    account_id: '',
    type: 'Deposit',
    amount: '',
    description: '',
    reference: ''
  });

  // 3. Deposit Cash to Bank keyboard-optimized state
  const [depositData, setDepositData] = useState({
    amount: '',
    bank_account_id: '',
    description: ''
  });

  // --- HTML Element Refs for Keyboard Enterprise Flow ---
  // A. Post Bank Transaction Refs
  const txAccountRef = useRef<HTMLSelectElement>(null);
  const txTypeRef = useRef<HTMLSelectElement>(null);
  const txAmountRef = useRef<HTMLInputElement>(null);
  const txDescRef = useRef<HTMLInputElement>(null);
  const txRefRef = useRef<HTMLInputElement>(null);
  const txSubmitRef = useRef<HTMLButtonElement>(null);

  // B. Deposit Cash to Bank Refs
  const depAmountRef = useRef<HTMLInputElement>(null);
  const depAccountRef = useRef<HTMLSelectElement>(null);
  const depRemarksRef = useRef<HTMLInputElement>(null);
  const depSubmitRef = useRef<HTMLButtonElement>(null);

  // C. Setup Account Refs
  const accBankRef = useRef<HTMLInputElement>(null);
  const accNumRef = useRef<HTMLInputElement>(null);
  const accTitleRef = useRef<HTMLInputElement>(null);
  const accBalRef = useRef<HTMLInputElement>(null);
  const accSubmitRef = useRef<HTMLButtonElement>(null);

  // API Call to fetch current state
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
      setCounterLogs(cashData.logs || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set default target accounts once accounts are loaded
  useEffect(() => {
    if (accounts.length > 0) {
      if (!newTx.account_id) {
        setNewTx(prev => ({ ...prev, account_id: String(accounts[0].id) }));
      }
      if (!depositData.bank_account_id) {
        setDepositData(prev => ({ ...prev, bank_account_id: String(accounts[0].id) }));
      }
    }
  }, [accounts]);

  // Handle Setup New Bank Account Submission
  const handleAddAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAccount.bank_name || !newAccount.account_number) {
      setAccountError("Bank Name and Account Number are both required.");
      return;
    }

    try {
      const payload = {
        bank_name: newAccount.bank_name,
        account_number: newAccount.account_number,
        account_title: newAccount.account_title || 'General Account',
        initial_balance: Number(newAccount.initial_balance) || 0
      };

      const res = await fetch('/api/bank/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setAccountSuccess(`Account ${newAccount.bank_name} (${newAccount.account_number}) saved successfully.`);
        setAccountError(null);
        setNewAccount({ bank_name: '', account_number: '', account_title: '', initial_balance: '' });
        setShowAccountForm(false);
        fetchData();
      } else {
        setAccountError("Error creating account. Ensure account number is unique.");
      }
    } catch (err) {
      setAccountError("Loss of communication with bank servers.");
    }
  };

  // Handle Post Transaction (Keyboard & submission optimized)
  const handleAddTx = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTx.account_id) {
      setTxError("Please choose an active bank account.");
      return;
    }
    if (!newTx.amount || Number(newTx.amount) <= 0) {
      setTxError("Please specify a transaction amount greater than Rs. 0.");
      return;
    }
    if (!newTx.description) {
      setTxError("Input a valid ledger explanation.");
      return;
    }

    try {
      const payload = {
        account_id: Number(newTx.account_id),
        type: newTx.type as 'Deposit' | 'Withdrawal',
        amount: Number(newTx.amount),
        description: newTx.description,
        reference: newTx.reference || ''
      };

      const res = await fetch('/api/bank/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setTxSuccess(`Transaction posted! ${newTx.type} of Rs. ${Number(newTx.amount).toLocaleString()} successfully recorded.`);
        setTxError(null);

        // Keep account_id & type selected, but clear variable inputs for next immediate ledger entry
        setNewTx(prev => ({
          ...prev,
          amount: '',
          description: '',
          reference: ''
        }));

        fetchData();

        // FOCUS BACK TO AMOUNT FOR RAPID ENTRY CONTINUATION WITH ZERO MOUSE CLICKS
        setTimeout(() => {
          txAmountRef.current?.focus();
        }, 50);

        setTimeout(() => setTxSuccess(null), 4000);
      } else {
        setTxError("DB validation error posting transaction.");
      }
    } catch (err) {
      setTxError("Unable to post to double entry ledger.");
    }
  };

  // Handle Deposit Physical Cash to Bank Account (Vault Transfer)
  const handleDeposit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cashAmount = Number(depositData.amount);
    if (!depositData.bank_account_id) {
      setDepError("Target bank account destination must be specified.");
      return;
    }
    if (!cashAmount || cashAmount <= 0) {
      setDepError("Enter deposit amount greater than Rs. 0.");
      return;
    }
    if (cashAmount > counterBalance) {
      setDepError(`Insufficient counter cash. Available: Rs. ${counterBalance.toLocaleString()}`);
      return;
    }

    try {
      const payload = {
        amount: cashAmount,
        bank_account_id: Number(depositData.bank_account_id),
        description: depositData.description || 'Counter cash deposit'
      };

      const res = await fetch('/api/counter-cash/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setDepSuccess(`Successfully transferred Rs. ${cashAmount.toLocaleString()} to chosen bank account.`);
        setDepError(null);
        setDepositData({
          amount: '',
          bank_account_id: accounts[0]?.id ? String(accounts[0].id) : '',
          description: ''
        });
        fetchData();

        // FOCUS BACK TO AMOUNT
        setTimeout(() => {
          depAmountRef.current?.focus();
        }, 50);

        setTimeout(() => setDepSuccess(null), 4000);
      } else {
        setDepError("Failed to deduct and transfer counter cash.");
      }
    } catch (err) {
      setDepError("Synchronization error writing cash transfer.");
    }
  };

  // --- Keyboard Event Interceptor Hooks ---
  const handleNewAccountKeyDown = (e: React.KeyboardEvent, curField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch(curField) {
        case 'bank_name': accNumRef.current?.focus(); break;
        case 'account_number': accTitleRef.current?.focus(); break;
        case 'account_title': accBalRef.current?.focus(); break;
        case 'initial_balance': handleAddAccount(); break;
        default: break;
      }
    }
  };

  const handlePostTxKeyDown = (e: React.KeyboardEvent, curField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch(curField) {
        case 'account_id': txTypeRef.current?.focus(); break;
        case 'type': txAmountRef.current?.focus(); break;
        case 'amount': txDescRef.current?.focus(); break;
        case 'description': txRefRef.current?.focus(); break;
        case 'reference': handleAddTx(); break; // Submit transaction on Enter!
        default: break;
      }
    }
  };

  const handleDepositKeyDown = (e: React.KeyboardEvent, curField: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      switch(curField) {
        case 'amount': depAccountRef.current?.focus(); break;
        case 'account_id': depRemarksRef.current?.focus(); break;
        case 'remarks': handleDeposit(); break; // Submit vault transfer on Enter!
        default: break;
      }
    }
  };

  // Total calculated funds (Across Bank plus physical Counter Cash)
  const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0) + counterBalance;

  // Filter transaction records
  const filteredTxs = transactions.filter(tx => {
    const matchSearch = 
      (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.bank_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.account_number || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchType = filterType === 'All' || tx.type === filterType;
    const matchAccount = filterAccount === 'All' || tx.account_id === Number(filterAccount);
    
    return matchSearch && matchType && matchAccount;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" id="banking-treasury-component">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            BANK SYSTEM & <span className="text-amber-600 italic font-medium">TREASURY</span>
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-0.5 leading-none">
            Corporate Fund Transfers • Double Entry Bank Ledgers & Cash Vault Logs
          </p>
        </div>
        
        {/* Quick helper status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            <Keyboard className="w-3 h-3 text-emerald-600 animate-pulse" /> Keys Active
          </span>
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-white border rounded-xl hover:bg-slate-50 transition-all text-slate-600 shadow-sm"
            title="Refresh Ledger Sync"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* TOP COMBINED FUNDS SUMMARY HUB */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Total Funds Card */}
        <div className="bg-[#11112b] text-white p-6 rounded-3xl border border-slate-900 flex flex-col justify-between shadow-xl relative overflow-hidden h-36">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Combined Total Capital Funds</span>
            <h2 className="text-2xl md:text-3xl font-black text-amber-400 italic font-mono mt-1">
              Rs. {totalBalance.toLocaleString()}
            </h2>
          </div>
          <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
            Aggregated over {accounts.length} Accounts & 1 Cash Pot
          </div>
          <Landmark className="absolute bottom-4 right-4 text-slate-800 w-12 h-12 -z-0 opacity-20" />
        </div>

        {/* Counter Cash Vault Balance Card */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm relative h-36 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Office Counter Cash Balance</span>
            <span className="p-1 px-2 text-[8px] bg-emerald-50 text-emerald-700 rounded-full font-black border border-emerald-100">VAULT</span>
          </div>
          <div className="mt-1">
            <h3 className="text-xl md:text-2xl font-mono font-black text-emerald-700">
              Rs. {counterBalance.toLocaleString()}
            </h3>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setActiveTab('counter-cash');
                setTimeout(() => depAmountRef.current?.focus(), 150);
              }}
              className="text-[9px] font-black uppercase text-amber-600 border border-amber-200 bg-amber-50/50 hover:bg-amber-50 px-3 py-1.5 rounded-xl transition-all block text-center"
            >
              💸 Deposit To Bank
            </button>
            <button 
              onClick={() => setActiveTab('counter-cash')}
              className="text-[9px] font-black uppercase text-slate-500 bg-slate-150 hover:bg-slate-100 px-3 py-1.5 rounded-xl transition-all text-slate-600 block text-center"
            >
              See Vault Logs
            </button>
          </div>
        </div>

        {/* Rapid Actions & Keyboard Status Card */}
        <div className="bg-stone-50 border border-slate-200 p-6 rounded-3xl flex flex-col justify-between shadow-sm relative h-36">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest block leading-none">Keyboard Assistant Mode</span>
              <p className="text-[10px] text-slate-400 font-bold mt-1 line-clamp-2">
                Press [Enter] inside any bank form to jump inputs and execute transactions without leaving the keyboard!
              </p>
            </div>
            <span className="p-1.5 bg-amber-500 text-white rounded-lg"><Keyboard className="w-4 h-4" /></span>
          </div>
          
          <button
            onClick={() => {
              setActiveTab('post-tx');
              setTimeout(() => txAmountRef.current?.focus(), 150);
            }}
            className="w-full bg-[#1e1b4b] hover:bg-[#311042] text-white py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center shrink-0"
          >
            ✏️ Post Bank Voucher
          </button>
        </div>

      </div>

      {/* CORE BANK TABS CONTROLLERS */}
      <div className="flex border-b border-slate-200 p-1 bg-slate-100 rounded-2xl max-w-2xl">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" /> Accounts ({accounts.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('post-tx');
            setTimeout(() => txAmountRef.current?.focus(), 150);
          }}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'post-tx' ? 'bg-[#191630] text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" /> Post Transaction
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'movements' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5" /> fund movements
        </button>

        <button
          onClick={() => setActiveTab('counter-cash')}
          className={`flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'counter-cash' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5" /> Cash Vault ({counterLogs.length})
        </button>
      </div>

      {/* ACTIVE TAB DISPLAY PANE */}
      <div className="mt-4">
        
        {/* TAB 1: OVERVIEW & ACTIVE BANK ACCOUNTS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Accounts Listing Grid */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border rounded-3xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4 border-b pb-4 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Registered Bank Vault Accounts</h3>
                  <button 
                    onClick={() => {
                      setShowAccountForm(!showAccountForm);
                      setTimeout(() => accBankRef.current?.focus(), 150);
                    }}
                    className="p-1 px-3 text-[9px] font-black uppercase tracking-wider bg-[#1e1b4b] text-white hover:bg-slate-800 transition-all rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" /> New Account
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts.map(acc => (
                    <div key={acc.id} className="p-5 border border-slate-200 rounded-2xl bg-white hover:shadow-md transition-all flex flex-col justify-between relative h-28">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-xs text-[#1e1b4b] uppercase">{acc.bank_name}</h4>
                          <span className="text-[8px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">{acc.account_number}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{acc.account_title}</p>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between">
                        <span className="text-[8px] text-slate-400 font-black uppercase block">Available Book Vault Balance</span>
                        <p className="font-mono text-sm font-black text-slate-900">Rs. {acc.balance.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}

                  {accounts.length === 0 && (
                    <div className="col-span-2 p-12 text-center text-slate-300 italic text-xs">
                      No business accounts created. Use setup panel to configure accounts.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible/Sidebar Pane: Create New Account (Visual in overview) */}
            <div className="lg:col-span-1">
              <div className="bg-white border rounded-3xl shadow-sm p-6 space-y-4">
                <div className="border-b pb-3 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-600 bg-emerald-100 p-0.5 rounded-full" /> Configure Bank Account
                  </h3>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-1">Setup multi-bank business ledgers</p>
                </div>

                {accountSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase rounded-xl border border-emerald-150">
                    {accountSuccess}
                  </div>
                )}
                {accountError && (
                  <div className="p-3 bg-rose-50 text-rose-850 text-[9px] font-bold uppercase rounded-xl border border-rose-150">
                    {accountError}
                  </div>
                )}

                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">1. Bank Corporation Name</label>
                    <input 
                      ref={accBankRef}
                      type="text"
                      placeholder="e.g. Bank Alfalah Swat"
                      value={newAccount.bank_name}
                      onKeyDown={e => handleNewAccountKeyDown(e, 'bank_name')}
                      onChange={e => setNewAccount({ ...newAccount, bank_name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">2. Account No / IBAN code</label>
                    <input 
                      ref={accNumRef}
                      type="text"
                      placeholder="e.g. PK83ALFH01002345678"
                      value={newAccount.account_number}
                      onKeyDown={e => handleNewAccountKeyDown(e, 'account_number')}
                      onChange={e => setNewAccount({ ...newAccount, account_number: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">3. Business Account Title</label>
                    <input 
                      ref={accTitleRef}
                      type="text"
                      placeholder="e.g. Primelink Distribution"
                      value={newAccount.account_title}
                      onKeyDown={e => handleNewAccountKeyDown(e, 'account_title')}
                      onChange={e => setNewAccount({ ...newAccount, account_title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">4. Opening Reference Capital Balance</label>
                    <input 
                      ref={accBalRef}
                      type="number"
                      placeholder="e.g. 500000"
                      value={newAccount.initial_balance}
                      onKeyDown={e => handleNewAccountKeyDown(e, 'initial_balance')}
                      onChange={e => setNewAccount({ ...newAccount, initial_balance: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                    />
                  </div>

                  <button
                    ref={accSubmitRef}
                    type="submit"
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all cursor-pointer shadow-md"
                  >
                    Post Capital Account config
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: POST BANK TRANSACTION (ENTER KEYBOARD DRIVEN JOURNALING) */}
        {activeTab === 'post-tx' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-[#191630] text-slate-100 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative">
              
              {/* Header inside form */}
              <div className="border-b border-indigo-900 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                    <Keyboard className="w-4 h-4 text-emerald-400" /> RAPID TRANSACTION JOURNAL
                  </h3>
                  <p className="text-[9px] text-slate-400 font-medium">Type values and tap [Enter] to shift focus and trigger seamless postings.</p>
                </div>
                <span className="p-1 px-2.5 bg-indigo-950 text-emerald-400 text-[8px] font-mono font-black uppercase rounded-lg border border-indigo-900">
                  FAST ENTRY MODE ON
                </span>
              </div>

              {txSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-900 text-[10px] font-black uppercase rounded-xl border border-emerald-200">
                  💰 {txSuccess}
                </div>
              )}
              {txError && (
                <div className="p-3 bg-rose-50 text-rose-900 text-[10px] font-black uppercase rounded-xl border border-rose-200">
                  ❌ {txError}
                </div>
              )}

              <form onSubmit={handleAddTx} className="space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bank Account ID Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">1. Target Ledger Bank Account</label>
                    <select
                      ref={txAccountRef}
                      value={newTx.account_id}
                      onChange={e => setNewTx({ ...newTx, account_id: e.target.value })}
                      onKeyDown={e => handlePostTxKeyDown(e, 'account_id')}
                      className="w-full bg-[#110e20] border border-indigo-950 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-black outline-none focus:border-amber-500"
                      required
                    >
                      <option value="">-- Select Bank Account --</option>
                      {accounts.map(a => (
                        <option className="bg-slate-900" key={a.id} value={a.id}>
                          {a.bank_name} ({a.account_number}) - Bal: Rs. {a.balance.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transaction Mode (Deposit vs Withdrawal) */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">2. Posting Entry Movement Type</label>
                    <select
                      ref={txTypeRef}
                      value={newTx.type}
                      onChange={e => setNewTx({ ...newTx, type: e.target.value as any })}
                      onKeyDown={e => handlePostTxKeyDown(e, 'type')}
                      className="w-full bg-[#110e20] border border-indigo-950 text-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-black outline-none focus:border-amber-500"
                    >
                      <option className="bg-slate-900 text-emerald-400" value="Deposit">Deposit (Debit / Inflow)</option>
                      <option className="bg-slate-900 text-rose-400" value="Withdrawal">Withdrawal (Credit / Outflow)</option>
                    </select>
                  </div>
                </div>

                {/* Amount (focused first after submission) */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-indigo-200 uppercase tracking-widest block">3. Numerical Booking Amount (PKR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-500 font-mono">Rs.</span>
                    <input
                      ref={txAmountRef}
                      type="number"
                      placeholder="0.00"
                      value={newTx.amount}
                      onChange={e => setNewTx({ ...newTx, amount: e.target.value })}
                      onKeyDown={e => handlePostTxKeyDown(e, 'amount')}
                      className="w-full bg-[#110e20] border border-indigo-950 text-white rounded-xl py-2.5 px-9 text-xs font-mono font-black text-slate-900 outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Description remarks */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-indigo-200 uppercase tracking-widest block">4. Transaction Description / Narration</label>
                  <input
                    ref={txDescRef}
                    type="text"
                    placeholder="e.g. Sales cash collection route deposit"
                    value={newTx.description}
                    onChange={e => setNewTx({ ...newTx, description: e.target.value })}
                    onKeyDown={e => handlePostTxKeyDown(e, 'description')}
                    className="w-full bg-[#110e20] border border-indigo-950 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-amber-500"
                    required
                  />
                </div>

                {/* Reference check / receipt doc code */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-indigo-200 uppercase tracking-widest block">5. Slip Reference / Check code (Optional)</label>
                  <input
                    ref={txRefRef}
                    type="text"
                    placeholder="e.g. CHQ-92837 or FT-839210"
                    value={newTx.reference}
                    onChange={e => setNewTx({ ...newTx, reference: e.target.value })}
                    onKeyDown={e => handlePostTxKeyDown(e, 'reference')}
                    className="w-full bg-[#110e20] border border-indigo-950 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                {/* Post Submit Button */}
                <div className="pt-3">
                  <button
                    ref={txSubmitRef}
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-[#1e1b4b] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2"
                  >
                    POST LEDGER VOUCHER (ENTER)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: TRANSACTION JOURNAL HISTORY */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            
            {/* INLINE JUMP OR DESKTOP FILTER BAR */}
            <div className="bg-white p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Query bank name, account, desc, ref..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border rounded-xl py-2 pl-9 pr-3 text-xs outline-none font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="bg-slate-50 border rounded-xl px-3 py-1.5 text-[10px] font-extrabold outline-none"
                >
                  <option value="All">All types</option>
                  <option value="Deposit">Deposits (+)</option>
                  <option value="Withdrawal">Withdrawals (-)</option>
                </select>

                <select
                  value={filterAccount}
                  onChange={e => setFilterAccount(e.target.value)}
                  className="bg-slate-50 border rounded-xl px-3 py-1.5 text-[10px] font-extrabold outline-none"
                >
                  <option value="All">All Bank Accounts</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.bank_name} ({a.account_number})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* FUND MOVEMENTS DATA GRID */}
            <div className="bg-white rounded-3xl border shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                      <th className="p-4">Deposit/Write Date</th>
                      <th className="p-4">Target Vault Account</th>
                      <th className="p-4">Voucher Narration</th>
                      <th className="p-4">Slip Reference</th>
                      <th className="p-4 text-right">Transfer Amount</th>
                      <th className="p-4 text-center">Movement Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredTxs.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 shrink-0 font-bold whitespace-nowrap text-slate-500">
                          {formatDate(tx.date)}
                          <span className="block font-mono text-[8px] font-medium text-slate-400">
                            {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-4 font-extrabold">
                          <span className="text-[#131131] block">{tx.bank_name}</span>
                          <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase">{tx.account_number}</span>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-800 text-[11px] leading-relaxed max-w-sm">{tx.description}</p>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {tx.reference || '—'}
                        </td>
                        <td className={`p-4 text-right font-mono font-black text-sm ${tx.type === 'Deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'Deposit' ? 'Rs. +' : 'Rs. -'} {tx.amount.toLocaleString()}
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider leading-none border ${
                            tx.type === 'Deposit' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {tx.type === 'Deposit' ? 'Deposit' : 'Withdrawal'}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {filteredTxs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-slate-400 italic text-sm">
                          No transactions found for the specified filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: OFFICE CASH VAULT & DEPOSITS LEDGER */}
        {activeTab === 'counter-cash' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Ledger Cash Log history (Previously omitted logs display) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white border rounded-3xl shadow-sm p-6">
                <div className="border-b pb-3 mb-4 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-500" /> Physical Cash Pot Vault Ledger History
                  </h3>
                  <span className="text-[10px] font-black bg-slate-150 py-0.5 px-2 bg-slate-100 border text-slate-600 rounded-full">
                    {counterLogs.length} Records
                  </span>
                </div>

                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-black select-none tracking-widest">
                        <th className="p-3">Log Date</th>
                        <th className="p-3">Source/Action</th>
                        <th className="p-3">Description Narration</th>
                        <th className="p-3 text-right">Debit (In)</th>
                        <th className="p-3 text-right">Credit (Out)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {counterLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/50">
                          <td className="p-3 text-slate-400 text-[10px] whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString()}
                            <span className="block font-sans text-[8px] font-medium text-slate-300">
                              {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="p-1 px-2 text-[8px] bg-slate-100 border text-slate-600 rounded font-black tracking-widest uppercase block text-center w-24">
                              {log.source || 'General'}
                            </span>
                          </td>
                          <td className="p-3 leading-relaxed text-slate-850 text-[11.5px]">
                            {log.description}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-600 text-sm whitespace-nowrap">
                            {log.type === 'In' ? `Rs. +${log.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-600 text-sm whitespace-nowrap">
                            {log.type === 'Out' ? `Rs. -${log.amount.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      ))}

                      {counterLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-slate-350 italic">
                            No active history logged in physical counter pot.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Deposit Hand Cash to Corporation Bank */}
            <div className="lg:col-span-1">
              <div className="bg-white border rounded-3xl shadow-sm p-6 space-y-4">
                <div className="border-b pb-3 border-slate-100">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                    <ArrowDownCircle className="w-5 h-5 text-emerald-600 bg-emerald-100 p-0.5 rounded-full" /> Bank Cash Deposit Transfer
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Physical Counter Cash rollover to Bank</p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-950 rounded-2xl flex flex-col justify-between">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block leading-none">Safe Balance at hand</span>
                  <p className="text-xl font-mono font-black text-emerald-700 leading-none mt-1">Rs. {counterBalance.toLocaleString()}</p>
                </div>

                {depSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-[9px] font-bold uppercase rounded-xl border border-emerald-150">
                    {depSuccess}
                  </div>
                )}
                {depError && (
                  <div className="p-3 bg-rose-50 text-rose-850 text-[9px] font-bold uppercase rounded-xl border border-rose-150 col-span-2">
                    {depError}
                  </div>
                )}

                <form onSubmit={handleDeposit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">1. Cash Amount to Bank Deposit (Rs.)</label>
                    <input 
                      ref={depAmountRef}
                      type="number"
                      placeholder="e.g. 50000"
                      value={depositData.amount}
                      onKeyDown={e => handleDepositKeyDown(e, 'amount')}
                      onChange={e => setDepositData({ ...depositData, amount: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">2. Target Destination Bank Account</label>
                    <select
                      ref={depAccountRef}
                      value={depositData.bank_account_id}
                      onKeyDown={e => handleDepositKeyDown(e, 'account_id')}
                      onChange={e => setDepositData({ ...depositData, bank_account_id: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                      required
                    >
                      <option value="">-- Select Bank Account --</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.bank_name} - {a.account_number}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 block tracking-wide">3. Remarks / Voucher Narration</label>
                    <input 
                      ref={depRemarksRef}
                      type="text"
                      placeholder="e.g. Counter Cash Swat Route deposit"
                      value={depositData.description}
                      onKeyDown={e => handleDepositKeyDown(e, 'remarks')}
                      onChange={e => setDepositData({ ...depositData, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>

                  <button
                    ref={depSubmitRef}
                    type="submit"
                    className="w-full py-2.5 bg-slate-900 override-amber hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md"
                  >
                    POST BANK DEPOSIT TRANSFER
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
