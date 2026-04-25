import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
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
  Square
} from 'lucide-react';
import { motion } from 'motion/react';
import { InvoiceTemplate } from './InvoiceTemplate';

type ReportType = 'sales' | 'stock' | 'returns' | 'receivables' | 'payables' | 'expenses/daily';

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>('sales');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [batchInvoices, setBatchInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [activeReport]);

  const fetchReportData = async () => {
    setLoading(true);
    setSelectedOrderIds([]); // Clear selection when switching reports
    try {
      const res = await fetch(`/api/reports/${activeReport}`);
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      console.error("Failed to fetch report data", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (id: number) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const batchPrint = async () => {
    if (selectedOrderIds.length === 0) return;
    
    setLoading(true);
    try {
      // Fetch details for all selected orders
      const orders = await Promise.all(
        selectedOrderIds.map(id => fetch(`/api/orders/${id}`).then(res => res.json()))
      );
      
      // Transform into QueuedOrder format for Template
      const templateData = orders.map(o => ({
        customer: { name: o.customer_name, route: o.route || 'Local Swat Route' },
        items: o.items.map((i: any) => ({
          sku: { name: i.sku_name, price_per_case: i.price, price_per_unit: i.price / 12 }, // mock unit price
          cases: i.cases,
          units: i.units
        })),
        total: o.total_amount,
        invoiceNo: o.id.toString(),
        date: new Date(o.order_date).toLocaleDateString(),
        salesmanName: o.salesman_name
      }));

      setBatchInvoices(templateData);
      
      // Allow React to render the print section then trigger print
      setTimeout(() => {
        try {
          window.print();
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

  const filteredData = reportData.filter(item => {
    const searchString = searchQuery.toLowerCase();
    if (activeReport === 'sales') {
      return item.customer_name.toLowerCase().includes(searchString) || 
             item.salesman_name.toLowerCase().includes(searchString);
    } else if (activeReport === 'stock') {
      return item.name.toLowerCase().includes(searchString) || 
             item.category.toLowerCase().includes(searchString);
    } else if (activeReport === 'receivables') {
      return item.name.toLowerCase().includes(searchString) || 
             item.route?.toLowerCase().includes(searchString);
    } else if (activeReport === 'payables') {
      return item.name.toLowerCase().includes(searchString) || 
             item.category?.toLowerCase().includes(searchString);
    } else if (activeReport === 'expenses/daily') {
      return item.category?.toLowerCase().includes(searchString) || 
             item.date?.toLowerCase().includes(searchString);
    } else {
      return item.customer_name.toLowerCase().includes(searchString) || 
             item.sku_name.toLowerCase().includes(searchString);
    }
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text tracking-tight uppercase">Intelligence & Reports</h1>
          <p className="text-text-muted font-medium text-sm">Actionable insights into Swat distribution performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-primary p-1 rounded-xl border border-white/10 shadow-lg no-print">
          {(['sales', 'stock', 'returns', 'receivables', 'payables', 'expenses/daily'] as ReportType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveReport(type)}
              className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                activeReport === type 
                  ? 'bg-accent text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {type.split('/')[0]}
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
        <div className="flex items-center gap-2 w-full md:w-auto">
          {activeReport === 'sales' && selectedOrderIds.length > 0 && (
            <button 
              onClick={batchPrint}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-right-4"
            >
              <Printer className="w-4 h-4" />
              Batch Print ({selectedOrderIds.length})
            </button>
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
            Print Report
          </button>
          <button className="btn-primary text-xs py-2 flex items-center gap-2 bg-emerald-600 border-none flex-1 md:flex-none">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Batch Print Hidden Template */}
      <div className="print-only bg-white">
        {batchInvoices.map((inv, idx) => (
          <InvoiceTemplate key={idx} order={inv} salesmanName={inv.salesmanName} />
        ))}
      </div>

      {/* Data Visualization Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="erp-card bg-slate-950 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-5 h-5 text-accent" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Growth</span>
          </div>
          <div className="text-2xl font-black mb-1">+12.4%</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">vs. Last Quarter</div>
        </div>
        <div className="erp-card p-6">
          <div className="flex items-center justify-between mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Market Share</span>
          </div>
          <div className="text-2xl font-black mb-1">Rs. 1.2M</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">Captured Revenue</div>
        </div>
        <div className="erp-card p-6">
          <div className="flex items-center justify-between mb-4">
            <Box className="w-5 h-5 text-warning" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Velocity</span>
          </div>
          <div className="text-2xl font-black mb-1">0.85</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">Turnover Ratio</div>
        </div>
        <div className="erp-card p-6">
          <div className="flex items-center justify-between mb-4">
            <RotateCcw className="w-5 h-5 text-danger" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Factor</span>
          </div>
          <div className="text-2xl font-black mb-1">2.1%</div>
          <div className="text-[10px] text-slate-400 font-bold uppercase">Loss / Damages</div>
        </div>
      </div>

      {/* Data Table */}
      <div className="erp-card !p-0 overflow-hidden shadow-2xl border-2 border-primary/5 no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-white">
                {activeReport === 'sales' && (
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
                  </>
                )}
                {activeReport === 'stock' && (
                  <>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">SKU Name</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Category</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Case Qty</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Loose Units</th>
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
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Customer</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest">Route</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-right">Balance Due</th>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-bold animate-pulse">Running complex query...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-text-muted font-bold">No data found in this quadrant.</td></tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="border-b border-border hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => activeReport === 'sales' && toggleOrderSelection(row.id)}>
                    {activeReport === 'sales' && (
                      <>
                        <td className="p-4 w-10">
                          <button 
                            className={`${selectedOrderIds.includes(row.id) ? 'text-accent' : 'text-slate-300'} transition-colors`}
                          >
                            {selectedOrderIds.includes(row.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                        </td>
                        <td className="p-4 font-mono text-[11px] text-slate-500">
                          {new Date(row.order_date).toLocaleDateString()}
                        </td>
                        <td className="p-4 font-bold text-text">{row.customer_name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.salesman_name}</td>
                        <td className="p-4 text-right">
                          <span className="font-bold text-slate-900">Rs. {row.total_amount.toLocaleString()}</span>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            row.is_paid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                          }`}>
                            {row.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </>
                    )}
                    {activeReport === 'stock' && (
                      <>
                        <td className="p-4 font-bold text-text">{row.name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.category}</td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-900">{row.total_cases}</td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-900">{row.total_units}</td>
                        <td className="p-4">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${row.total_cases > 50 ? 'bg-success' : row.total_cases > 10 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${Math.min(100, (row.total_cases / 100) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </>
                    )}
                    {activeReport === 'returns' && (
                      <>
                        <td className="p-4 font-mono text-[11px] text-slate-500">
                          {new Date(row.date).toLocaleDateString()}
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
                        <td className="p-4 font-bold text-text">{row.name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.route}</td>
                        <td className="p-4 text-right font-black text-rose-600">Rs. {row.balance.toLocaleString()}</td>
                      </>
                    )}
                    {activeReport === 'payables' && (
                      <>
                        <td className="p-4 font-bold text-text">{row.name}</td>
                        <td className="p-4 text-xs font-semibold text-text-muted">{row.category}</td>
                        <td className="p-4 text-right font-black text-amber-600">Rs. {row.balance.toLocaleString()}</td>
                      </>
                    )}
                    {activeReport === 'expenses/daily' && (
                      <>
                        <td className="p-4 font-mono text-[11px] text-slate-500">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="p-4 font-bold text-text capitalize">{row.category}</td>
                        <td className="p-4 text-right font-black text-slate-900">Rs. {row.total.toLocaleString()}</td>
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
