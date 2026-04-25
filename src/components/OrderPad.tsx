import { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  MapPin, 
  User, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Smartphone,
  CreditCard,
  AlertCircle,
  Package,
  Printer,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceTemplate } from './InvoiceTemplate';

interface SKU {
  id: number;
  name: string;
  category: string;
  price_per_case: number;
  price_per_unit: number;
  units_per_case: number;
}

interface Customer {
  id: number;
  name: string;
  route: string;
  credit_limit: number;
  balance: number;
  is_filer: number;
}

interface OrderItem {
  sku: SKU;
  cases: number;
  units: number;
}

interface QueuedOrder {
  customer: Customer | null;
  items: OrderItem[];
  total: number;
  invoiceNo: string;
  date: string;
}

export default function OrderPad() {
  const [isUrdu, setIsUrdu] = useState(false);
  const [isDummy, setIsDummy] = useState(false);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('All');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [salesman, setSalesman] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [queuedOrders, setQueuedOrders] = useState<QueuedOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const t = {
    title: isUrdu ? 'ڈیجیٹل آرڈرنگ' : 'Digital Invoicing & Orders',
    dummyMode: isUrdu ? 'ڈمی موڈ' : 'Dummy Mode',
    limitExceeded: isUrdu ? 'حد سے تجاوز' : 'EXCEEDS LIMIT',
    gst: isUrdu ? 'جی ایس ٹی (١٨٪)' : 'GST (18%)',
    furtherTax: isUrdu ? 'اضافی ٹیکس (٤٪)' : 'Further Tax (4%)',
    total: isUrdu ? 'کل رقم' : 'Total Payable'
  };

  useEffect(() => {
    fetch('/api/skus').then(res => res.json()).then(setSkus);
    fetch('/api/customers').then(res => res.json()).then(setCustomers);
    fetch('/api/salesmen').then(res => res.json()).then(data => setSalesman(data[0]));
  }, []);

  const calculateTotal = () => {
    const subtotal = cart.reduce((acc, item) => acc + (item.cases * item.sku.price_per_case) + (item.units * item.sku.price_per_unit), 0);
    return { subtotal, total: subtotal };
  };

  const { subtotal, total } = calculateTotal();
  const isOverLimit = selectedCustomer ? (selectedCustomer.balance + total > selectedCustomer.credit_limit) : false;

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' or Alt+S
      if ((e.key === '/' || (e.altKey && e.key === 's')) && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('sku-search')?.focus();
      }
      // Focus customer on Alt+C
      if (e.altKey && e.key === 'c') {
        e.preventDefault();
        document.getElementById('customer-select')?.focus();
      }
      // Submit on Ctrl+Enter
      if (e.ctrlKey && e.key === 'Enter') {
        if (selectedCustomer && cart.length > 0 && !(isOverLimit && !isDummy)) {
          submitOrder();
        }
      }
      // Queue on Alt+Q
      if (e.altKey && e.key === 'q') {
        if (cart.length > 0) {
          addToQueue();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCustomer, cart, isOverLimit, isDummy]);

  const routes = ['All', ...new Set(customers.map(c => c.route))];
  const filteredCustomers = selectedRoute === 'All' 
    ? customers 
    : customers.filter(c => c.route === selectedRoute);

  const filteredSkus = skus.filter(sku => 
    sku.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sku.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (sku: SKU) => {
    setCart(prev => {
      const existing = prev.find(i => i.sku.id === sku.id);
      if (existing) return prev;
      return [...prev, { sku, cases: 1, units: 0 }];
    });
  };

  const updateCart = (skuId: number, field: 'cases' | 'units', delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.sku.id === skuId) {
        const newVal = Math.max(0, (item[field] as number) + delta);
        return { ...item, [field]: newVal };
      }
      return item;
    }).filter(i => i.cases > 0 || i.units > 0));
  };

  const addToQueue = () => {
    if (cart.length === 0) return;
    const newOrder: QueuedOrder = {
      customer: selectedCustomer,
      items: [...cart],
      total: total,
      invoiceNo: isDummy ? `DUMMY-${Math.floor(Date.now() / 1000)}` : Math.floor(Date.now() / 1000).toString(),
      date: new Date().toLocaleDateString()
    };
    setQueuedOrders(prev => [...prev, newOrder]);
    setCart([]);
    setSelectedCustomer(null);
  };

  const clearQueue = () => {
    if (confirm("Are you sure you want to clear the print queue?")) {
      setQueuedOrders([]);
    }
  };

  const submitOrder = async () => {
    if (!selectedCustomer || cart.length === 0 || (isOverLimit && !isDummy)) return;

    setIsSyncing(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: selectedCustomer.id,
        salesman_id: salesman?.id,
        total_amount: total,
        tax_amount: 0,
        further_tax: 0,
        is_dummy: isDummy ? 1 : 0,
        items: cart.map(i => ({
          sku_id: i.sku.id,
          cases: i.cases,
          units: i.units,
          price: (i.cases * i.sku.price_per_case) + (i.units * i.sku.price_per_unit)
        }))
      })
    });

    if (res.ok) {
      setSuccess(true);
      setCart([]);
      setSelectedCustomer(null);
      setTimeout(() => {
        setSuccess(false);
        setIsSyncing(false);
      }, 3000);
    } else {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Print-Only Professional Invoice Template (Dual Layout for Cost Cutting) */}
      <div className="print-only bg-white">
        {queuedOrders.length > 0 ? (
          queuedOrders.map((q, idx) => (
            <InvoiceTemplate key={idx} order={q} salesmanName={salesman?.name || 'Manager'} />
          ))
        ) : (
          <InvoiceTemplate salesmanName={salesman?.name || 'Manager'} order={{
            customer: selectedCustomer,
            items: cart,
            total: total,
            invoiceNo: "PROVISIONAL",
            date: new Date().toLocaleDateString()
          }} />
        )}
      </div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print">
        <div>
          <h1 className={`text-2xl font-bold text-text tracking-tight uppercase ${isUrdu ? 'font-urdu' : ''}`}>
            {t.title}
          </h1>
          <p className="text-text-muted font-medium text-sm">
            {isUrdu ? 'سوات ڈسٹریبیوشن مینجمنٹ سسٹم - ڈیجیٹل آرڈرنگ' : 'Direct order entry for desk use or salesman digital pad.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setIsUrdu(!isUrdu)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black tracking-widest uppercase transition-all ${isUrdu ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
            >
              اردو
            </button>
            <button 
              onClick={() => setIsUrdu(!isUrdu)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black tracking-widest uppercase transition-all ${!isUrdu ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500'}`}
            >
              EN
            </button>
          </div>
          
          <div className="bg-primary text-white p-3 rounded-xl border border-white/10 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-accent'} flex items-center justify-center`}>
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 leading-none">
                {isSyncing ? (isUrdu ? 'سنک ہو رہا ہے' : 'Syncing...') : (isUrdu ? 'لاگ ان' : 'Logged In')}
              </p>
              <p className="text-xs font-bold text-white mt-0.5">{salesman?.name || 'Manager'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print">
      {/* Left Column: Customer & SKU Selection */}
      <div className="space-y-6">
        <div className="erp-card border-l-4 border-l-primary">
          <div className="card-title flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Select Customer & Route
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Route Grouping</label>
              <div className="flex flex-wrap gap-2">
                {routes.map(r => (
                  <button 
                    key={r}
                    onClick={() => setSelectedRoute(r)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                      selectedRoute === r 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Customer Name</label>
              <select 
                id="customer-select"
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === Number(e.target.value)) || null)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none"
                value={selectedCustomer?.id || ''}
              >
                <option value="">Select a customer...</option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.route})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="erp-card">
          <div className="card-title flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              SKU Inventory
            </div>
            <div className="relative">
              <input 
                id="sku-search"
                type="text" 
                placeholder="Search SKUs... (/)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-accent w-32 md:w-48 transition-all"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {filteredSkus.map(sku => (
              <div key={sku.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition-all group">
                <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-1">{sku.category}</p>
                <h4 className="font-bold text-slate-900 text-sm">{sku.name}</h4>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500">
                    Rs. {sku.price_per_case.toLocaleString()} / Case
                  </div>
                  <button 
                    onClick={() => addToCart(sku)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Order Cart */}
      <div className="space-y-6">
        <div className="erp-card !p-0 overflow-hidden sticky top-24">
          <div className="bg-primary text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-accent" />
                <h3 className="text-xl font-bold tracking-tight">Digital Order Pad</h3>
              </div>
              <div className="flex items-center gap-4">
                {queuedOrders.length > 0 && (
                  <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                    <button 
                      onClick={() => {
                        try {
                          window.print();
                        } catch (e) {
                          alert("Use 'Open Full Application' to print the queue.");
                        }
                      }}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white transition-all flex items-center gap-2 text-xs font-bold print-visible"
                    >
                      <Printer className="w-3 h-3" />
                      Print Queue ({queuedOrders.length})
                    </button>
                    <button 
                      onClick={clearQueue}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500 rounded-lg text-white transition-all"
                      title="Clear Queue"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {cart.length > 0 && (
                  <button 
                    onClick={() => {
                      try {
                        window.print();
                      } catch (e) {
                        alert("Printing may be restricted in this preview. Please click 'Open in New Tab' at the top right of the screen to print your invoice.");
                      }
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all flex items-center gap-2 text-xs font-bold print-visible"
                    title="Print Invoice"
                  >
                    <Printer className="w-4 h-4" />
                    Print Now
                  </button>
                )}
                <div className="text-right">
                  <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Salesman</p>
                  <p className="text-sm font-bold">{salesman?.name || 'Loading...'}</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 pb-2 no-print">
              <details className="group border border-white/10 rounded-lg overflow-hidden">
                <summary className="list-none flex items-center justify-between p-2 cursor-pointer bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="text-[10px] uppercase font-black tracking-widest text-white/60">Having trouble printing?</span>
                  <ChevronRight className="w-3 h-3 text-white/40 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="p-3 bg-black/20 text-[11px] text-white/80 leading-relaxed shadow-inner">
                  <p>In this preview, the browser blocks the print window. To print:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Look at the <strong>Orange Header</strong> at the top of the screen.</li>
                    <li>Click the <strong>"OPEN FULL APPLICATION"</strong> button.</li>
                    <li>In the new tab that opens, your <strong>Print</strong> buttons will work perfectly!</li>
                  </ol>
                </div>
              </details>
            </div>
          </div>

          <div className="p-6 space-y-6 min-h-[400px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <Smartphone className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">Order cart is empty</p>
                <p className="text-xs">Add items from the SKU list to begin</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.sku.id} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm">{item.sku.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                        {item.sku.price_per_case} / {item.sku.price_per_unit}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Cases</span>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                          <button onClick={() => updateCart(item.sku.id, 'cases', -1)} className="hover:text-rose-500"><Minus className="w-3 h-3" /></button>
                          <span className="w-6 text-center text-xs font-bold">{item.cases}</span>
                          <button onClick={() => updateCart(item.sku.id, 'cases', 1)} className="hover:text-emerald-500"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Units</span>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                          <button onClick={() => updateCart(item.sku.id, 'units', -1)} className="hover:text-rose-500"><Minus className="w-3 h-3" /></button>
                          <span className="w-6 text-center text-xs font-bold">{item.units}</span>
                          <button onClick={() => updateCart(item.sku.id, 'units', 1)} className="hover:text-emerald-500"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>

                      <button onClick={() => updateCart(item.sku.id, 'cases', -999)} className="text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-5 rounded-full p-1 transition-colors cursor-pointer ${isDummy ? 'bg-amber-500' : 'bg-slate-200'}`} onClick={() => setIsDummy(!isDummy)}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isDummy ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.dummyMode}</span>
              </div>
              {isDummy && <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase">Pro-forma</span>}
            </div>

            {selectedCustomer && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${isOverLimit && !isDummy ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-white border-slate-200'}`}>
                {isOverLimit && !isDummy ? <AlertCircle className="w-5 h-5" /> : <CreditCard className="w-5 h-5 text-slate-400" />}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] uppercase font-black tracking-widest opacity-70">{isUrdu ? 'کریڈٹ لمٹ' : 'Credit Standing'}</p>
                    <span className="text-[10px] font-bold uppercase">{selectedCustomer.is_filer ? 'Filer ✓' : 'Non-Filer ✗'}</span>
                  </div>
                  <p className="text-xs font-bold">
                    {isOverLimit && !isDummy ? t.limitExceeded : `${isUrdu ? 'بقیہ لمٹ' : 'Available'}: Rs. ${(selectedCustomer.credit_limit - selectedCustomer.balance).toLocaleString()}`}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1 pt-2">
              <div className="flex justify-between text-sm font-bold text-slate-900 uppercase tracking-widest">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-slate-200">
              <p className="text-sm font-bold text-slate-900 uppercase tracking-widest">{t.total}</p>
              <div className="text-right">
                <p className={`text-3xl font-black leading-none ${isDummy ? 'text-amber-600' : 'text-slate-900'}`}>{total.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Digital Invoice Generated</p>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button 
                onClick={addToQueue}
                disabled={cart.length === 0}
                className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-2 transition-all active:scale-95 ${
                  cart.length === 0
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                {isUrdu ? 'کیو میں ڈالیں' : 'Queue for Print'}
              </button>
              <button 
                disabled={!selectedCustomer || cart.length === 0 || (isOverLimit && !isDummy)}
                onClick={submitOrder}
                className={`flex-[2] py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
                  !selectedCustomer || cart.length === 0 || (isOverLimit && !isDummy)
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : isDummy ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-emerald-500 text-white hover:bg-emerald-600'
                }`}
              >
                {success ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {isUrdu ? 'ارڈر درج ہو گیا' : 'Order Logged'}
                  </>
                ) : isSyncing ? (
                  <span className="animate-pulse">{isUrdu ? 'سنک ہو رہا ہے...' : 'Syncing...'}</span>
                ) : (
                  isUrdu ? 'ارڈر سبمٹ کریں' : 'Submit Order to ERP'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
