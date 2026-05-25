import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, ShoppingBag, 
  CheckCircle2, XCircle, Clock, Printer, 
  Eye, Calendar, User, Trash2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

interface PurchaseOrderItem {
  sku_id: string;
  sku_name?: string;
  cases: number;
  units: number;
  price_per_case: number;
  price_per_unit: number;
}

interface PurchaseOrder {
  id: number;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  total_amount: number;
  status: 'Pending' | 'Received' | 'Cancelled';
  notes: string;
  items?: PurchaseOrderItem[];
}

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Creation State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<PurchaseOrderItem[]>([
    { sku_id: '', cases: 0, units: 0, price_per_case: 0, price_per_unit: 0 }
  ]);

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchSkus();
  }, []);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/purchase-orders');
      if (res.ok) {
        setPurchaseOrders(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSkus = async () => {
    try {
      const res = await fetch('/api/skus');
      if (res.ok) setSkus(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPoDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/purchase-orders/${id}`);
      if (res.ok) {
        setSelectedPo(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSkuChange = (index: number, skuId: string) => {
    const selectedSku = skus.find(s => s.id === Number(skuId));
    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      sku_id: skuId,
      price_per_case: selectedSku ? (selectedSku.cogs_per_case || 0) : 0,
      price_per_unit: selectedSku ? (selectedSku.cogs_per_unit || 0) : 0
    };
    setCart(newCart);
  };

  const handleCartChange = (index: number, key: keyof PurchaseOrderItem, value: any) => {
    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      [key]: value
    };
    setCart(newCart);
  };

  const addCartRow = () => {
    setCart([...cart, { sku_id: '', cases: 0, units: 0, price_per_case: 0, price_per_unit: 0 }]);
  };

  const removeCartRow = (index: number) => {
    if (cart.length > 1) {
      setCart(cart.filter((_, i) => i !== index));
    } else {
      setCart([{ sku_id: '', cases: 0, units: 0, price_per_case: 0, price_per_unit: 0 }]);
    }
  };

  const calculateRowTotal = (item: PurchaseOrderItem) => {
    return (item.cases * item.price_per_case) + (item.units * item.price_per_unit);
  };

  const calculateTotalOrderAmount = () => {
    return cart.reduce((acc, item) => acc + calculateRowTotal(item), 0);
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert("Please select asupplier");
      return;
    }

    const filteredItems = cart.filter(item => item.sku_id && (item.cases > 0 || item.units > 0));
    if (filteredItems.length === 0) {
      alert("Please add at least one line item with quantity");
      return;
    }

    const total = filteredItems.reduce((acc, item) => acc + calculateRowTotal(item), 0);

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(selectedSupplierId),
          order_date: orderDate,
          total_amount: total,
          notes,
          items: filteredItems
        })
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setCart([{ sku_id: '', cases: 0, units: 0, price_per_case: 0, price_per_unit: 0 }]);
        setNotes('');
        setSelectedSupplierId('');
        fetchPurchaseOrders();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit Purchase Order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: number, status: 'Received' | 'Cancelled') => {
    const action = status === 'Received' ? 'Receive all goods and affect inventory ledger' : 'Cancel this procurement order';
    if (!confirm(`Are you sure you want to perform this action? (${action})`)) return;

    try {
      const res = await fetch(`/api/purchase-orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        fetchPurchaseOrders();
        fetchPoDetails(id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update Purchase Order");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredOrders = purchaseOrders.filter(order => 
    order.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.id.toString().includes(searchQuery)
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            PURCHASE <span className="text-amber-600 italic">ORDERS</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">
            Primelink Enterprises • Supply Chain & Procurement
          </p>
        </div>
        <button 
          onClick={() => setIsCreateOpen(true)}
          className="bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl"
        >
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
        {/* PO Lists Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by ID or Supplier..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-amber-500/10"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs font-black uppercase tracking-widest animate-pulse">
                Fetching procurement history...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl italic">
                No procurement orders found
              </div>
            ) : (
              filteredOrders.map(order => (
                <button
                  key={order.id}
                  onClick={() => fetchPoDetails(order.id)}
                  className={`w-full p-4 rounded-2xl text-left border-2 transition-all ${
                    selectedPo?.id === order.id 
                      ? 'border-amber-500 bg-amber-50/50 shadow-md scale-[1.02]' 
                      : 'border-white bg-white hover:border-slate-100 hover:bg-slate-50/50 shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-mono font-black text-slate-400">PO #{order.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${
                      order.status === 'Received' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      order.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {order.status === 'Received' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {order.status === 'Cancelled' && <XCircle className="w-2.5 h-2.5" />}
                      {order.status === 'Pending' && <Clock className="w-2.5 h-2.5" />}
                      {order.status}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 truncate">{order.supplier_name}</h3>
                  <div className="mt-4 flex justify-between items-end border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.order_date).toLocaleDateString()}
                    </div>
                    <div className="text-right">
                      <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Order Total</p>
                      <p className="text-sm font-black text-slate-900 italic">Rs. {order.total_amount.toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detailed Viewer Section */}
        <div className="lg:col-span-2">
          {selectedPo ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
              {/* PO Info Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950 text-white p-6 sm:p-8 rounded-2xl relative overflow-hidden shadow-xl">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-[#f2980b] uppercase tracking-widest">Procurement Receipt Details</p>
                  <h2 className="text-2xl sm:text-3xl font-black italic">PO #{selectedPo.id}</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{selectedPo.supplier_name}</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    onClick={handlePrint}
                    className="bg-white/10 hover:bg-white/20 border border-white/15 px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center gap-2 whitespace-nowrap select-none"
                  >
                    <Printer className="w-4 h-4" /> Print PO
                  </button>
                  
                  {selectedPo.status === 'Pending' && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus(selectedPo.id, 'Received')}
                        className="bg-[#f2980b] hover:bg-amber-600 text-[#222063] px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-lg whitespace-nowrap select-none"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Receive PO
                      </button>
                      <button 
                        onClick={() => handleUpdateStatus(selectedPo.id, 'Cancelled')}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-4.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-lg whitespace-nowrap select-none"
                      >
                        <XCircle className="w-4 h-4" /> Cancel PO
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Creation Date</span>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-450" />
                    {new Date(selectedPo.order_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Supplier Entity</span>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-450" />
                    {selectedPo.supplier_name}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">State Verification</span>
                  <span className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider ${
                    selectedPo.status === 'Received' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    selectedPo.status === 'Cancelled' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {selectedPo.status}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white p-4 font-black uppercase tracking-widest text-[9px]">
                  Procured Line Items
                </div>
                
                {/* Desktop Line Items */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150">
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU name</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cases</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Units</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Unit Price</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {selectedPo.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/20 text-xs">
                          <td className="p-4 font-extrabold text-slate-900">{item.sku_name || `SKU ID: ${item.sku_id}`}</td>
                          <td className="p-4 text-center font-mono font-bold">{item.cases}</td>
                          <td className="p-4 text-center font-mono font-bold">{item.units}</td>
                          <td className="p-4 text-right font-mono font-semibold text-slate-500">Rs. {item.price_per_unit.toLocaleString()}</td>
                          <td className="p-4 text-right font-mono font-black text-slate-900">Rs. {calculateRowTotal(item).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Line Items */}
                <div className="block sm:hidden divide-y divide-slate-100">
                  {selectedPo.items?.map((item, idx) => (
                    <div key={idx} className="p-4 space-y-2">
                      <p className="font-extrabold text-slate-900 text-xs">{item.sku_name || `SKU ID: ${item.sku_id}`}</p>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                        <span>Quantity: {item.cases} cases / {item.units} units</span>
                        <span className="font-mono text-slate-900 font-extrabold">Rs. {calculateRowTotal(item).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Summary Footer */}
                <div className="bg-slate-50 p-6 flex justify-between items-center border-t border-slate-150">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Valuation</span>
                  <div className="text-right">
                    <span className="text-lg sm:text-xl font-black text-[#222063] italic">
                      Rs. {selectedPo.total_amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {selectedPo.notes && (
                <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest block">Agent Handover Instuctions</span>
                  <p className="text-xs text-amber-900 font-bold italic">"{selectedPo.notes}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-150 text-slate-400 italic">
              <ShoppingBag className="w-12 h-12 mb-4 opacity-15 text-slate-500" />
              <p className="text-sm font-bold uppercase tracking-wide">Supply Chain Portal</p>
              <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Select a purchase order to show live records</p>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-900 p-6 text-white text-center flex-shrink-0">
                <h3 className="text-lg font-black uppercase tracking-widest text-[#f2980b]">Draft Purchase Order Form</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Primelink Enterprise Procurement Gateway</p>
              </div>
              
              <form onSubmit={handleCreatePo} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
                {/* Supplier selection & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Supplier</label>
                    <select
                      required
                      value={selectedSupplierId}
                      onChange={e => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base sm:text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                    >
                      <option value="">-- Choose Supplier Account --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.contact_person})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Order Date</label>
                    <input 
                      type="date"
                      required
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base sm:text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>
                </div>

                {/* Line items creator list */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procurement ledger lines</label>
                    <button 
                      type="button" 
                      onClick={addCartRow}
                      className="text-[9px] font-black uppercase tracking-widest text-[#222063] border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100"
                    >
                      + Add Item row
                    </button>
                  </div>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-150">
                          <th className="p-3">SKU details</th>
                          <th className="p-3 text-center w-20 sm:w-28">Cases</th>
                          <th className="p-3 text-center w-20 sm:w-28">Units</th>
                          <th className="p-3 text-right w-24">Cost</th>
                          <th className="p-3 text-right w-24">Total</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cart.map((item, index) => (
                          <tr key={index}>
                            <td className="p-2">
                              <select
                                required
                                value={item.sku_id}
                                onChange={e => handleSkuChange(index, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-base sm:text-xs font-bold outline-none"
                              >
                                <option value="">-- Choose Stock SKU --</option>
                                {skus.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} (Case COGS: {s.cogs_per_case})</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input 
                                type="number"
                                placeholder="0"
                                min="0"
                                value={item.cases || ''}
                                onChange={e => handleCartChange(index, 'cases', Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold outline-none font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <input 
                                type="number"
                                placeholder="0"
                                min="0"
                                value={item.units || ''}
                                onChange={e => handleCartChange(index, 'units', Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold outline-none font-mono"
                              />
                            </td>
                            <td className="p-2 text-right text-xs font-mono font-semibold text-slate-500">
                              Rs. {item.price_per_unit.toLocaleString()}
                            </td>
                            <td className="p-2 text-right text-xs font-mono font-extrabold text-slate-900">
                              Rs. {calculateRowTotal(item).toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              <button 
                                type="button" 
                                onClick={() => removeCartRow(index)}
                                className="text-slate-350 hover:text-rose-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Agent Handover / Delivery Instructions</label>
                  <textarea 
                    rows={2}
                    placeholder="Provide any detailed remarks about supplier terms, shipment timeline, delivery hub location..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500/10"
                  />
                </div>

                {/* Total Amount Indicator */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Purchase Valuation</span>
                  <span className="text-xl font-black text-accent italic">
                    Rs. {calculateTotalOrderAmount().toLocaleString()}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 text-center select-none"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-[2] py-4 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 select-none"
                  >
                    Submit Purchase Order
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT-ONLY AREA */}
      {selectedPo && (
        <div className="hidden print:block space-y-8 p-12 bg-white text-slate-900" style={{ fontFamily: 'Courier, monospace' }}>
          <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6">
            <h1 className="text-2xl font-black uppercase tracking-widest">PRIMELINK ENTERPRISES</h1>
            <p className="text-xs font-bold uppercase">SUPPLY CHAIN PROCUREMENT RECEIPT</p>
            <p className="text-xs">Panr Distribution Hub • Ph: +92-91-1234567</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p><strong>REPORT:</strong> PURCHASE ORDER RECEIPT</p>
              <p><strong>ORDER ID:</strong> PO #{selectedPo.id}</p>
              <p><strong>DATE:</strong> {new Date(selectedPo.order_date).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p><strong>SUPPLIER:</strong> {selectedPo.supplier_name.toUpperCase()}</p>
              <p><strong>STATUS:</strong> {selectedPo.status.toUpperCase()}</p>
              <p><strong>PRINT TIME:</strong> {new Date().toLocaleString()}</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse border-t-2 border-b-2 border-slate-900 mt-6">
            <thead>
              <tr className="border-b border-slate-900 font-bold">
                <th className="py-2">Item SKU</th>
                <th className="py-2 text-center">Cases</th>
                <th className="py-2 text-center">Units</th>
                <th className="py-2 text-right">Cogs Unit</th>
                <th className="py-2 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedPo.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="py-2">{item.sku_name || `SKU ID: ${item.sku_id}`}</td>
                  <td className="py-2 text-center">{item.cases}</td>
                  <td className="py-2 text-center">{item.units}</td>
                  <td className="py-2 text-right">Rs. {item.price_per_unit}</td>
                  <td className="py-2 text-right">Rs. {calculateRowTotal(item).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center text-sm font-bold pt-4 border-t-2 border-slate-900">
            <span>TOTAL PURCHASE VALUE:</span>
            <span>Rs. {selectedPo.total_amount.toLocaleString()}</span>
          </div>

          {selectedPo.notes && (
            <div className="text-xs border border-dashed border-slate-900 p-4 mt-6">
              <strong>DELIVERY SPECIFICATIONS:</strong>
              <p className="mt-1 italic">"{selectedPo.notes}"</p>
            </div>
          )}

          <div className="pt-20 flex justify-between text-xs text-center border-t border-slate-200 mt-20">
            <div>
              <div className="w-40 border-b border-slate-900 mx-auto h-6" />
              <p className="mt-2 text-[10px] font-bold">Supply Chain Manager</p>
            </div>
            <div>
              <div className="w-40 border-b border-slate-900 mx-auto h-6" />
              <p className="mt-2 text-[10px] font-bold">Supplier Representative</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
