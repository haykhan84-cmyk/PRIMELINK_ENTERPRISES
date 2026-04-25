import React, { useState, useEffect, useRef } from 'react';
import { Package, ShieldAlert, Calendar, History, ArrowDownToLine, Plus, Search, Upload, CheckCircle2, Truck, Mail, Phone, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

export default function Inventory() {
  const [skus, setSkus] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [returnsCount, setReturnsCount] = useState(0);
  const [viewMode, setViewMode] = useState<'sku' | 'batch' | 'supplier'>('sku');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newSku, setNewSku] = useState({
    name: '',
    category: 'General',
    price_per_case: 0,
    price_per_unit: 0,
    units_per_case: 12,
    cogs_per_case: 0,
    gst_rate: 18
  });

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    category: 'General'
  });

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/skus').then(res => res.json()),
      fetch('/api/inventory').then(res => res.json()),
      fetch('/api/reports/returns').then(res => res.json()),
      fetch('/api/suppliers').then(res => res.json())
    ]).then(([skuData, invData, retData, supData]) => {
      setSkus(skuData);
      setInventory(invData);
      setSuppliers(supData);
      const totalReturns = retData.reduce((acc: number, r: any) => acc + r.quantity, 0);
      setReturnsCount(totalReturns);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSku = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/skus/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newSku])
      });
      if (res.ok) {
        setIsAddSkuModalOpen(false);
        setNewSku({
          name: '',
          category: 'General',
          price_per_case: 0,
          price_per_unit: 0,
          units_per_case: 12,
          cogs_per_case: 0,
          gst_rate: 18
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSupplier)
      });
      if (res.ok) {
        setIsAddSupplierModalOpen(false);
        setNewSupplier({ name: '', contact_person: '', phone: '', email: '', address: '', category: 'General' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' or Alt+S
      if ((e.key === '/' || (e.altKey && e.key === 's')) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('inventory-search')?.focus();
      }
      // Bulk Import on Alt+I
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
      // New SKU on Alt+N
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        setIsAddSkuModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stockLevels = React.useMemo(() => {
    const levels: Record<number, number> = {};
    inventory.forEach(inv => {
      levels[inv.sku_id] = (levels[inv.sku_id] || 0) + inv.quantity_cases;
    });
    return levels;
  }, [inventory]);

  const nearExpiryCount = React.useMemo(() => {
    return inventory.filter(inv => {
      if (!inv.expiry_date) return false;
      const daysLeft = Math.ceil((new Date(inv.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      return daysLeft < 30;
    }).reduce((acc, inv) => acc + inv.quantity_cases, 0);
  }, [inventory]);

  const filteredSkus = skus.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInventory = inventory.filter(inv => 
    inv.sku_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.batch_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              const val = values[i];
              if (['price_per_case', 'price_per_unit', 'units_per_case', 'cogs_per_case'].includes(h)) {
                obj[h] = Number(val);
              } else {
                obj[h] = val;
              }
            });
            return obj;
          });
        }

        const res = await fetch('/api/skus/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          fetchData();
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      } catch (err) {
        console.error("Failed to parse file", err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Inventory Control</h1>
          <p className="text-text-muted font-medium text-sm">Manage SKUs, batch expiry, and stock levels.</p>
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
            onClick={() => setIsAddSkuModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New SKU
          </button>
          <button 
            onClick={() => setIsAddSupplierModalOpen(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all"
          >
            <Truck className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-sans">
        <div className="erp-card bg-[#1a184d] text-white">
          <div className="card-title text-slate-400 !border-white/10">Total SKUs</div>
          <p className="text-3xl font-black">{skus.length}</p>
        </div>
        <div className="erp-card border-l-4 border-l-[#f59e0b]">
          <div className="card-title text-[#f59e0b]">Near Expiry</div>
          <p className="text-3xl font-black">{nearExpiryCount} <span className="text-sm font-bold opacity-60 ml-2 uppercase tracking-widest">Cases</span></p>
        </div>
        <div className="erp-card border-l-4 border-l-[#ef4444]">
          <div className="card-title text-[#ef4444]">Returns (Total)</div>
          <p className="text-3xl font-black">{returnsCount} <span className="text-sm font-bold opacity-60 ml-2 uppercase tracking-widest">Units</span></p>
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('sku')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'sku' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
            >
              Master SKU List
            </button>
            <button 
              onClick={() => setViewMode('batch')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'batch' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
            >
              Batch Expiry (FEFO)
            </button>
            <button 
              onClick={() => setViewMode('supplier')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'supplier' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
            >
              Suppliers
            </button>
          </div>
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              id="inventory-search"
              type="text" 
              placeholder="Search inventory... (/)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {viewMode === 'sku' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">SKU Details</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Case Price</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Tax (%)</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">In Stock</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => (
                  <tr key={sku.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="font-bold text-slate-900">{sku.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-widest">
                        {sku.category}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono text-xs font-bold text-slate-900">Rs. {sku.price_per_case.toLocaleString()}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs font-bold text-emerald-600">{sku.gst_rate}% GST</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-black text-slate-900 leading-none">
                        {stockLevels[sku.id] || 0}
                      </span>
                    </td>
                    <td className="p-4">
                      <button className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">Edit SKU</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : viewMode === 'batch' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Batch / SKU</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Expiry Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Days Left</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty (Cases)</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">FEFO Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((inv) => {
                  const daysLeft = Math.ceil((new Date(inv.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Lot: {inv.batch_number}</p>
                          <span className="font-bold text-slate-900">{inv.sku_name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-bold font-mono ${daysLeft < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {inv.expiry_date || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${daysLeft < 30 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                          {daysLeft > 0 ? `${daysLeft} Days` : 'Expired'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-black text-slate-900">{inv.quantity_cases}</span>
                      </td>
                      <td className="p-4">
                        {daysLeft < 30 ? (
                          <div className="flex items-center gap-2 text-rose-600">
                            <ShieldAlert className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Liquidate Now</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Stable</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50">
              {filteredSuppliers.map(sup => (
                <div key={sup.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <Truck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      {sup.category}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{sup.name}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{sup.contact_person || 'No Contact Person'}</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                      <Phone className="w-4 h-4 text-slate-300" />
                      {sup.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                      <Mail className="w-4 h-4 text-slate-300" />
                      {sup.email || 'N/A'}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                      <MapPin className="w-4 h-4 text-slate-300" />
                      {sup.address || 'N/A'}
                    </div>
                  </div>
                </div>
              ))}
              {filteredSuppliers.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400">
                  <Truck className="w-12 h-12 opacity-10 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">No suppliers found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add SKU Modal */}
      {isAddSkuModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Register New SKU</h3>
            </div>
            
            <form onSubmit={handleAddSku} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product Name</label>
                  <input 
                    required
                    type="text" 
                    value={newSku.name}
                    onChange={(e) => setNewSku({...newSku, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                  <select 
                    value={newSku.category}
                    onChange={(e) => setNewSku({...newSku, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Energy Drink">Energy Drink</option>
                    <option value="Water">Water</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Units Per Case</label>
                  <input 
                    type="number" 
                    value={newSku.units_per_case}
                    onChange={(e) => setNewSku({...newSku, units_per_case: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Case Sale Price (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.price_per_case}
                    onChange={(e) => setNewSku({...newSku, price_per_case: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">COGS Per Case (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.cogs_per_case}
                    onChange={(e) => setNewSku({...newSku, cogs_per_case: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddSkuModalOpen(false)}
                  className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                >
                  Create SKU
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-emerald-600 p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Register New Supplier</h3>
            </div>
            
            <form onSubmit={handleAddSupplier} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier Name</label>
                  <input 
                    required
                    type="text" 
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Contact Person</label>
                  <input 
                    type="text" 
                    value={newSupplier.contact_person}
                    onChange={(e) => setNewSupplier({...newSupplier, contact_person: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Phone</label>
                  <input 
                    type="text" 
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Email</label>
                  <input 
                    type="email" 
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Address</label>
                  <input 
                    type="text" 
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
                >
                  Finish Registration
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
