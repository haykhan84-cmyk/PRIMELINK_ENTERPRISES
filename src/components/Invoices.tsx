import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Search, ShoppingBag, 
  CheckCircle2, XCircle, Clock, Printer, 
  Eye, Calendar, User, Trash2, ArrowRight,
  Wifi, WifiOff, Smartphone, Laptop, RefreshCw, Barcode,
  Percent, Hash, AlertCircle, Share2, Clipboard, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CounterSalesInvoice from './CounterSalesInvoice';
import OmniSearch from './OmniSearch';
import { compileEscPos, generateInvoicePDF, printIframeBlobUrl } from '../lib/pdfGenerator';

// Interfaces for our component
interface SKU {
  id: number;
  name: string;
  category?: string;
  price_per_case: number;
  price_per_unit: number;
  units_per_case: number;
  gst_rate: number;
  is_third_schedule?: number;
}

interface Customer {
  id: number;
  name: string;
  shop_name?: string;
  route?: string;
  territory?: string;
  contact?: string;
  balance: number;
}

interface Salesman {
  id: number;
  name: string;
  employee_id: number;
}

interface InvoiceItem {
  id?: number;
  sku_id: number;
  sku_name?: string;
  cases: number;
  units: number;
  trade_price_per_case: number;
  trade_price_per_unit: number;
  retail_price: number;
  discount_percentage: number;
  discount_amount: number;
  line_total: number;
  units_per_case?: number;
  batch_number?: string;
  expiry_date?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_shop: string;
  customer_contact?: string;
  customer_balance: number;
  salesman_id?: number;
  salesman_name?: string;
  route?: string;
  invoice_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  previous_balance: number;
  status: 'Pending' | 'Paid' | 'Cancelled';
  payment_method: 'Cash' | 'Credit';
  is_consolidated: number; // 0 = standard, 1 = child consolidated, 2 = parent consolidated
  is_batch_generated: number;
  notes?: string;
  items?: InvoiceItem[];
  childInvoices?: any[];
}

