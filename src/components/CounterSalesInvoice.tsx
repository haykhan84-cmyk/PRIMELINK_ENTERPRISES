import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';

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
  balance: number;
  route?: string;
  channel?: string;
  phone?: string;
}

interface Salesman {
  id: number;
  name: string;
}

interface CounterSalesInvoiceProps {
  customers: Customer[];
  skus: SKU[];
  salesmen: Salesman[];
  inventory: any[];
  fetchInvoices: () => Promise<void>;
  fetchCustomers: () => Promise<void>;
  setActiveTab: (tab: any) => void;
}

interface GridRow {
  uid: number;
  sku_id: number;
  item_code: string;
  item_name: string;
  batch_no: string;
  exp_date: string;
  trade_price: number;
  sales_price: number;
  qty: number;
  bns: number;
  dis_percent: number;
  extra_percent: number;
  s_tax: number;
  gst: number;
  net_price: number;
  net_amount: number;
}

export default function CounterSalesInvoice({
  customers,
  skus,
  salesmen,
  inventory,
  fetchInvoices,
  fetchCustomers,
  setActiveTab
}: CounterSalesInvoiceProps) {
  // Branch & Module details
  const [branchCode, setBranchCode] = useState('BR-MINGORA-01');
  const [branchName, setBranchName] = useState('Mingora Main Depot');
  const [moduleTitle, setModuleTitle] = useState('Counter Sales Invoice');
  const [userName, setUserName] = useState('ADMIN MASTER');

  // Panel A: Account Detail
  const [accountCode, setAccountCode] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [prevBalance, setPrevBalance] = useState(0);
  const [priceLevel, setPriceLevel] = useState('Wholesale');

  // Panel B: Area Detail
  const [mainArea, setMainArea] = useState('Swat Swat Valley');
  const [subArea, setSubArea] = useState('Swat Town Area');
  const [bookedBy, setBookedBy] = useState<number | ''>('');
  const [suppliedBy, setSuppliedBy] = useState('Self Collector');

  // Panel C: Invoice Info
  const [generationNo, setGenerationNo] = useState(() => 'GN-' + String(10000 + Math.floor(Math.random() * 90000)));
  const [salesInvoiceNo, setSalesInvoiceNo] = useState(() => 'CS-' + String(100 + Math.floor(Math.random() * 900)));
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('');

  // Panel D: Main Data Grid Rows state
  const [rows, setRows] = useState<GridRow[]>([
    {
      uid: 1,
      sku_id: 0,
      item_code: '',
      item_name: '',
      batch_no: 'B-832',
      exp_date: '2028-09',
      trade_price: 0,
      sales_price: 0,
      qty: 0,
      bns: 0,
      dis_percent: 0,
      extra_percent: 0,
      s_tax: 0,
      gst: 0,
      net_price: 0,
      net_amount: 0
    }
  ]);
  const [activeRowIdx, setActiveRowIdx] = useState(0);

  // Panel E: Item Meta details (tied dynamically to activeRowIdx)
  const [itemMeta, setItemMeta] = useState({
    bonus_spec: 'N/A',
    total_stock: '0 Units',
    remarks: 'No item focused',
    disc_percent: '0%',
    batch_qty: '0',
    max_percent: '0%',
    s_limit: 'N/A'
  });

  // Panel F: Ledger Totals & Actions
  const [payment, setPayment] = useState(0);
  const [counterCash, setCounterCash] = useState(0);
  const [acCode, setAcCode] = useState('1004-C');
  const [description, setDescription] = useState('Counter Cash POS Entry');

  // Success and issue status alerts
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  // Focus navigation sequence across master panels
  const posMasterSequence = [
    'pos-input-account-code',
    'pos-input-customer-id',
    'pos-input-price-level',
    'pos-input-main-area',
    'pos-input-sub-area',
    'pos-input-booked-by',
    'pos-input-supplied-by',
    'pos-input-generation-no',
    'pos-input-sales-invoice-no',
    'pos-input-invoice-date',
    'pos-input-search-invoice-no'
  ];

  const posGridColumns = [
    'sku_id',
    'batch_no',
    'exp_date',
    'trade_price',
    'sales_price',
    'qty',
    'bns',
    'dis_percent',
    'extra_percent',
    's_tax',
    'gst'
  ];

  // Map of dynamic references to support auto-scrolling & focusing
  const handleMasterKeyDown = (e: React.KeyboardEvent, currentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const idx = posMasterSequence.indexOf(currentId);
      if (idx !== -1 && idx < posMasterSequence.length - 1) {
        const nextId = posMasterSequence[idx + 1];
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          if (nextEl instanceof HTMLInputElement) {
            nextEl.select();
          }
        }
      } else {
        // Jump to first cell in row 0 grid
        const firstGridEl = document.getElementById('pos-grid-row-0-col-sku_id');
        if (firstGridEl) {
          firstGridEl.focus();
        }
      }
    }
  };

  const handleGridCellKeyDown = (e: React.KeyboardEvent, rowIdx: number, colName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const colIdx = posGridColumns.indexOf(colName);
      if (colIdx !== -1 && colIdx < posGridColumns.length - 1) {
        // Shift focus horizontally to the right adjacent cell
        const nextColName = posGridColumns[colIdx + 1];
        const nextId = `pos-grid-row-${rowIdx}-col-${nextColName}`;
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          if (nextEl instanceof HTMLInputElement) {
            nextEl.select();
          }
        }
      } else {
        // At last editable column ('gst'), drop cursor down to the first column (sku_id) of the next row.
        // If there's no next row, dynamically append a brand-new row.
        if (rowIdx < rows.length - 1) {
          setTimeout(() => {
            const nextEl = document.getElementById(`pos-grid-row-${rowIdx + 1}-col-sku_id`);
            if (nextEl) nextEl.focus();
          }, 30);
        } else {
          // Add a new row
          const nextUid = Math.max(...rows.map(r => r.uid), 0) + 1;
          const newRow: GridRow = {
            uid: nextUid,
            sku_id: 0,
            item_code: '',
            item_name: '',
            batch_no: 'B-832',
            exp_date: '2028-09',
            trade_price: 0,
            sales_price: 0,
            qty: 0,
            bns: 0,
            dis_percent: 0,
            extra_percent: 0,
            s_tax: 0,
            gst: 0,
            net_price: 0,
            net_amount: 0
          };
          setRows(prev => [...prev, newRow]);
          setTimeout(() => {
            const nextEl = document.getElementById(`pos-grid-row-${rowIdx + 1}-col-sku_id`);
            if (nextEl) nextEl.focus();
          }, 80);
        }
      }
    }
  };

  // Helper calculation logic per Grid Row
  const calculateRowMath = (row: GridRow): GridRow => {
    const qty = Number(row.qty) || 0;
    const sales_price = Number(row.sales_price) || 0;
    const gross = qty * sales_price;
    
    // Discounts
    const disAmt = gross * ((Number(row.dis_percent) || 0) / 100);
    const extraAmt = gross * ((Number(row.extra_percent) || 0) / 100);
    
    // Taxes
    const sTaxAmt = gross * ((Number(row.s_tax) || 0) / 100);
    const gstAmt = gross * ((Number(row.gst) || 0) / 100);
    
    // Net Row Amount
    const net_amount = gross - disAmt - extraAmt + sTaxAmt + gstAmt;
    const net_price = qty > 0 ? Number((net_amount / qty).toFixed(2)) : sales_price;

    return {
      ...row,
      net_price: Number(net_price || 0),
      net_amount: Number(net_amount.toFixed(2))
    };
  };

  const handleCellUpdate = (rowIdx: number, field: keyof GridRow, val: any) => {
    setRows(prev => {
      const copy = [...prev];
      let row = { ...copy[rowIdx], [field]: val };

      // Direct auto-lookup upon selecting a dynamic Product SKU
      if (field === 'sku_id') {
        const sku = skus.find(s => s.id === Number(val));
        if (sku) {
          row.item_code = String(sku.id);
          row.item_name = sku.name;
          row.trade_price = sku.price_per_unit;
          row.sales_price = sku.price_per_unit;
          row.gst = sku.gst_rate || 0;
          row.qty = 1; // Default to 1 qty for instant transaction drafting
        } else {
          row.item_code = '';
          row.item_name = '';
          row.trade_price = 0;
          row.sales_price = 0;
          row.gst = 0;
          row.qty = 0;
        }
      }

      copy[rowIdx] = calculateRowMath(row);
      return copy;
    });
  };

  // Focus handler to instantly update Panel E item specifications
  const handleCellFocus = (rowIdx: number) => {
    setActiveRowIdx(rowIdx);
    const activeRow = rows[rowIdx];
    if (!activeRow || !activeRow.sku_id) {
      setItemMeta({
        bonus_spec: 'N/A',
        total_stock: '0 Units',
        remarks: 'No item selected',
        disc_percent: '0%',
        batch_qty: '0',
        max_percent: '0%',
        s_limit: 'N/A'
      });
      return;
    }

    const sku = skus.find(s => s.id === activeRow.sku_id);
    const inv = inventory.find(i => i.sku_id === activeRow.sku_id);
    const stockQty = inv ? (inv.quantity_cases * (sku?.units_per_case || 1) + inv.quantity_units) : 0;

    setItemMeta({
      bonus_spec: sku?.is_third_schedule ? 'Taxable 3rd Schedule' : '10+1 / 12+1 Std Scheme',
      total_stock: `${stockQty} units remaining`,
      remarks: sku?.category || 'General Distribution Item',
      disc_percent: `${activeRow.dis_percent}% Code Allowance`,
      batch_qty: String(sku?.units_per_case || 12),
      max_percent: '15.00% Cap Limit',
      s_limit: sku?.price_per_case ? `Rs. ${sku.price_per_case} per Case` : 'No S.Limit'
    });
  };

  // Sync balances and trigger details
  const handleCustomerSelect = (custVal: string) => {
    const idNum = Number(custVal);
    const cust = customers.find(c => c.id === idNum);
    if (cust) {
      setSelectedCustomerId(cust.id);
      setCustomerName(cust.shop_name || cust.name);
      setAccountCode(`CUST-${1000 + cust.id}`);
      setPrevBalance(cust.balance || 0);
      if (cust.route) {
        setSubArea(cust.route);
      }
    } else {
      setSelectedCustomerId('');
      setCustomerName('');
      setAccountCode('');
      setPrevBalance(0);
    }
  };

  const handleAccountCodeChange = (codeVal: string) => {
    setAccountCode(codeVal);
    // Attempt reverse lookup of AC Code e.g. "CUST-1004" -> matches id = 4
    const extractedId = parseInt(codeVal.replace(/[^\d]/g, ''), 10);
    if (!isNaN(extractedId)) {
      const realId = extractedId - 1000;
      const cust = customers.find(c => c.id === realId);
      if (cust) {
        setSelectedCustomerId(cust.id);
        setCustomerName(cust.shop_name || cust.name);
        setPrevBalance(cust.balance || 0);
        if (cust.route) {
          setSubArea(cust.route);
        }
      }
    }
  };

  // Mathematical Aggregates (React State Computed Real-time)
  const billAmount = rows.reduce((sum, r) => sum + (Number(r.net_amount) || 0), 0);
  const netAmnt = billAmount;
  const invoiceBalance = netAmnt - payment;
  const netBalance = prevBalance + netAmnt - payment;

  // Actions Bar Implementation handlers
  const handleAddNew = () => {
    setRows([
      {
        uid: Date.now(),
        sku_id: 0,
        item_code: '',
        item_name: '',
        batch_no: 'B-832',
        exp_date: '2028-09',
        trade_price: 0,
        sales_price: 0,
        qty: 0,
        bns: 0,
        dis_percent: 0,
        extra_percent: 0,
        s_tax: 0,
        gst: 0,
        net_price: 0,
        net_amount: 0
      }
    ]);
    setSelectedCustomerId('');
    setCustomerName('');
    setAccountCode('');
    setPrevBalance(0);
    setPayment(0);
    setCounterCash(0);
    setDescription('Counter Cash POS Entry');
    setSalesInvoiceNo('CS-' + String(100 + Math.floor(Math.random() * 900)));
    setGenerationNo('GN-' + String(10000 + Math.floor(Math.random() * 90000)));
    setErrorStatus(null);
    setSuccessStatus(null);

    setTimeout(() => {
      document.getElementById('pos-input-account-code')?.focus();
    }, 50);
  };

  const handleSaveInvoice = async () => {
    if (!selectedCustomerId) {
      setErrorStatus("A valid Customer Retail Account is required to book POS Invoice.");
      return;
    }

    const validItems = rows.filter(r => r.sku_id > 0 && Number(r.qty) > 0);
    if (validItems.length === 0) {
      setErrorStatus("At least 1 valid product item with Qty is required in POS data grid.");
      return;
    }

    // Map each Grid Row into back-end Invoice Item structures
    const itemsPayload = validItems.map(row => {
      const sku = skus.find(s => s.id === row.sku_id);
      const unitsPerCase = sku?.units_per_case || 12;
      const cases = Math.floor(row.qty / unitsPerCase);
      const units = row.qty % unitsPerCase;

      return {
        sku_id: row.sku_id,
        cases,
        units,
        trade_price_per_case: (sku?.price_per_unit || 0) * unitsPerCase,
        trade_price_per_unit: row.sales_price,
        retail_price: row.sales_price,
        discount_percentage: row.dis_percent,
        discount_amount: (row.qty * row.sales_price) * ((row.dis_percent || 0) / 100),
        line_total: row.net_amount,
        batch_number: row.batch_no || 'B-Std',
        expiry_date: row.exp_date || 'N/A'
      };
    });

    const totalDiscount = validItems.reduce((sum, r) => sum + ((r.qty * r.sales_price) * (r.dis_percent / 100)), 0);
    const totalTax = validItems.reduce((sum, r) => sum + ((r.qty * r.sales_price) * ((r.s_tax + r.gst) / 100)), 0);

    const payload = {
      customer_id: Number(selectedCustomerId),
      salesman_id: bookedBy ? Number(bookedBy) : null,
      invoice_date: invoiceDate,
      subtotal: billAmount,
      discount_amount: totalDiscount,
      tax_amount: totalTax,
      total_amount: netAmnt,
      payment_method: payment > 0 ? 'Cash' : 'Credit',
      notes: `${description} | Gener_No: ${generationNo}`,
      items: itemsPayload
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        setSuccessStatus(`POS Invoice booked successfully! Voucher ID Assigned: CS-${result.invoiceId || 'N/A'}`);
        setErrorStatus(null);
        
        // Auto-post payment to Roznamcha daybook if cash was paid!
        if (payment > 0) {
          try {
            await fetch(`/api/invoices/${result.invoiceId}/payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ remarks: `Cash POS payment captured for CS-${result.invoiceId}` })
            });
          } catch (payErr) {
            console.error('Failed to write Roznamcha record automatically for cash POS payment', payErr);
          }
        }

        // Refresh state
        await fetchInvoices();
        await fetchCustomers();
        
        // Clear grid loop
        setTimeout(() => handleAddNew(), 4000);
      } else {
        const err = await res.json();
        setErrorStatus("Voucher Reject reason: " + (err.error || 'Check inventory availability.'));
      }
    } catch (e) {
      setErrorStatus("Loss of contact with back-office accounting server.");
    }
  };

  const handlePrintSummary = () => {
    const printContent = `
========================================
     COUNTER SALES INVOICE SUMMARY      
========================================
Invoice Number: ${salesInvoiceNo}
Invoice Date  : ${invoiceDate}
Customer      : ${customerName} ([${accountCode}])
Booked By     : ${bookedBy ? salesmen.find(s => s.id === Number(bookedBy))?.name : 'Self Counter'}
----------------------------------------
Itemized Breakdown:
${rows.filter(r => r.sku_id > 0).map(r => `[Code ${r.sku_id}] Qty: ${r.qty} x Rs.${r.sales_price} = Rs.${r.net_amount}`).join('\n')}
----------------------------------------
Total Invoice Amount: Rs. ${billAmount.toLocaleString()}
Previous Balance    : Rs. ${prevBalance.toLocaleString()}
Payment Received    : Rs. ${payment.toLocaleString()}
Grand Outstanding   : Rs. ${netBalance.toLocaleString()}
----------------------------------------
      AUTHORIZED ACCOUNT SIGNATURE      
========================================
    `;
    alert(printContent);
  };

  const handlePrintPRS = () => {
    alert(`
========================================
   COUNTER SALES PRODUCT RELEASE SLIP   
========================================
Slip Reference: CS-PRS-${salesInvoiceNo}
Store Gatekeeper Authorization Receipt
----------------------------------------
Date Executed : ${invoiceDate}
Gatekeeper Code: GK-MINGORA-02
----------------------------------------
Items Authorized for Gate Release:
${rows.filter(r => r.sku_id > 0).map(r => `- SKU: ${r.item_name} | Qty: ${r.qty} Units | Batch: ${r.batch_no}`).join('\n')}
----------------------------------------
Note: Hand-carried counter collection. Ensure immediate ledger verification.
========================================
    `);
  };

  const deleteRow = (idx: number) => {
    if (rows.length === 1) {
      setRows([
        {
          uid: Date.now(),
          sku_id: 0,
          item_code: '',
          item_name: '',
          batch_no: 'B-832',
          exp_date: '2028-09',
          trade_price: 0,
          sales_price: 0,
          qty: 0,
          bns: 0,
          dis_percent: 0,
          extra_percent: 0,
          s_tax: 0,
          gst: 0,
          net_price: 0,
          net_amount: 0
        }
      ]);
    } else {
      setRows(prev => prev.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="bg-slate-200 p-2 text-[11px] font-sans text-slate-900 border-2 border-slate-400 select-none shadow-inner" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
      
      {/* 1. TOP HEADER SECTION */}
      <div className="bg-[#0b1b3d] text-white p-1.5 px-3 flex items-center justify-between border border-slate-600 mb-2">
        <div className="flex items-center gap-4">
          <span className="bg-blue-800 text-yellow-300 font-bold px-1 rounded text-[10px]">BRANCH: {branchCode}</span>
          <span className="font-extrabold uppercase tracking-wide">{branchName}</span>
        </div>
        <div>
          <h2 className="text-sm font-black uppercase italic text-yellow-300 tracking-wider font-mono">
            ★★★ {moduleTitle} ★★★
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="bg-slate-900 px-1 border border-slate-700 font-bold text-slate-300">USER: {userName}</span>
          <span className="text-emerald-400 font-bold font-mono">LIVE CONNECT: TRUE</span>
        </div>
      </div>

      {/* TOP NOTIFICATIONS ALERTS */}
      {errorStatus && (
        <div className="bg-rose-100 text-rose-900 p-2 font-bold uppercase tracking-wider mb-2 border-2 border-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" /> {errorStatus}
        </div>
      )}
      {successStatus && (
        <div className="bg-emerald-100 text-emerald-900 p-2 font-bold uppercase tracking-wider mb-2 border-2 border-emerald-300">
          ✓ {successStatus}
        </div>
      )}

      {/* 2. DENSE MASTER DETAILS - GRID OF PANELS A, B, C */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        
        {/* PANEL A: Account Detail - Top Left */}
        <div className="bg-slate-100 border-2 border-slate-300 p-2 shadow-sm space-y-1">
          <div className="bg-blue-900 text-white font-bold p-0.5 px-1.5 uppercase text-[9px] mb-1.5 flex justify-between">
            <span>[ PANEL A: Account Detail ]</span>
            <span className="text-yellow-400 font-black">CTRL+A</span>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Account Code:</label>
            <div className="col-span-2 flex gap-1">
              <input
                id="pos-input-account-code"
                type="text"
                value={accountCode}
                onChange={e => handleAccountCodeChange(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-account-code')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs text-blue-900 font-mono font-bold"
                placeholder="Lookup key..."
              />
              <button
                type="button"
                onClick={() => {
                  if (customers.length > 0) {
                    handleCustomerSelect(String(customers[0].id));
                  }
                }}
                className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-1.5 text-[10px] uppercase font-black border border-slate-500 whitespace-nowrap"
              >
                Select A/C
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Customer Name:</label>
            <div className="col-span-2">
              <select
                id="pos-input-customer-id"
                value={selectedCustomerId}
                onChange={e => handleCustomerSelect(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-customer-id')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold text-slate-900"
              >
                <option value="">-- Choose Account profile list --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.shop_name || c.name} (AcBal: Rs. {c.balance})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Prev. Balance:</label>
            <div className="col-span-2">
              <input
                type="text"
                readOnly
                value={`Rs. ${prevBalance.toLocaleString()}`}
                className="w-full bg-slate-250 border border-slate-300 px-1 py-0.5 text-xs font-mono font-bold text-red-700 bg-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Net Balance:</label>
            <div className="col-span-2">
              <input
                type="text"
                readOnly
                value={`Rs. ${netBalance.toLocaleString()}`}
                className="w-full bg-slate-50 border border-slate-300 px-1 py-0.5 text-xs font-mono font-black text-rose-900 bg-slate-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Price Level:</label>
            <div className="col-span-2">
              <select
                id="pos-input-price-level"
                value={priceLevel}
                onChange={e => setPriceLevel(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-price-level')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold"
              >
                <option value="Wholesale">Trade Price Level (Wholesale)</option>
                <option value="Retail">Retail Price Level</option>
              </select>
            </div>
          </div>
        </div>

        {/* PANEL B: Area Detail - Top Middle */}
        <div className="bg-slate-100 border-2 border-slate-300 p-2 shadow-sm space-y-1">
          <div className="bg-[#1e3a24] text-white font-bold p-0.5 px-1.5 uppercase text-[9px] mb-1.5 flex justify-between">
            <span>[ PANEL B: Area Detail ]</span>
            <span className="text-yellow-400 font-black">CTRL+B</span>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">MainArea Code:</label>
            <div className="col-span-2">
              <input
                id="pos-input-main-area"
                type="text"
                value={mainArea}
                onChange={e => setMainArea(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-main-area')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Sub Area name:</label>
            <div className="col-span-2">
              <input
                id="pos-input-sub-area"
                type="text"
                value={subArea}
                onChange={e => setSubArea(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-sub-area')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold text-blue-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Booked By:</label>
            <div className="col-span-2">
              <select
                id="pos-input-booked-by"
                value={bookedBy}
                onChange={e => setBookedBy(e.target.value ? Number(e.target.value) : '')}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-booked-by')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold"
              >
                <option value="">-- Choose Field Salesman --</option>
                {salesmen.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Supplied By:</label>
            <div className="col-span-2">
              <input
                id="pos-input-supplied-by"
                type="text"
                placeholder="Driver or Delivery vehicle"
                value={suppliedBy}
                onChange={e => setSuppliedBy(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-supplied-by')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold"
              />
            </div>
          </div>
        </div>

        {/* PANEL C: Invoice Info - Top Right */}
        <div className="bg-slate-100 border-2 border-slate-300 p-2 shadow-sm space-y-1">
          <div className="bg-[#4a2e80] text-white font-bold p-0.5 px-1.5 uppercase text-[9px] mb-1.5 flex justify-between">
            <span>[ PANEL C: Invoice Info ]</span>
            <span className="text-yellow-400 font-black">CTRL+C</span>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Generation No:</label>
            <div className="col-span-2">
              <input
                id="pos-input-generation-no"
                type="text"
                readOnly
                value={generationNo}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-generation-no')}
                className="w-full bg-slate-200 border border-slate-300 px-1 py-0.5 text-xs font-mono font-bold text-slate-600 text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Sales Inv No:</label>
            <div className="col-span-2">
              <input
                id="pos-input-sales-invoice-no"
                type="text"
                value={salesInvoiceNo}
                onChange={e => setSalesInvoiceNo(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-sales-invoice-no')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-mono font-black text-blue-900 border-l-2 border-l-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Invoice Date:</label>
            <div className="col-span-2">
              <input
                id="pos-input-invoice-date"
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-invoice-date')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 items-center gap-1">
            <label className="font-bold text-slate-600">Search Slip No:</label>
            <div className="col-span-2 flex gap-1">
              <input
                id="pos-input-search-invoice-no"
                type="text"
                placeholder="CS-..."
                value={searchInvoiceNo}
                onChange={e => setSearchInvoiceNo(e.target.value)}
                onKeyDown={e => handleMasterKeyDown(e, 'pos-input-search-invoice-no')}
                className="w-full bg-white border border-slate-400 px-1 py-0.5 text-[11px]"
              />
              <button
                type="button"
                className="bg-purple-800 text-white px-1 py-0.5 font-bold border border-slate-600 text-[9px] hover:bg-purple-900"
                onClick={() => {
                  alert(`POS Search requested for Slip: ${searchInvoiceNo}`);
                }}
              >
                FIND
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* 3. PANEL D: MAIN DATA GRID - CENTER */}
      <div className="bg-white border-2 border-slate-400 overflow-x-auto shadow-inner mb-2">
        <div className="bg-slate-700 text-yellow-300 font-bold p-1 uppercase text-[10px] tracking-wide flex justify-between select-none">
          <span>🖥 PANEL D: Main POS Items Ledger Vouchers Entry Grid (Enter-Key Navigable Layout)</span>
          <span className="font-mono text-white text-[9px]">Row {activeRowIdx + 1} of {rows.length} focused</span>
        </div>

        <table className="w-full text-left font-mono border-collapse" style={{ minWidth: '1050px' }}>
          <thead>
            <tr className="bg-slate-300 text-slate-900 text-[10px] font-black uppercase text-center border-b border-slate-500">
              <th className="p-1 border-r border-slate-400 w-24">Item Code</th>
              <th className="p-1 border-r border-slate-400 w-44">Item Name</th>
              <th className="p-1 border-r border-slate-400 w-20">Batch No</th>
              <th className="p-1 border-r border-slate-400 w-20">Exp_Date</th>
              <th className="p-1 border-r border-slate-400 w-16">T.Price</th>
              <th className="p-1 border-r border-slate-400 w-16">Sales Price</th>
              <th className="p-1 border-r border-slate-400 w-12">Qty</th>
              <th className="p-1 border-r border-slate-400 w-10">Bns</th>
              <th className="p-1 border-r border-slate-400 w-12">Dis%</th>
              <th className="p-1 border-r border-slate-400 w-12">Extra%</th>
              <th className="p-1 border-r border-slate-400 w-12">S.Tax</th>
              <th className="p-1 border-r border-slate-400 w-12">GST</th>
              <th className="p-1 border-r border-slate-400 w-20">Net.Price</th>
              <th className="p-1 border-r border-slate-400 w-24">Net Amount</th>
              <th className="p-1 w-8">[Del]</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 font-bold text-[11px]">
            {rows.map((row, rIdx) => {
              const isActive = rIdx === activeRowIdx;
              return (
                <tr 
                  key={row.uid} 
                  className={`${isActive ? 'bg-amber-50 border-y-2 border-amber-400 shadow-sm' : 'hover:bg-slate-50'}`}
                >
                  
                  {/* Item Code (sku_id select lookup) */}
                  <td className="p-0.5 border-r border-slate-300">
                    <select
                      id={`pos-grid-row-${rIdx}-col-sku_id`}
                      value={row.sku_id}
                      onChange={e => handleCellUpdate(rIdx, 'sku_id', e.target.value)}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'sku_id')}
                      className={`w-full bg-transparent text-[11px] font-mono outline-none border-none py-0.5 font-bold ${
                        row.sku_id === 0 ? 'text-slate-400 font-normal italic' : 'text-blue-900'
                      }`}
                    >
                      <option value="0">-- Code --</option>
                      {skus.map(s => (
                        <option className="text-slate-900 bg-white" key={s.id} value={s.id}>
                          {s.id} (TP: {s.price_per_unit})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Item Name */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      type="text"
                      tabIndex={-1}
                      readOnly
                      value={row.item_name || '<< Select SKU Code >>'}
                      className="w-full bg-transparent px-1 py-0.5 text-slate-800 line-clamp-1 border-none focus:outline-none"
                    />
                  </td>

                  {/* Batch No */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-batch_no`}
                      type="text"
                      value={row.batch_no}
                      onChange={e => handleCellUpdate(rIdx, 'batch_no', e.target.value)}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'batch_no')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] focus:ring-1 focus:ring-blue-500 rounded outline-none"
                    />
                  </td>

                  {/* Exp Date */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-exp_date`}
                      type="text"
                      value={row.exp_date}
                      placeholder="YYYY-MM"
                      onChange={e => handleCellUpdate(rIdx, 'exp_date', e.target.value)}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'exp_date')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] focus:ring-1 focus:ring-blue-500 rounded outline-none"
                    />
                  </td>

                  {/* T.Price */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-trade_price`}
                      type="number"
                      value={row.trade_price || 0}
                      onChange={e => handleCellUpdate(rIdx, 'trade_price', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'trade_price')}
                      className="w-full bg-transparent text-right text-slate-700 bg-slate-100 text-[11px]"
                      readOnly
                    />
                  </td>

                  {/* Sales Price */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-sales_price`}
                      type="number"
                      value={row.sales_price || 0}
                      onChange={e => handleCellUpdate(rIdx, 'sales_price', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'sales_price')}
                      className="w-full bg-transparent text-right focus:bg-white text-[11px] font-bold outline-none font-mono text-emerald-800"
                    />
                  </td>

                  {/* Qty */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-qty`}
                      type="number"
                      value={row.qty || 0}
                      onChange={e => handleCellUpdate(rIdx, 'qty', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'qty')}
                      className="w-full bg-transparent text-center focus:bg-white font-mono font-black text-rose-800 text-[12px] outline-none"
                    />
                  </td>

                  {/* Bonus */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-bns`}
                      type="number"
                      value={row.bns || 0}
                      onChange={e => handleCellUpdate(rIdx, 'bns', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'bns')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] outline-none text-slate-500"
                    />
                  </td>

                  {/* Discount % */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-dis_percent`}
                      type="number"
                      value={row.dis_percent || 0}
                      onChange={e => handleCellUpdate(rIdx, 'dis_percent', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'dis_percent')}
                      className="w-full bg-transparent text-center focus:bg-white font-mono text-[11px] outline-none text-blue-800"
                    />
                  </td>

                  {/* Extra Discount % */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-extra_percent`}
                      type="number"
                      value={row.extra_percent || 0}
                      onChange={e => handleCellUpdate(rIdx, 'extra_percent', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'extra_percent')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] outline-none text-blue-800"
                    />
                  </td>

                  {/* S.Tax % */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-s_tax`}
                      type="number"
                      value={row.s_tax || 0}
                      onChange={e => handleCellUpdate(rIdx, 's_tax', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 's_tax')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] outline-none text-purple-800"
                    />
                  </td>

                  {/* GST % */}
                  <td className="p-0.5 border-r border-slate-300">
                    <input
                      id={`pos-grid-row-${rIdx}-col-gst`}
                      type="number"
                      value={row.gst || 0}
                      onChange={e => handleCellUpdate(rIdx, 'gst', Number(e.target.value))}
                      onFocus={() => handleCellFocus(rIdx)}
                      onKeyDown={e => handleGridCellKeyDown(e, rIdx, 'gst')}
                      className="w-full bg-transparent text-center focus:bg-white text-[11px] outline-none text-purple-800"
                    />
                  </td>

                  {/* Net Price (Read-only) */}
                  <td className="p-0.5 r-align border-r border-slate-300 text-right bg-slate-50 pr-2">
                    Rs. {row.net_price.toLocaleString()}
                  </td>

                  {/* Net Amount (Read-only) */}
                  <td className="p-0.5 r-align border-r border-slate-300 text-right font-black bg-slate-100 pr-2 text-blue-900 font-mono">
                    Rs. {row.net_amount.toLocaleString()}
                  </td>

                  {/* Delete Button */}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(rIdx)}
                      className="text-rose-600 hover:text-rose-800"
                      title="Remove Item Row"
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

      {/* 4. BOTTOM TWO-PANEL SECTION (Panel E - Meta Info, Panel F - Ledger Totals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        
        {/* PANEL E: Item Meta - Bottom Left */}
        <div className="bg-slate-100 border-2 border-slate-300 p-2 shadow-sm space-y-1">
          <div className="bg-[#473a11] text-white font-bold p-0.5 px-1.5 uppercase text-[9px] mb-1.5 flex justify-between">
            <span>[ PANEL E: Real-time Item Specifications Meta ]</span>
            <span className="text-yellow-400 font-black">ACTIVE ITEM DATA</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            <div>
              <span className="text-slate-500 block text-[9.5px] font-bold uppercase leading-none">Bonus Scheme:</span>
              <span className="font-extrabold text-slate-800 block text-xs mt-0.5">{itemMeta.bonus_spec}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] font-bold uppercase leading-none">Total Depot Stock:</span>
              <span className="font-extrabold text-[#741010] block text-xs mt-0.5">{itemMeta.total_stock}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] font-bold uppercase leading-none">Remarks Group:</span>
              <span className="font-extrabold text-slate-800 block text-xs mt-0.5">{itemMeta.remarks}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 border-t border-slate-200 pt-1.5 text-[10px] font-mono mt-2">
            <div>
              <span className="text-slate-400 block uppercase">Disc. % Allowance:</span>
              <span className="font-bold text-blue-900">{itemMeta.disc_percent}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase">Batch Packing Qty:</span>
              <span className="font-bold text-slate-900">{itemMeta.batch_qty} units/cs</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase">Max Ceiling %:</span>
              <span className="font-bold text-slate-900">{itemMeta.max_percent}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase">Safety limit:</span>
              <span className="font-bold text-[#8d0505]">{itemMeta.s_limit}</span>
            </div>
          </div>
        </div>

        {/* PANEL F: Ledger Totals - Bottom Right */}
        <div className="bg-slate-100 border-2 border-slate-300 p-2 shadow-sm space-y-1">
          <div className="bg-red-950 text-white font-bold p-0.5 px-1.5 uppercase text-[9px] mb-1.5 flex justify-between">
            <span>[ PANEL F: Double-Entry Ledger Book Booking ]</span>
            <span className="text-yellow-400 font-black">TALLY SUMS</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            
            <div className="space-y-1 shadow-inner bg-slate-200/50 p-1.5 border border-slate-300">
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Bill Gross Amount:</span>
                <span className="font-mono font-black text-slate-900">Rs. {billAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Net Sum Booking:</span>
                <span className="font-mono font-black text-blue-900">Rs. {netAmnt.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500 uppercase text-[9px]">Invoice Balance:</span>
                <span className="font-mono font-black text-red-800">Rs. {invoiceBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 uppercase text-[9px] whitespace-nowrap w-16 text-right">Payment/Cash:</span>
                <input
                  type="number"
                  value={payment || ''}
                  onChange={e => {
                    const val = Number(e.target.value);
                    setPayment(val);
                    setCounterCash(val);
                  }}
                  className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs text-right font-mono font-black text-emerald-800 font-bold"
                  placeholder="0"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 uppercase text-[9px] whitespace-nowrap w-16 text-right">Counter Cash:</span>
                <input
                  type="number"
                  value={counterCash || ''}
                  onChange={e => setCounterCash(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 px-1 py-0.5 text-xs text-right font-mono font-bold text-emerald-700 bg-slate-200"
                  readOnly
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-600 uppercase text-[9px] whitespace-nowrap w-16 text-right">Ledger Code:</span>
                <input
                  type="text"
                  value={acCode}
                  onChange={e => setAcCode(e.target.value)}
                  className="w-full bg-white border border-slate-400 px-1 py-0.5 text-xs font-mono"
                />
              </div>
            </div>

          </div>

          <div className="flex gap-1.5 mt-2 border-t border-slate-200 pt-1.5">
            <span className="font-bold text-slate-600 text-[9.5px] uppercase">Ledger Narration:</span>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white border border-slate-400 px-1 py-0.5 text-[11px] font-bold text-indigo-900"
            />
          </div>

        </div>

      </div>

      {/* 5. ACTION BAR (BOTTOM FOOTER) */}
      <div className="bg-slate-300 border-2 border-slate-400 p-1.5 flex flex-wrap gap-1 md:gap-1.5 justify-between">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={handleAddNew}
            className="bg-sky-700 hover:bg-sky-800 text-white font-black uppercase text-[10px] tracking-wide px-3 py-1.5 border border-sky-900 rounded shadow-md"
          >
            📋 Add New
          </button>
          
          <button
            type="button"
            onClick={handleSaveInvoice}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase text-[10px] tracking-wide px-3 py-1.5 border border-emerald-900 rounded shadow-md"
          >
            💾 Save Ledger
          </button>

          <button
            type="button"
            onClick={handleAddNew}
            className="bg-rose-700 hover:bg-rose-800 text-white font-bold uppercase text-[10px] px-2.5 py-1.5 border border-rose-900 rounded shadow"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={handlePrintSummary}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold uppercase text-[10px] px-2 py-1.5 border border-slate-950 rounded shadow"
          >
            🖨 Print Invoice
          </button>

          <button
            type="button"
            onClick={() => {
              const dt = prompt("Adjust Ledger Invoice Date (YYYY-MM-DD):", invoiceDate);
              if (dt) setInvoiceDate(dt);
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-[10px] px-2 py-1.5 border border-amber-800 rounded shadow"
          >
            Date Invoices
          </button>

          <button
            type="button"
            onClick={handlePrintSummary}
            className="bg-[#3e2723] hover:bg-[#4e342e] text-yellow-300 font-bold uppercase text-[9.5px] px-2 py-1.5 border border-[#1b0000] rounded shadow"
          >
            Print Itemwise sales Summary
          </button>

          <button
            type="button"
            onClick={handlePrintPRS}
            className="bg-[#1b5e20] hover:bg-[#2e7d32] text-white font-bold uppercase text-[9.5px] px-2 py-1.5 border border-[#0d3c12] rounded shadow"
          >
            Print Counter Sales PRS
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className="bg-slate-900 hover:bg-black text-amber-400 font-extrabold uppercase text-[10px] tracking-wider px-3 py-1.5 border border-black rounded shadow"
          >
            🏃 Exit [x]
          </button>
        </div>
      </div>

    </div>
  );
}
