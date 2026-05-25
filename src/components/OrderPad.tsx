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
  ChevronRight,
  X,
  HelpCircle,
  UserPlus,
  Edit2,
  Check,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceTemplate } from './InvoiceTemplate';
import { triggerPrint } from '../lib/printUtils';
import { formatDate } from '../lib/dateUtils';

interface SKU {
  id: number;
  name: string;
  category: string;
  price_per_case: number;
  price_per_unit: number;
  units_per_case: number;
  batch_number?: string;
  expiry_date?: string;
}

interface Customer {
  id: number;
  name: string;
  shop_name?: string;
  route: string;
  contact?: string;
  credit_limit: number;
  balance: number;
  is_filer: number;
  discount_pc: number;
}

interface OrderItem {
  sku: SKU;
  cases: number;
  units: number;
}

interface QueuedOrder {
  customer: {
    name: string;
    route: string;
    contact?: string;
  } | null;
  items: OrderItem[];
  total: number;
  invoiceNo: string;
  date: string;
  orderBooker?: string;
  deliveryMan?: string;
  is_dummy?: number;
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
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [queuedOrders, setQueuedOrders] = useState<QueuedOrder[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const t = {
    title: isUrdu ? 'بیچ انوائسنگ' : 'BATCH INVOICING',
    subtitle: isUrdu ? 'براہ راست ڈیسک انٹری • ملٹی رو موڈ' : 'Direct Desk Entry • Multi-Row Mode',
    customerAccount: isUrdu ? 'صارف کا اکاؤنٹ' : 'Customer Account',
    dummyMode: isUrdu ? 'ڈمی موڈ' : 'Dummy Mode',
    pricingLedger: isUrdu ? 'قیمت کا لیجر' : 'Pricing Ledger',
    credit: isUrdu ? 'ادھار' : 'Credit',
    limitExceeded: isUrdu ? 'حد سے تجاوز' : 'LIMIT EXCEEDED',
    balance: isUrdu ? 'بقایا' : 'Bal',
    skuName: isUrdu ? 'آئٹم کا نام' : 'SKU / Package Name',
    cases: isUrdu ? 'کیسز' : 'Cases',
    units: isUrdu ? 'یونٹس' : 'Units',
    amount: isUrdu ? 'رقم' : 'Amount',
    beginLine: isUrdu ? 'نئی لائن شروع کریں' : 'Begin New Line',
    nextLine: isUrdu ? 'اگلی لائن' : 'Next Line',
    subtotal: isUrdu ? 'ذیلی کل' : 'Subtotal',
    discount: isUrdu ? 'رعایت' : 'Discount',
    total: isUrdu ? 'کل رقم' : 'Total',
    discard: isUrdu ? 'ختم کریں' : 'Discard',
    preview: isUrdu ? 'پریویو' : 'Preview',
    commitPrint: isUrdu ? 'محفوظ کریں' : 'Save',
    syncing: isUrdu ? 'سنک ہو رہا ہے...' : 'Syncing...',
    invoicedPrinted: isUrdu ? 'محفوظ ہو گیا' : 'Saved Successfully',
    searchItem: isUrdu ? 'آئٹم تلاش کریں...' : 'Search Item...',
    chooseRep: isUrdu ? '-- سیلز نمائندہ منتخب کریں --' : '-- Choose Commercial Representative --',
    previewSlip: isUrdu ? 'عارضی سلپ / پریویو' : 'DRAFT / PREVIEW SLIP',
    docPreview: isUrdu ? 'دستاویز کا پیش نظارہ' : 'Document Preview',
    verifyInfo: isUrdu ? 'محفوظ کرنے سے پہلے معلومات کی تصدیق کریں' : 'Verify information before saving',
    closePreview: isUrdu ? 'پریویو بند کریں' : 'Close Preview',
    directPrint: isUrdu ? 'براہ راست پرنٹ' : 'Direct Print Now',
    help: isUrdu ? 'مدد' : 'Help'
  };

  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [skusRes, custRes, salesRes] = await Promise.all([
          fetch('/api/skus'),
          fetch('/api/customers'),
          fetch('/api/salesmen')
        ]);
        
        const skusData = await skusRes.json();
        const custData = await custRes.json();
        const salesData = await salesRes.json();

        setSkus(Array.isArray(skusData) ? skusData : []);
        setCustomers(Array.isArray(custData) ? custData : []);
        if (Array.isArray(salesData) && salesData.length > 0) {
          setSalesman(salesData[0]);
        }
      } catch (err) {
        console.error("Failed to fetch OrderPad data", err);
      }
    };
    fetchData();
  }, []);

  const safeCustomers = Array.isArray(customers) ? customers : [];
  const routes = ['All', ...Array.from(new Set(safeCustomers.map(c => c.route).filter(Boolean)))];
  const filteredCustomers = safeCustomers.filter(c => {
    const matchesRoute = selectedRoute === 'All' || c.route === selectedRoute;
    const matchesSearch = !customerSearchQuery || 
      (c.name || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.shop_name || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.contact || '').toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      (c.route || '').toLowerCase().includes(customerSearchQuery.toLowerCase());
    return matchesRoute && matchesSearch;
  });

  const safeSkus = Array.isArray(skus) ? skus : [];
  const filteredSkus = safeSkus.filter(sku => 
    (sku.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (sku.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    ((sku as any).supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToQueue = () => {
    if (cart.length === 0) return;
    const newOrder: QueuedOrder = {
      customer: selectedCustomer ? {
        name: selectedCustomer.name,
        route: selectedCustomer.route,
        contact: selectedCustomer.contact
      } : null,
      items: [...cart],
      total: total,
      invoiceNo: isDummy ? `DUMMY-${Math.floor(Date.now() / 1000)}` : Math.floor(Date.now() / 1000).toString(),
      date: formatDate(new Date()),
      orderBooker: salesman?.name || 'Manager',
      deliveryMan: "AFM"
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

  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [lastOrderDetails, setLastOrderDetails] = useState<QueuedOrder | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [customerForm, setCustomerForm] = useState({
    name: '',
    shop_name: '',
    route: '',
    contact: '',
    balance: 0,
    credit_limit: 500000,
    discount_pc: 0
  });

  const handleSaveCustomer = async () => {
    if (!customerForm.name || !customerForm.route) return;
    
    try {
      const endpoint = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerForm)
      });
      
      if (response.ok) {
        // Refresh customer list
        const res = await fetch('/api/customers');
        const data = await res.json();
        setCustomers(data);
        setShowCustomerModal(false);
        setEditingCustomer(null);
        setCustomerForm({ name: '', shop_name: '', route: '', contact: '', balance: 0, credit_limit: 500000, discount_pc: 0 });
      }
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const openEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditingCustomer(selectedCustomer);
    setCustomerForm({
      name: selectedCustomer.name,
      shop_name: selectedCustomer.shop_name || '',
      route: selectedCustomer.route,
      contact: selectedCustomer.contact || '',
      balance: selectedCustomer.balance,
      credit_limit: selectedCustomer.credit_limit,
      discount_pc: selectedCustomer.discount_pc
    });
    setShowCustomerModal(true);
  };

  const calculateRowTotal = (item: OrderItem) => {
    return (item.cases * item.sku.price_per_case) + (item.units * item.sku.price_per_unit);
  };

  const calculateTotal = () => {
    const subtotal = cart.reduce((acc, item) => acc + calculateRowTotal(item), 0);
    const discountAmount = selectedCustomer ? (subtotal * (selectedCustomer.discount_pc || 0) / 100) : 0;
    const finalTotal = subtotal - discountAmount;
    return { subtotal, discountAmount, total: finalTotal };
  };

  const { subtotal, discountAmount, total } = calculateTotal();
  const isOverLimit = selectedCustomer ? (selectedCustomer.balance + total > selectedCustomer.credit_limit) : false;

  const addNewRow = () => {
    setCart([...cart, { 
      sku: { id: 0, name: '', category: '', price_per_case: 0, price_per_unit: 0, units_per_case: 0 }, 
      cases: 0, 
      units: 0 
    }]);
  };

  const updateCartRow = (index: number, field: keyof OrderItem | 'sku_id', value: any) => {
    const newCart = [...cart];
    if (field === 'sku_id') {
      const sku = skus.find(s => s.id === Number(value));
      if (sku) {
        newCart[index] = { ...newCart[index], sku, cases: 0, units: 1 };
      }
    } else {
      (newCart[index] as any)[field] = value;
    }
    setCart(newCart);
  };

  const removeRow = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        addNewRow();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        if (selectedCustomer && cart.length > 0 && !(isOverLimit && !isDummy)) {
          submitOrder();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCustomer, cart, isOverLimit, isDummy]);

  const submitOrder = async () => {
    const validItems = cart.filter(i => i.sku.id !== 0 && (i.cases > 0 || i.units > 0));
    if (!selectedCustomer || validItems.length === 0 || (isOverLimit && !isDummy)) return;

    setIsSyncing(true);
    const orderData = {
      customer_id: selectedCustomer.id,
      salesman_id: salesman?.id,
      total_amount: total,
      tax_amount: 0,
      further_tax: 0,
      is_dummy: isDummy ? 1 : 0,
      items: validItems.map(i => ({
        sku_id: i.sku.id,
        cases: i.cases,
        units: i.units,
        price: calculateRowTotal(i)
      }))
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (res.ok) {
      const { orderId } = await res.json();
      setLastOrderId(orderId);
      setLastOrderDetails({
        customer: selectedCustomer ? {
          name: selectedCustomer.name,
          route: selectedCustomer.route,
          contact: selectedCustomer.contact
        } : null,
        items: [...validItems],
        total: total,
        invoiceNo: isDummy ? `DUMMY-${orderId}` : orderId.toString(),
        date: formatDate(new Date()),
        orderBooker: salesman?.name || 'Manager',
        deliveryMan: "AFM",
        is_dummy: isDummy ? 1 : 0
      });

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

  const previewOrder = () => {
    if (!selectedCustomer || cart.length === 0) return;
    const tempOrder: QueuedOrder = {
      customer: selectedCustomer ? {
        name: selectedCustomer.name,
        route: selectedCustomer.route,
        contact: selectedCustomer.contact
      } : null,
      items: cart.filter(i => i.sku.id !== 0 && (i.cases > 0 || i.units > 0)),
      total: total,
      invoiceNo: isDummy ? `DUMMY-${Math.floor(Date.now() / 1000)}` : "PREVIEW-" + Math.floor(Date.now() / 1000),
      date: formatDate(new Date()),
      orderBooker: salesman?.name || 'Manager',
      deliveryMan: "AFM",
      is_dummy: isDummy ? 1 : 0
    };
    setLastOrderDetails(tempOrder);
    setShowPreviewModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4">
      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowHelp(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
             >
               <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className={`font-black text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>{t.help}</h3>
                  <button onClick={() => setShowHelp(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
                  <div className="space-y-4 text-xs text-slate-650 font-medium leading-relaxed">
                    <p className="font-extrabold text-slate-800 text-sm">{isUrdu ? 'بیچ انوائسنگ آسان ہدایات:' : 'Quick Desk Book Instructions:'}</p>
                    <ul className="list-decimal list-inside space-y-2">
                      <li>{isUrdu ? 'پہلے گاہک یا سیلز مین کا انتخاب کریں۔' : 'Select a Customer or Salesman first.'}</li>
                      <li>{isUrdu ? '"اگلی لائن" بٹن دبائیں اور سامان کا نام منتخب کریں۔' : 'Click "Next Line" and choose product SKUs.'}</li>
                      <li>{isUrdu ? 'کیسز اور یونٹس کی مقدار درج کریں۔' : 'Add Case and Unit loose quantities.'}</li>
                      <li>{isUrdu ? '"محفوظ کریں" دبا کر انوائس کو مکمل کریں!' : 'Click "Save" to complete the invoice!'}</li>
                    </ul>
                  </div>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Customer Modal */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomerModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-black text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>
                  {editingCustomer 
                    ? (isUrdu ? 'صارف کی معلومات اپ ڈیٹ کریں' : 'Update Customer Info')
                    : (isUrdu ? 'نیا گاہک شامل کریں' : 'Register New Customer')}
                </h3>
                <button onClick={() => setShowCustomerModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? 'گاہک کا نام' : 'Full Name'}
                  </label>
                  <input 
                    type="text"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({...customerForm, name: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="e.g. Abdullah Khan"
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
                    {isUrdu ? 'دکان کا نام' : 'Shop Name'}
                  </label>
                  <input 
                    type="text"
                    value={customerForm.shop_name}
                    onChange={(e) => setCustomerForm({...customerForm, shop_name: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="e.g. Swat General Store"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
                      {isUrdu ? 'روٹ' : 'Route / Area'}
                    </label>
                    <input 
                      type="text"
                      value={customerForm.route}
                      onChange={(e) => setCustomerForm({...customerForm, route: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                      placeholder="e.g. Kokarai"
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 ${isUrdu ? 'font-urdu' : ''}`}>
                      {isUrdu ? 'فون نمبر' : 'Phone'}
                    </label>
                    <input 
                      type="text"
                      value={customerForm.contact}
                      onChange={(e) => setCustomerForm({...customerForm, contact: e.target.value})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10"
                      placeholder="03xx-xxxxxxx"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setShowCustomerModal(false)}
                  className={`flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isUrdu ? 'font-urdu' : ''}`}
                >
                  {isUrdu ? 'منسوخ' : 'Cancel'}
                </button>
                <button 
                  onClick={handleSaveCustomer}
                  className={`flex-[2] py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg ${isUrdu ? 'font-urdu' : ''}`}
                >
                  {isUrdu ? 'محفوظ کریں' : 'Save Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreviewModal && lastOrderDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPreviewModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-black uppercase tracking-widest text-slate-900 ${isUrdu ? 'font-urdu' : ''}`}>{t.docPreview}</h3>
                    <p className={`text-[10px] text-slate-500 font-bold uppercase tracking-widest ${isUrdu ? 'font-urdu' : ''}`}>{t.verifyInfo}</p>
                  </div>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/50">
                <div className="bg-white shadow-lg mx-auto w-full max-w-[210mm] border border-slate-200 rounded-lg">
                  <InvoiceTemplate order={lastOrderDetails} salesmanName={salesman?.name || 'Manager'} type={t.previewSlip} isUrdu={isUrdu} />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-white flex gap-4">
                 <button onClick={() => setShowPreviewModal(false)} className={`flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest ${isUrdu ? 'font-urdu' : ''}`}>{t.closePreview}</button>
                 <button 
                   onClick={() => {
                     setShowPreviewModal(false);
                     triggerPrint();
                   }}
                   className={`flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}
                 >
                   <Printer className="w-4 h-4" /> {t.directPrint}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="print-only bg-white">
        {lastOrderDetails && (
          <InvoiceTemplate order={lastOrderDetails} salesmanName={salesman?.name || 'Manager'} isUrdu={isUrdu} />
        )}
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 no-print relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-accent shadow-xl">
             <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <h1 className={`text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}>
              {!isUrdu ? (
                <>BATCH <span className="text-primary italic">INVOICING</span></>
              ) : (
                t.title
              )}
            </h1>
            <p className={`text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] mt-1 italic ${isUrdu ? 'font-urdu' : ''}`}>{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
             onClick={() => setShowHelp(true)}
             className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary transition-colors shadow-sm"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              type="button"
              onClick={() => setIsUrdu(false)} 
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer relative z-20 ${!isUrdu ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EN
            </button>
            <button 
              type="button"
              onClick={() => setIsUrdu(true)} 
              className={`px-6 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all cursor-pointer relative z-20 ${isUrdu ? 'bg-white text-slate-900 shadow-md font-urdu' : 'text-slate-400 hover:text-slate-600'}`}
            >
              اردو
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 no-print">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="flex-1 w-full">
            <label className={`text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ${isUrdu ? 'font-urdu' : ''}`}>{t.customerAccount}</label>
            
            {/* Route Selection & Customer Search Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Route Selector Dropdown */}
              <div className="relative">
                <select
                  value={selectedRoute}
                  onChange={(e) => {
                    setSelectedRoute(e.target.value);
                    // Reset selected customer if they don't belong to the new route
                    if (e.target.value !== 'All' && selectedCustomer && selectedCustomer.route !== e.target.value) {
                      setSelectedCustomer(null);
                    }
                  }}
                  className="w-full pl-4 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all cursor-pointer"
                >
                  <option value="All">🗺️ {isUrdu ? 'تمام روٹس' : 'All Routes'}</option>
                  {routes.filter(r => r !== 'All').map(r => (
                    <option key={r} value={r}>📍 {r}</option>
                  ))}
                </select>
              </div>

              {/* Customer Search Filter */}
              <div className="relative md:col-span-2">
                <input
                  type="text"
                  placeholder={isUrdu ? 'صارف کا نام / دکان یا فون تلاش کریں...' : '🔍 Search customer by name, shop or phone...'}
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                />
                {customerSearchQuery && (
                  <button 
                    onClick={() => setCustomerSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  onChange={(e) => setSelectedCustomer(filteredCustomers.find(c => c.id === Number(e.target.value)) || null)}
                  className={`w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none ${isUrdu ? 'font-urdu' : ''}`}
                  value={selectedCustomer?.id || ''}
                >
                  <option value="">
                    {isUrdu 
                      ? `-- صارفین کی فہرست (${filteredCustomers.length} دستیاب) --` 
                      : `-- Choose Customer (${filteredCustomers.length} matching) --`}
                  </option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.shop_name ? `[${c.shop_name}]` : ''} • {c.route}
                    </option>
                  ))}
                </select>
              </div>
              <button 
                 onClick={() => {
                   setEditingCustomer(null);
                   setCustomerForm({ name: '', shop_name: '', route: '', contact: '', balance: 0, credit_limit: 500000, discount_pc: 0 });
                   setShowCustomerModal(true);
                 }}
                 className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-primary shadow-sm hover:bg-primary hover:text-white transition-all shrink-0"
                 title="Register New Customer"
              >
                <UserPlus className="w-5 h-5" />
              </button>
              {selectedCustomer && (
                <button 
                  onClick={openEditCustomer}
                  className="w-14 h-14 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 shadow-sm hover:text-primary transition-all shrink-0"
                  title="Edit Selected Customer"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 border-l border-slate-100 pl-6">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${isDummy ? 'bg-amber-500' : 'bg-slate-200'}`} onClick={() => setIsDummy(!isDummy)}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isDummy ? 'translate-x-6' : ''}`} />
            </div>
            <span className={`text-[9px] font-black uppercase text-slate-400 tracking-widest ${isUrdu ? 'font-urdu' : ''}`}>{t.dummyMode}</span>
          </div>
        </div>

        {/* The Grid */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[400px]">
          <div className="bg-slate-900 p-4 px-6 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
               <Package className="w-5 h-5 text-accent" />
               <h3 className={`text-sm font-black uppercase tracking-widest ${isUrdu ? 'font-urdu' : ''}`}>{t.pricingLedger}</h3>
            </div>
            {selectedCustomer && (
              <div className="text-right">
                 <p className={`text-[9px] uppercase font-black text-slate-400 leading-none ${isUrdu ? 'font-urdu' : ''}`}>{t.credit}</p>
                 <p className={`text-xs font-bold ${isOverLimit && !isDummy ? 'text-rose-400' : 'text-emerald-400'} ${isUrdu ? 'font-urdu' : ''}`}>
                   {isOverLimit && !isDummy ? t.limitExceeded : `${t.balance}: Rs. ${selectedCustomer.balance.toLocaleString()}`}
                 </p>
              </div>
            )}
          </div>

          {/* Desktop view table */}
          <div className="hidden md:block flex-1 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className={`bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-100 ${isUrdu ? 'font-urdu' : ''}`}>
                  <th className="p-4 w-12 text-center text-slate-300">#</th>
                  <th className="p-4 text-left">{t.skuName}</th>
                  <th className="p-4 text-center">{t.units}</th>
                  <th className="p-4 text-right pr-6">{t.amount}</th>
                  <th className="p-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <button onClick={addNewRow} className={`px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${isUrdu ? 'font-urdu' : ''}`}>{t.beginLine}</button>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 text-center text-[10px] font-black text-slate-300">{idx + 1}</td>
                      <td className="p-2">
                        <select 
                          className={`w-full bg-slate-100/50 border-0 rounded-xl p-3 text-sm font-bold outline-none ${isUrdu ? 'font-urdu text-right' : ''}`}
                          value={item.sku.id || ''}
                          onChange={(e) => updateCartRow(idx, 'sku_id', e.target.value)}
                        >
                          <option value="">{t.searchItem}</option>
                          {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input 
                          type="number"
                          placeholder="0"
                          value={item.units || ''}
                          onChange={(e) => updateCartRow(idx, 'units', Number(e.target.value))}
                          className="w-full bg-slate-100/50 border-0 rounded-xl p-3 text-center text-sm font-bold outline-none"
                        />
                      </td>
                      <td className="p-2 text-right pr-6 font-black text-slate-900 text-sm italic">
                        Rs. {calculateRowTotal(item).toLocaleString()}
                      </td>
                      <td className="p-2 text-center text-slate-200">
                        <button onClick={() => removeRow(idx)} className="hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile view card stack */}
          <div className="block md:hidden divide-y divide-slate-150">
            {cart.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <p className="text-xs font-bold uppercase mb-4">Your order draft is empty</p>
                <button 
                  onClick={addNewRow} 
                  className={`px-6 py-3.5 bg-slate-900 text-accent rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all ${isUrdu ? 'font-urdu' : ''}`}
                >
                  {t.beginLine}
                </button>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="p-5 space-y-4 hover:bg-slate-50/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">Line #{idx + 1}</span>
                    <button 
                      onClick={() => removeRow(idx)} 
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.skuName}</label>
                    <select 
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-base font-bold outline-none focus:ring-2 focus:ring-primary/10 ${isUrdu ? 'font-urdu text-right' : ''}`}
                      value={item.sku.id || ''}
                      onChange={(e) => updateCartRow(idx, 'sku_id', e.target.value)}
                    >
                      <option value="">{t.searchItem}</option>
                      {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.units}</label>
                    <input 
                      type="number"
                      placeholder="Pieces"
                      value={item.units || ''}
                      onChange={(e) => updateCartRow(idx, 'units', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-base font-bold outline-none font-mono focus:ring-2 focus:ring-primary/10"
                    />
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.amount}</span>
                    <span className="font-mono text-sm font-black text-slate-900">
                      Rs. {calculateRowTotal(item).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
            <button onClick={addNewRow} className={`flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ${isUrdu ? 'font-urdu' : ''}`}>
              <Plus className="w-4 h-4" /> {t.nextLine}
            </button>

            <div className="w-full md:w-80 bg-slate-900 text-white rounded-3xl p-6 shadow-2xl">
               <div className="space-y-1">
                  <div className={`flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none ${isUrdu ? 'font-urdu' : ''}`}>
                    <span>{t.subtotal}</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className={`flex justify-between text-[9px] font-black text-emerald-400 uppercase tracking-widest ${isUrdu ? 'font-urdu' : ''}`}>
                      <span>{t.discount} ({selectedCustomer?.discount_pc}%)</span>
                      <span>- Rs. {discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className={`pt-2 mt-2 border-t border-white/10 flex justify-between items-center ${isUrdu ? 'font-urdu' : ''}`}>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.total}</span>
                    <span className="text-2xl font-black text-accent italic leading-none">{total.toLocaleString()}</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3">
             <div className="flex gap-3 w-full sm:flex-1">
               <button 
                 onClick={() => {
                   if (confirm(isUrdu ? "آیا آپ واقعی مسودہ ختم کرنا چاہتے ہیں؟" : "Discard draft and reset all fields?")) {
                    setCart([]);
                    setSelectedCustomer(null);
                   }
                 }} 
                 className={`flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 transition-colors ${isUrdu ? 'font-urdu' : ''}`}
               >
                 {t.discard}
               </button>
               <button 
                 onClick={previewOrder}
                 disabled={!selectedCustomer || cart.length === 0}
                 className={`flex-1 py-4 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                   !selectedCustomer || cart.length === 0 
                    ? 'bg-slate-50 text-slate-200' 
                    : 'bg-white text-slate-900 hover:border-slate-400'
                 } ${isUrdu ? 'font-urdu' : ''}`}
               >
                 <Printer className="w-4 h-4" /> {t.preview}
               </button>
             </div>
             <button 
               onClick={submitOrder}
               disabled={!selectedCustomer || cart.length === 0 || (isOverLimit && !isDummy)}
               className={`w-full sm:flex-[2] py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl ${
                 !selectedCustomer || cart.length === 0 || (isOverLimit && !isDummy)
                   ? 'bg-slate-100 text-slate-300'
                   : isDummy ? 'bg-amber-500 text-white' : 'bg-primary text-white hover:scale-[1.02]'
               } ${isUrdu ? 'font-urdu' : ''}`}
             >
               {success ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-4 h-4" />}
               {success ? t.invoicedPrinted : isSyncing ? t.syncing : t.commitPrint}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