export default function Invoices() {
  // Master Lists State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);

  // UI Modes & Toggles
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'manage' | 'single' | 'batch' | 'consolidate'>('manage');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [printLayout, setPrintLayout] = useState<'standard' | 'thermal'>('standard');

  // Offline Sync Queue State
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    const saved = localStorage.getItem('erp_offline_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  // Master Data Inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit'>('Credit');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');

  // Single Invoice Creation Items State
  const [singleItems, setSingleItems] = useState<InvoiceItem[]>([
    { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
  ]);

  // Batch Invoicing State
  const [batchRoute, setBatchRoute] = useState<string>('');
  const [batchSalesmanId, setBatchSalesmanId] = useState<string>('');
  const [batchSelectedCustomers, setBatchSelectedCustomers] = useState<number[]>([]);
  const [batchItems, setBatchItems] = useState<InvoiceItem[]>([
    { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
  ]);

  // NEW Multi-Customer Batch Processing States
  const [batchMode, setBatchMode] = useState<'template' | 'bookings'>('template');
  const [filterTerritory, setFilterTerritory] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSalesmanName, setFilterSalesmanName] = useState<string>('');
  const [customerGridSearch, setCustomerGridSearch] = useState<string>('');
  
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generatedBatchInvoices, setGeneratedBatchInvoices] = useState<any[]>([]);
  const [showBatchSummary, setShowBatchSummary] = useState<boolean>(false);

  const [whatsappQueue, setWhatsappQueue] = useState<any[]>([]);
  const [whatsappProgress, setWhatsappProgress] = useState<number>(0);
  const [isWhatsappSending, setIsWhatsappSending] = useState<boolean>(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState<boolean>(false);
  const [showBulkPrintView, setShowBulkPrintView] = useState<boolean>(false);

  // Web Bluetooth Printer Pairing & Activity States
  const [bluetoothDevice, setBluetoothDevice] = useState<any>(null);
  const [printerCharacteristic, setPrinterCharacteristic] = useState<any>(null);
  const [isConnectingBluetooth, setIsConnectingBluetooth] = useState<boolean>(false);
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'sending' | 'unsupported'>('disconnected');

  // New Batch Invoicing Advanced Queue States
  const [inventory, setInventory] = useState<any[]>([]);
  const [queuedInvoices, setQueuedInvoices] = useState<any[]>([]);
  const [activeBatchCustomer, setActiveBatchCustomer] = useState<string>('');

  // LOGISTICAL HELPER METHODS FOR MULTI-CUSTOMER BATCH BILLING HUB
  const getFilteredCustomers = () => {
    return customers.filter(c => {
      if (batchRoute && c.route !== batchRoute) return false;
      if (filterTerritory && !(c.territory || '').toLowerCase().includes(filterTerritory.toLowerCase())) return false;
      if (filterCategory) {
        const desc = ((c.shop_name || '') + ' ' + (c.name || '')).toLowerCase();
        if (filterCategory === 'Wholesaler') {
          if (!desc.includes('whole') && !desc.includes('distributor') && !desc.includes('agency')) return false;
        } else if (filterCategory === 'Superstore') {
          if (!desc.includes('super') && !desc.includes('mart') && !desc.includes('store') && !desc.includes('center')) return false;
        } else if (filterCategory === 'Retailer') {
          if (desc.includes('whole') || desc.includes('distributor') || desc.includes('agency')) return false;
        }
      }
      if (customerGridSearch) {
        const norm = customerGridSearch.toLowerCase();
        const matches = (c.name || '').toLowerCase().includes(norm) || 
                        (c.shop_name || '').toLowerCase().includes(norm) || 
                        (c.contact || '').toLowerCase().includes(norm);
        if (!matches) return false;
      }
      return true;
    });
  };

  const getFilteredPendingOrders = () => {
    return pendingOrders.filter(o => batchSelectedCustomers.includes(o.customer_id));
  };

  const getWarehouseLoadingSheet = () => {
    const aggregates: { [skuId: number]: { name: string, unitsPerCase: number, cases: number, units: number } } = {};
    
    generatedBatchInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach((line: any) => {
          const skuId = line.sku_id;
          if (skuId) {
            const upc = line.units_per_case || 12;
            if (!aggregates[skuId]) {
              aggregates[skuId] = {
                name: line.sku_name || 'Generic SKU',
                unitsPerCase: upc,
                cases: 0,
                units: 0
              };
            }
            aggregates[skuId].cases += line.cases || 0;
            aggregates[skuId].units += line.units || 0;
          }
        });
      }
    });

    return Object.values(aggregates).map(row => {
      const extraCases = Math.floor(row.units / row.unitsPerCase);
      const remainingUnits = row.units % row.unitsPerCase;
      return {
        ...row,
        cases: row.cases + extraCases,
        units: remainingUnits
      };
    });
  };

  // Consolidation Selector State
  const [consolidateCustomerId, setConsolidateCustomerId] = useState<string>('');
  const [consolidateSelectedInvoices, setConsolidateSelectedInvoices] = useState<number[]>([]);
  const [consolidateNotes, setConsolidateNotes] = useState<string>('Consolidated Ledger Statement');

  // Barcode Scanning Mobile Utility Mock
  const [mobileBarcode, setMobileBarcode] = useState<string>('');
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [mobileMessage, setMobileMessage] = useState<string>('');

  // Keyboard Navigation Guide Ref
  const skuSelectRefs = useRef<any[]>([]);

  // Fetch Core Data on Mount
  useEffect(() => {
    fetchInvoices();
    fetchCustomers();
    fetchSkus();
    fetchSalesmen();
    fetchPendingOrders();
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        setInventory(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingOrders = async () => {
    try {
      const res = await fetch('/api/orders?delivery_status=pending');
      if (res.ok) {
        setPendingOrders(await res.json());
      }
    } catch (err) {
      console.error("Failed to load pending orders", err);
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
        if (data.length > 0 && !selectedInvoice) {
          fetchInvoiceDetails(data[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
        // Extract distinct routes
        const distinctRoutes = Array.from(new Set(data.map((c: any) => c.route).filter(Boolean))) as string[];
        setRoutes(distinctRoutes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSkus = async () => {
    try {
      const res = await fetch('/api/skus');
      if (res.ok) {
        setSkus(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSalesmen = async () => {
    try {
      const res = await fetch('/api/salesmen');
      if (res.ok) {
        setSalesmen(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvoiceDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (res.ok) {
        setSelectedInvoice(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Previous balance lookup
  const getSelectedCustomer = (idStr: string) => {
    if (!idStr) return null;
    return customers.find(c => c.id === Number(idStr)) || null;
  };

  // Formula Calculations for FMCG line item
  const updateLineTotals = (item: InvoiceItem, selectedSku: SKU | undefined, customerDiscount: number = 0): InvoiceItem => {
    if (!selectedSku) return item;
    
    const upc = selectedSku.units_per_case || 12;
    const pricePerCase = selectedSku.price_per_case || 0;
    const pricePerUnit = selectedSku.price_per_unit || 0;
    
    // Support customer's predefined discount percentage if provided
    const discountPercent = item.discount_percentage !== undefined && item.discount_percentage > 0 
      ? item.discount_percentage 
      : customerDiscount;

    // Use bidirectional calculation where we compute totals based on units
    const totalUnits = item.units || (item.cases * upc);
    const calcCases = Math.floor(totalUnits / upc);
    const calcUnits = totalUnits % upc;

    // Subtotal calculations (Trade Price basis)
    const baseTotal = (calcCases * pricePerCase) + (calcUnits * pricePerUnit);
    
    // Auto trade discounts scheme/trade offers
    const discountAmt = baseTotal * (discountPercent / 100);
    const lineTotal = baseTotal - discountAmt;
    
    return {
      ...item,
      sku_id: selectedSku.id,
      sku_name: selectedSku.name,
      trade_price_per_case: pricePerCase,
      trade_price_per_unit: pricePerUnit,
      units_per_case: upc,
      discount_percentage: discountPercent,
      retail_price: selectedSku.price_per_unit * 1.15, // Suggested Retail price
      discount_amount: discountAmt,
      line_total: lineTotal
    };
  };

  // Handlers for single invoicing SKU rows
  const handleSingleSkuChange = (index: number, skuIdVal: number) => {
    const selectedSku = skus.find(s => s.id === skuIdVal);
    const updated = [...singleItems];
    updated[index] = {
      ...updated[index],
      sku_id: skuIdVal
    };
    const custObj = customers.find(c => c.id === Number(selectedCustomerId));
    const custDiscount = custObj ? (custObj.discount_pc || 0) : 0;
    updated[index] = updateLineTotals(updated[index], selectedSku, custDiscount);
    setSingleItems(updated);
  };

  const handleSingleQtyChange = (index: number, key: 'cases' | 'units', val: number) => {
    const updated = [...singleItems];
    const item = { ...updated[index], [key]: val };
    const selectedSku = skus.find(s => s.id === item.sku_id);
    const custObj = customers.find(c => c.id === Number(selectedCustomerId));
    const custDiscount = custObj ? (custObj.discount_pc || 0) : 0;
    updated[index] = updateLineTotals(item, selectedSku, custDiscount);
    setSingleItems(updated);
  };

  const handleSingleDiscountChange = (index: number, val: number) => {
    const updated = [...singleItems];
    const item = { ...updated[index], discount_percentage: val };
    const selectedSku = skus.find(s => s.id === item.sku_id);
    const custObj = customers.find(c => c.id === Number(selectedCustomerId));
    const custDiscount = custObj ? (custObj.discount_pc || 0) : 0;
    updated[index] = updateLineTotals(item, selectedSku, custDiscount);
    setSingleItems(updated);
  };

  const addSingleItemRow = () => {
    setSingleItems([
      ...singleItems,
      { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
    ]);
  };

  const removeSingleItemRow = (index: number) => {
    if (singleItems.length > 1) {
      setSingleItems(singleItems.filter((_, i) => i !== index));
    }
  };

  // Keyboard navigation logic
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Add row if it is the last item
      if (index === singleItems.length - 1) {
        addSingleItemRow();
        setTimeout(() => {
          skuSelectRefs.current[index + 1]?.focus();
        }, 50);
      }
    }
  };

  const calculateGrandTotals = (items: InvoiceItem[]) => {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;
    let total = 0;

    items.forEach(item => {
      subtotal += (item.cases * item.trade_price_per_case) + (item.units * item.trade_price_per_unit);
      discount += item.discount_amount || 0;
      total += item.line_total || 0;
    });

    // Assume 18% standard GST computed within gross total if applicable, or added
    tax = total * 0.18;

    return { subtotal, discount, tax, total };
  };

  // Add offline support
  const handleAddOfflineInvoice = (invoicePayload: any) => {
    const randomId = Date.now();
    const offlineItem = {
      ...invoicePayload,
      id: randomId,
      invoice_number: `INV-OFF-${randomId}`,
      customer_name: customers.find(c => c.id === Number(invoicePayload.customer_id))?.name || 'Local Retailer',
      customer_shop: customers.find(c => c.id === Number(invoicePayload.customer_id))?.shop_name || 'Outlet',
      is_offline_draft: true
    };

    const newQueue = [...offlineQueue, offlineItem];
    setOfflineQueue(newQueue);
    localStorage.setItem('erp_offline_invoices', JSON.stringify(newQueue));
    alert('Device Connectivity Offline! Invoice has been successfully queued in Local SD-RAM cache.');
  };

  const syncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    
    let successCount = 0;
    for (const offlineInv of offlineQueue) {
      try {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(offlineInv)
        });
        if (res.ok) {
          successCount++;
        }
      } catch (err) {
        console.error('Failed syncing item:', err);
      }
    }

    if (successCount > 0) {
      const remaining = offlineQueue.slice(successCount);
      setOfflineQueue(remaining);
      localStorage.setItem('erp_offline_invoices', JSON.stringify(remaining));
      fetchInvoices();
      alert(`Sync Engine Active: Successfully uploaded ${successCount} queued invoices from local storage.`);
    }
  };

  // Save ad-hoc Invoice
  const submitSingleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a retailer customer account');
      return;
    }

    const validItems = singleItems.filter(item => item.sku_id > 0 && (item.cases > 0 || item.units > 0));
    if (validItems.length === 0) {
      alert('Please select at least one Product SKU and input valid Qty cases/units');
      return;
    }

    const { subtotal, discount, tax, total } = calculateGrandTotals(validItems);

    const payload = {
      customer_id: Number(selectedCustomerId),
      salesman_id: selectedSalesmanId ? Number(selectedSalesmanId) : null,
      invoice_date: invoiceDate,
      subtotal,
      discount_amount: discount,
      tax_amount: 0, // Computed or simplified
      total_amount: total,
      payment_method: paymentMethod,
      notes: invoiceNotes,
      items: validItems
    };

    if (isOffline) {
      handleAddOfflineInvoice(payload);
      return;
    }

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        alert('Invoice successfully created and debited to Retail Service Ledger!');
        setSingleItems([{ sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }]);
        setInvoiceNotes('');
        setSelectedCustomerId('');
        fetchInvoices();
        if (result.invoiceId) {
          fetchInvoiceDetails(result.invoiceId);
        }
        setActiveTab('manage');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit invoice');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Batch invoicing handlers
  const handleBatchSkuChange = (index: number, skuIdVal: number) => {
    const selectedSku = skus.find(s => s.id === skuIdVal);
    const updated = [...batchItems];
    const item = { ...updated[index], sku_id: skuIdVal };

    const activeCustomer = customers.find(c => c.id === Number(activeBatchCustomer));
    const customerDiscount = activeCustomer ? (activeCustomer.discount_pc || 0) : 0;

    let finalItem = updateLineTotals(item, selectedSku, customerDiscount);

    // Look up warehouse batches for this sku-id from inventory
    const matches = inventory.filter(inv => inv.sku_id === skuIdVal && inv.batch_number);
    if (matches.length === 1) {
      finalItem.batch_number = matches[0].batch_number;
      finalItem.expiry_date = matches[0].expiry_date;
    } else if (matches.length > 1) {
      // Default to first batch, but user can change via cell select dropdown
      finalItem.batch_number = matches[0].batch_number;
      finalItem.expiry_date = matches[0].expiry_date;
    } else {
      finalItem.batch_number = "No Batch";
      finalItem.expiry_date = "N/A";
    }

    updated[index] = finalItem;
    setBatchItems(updated);
  };

  const handleBatchQtyChange = (index: number, key: 'cases' | 'units', val: number) => {
    const updated = [...batchItems];
    const item = { ...updated[index] };
    const selectedSku = skus.find(s => s.id === item.sku_id);
    const upc = selectedSku?.units_per_case || 12;

    if (key === 'cases') {
      item.cases = val;
      item.units = val * upc;
    } else {
      item.units = val;
      item.cases = parseFloat((val / upc).toFixed(2));
    }

    const activeCustomer = customers.find(c => c.id === Number(activeBatchCustomer));
    const customerDiscount = activeCustomer ? (activeCustomer.discount_pc || 0) : 0;

    updated[index] = updateLineTotals(item, selectedSku, customerDiscount);
    setBatchItems(updated);
  };

  const handleBatchNumberChange = (index: number, batchNo: string) => {
    const updated = [...batchItems];
    const item = { ...updated[index], batch_number: batchNo };
    const match = inventory.find(inv => inv.sku_id === item.sku_id && inv.batch_number === batchNo);
    if (match) {
      item.expiry_date = match.expiry_date || 'N/A';
    }
    updated[index] = item;
    setBatchItems(updated);
  };

  const handleBatchKeyDown = (e: React.KeyboardEvent, rowIndex: number, fieldName: 'sku' | 'batch' | 'cases' | 'units') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (fieldName === 'sku') {
        const el = document.querySelector(`[data-batch-row="${rowIndex}"][data-batch-field="batch"]`) as HTMLSelectElement | HTMLInputElement | null;
        if (el) el.focus();
      } else if (fieldName === 'batch') {
        const el = document.querySelector(`[data-batch-row="${rowIndex}"][data-batch-field="cases"]`) as HTMLInputElement | null;
        if (el) el.focus();
      } else if (fieldName === 'cases') {
        const el = document.querySelector(`[data-batch-row="${rowIndex}"][data-batch-field="units"]`) as HTMLInputElement | null;
        if (el) el.focus();
      } else if (fieldName === 'units') {
        // Append a new row if the current one has a product SKU selected
        setBatchItems(prev => {
          const lastRow = prev[prev.length - 1];
          if (lastRow && lastRow.sku_id > 0) {
            return [
              ...prev,
              { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
            ];
          }
          return prev;
        });
        
        // Stagger focus to next line SKU dropdown
        setTimeout(() => {
          const nextId = rowIndex + 1;
          const nextEl = document.querySelector(`[data-batch-row="${nextId}"][data-batch-field="sku"]`) as HTMLSelectElement | null;
          if (nextEl) {
            nextEl.focus();
          }
        }, 50);
      }
    }
  };

  const addBatchRow = () => {
    setBatchItems([
      ...batchItems,
      { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
    ]);
  };

  // Queue actions handlers
  const handleSaveAndAddNextCustomer = () => {
    if (!activeBatchCustomer) {
      alert("Please select an active customer to build an invoice.");
      return;
    }
    const customer = customers.find(c => c.id === Number(activeBatchCustomer));
    if (!customer) {
      alert("Invalid customer selected.");
      return;
    }
    const validItems = batchItems.filter(item => item.sku_id > 0 && ((item.cases || 0) > 0 || (item.units || 0) > 0));
    if (validItems.length === 0) {
      alert("Please enter at least one Product SKU with cases or units before saving.");
      return;
    }

    const { subtotal, discount, total } = calculateGrandTotals(validItems);

    const queuedInv = {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_shop: customer.shop_name || customer.name,
      customer_contact: customer.contact,
      customer_balance: customer.balance,
      items: validItems,
      subtotal,
      discount_amount: discount,
      total_amount: total,
      notes: invoiceNotes,
    };

    setQueuedInvoices(prev => [...prev, queuedInv]);

    alert(`Added invoice for ${customer.shop_name || customer.name} (Rs. ${total.toLocaleString()}) to current batch queue.`);

    setActiveBatchCustomer('');
    setBatchItems([
      { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
    ]);
    setInvoiceNotes('');
  };

  const handleSaveAndCloseInvoice = () => {
    if (!activeBatchCustomer) {
      alert("Please select an active customer to build an invoice.");
      return;
    }
    const customer = customers.find(c => c.id === Number(activeBatchCustomer));
    if (!customer) {
      alert("Invalid customer selected.");
      return;
    }
    const validItems = batchItems.filter(item => item.sku_id > 0 && ((item.cases || 0) > 0 || (item.units || 0) > 0));
    if (validItems.length === 0) {
      alert("Please enter at least one Product SKU with cases or units before saving.");
      return;
    }

    const { subtotal, discount, total } = calculateGrandTotals(validItems);

    const queuedInv = {
      customer_id: customer.id,
      customer_name: customer.name,
      customer_shop: customer.shop_name || customer.name,
      customer_contact: customer.contact,
      customer_balance: customer.balance,
      items: validItems,
      subtotal,
      discount_amount: discount,
      total_amount: total,
      notes: invoiceNotes,
    };

    setQueuedInvoices(prev => [...prev, queuedInv]);

    alert(`Saved invoice for ${customer.shop_name || customer.name} (Rs. ${total.toLocaleString()}) to current batch.`);

    setActiveBatchCustomer('');
    setBatchItems([
      { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
    ]);
    setInvoiceNotes('');
  };

  const handlePrintBatchQueue = () => {
    if (queuedInvoices.length === 0) {
      alert("No invoices added to current batch queue yet. Please select customers and save their ledgers first.");
      return;
    }

    const previewInvoices = queuedInvoices.map((q, qIdx) => {
      const repName = salesmen.find(s => s.id === Number(batchSalesmanId))?.name || 'Swat Route Rep';
      return {
        id: 99000 + qIdx,
        invoice_number: `QUED-INV-${100 + qIdx}`,
        invoice_date: invoiceDate,
        customer_shop: q.customer_shop,
        customer_name: q.customer_name,
        customer_contact: q.customer_contact || 'N/A',
        route: batchRoute || 'Swat Cluster',
        salesman_name: repName,
        items: q.items.map((it: any) => ({
          sku_name: it.sku_name || skus.find(s => s.id === it.sku_id)?.name || 'Product Sku',
          cases: it.cases || 0,
          units: it.units || 0,
          trade_price_per_case: it.trade_price_per_case || 0,
          discount_percentage: it.discount_percentage || 0,
          line_total: it.line_total || 0
        })),
        subtotal: q.subtotal,
        discount_amount: q.discount_amount,
        total_amount: q.total_amount
      };
    });

    setGeneratedBatchInvoices(previewInvoices);
    setShowBulkPrintView(true);
  };

  const saveFullBatch = async () => {
    if (queuedInvoices.length === 0) {
      alert("No invoices added to current batch queue yet. Please select customers and save their ledgers first.");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setGenerationStatus("Starting batch commit pipeline...");

    try {
      const savedInvoiceDetails = [];
      const totalToSave = queuedInvoices.length;
      const invoiceBatchId = "BATCH-" + Math.floor(100000 + Math.random() * 900000);

      for (let i = 0; i < totalToSave; i++) {
        const qInv = queuedInvoices[i];
        setGenerationStatus(`Saving ledger statement for: ${qInv.customer_shop} (${i + 1}/${totalToSave})...`);
        setGenerationProgress(10 + Math.floor((i / totalToSave) * 75));

        const payload = {
          customer_id: qInv.customer_id,
          salesman_id: batchSalesmanId ? Number(batchSalesmanId) : null,
          invoice_date: invoiceDate,
          subtotal: qInv.subtotal,
          discount_amount: qInv.discount_amount,
          tax_amount: 0,
          total_amount: qInv.total_amount,
          payment_method: "Credit",
          notes: qInv.notes || `Batch Invoice ref: ${invoiceBatchId}`,
          items: qInv.items.map((item: any) => ({
            sku_id: item.sku_id,
            cases: item.cases,
            units: item.units,
            trade_price_per_case: item.trade_price_per_case,
            trade_price_per_unit: item.trade_price_per_unit,
            retail_price: item.retail_price,
            discount_percentage: item.discount_percentage,
            discount_amount: item.discount_amount,
            line_total: item.line_total,
            batch_number: item.batch_number || "No Batch",
            expiry_date: item.expiry_date || "N/A"
          })),
          batchId: invoiceBatchId
        };

        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(`Failed on ${qInv.customer_shop}: ${errData.error || 'Server rejected request'}`);
        }

        const resData = await res.json();
        const detailRes = await fetch(`/api/invoices/${resData.invoiceId}`);
        if (detailRes.ok) {
          savedInvoiceDetails.push(await detailRes.json());
        } else {
          savedInvoiceDetails.push({
            id: resData.invoiceId,
            ...payload,
            invoice_number: `INV-${resData.invoiceId}`,
            customer_shop: qInv.customer_shop,
            customer_name: qInv.customer_name
          });
        }
      }

      setGenerationProgress(95);
      setGenerationStatus("Syncing Firestore triggers and compiling warehouse loading sheet...");
      await new Promise(r => setTimeout(r, 600));

      setGeneratedBatchInvoices(savedInvoiceDetails);
      setGenerationProgress(100);
      setGenerationStatus("Full Route Batch successfully compiled and committed to ledgers!");

      setQueuedInvoices([]);
      setSelectedOrders([]);
      fetchInvoices();
      fetchCustomers();

      await new Promise(r => setTimeout(r, 600));
      setIsGenerating(false);
      setShowBatchSummary(true);

    } catch (err: any) {
      console.error(err);
      alert(`Batch processing aborted: ${err.message || 'Unknown integration error.'}`);
      setIsGenerating(false);
    }
  };

  const triggerBatchInvoices = async () => {
    if (batchMode === 'bookings') {
      if (selectedOrders.length === 0) {
        alert('Please select at least one pending sales order / pre-booking to convert.');
        return;
      }
      
      setIsGenerating(true);
      setGenerationProgress(10);
      setGenerationStatus('Analyzing selected pre-booking entries...');
      
      try {
        await new Promise(r => setTimeout(r, 600));
        setGenerationProgress(30);
        setGenerationStatus(`Converting ${selectedOrders.length} pending bookings into customer ledger statements...`);
        
        const res = await fetch('/api/invoices/convert-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_ids: selectedOrders,
            invoice_date: invoiceDate,
            payment_method: 'Credit'
          })
        });
        
        if (res.ok) {
          const result = await res.json();
          const invoiceIds = result.invoiceIds || [];
          setGenerationProgress(60);
          setGenerationStatus(`Successfully stored ${invoiceIds.length} bills in core ledger journals.`);
          await new Promise(r => setTimeout(r, 600));
          
          const detailsList = [];
          for (let i = 0; i < invoiceIds.length; i++) {
            setGenerationStatus(`Rendering sales invoice & loading profiles (${i + 1}/${invoiceIds.length})...`);
            setGenerationProgress(Math.min(99, 60 + Math.floor((i / invoiceIds.length) * 35)));
            const detailRes = await fetch(`/api/invoices/${invoiceIds[i]}`);
            if (detailRes.ok) {
              detailsList.push(await detailRes.json());
            }
          }
          
          setGeneratedBatchInvoices(detailsList);
          setGenerationProgress(100);
          setGenerationStatus('Batch invoicing and warehouse loading sheet compiled!');
          
          // Reset states
          setSelectedOrders([]);
          fetchInvoices();
          fetchPendingOrders();
          fetchCustomers(); // Update balances
          
          await new Promise(r => setTimeout(r, 600));
          setIsGenerating(false);
          setShowBatchSummary(true);
        } else {
          const errData = await res.json();
          alert(errData.error || 'Failed to convert bookings to invoices');
          setIsGenerating(false);
        }
      } catch (err) {
        console.error(err);
        alert('An unexpected error occurred during pre-booking conversion.');
        setIsGenerating(false);
      }
    } else {
      // Template Mode
      if (batchSelectedCustomers.length === 0) {
        alert('Please select at least one customer outlet to apply the standard bundle template.');
        return;
      }

      const validItems = batchItems.filter(item => item.sku_id > 0 && (item.cases > 0 || item.units > 0));
      if (validItems.length === 0) {
        alert('Please setup template line-items for delivery allocation.');
        return;
      }
      
      setIsGenerating(true);
      setGenerationProgress(10);
      setGenerationStatus('Filtering targeted route retailers...');
      
      try {
        await new Promise(r => setTimeout(r, 500));
        setGenerationProgress(30);
        setGenerationStatus(`Generating standard template deliveries for ${batchSelectedCustomers.length} shops...`);
        
        const payload = {
          route: batchRoute,
          salesman_id: batchSalesmanId ? Number(batchSalesmanId) : null,
          invoice_date: invoiceDate,
          customer_ids: batchSelectedCustomers,
          items: validItems
        };
        
        const res = await fetch('/api/invoices/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          const result = await res.json();
          const invoiceIds = result.invoiceIds || [];
          setGenerationProgress(60);
          setGenerationStatus(`Writing batch files. Dispatched ${invoiceIds.length} route items.`);
          await new Promise(r => setTimeout(r, 500));
          
          const detailsList = [];
          for (let i = 0; i < invoiceIds.length; i++) {
            setGenerationStatus(`Compiling trade discount configurations (${i + 1}/${invoiceIds.length})...`);
            setGenerationProgress(Math.min(99, 60 + Math.floor((i / invoiceIds.length) * 35)));
            const detailRes = await fetch(`/api/invoices/${invoiceIds[i]}`);
            if (detailRes.ok) {
              detailsList.push(await detailRes.json());
            }
          }
          
          setGeneratedBatchInvoices(detailsList);
          setGenerationProgress(100);
          setGenerationStatus('Warehouse manifest and distribution loadout records generated!');
          
          // Clear
          setBatchSelectedCustomers([]);
          setBatchItems([{ sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }]);
          fetchInvoices();
          fetchCustomers(); // Update balances
          
          await new Promise(r => setTimeout(r, 600));
          setIsGenerating(false);
          setShowBatchSummary(true);
        } else {
          alert('Batch invoice run rejected by server.');
          setIsGenerating(false);
        }
      } catch (err) {
        console.error(err);
        alert('An unexpected error occurred during batch generation.');
        setIsGenerating(false);
      }
    }
  };

  const startWhatsappSimulation = async () => {
    if (generatedBatchInvoices.length === 0) return;
    
    setShowWhatsappModal(true);
    setIsWhatsappSending(true);
    setWhatsappProgress(0);
    
    // Set up queue
    const queueList = generatedBatchInvoices.map(inv => {
      const phone = inv.customer_contact || '03001234567';
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const dynamicText = `Dear customer ${inv.customer_shop || inv.customer_name}, your Invoice ${inv.invoice_number} is ready. Total: Rs. ${inv.total_amount.toLocaleString()}. Thank you! -- PrimeLink Distribution`;
      const waLink = `https://wa.me/${formattedPhone.startsWith('0') ? '92' + formattedPhone.slice(1) : formattedPhone}?text=${encodeURIComponent(dynamicText)}`;
      
      return {
        id: inv.id,
        shop: inv.customer_shop || inv.customer_name,
        invoiceNo: inv.invoice_number,
        amount: inv.total_amount,
        phone: phone,
        link: waLink,
        status: 'queued'
      };
    });
    
    setWhatsappQueue(queueList);
    
    for (let i = 0; i < queueList.length; i++) {
      setWhatsappQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'sending' } : item));
      await new Promise(r => setTimeout(r, 800)); 
      
      setWhatsappQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'sent' } : item));
      setWhatsappProgress(Math.round(((i + 1) / queueList.length) * 100));
    }
    
    setIsWhatsappSending(false);
  };

  // Consolidation actions
  const triggerConsolidation = async () => {
    if (!consolidateCustomerId) {
      alert('Please choose a Wholesale account');
      return;
    }
    if (consolidateSelectedInvoices.length < 2) {
      alert('Please pick at least 2 bills to merge');
      return;
    }

    try {
      const res = await fetch('/api/invoices/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(consolidateCustomerId),
          child_invoice_ids: consolidateSelectedInvoices,
          invoice_date: invoiceDate,
          notes: consolidateNotes
        })
      });

      if (res.ok) {
        const result = await res.json();
        alert('WHOLESALE MERGE SUCCESS: Consolidated invoice statement compiled successfully!');
        setConsolidateSelectedInvoices([]);
        setConsolidateCustomerId('');
        fetchInvoices();
        if (result.consolidatedId) {
          fetchInvoiceDetails(result.consolidatedId);
        }
        setActiveTab('manage');
      } else {
        const data = await res.json();
        alert(data.error || 'Consolidation merger rejected');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Invoice Removal/Cancellation
  const removeInvoice = async (id: number) => {
    if (!confirm('DANGER: This will permanently purge this invoice and revert the debited customer credit ledger. Proceed?')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Invoice deleted of outstanding ledger successfully');
        setSelectedInvoice(null);
        fetchInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Web Bluetooth Printer Pairing & Printing Pipelines
  const pairBluetoothPrinter = async () => {
    if (!(navigator as any).bluetooth) {
      setBtStatus('unsupported');
      alert("Web Bluetooth API is not supported on this browser or inside this iframe. (For security, modern browsers block BLE device discovery in sandboxed iframes. To pair physical printers, please click the 'Open in New Tab' button in the top-right corner of AI Studio, then try configuration there).");
      return;
    }
    try {
      setIsConnectingBluetooth(true);
      setBtStatus('connecting');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Print SPP Service
          '0000e7e1-0000-1000-8000-00805f9b34fb', // E7E1 alternative print service
          '49535343-fe7d-41aa-8b12-791c10753578', // ISSC BT BLE Custom service
        ]
      });
      
      const server = await device.gatt?.connect();
      let char: any = null;
      const services = await server?.getPrimaryServices();
      if (services) {
        for (const service of services) {
          try {
            const characteristics = await service.getCharacteristics();
            for (const c of characteristics) {
              if (c.properties.write || c.properties.writeWithoutResponse) {
                char = c;
                break;
              }
            }
          } catch (e) {
            // ignore service-level attribute query errors
          }
          if (char) break;
        }
      }
      
      if (!char) {
        throw new Error("No writeable characteristics discovered on this printer terminal. Ensure Bluetooth sharing is authorised.");
      }
      
      setBluetoothDevice(device);
      setPrinterCharacteristic(char);
      setBtStatus('connected');
      alert(`🎉 Bluetooth print node synced: Connected successfully to ${device.name || 'Thermal Roll Printer'}!`);
    } catch (e: any) {
      console.error("BLE connection error:", e);
      setBtStatus('disconnected');
      alert(`Bluetooth link failure: ${e.message}\n\nPlease check that your thermal receipt printer is turned on, in pairing mode, and you have authorized Bluetooth sharing.`);
    } finally {
      setIsConnectingBluetooth(false);
    }
  };

  const printBluetoothReceipt = async () => {
    if (!selectedInvoice) return;
    const fallbackText = decodeURIComponent(getWhatsAppText());
    
    if (!printerCharacteristic) {
      // Bluetooth not paired: Trigger plain-text summary clipboard fallback
      try {
        await navigator.clipboard.writeText(fallbackText);
        alert("⚠️ Bluetooth Printer is not connected!\n\nOffline Fallback Triggered:\nA formatted plain-text copy of this invoice has been placed on your clipboard.\n\nYou can now paste it directly into WhatsApp, SMS, or Notes to send to your driver/customer.");
      } catch (clipboardErr) {
        alert("⚠️ Bluetooth Printer is not paired.\n\nRaw Text Bill Backup:\n\n" + fallbackText);
      }
      return;
    }

    try {
      setBtStatus('sending');
      const compiledBytes = compileEscPos(selectedInvoice);
      
      // Send bytes in MTU limits chunk-by-chunk (20 bytes per BLE write)
      const CHUNK_SIZE = 20;
      for (let i = 0; i < compiledBytes.length; i += CHUNK_SIZE) {
        const chunk = compiledBytes.slice(i, i + CHUNK_SIZE);
        await printerCharacteristic.writeValue(chunk);
      }
      
      setBtStatus('connected');
      alert("Success: ESC/POS receipt streamed directly to your mobile thermal printer!");
    } catch (error: any) {
      console.error("BLE print error:", error);
      setBtStatus('connected');
      // Fallback on bluetooth crash
      try {
        await navigator.clipboard.writeText(fallbackText);
        alert(`❌ Bluetooth Transmission failed: ${error.message}\n\nEmergency Fallback Triggered:\na plain-text layout of the invoice has been copied to your clipboard to paste into WhatsApp instead.`);
      } catch (clipboardErr) {
        alert(`❌ Bluetooth Transmission failed: ${error.message}\n\nInvoice plain text:\n\n` + fallbackText);
      }
    }
  };

  const printClientSidePDF = () => {
    if (!selectedInvoice) return;
    try {
      // Generate highly styled client-side PDF Blob URL
      const blobUrl = generateInvoicePDF(selectedInvoice);
      // Directly invoke native print dialog on the iframe containing the PDF Blob
      printIframeBlobUrl(blobUrl);
    } catch (err: any) {
      console.error("Client-side A4 PDF Print failed:", err);
      // Native window.print fallback
      window.print();
    }
  };

  // Format share texts or trigger printing
  const printPage = () => {
    printClientSidePDF();
  };

  const getWhatsAppText = () => {
    if (!selectedInvoice) return '';
    const itemsStr = selectedInvoice.items?.map(it => `• ${it.sku_name || 'SKU'} (${it.cases}C / ${it.units}U) -> Rs.${(it.line_total || 0).toLocaleString()}`).join('\n') || '';
    const text = `*PRIMELINK ENTERPRISES*\n*INVOICE RECIPT: ${selectedInvoice.invoice_number || ''}*\n----------------------------\n*Shop:* ${selectedInvoice.customer_shop || ''}\n*Date:* ${selectedInvoice.invoice_date || ''}\n*Method:* ${selectedInvoice.payment_method || ''}\n\n*Billing Breakdown:*\n${itemsStr}\n\n*Sub-total:* Rs.${(selectedInvoice.subtotal || 0).toLocaleString()}\n*Discount:* Rs.${(selectedInvoice.discount_amount || 0).toLocaleString()}\n*GST (18% inclusive):* Rs.${(selectedInvoice.tax_amount || 0).toLocaleString()}\n*Net Amount:* Rs. ${(selectedInvoice.total_amount || 0).toLocaleString()}\n*Previous Balance:* Rs.${(selectedInvoice.previous_balance || 0).toLocaleString()}\n*Total Ledger Credit:* Rs.${((selectedInvoice.total_amount || 0) + (selectedInvoice.previous_balance || 0)).toLocaleString()}\n\n*Thank you for your business.*`;
    return encodeURIComponent(text);
  };

  const shareViaWhatsApp = () => {
    if (!selectedInvoice) return;
    const phone = selectedInvoice.customer_contact || '';
    const formattedText = getWhatsAppText();
    window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${formattedText}`);
  };

  // Mobile barcode simulation tool
  const runMockBarcodeScan = () => {
    if (!mobileBarcode) return;
    const matchingSku = skus.find(s => s.id === Number(mobileBarcode) || s.name.toLowerCase().includes(mobileBarcode.toLowerCase()));
    if (matchingSku) {
      // Mock alert / beep sound
      setMobileMessage(`Scanned Product Success: ${matchingSku.name}`);
      // Add or update row in single items
      const existingIdx = singleItems.findIndex(i => i.sku_id === matchingSku.id);
      if (existingIdx > -1) {
        const updated = [...singleItems];
        updated[existingIdx].cases += 1;
        updated[existingIdx] = updateLineTotals(updated[existingIdx], matchingSku);
        setSingleItems(updated);
      } else {
        const newline = updateLineTotals({
          sku_id: matchingSku.id,
          cases: 1,
          units: 0,
          trade_price_per_case: 0,
          trade_price_per_unit: 0,
          retail_price: 0,
          discount_percentage: 0,
          discount_amount: 0,
          line_total: 0
        }, matchingSku);
        // If first is trivial row replace it
        if (singleItems.length === 1 && singleItems[0].sku_id === 0) {
          setSingleItems([newline]);
        } else {
          setSingleItems([...singleItems, newline]);
        }
      }
      setMobileBarcode('');
    } else {
      setMobileMessage('MOCK SCAN ERROR: SKU not found in inventory code ledger');
    }
  };

  // Filter lists
  const filteredInvoices = invoices.filter(inv => 
    (inv.customer_shop || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.route && inv.route.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4 sm:px-0">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight flex items-center gap-2">
            SALES <span className="text-amber-500 italic">INVOICING</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">
            Primelink Enterprises • Field Sales Management & Billing System
          </p>
        </div>

        {/* Perspective and Connection controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Offline/Online toggle */}
          <button
            onClick={() => {
              const next = !isOffline;
              setIsOffline(next);
              if (!next) syncOfflineQueue();
            }}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border shadow-sm select-none ${
              isOffline 
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' 
                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {isOffline ? 'Offline Active' : 'Online System'}
          </button>

          {offlineQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="bg-[#222063] text-white hover:bg-opacity-90 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Sync Drafts ({offlineQueue.length})
            </button>
          )}

          {/* View Perspective switch */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-xl shadow-inner border border-slate-200">
            <button
              onClick={() => setViewMode('desktop')}
              className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewMode === 'desktop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              Office (Desktop)
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3.5 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewMode === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Field (Mobile)
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* DESKTOP (BACK OFFICE CONTAINER) */}
      {/* ============================================================= */}
      {viewMode === 'desktop' && (
        <div className="space-y-6">
          {/* Sub Module Tabs */}
          <div className="flex border-b border-slate-200/85 gap-1 no-print">
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-3 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'manage' ? 'border-amber-500 text-slate-950 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Invoice Archives & Live Ledger
            </button>
            <button
              onClick={() => setActiveTab('single')}
              className={`py-3 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'single' ? 'border-amber-500 text-slate-950 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Book Ad-Hoc Invoice
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`py-3 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'batch' ? 'border-amber-500 text-slate-950 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Bulk Route Billing
            </button>
            <button
              onClick={() => setActiveTab('consolidate')}
              className={`py-3 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'consolidate' ? 'border-amber-500 text-slate-950 font-black' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Statement Consolidation
            </button>
          </div>

          {/* Tab Content Display */}
          <AnimatePresence mode="wait">
            {/* TAB 1: ARCHIVES MANAGER & DUAL PANE */}
            {activeTab === 'manage' && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -5 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                {/* Search / Ledger list Column */}
                <div className="lg:col-span-1 space-y-4 no-print">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search shop, bill number, route..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>

                  <div className="space-y-2.5 max-h-[75vh] overflow-y-auto pr-1">
                    {loading ? (
                      <div className="text-center p-8 text-slate-400 text-xs font-black tracking-widest uppercase">
                        Accessing Billing Records...
                      </div>
                    ) : filteredInvoices.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 bg-white border border-slate-100 rounded-2xl italic">
                        No transactions registered in this period
                      </div>
                    ) : (
                      filteredInvoices.map(inv => (
                        <button
                          key={inv.id}
                          onClick={() => fetchInvoiceDetails(inv.id)}
                          className={`w-full p-4 rounded-2xl text-left border-2 transition-all relative ${
                            selectedInvoice?.id === inv.id
                              ? 'border-amber-500 bg-amber-50/50 shadow-md scale-[1.01]'
                              : 'border-white bg-white hover:border-slate-100 hover:bg-slate-50/50 shadow-sm'
                          }`}
                        >
                          {inv.is_consolidated === 1 && (
                            <span className="absolute top-3 right-3 bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[7px] font-black uppercase">Consolidated</span>
                          )}
                          {inv.is_consolidated === 2 && (
                            <span className="absolute top-3 right-3 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[7px] font-black uppercase">Statm Statement</span>
                          )}

                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[9px] font-mono font-black text-slate-400">{inv.invoice_number}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                              inv.status === 'Paid' 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-150' 
                                : 'bg-amber-50 text-amber-600 border-amber-150'
                            }`}>
                              {inv.payment_method} • {inv.status}
                            </span>
                          </div>

                          <h4 className="font-extrabold text-slate-900 line-clamp-1">{inv.customer_shop}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mb-3">{inv.customer_name} ({inv.route || 'Local Swat'})</p>

                          <div className="flex justify-between items-end border-t border-slate-100 pt-2.5">
                            <span className="text-[10px] text-slate-400 font-bold">{new Date(inv.invoice_date).toLocaleDateString()}</span>
                            <div className="text-right">
                              <span className="text-[8px] block font-semibold text-slate-400 uppercase tracking-widest">Bill total</span>
                              <span className="text-sm font-black text-slate-900">Rs. {inv.total_amount.toLocaleString(undefined, {minimumFractionDigits: 1})}</span>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Billing details / Printer sheet Dual-Pane Viewer */}
                <div className="lg:col-span-2">
                  {selectedInvoice ? (
                    <div className="bg-white rounded-3xl border border-slate-200 outline-none shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
                      
                      {/* Top Action Ribbon */}
                      <div className="flex justify-between items-center bg-slate-950 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden no-print">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Selected Invoice Ledger</p>
                          <h2 className="text-2xl font-black">{selectedInvoice.invoice_number}</h2>
                          <p className="text-xs text-slate-400 font-mono font-bold">{selectedInvoice.customer_shop}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={printClientSidePDF}
                            className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 select-none"
                          >
                            <Printer className="w-4 h-4" /> Print Document
                          </button>
                           <button
                             onClick={shareViaWhatsApp}
                             className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg select-none"
                           >
                             <Share2 className="w-4 h-4" /> WhatsApp Send
                           </button>
                           {selectedInvoice.status !== 'Paid' && (
                             <button
                               onClick={async () => {
                                 if (window.confirm(`Mark Invoice #${selectedInvoice.invoice_number} as Paid?\nThis will automatically post a Cash In entry of Rs. ${selectedInvoice.total_amount.toLocaleString()} into the Roznamcha Ledger!`)) {
                                   try {
                                     const res = await fetch(`/api/invoices/${selectedInvoice.id}/payment`, {
                                       method: 'POST',
                                       headers: { 'Content-Type': 'application/json' },
                                       body: JSON.stringify({ remarks: "Paid from Invoices details panel." })
                                     });
                                     if (res.ok) {
                                       alert("Invoice successfully marked as Paid and cash recovery posted to Roznamcha.");
                                       fetchInvoices();
                                       fetchInvoiceDetails(selectedInvoice.id);
                                       if (typeof fetchCustomers === 'function') {
                                         fetchCustomers();
                                       }
                                     } else {
                                       const err = await res.json();
                                       alert("Error: " + err.error);
                                     }
                                   } catch (e) {
                                     alert("Failed to communicate update with ledger service.");
                                   }
                                 }
                               }}
                               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg select-none"
                             >
                               <Check className="w-4 h-4" /> Mark as Paid
                             </button>
                           )}
                           <button
                             onClick={() => removeInvoice(selectedInvoice.id)}
                             className="bg-rose-600 hover:bg-rose-700 text-white p-2.5 rounded-xl flex items-center shadow-lg select-none"
                             title="Delete Invoice"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      </div>

                      {/* UNBREAKABLE OFFLINE PRINT CONTROL HUB */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-150 p-5 rounded-3xl no-print">
                        {/* Column 1: A4 Desk / Office Printer */}
                        <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 md:pr-4 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OFFICE INVOICING PIPELINE</span>
                            </div>
                            <h3 className="text-sm font-extrabold text-slate-800">Client-Side A4/A5 PDF Engine</h3>
                            <p className="text-[10px] text-slate-400 leading-tight mt-1 font-medium">Renders PDF directly in Chrome memory. Requires zero server response & zero active internet link to print.</p>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] text-amber-800 font-semibold leading-relaxed">
                            <span className="font-extrabold uppercase text-amber-900 block mb-0.5">⚠️ DIRECT HARDWARE LINK</span>
                            For guaranteed offline printing, ensure the main office printer is connected directly to this computer via a physical USB cable, not Wi-Fi.
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setPrintLayout('standard');
                                printClientSidePDF();
                              }}
                              className="flex-1 bg-slate-900 hover:bg-slate-950 text-white p-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                            >
                              <Printer className="w-4 h-4 text-emerald-400" /> Print A4 PDF
                            </button>
                            <button
                              onClick={() => setPrintLayout('standard')}
                              className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer ${
                                printLayout === 'standard' ? 'bg-white text-slate-900 border-slate-300' : 'text-slate-400 border-transparent hover:text-slate-600'
                              }`}
                            >
                              A4 View
                            </button>
                          </div>
                        </div>

                        {/* Column 2: Mobile Thermal Printer */}
                        <div className="flex flex-col justify-between pl-0 md:pl-2 space-y-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${btStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">FIELD MOBILE COURIER</span>
                            </div>
                            <h3 className="text-sm font-extrabold text-slate-800">Direct Bluetooth 58/80mm</h3>
                            <p className="text-[10px] text-slate-400 leading-tight mt-1 font-medium">Connects directly to mobile printer accessories via Web Bluetooth API, streaming native ESC/POS commands.</p>
                          </div>

                          {/* Bluetooth pairing actions and status bar */}
                          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-black text-slate-500 uppercase tracking-widest">Bluetooth Link:</span>
                              <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] ${
                                btStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                                btStatus === 'connecting' ? 'bg-amber-100 text-amber-800' :
                                btStatus === 'sending' ? 'bg-blue-100 text-blue-800' :
                                btStatus === 'unsupported' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {btStatus === 'connected' ? `LINKED: ${bluetoothDevice?.name || 'PRINTER'}` :
                                 btStatus === 'connecting' ? 'SYNCING...' :
                                 btStatus === 'sending' ? 'TRANSMITTING...' :
                                 btStatus === 'unsupported' ? 'UNSUPPORTED' : 'NOT LINKED'}
                              </span>
                            </div>
                            
                            <button
                              disabled={isConnectingBluetooth}
                              onClick={pairBluetoothPrinter}
                              className="w-full bg-white hover:bg-slate-50 border border-slate-250 py-1.5 px-2 rounded-lg text-[9px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                              {isConnectingBluetooth ? 'Connecting to GATT...' : 'Pair Bluetooth Printer'}
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setPrintLayout('thermal');
                                printBluetoothReceipt();
                              }}
                              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                            >
                              <Smartphone className="w-4 h-4" /> Print Receipt (BLE)
                            </button>
                            <button
                              onClick={() => setPrintLayout('thermal')}
                              className={`px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-wider cursor-pointer ${
                                printLayout === 'thermal' ? 'bg-white text-slate-900 border-slate-300' : 'text-slate-400 border-transparent hover:text-slate-600'
                              }`}
                            >
                              Roll View
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* STANDARD PREVIEW CONTAINER */}
                      {printLayout === 'standard' ? (
                        <div id="print-sheet-a4" className="border border-slate-200 p-8 rounded-2xl shadow-inner space-y-6">
                          
                          {/* Invoice Letterhead */}
                          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                            <div>
                              <h3 className="text-xl font-black tracking-tighter text-slate-900">PRIMELINK ENTERPRISES</h3>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">FMCG Distribution Division • Swat Corridor Hub</p>
                              <p className="text-[9px] font-semibold text-slate-500">Contact: 0310-6548820 • panr.hub@primelink.com</p>
                            </div>
                            <div className="text-right">
                              <h2 className="text-lg font-black text-amber-600 uppercase tracking-wide italic">SALES INVOICE</h2>
                              <p className="text-[10px] font-mono font-bold text-slate-700">Serial: {selectedInvoice.invoice_number}</p>
                              <p className="text-[10px] text-slate-500">Date: {selectedInvoice.invoice_date}</p>
                            </div>
                          </div>

                          {/* Customer Outstanding Breakdown boxes */}
                          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-150 rounded-xl">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Retail customer</span>
                              <p className="font-extrabold text-slate-900 text-xs">{selectedInvoice.customer_shop}</p>
                              <p className="text-[10px] text-slate-500 font-bold">{selectedInvoice.customer_name}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">Ph: {selectedInvoice.customer_contact || '-'}</p>
                            </div>
                            <div className="border-l border-slate-200 pl-4 space-y-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Distribution Handover</span>
                              <p className="text-[10px] text-slate-700 font-bold">Salesperson: {selectedInvoice.salesman_name || 'Counter General Agent'}</p>
                              <p className="text-[10px] text-slate-700 font-bold">Target Route: {selectedInvoice.route || 'Local Territory'}</p>
                              <p className="text-[10px] text-slate-700 font-bold">Payment Channel: <span className="font-mono text-xs text-amber-600 font-black uppercase">{selectedInvoice.payment_method}</span></p>
                            </div>
                          </div>

                          {/* If consolidated, list origin sub invoices */}
                          {selectedInvoice.is_consolidated === 2 && selectedInvoice.childInvoices && (
                            <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl space-y-1">
                              <span className="text-[9px] font-black text-indigo-750 uppercase tracking-widest block">Consolidated Child Invoices merged:</span>
                              <div className="flex flex-wrap gap-2">
                                {selectedInvoice.childInvoices.map((ch: any) => (
                                  <span key={ch.id} className="bg-white px-2 py-0.5 rounded text-[8px] font-black text-indigo-900 border border-indigo-200">
                                    {ch.invoice_number} (Rs. {ch.total_amount.toLocaleString()})
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Line Items Grid layout */}
                          {selectedInvoice.is_consolidated !== 2 && (
                            <table className="w-full text-left border-collapse border border-slate-250">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                  <th className="p-3">SKU details</th>
                                  <th className="p-3 text-center">Units</th>
                                  <th className="p-3 text-right">TP Unit Price</th>
                                  <th className="p-3 text-right text-slate-500">Retail Target</th>
                                  <th className="p-3 text-right">Discount</th>
                                  <th className="p-3 text-right">Net Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {selectedInvoice.items?.map((item, index) => (
                                  <tr key={index} className="hover:bg-slate-50/20 font-medium">
                                    <td className="p-3 text-slate-900 font-extrabold">{item.sku_name || `SKU ID: ${item.sku_id}`}</td>
                                    <td className="p-3 text-center font-mono font-bold">{item.units}</td>
                                    <td className="p-3 text-right font-mono text-slate-500">Rs. {item.trade_price_per_unit}</td>
                                    <td className="p-3 text-right font-mono text-slate-400">Rs. {item.retail_price?.toFixed(1) || '-'}</td>
                                    <td className="p-3 text-right text-rose-600 font-bold">-{item.discount_percentage}% (Rs.{(item.discount_amount || 0).toLocaleString()})</td>
                                    <td className="p-3 text-right font-mono font-black text-slate-900">Rs. {(item.line_total || 0).toLocaleString(undefined, {minimumFractionDigits: 1})}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* Grand summary calculations */}
                          <div className="flex justify-end pt-4 border-t border-slate-200">
                            <div className="w-72 space-y-2 text-xs">
                              <div className="flex justify-between font-bold text-slate-500 border-b border-slate-100 pb-1.5">
                                <span>Sub-Total Gross Trade:</span>
                                <span className="font-mono">Rs. {(selectedInvoice.subtotal || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-bold text-rose-500 border-b border-slate-100 pb-1.5">
                                <span>Distributor Scheme Off:</span>
                                <span className="font-mono">-Rs. {(selectedInvoice.discount_amount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-black text-slate-900 text-sm border-b-2 border-slate-900 pb-2">
                                <span>Invoice Net Amount:</span>
                                <span className="font-mono">Rs. {(selectedInvoice.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 1})}</span>
                              </div>
                              <div className="flex justify-between text-slate-500 font-bold">
                                <span>Previous Outstanding:</span>
                                <span className="font-mono">Rs. {(selectedInvoice.previous_balance || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-bold text-amber-600 bg-amber-50 rounded p-2 text-xs">
                                <span>Grand Total Outstanding Ledger:</span>
                                <span className="font-mono font-black">Rs. {((selectedInvoice.total_amount || 0) + (selectedInvoice.previous_balance || 0)).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Terms Handover Footer in standard */}
                          <div className="pt-12 flex justify-between items-end border-t border-slate-200">
                            <div className="text-[9px] text-slate-400 font-semibold space-y-1">
                              <p className="uppercase font-bold">Distribution Policy & Credit Terms:</p>
                              <p>• Goods once delivered cannot be returned without verified claim receipt.</p>
                              <p>• Ledger offsets must register voucher code sequence only.</p>
                            </div>
                            <div className="w-44 border-t border-slate-400 text-center pt-2">
                              <p className="text-[9px] font-black uppercase text-slate-900">Authorized Distribution Signature</p>
                            </div>
                          </div>

                        </div>
                      ) : (
                        /* THERMAL MONOSPACE ROLL (MOCK BLUETOOTH PRINTER OUT) */
                        <div id="print-sheet-thermal" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner flex justify-center">
                          <div className="w-[58mm] select-all uppercase font-mono text-[9px] text-black bg-white p-4 shadow-sm space-y-3 leading-tight" style={{ border: '2px solid #ccc' }}>
                            <div className="text-center space-y-1 border-b border-dashed border-black pb-2">
                              <p className="text-xs font-black">PRIMELINK ENT</p>
                              <p>0310-6548820</p>
                              <p>-------------------------</p>
                              <p className="font-bold">{printLayout === 'thermal' ? 'MOBILE THERMAL BILL' : ''}</p>
                            </div>

                            <div className="space-y-1">
                              <p>INV: #{selectedInvoice.invoice_number}</p>
                              <p>DATE: {selectedInvoice.invoice_date}</p>
                              <p>CUST: {(selectedInvoice.customer_shop || '').slice(0, 18)}</p>
                              <p>ROUTE: {selectedInvoice.route || 'SYS'}</p>
                              <p>CASH/CRED: {selectedInvoice.payment_method}</p>
                            </div>

                            <p className="border-b border-dashed border-black">-------------------------</p>

                            <table className="w-full text-left font-mono text-[9px]">
                              <thead>
                                <tr className="font-bold border-b border-dashed border-black">
                                  <th>ITEMS</th>
                                  <th className="text-center">QTY</th>
                                  <th className="text-right">VAL</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedInvoice.items?.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>{(item.sku_name || '').slice(0, 12)}</td>
                                    <td className="text-center">{item.cases}C/{item.units}U</td>
                                    <td className="text-right">{(item.line_total || 0).toFixed(0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <p className="border-b border-dashed border-black">-------------------------</p>

                            <div className="space-y-1 text-right">
                              <p>SUBTOTAL: RS. {(selectedInvoice.subtotal || 0).toFixed(0)}</p>
                              <p>SCH OFF: -RS. {(selectedInvoice.discount_amount || 0).toFixed(0)}</p>
                              <p className="font-bold text-xs">NET BILL: RS. {(selectedInvoice.total_amount || 0).toFixed(0)}</p>
                              <p>PREV BAL: RS. {(selectedInvoice.previous_balance || 0).toFixed(0)}</p>
                              <p className="font-bold">DUE LEDG: RS. {((selectedInvoice.total_amount || 0) + (selectedInvoice.previous_balance || 0)).toFixed(0)}</p>
                            </div>

                            <div className="text-center pt-4 border-t border-dashed border-black">
                              <p className="font-bold">THANK YOU FOR YOUR TRUST</p>
                              <p className="text-[7px]">SYSTEM COMPILED - NO INK</p>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-150 text-slate-400 italic">
                      <ShoppingBag className="w-12 h-12 mb-4 opacity-15 text-slate-500" />
                      <p className="text-sm font-bold uppercase tracking-wide">Ledger Registry portal</p>
                      <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Select an invoice to preview printable sheets</p>
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* TAB 2: BOOK AD-HOC SINGLE INVOICE ROW EDITOR */}
            {activeTab === 'single' && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -5 }}
                className="bg-white rounded-3xl border border-slate-200 outline-none p-6 sm:p-8 shadow-xl space-y-6"
              >
                <div className="space-y-1 pb-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-[#222063]">BOOK AD-HOC INVOICE DRAFT</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Keyboard shortcuts: [Enter] on last row creates new line automatically.</p>
                  </div>
                  <div className="px-3.5 py-1.5 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Manual Booking Gate
                  </div>
                </div>

                <form onSubmit={submitSingleInvoice} className="space-y-6">
                  {/* Master attributes info details */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Retail Customer Shop</label>
                      <select
                        required
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                      >
                        <option value="">-- Choose Retailer Account --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.shop_name || c.name} ({c.name})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Salesperson allocation</label>
                      <select
                        value={selectedSalesmanId}
                        onChange={e => setSelectedSalesmanId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                      >
                        <option value="">-- Assign Salesperson --</option>
                        {salesmen.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Billing Date</label>
                      <input
                        type="date"
                        required
                        value={invoiceDate}
                        onChange={e => setInvoiceDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Billing terms</label>
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('Credit')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${
                            paymentMethod === 'Credit' ? 'bg-[#222063] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Credit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('Cash')}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                            paymentMethod === 'Cash' ? 'bg-[#222063] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Cash
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Previous balance info banner */}
                  {selectedCustomerId && (
                    <div className="flex justify-between items-center p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                      <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                        <span>Previous Outstanding Ledger Balance:</span>
                      </div>
                      <span className="font-mono font-black text-amber-800 text-sm">
                        Rs. {getSelectedCustomer(selectedCustomerId)?.balance.toLocaleString() || '0'}
                      </span>
                    </div>
                  )}

                  {/* Data Dense Invoicing Entry Table Grid */}
                  <div className="border border-slate-150 rounded-2xl overflow-hidden mt-6">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-150">
                          <th className="p-3">FMCG Stock Sku details</th>
                          <th className="p-3 text-center w-28">Trade Cases (C)</th>
                          <th className="p-3 text-center w-28">Trade Units (U)</th>
                          <th className="p-3 text-center w-20">TP-Cost</th>
                          <th className="p-3 text-center w-24">Scheme Disc (%)</th>
                          <th className="p-3 text-right w-28">Cash Value</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {singleItems.map((item, index) => (
                          <tr key={index}>
                            <td className="p-2 min-w-[200px]">
                              <OmniSearch
                                type="products"
                                value={item.sku_id || ''}
                                onSelect={selectedProduct => handleSingleSkuChange(index, selectedProduct.id)}
                                onClear={() => handleSingleSkuChange(index, 0)}
                                placeholder="Type SKU name or ID..."
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={item.cases || ''}
                                onChange={e => handleSingleQtyChange(index, 'cases', Number(e.target.value))}
                                onKeyDown={e => handleKeyDown(e, index)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={item.units || ''}
                                onChange={e => handleSingleQtyChange(index, 'units', Number(e.target.value))}
                                onKeyDown={e => handleKeyDown(e, index)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none font-mono"
                              />
                            </td>
                            <td className="p-2 text-center text-xs text-slate-400 font-mono">
                              Rs. {item.trade_price_per_unit || 0}
                            </td>
                            <td className="p-2">
                              <div className="relative">
                                <input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  max="100"
                                  value={item.discount_percentage || ''}
                                  onChange={e => handleSingleDiscountChange(index, Number(e.target.value))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pr-6 text-center text-xs font-bold outline-none"
                                />
                                <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2" />
                              </div>
                            </td>
                            <td className="p-2 text-right text-xs font-mono font-black text-slate-900 pr-4">
                              Rs. {item.line_total.toLocaleString()}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeSingleItemRow(index)}
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

                  <button
                    type="button"
                    onClick={addSingleItemRow}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#222063] border border-slate-200 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100"
                  >
                    + Add New Invoice Line Row
                  </button>

                  {/* Summary notes */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ledger Remind Instructions / Shipping Specifications</label>
                    <textarea
                      rows={2}
                      placeholder="Add specific details like: 'Handover to wholesale assistant after noon' or similar distribution instructions..."
                      value={invoiceNotes}
                      onChange={e => setInvoiceNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-amber-500/10"
                    />
                  </div>

                  {/* Live Totals Bar Indicator */}
                  <div className="bg-slate-950 text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Transaction Value</p>
                      <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">Gst 18% included (tp basis)</p>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-accent italic">
                        Rs. {calculateGrandTotals(singleItems).total.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Trigger buttons */}
                  <div className="flex gap-4 pt-4 border-t border-slate-100 justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('manage')}
                      className="px-6 py-3.5 font-black uppercase text-xs tracking-widest text-slate-405 text-center select-none hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-10 py-3.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 select-none"
                    >
                      SAVE
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* TAB 3: GENERATE ROUTE-BASED BATCH INVOICES */}
            {activeTab === 'batch' && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -5 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6"
              >
                {/* Header Module with Segment Control */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase tracking-widest text-[#222063]">MULTI-CUSTOMER BATCH BILLING HUB</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Execute bulk deliveries, standard drops, or convert pre-bookings to final invoices in one transaction.</p>
                  </div>
                  
                  {/* Toggle switch for Batch Modes */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl w-full lg:w-96">
                    <button
                      type="button"
                      onClick={() => {
                        setBatchMode('template');
                        setBatchSelectedCustomers([]);
                        setSelectedOrders([]);
                      }}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-2 ${
                        batchMode === 'template' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> 📦 Standard Drop Template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchMode('bookings');
                        setBatchSelectedCustomers([]);
                        setSelectedOrders([]);
                        fetchPendingOrders();
                      }}
                      className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-2 ${
                        batchMode === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> 📥 Convert Pre-Bookings
                    </button>
                  </div>
                </div>
                {/* CONDITIONAL BILLING CHANNELS: INTERACTIVE BATCH QUEUE VS PRE-BOOKING CONVERSION */}
                {batchMode === 'template' ? (
                  <div className="space-y-6">
                    {/* Intermediate Route Selection Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-150">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-bold">1. Active Dispatch Route</label>
                        <select
                          value={batchRoute}
                          onChange={e => {
                            setBatchRoute(e.target.value);
                            setActiveBatchCustomer('');
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- All Active Routes --</option>
                          {routes.map((rt, i) => (
                            <option key={i} value={rt}>{rt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-bold">2. Field Rep / Salesman Assigned</label>
                        <select
                          value={batchSalesmanId}
                          onChange={e => setBatchSalesmanId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- Unassigned --</option>
                          {salesmen.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block font-bold">3. Batch Dispatch Date</label>
                        <input
                          type="date"
                          value={invoiceDate}
                          onChange={e => setInvoiceDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500 font-mono text-center"
                        />
                      </div>
                    </div>

                    {/* Split Screen Queue Core Layout */}
                    <div className="grid grid-cols-12 gap-6 pt-4 border-t border-slate-100">
                      {/* Customer Queue & Selection Sidebar (col-span-4) */}
                      <div className="col-span-12 lg:col-span-4 space-y-6">
                        {/* Selected Shop Selector block */}
                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-[#222063] uppercase tracking-widest block font-bold">Choose Customer</span>
                            {batchRoute && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-mono font-black">{batchRoute}</span>
                            )}
                          </div>

                          <div className="z-30 relative bg-white border border-slate-200 rounded-xl">
                            <OmniSearch
                              type="customers"
                              value={activeBatchCustomer || ''}
                              filterRoute={batchRoute}
                              onSelect={(selectedC) => {
                                const cId = String(selectedC.id);
                                setActiveBatchCustomer(cId);
                                // Pre-fill item with customer's preset discount!
                                setBatchItems([
                                  {
                                    sku_id: 0,
                                    cases: 0,
                                    units: 0,
                                    trade_price_per_case: 0,
                                    trade_price_per_unit: 0,
                                    retail_price: 0,
                                    discount_percentage: selectedC.discount_pc || 0,
                                    discount_amount: 0,
                                    line_total: 0
                                  }
                                ]);
                              }}
                              onClear={() => {
                                setActiveBatchCustomer('');
                              }}
                              placeholder="Type Customer ID or Name to search..."
                            />
                          </div>
                        </div>

                        {/* Customer Queue Side-Panel */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                              <h4 className="text-[10px] font-extrabold text-[#222063] uppercase tracking-widest leading-none font-bold">Shops in Current Batch</h4>
                              <p className="text-[9px] text-zinc-400 font-medium uppercase mt-1">Pending bulk dispatch queue</p>
                            </div>
                            <span className="bg-slate-950 text-white rounded-xl px-2.5 py-1 text-xs font-mono font-black">
                              {queuedInvoices.length}
                            </span>
                          </div>

                          {queuedInvoices.length === 0 ? (
                            <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl bg-white/50">
                              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Queue is Empty</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Bill an outlet from above to seed queue.</p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                              {queuedInvoices.map((q, idx) => (
                                <div key={idx} className="bg-white border border-slate-150 p-3 rounded-xl flex justify-between items-center shadow-xs hover:border-slate-300 transition-all">
                                  <div className="space-y-0.5">
                                    <p className="font-extrabold text-xs text-slate-900 uppercase tracking-tight truncate max-w-[160px]">{q.customer_shop}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                      {q.items.length} SKUs • Rs. {q.total_amount.toLocaleString()}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQueuedInvoices(prev => prev.filter((_, i) => i !== idx));
                                    }}
                                    className="text-slate-350 hover:text-rose-500 transition-colors p-1"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Pricing Ledger Row Entry Panel (col-span-8) */}
                      <div className="col-span-12 lg:col-span-8 space-y-6">
                        {activeBatchCustomer ? (
                          (() => {
                            const customer = customers.find(c => c.id === Number(activeBatchCustomer));
                            return (
                              <div className="border border-slate-200 rounded-3xl p-6 bg-white shadow-md space-y-6 relative">
                                {/* Active Store Indicator */}
                                <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                                  <div>
                                    <span className="text-[9px] bg-amber-500/10 text-amber-600 font-extrabold px-2 py-0.5 rounded font-mono uppercase tracking-widest">ACTIVE BILLING LEDGER</span>
                                    <h3 className="text-md font-black text-slate-900 mt-1 uppercase leading-none">{customer?.shop_name || customer?.name}</h3>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase mt-1">Predefined Customer discount: <span className="text-emerald-600 font-black">{customer?.discount_pc || 0}% Pre-set</span></p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveBatchCustomer('');
                                      setBatchItems([
                                        { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
                                      ]);
                                    }}
                                    className="text-xs text-slate-400 hover:text-slate-650 font-bold uppercase transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>

                                {/* Pricing Ledger Table Grid */}
                                <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-slate-50/20">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                      <thead className="bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-150 sticky top-0 bg-slate-50">
                                        <tr>
                                          <th className="p-3 text-center w-8">#</th>
                                          <th className="p-3">SKU Product</th>
                                          <th className="p-3 w-28 text-center">Batch</th>
                                          <th className="p-3 w-24 text-center">Expiry</th>
                                          <th className="p-3 text-center w-16">Cases</th>
                                          <th className="p-3 text-center w-16">Units</th>
                                          <th className="p-3 text-center w-28">Discounted Price</th>
                                          <th className="p-3 text-right pr-4 w-28">Amount</th>
                                          <th className="p-3 text-center w-8"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {batchItems.map((item, index) => {
                                          const batches = inventory.filter(inv => inv.sku_id === item.sku_id && inv.batch_number);
                                          return (
                                            <tr key={index}>
                                              {/* Row index # */}
                                              <td className="p-2 text-center text-xs font-mono text-slate-400">{index + 1}</td>
                                              
                                              {/* SKU dropdown */}
                                              <td className="p-1 min-w-[200px]">
                                                <OmniSearch
                                                  type="products"
                                                  value={item.sku_id || ''}
                                                  onSelect={selectedProduct => handleBatchSkuChange(index, selectedProduct.id)}
                                                  onClear={() => handleBatchSkuChange(index, 0)}
                                                  placeholder="Type SKU name or ID..."
                                                />
                                              </td>

                                              {/* Batch no dropdown or input */}
                                              <td className="p-1">
                                                {item.sku_id > 0 ? (
                                                  batches.length > 1 ? (
                                                    <select
                                                      value={item.batch_number || ''}
                                                      data-batch-row={index}
                                                      data-batch-field="batch"
                                                      onChange={e => handleBatchNumberChange(index, e.target.value)}
                                                      onKeyDown={e => handleBatchKeyDown(e, index, 'batch')}
                                                      className="w-full bg-amber-500/10 border border-amber-305 rounded-lg p-2 text-xs font-bold text-amber-900 outline-none"
                                                    >
                                                      {batches.map((bReg, bIdx) => (
                                                        <option key={bIdx} value={bReg.batch_number}>
                                                          {bReg.batch_number} (Qty: {bReg.quantity_units || bReg.quantity || 0})
                                                        </option>
                                                      ))}
                                                    </select>
                                                  ) : (
                                                    <input
                                                      type="text"
                                                      readOnly
                                                      value={item.batch_number || 'Default'}
                                                      data-batch-row={index}
                                                      data-batch-field="batch"
                                                      onKeyDown={e => handleBatchKeyDown(e, index, 'batch')}
                                                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-mono font-bold text-slate-550 outline-none"
                                                    />
                                                  )
                                                ) : (
                                                  <span className="text-[10px] text-slate-300 italic block text-center">-</span>
                                                )}
                                              </td>

                                              {/* Expiry date displaying */}
                                              {/* Cases integer input */}
                                              <td className="p-1">
                                                <input
                                                  type="number"
                                                  placeholder="0"
                                                  min="0"
                                                  required
                                                  value={item.cases || ''}
                                                  data-batch-row={index}
                                                  data-batch-field="cases"
                                                  onChange={e => handleBatchQtyChange(index, 'cases', Number(e.target.value))}
                                                  onKeyDown={e => handleBatchKeyDown(e, index, 'cases')}
                                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none font-mono"
                                                />
                                              </td>

                                              <td className="p-1 text-center font-mono text-[9px] text-slate-500 uppercase truncate">
                                                {item.sku_id > 0 ? (item.expiry_date || 'No Expiry') : '-'}
                                              </td>



                                              {/* Units integer input */}
                                              <td className="p-1">
                                                <input
                                                  type="number"
                                                  placeholder="0"
                                                  min="0"
                                                  required
                                                  value={item.units || ''}
                                                  data-batch-row={index}
                                                  data-batch-field="units"
                                                  onChange={e => handleBatchQtyChange(index, 'units', Number(e.target.value))}
                                                  onKeyDown={e => handleBatchKeyDown(e, index, 'units')}
                                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none font-mono"
                                                />
                                              </td>

                                              {/* Discounted Trade rates Info cells */}
                                              <td className="p-1 text-center font-mono text-[10px] text-slate-705 leading-tight">
                                                {item.sku_id > 0 ? (
                                                  <div>
                                                    <p className="font-extrabold text-[#222063]">
                                                      Rs. {((item.trade_price_per_case || 0) * (1 - (item.discount_percentage || 0) / 100)).toLocaleString()} <span className="text-[8px] opacity-60">/cs</span>
                                                    </p>
                                                    <p className="opacity-60 text-[9px]">
                                                      Rs. {((item.trade_price_per_unit || 0) * (1 - (item.discount_percentage || 0) / 100)).toLocaleString()} <span className="text-[8px]">/un</span>
                                                    </p>
                                                  </div>
                                                ) : (
                                                  <span className="text-slate-300">-</span>
                                                )}
                                              </td>

                                              {/* Row Amount Calculation */}
                                              <td className="p-1 text-right text-xs font-mono font-black text-slate-900 pr-4">
                                                Rs. {item.line_total.toLocaleString()}
                                              </td>

                                              {/* Trash/Remove cell */}
                                              <td className="p-1 text-center">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (batchItems.length > 1) {
                                                      const updated = batchItems.filter((_, i) => i !== index);
                                                      setBatchItems(updated);
                                                    } else {
                                                      setBatchItems([{ sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }]);
                                                    }
                                                  }}
                                                  className="text-slate-300 hover:text-rose-500 transition-colors"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-dashed border-slate-200 text-slate-500">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-[#222063] block font-semibold">ENTER key auto-generates next SKU lines</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBatchItems(prev => [
                                        ...prev,
                                        { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
                                      ]);
                                    }}
                                    className="text-[9px] font-black uppercase tracking-widest text-[#222063] border border-slate-200 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 font-bold transition-all shadow-xs"
                                  >
                                    + Add Item Line
                                  </button>
                                </div>

                                {/* Ledger Delivery instruction notes */}
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-bold">Ledger Statement / Delivery Notes (Optional)</label>
                                  <textarea
                                    rows={2}
                                    placeholder="E.g., Verified physical outer packaging seals, trade scheme discount applied."
                                    value={invoiceNotes}
                                    onChange={e => setInvoiceNotes(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-205 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 font-medium"
                                  />
                                </div>

                                {/* Grand Sub-sum block */}
                                <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-md">
                                  <div>
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Net Store Invoice Subtotal</h5>
                                    <p className="text-[9px] text-zinc-400 mt-1 uppercase font-semibold">Predefined discount of store is accounted</p>
                                  </div>
                                  <span className="text-xl font-black text-amber-500 font-mono">
                                    Rs. {calculateGrandTotals(batchItems).total.toLocaleString()}
                                  </span>
                                </div>

                                {/* Invoice-Level Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveBatchCustomer('');
                                      setBatchItems([
                                        { sku_id: 0, cases: 0, units: 0, trade_price_per_case: 0, trade_price_per_unit: 0, retail_price: 0, discount_percentage: 0, discount_amount: 0, line_total: 0 }
                                      ]);
                                      setInvoiceNotes('');
                                    }}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 rounded-xl text-[10px] font-extrabold uppercase tracking-widest select-none cursor-pointer transition-colors flex items-center gap-1.5"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-slate-500" /> Add New
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveAndCloseInvoice}
                                    className="px-4 py-2.5 border border-slate-200 text-slate-650 hover:bg-slate-50 rounded-xl text-[10px] font-extrabold uppercase tracking-widest select-none cursor-pointer transition-colors"
                                  >
                                    Save & Close Invoice
                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveAndAddNextCustomer}
                                    className="px-5 py-2.5 bg-[#222063] hover:bg-[#181648] text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest select-none cursor-pointer transition-colors flex items-center gap-1.5 shadow"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Save & Add Next Customer
                                  </button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="border border-dashed border-slate-200 rounded-3xl p-12 text-center bg-slate-50/50 flex flex-col items-center justify-center min-h-[350px]">
                            <div className="bg-amber-500/10 p-4 rounded-full text-amber-500 mb-4 animate-bounce">
                              <ShoppingBag className="w-8 h-8" />
                            </div>
                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest mb-1 font-bold">Pricing Ledger Desk</h4>
                            <p className="text-[11px] text-slate-400 max-w-sm mb-6">
                              Choose a customer outlet from the left side-panel to begin customized batch pricing and billing allocations.
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.querySelector('input[placeholder*="Type Customer ID"]') as HTMLInputElement;
                                if (input) {
                                  input.focus();
                                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow select-none cursor-pointer transition-all animate-pulse"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-500" /> Start Invoicing (Add New Customer)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Global Batch-Level Bottom Action Bar */}
                    <div className="bg-slate-950 text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800 mt-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-500 text-slate-950 p-2.5 rounded-xl">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest leading-none font-bold">Global Batch Controller</h4>
                          <p className="text-[10px] text-zinc-400 mt-1 uppercase font-semibold">
                            {queuedInvoices.length} Retailers currently structured in the batch pipeline
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const dropEl = document.querySelector('select[value=""]') as HTMLSelectElement | null;
                            if (dropEl) {
                              dropEl.click();
                            } else {
                              alert("Please click 'Choose Customer' select box in the left sidebar cluster!");
                            }
                          }}
                          className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-250 rounded-xl text-[10px] font-black uppercase tracking-widest select-none transition-colors border border-slate-800 shadow-sm"
                        >
                          Add Customer to Batch
                        </button>
                        
                        <button
                          type="button"
                          onClick={handlePrintBatchQueue}
                          disabled={queuedInvoices.length === 0}
                          className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest select-none transition-colors flex items-center justify-center gap-1.5 border shadow-sm ${
                            queuedInvoices.length > 0 
                              ? 'bg-[#222063] hover:bg-[#171549] text-amber-500 border-indigo-950/25' 
                              : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          }`}
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Batch
                        </button>

                        <button
                          type="button"
                          onClick={saveFullBatch}
                          disabled={queuedInvoices.length === 0}
                          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest select-none transition-colors shadow flex items-center justify-center gap-1.5 ${
                            queuedInvoices.length > 0 
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' 
                              : 'bg-slate-900 text-slate-700 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Save Full Batch
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // ORIGINAL CONVERT PRE-BOOKINGS CHANNEL WITH TARGET FILTERS
                  <div className="space-y-6">
                    {/* Filter controls row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                      {/* Route selector */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-bold">Filter Route</label>
                        <select
                          value={batchRoute}
                          onChange={e => {
                            setBatchRoute(e.target.value);
                            const matching = customers.filter(c => !e.target.value || c.route === e.target.value).map(c => c.id);
                            setBatchSelectedCustomers(matching);
                          }}
                          className="w-full bg-white border border-slate-205 rounded-lg p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- All Routes --</option>
                          {routes.map((rt, i) => (
                            <option key={i} value={rt}>{rt}</option>
                          ))}
                        </select>
                      </div>

                      {/* Territory Filter text block */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-bold">Territory Search</label>
                        <input
                          type="text"
                          placeholder="E.g., Swat, Pesh..."
                          value={filterTerritory}
                          onChange={e => setFilterTerritory(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Representative */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-bold">Representative</label>
                        <select
                          value={batchSalesmanId}
                          onChange={e => setBatchSalesmanId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- Unassigned --</option>
                          {salesmen.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Customer Category */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-bold">Shop category</label>
                        <select
                          value={filterCategory}
                          onChange={e => setFilterCategory(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-lg p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">-- All Categories --</option>
                          <option value="Retailer">General Retailer</option>
                          <option value="Wholesaler">Wholesale Distributor</option>
                          <option value="Superstore">Mart / Superstore</option>
                        </select>
                      </div>

                      {/* Search Name/Shop */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 tracking-wider font-bold">Search Name/Shop</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Filter name..."
                            value={customerGridSearch}
                            onChange={e => setCustomerGridSearch(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2 p-2 text-[11px] font-bold outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {/* Customer Selection Table List */}
                    <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 text-[9px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-50 border-b border-slate-150 z-10">
                            <tr>
                              <th className="p-3 w-12 text-center">
                                <input
                                  type="checkbox"
                                  checked={getFilteredCustomers().length > 0 && getFilteredCustomers().every(c => batchSelectedCustomers.includes(c.id))}
                                  onChange={() => {
                                    const filtered = getFilteredCustomers();
                                    const allSelected = filtered.every(c => batchSelectedCustomers.includes(c.id));
                                    if (allSelected) {
                                      setBatchSelectedCustomers(prev => prev.filter(id => !filtered.some(f => f.id === id)));
                                    } else {
                                      setBatchSelectedCustomers(prev => Array.from(new Set([...prev, ...filtered.map(f => f.id)])));
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500"
                                />
                              </th>
                              <th className="p-3">Shop Profile (Outlet Owner)</th>
                              <th className="p-3">Contact</th>
                              <th className="p-3">Territory & Route</th>
                              <th className="p-3 text-right">Ledger Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                            {getFilteredCustomers().length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                  No registered outlets found matching filters...
                                </td>
                              </tr>
                            ) : (
                              getFilteredCustomers().map(c => {
                                const isChosen = batchSelectedCustomers.includes(c.id);
                                return (
                                  <tr 
                                    key={c.id}
                                    onClick={() => {
                                      if (isChosen) {
                                        setBatchSelectedCustomers(batchSelectedCustomers.filter(id => id !== c.id));
                                      } else {
                                        setBatchSelectedCustomers([...batchSelectedCustomers, c.id]);
                                      }
                                    }}
                                    className={`cursor-pointer hover:bg-slate-50/50 transition-colors ${
                                      isChosen ? 'bg-amber-500/5' : ''
                                    }`}
                                  >
                                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isChosen}
                                        onChange={() => {
                                          if (isChosen) {
                                            setBatchSelectedCustomers(batchSelectedCustomers.filter(id => id !== c.id));
                                          } else {
                                            setBatchSelectedCustomers([...batchSelectedCustomers, c.id]);
                                          }
                                        }}
                                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500"
                                      />
                                    </td>
                                    <td className="p-3">
                                      <div className="font-extrabold text-slate-900">{c.shop_name || 'Generic Shop'}</div>
                                      <div className="text-[9px] text-slate-400 font-bold">{c.name}</div>
                                    </td>
                                    <td className="p-3 font-mono font-medium text-slate-600">{c.contact || '--'}</td>
                                    <td className="p-3">
                                      <div className="font-bold text-[#222063]">{c.route || 'Local Route'}</div>
                                      <div className="text-[9px] text-slate-400 font-bold uppercase">{c.territory || 'Default'}</div>
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-slate-900">
                                      Rs. {(c.balance || 0).toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-150">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-[#222063] uppercase tracking-widest block font-bold">2. Select Pending Booking Orders of Chosen Customers ({getFilteredPendingOrders().length} Found)</span>
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-200 font-bold px-2.5 py-1 rounded-lg font-mono">
                          {selectedOrders.length} Selected Bookings
                        </span>
                      </div>

                      <div className="border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-white">
                        <div className="max-h-72 overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 text-[9px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-50 border-b border-slate-150 z-10">
                              <tr>
                                <th className="p-3 w-12 text-center">
                                  <input
                                    type="checkbox"
                                    checked={getFilteredPendingOrders().length > 0 && getFilteredPendingOrders().every(o => selectedOrders.includes(o.id))}
                                    onChange={() => {
                                      const bookings = getFilteredPendingOrders();
                                      const allSelected = bookings.every(o => selectedOrders.includes(o.id));
                                      if (allSelected) {
                                        setSelectedOrders(prev => prev.filter(id => !bookings.some(b => b.id === id)));
                                      } else {
                                        setSelectedOrders(prev => Array.from(new Set([...prev, ...bookings.map(b => b.id)])));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-550"
                                  />
                                </th>
                                <th className="p-3">Order Invoice ref</th>
                                <th className="p-3">Customer Shop</th>
                                <th className="p-3 text-center">Product SKU Details</th>
                                <th className="p-3 text-right">Order net valuation</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                              {getFilteredPendingOrders().length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                                    No pending orders match selection...
                                  </td>
                                </tr>
                              ) : (
                                getFilteredPendingOrders().map(order => {
                                  const isSelected = selectedOrders.includes(order.id);
                                  return (
                                    <tr 
                                      key={order.id} 
                                      onClick={() => {
                                        if (isSelected) {
                                          setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                                        } else {
                                          setSelectedOrders([...selectedOrders, order.id]);
                                        }
                                      }}
                                      className={`cursor-pointer hover:bg-slate-50 ${
                                        isSelected ? 'bg-indigo-500/5' : ''
                                      }`}
                                    >
                                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {
                                            if (isSelected) {
                                              setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                                            } else {
                                              setSelectedOrders([...selectedOrders, order.id]);
                                            }
                                          }}
                                          className="w-3.5 h-3.5 rounded text-indigo-500 focus:ring-indigo-500"
                                        />
                                      </td>
                                      <td className="p-3">
                                        <div className="font-extrabold text-slate-900">ID: #{order.id}</div>
                                        <div className="font-mono text-[9px] text-slate-400">{order.order_date || 'N/A'}</div>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-bold text-slate-900">{order.customer_shop || 'Proprietor Shop'}</div>
                                        <div className="text-[9px] text-slate-400 font-bold">{order.customer_name}</div>
                                      </td>
                                      <td className="p-3 text-center font-bold text-[#222063]">
                                        {Array.isArray(order.items) ? `${order.items.length} SKUs` : order.item_count ? `${order.item_count} items` : '1 Item'}
                                      </td>
                                      <td className="p-3 text-right font-mono font-black text-emerald-600">
                                        Rs. {(order.total_amount || 0).toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-slate-900 text-zinc-200 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl mt-6">
                        <div>
                          <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest leading-none">Execute pre-booking conversion</h4>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">
                            Build live invoicing slips for {selectedOrders.length} verified booking structures
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={triggerBatchInvoices}
                          disabled={selectedOrders.length === 0}
                          className={`px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md flex items-center gap-2 select-none ${
                            selectedOrders.length > 0
                              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors'
                              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-4 h-4" /> Convert booking to statements
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 4: WHOLESALE STATEMENT CONSOLIDATION */}
            {activeTab === 'consolidate' && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -5 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6"
              >
                <div className="space-y-1 pb-4 border-b border-slate-100">
                  <h3 className="text-lg font-black uppercase tracking-widest text-[#222063]">WHOLESALE LEDGER BILL CONSOLIDATION</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Merge multiple pending daily delivery bills into one consolidated weekly/monthly invoice.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5 w-full md:w-1/2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">1. Select Wholesale Account</label>
                    <select
                      value={consolidateCustomerId}
                      onChange={e => {
                        setConsolidateCustomerId(e.target.value);
                        setConsolidateSelectedInvoices([]);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/10"
                    >
                      <option value="">-- Choose Wholesale Account outlet --</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.shop_name || c.name} (Outstanding: Rs. {c.balance})</option>
                      ))}
                    </select>
                  </div>

                  {consolidateCustomerId && (
                    <div className="space-y-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">2. Select Un-Consolidated Bills to Merge</span>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {invoices.filter(inv => inv.customer_id === Number(consolidateCustomerId) && inv.is_consolidated === 0).length === 0 ? (
                          <div className="col-span-2 p-8 text-center text-slate-400 border border-dashed rounded-xl italic">
                            No un-consolidated bill statements found for this wholesale account
                          </div>
                        ) : (
                          invoices.filter(inv => inv.customer_id === Number(consolidateCustomerId) && inv.is_consolidated === 0).map(inv => {
                            const isChosen = consolidateSelectedInvoices.includes(inv.id);
                            return (
                              <div
                                key={inv.id}
                                onClick={() => {
                                  if (isChosen) {
                                    setConsolidateSelectedInvoices(consolidateSelectedInvoices.filter(id => id !== inv.id));
                                  } else {
                                    setConsolidateSelectedInvoices([...consolidateSelectedInvoices, inv.id]);
                                  }
                                }}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                                  isChosen ? 'border-amber-500 bg-amber-55/10' : 'border-slate-150 hover:bg-slate-50'
                                }`}
                              >
                                <div className="space-y-1">
                                  <p className="font-extrabold text-[#222063] text-xs">{inv.invoice_number}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">{new Date(inv.invoice_date).toLocaleDateString()} • {inv.payment_method}</p>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <div className="font-mono text-xs font-black text-slate-900">Rs. {(inv.total_amount || 0).toLocaleString()}</div>
                                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                    isChosen ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-300'
                                  }`}>
                                    {isChosen && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {consolidateSelectedInvoices.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-bold">Consolidated Statement remarks</label>
                        <input
                          type="text"
                          value={consolidateNotes}
                          onChange={e => setConsolidateNotes(e.target.value)}
                          placeholder="E.g., Statement merge for May 2026 runs..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                        />
                      </div>

                      {/* Summary Calculation display box */}
                      <div className="p-5 bg-slate-950 rounded-2xl text-white flex justify-between items-center shadow-lg">
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400">Total Merged Valuation</p>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">Merging {consolidateSelectedInvoices.length} outstanding bills securely</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black italic text-accent">
                            Rs. {invoices
                              .filter(inv => consolidateSelectedInvoices.includes(inv.id))
                              .reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
                              .toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          onClick={triggerConsolidation}
                          className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 select-none"
                        >
                          <FileText className="w-4 h-4" /> Finalize Wholesale Consolidated ledger Invoice
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      )}

      {/* ============================================================= */}
      {/* MOBILE (FIELD SALES CONTAINER / INTERACTIVE SMARTPHONE LAYOUT) */}
      {/* ============================================================= */}
      {viewMode === 'mobile' && (
        <div className="max-w-md mx-auto bg-slate-900 rounded-[40px] border-[10px] border-slate-950 overflow-hidden shadow-2xl relative select-none">
          {/* Smartphone Speaker and Camera Notch */}
          <div className="h-6 bg-slate-950 flex justify-center items-center">
            <div className="w-20 h-4 bg-black rounded-b-xl" />
          </div>

          <div className="bg-slate-100 min-h-[75vh] flex flex-col p-4 text-slate-900 space-y-4 font-sans">
            
            {/* Salesman info toolbar */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div>
                <p className="text-[8px] font-black uppercase text-slate-450 tracking-wider">Field Operative UI</p>
                <h4 className="text-xs font-black text-slate-900 flex items-center gap-1">
                  AMIR KHAN <span className="text-[8px] uppercase tracking-widest bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded border border-emerald-100 font-black">Salesman</span>
                </h4>
              </div>
              <div className="text-right">
                <p className="text-[7px] font-bold text-slate-400 uppercase">Swat Route A</p>
                <p className="text-[9px] font-black font-mono text-slate-900">INV-OFFLINE mode</p>
              </div>
            </div>

            {/* Offline draft notices */}
            {offlineQueue.length > 0 && (
              <div className="bg-amber-500 text-slate-950 p-2 text-center text-[9px] font-black rounded-xl uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4" /> Queue has {offlineQueue.length} unsynced orders!
              </div>
            )}

            {/* Simulated barcode scanner section */}
            <div className="bg-white rounded-2xl border border-slate-150 p-3 shadow-sm space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Barcode className="w-4 h-4 text-amber-500" />
                  <span>Interactive Barcode Reader</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerActive(!scannerActive)}
                  className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider ${
                    scannerActive ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {scannerActive ? 'Camera active' : 'Turn on Camera'}
                </button>
              </div>

              {scannerActive && (
                <div className="relative bg-slate-950 rounded-xl h-28 overflow-hidden flex flex-col items-center justify-center text-white">
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-rose-500 animate-bounce" />
                  <p className="text-[8px] tracking-widest font-mono text-slate-400 z-10 font-bold">ALIGNED VIEWPOINT FOR OUTLET SKU</p>
                  <p className="text-[7px] italic text-slate-500 z-10">Scan line active. Type matching SKU key below...</p>
                </div>
              )}

              <div className="flex gap-1">
                <select
                  value={mobileBarcode}
                  onChange={e => setMobileBarcode(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                >
                  <option value="">-- Click to Mock Scan product --</option>
                  {skus.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Case barcode: {s.id})</option>
                  ))}
                </select>
                <button
                  onClick={runMockBarcodeScan}
                  className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black uppercase rounded-lg shadow"
                >
                  Mock scan
                </button>
              </div>

              {mobileMessage && (
                <p className="text-[8px] font-black uppercase tracking-wide text-amber-600 border border-amber-100 bg-amber-50/50 p-1.5 rounded text-center">
                  {mobileMessage}
                </p>
              )}
            </div>

            {/* Mobile Touch Optimized Selection fields */}
            <div className="space-y-2">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-400 tracking-wider uppercase block">Quick Retail Outlet</span>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs outline-none focus:border-amber-500 shadow-sm"
                >
                  <option value="">-- Choose Retail outlet target --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.shop_name || c.name} (Outstanding: {c.balance})</option>
                  ))}
                </select>
              </div>

              {selectedCustomerId && (
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <p className="text-[8px] font-bold uppercase text-slate-400">Previous balance</p>
                    <p className="font-extrabold text-slate-900">Rs. {getSelectedCustomer(selectedCustomerId)?.balance || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold uppercase text-slate-400">Route channel</p>
                    <p className="font-extrabold text-[#222063]">{getSelectedCustomer(selectedCustomerId)?.route || 'A'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Touch basket */}
            <div className="flex-1 flex flex-col space-y-2.5">
              <span className="text-[8px] font-black text-slate-400 tracking-wider uppercase block">Basket Items ({singleItems.filter(i => i.sku_id > 0).length})</span>
              
              <div className="flex-1 space-y-2 max-h-[35vh] overflow-y-auto">
                {singleItems.map((item, index) => {
                  const activeSku = skus.find(s => s.id === item.sku_id);
                  return (
                    <div key={index} className="bg-white rounded-2xl p-3 border border-slate-150 shadow-sm space-y-2.5 relative">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {activeSku ? activeSku.name : `Product Line ${index + 1}`}
                          </p>
                          <p className="text-[9px] font-semibold text-slate-400 mt-0.5">
                            Case cost: Rs. {activeSku ? activeSku.price_per_case : 0}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSingleItemRow(index)}
                          className="text-slate-350 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Large touch plus-minus adjustments */}
                      {item.sku_id > 0 && (
                        <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded-xl border border-slate-150">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            <span>Cases:</span>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => handleSingleQtyChange(index, 'cases', Math.max(0, item.cases - 1))}
                                className="w-7 h-7 bg-white text-slate-900 font-black rounded-lg text-center border active:scale-95"
                              >
                                -
                              </button>
                              <span className="w-7 text-center font-mono font-extrabold">{item.cases}</span>
                              <button
                                type="button"
                                onClick={() => handleSingleQtyChange(index, 'cases', item.cases + 1)}
                                className="w-7 h-7 bg-white text-slate-900 font-black rounded-lg text-center border active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            <span>Units:</span>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={() => handleSingleQtyChange(index, 'units', Math.max(0, item.units - 1))}
                                className="w-7 h-7 bg-white text-slate-900 font-black rounded-lg text-center border active:scale-95"
                              >
                                -
                              </button>
                              <span className="w-7 text-center font-mono font-extrabold">{item.units}</span>
                              <button
                                type="button"
                                onClick={() => handleSingleQtyChange(index, 'units', item.units + 1)}
                                className="w-7 h-7 bg-white text-slate-900 font-black rounded-lg text-center border active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Manual Select SKU triggers */}
                      {item.sku_id === 0 && (
                        <select
                          value={item.sku_id || ''}
                          onChange={e => handleSingleSkuChange(index, Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none"
                        >
                          <option value="">-- Tap to Select Product --</option>
                          {skus.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add basket button */}
              <button
                type="button"
                onClick={addSingleItemRow}
                className="w-full text-center py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-150 rounded-xl hover:bg-slate-50/50 shadow-sm"
              >
                + Tap to Add Basket Sku Row
              </button>
            </div>

            {/* Mobile Footer billing summaries */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3 shadow-lg">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <p className="text-[7px] uppercase font-black tracking-widest text-slate-400">Total payable</p>
                  <p className="text-sm font-black italic text-amber-500 font-mono">
                    Rs. {calculateGrandTotals(singleItems).total.toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={submitSingleInvoice}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-3 rounded-xl text-[10px] uppercase tracking-wider shadow-lg active:scale-95 select-none"
                >
                  {isOffline ? 'Queue Offline Bill' : 'Book Billing Receipt'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* GENERIC PROGRESS MODAL FOR BACKGROUND OPERATIONS */}
      <AnimatePresence>
        {isGenerating && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl border border-slate-100"
            >
              <div className="flex justify-center">
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-amber-500 animate-spin" />
                  <span className="absolute text-xs font-mono font-black text-slate-800">{generationProgress}%</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#222063]">Background Invoice Factory</h4>
                <p className="text-xs font-bold text-slate-500 h-8 uppercase tracking-wide">{generationStatus}</p>
              </div>

              {/* Real life micro loading bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>

              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                DO NOT CLOSE THIS TAB OR SHUT OFF SYSTEM
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BATCH SUMMARY REPORT / LOADOUT SHEET MANIFEST */}
      <AnimatePresence>
        {showBatchSummary && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-40 p-4 overflow-y-auto">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-150"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                <div className="space-y-1">
                  <span className="text-[9px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-black uppercase tracking-wider font-mono">LOGISTICAL MANIFEST</span>
                  <h3 className="text-base font-black uppercase tracking-widest">📋 Warehouse Loading Sheet & Daily Dispatches</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowBatchSummary(false)}
                  className="text-slate-400 hover:text-white font-extrabold text-sm"
                >
                  ✕ Close
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Top general statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 border rounded-2xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Documents Commissioned</span>
                    <p className="text-xl font-black text-slate-900 font-mono">{generatedBatchInvoices.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border rounded-2xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Cumulative Value Dispatched</span>
                    <p className="text-xl font-black text-emerald-600 font-mono font-bold">
                      Rs. {generatedBatchInvoices.reduce((sum, inv) => sum + inv.total_amount, 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 border rounded-2xl">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Selected Territory Route</span>
                    <p className="text-xl font-black text-[#222063] truncate">
                      {generatedBatchInvoices[0]?.route || batchRoute || 'Multiple Routes'}
                    </p>
                  </div>
                </div>

                {/* WAREHOUSE SUMMARIZED STOCK REQUIREMENT (LOADOUT MANIFEST) */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">1. Loadout Stock Aggregate Inventory (Warehouse Pull Requirement)</h4>
                  <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b">
                          <th className="p-3">SKU Name</th>
                          <th className="p-3 text-center">Standard Packing</th>
                          <th className="p-3 text-center">Total Cases Needed</th>
                          <th className="p-3 text-center">Loose Units Needed</th>
                          <th className="p-3 text-right pr-4 font-mono">Status check</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {getWarehouseLoadingSheet().length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400 italic">No inventory totals generated...</td>
                          </tr>
                        ) : (
                          getWarehouseLoadingSheet().map((row: any, i) => (
                            <tr key={i}>
                              <td className="p-3 font-bold text-slate-900">{row.name}</td>
                              <td className="p-3 text-center text-slate-400 font-mono font-bold text-[10px]">{row.unitsPerCase} Units/Case</td>
                              <td className="p-3 text-center text-slate-905 font-mono font-black">{row.cases} cs</td>
                              <td className="p-3 text-center text-slate-600 font-mono font-semibold">{row.units} loose</td>
                              <td className="p-3 text-right pr-4 text-emerald-600 font-bold font-mono">Available ✓</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* COMMISSIONED INVOICES CHECKS */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">2. Allocated Customers Invoice Registers</h4>
                  <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-48 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b sticky top-0 bg-slate-50 z-10">
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Outlet Profile Name</th>
                          <th className="p-3">Route / Territory</th>
                          <th className="p-3 text-right pr-4">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {generatedBatchInvoices.map((inv, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-3 font-extrabold text-[#222063] font-mono">{inv.invoice_number}</td>
                            <td className="p-3">
                              <div className="font-extrabold text-slate-900">{inv.customer_shop || inv.customer_name}</div>
                              <div className="text-[9px] text-slate-400 font-bold">{inv.customer_name}</div>
                            </td>
                            <td className="p-3 font-semibold text-slate-550">{inv.route || 'Local Swat'}</td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 font-bold">
                              Rs. {(inv.total_amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal footer with Bulk Actions */}
              <div className="bg-slate-100 border-t p-6 flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-50">
                <div className="text-[10px] text-slate-450 uppercase font-black tracking-widest text-center md:text-left">
                  Select bulk action for generated loadouts
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  {/* Bulk WhatsApp Dispatch Trigger */}
                  <button
                    type="button"
                    onClick={startWhatsappSimulation}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 select-none"
                  >
                    <Share2 className="w-4 h-4 text-[#facc15]" /> Bulk Notify (WhatsApp)
                  </button>

                  {/* Bulk PDF Print Trigger */}
                  <button
                    type="button"
                    onClick={() => setShowBulkPrintView(true)}
                    className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 select-none"
                  >
                    <Printer className="w-4 h-4 text-amber-500" /> Bulk Print Invoices
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchSummary(false);
                      setActiveTab('manage');
                    }}
                    className="px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-black rounded-xl text-xs uppercase"
                  >
                    Finish Routing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK WHATSAPP DISPATCH LOG POPUP */}
      <AnimatePresence>
        {showWhatsappModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="bg-emerald-950 text-white p-6">
                <h3 className="text-base font-black uppercase tracking-widest flex items-center gap-2">
                  📲 WhatsApp Bulk Dispatch Dispatcher ({whatsappProgress}%)
                </h3>
                <p className="text-[10px] text-emerald-300 uppercase tracking-widest font-extrabold mt-0.5">
                  Realtime background dispatcher simulator queuing mobile packets.
                </p>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Queued dispatches</p>
                    <p className="text-lg font-black text-slate-800 font-bold">{whatsappQueue.length} Outlets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Running Status</p>
                    <p className={`text-xs font-black uppercase ${isWhatsappSending ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`}>
                      {isWhatsappSending ? 'Active stream running...' : 'All messages dispatched! ✓'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {whatsappQueue.map((item, index) => (
                    <div 
                      key={index}
                      className="p-3 bg-white border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          item.status === 'sent' ? 'bg-emerald-105 text-emerald-800 bg-emerald-100' :
                          item.status === 'sending' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {item.status === 'sent' ? '✓' : item.status === 'sending' ? '↻' : '••'}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-900">{item.shop}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-bold">Contact: {item.phone} • {item.invoiceNo}</p>
                        </div>
                      </div>
                      
                      <div className="text-right flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.status === 'sent' ? 'bg-emerald-50 text-emerald-700' :
                          item.status === 'sending' ? 'bg-amber-50 text-amber-600' :
                          'bg-slate-50 text-slate-400'
                        }`}>
                          {item.status === 'sent' ? 'Sent' :
                           item.status === 'sending' ? 'Transmitting' : 'Waiting'}
                        </span>
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[9px] font-black text-[#222063] border border-slate-200 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 uppercase"
                        >
                          Manual Link
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-5 border-t text-right flex justify-between items-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Do not refresh. Processes completely locally.
                </p>
                <button
                  type="button"
                  disabled={isWhatsappSending}
                  onClick={() => setShowWhatsappModal(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-black uppercase rounded-lg disabled:opacity-50"
                >
                  Finished Logs
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BULK INVOICES PRINT CONTAINER OVERLAY */}
      <AnimatePresence>
        {showBulkPrintView && (
          <div id="bulk-printed-page-overlay" className="fixed inset-0 bg-white z-50 overflow-y-auto block p-8">
            {/* Print Control Ribbon (NOT printed) */}
            <div className="no-print bg-slate-955 p-4 -mx-8 -mt-8 mb-8 text-white flex justify-between items-center shadow-lg px-8 sticky top-0 z-50 bg-slate-950">
              <div>
                <span className="text-[9px] bg-amber-500 text-slate-950 font-black tracking-widest uppercase px-2 py-0.5 rounded font-mono">DMS BULK PRINTER</span>
                <h4 className="text-sm font-black text-amber-500 uppercase tracking-wider mt-0.5">📄 Consolidated Dispatch Invert Pile ({generatedBatchInvoices.length} Invoices)</h4>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs uppercase tracking-wider flex items-center gap-2 select-none"
                >
                  <Printer className="w-4 h-4" /> Trigger System Print Dialog
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkPrintView(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-black rounded-lg text-xs uppercase"
                >
                  Back to Hub
                </button>
              </div>
            </div>

            {/* Main Print Sheets Stack */}
            <div id="bulk-print-wrapper" className="max-w-4xl mx-auto space-y-12">
              {generatedBatchInvoices.map((inv, idx) => (
                <div 
                  key={idx} 
                  className="p-8 border border-slate-300 rounded-3xl shadow bg-white relative space-y-6 overflow-hidden A4-print-sheet"
                  style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                >
                  {/* Invoice Print Header */}
                  <div className="flex justify-between items-start border-b border-dashed border-slate-300 pb-6">
                    <div className="space-y-1">
                      <span className="font-extrabold text-[10px] tracking-widest text-[#222063] uppercase border border-[#222063]/25 px-2 py-0.5 rounded font-mono">OFFICIAL TAX STATEMENT</span>
                      <h1 className="text-xl font-black text-slate-900 leading-none mt-1.5">PRIMELINK DMS</h1>
                      <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">Khyber Pakhtunkhwa FMCG Distribution Network</p>
                    </div>
                    <div className="text-right space-y-1 font-mono text-xs text-slate-800">
                      <p className="font-black text-rose-600">INVOICE: {inv.invoice_number}</p>
                      <p className="font-bold">DATE: {new Date(inv.invoice_date).toLocaleDateString()}</p>
                      <p className="font-bold">STATUS: UNPAID (CREDIT LEDGER MODE)</p>
                    </div>
                  </div>

                  {/* Bill of To / Bill From Address details */}
                  <div className="grid grid-cols-2 gap-8 text-xs border-b border-slate-100 pb-5">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-40 tracking-wider text-slate-405 mb-1.5 font-mono">Delivered and Billed To:</p>
                      <h3 className="font-black text-slate-900 uppercase text-sm">{inv.customer_shop || 'Unknown Shop'}</h3>
                      <p className="text-slate-500 font-medium">{inv.customer_name || 'Outlet proprietor'}</p>
                      <p className="text-slate-500 font-mono">Contact: {inv.customer_contact || 'None registered'}</p>
                      <p className="text-[#222063] font-bold text-[10px] uppercase font-mono mt-1">Route: {inv.route || 'Swat Cluster'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5 font-mono">Bookkeeper / Sales rep details:</p>
                      <h3 className="font-extrabold text-slate-800 text-sm">{inv.salesman_name || 'Swat Route Rep'}</h3>
                      <p className="text-slate-450">Territories: Swat Valley Cluster</p>
                      <p className="text-slate-400">Warehouse Point: Swat HQ Depot 1</p>
                    </div>
                  </div>

                  {/* Invoice Line items */}
                  <div className="space-y-2">
                    <div className="border border-slate-205 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <th className="p-3">Product Name SKU Description</th>
                            <th className="p-3 text-center">Units</th>
                            <th className="p-3 text-right">Trade Rate (cs)</th>
                            <th className="p-3 text-right">Disc %</th>
                            <th className="p-3 text-right pr-4">Line Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px] font-medium">
                          {inv.items && inv.items.map((line: any, lIdx: number) => (
                            <tr key={lIdx}>
                              <td className="p-3 font-bold text-slate-900">{line.sku_name || 'Product SKU'}</td>
                              <td className="p-3 text-center font-mono text-slate-600">{line.units} loose</td>
                              <td className="p-3 text-right font-mono text-slate-600">Rs. {line.trade_price_per_case?.toLocaleString()}</td>
                              <td className="p-3 text-right font-mono text-slate-500">{line.discount_percentage}%</td>
                              <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 font-bold">Rs. {line.line_total?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Invoicing Net Sum Calculation details */}
                  <div className="flex justify-between items-end pt-4">
                    <div className="max-w-xs text-[10px] text-slate-400 font-bold uppercase leading-relaxed font-mono">
                      Notes: Under dynamic trade volume scheme, trade discounts have been aggregated on respective cases. Outstanding ledger values will adjust upon confirmation at warehouses.
                    </div>
                    <div className="w-64 bg-slate-900 text-white p-5 rounded-2xl space-y-2 shadow-md">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Gross Value:</span>
                        <span className="font-mono">Rs. {inv.subtotal?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Trade Discount:</span>
                        <span className="font-mono font-bold text-rose-400">- Rs. {inv.discount_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black text-amber-500 uppercase pt-2 border-t border-slate-800">
                        <span>Invoice Total:</span>
                        <span className="font-mono">Rs. {inv.total_amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures row */}
                  <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 pt-10 font-mono">
                    <div className="border-t border-slate-300 w-44 text-center pt-2">Authorized Warehouse Head</div>
                    <div className="border-t border-slate-300 w-44 text-center pt-2">Dealer / Store Stamp</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================= */}
      {/* GLOBAL BACKGROUND STYLE PRESERVING COMPACT PRINTS */}
      {/* ============================================================= */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-sheet-a4, #print-sheet-a4 * {
            visibility: visible !important;
          }
          #print-sheet-a4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #print-sheet-thermal, #print-sheet-thermal * {
            visibility: visible !important;
          }
          #bulk-printed-page-overlay, #bulk-print-wrapper, #bulk-print-wrapper * {
            visibility: visible !important;
          }
          #bulk-printed-page-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 105% !important;
            margin: 0 !important;
            padding: 0 !important;
            z-index: 99999999 !important;
          }
          .A4-print-sheet {
            page-break-after: always !important;
            break-after: page !important;
            border: none !important;
            box-shadow: none !important;
            margin-bottom: 2rem !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
