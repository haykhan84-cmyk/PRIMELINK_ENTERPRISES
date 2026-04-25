import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  MapPin, 
  Phone, 
  CreditCard, 
  X,
  Check,
  AlertCircle,
  ChevronRight,
  Filter,
  Upload,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: number;
  name: string;
  route: string;
  contact: string;
  credit_limit: number;
  balance: number;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('All');
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    route: '',
    contact: '',
    credit_limit: 50000
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let data = [];
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          data = lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((h, i) => {
              if (h === 'credit_limit' || h === 'limit') obj.credit_limit = Number(values[i]);
              else obj[h] = values[i];
            });
            return obj;
          });
        }

        const res = await fetch('/api/customers/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          fetchCustomers();
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } catch (err) {
        console.error("Failed to parse file", err);
      }
    };
    reader.readAsText(file);
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
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
        setIsAddModalOpen(false);
        setNewCustomer({ name: '', route: '', contact: '', credit_limit: 50000 });
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const routes = ['All', ...new Set(customers.map(c => c.route))];
  
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.contact.includes(searchQuery) ||
                          c.route.toLowerCase().includes(searchQuery.toLowerCase());
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
        <div className="flex gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="btn-outline flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".csv,.json" 
            className="hidden" 
          />
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add New Customer
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="erp-card bg-white p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search by name, contact or route..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-accent outline-none"
          />
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
        </div>
      </div>

      {/* Customer Grid/Table */}
      <div className="erp-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border">
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Customer Name</th>
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Route / Zone</th>
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Contact</th>
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap text-right">Credit Limit</th>
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap text-right">Current Balance</th>
                <th className="p-4 card-title !mb-0 !border-0 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-medium">Loading customers...</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-medium">No customers found matching your criteria.</td></tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="border-b border-border hover:bg-bg/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-xs">
                          {customer.name.charAt(0)}
                        </div>
                        <span className="font-bold text-text">{customer.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                        <MapPin className="w-3.5 h-3.5" />
                        {customer.route}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
                        <Phone className="w-3.5 h-3.5" />
                        {customer.contact}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-xs font-bold text-text">
                        Rs. {customer.credit_limit.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-mono text-xs font-bold ${customer.balance > customer.credit_limit ? 'text-danger' : 'text-text'}`}>
                        Rs. {customer.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
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
                        <button className="p-1.5 text-text-muted hover:text-accent hover:bg-bg rounded transition-all opacity-0 group-hover:opacity-100">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="fixed inset-0 bg-primary/40 backdrop-blur-sm shadow-2xl transition-all"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg relative z-[101] overflow-hidden"
            >
              <div className="bg-primary text-white p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Register New Customer</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Primelink Partner Network</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Store / Customer Name</label>
                    <input 
                      required
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      placeholder="e.g., Swat General Store"
                      className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Route / Location</label>
                      <input 
                        required
                        type="text"
                        value={newCustomer.route}
                        onChange={(e) => setNewCustomer({...newCustomer, route: e.target.value})}
                        placeholder="e.g., Kalam Rd"
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Contact Phone</label>
                      <input 
                        required
                        type="text"
                        value={newCustomer.contact}
                        onChange={(e) => setNewCustomer({...newCustomer, contact: e.target.value})}
                        placeholder="03XX-XXXXXXX"
                        className="w-full bg-bg border border-border rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-accent outline-none font-medium font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-2 block">Initial Credit Limit (PKR)</label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-sm">Rs.</div>
                      <input 
                        required
                        type="number"
                        value={newCustomer.credit_limit}
                        onChange={(e) => setNewCustomer({...newCustomer, credit_limit: Number(e.target.value)})}
                        className="w-full bg-bg border border-border rounded-lg py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-accent outline-none font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 btn-outline py-3 font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 btn-primary py-3 font-black uppercase tracking-widest text-[11px]"
                  >
                    Authorize & Register
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
