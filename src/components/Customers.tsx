import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  MapPin, 
  Phone, 
  X,
  Check,
  AlertCircle,
  ChevronRight,
  Filter,
  Upload,
  FileText,
  RotateCcw,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../lib/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import ColumnManager, { useColumns } from './ColumnManager';
import { formatDate } from '../lib/dateUtils';

interface Customer {
  id: number;
  name: string;
  shop_name?: string;
  route: string;
  contact: string;
  credit_limit: number;
  balance: number;
  discount_pc: number;
}

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function Customers() {
  const navigate = useNavigate();
  const { currentUserRole, workspaceUid } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'directory' | 'add'>('directory');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [justSavedPartner, setJustSavedPartner] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('All');
  const [loading, setLoading] = useState(true);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { columns: custColumns, updateColumns: updateCustColumns } = useColumns('customer_directory', [
    { id: 'name', label: 'Customer Name', visible: true },
    { id: 'route', label: 'Route / Zone', visible: true },
    { id: 'contact', label: 'Contact', visible: true },
    { id: 'discount', label: 'Discount', visible: true },
    { id: 'credit', label: 'Credit Limit', visible: true },
    { id: 'status', label: 'Status', visible: true },
  ]);

  // Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    shop_name: '',
    route: '',
    contact: '',
    credit_limit: 50000,
    discount_pc: 0
  });

  useEffect(() => {
    fetchCustomers();
    
    if (currentUserRole === 'admin' && workspaceUid) {
      checkBackups();
    }
  }, [workspaceUid, currentUserRole]);

  const checkBackups = async () => {
    try {
      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const backupsRef = collection(db, 'users', workspaceUid, 'backups');
      const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Use the latest one that appears to have actual imported data
      const bestBackup = docs.find((b: any) => (b.count?.customers || 0) > 2) || docs[0];
      setCloudBackups(bestBackup ? [bestBackup] : []);
    } catch (e) {
      console.warn("Snapshot check failed", e);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Name,Route,Contact,Credit Limit,Discount PC\nSwat General Store,Main Bazaar,0312-1234567,50000,2\nKalam Valley Hotel,Kalam Rd,0312-7654321,100000,0";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let rawData = [];
        if (file.name.endsWith('.json')) {
          rawData = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) throw new Error("File is empty or missing headers");

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          rawData = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const obj: any = {};
            headers.forEach((h, i) => {
              // Map different header variations to canonical keys
              if (h.includes('name')) obj.name = values[i];
              else if (h.includes('route') || h.includes('location') || h.includes('area') || h.includes('zone')) obj.route = values[i];
              else if (h.includes('contact') || h.includes('phone') || h.includes('mobile')) obj.contact = values[i];
              else if (h.includes('limit') || h.includes('credit')) obj.credit_limit = Number(values[i].replace(/[^0-9.]/g, '')) || 0;
              else if (h.includes('discount')) obj.discount_pc = Number(values[i].replace(/[^0-9.]/g, '')) || 0;
              else obj[h] = values[i];
            });
            return obj;
          });
        }

        if (!Array.isArray(rawData)) throw new Error("Data format must be an array");

        const res = await fetch('/api/customers/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rawData)
        });

        if (res.ok) {
          const result = await res.json();
          alert(`SUCCESS: Imported ${result.count} customers into the permanent database.`);
          fetchCustomers();
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          const errorData = await res.json();
          console.error("Bulk Import Rejected:", errorData);
          alert(`IMPORT FAILED: ${errorData.error || "The server rejected the data format. Please use the template."}`);
        }
      } catch (err) {
        console.error("Bulk Import Failed:", err);
        alert(`CRITICAL ERROR: Could not process file. ${(err as Error).message}`);
      }
    };
    reader.onerror = () => alert("Error reading file. Is it corrupted?");
    reader.readAsText(file);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      console.log("[Customers] Fetching contacts from server...");
      const res = await fetch('/api/customers');
      const data = await res.json();
      console.log(`[Customers] Received ${Array.isArray(data) ? data.length : 'unknown'} records.`);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("[Customers] Fetch failed:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
        setJustSavedPartner(newCustomer.name);
        setNewCustomer({ name: '', shop_name: '', route: '', contact: '', credit_limit: 50000, discount_pc: 0 });
        fetchCustomers();
        setTimeout(() => setJustSavedPartner(null), 5000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedCustomer)
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setSelectedCustomer(null);
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    const confirmDelete = confirm(`Are you sure you want to delete ${selectedCustomer.name}? This action cannot be undone.`);
    if (!confirmDelete) return;
    
    // Double confirmation for safety as requested
    const secondConfirm = confirm(`Final Warning: Deleting this customer will remove all their records. Type OK to proceed.`);
    if (!secondConfirm) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setSelectedCustomer(null);
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRowDoubleClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditModalOpen(true);
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const routes = ['All', ...new Set(safeCustomers.map(c => c.route))];
  
  const filteredCustomers = safeCustomers.filter(c => {
    const matchesSearch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (c.contact || '').includes(searchQuery) ||
                          (c.route || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRoute = selectedRoute === 'All' || c.route === selectedRoute;
    return matchesSearch && matchesRoute;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Customer Management</h1>
          <p className="text-text-muted font-medium text-sm">Managing relationships and credit limits for {customers.length} retail partners.</p>
        </div>
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-border self-start">
          <button 
            onClick={() => setActiveTab('directory')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'directory' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-bg'}`}
          >
            Directory
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'add' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:bg-bg'}`}
          >
            Add New
          </button>
        </div>
      </div>

      <AnimatePresence>
        {currentUserRole === 'admin' && cloudBackups.length > 0 && customers.length <= 2 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase">Missing Data Detected?</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">We found a snapshot from {formatDate(cloudBackups[0].createdAt?.toDate?.() || cloudBackups[0].createdAt)}. You can restore your contacts in Settings.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/settings')}
              className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-primary/90 transition-all"
            >
              Recover Data
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'directory' ? (
          <motion.div
            key="directory"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Filters & Search */}
              <div className="erp-card bg-white p-4 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search by name, contact or route..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-bg border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-accent outline-none"
                    />
                  </div>
                  <ColumnManager columns={custColumns} onUpdate={updateCustColumns} title="Customer Columns" />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-text-muted hidden md:block" />
                <select 
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="flex-1 md:w-48 bg-bg border border-border rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-accent outline-none font-medium"
                >
                  {routes.map(route => (
                    <option key={route} value={route}>{route}</option>
                  ))}
                </select>
                <div className="flex flex-col items-end whitespace-nowrap">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-text-muted hover:text-accent rounded-lg transition-colors border border-border"
                    title="Bulk Import"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv,.json" 
                  className="hidden" 
                />
              </div>
            </div>

            {/* Customer Grid/Table */}
            <div className="erp-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg border-b border-border">
                      {custColumns.find(c => c.id === 'name')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Customer Name</th>}
                      {custColumns.find(c => c.id === 'route')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Route / Zone</th>}
                      {custColumns.find(c => c.id === 'contact')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Contact</th>}
                      {custColumns.find(c => c.id === 'discount')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap text-right">Discount</th>}
                      {custColumns.find(c => c.id === 'credit')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap text-right">Credit Limit</th>}
                      {custColumns.find(c => c.id === 'status')?.visible && <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap text-right">Status</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="p-12 text-center text-text-muted font-medium">Loading customers...</td></tr>
                    ) : filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-6 max-w-sm mx-auto">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                              <Users className="w-8 h-8" />
                            </div>
                            <div>
                               <p className="text-sm font-black text-slate-900 uppercase">Registry is Empty</p>
                               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-2 leading-relaxed">
                                 No contact records detected in the local database. If you previously had data, you can re-instate it from the Cloud Vault.
                               </p>
                            </div>
                            <div className="flex gap-3 w-full">
                               <button 
                                 onClick={() => setActiveTab('add')}
                                 className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all"
                               >
                                 Create New
                               </button>
                               <button 
                                 onClick={() => navigate('/settings')}
                                 className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                               >
                                 <RotateCcw className="w-3.5 h-3.5" />
                                 Go to Vault
                               </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => (
                        <tr 
                          key={customer.id} 
                          onDoubleClick={() => handleRowDoubleClick(customer)}
                          className="border-b border-border hover:bg-bg/50 transition-colors group cursor-pointer select-none"
                        >
                          {custColumns.find(c => c.id === 'name')?.visible && (
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                                  {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-text leading-none">{toTitleCase(customer.name)}</span>
                                  {customer.shop_name && <span className="text-[10px] text-text-muted font-black uppercase mt-1 tracking-wider">{customer.shop_name}</span>}
                                </div>
                              </div>
                            </td>
                          )}
                          {custColumns.find(c => c.id === 'route')?.visible && (
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                                <MapPin className="w-3.5 h-3.5" />
                                {toTitleCase(customer.route)}
                              </div>
                            </td>
                          )}
                          {custColumns.find(c => c.id === 'contact')?.visible && (
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
                                <Phone className="w-3.5 h-3.5" />
                                {customer.contact}
                              </div>
                            </td>
                          )}
                          {custColumns.find(c => c.id === 'discount')?.visible && (
                            <td className="p-4 text-right">
                              <span className="text-[10px] font-black bg-slate-100 px-2 py-1 rounded text-slate-600">
                                {customer.discount_pc || 0}%
                              </span>
                            </td>
                          )}
                          {custColumns.find(c => c.id === 'credit')?.visible && (
                            <td className="p-4 text-right">
                              <span className="font-mono text-xs font-bold text-text">
                                Rs. {customer.credit_limit.toLocaleString()}
                              </span>
                            </td>
                          )}
                          {custColumns.find(c => c.id === 'status')?.visible && (
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-2 text-right">
                                {customer.balance > customer.credit_limit ? (
                                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-danger bg-danger/10 px-2 py-0.5 rounded">
                                    <AlertCircle className="w-3 h-3" />
                                    Over-Limit
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-success bg-success/10 px-2 py-0.5 rounded">
                                    <Check className="w-3 h-3" />
                                    Healthy
                                  </div>
                                )}
                                <button className="p-1 text-text-muted hover:text-accent transition-colors">
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="add"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="erp-card bg-white overflow-hidden">
                <div className="bg-primary text-white p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center shadow-lg">
                      <UserPlus className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black italic tracking-tighter uppercase">Register <span className="text-accent">Partner</span></h2>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Customer Enrollment Protocol v2.0</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
                  {justSavedPartner && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-50 border-2 border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3"
                    >
                      <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0">✓</div>
                      <div>
                        <p className="text-xs font-black uppercase">Success: Partner Registered!</p>
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">"{justSavedPartner}" has been added and appears in the directory column to the right.</p>
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Customer Full Name</label>
                      <input 
                        required
                        type="text"
                        value={newCustomer.name}
                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                        placeholder="e.g., Abdullah Khan"
                        className="w-full bg-bg border-2 border-border rounded-xl py-3 px-4 text-sm focus:border-accent outline-none font-bold transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Shop / Business Name</label>
                      <input 
                        type="text"
                        value={newCustomer.shop_name}
                        onChange={(e) => setNewCustomer({...newCustomer, shop_name: e.target.value})}
                        placeholder="e.g., Swat General Store"
                        className="w-full bg-bg border-2 border-border rounded-xl py-3 px-4 text-sm focus:border-accent outline-none font-bold transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Assigned Route</label>
                      <input 
                        required
                        type="text"
                        value={newCustomer.route}
                        onChange={(e) => setNewCustomer({...newCustomer, route: e.target.value})}
                        placeholder="e.g., Main Bazaar"
                        className="w-full bg-bg border-2 border-border rounded-xl py-3 px-4 text-sm focus:border-accent outline-none font-bold transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Primary Contact</label>
                      <input 
                        required
                        type="text"
                        value={newCustomer.contact}
                        onChange={(e) => setNewCustomer({...newCustomer, contact: e.target.value})}
                        placeholder="03XX-XXXXXXX"
                        className="w-full bg-bg border-2 border-border rounded-xl py-3 px-4 text-sm focus:border-accent outline-none font-bold font-mono transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Allowed Discount (%)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={newCustomer.discount_pc}
                          onChange={(e) => setNewCustomer({...newCustomer, discount_pc: Number(e.target.value)})}
                          className="w-full bg-bg border-2 border-border rounded-xl py-3 px-4 text-sm focus:border-accent outline-none font-bold transition-all"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-black text-xs">%</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Opening Credit Limit</label>
                      <div className="relative">
                        <input 
                          required
                          type="number"
                          value={newCustomer.credit_limit}
                          onChange={(e) => setNewCustomer({...newCustomer, credit_limit: Number(e.target.value)})}
                          className="w-full bg-bg border-2 border-border rounded-xl py-3 pl-10 px-4 text-sm focus:border-accent outline-none font-bold transition-all"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-black text-xs">Rs.</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border flex flex-col gap-4">
                    <button 
                      type="submit"
                      className="w-full btn-primary !py-4 font-black text-xs uppercase tracking-[0.2em] shadow-[5px_5px_0px_0px_#1e293b]"
                    >
                      SAVE AND ADD NEW CUSTOMER
                    </button>
                    <p className="text-[9px] text-center text-text-muted font-bold uppercase tracking-widest px-8 leading-relaxed">
                      By registering, this customer will be immediately available in the Order Pad and Sales Ledger for all SPO/Salesman accounts.
                    </p>
                  </div>
                </form>
              </div>

              <div className="mt-8 flex justify-center gap-4">
                 <button onClick={downloadTemplate} className="text-[10px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-2">
                   <FileText className="w-4 h-4" /> Download Import CSV Template
                 </button>
              </div>
            </div>

            {/* LIVE FEED DIRECTORY COLUMN TO THE RIGHT */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-850 shadow-xl flex flex-col h-full min-h-[480px]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">Partners Pool</h3>
                    <p className="text-[8px] text-white/40 uppercase font-bold tracking-widest mt-0.5 font-mono">Real-time Feed</p>
                  </div>
                  <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
                    Live Feed
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 max-h-[520px] pr-1 scrollbar-thin">
                  {customers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/5 rounded-2xl">
                      <Users className="w-8 h-8 text-white/20 mb-2" />
                      <p className="text-[9px] text-white/40 uppercase font-black">No partners registered yet</p>
                    </div>
                  ) : (
                    [...customers]
                      .sort((a, b) => b.id - a.id)
                      .slice(0, 10)
                      .map((cust) => (
                        <motion.div 
                          key={cust.id}
                          layoutId={`added-cust-${cust.id}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all group"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors uppercase truncate max-w-[155px]">{cust.name}</h4>
                              <p className="text-[8px] text-white/40 font-bold uppercase truncate max-w-[155px]">{cust.shop_name || "General outlet"}</p>
                            </div>
                            <span className="text-[8px] font-mono font-black text-white px-1.5 py-0.5 bg-white/10 rounded">ID {cust.id}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[9px] border-t border-white/5 pt-2 font-semibold text-white/60">
                            <div>
                              <span className="text-emerald-400 font-bold uppercase block text-[7px] tracking-wider mb-0.5">Assigned Route</span>
                              <span className="uppercase font-bold text-white/80">{cust.route}</span>
                            </div>
                            <div>
                              <span className="text-emerald-400 font-bold uppercase block text-[7px] tracking-wider mb-0.5">Contact Line</span>
                              <span className="font-mono text-white/80">{cust.contact}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2 text-[9px] font-semibold text-white/60">
                            <div>
                              <span className="text-emerald-400 font-bold uppercase block text-[7px] tracking-wider mb-0.5">Credit Limit</span>
                              <span className="font-bold text-white/80">Rs. {cust.credit_limit}</span>
                            </div>
                            <div>
                              <span className="text-emerald-400 font-bold uppercase block text-[7px] tracking-wider mb-0.5">Discount</span>
                              <span className="font-bold text-white/80">{cust.discount_pc}% Off</span>
                            </div>
                          </div>
                        </motion.div>
                      ))
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 mt-4 text-center">
                  <span className="text-[8px] text-white/40 font-black uppercase tracking-widest leading-relaxed">
                    Swipe or return to general list to view complete route mapping and outstanding ledger balances.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit/View Customer Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedCustomer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="fixed inset-0 bg-primary/40 backdrop-blur-sm shadow-2xl transition-all"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-[101] overflow-hidden"
            >
              <div className="bg-accent text-white p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Edit Profile</h3>
                    <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Partner ID: {selectedCustomer.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateCustomer} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Customer Name</label>
                    <input 
                      required
                      type="text"
                      value={selectedCustomer.name}
                      onChange={(e) => setSelectedCustomer({...selectedCustomer, name: e.target.value})}
                      className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium text-text"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Shop Name</label>
                    <input 
                      type="text"
                      value={selectedCustomer.shop_name || ''}
                      onChange={(e) => setSelectedCustomer({...selectedCustomer, shop_name: e.target.value})}
                      className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium text-text"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Route</label>
                      <input 
                        required
                        type="text"
                        value={selectedCustomer.route}
                        onChange={(e) => setSelectedCustomer({...selectedCustomer, route: e.target.value})}
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium text-text"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Phone</label>
                      <input 
                        required
                        type="text"
                        value={selectedCustomer.contact}
                        onChange={(e) => setSelectedCustomer({...selectedCustomer, contact: e.target.value})}
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium font-mono text-text"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Credit (Rs.)</label>
                      <input 
                        required
                        type="number"
                        value={selectedCustomer.credit_limit}
                        onChange={(e) => setSelectedCustomer({...selectedCustomer, credit_limit: Number(e.target.value)})}
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-accent outline-none font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Discount (%)</label>
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        value={selectedCustomer.discount_pc}
                        onChange={(e) => setSelectedCustomer({...selectedCustomer, discount_pc: Number(e.target.value)})}
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-3 text-sm focus:ring-2 focus:ring-accent outline-none font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Current Balance (PKR)</label>
                    <input 
                      required
                      type="number"
                      value={selectedCustomer.balance}
                      onChange={(e) => setSelectedCustomer({...selectedCustomer, balance: Number(e.target.value)})}
                      className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-text"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="flex-1 btn-outline py-3 font-bold"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 btn-accent py-3 font-black uppercase tracking-widest text-[11px]"
                    >
                      Update Partner
                    </button>
                  </div>
                  <button 
                    type="button"
                    onClick={handleDeleteCustomer}
                    className="w-full bg-rose-50 text-rose-600 border border-rose-200 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Terminate Relationship
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
