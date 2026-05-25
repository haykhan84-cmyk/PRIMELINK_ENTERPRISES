import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Box, 
  RotateCcw, 
  Download, 
  Filter, 
  Search,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  CheckSquare,
  Square,
  Edit,
  Trash2,
  X,
  Plus,
  Minus,
  Save,
  AlertCircle,
  Banknote,
  CreditCard,
  Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceTemplate } from './InvoiceTemplate';
import { LoadingSheetTemplate } from './LoadingSheetTemplate';
import { triggerPrint } from '../lib/printUtils';
import { formatDate } from '../lib/dateUtils';

import { useSearchParams } from 'react-router-dom';

type ReportType = 'sales' | 'stock' | 'returns' | 'receivables' | 'payables' | 'expenses/daily' | 'expenses/detailed' | 'master-sku' | 'loading-sheet' | 'batch-invoices';

export default function Reports() {
  const [searchParams] = useSearchParams();
  const [activeReport, setActiveReport] = useState<ReportType>('sales');

  useEffect(() => {
    const report = searchParams.get('report') as ReportType;
    if (report && ['sales', 'stock', 'returns', 'receivables', 'payables', 'expenses/daily', 'expenses/detailed', 'master-sku', 'loading-sheet', 'batch-invoices'].includes(report)) {
      setActiveReport(report);
    }
  }, [searchParams]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [receivablesFilter, setReceivablesFilter] = useState<'all' | 'overdue'>('all');
  const [sortKey, setSortKey] = useState<string>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [batchInvoices, setBatchInvoices] = useState<any[]>([]);
  const [loadingSheet, setLoadingSheet] = useState<any[] | null>(null);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<any | null>(null);

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  const formatDateSimple = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const d = date.getDate().toString().padStart(2, '0');
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${mm}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setSelectedOrderIds([]); // Clear selection when switching reports
    try {
      const res = await fetch(`/api/reports/${activeReport}`);
      const data = await res.json();
      setReportData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch report data", err);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fetchInvoiceDetails = async (id: number) => {
    try {
      const o = await fetch(`/api/orders/${id}`).then(res => res.json());
      const templateData = {
        id: o.id,
        customer: { name: o.customer_name, route: o.route || 'Local Swat Route', id: o.customer_id },
        items: o.items.map((i: any) => ({
          sku_id: i.sku_id,
          sku_name: i.sku_name,
          sku: { 
            name: i.sku_name, 
            price_per_case: i.price_per_case, 
            price_per_unit: i.price_per_unit,
            units_per_case: i.units_per_case
          },
          cases: i.cases,
          units: i.units,
          price: i.price
        })),
        total: o.total_amount,
        invoiceNo: o.id.toString(),
        date: formatDate(o.order_date),
        salesmanName: o.salesman_name,
        tax_amount: o.tax_amount,
        further_tax: o.further_tax,
        is_dummy: o.is_dummy
      };
      return templateData;
    } catch (err) {
      console.error("Failed to fetch order details", err);
      return null;
    }
  };

  const showInvoiceDetails = async (id: number) => {
    const details = await fetchInvoiceDetails(id);
    if (details) setViewInvoice(details);
  };

  const startEditOrder = async (id: number) => {
    const details = await fetchInvoiceDetails(id);
    if (details) setEditingOrder(details);
  };

  const handleDeleteOrder = async (id: number) => {
    if (!confirm("Are you sure you want to delete this invoice? This will reverse customer balance changes.")) return;

    try {
      const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchReportData();
        setDeletingOrder(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateOrder = async (updatedOrder: any) => {
    try {
      const res = await fetch(`/api/orders/${updatedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: updatedOrder.items,
          total_amount: updatedOrder.total,
          tax_amount: updatedOrder.tax_amount,
          further_tax: updatedOrder.further_tax
        })
      });

      if (res.ok) {
        setEditingOrder(null);
        fetchReportData();
        alert("Order updated successfully!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update order.");
    }
  };

  const handlePrintLoadingSheet = async () => {
    const targetIds = selectedOrderIds.length > 0 
      ? selectedOrderIds 
      : filteredData.map((d: any) => d.id);

    if (targetIds.length === 0) {
      alert("No pending bookings available to compile a loading sheet.");
      return;
    }
    
    setLoading(true);
    try {
      // Clear sibling print templates to prevent overlapping/bleeding side effects
      setBatchInvoices([]);
      setViewInvoice(null);

      const orders = await Promise.all(
        targetIds.map(id => fetch(`/api/orders/${id}`).then(res => res.json()))
      );
      
      // Aggregrate all items
      const aggregated: { [key: string]: any } = {};
      orders.forEach(order => {
        if (!order || !order.items) return;
        order.items.forEach((item: any) => {
          if (!aggregated[item.sku_name]) {
            aggregated[item.sku_name] = {
              id: item.sku_id,
              name: item.sku_name,
              category: 'General',
              cases: 0,
              units: 0
            };
          }
          aggregated[item.sku_name].cases += item.cases;
          aggregated[item.sku_name].units += item.units;
          
          // Normalize units (12 units = 1 case)
          if (aggregated[item.sku_name].units >= 12) {
            aggregated[item.sku_name].cases += Math.floor(aggregated[item.sku_name].units / 12);
            aggregated[item.sku_name].units %= 12;
          }
        });
      });

      setLoadingSheet(Object.values(aggregated));
      
      setTimeout(() => {
        try {
          triggerPrint();
        } catch (e) {
          alert("Use 'Open Full Application' to print.");
        }
      }, 500);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const batchPrint = async () => {
    const targetIds = selectedOrderIds.length > 0 
      ? selectedOrderIds 
      : filteredData.map((d: any) => d.id);

    if (targetIds.length === 0) {
      alert("No bills available to print batch invoices.");
      return;
    }
    
    setLoading(true);
    try {
      // Clear sibling print templates to prevent overlapping/bleeding side effects
      setLoadingSheet(null);
      setViewInvoice(null);

      // Fetch details for all selected orders
      const orders = await Promise.all(
        targetIds.map(id => fetch(`/api/orders/${id}`).then(res => res.json()))
      );
      
      // Transform into QueuedOrder format for Template
      const templateData = orders.map(o => ({
        customer: { name: o.customer_name, route: o.route || 'Local Swat Route' },
        items: o.items.map((i: any) => ({
          sku: { 
            name: i.sku_name, 
            price_per_case: i.price_per_case, 
            price_per_unit: i.price_per_unit,
            units_per_case: i.units_per_case
          },
          cases: i.cases,
          units: i.units
        })),
        total: o.total_amount,
        invoiceNo: o.id.toString(),
        date: formatDate(o.order_date),
        salesmanName: o.salesman_name,
        is_dummy: o.is_dummy
      }));

      setBatchInvoices(templateData);
      
      // Allow React to render the print section then trigger print
      setTimeout(() => {
        try {
          triggerPrint();
        } catch (e) {
          alert("Use 'Open Full Application' to print the batch.");
        }
      }, 500);
    } catch (err) {
      console.error("Batch print failed", err);
      alert("Error generating batch invoices.");
    } finally {
      setLoading(false);
    }
  };

  const safeReportData = Array.isArray(reportData) ? reportData : [];
  const filteredData = safeReportData.filter(item => {
    const searchString = searchQuery.toLowerCase();
    if (activeReport === 'sales') {
      return (item.customer_name || '').toLowerCase().includes(searchString) || 
             (item.salesman_name || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'stock') {
      return (item.name || '').toLowerCase().includes(searchString) || 
             (item.category || '').toLowerCase().includes(searchString) ||
             (item.supplier_name || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'receivables') {
      const matchesSearch = (item.name || '').toLowerCase().includes(searchString) || 
                            (item.shop_name || '').toLowerCase().includes(searchString) ||
                            (item.route || '').toLowerCase().includes(searchString) ||
                            (item.contact || '').toLowerCase().includes(searchString);
      if (!matchesSearch) return false;
      if (receivablesFilter === 'overdue') {
        return (item.balance || 0) > (item.credit_limit || 0);
      }
      return true;
    } else if (activeReport === 'payables') {
      return (item.name || '').toLowerCase().includes(searchString) || 
             (item.category || '').toLowerCase().includes(searchString) ||
             (item.supplier_name || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'expenses/daily') {
      return (item.category || '').toLowerCase().includes(searchString) || 
             (item.day || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'expenses/detailed') {
      return (item.description || '').toLowerCase().includes(searchString) || 
             (item.category || '').toLowerCase().includes(searchString) ||
             (item.payment_method || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'master-sku') {
      return (item.sku_name || '').toLowerCase().includes(searchString) || 
             (item.category || '').toLowerCase().includes(searchString) ||
             (item.supplier_name || '').toLowerCase().includes(searchString);
    } else if (activeReport === 'loading-sheet' || activeReport === 'batch-invoices') {
      return (item.customer_name || '').toLowerCase().includes(searchString) || 
             (item.salesman_name || '').toLowerCase().includes(searchString);
    } else {
      return (item.customer_name || '').toLowerCase().includes(searchString) || 
             (item.sku_name || '').toLowerCase().includes(searchString);
    }
  }).sort((a, b) => {
    if (activeReport === 'receivables') {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string') {
        const strA = valA.trim().toLowerCase();
        const strB = String(valB).trim().toLowerCase();
        return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      } else {
        const numA = Number(valA);
        const numB = Number(valB);
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
    }
    return 0;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight uppercase">Intelligence & Reports</h1>
          <p className="text-text-muted font-medium text-sm">Actionable insights into Swat distribution performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-primary p-1 rounded-xl border border-white/10 shadow-lg no-print relative z-20">
          {(['sales', 'loading-sheet', 'batch-invoices', 'stock', 'master-sku', 'returns', 'receivables', 'payables', 'expenses/daily', 'expenses/detailed'] as ReportType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveReport(type)}
              className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-30 ${
                activeReport === type 
                  ? 'bg-accent text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type.includes('/') ? type.split('/')[1] : type.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Report Controls */}
      <div className="erp-card flex flex-col md:flex-row items-center gap-4 no-print">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder={`Filter ${activeReport} records...`} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-accent outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto relative z-20">
          {(activeReport === 'sales' || activeReport === 'loading-sheet' || activeReport === 'batch-invoices') && filteredData.length > 0 && (
            <>
              <button 
                onClick={handlePrintLoadingSheet}
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-right-4 transition-all cursor-pointer relative z-30 ring-2 ring-white/20"
              >
                <Box className="w-4 h-4" />
                Warehouse Loading Sheet {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : '(All)'}
              </button>
              <button 
                onClick={batchPrint}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-right-4 transition-all cursor-pointer relative z-30 ring-2 ring-white/20"
              >
                <Printer className="w-4 h-4" />
                Batch Invoices {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : '(All)'}
              </button>
            </>
          )} 
          <button className="btn-outline text-xs py-2 flex items-center gap-2 flex-1 md:flex-none">
            <Calendar className="w-4 h-4" />
            Date Range
          </button>
          <button 
            onClick={() => {
              try {
                window.print();
              } catch (e) {
                alert("Printing may be restricted in this preview. Please click 'Open in New Tab' to print your report.");
              }
            }}
            className="btn-outline text-xs py-2 flex items-center gap-2 flex-1 md:flex-none"
          >
            <Printer className="w-4 h-4" />
            Report Export
          </button>
          <button className="btn-primary text-xs py-2 flex items-center gap-2 bg-emerald-600 border-none flex-1 md:flex-none">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {activeReport === 'receivables' && (
        <div className="erp-card bg-slate-50 border border-slate-200/60 p-4 -mt-3 flex flex-col md:flex-row items-center justify-between gap-4 no-print rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Account Status:</span>
              <div className="flex bg-slate-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReceivablesFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    receivablesFilter === 'all' 
                      ? 'bg-[#222063] text-white shadow' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Outstanding
                </button>
                <button
                  type="button"
                  onClick={() => setReceivablesFilter('overdue')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    receivablesFilter === 'overdue' 
                      ? 'bg-rose-600 text-white shadow' 
                      : 'text-rose-600 hover:bg-rose-100/50'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Overdue (Exceeded Limit)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Sort Field:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 uppercase outline-none focus:ring-2 focus:ring-[#222063] transition-all cursor-pointer text-slate-700 font-mono"
              >
                <option value="balance">Sort by balance due</option>
                <option value="name">Sort by customer name</option>
                <option value="route">Sort by route location</option>
                <option value="credit_limit">Sort by credit limit</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Order:</span>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="bg-white hover:bg-slate-50 text-slate-800 font-black text-[10px] uppercase tracking-wider py-1.5 px-3 rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {sortOrder === 'asc' ? '▲ Ascending' : '▼ Descending'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Print Hidden Template */}
      <div className="print-only bg-white">
        {viewInvoice && <InvoiceTemplate order={viewInvoice} salesmanName={viewInvoice.salesmanName} />}
        {batchInvoices.map((inv, idx) => (
          <InvoiceTemplate key={idx} order={inv} salesmanName={inv.salesmanName} />
        ))}
        {loadingSheet && <LoadingSheetTemplate items={loadingSheet} date={formatDate(new Date())} />}
      </div>

      {/* Invoice Preview Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto no-print">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl relative overflow-hidden"
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Digital Invoice Viewer</h3>
                <p className="text-[10px] font-bold text-slate-400">Order #{viewInvoice.invoiceNo} • {viewInvoice.customer.name}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={triggerPrint}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg"
                >
                  <Printer className="w-3 h-3" />
                  Print Professional
                </button>
                <button 
                  onClick={() => setViewInvoice(null)}
                  className="px-4 py-2 bg-white text-slate-400 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="max-h-[70vh] overflow-y-auto bg-slate-100 p-8 flex justify-center">
               <div className="bg-white shadow-xl w-full max-w-[210mm]">
                  <InvoiceTemplate order={viewInvoice} salesmanName={viewInvoice.salesmanName} />
               </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
               <p className="text-[9px] font-bold text-slate-400 uppercase italic tracking-widest">This digital invoice contains official Primelink Ent. watermarks for verification.</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal 
          order={editingOrder} 
          onSave={handleUpdateOrder} 
          onClose={() => setEditingOrder(null)} 
        />
      )}

      {/* Data Visualization Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        {activeReport.startsWith('expenses') ? (
          <>
            <div className="erp-card bg-slate-950 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <Banknote className="w-5 h-5 text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Salesman Exp</span>
              </div>
              <div className="text-xl font-black mb-1">
                Rs. {reportData.filter(e => (e.category === 'Salesman' || (e.description || '').toLowerCase().includes('salesman'))).reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Field Ops Cost</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-2">
                <CreditCard className="w-5 h-5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Office Admin</span>
              </div>
              <div className="text-xl font-black mb-1">
                Rs. {reportData.filter(e => (e.category === 'Office Admin' || (e.category === 'Salary'))).reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Admin & Payroll</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Internal</span>
              </div>
              <div className="text-xl font-black mb-1">
                Rs. {reportData.filter(e => e.category === 'Internal' || e.category === 'Maintenance').reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Operations Cost</div>
            </div>
            <div className="erp-card p-6 border-l-4 border-rose-600">
              <div className="flex items-center justify-between mb-2">
                <TrendingDown className="w-5 h-5 text-rose-600" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Outflow</span>
              </div>
              <div className="text-xl font-black mb-1 text-rose-600">
                Rs. {reportData.reduce((sum, e) => sum + Number(e.amount || e.total || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Consolidated</div>
            </div>
          </>
        ) : activeReport === 'master-sku' ? (
          <>
            <div className="erp-card bg-slate-900 text-white p-6">
              <div className="flex items-center justify-between mb-2">
                <Box className="w-5 h-5 text-accent" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total SKUs</span>
              </div>
              <div className="text-xl font-black mb-1">{reportData.length}</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Master Collection</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-2">
                <Filter className="w-5 h-5 text-primary" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Categories</span>
              </div>
              <div className="text-xl font-black mb-1">
                {new Set(reportData.map(r => r.category)).size}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Classification</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-warning" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Suppliers</span>
              </div>
              <div className="text-xl font-black mb-1">
                {new Set(reportData.map(r => r.supplier_id)).size}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Active Partners</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-2">
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Avg Cases</span>
              </div>
              <div className="text-xl font-black mb-1">124</div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Portfolio Strength</div>
            </div>
          </>
        ) : activeReport === 'receivables' ? (
          <>
            <div className="erp-card bg-slate-950 text-white p-6 relative overflow-hidden">
              <div className="absolute right-2 bottom-0 opacity-10 pointer-events-none">
                <TrendingUp className="w-24 h-24 text-accent" />
              </div>
              <div className="flex items-center justify-between mb-2 select-none">
                <Banknote className="w-5 h-5 text-accent" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Outstanding</span>
              </div>
              <div className="text-xl font-black mb-1">
                Rs. {safeReportData.reduce((sum, r) => sum + (r.balance || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-accent font-bold uppercase tracking-wide">
                {safeReportData.length} active customer ledgers
              </div>
            </div>

            <div className="erp-card border-l-4 border-rose-600 bg-rose-50/20 p-6 relative overflow-hidden">
              <div className="absolute right-2 bottom-0 opacity-10 pointer-events-none text-rose-600">
                <AlertCircle className="w-24 h-24" />
              </div>
              <div className="flex items-center justify-between mb-2 select-none">
                <AlertCircle className="w-5 h-5 text-rose-600 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Overdue Balances</span>
              </div>
              <div className="text-xl font-black mb-1 text-rose-600">
                Rs. {safeReportData.filter(r => (r.balance || 0) > (r.credit_limit || 0)).reduce((sum, r) => sum + (r.balance || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-rose-700 font-bold uppercase tracking-wide">
                {safeReportData.filter(r => (r.balance || 0) > (r.credit_limit || 0)).length} Exceeded credit limit
              </div>
            </div>

            <div className="erp-card bg-white p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 select-none">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-bold">Secure Balances</span>
              </div>
              <div className="text-xl font-black mb-1 text-emerald-600">
                Rs. {safeReportData.filter(r => (r.balance || 0) <= (r.credit_limit || 0)).reduce((sum, r) => sum + (r.balance || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                Within customer limits
              </div>
            </div>

            <div className="erp-card bg-white p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2 select-none">
                <CreditCard className="w-5 h-5 text-blue-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-bold">Total Credit Line</span>
              </div>
              <div className="text-xl font-black mb-1 text-slate-800">
                Rs. {safeReportData.reduce((sum, r) => sum + (r.credit_limit || 0), 0).toLocaleString()}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                Authorized credit buffer
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="erp-card bg-slate-950 text-white p-6">
              <div className="flex items-center justify-between mb-4">
                <TrendingUp className="w-5 h-5 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Volume</span>
              </div>
              <div className="text-2xl font-black mb-1">
                {activeReport === 'sales' ? `Rs. ${reportData.reduce((sum, r) => sum + r.total_amount, 0).toLocaleString()}` : reportData.length}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Active Records</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance</span>
              </div>
              <div className="text-2xl font-black mb-1">
                {activeReport === 'stock' ? `Rs. ${reportData.reduce((sum, r) => sum + (r.cases * r.unit_price * r.pack_size), 0).toLocaleString()}` : "Stable"}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Market Value</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-4">
                <Box className="w-5 h-5 text-warning" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Health</span>
              </div>
              <div className="text-2xl font-black mb-1">98.2%</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Reliability Index</div>
            </div>
            <div className="erp-card p-6">
              <div className="flex items-center justify-between mb-4">
                <AlertCircle className="w-5 h-5 text-danger" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Factor</span>
              </div>
              <div className="text-2xl font-black mb-1">Low</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">Exposure Level</div>
            </div>
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="erp-card !p-0 overflow-hidden shadow-2xl border-2 border-primary/5 no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-white">
                {(activeReport === 'sales' || activeReport === 'loading-sheet' || activeReport === 'batch-invoices') && (
                  <>
                    <th className="p-4 w-10">
                      <button 
                        onClick={() => {
                          if (selectedOrderIds.length === filteredData.length) {
                            setSelectedOrderIds([]);
                          } else {
                            setSelectedOrderIds(filteredData.map(i => i.id));
                          }
                        }}
                        className="text-white hover:text-accent transition-colors"
                      >
                        {selectedOrderIds.length === filteredData.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Customer</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Salesman</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Amount</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                  </>
                )}
                {activeReport === 'stock' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">SKU Name</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Supplier</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Units/Pack</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Unit Price</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Unit Cost</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Cases</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Qty (Units)</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Health</th>
                  </>
                )}
                {activeReport === 'returns' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Customer</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Product</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Reason</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Qty</th>
                  </>
                )}
                 {activeReport === 'receivables' && (
                  <>
                    <th 
                      onClick={() => {
                        if (sortKey === 'name') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey('name');
                          setSortOrder('asc');
                        }
                      }}
                      className="p-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-[#15133d] transition-colors select-none group"
                    >
                      <span className="flex items-center gap-1.5">
                        Customer & Shop
                        <span className="text-accent group-hover:opacity-100 transition-opacity">
                          {sortKey === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortKey === 'route') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey('route');
                          setSortOrder('asc');
                        }
                      }}
                      className="p-4 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-[#15133d] transition-colors select-none group"
                    >
                      <span className="flex items-center gap-1.5">
                        Route / Area
                        <span className="text-accent group-hover:opacity-100 transition-opacity">
                          {sortKey === 'route' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortKey === 'credit_limit') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey('credit_limit');
                          setSortOrder('desc');
                        }
                      }}
                      className="p-4 text-[10px] font-black uppercase tracking-widest text-right cursor-pointer hover:bg-[#15133d] transition-colors select-none group"
                    >
                      <span className="flex items-center justify-end gap-1.5">
                        Credit Limit
                        <span className="text-accent group-hover:opacity-100 transition-opacity">
                          {sortKey === 'credit_limit' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>
                    </th>
                    <th 
                      onClick={() => {
                        if (sortKey === 'balance') {
                          setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortKey('balance');
                          setSortOrder('desc');
                        }
                      }}
                      className="p-4 text-[10px] font-black uppercase tracking-widest text-right cursor-pointer hover:bg-[#15133d] transition-colors select-none group"
                    >
                      <span className="flex items-center justify-end gap-1.5">
                        Balance Due
                        <span className="text-accent group-hover:opacity-100 transition-opacity">
                          {sortKey === 'balance' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </span>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right select-none">
                      Exposure Risk
                    </th>
                  </>
                )}
                {activeReport === 'payables' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Supplier</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Balance Due</th>
                  </>
                )}
                {activeReport === 'expenses/daily' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Total Amount</th>
                  </>
                )}
                {activeReport === 'expenses/detailed' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Description</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Method</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Amount</th>
                  </>
                )}
                {activeReport === 'master-sku' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Supplier / Company</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">SKU Name</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-center">Units/Pack</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Price Pack</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Unit Price</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-bold animate-pulse">Running complex query...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-bold">No data found in this quadrant.</td></tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => (activeReport === 'sales' || activeReport === 'loading-sheet' || activeReport === 'batch-invoices') && toggleOrderSelection(row.id)}>
                    {(activeReport === 'sales' || activeReport === 'loading-sheet' || activeReport === 'batch-invoices') && (
                      <>
                        <td className="p-4 w-10">
                          <button 
                            className={`${selectedOrderIds.includes(row.id) ? 'text-accent' : 'text-slate-300'} transition-colors`}
                          >
                            {selectedOrderIds.includes(row.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-500">
                          {formatDateSimple(row.order_date)}
                        </td>
                        <td className="p-4 font-bold text-text">{row.customer_name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.salesman_name}</td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-slate-900">Rs. {(row.total_amount || 0).toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded w-fit ${
                              row.is_paid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                            }`}>
                              {row.is_paid ? 'Paid' : 'Unpaid'}
                            </span>
                            {row.is_dummy === 1 && (
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-600 w-fit">
                                Digital Order
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                showInvoiceDetails(row.id);
                              }}
                              className="p-2 hover:bg-slate-100 rounded-lg text-primary transition-all hover:scale-110"
                              title="View Invoice"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditOrder(row.id);
                              }}
                              className="p-2 hover:bg-amber-50 rounded-lg text-amber-600 transition-all hover:scale-110"
                              title="Edit Order"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrder(row.id);
                              }}
                              className="p-2 hover:bg-rose-50 rounded-lg text-rose-600 transition-all hover:scale-110"
                              title="Delete Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                    {activeReport === 'stock' && (
                      <>
                        <td className="p-4 font-bold text-text">{row.name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">
                           <span className="text-[10px] font-black uppercase bg-slate-100 px-2 py-1 rounded tracking-tighter">{row.category}</span>
                        </td>
                        <td className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[100px]">
                           {row.supplier_name || '-'}
                        </td>
                        <td className="p-4 text-center font-bold text-slate-600">{row.units_per_case || 1}</td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-900">
                           Rs. {(((row.price_per_case || 0) / (row.units_per_case || 1)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-400">
                           Rs. {(((row.cogs_per_case || 0) / (row.units_per_case || 1)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-900">{(row.total_cases || 0).toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-slate-950">{(((row.total_cases || 0) * (row.units_per_case || 1)) + (row.total_units || 0)).toLocaleString()}</td>
                        <td className="p-4">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${(row.total_cases || 0) > 50 ? 'bg-success' : (row.total_cases || 0) > 10 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${Math.min(100, ((row.total_cases || 0) / 100) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </>
                    )}
                    {activeReport === 'returns' && (
                      <>
                        <td className="p-4 font-mono text-[11px] text-slate-500">
                          {formatDateSimple(row.date)}
                        </td>
                        <td className="p-4 font-bold text-text">{row.customer_name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.sku_name}</td>
                        <td className="p-4">
                          <span className="text-[10px] font-bold text-danger border border-danger/20 px-2 py-0.5 rounded-full">
                            {row.type}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900">{row.quantity}</td>
                      </>
                    )}
                    {activeReport === 'receivables' && (
                      <>
                        <td className="p-4">
                          <div className="font-bold text-slate-900 leading-tight">{row.name}</div>
                          {row.shop_name && (
                            <div className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">{row.shop_name}</div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-xs font-bold text-slate-700">{row.route || 'No Route'}</div>
                          {row.contact && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.contact}</div>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-500">
                          Rs. {(row.credit_limit || 0).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-black text-xs ${
                            (row.balance || 0) > (row.credit_limit || 0) ? 'text-rose-600 font-black' : 'text-slate-900'
                          }`}>
                            Rs. {(row.balance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {(() => {
                            const limit = Number(row.credit_limit || 0);
                            const balance = Number(row.balance || 0);
                            if (limit === 0) {
                              return (
                                <span className="text-[8px] font-black uppercase px-2 py-1 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">
                                  No credit limit
                                </span>
                              );
                            }
                            const ratio = balance / limit;
                            if (ratio > 1) {
                              return (
                                <span className="text-[8px] font-black uppercase px-2 py-1 bg-rose-100 text-rose-600 rounded-lg border border-rose-200">
                                  Over Limit (+{Math.round((ratio - 1) * 100)}%)
                                </span>
                              );
                            } else {
                              return (
                                <span className="text-[8px] font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                                  Safe ({Math.round(ratio * 100)}%)
                                </span>
                              );
                            }
                          })()}
                        </td>
                      </>
                    )}
                    {activeReport === 'payables' && (
                      <>
                        <td className="p-4 font-bold text-text">{row.name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.category}</td>
                        <td className="p-4 text-right font-black text-amber-600">Rs. {(row.balance || 0).toLocaleString()}</td>
                      </>
                    )}
                    {activeReport === 'expenses/daily' && (
                      <>
                        <td className="p-4 font-mono text-[11px] text-slate-500">{formatDateSimple(row.day || row.date)}</td>
                        <td className="p-4 font-bold text-text capitalize">{row.category}</td>
                        <td className="p-4 text-right font-black text-slate-900">Rs. {(row.total || 0).toLocaleString()}</td>
                      </>
                    )}
                    {activeReport === 'expenses/detailed' && (
                      <>
                        <td className="p-4 font-mono text-[11px] text-slate-500">{formatDateSimple(row.date || row.day)}</td>
                        <td className="p-4 font-bold text-text">{row.description}</td>
                        <td className="p-4 text-[10px] font-black uppercase text-slate-400">{row.category}</td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${row.payment_method === 'Online' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {row.payment_method}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-rose-600">Rs. {(row.amount || 0).toLocaleString()}</td>
                      </>
                    )}
                    {activeReport === 'master-sku' && (
                      <>
                        <td className="p-4 font-black text-[10px] text-primary uppercase tracking-tight">{row.supplier_name || 'N/A'}</td>
                        <td className="p-4 font-bold text-text">{row.sku_name}</td>
                        <td className="p-4 text-center font-bold text-slate-600">{row.units_per_case}</td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-900">Rs. {(row.price_per_case || 0).toLocaleString()}</td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-400">Rs. {(row.price_per_unit || 0).toLocaleString()}</td>
                        <td className="p-4">
                          <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{row.category}</span>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditOrderModal({ order, onSave, onClose }: { order: any, onSave: (o: any) => void, onClose: () => void }) {
  const [items, setItems] = useState<any[]>(order.items);
  const [tax_amount, setTaxAmount] = useState(order.tax_amount || 0);

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0) + tax_amount;
  };

  const updateItem = (index: number, cases: number, units: number) => {
    const newItems = [...items];
    const item = newItems[index];
    
    // We need price per case/unit. Order items store 'price' as total for that line
    // We assume the stored price was calculated based on initial order
    const pricePerCase = item.price / (item.cases + item.units/12) || 0;
    
    newItems[index] = {
      ...item,
      cases,
      units,
      price: pricePerCase * (cases + units/12)
    };
    setItems(newItems);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tighter">Edit Digital Invoice</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Invoice #{order.invoiceNo} • {order.customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Item {idx + 1}</p>
                  <h4 className="font-bold text-slate-900 text-sm truncate">{item.sku_name}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Cases</span>
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateItem(idx, Math.max(0, item.cases - 1), item.units)} className="p-1 px-2 hover:bg-slate-50"><Minus className="w-3 h-3"/></button>
                      <input type="number" value={item.cases} readOnly className="w-8 text-center text-xs font-bold bg-transparent outline-none" />
                      <button onClick={() => updateItem(idx, item.cases + 1, item.units)} className="p-1 px-2 hover:bg-slate-50"><Plus className="w-3 h-3"/></button>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Units</span>
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <button onClick={() => updateItem(idx, item.cases, Math.max(0, item.units - 1))} className="p-1 px-2 hover:bg-slate-50"><Minus className="w-3 h-3"/></button>
                      <input type="number" value={item.units} readOnly className="w-8 text-center text-xs font-bold bg-transparent outline-none" />
                      <button onClick={() => updateItem(idx, item.cases, item.units + 1)} className="p-1 px-2 hover:bg-slate-50"><Plus className="w-3 h-3"/></button>
                    </div>
                  </div>
                  <div className="text-right ml-2 min-w-[80px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Line Total</p>
                    <p className="font-black text-slate-900">Rs. {Math.round(item.price).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {items.length === 0 && (
              <div className="py-20 text-center text-slate-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest">No items in this invoice</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
           <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grand Total</p>
              <p className="text-2xl font-black text-primary">Rs. {Math.round(calculateTotal()).toLocaleString()}</p>
           </div>
           <div className="flex gap-3">
              <button onClick={onClose} className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all">Cancel</button>
              <button 
                onClick={() => onSave({ ...order, items, total: calculateTotal() })}
                className="px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Update Invoice
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}
