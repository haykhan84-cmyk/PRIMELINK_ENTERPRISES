import React, { useState, useEffect, useRef } from 'react';
import { Package, ShieldAlert, Calendar, History, ArrowDownToLine, Plus, Search, Upload, Download, CheckCircle2, Truck, Mail, Phone, MapPin, Scan, FileText, Loader2, Save, X, AlertCircle, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import ColumnManager, { useColumns } from './ColumnManager';
import { formatDate } from '../lib/dateUtils';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function Inventory() {
  const [skus, setSkus] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [returnsCount, setReturnsCount] = useState(0);
  const [viewMode, setViewMode] = useState<'sku' | 'batch' | 'supplier' | 'register' | 'add_supplier' | 'ai_scan' | 'receipt' | 'claims'>('sku');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExpiryAlert, setShowExpiryAlert] = useState(false);
  const [nearExpiryProducts, setNearExpiryProducts] = useState<any[]>([]);
  const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  // Product Receipt State
  const [receiptDetails, setReceiptDetails] = useState({
    supplier_id: '',
    invoice_number: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [receiptRows, setReceiptRows] = useState([{
    sku_id: null as number | null,
    name: '',
    batch_number: '',
    expiry_date: '',
    quantity_units: 0,
    units_per_case: 12,
    cogs_per_unit: 0,
    category: 'General'
  }]);

  const [newSku, setNewSku] = useState({
    name: '',
    category: 'General',
    price_per_case: 0,
    price_per_unit: 0,
    units_per_case: 12,
    cogs_per_case: 0,
    cogs_per_unit: 0,
    supplier_id: '',
    gst_rate: 18,
    initial_batch: '',
    initial_expiry: '',
    initial_quantity: 0
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
      fetch('/api/suppliers').then(res => res.json()),
      fetch('/api/claims').then(res => res.json())
    ]).then(([skuData, invData, retData, supData, claimsData]) => {
      setSkus(Array.isArray(skuData) ? skuData : []);
      const inventoryList = Array.isArray(invData) ? invData : [];
      setInventory(inventoryList);
      setSuppliers(Array.isArray(supData) ? (() => {
        const seen = new Set();
        return supData.filter(s => {
          if (!s.name) return false;
          const name = s.name.trim().toLowerCase();
          if (seen.has(name)) return false;
          seen.add(name);
          return true;
        });
      })() : []);
      setClaims(Array.isArray(claimsData) ? claimsData : []);

      const returnsArray = Array.isArray(retData) ? retData : [];
      const totalReturns = returnsArray.reduce((acc: number, r: any) => acc + r.quantity, 0);
      setReturnsCount(totalReturns);

      // Check for 4-month expiry products
      const fourMonthsFromNow = new Date();
      fourMonthsFromNow.setMonth(fourMonthsFromNow.getMonth() + 4);
      
      const nearExpiry = inventoryList.filter((item: any) => {
        if (!item.expiry_date) return false;
        const expiryDate = new Date(item.expiry_date);
        return expiryDate > new Date() && expiryDate <= fourMonthsFromNow;
      });

      if (nearExpiry.length > 0) {
        setNearExpiryProducts(nearExpiry);
        setShowExpiryAlert(true);
        
        // Background auto-intimation - only if not already done in this session to avoid infinite loops and flooding
        // We'll process them one by one if needed, but for now let's just log and maybe suggest a batch endpoint
      }

      setLoading(false);
    }).catch(err => {
      console.error("Fetch error:", err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [nameSuggestions, setNameSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewSku({ ...newSku, name: value });

    // Show suggestions even if empty, or filter if typing
    const query = value.toLowerCase().trim();
    
    // Create unique list of SKU names for suggestions
    const seen = new Set();
    const uniqueSkus = skus.filter(s => {
      if (!s.name) return false;
      const nameLower = s.name.toLowerCase();
      
      // If empty query, show items. If query, show matches.
      const isMatch = query.length === 0 || nameLower.includes(query);
      
      if (isMatch && !seen.has(nameLower)) {
        seen.add(nameLower);
        return true;
      }
      return false;
    }).sort((a, b) => {
      if (query.length === 0) return a.name.localeCompare(b.name);
      const aStart = a.name.toLowerCase().startsWith(query);
      const bStart = b.name.toLowerCase().startsWith(query);
      if (aStart && !bStart) return -1;
      if (!aStart && bStart) return 1;
      return a.name.localeCompare(b.name);
    });
    
    const filtered = uniqueSkus.slice(0, 15); // Show more suggestions
    setNameSuggestions(filtered);
    setShowSuggestions(true);

    // Automation: If an exact name match exists, auto-set category
    if (query.length > 0) {
      const exactMatch = skus.find(s => s.name?.toLowerCase() === query);
      if (exactMatch) {
        setNewSku(prev => ({
          ...prev,
          name: value,
          category: exactMatch.category || prev.category,
          price_per_case: exactMatch.price_per_case || prev.price_per_case,
          price_per_unit: exactMatch.price_per_unit || prev.price_per_unit,
          units_per_case: exactMatch.units_per_case || prev.units_per_case,
          cogs_per_case: exactMatch.cogs_per_case || prev.cogs_per_case,
          cogs_per_unit: exactMatch.cogs_per_unit || prev.cogs_per_unit,
          supplier_id: exactMatch.supplier_id || prev.supplier_id,
          gst_rate: exactMatch.gst_rate || prev.gst_rate
        }));
      }
    }
  };

  const selectSuggestion = (suggestion: any) => {
    setNewSku({
      ...newSku,
      name: suggestion.name,
      category: suggestion.category,
      price_per_case: suggestion.price_per_case || 0,
      price_per_unit: suggestion.price_per_unit || 0,
      units_per_case: suggestion.units_per_case || 12,
      cogs_per_case: suggestion.cogs_per_case || 0,
      cogs_per_unit: suggestion.cogs_per_unit || 0,
      supplier_id: suggestion.supplier_id || '',
      gst_rate: suggestion.gst_rate || 18
    });
    setNameSuggestions([]);
    setShowSuggestions(false);
  };

  const handleIntimateSupplier = (claim: any) => {
    // In a real app, this would send an email or API request to supplier
    fetch(`/api/claims/${claim.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'intimated' })
    }).then(() => {
      fetchData();
      alert(`Intimation sent to supplier: ${claim.supplier_name}`);
    });
  };

  const handleAddClaim = (e: React.FormEvent) => {
    e.preventDefault();
    fetch('/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newClaim)
    }).then(() => {
      setIsAddClaimModalOpen(false);
      setNewClaim({
        supplier_id: '',
        sku_id: '',
        batch_number: '',
        quantity: 0,
        type: 'Damage',
        description: ''
      });
      fetchData();
    });
  };

  const handleAddSku = async (e: React.FormEvent, closeAfter = true) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/skus/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newSku])
      });
      if (res.ok) {
        const supplier = suppliers.find(s => s.id.toString() === newSku.supplier_id.toString());
        const balanceInfo = supplier ? `\n\nPayable balance for ${supplier.name} has been updated.` : '';
        alert(`${newSku.name} created successfully!${balanceInfo}\nCheck "Suppliers" tab for updated dues.`);
        if (closeAfter) {
          setIsAddSkuModalOpen(false);
          if (viewMode === 'register') setViewMode('sku');
        }
        setNewSku({
          name: '',
          category: 'General',
          price_per_case: 0,
          price_per_unit: 0,
          units_per_case: 12,
          cogs_per_case: 0,
          cogs_per_unit: 0,
          supplier_id: '',
          gst_rate: 18,
          initial_batch: '',
          initial_expiry: '',
          initial_quantity: 0
        });
        fetchData();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'Failed to create SKU'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Failed to connect to server.');
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
        alert('Supplier added successfully!');
        setIsAddSupplierModalOpen(false);
        if (viewMode === 'add_supplier') setViewMode('supplier');
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
        setViewMode('register');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const stockLevels = React.useMemo(() => {
    const levels: Record<number, number> = {};
    if (Array.isArray(inventory)) {
      inventory.forEach(inv => {
        levels[inv.sku_id] = (levels[inv.sku_id] || 0) + inv.quantity_cases;
      });
    }
    return levels;
  }, [inventory]);

  const [selectedSku, setSelectedSku] = useState<any>(null);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedSupplierAction, setSelectedSupplierAction] = useState<any>(null);
  const [isEditSkuModalOpen, setIsEditSkuModalOpen] = useState(false);
  const [isEditBatchModalOpen, setIsEditBatchModalOpen] = useState(false);
  const [isEditSupplierModalOpen, setIsEditSupplierModalOpen] = useState(false);
  const [isAddClaimModalOpen, setIsAddClaimModalOpen] = useState(false);
  const [newClaim, setNewClaim] = useState({
    supplier_id: '',
    sku_id: '',
    batch_number: '',
    quantity: 0,
    type: 'Damage',
    description: ''
  });

  // Column Management
  const { columns: skuColumns, updateColumns: updateSkuColumns } = useColumns('inventory_sku', [
    { id: 'details', label: 'SKU Details', visible: true },
    { id: 'category', label: 'Category', visible: true },
    { id: 'supplier', label: 'Supplier', visible: true },
    { id: 'units_per_pack', label: 'Units/Pack', visible: true },
    { id: 'unit_price', label: 'Unit Price', visible: true },
    { id: 'unit_cost', label: 'Unit Cost', visible: true },
    { id: 'cases', label: 'Cases', visible: true },
    { id: 'qty_units', label: 'Qty (Units)', visible: true },
  ]);

  const { columns: fefoColumns, updateColumns: updateFefoColumns } = useColumns('inventory_fefo', [
    { id: 'sku_batch', label: 'Batch / SKU', visible: true },
    { id: 'expiry', label: 'Expiry Date', visible: true },
    { id: 'remaining', label: 'Days Left', visible: true },
    { id: 'stock', label: 'Qty (Cases)', visible: true },
    { id: 'risk', label: 'FEFO Status', visible: true },
  ]);

  const handleUpdateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) return;
    try {
      const res = await fetch(`/api/skus/${selectedSku.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedSku)
      });
      if (res.ok) {
        setIsEditSkuModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      const res = await fetch(`/api/inventory/${selectedBatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedBatch)
      });
      if (res.ok) {
        setIsEditBatchModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBatch = async (batchItem?: any) => {
    const target = batchItem || selectedBatch;
    if (!target) return;
    if (!confirm(`Are you sure you want to delete this batch entry? This will adjust your stock immediately.`)) return;

    try {
      const res = await fetch(`/api/inventory/${target.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setIsEditBatchModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierAction) return;
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierAction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedSupplierAction)
      });
      if (res.ok) {
        setIsEditSupplierModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSku = async (skuItem?: any) => {
    const target = skuItem || selectedSku;
    if (!target || !target.id) {
      alert("No SKU selected or ID missing.");
      return;
    }
    
    console.log("Attempting to delete SKU:", target);
    const confirmed = confirm(`Are you sure you want to PERMANENTLY delete "${target.name}"?\n\nThis will also remove all associated inventory batches, order records, and returns. This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/skus/${target.id}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert("SKU and all related data deleted successfully.");
        setIsEditSkuModalOpen(false);
        fetchData();
      } else {
        alert(`Error deleting SKU: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Delete Error:", err);
      alert(`Failed to delete SKU: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const nearExpiryCount = React.useMemo(() => {
    if (!Array.isArray(inventory)) return 0;
    return inventory.filter(inv => {
      if (!inv.expiry_date) return false;
      const daysLeft = Math.ceil((new Date(inv.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      return daysLeft < 30;
    }).reduce((acc, inv) => acc + inv.quantity_cases, 0);
  }, [inventory]);

  const filteredSkus = Array.isArray(skus) ? skus.filter(s => 
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const filteredInventory = Array.isArray(inventory) ? inventory.filter(inv => 
    (inv.sku_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (inv.batch_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const filteredSuppliers = Array.isArray(suppliers) ? suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

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
          const headers = lines[0].split(',').map(h => h.trim());
          data = lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((h, i) => {
              const val = values[i];
              // Map user CSV headers to internal schema
              const header = h.toLowerCase();
              if (header === 'sku name' || header === 'product name' || header === 'name') {
                obj['name'] = val;
              } else if (header === 'price' || header === 'rate') {
                obj['price_per_unit'] = Number(val);
                obj['price_per_case'] = Number(val) * 12; // Assume 12 units/case
                obj['cogs_per_case'] = Math.round(Number(val) * 12 * 0.7); // Estimate COGS
              } else if (header === 'group' || header === 'category') {
                obj['category'] = val;
              } else if (header === 'units per pack' || header === 'units per case') {
                obj['units_per_case'] = Number(val);
              } else if (header === 'price pack' || header === 'case sale price') {
                obj['price_per_case'] = Number(val);
              } else if (header === 'unit price' || header === 'price per piece') {
                obj['price_per_unit'] = Number(val);
              } else if (header === 'cost pack' || header === 'cogs per case') {
                obj['cogs_per_case'] = Number(val);
              } else if (header === 'unit cost' || header === 'cogs per piece') {
                obj['cogs_per_unit'] = Number(val);
              } else if (header === 'batch no' || header === 'batch no.') {
                obj['initial_batch'] = val;
              } else if (header === 'expiry date' || header === 'expiry' || header === 'expiry no') {
                obj['initial_expiry'] = val;
              } else if (header === 'qty(units)' || header === 'initial quantity' || header === 'stock') {
                obj['initial_quantity'] = Number(val);
              } else if (header === 'supplier' || header === 'company') {
                // If it's a string, we might need to find the supplier ID or just store it
                obj['supplier_name'] = val;
              } else {
                // Generic handling
                const key = h.toLowerCase().replace(/ /g, '_');
                if (['price_per_case', 'price_per_unit', 'units_per_case', 'cogs_per_case'].includes(key)) {
                  obj[key] = Number(val);
                } else {
                  obj[key] = val;
                }
              }
            });
            // Defaults
            if (!obj['units_per_case']) obj['units_per_case'] = 12;
            if (!obj['category']) obj['category'] = 'General';
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

  const handleAiScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiLoading(true);
    setViewMode('ai_scan');

    try {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Extract all inventory items from this supplier invoice. Return a JSON array of objects. 
              Each object must have: 
              - "name" (strictly clean product name)
              - "quantity" (number, total units)
              - "price" (unit price if found, else null)
              - "batch" (batch number if found)
              - "expiry" (expiry date YYYY-MM-DD if found)
              
              Context: This is for a Panr Distribution Hub in Swat, KP. Local currency is PKR. 
              Be extremely precise with quantities.` },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
                batch: { type: Type.STRING },
                expiry: { type: Type.STRING }
              },
              required: ["name", "quantity"]
            }
          }
        }
      });

      const results = JSON.parse(response.text);
      
      // If results look good, pre-populate receipt rows!
      const mappedRows = results.map((item: any) => {
        const match = skus.find(s => 
          s.name.toLowerCase().includes(item.name.toLowerCase()) || 
          item.name.toLowerCase().includes(s.name.toLowerCase())
        );
        return {
          sku_id: match ? match.id : null,
          name: match ? match.name : item.name,
          batch_number: item.batch || '',
          expiry_date: item.expiry || '',
          quantity_units: item.quantity || 0,
          units_per_case: match ? match.units_per_case : 12,
          cogs_per_unit: item.price || 0,
          category: match ? match.category : 'General'
        };
      });

      setReceiptRows(mappedRows);
      setViewMode('receipt');
      setAiResults(results); // Keep original results if needed
    } catch (err) {
      console.error("AI Scan Error:", err);
      alert("Failed to scan invoice. Please ensure it's a clear image or PDF.");
      setViewMode('sku');
    } finally {
      setAiLoading(false);
      if (aiFileRef.current) aiFileRef.current.value = '';
    }
  };

  const addReceiptRow = () => {
    setReceiptRows([...receiptRows, {
      sku_id: null,
      name: '',
      batch_number: '',
      expiry_date: '',
      quantity_units: 0,
      units_per_case: 12,
      cogs_per_unit: 0,
      category: 'General'
    }]);
  };

  const removeReceiptRow = (index: number) => {
    if (receiptRows.length > 1) {
      setReceiptRows(receiptRows.filter((_, i) => i !== index));
    }
  };

  const updateReceiptRow = (index: number, field: string, value: any) => {
    const newRows = [...receiptRows];
    newRows[index] = { ...newRows[index], [field]: value };
    
    // Auto-fill logic for SKU name
    if (field === 'name') {
      const match = skus.find(s => s.name?.toLowerCase() === value.toLowerCase().trim());
      if (match) {
        newRows[index].sku_id = match.id;
        newRows[index].name = match.name;
        newRows[index].units_per_case = match.units_per_case;
        newRows[index].cogs_per_unit = match.cogs_per_unit || 0;
        newRows[index].category = match.category;
      } else {
        newRows[index].sku_id = null;
      }
    }
    
    setReceiptRows(newRows);
  };

  const handleReceiptSubmit = async () => {
    if (!receiptDetails.supplier_id || !receiptDetails.invoice_number) {
      alert("Please select a supplier and provide an invoice number.");
      return;
    }

    const validRows = receiptRows.filter(r => r.name && r.quantity_units > 0);
    if (validRows.length === 0) {
      alert("Please enter at least one valid item with name and quantity.");
      return;
    }

    try {
      const res = await fetch('/api/inventory/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...receiptDetails,
          items: validRows
        })
      });

      if (res.ok) {
        alert("Product receipt recorded successfully! Dues updated for supplier.");
        setViewMode('sku');
        setReceiptRows([{
          sku_id: null,
          name: '',
          batch_number: '',
          expiry_date: '',
          quantity_units: 0,
          units_per_case: 12,
          cogs_per_unit: 0,
          category: 'General'
        }]);
        setReceiptDetails({ ...receiptDetails, invoice_number: '' });
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to commit receipt.");
    }
  };

  const handleSaveAiResults = async () => {
    const unlinked = aiResults.filter(r => !r.sku_id);
    if (unlinked.length > 0) {
      alert(`Please link ${unlinked.length} items to existing SKUs or register them first.`);
      return;
    }

    try {
      const payloads = aiResults.map(res => ({
        sku_id: res.sku_id,
        batch_number: res.batch || `AI-${new Date().getTime().toString().slice(-6)}`,
        expiry_date: res.expiry || null,
        quantity_cases: 0,
        quantity_units: res.quantity
      }));

      const res = await fetch('/api/inventory/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads)
      });

      if (res.ok) {
        alert("Stock updated successfully!");
        setAiResults([]);
        setViewMode('sku');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportMasterSkuList = () => {
    const headers = ["ID", "SKU Name", "Category", "Supplier", "Units/Pack", "Unit Price", "Unit Cost", "Total Qty (Units)"];
    const rows = filteredSkus.map(sku => {
      const packSize = sku.units_per_case || 1;
      const unitPrice = (sku.price_per_case / packSize).toFixed(2);
      const unitCost = (sku.cogs_per_case / packSize).toFixed(2);
      const totalUnits = (stockLevels[sku.id] || 0) * packSize;

      return [
        sku.id,
        `"${sku.name.replace(/"/g, '""')}"`,
        `"${(sku.category || '').replace(/"/g, '""')}"`,
        `"${(sku.supplier_name || 'N/A').replace(/"/g, '""')}"`,
        packSize || 1,
        unitPrice || 0,
        unitCost || 0,
        totalUnits || 0
      ];
    });
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Master_SKU_List_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            onClick={exportMasterSkuList}
            className="btn-outline flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Bulk Export
          </button>
          <button 
            onClick={() => setViewMode('receipt')}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-700 transition-all shadow-[4px_4px_0px_0px_#78350f]"
          >
            <ArrowDownToLine className="w-4 h-4" />
            Product Receipt
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
            <div className="flex bg-slate-100 p-1 rounded-xl relative z-20">
              <button 
                onClick={() => setViewMode('sku')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-30 ${viewMode === 'sku' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Master SKU List
              </button>
              <button 
                onClick={() => setViewMode('batch')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-30 ${viewMode === 'batch' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Batch Expiry (FEFO)
              </button>
              <button 
                onClick={() => setViewMode('receipt')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-30 ${viewMode === 'receipt' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Receipts (Batch)
              </button>
              <button 
                onClick={() => setViewMode('claims')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer relative z-30 ${viewMode === 'claims' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
              >
                Claims
              </button>
            </div>
            {viewMode === 'batch' && <ColumnManager columns={fefoColumns} onUpdate={updateFefoColumns} title="FEFO Columns" />}
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
          {viewMode === 'sku' && (
            <div className="flex items-center gap-2">
              <ColumnManager columns={skuColumns} onUpdate={updateSkuColumns} title="SKU Columns" />
            </div>
          )}
        </div>

        <div className={viewMode === 'sku' || viewMode === 'batch' || viewMode === 'receipt' ? 'overflow-x-auto' : ''}>
          {viewMode === 'receipt' ? (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Supplier</label>
                   <select 
                     value={receiptDetails.supplier_id} 
                     onChange={e => setReceiptDetails({...receiptDetails, supplier_id: e.target.value})}
                     className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none"
                   >
                     <option value="">Select Supplier</option>
                     {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Invoice Number</label>
                   <input 
                     type="text" 
                     placeholder="e.g. 00000000291"
                     value={receiptDetails.invoice_number}
                     onChange={e => setReceiptDetails({...receiptDetails, invoice_number: e.target.value})}
                     className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" 
                   />
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Receipt Date</label>
                   <input 
                     type="date" 
                     value={receiptDetails.date}
                     onChange={e => setReceiptDetails({...receiptDetails, date: e.target.value})}
                     className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none" 
                   />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                      <th className="p-4 min-w-[250px]">Product / SKU Name</th>
                      <th className="p-4">Batch #</th>
                      <th className="p-4">Expiry</th>
                      <th className="p-4 w-24">QTY (U)</th>
                      <th className="p-4 w-24 text-center">Pack</th>
                      <th className="p-4 text-right">TP (Unit)</th>
                      <th className="p-4 text-right">Value</th>
                      <th className="p-4 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {receiptRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-2 relative">
                          <input 
                            placeholder="Type to search or add new..."
                            value={row.name}
                            onChange={e => {
                               updateReceiptRow(idx, 'name', e.target.value);
                               // Show standard suggestions logic here if needed
                            }}
                            className="w-full bg-white border border-slate-100 group-hover:border-primary rounded-lg p-3 text-xs font-bold outline-none uppercase"
                          />
                          {row.sku_id && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase bg-emerald-50 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Found
                            </span>
                          )}
                          {!row.sku_id && row.name && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase bg-amber-50 px-1.5 py-0.5 rounded">
                              <Plus className="w-2.5 h-2.5" /> New SKU
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          <input 
                            placeholder="Batch"
                            value={row.batch_number}
                            onChange={e => updateReceiptRow(idx, 'batch_number', e.target.value)}
                            className="w-full bg-white border border-slate-100 rounded-lg p-3 text-xs font-mono outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="date"
                            value={row.expiry_date}
                            onChange={e => updateReceiptRow(idx, 'expiry_date', e.target.value)}
                            className="w-full bg-white border border-slate-100 rounded-lg p-3 text-xs outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            placeholder="0"
                            value={row.quantity_units || ''}
                            onChange={e => updateReceiptRow(idx, 'quantity_units', Number(e.target.value))}
                            className="w-full bg-white border border-slate-100 rounded-lg p-3 text-xs font-black text-center outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="number"
                            placeholder="12"
                            value={row.units_per_case || ''}
                            onChange={e => updateReceiptRow(idx, 'units_per_case', Number(e.target.value))}
                            className="w-full bg-white border border-slate-100 rounded-lg p-3 text-xs font-bold text-center outline-none opacity-50 focus:opacity-100"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input 
                            type="number"
                            placeholder="0.00"
                            value={row.cogs_per_unit || ''}
                            onChange={e => updateReceiptRow(idx, 'cogs_per_unit', Number(e.target.value))}
                            className="w-full bg-white border border-slate-100 rounded-lg p-3 text-xs font-black text-right text-rose-600 outline-none"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <div className="text-xs font-black text-slate-800 tabular-nums">
                            Rs. {((row.quantity_units || 0) * (row.cogs_per_unit || 0)).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <button onClick={() => removeReceiptRow(idx)} className="p-2 text-slate-300 hover:text-rose-600 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button 
                  onClick={addReceiptRow}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all font-sans"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Row
                </button>

                <div className="flex items-center gap-6">
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Purchase Value</p>
                      <p className="text-2xl font-black italic text-rose-600 tabular-nums">
                        Rs. {receiptRows.reduce((sum, r) => sum + ((r.quantity_units || 0) * (r.cogs_per_unit || 0)), 0).toLocaleString()}
                      </p>
                   </div>
                   <button 
                     onClick={handleReceiptSubmit}
                     className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all font-sans"
                   >
                     Commit Receipt
                   </button>
                </div>
              </div>
            </div>
          ) : viewMode === 'claims' ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none">Damage & Leakage <span className="text-primary">Claims</span></h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Track and intimate suppliers about stock issues</p>
                </div>
                <button 
                  onClick={() => setIsAddClaimModalOpen(true)}
                  className="btn-primary flex items-center gap-2 px-6"
                >
                  <Plus className="w-4 h-4" />
                  New Claim
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Product</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {claims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-xs font-bold text-slate-600 font-mono">{new Date(claim.date).toLocaleDateString()}</td>
                        <td className="p-4 text-xs font-black uppercase tracking-widest text-slate-900">{claim.supplier_name}</td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-slate-900 leading-none mb-1">{claim.sku_name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lot: {claim.batch_number || 'N/A'}</p>
                        </td>
                        <td className="p-4">
                           <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                             claim.type === 'Damage' ? 'bg-amber-100 text-amber-700' : 
                             claim.type === 'Leakage' ? 'bg-blue-100 text-blue-700' : 
                             'bg-rose-100 text-rose-700'
                           }`}>
                             {claim.type}
                           </span>
                        </td>
                        <td className="p-4 text-center font-black text-slate-700">{claim.quantity}</td>
                        <td className="p-4">
                           <span className={`text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest ${
                             claim.status === 'pending' ? 'bg-slate-100 text-slate-500' : 
                             claim.status === 'intimated' ? 'bg-indigo-100 text-indigo-700' : 
                             'bg-emerald-100 text-emerald-700'
                           }`}>
                             {claim.status}
                           </span>
                        </td>
                        <td className="p-4 text-right">
                          {claim.status === 'pending' && (
                            <button 
                              onClick={() => handleIntimateSupplier(claim)}
                              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                            >
                              Intimate Supplier
                            </button>
                          )}
                          {claim.status === 'intimated' && (
                            <button 
                              onClick={() => {
                                fetch(`/api/claims/${claim.id}/status`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'settled' })
                                }).then(() => fetchData());
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                            >
                              Mark Settled
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {claims.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400">
                          <AlertCircle className="w-12 h-12 opacity-10 mx-auto mb-4" />
                          <p className="text-xs font-black uppercase tracking-widest">No claims registered</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : viewMode === 'ai_scan' ? (
            <div className="p-8">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800">Analyzing Document</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Gemini Vision AI Engine Engaging...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none">Extracted <span className="text-primary">Inventory Data</span></h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Review matches and link missing SKUs below</p>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setAiResults([]); setViewMode('sku'); }}
                        className="btn-outline px-6"
                      >
                        Discard
                      </button>
                      <button 
                        onClick={handleSaveAiResults}
                        className="btn-primary px-8 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Confirm & Import
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                    <div className="space-y-4">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Scanned Items</p>
                       {aiResults.map((item, idx) => (
                         <div key={idx} className="bg-white border-2 border-slate-100 rounded-2xl p-5 flex items-center justify-between group hover:border-primary transition-all">
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2 mb-1">
                                 <span className="font-black text-slate-900 truncate uppercase">{item.name}</span>
                                 {item.is_new ? (
                                   <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">New</span>
                                 ) : (
                                   <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Matched</span>
                                 )}
                               </div>
                               <div className="flex items-center gap-6">
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Qty Extracted</span>
                                    <span className="text-sm font-black text-slate-700">{item.quantity} Units</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Unit Price</span>
                                    <span className="text-sm font-black text-slate-700">Rs. {item.price || '-'}</span>
                                  </div>
                                  {item.expiry && (
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Expiry</span>
                                      <span className="text-sm font-black text-rose-500">{item.expiry}</span>
                                    </div>
                                  )}
                               </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 ml-4">
                               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Link to SKU</label>
                               <select 
                                 value={item.sku_id || ''} 
                                 onChange={(e) => {
                                   const newResults = [...aiResults];
                                   const skuId = e.target.value;
                                   const skuMatch = skus.find(s => s.id.toString() === skuId.toString());
                                   newResults[idx].sku_id = skuId;
                                   newResults[idx].matched_name = skuMatch?.name;
                                   newResults[idx].is_new = !skuId;
                                   setAiResults(newResults);
                                 }}
                                 className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-primary w-40"
                               >
                                 <option value="">-- No Match --</option>
                                 {skus.map(sku => (
                                   <option key={sku.id} value={sku.id}>{sku.name}</option>
                                 ))}
                               </select>
                            </div>
                         </div>
                       ))}
                    </div>

                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 h-fit sticky top-6">
                       <FileText className="w-12 h-12 text-slate-200 mb-4" />
                       <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 mb-2">Import <span className="text-primary">Summary</span></h3>
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed mb-6">You are about to add stock for {aiResults.length} items to the Inventory Ledger.</p>
                       
                       <div className="space-y-3 mb-8">
                          <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total SKU Entries</span>
                             <span className="font-black text-slate-800">{aiResults.length}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Successfully Linked</span>
                             <span className="font-black text-emerald-600">{aiResults.filter(r => r.sku_id).length}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unlinked/New</span>
                             <span className="font-black text-rose-600">{aiResults.filter(r => !r.sku_id).length}</span>
                          </div>
                       </div>

                       {aiResults.some(r => !r.sku_id) && (
                         <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 mb-6">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-[9px] font-bold text-amber-800 uppercase tracking-widest leading-relaxed">
                              Some items are not linked to existing SKUs. Please link them manually or register them in the "Create SKU" tab first.
                            </p>
                         </div>
                       )}

                       <button 
                         disabled={aiResults.some(r => !r.sku_id)}
                         onClick={handleSaveAiResults}
                         className="w-full btn-primary py-4 font-black text-xs uppercase tracking-[0.2em] shadow-[5px_5px_0px_0px_#1e293b] disabled:opacity-50 disabled:grayscale transition-all"
                       >
                         Complete Stock Inflow
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'sku' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {skuColumns.find(c => c.id === 'details')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">SKU Details</th>}
                  {skuColumns.find(c => c.id === 'category')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>}
                  {skuColumns.find(c => c.id === 'supplier')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</th>}
                  {skuColumns.find(c => c.id === 'units_per_pack')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Units/Pack</th>}
                  {skuColumns.find(c => c.id === 'unit_price')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Unit Price</th>}
                  {skuColumns.find(c => c.id === 'unit_cost')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Unit Cost</th>}
                  {skuColumns.find(c => c.id === 'cases')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Cases</th>}
                  {skuColumns.find(c => c.id === 'qty_units')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty (Units)</th>}
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => {
                  const packSize = sku.units_per_case || 1;
                  const unitPrice = (sku.price_per_case || 0) / packSize;
                  const cogsPerUnit = (sku.cogs_per_case || 0) / packSize;
                  const cases = stockLevels[sku.id] || 0;
                  const totalUnits = cases * packSize;

                  return (
                    <tr 
                      key={sku.id} 
                      onDoubleClick={() => {
                        setSelectedSku({...sku});
                        setIsEditSkuModalOpen(true);
                      }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      {skuColumns.find(c => c.id === 'details')?.visible && (
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className="font-bold text-slate-900">{sku.name}</span>
                          </div>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'category')?.visible && (
                        <td className="p-4">
                          <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-widest">
                            {sku.category}
                          </span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'supplier')?.visible && (
                        <td className="p-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {sku.supplier_name || '-'}
                          </span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'units_per_pack')?.visible && (
                        <td className="p-4 text-center">
                          <span className="text-xs font-bold text-slate-600">{packSize}</span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'unit_price')?.visible && (
                        <td className="p-4 text-right">
                          <span className="font-mono text-xs font-bold text-slate-900">Rs. {(unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'unit_cost')?.visible && (
                        <td className="p-4 text-right">
                          <span className="font-mono text-xs font-bold text-slate-400">Rs. {(cogsPerUnit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'cases')?.visible && (
                        <td className="p-4 text-center">
                          <span className="font-bold text-slate-600">
                            {cases.toLocaleString()}
                          </span>
                        </td>
                      )}
                      {skuColumns.find(c => c.id === 'qty_units')?.visible && (
                        <td className="p-4 text-center">
                          <span className="font-black text-slate-900 leading-none">
                            {totalUnits.toLocaleString()}
                          </span>
                        </td>
                      )}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSku({...sku});
                              setIsEditSkuModalOpen(true);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-primary bg-slate-100 hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg transition-all"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSku(sku);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : viewMode === 'batch' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {fefoColumns.find(c => c.id === 'sku_batch')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Batch / SKU</th>}
                  {fefoColumns.find(c => c.id === 'expiry')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Expiry Date</th>}
                  {fefoColumns.find(c => c.id === 'remaining')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Days Left</th>}
                  {fefoColumns.find(c => c.id === 'stock')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty (Cases)</th>}
                  {fefoColumns.find(c => c.id === 'risk')?.visible && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">FEFO Status</th>}
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((inv) => {
                  const daysLeft = Math.ceil((new Date(inv.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return (
                    <tr 
                      key={inv.id} 
                      onDoubleClick={() => {
                        setSelectedBatch({...inv});
                        setIsEditBatchModalOpen(true);
                      }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      {fefoColumns.find(c => c.id === 'sku_batch')?.visible && (
                        <td className="p-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Lot: {inv.batch_number}</p>
                            <span className="font-bold text-slate-900">{inv.sku_name}</span>
                          </div>
                        </td>
                      )}
                      {fefoColumns.find(c => c.id === 'expiry')?.visible && (
                        <td className="p-4 text-center">
                          <span className={`text-xs font-bold font-mono ${daysLeft < 30 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {formatDate(inv.expiry_date)}
                          </span>
                        </td>
                      )}
                      {fefoColumns.find(c => c.id === 'remaining')?.visible && (
                        <td className="p-4 text-center">
                          <span className={`text-xs font-black uppercase px-3 py-1 rounded-full ${daysLeft < 30 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                            {daysLeft > 0 ? `${daysLeft} Days` : 'Expired'}
                          </span>
                        </td>
                      )}
                      {fefoColumns.find(c => c.id === 'stock')?.visible && (
                        <td className="p-4 text-center">
                          <span className="font-black text-slate-900">{inv.quantity_cases}</span>
                        </td>
                      )}
                      {fefoColumns.find(c => c.id === 'risk')?.visible && (
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
                      )}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBatch({...inv});
                              setIsEditBatchModalOpen(true);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-primary bg-slate-100 hover:bg-primary hover:text-white px-2 py-1.5 rounded-lg transition-all"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBatch(inv);
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white px-2 py-1.5 rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : viewMode === 'supplier' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-slate-50">
              {filteredSuppliers.map(sup => (
                <div 
                  key={sup.id} 
                  onDoubleClick={() => {
                    setSelectedSupplierAction({...sup});
                    setIsEditSupplierModalOpen(true);
                  }}
                  className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-emerald-100 rounded-xl group-hover:scale-110 transition-transform">
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

                        <div className="mt-6 p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100">
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Payable Balance</p>
                            <p className={`text-lg font-black leading-none ${sup.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              Rs. {sup.balance?.toLocaleString() || 0}
                            </p>
                          </div>
                          <div className={`p-2 rounded-lg ${sup.balance > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <ShieldAlert className="w-4 h-4" />
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-50 flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                setNewSku({
                                  name: '',
                                  category: sup.category || 'General',
                                  price_per_case: 0,
                                  price_per_unit: 0,
                                  units_per_case: 12,
                                  cogs_per_case: 0,
                                  cogs_per_unit: 0,
                                  supplier_id: sup.id.toString(),
                                  gst_rate: 18,
                                  initial_batch: '',
                                  initial_expiry: '',
                                  initial_quantity: 0
                                });
                                setViewMode('register');
                              }}
                              className="bg-primary text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3 h-3" />
                              New Stock
                            </button>
                            <button 
                              onClick={() => {
                                alert("Supplier Statement feature coming soon.");
                              }}
                              className="bg-slate-100 text-slate-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                              <History className="w-3 h-3" />
                              Statement
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              onClick={() => {
                                setSelectedSupplierAction({...sup});
                                setIsEditSupplierModalOpen(true);
                              }}
                              className="py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-primary bg-slate-50 hover:bg-slate-100 transition-all"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm(`Delete supplier "${sup.name}"? This action is permanent.`)) {
                                  fetch(`/api/suppliers/${sup.id}`, { method: 'DELETE' })
                                    .then(res => {
                                      if (res.ok) {
                                        fetchData();
                                      } else {
                                        return res.json().then(data => {
                                          throw new Error(data.error || "Failed to delete supplier");
                                        });
                                      }
                                    })
                                    .catch(err => {
                                      alert("Error: " + err.message);
                                    });
                                }
                              }}
                              className="py-2 rounded-lg text-[9px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 hover:bg-rose-100 transition-all"
                            >
                              Delete
                            </button>
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
          ) : viewMode === 'register' ? (
            <div className="max-w-2xl mx-auto p-8">
               <h3 className="text-xl font-black uppercase tracking-widest text-primary mb-8 border-b-4 border-primary inline-block">Register New SKU</h3>
               <form onSubmit={(e) => handleAddSku(e)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2 relative">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product Name</label>
                      <input 
                        required
                        type="text" 
                        value={newSku.name}
                        onChange={handleNameChange}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onFocus={() => {
                            // Fetch suggestions immediately on focus
                            const seen = new Set();
                            const matches = skus.filter(s => {
                              if (!s.name) return false;
                              const nameLower = s.name.toLowerCase();
                              if (!seen.has(nameLower)) {
                                seen.add(nameLower);
                                return true;
                              }
                              return false;
                            }).slice(0, 15);
                            setNameSuggestions(matches);
                            setShowSuggestions(true);
                        }}
                        placeholder="Type product name..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
                      />
                      {showSuggestions && nameSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                          {nameSuggestions.map((suggestion, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => selectSuggestion(suggestion)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-none group flex justify-between items-center"
                            >
                              <div>
                                <p className="text-sm font-bold text-slate-900">{suggestion.name}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{suggestion.category}</p>
                              </div>
                              <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                      <select 
                        value={newSku.category}
                        onChange={(e) => setNewSku({...newSku, category: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      >
                        <option value="General">General</option>
                        <option value="SATT">SATT</option>
                        <option value="FLOURS">FLOURS</option>
                        <option value="Energy Drinks">Energy Drinks</option>
                        <option value="CSD">CSD</option>
                        <option value="ALKALINE Water">ALKALINE Water</option>
                        <option value="Cosmetic">Cosmetic</option>
                        <option value="Tissues">Tissues</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier</label>
                      <select 
                        value={newSku.supplier_id}
                        onChange={(e) => setNewSku({...newSku, supplier_id: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Units per pack</label>
                      <input 
                        type="number" 
                        value={newSku.units_per_case}
                        onChange={(e) => {
                          const units = Number(e.target.value);
                          const piecePrice = units > 0 ? parseFloat((newSku.price_per_case / units).toFixed(2)) : 0;
                          const pieceCogs = units > 0 ? parseFloat((newSku.cogs_per_case / units).toFixed(2)) : 0;
                          setNewSku({...newSku, units_per_case: units, price_per_unit: piecePrice, cogs_per_unit: pieceCogs});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Price Pack (PKR)</label>
                      <input 
                        type="number" 
                        value={newSku.price_per_case}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const piece = newSku.units_per_case > 0 ? parseFloat((val / newSku.units_per_case).toFixed(2)) : 0;
                          setNewSku({...newSku, price_per_case: val, price_per_unit: piece});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Price (PKR)</label>
                      <input 
                        type="number" 
                        value={newSku.price_per_unit}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const cse = parseFloat((val * newSku.units_per_case).toFixed(2));
                          setNewSku({...newSku, price_per_unit: val, price_per_case: cse});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Cost Pack (PKR)</label>
                      <input 
                        type="number" 
                        value={newSku.cogs_per_case}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const piece = newSku.units_per_case > 0 ? parseFloat((val / newSku.units_per_case).toFixed(2)) : 0;
                          setNewSku({...newSku, cogs_per_case: val, cogs_per_unit: piece});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Cost (PKR)</label>
                      <input 
                        type="number" 
                        value={newSku.cogs_per_unit}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const cse = parseFloat((val * newSku.units_per_case).toFixed(2));
                          setNewSku({...newSku, cogs_per_unit: val, cogs_per_case: cse});
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>

                    <div className="col-span-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Expected Margin</p>
                        <p className="text-xl font-black text-emerald-700">
                          Rs. {(newSku.price_per_case - newSku.cogs_per_case).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Margin %</p>
                        <p className="text-xl font-black text-emerald-700">
                          {newSku.price_per_case > 0 ? ((newSku.price_per_case - newSku.cogs_per_case) / newSku.price_per_case * 100).toFixed(1) : 0}%
                        </p>
                      </div>
                    </div>

                    <div className="col-span-2 pt-4 border-t border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Initial Stock Entry</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Batch No.</label>
                          <input 
                            type="text" 
                            placeholder="BN-XXXX"
                            value={newSku.initial_batch}
                            onChange={(e) => setNewSku({...newSku, initial_batch: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Expiry</label>
                          <input 
                            type="date" 
                            value={newSku.initial_expiry}
                            onChange={(e) => setNewSku({...newSku, initial_expiry: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Qty(Units)</label>
                          <input 
                            type="number" 
                            value={newSku.initial_quantity}
                            onChange={(e) => setNewSku({...newSku, initial_quantity: Number(e.target.value)})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6">
                    <button 
                      type="button"
                      onClick={(e) => handleAddSku(e as any, false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      Save & Add Another
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Save & Finish
                    </button>
                  </div>
               </form>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-8">
               <h3 className="text-xl font-black uppercase tracking-widest text-emerald-600 mb-8 border-b-4 border-emerald-600 inline-block">Register New Supplier</h3>
               <form onSubmit={handleAddSupplier} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier Name</label>
                       <input 
                         required
                         type="text" 
                         value={newSupplier.name}
                         onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none flex items-center gap-3"
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
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Phone Number</label>
                      <input 
                        type="tel" 
                        value={newSupplier.phone}
                        onChange={(e) => setNewSupplier({...newSupplier, phone: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Email Address</label>
                      <input 
                        type="email" 
                        value={newSupplier.email}
                        onChange={(e) => setNewSupplier({...newSupplier, email: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                      <select 
                        value={newSupplier.category}
                        onChange={(e) => setNewSupplier({...newSupplier, category: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      >
                        <option value="General">General</option>
                        <option value="Wholesaler">Wholesaler</option>
                        <option value="Distributor">Distributor</option>
                        <option value="Manufacturer">Manufacturer</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Business Address</label>
                      <textarea 
                        rows={3}
                        value={newSupplier.address}
                        onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none resize-none"
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    Save Supplier
                  </button>
               </form>
            </div>
          ) }
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
                <div className="col-span-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product Name</label>
                  <input 
                    required
                    type="text" 
                    value={newSku.name}
                    onChange={handleNameChange}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    onFocus={() => {
                        // Fetch suggestions immediately on focus
                        const seen = new Set();
                        const matches = skus.filter(s => {
                          if (!s.name) return false;
                          const nameLower = s.name.toLowerCase();
                          if (!seen.has(nameLower)) {
                            seen.add(nameLower);
                            return true;
                          }
                          return false;
                        }).slice(0, 15);
                        setNameSuggestions(matches);
                        setShowSuggestions(true);
                    }}
                    placeholder="Type product name..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none"
                  />
                  {showSuggestions && nameSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      {nameSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectSuggestion(suggestion)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-none group flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{suggestion.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{suggestion.category}</p>
                          </div>
                          <Plus className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                  <select 
                    value={newSku.category}
                    onChange={(e) => setNewSku({...newSku, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="General">General</option>
                    <option value="SATT">SATT</option>
                    <option value="FLOURS">FLOURS</option>
                    <option value="Energy Drinks">Energy Drinks</option>
                    <option value="CSD">CSD</option>
                    <option value="ALKALINE Water">ALKALINE Water</option>
                    <option value="Cosmetic">Cosmetic</option>
                    <option value="Tissues">Tissues</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier</label>
                  <select 
                    value={newSku.supplier_id || ''}
                    onChange={(e) => setNewSku({...newSku, supplier_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="">No Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {newSku.supplier_id && (
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-[9px] font-black uppercase text-slate-400">Current Payable</span>
                      <span className="text-[10px] font-black text-rose-600">
                        Rs. {suppliers.find(s => s.id.toString() === newSku.supplier_id.toString())?.balance?.toLocaleString() || 0}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Units per pack</label>
                  <input 
                    type="number" 
                    value={newSku.units_per_case}
                    onChange={(e) => {
                      const units = Number(e.target.value);
                      const piecePrice = units > 0 ? parseFloat((newSku.price_per_case / units).toFixed(2)) : 0;
                      const pieceCogs = units > 0 ? parseFloat((newSku.cogs_per_case / units).toFixed(2)) : 0;
                      setNewSku({...newSku, units_per_case: units, price_per_unit: piecePrice, cogs_per_unit: pieceCogs});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Price Pack (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.price_per_case}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const piece = newSku.units_per_case > 0 ? parseFloat((val / newSku.units_per_case).toFixed(2)) : 0;
                      setNewSku({...newSku, price_per_case: val, price_per_unit: piece});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Price (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.price_per_unit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const cse = parseFloat((val * newSku.units_per_case).toFixed(2));
                      setNewSku({...newSku, price_per_unit: val, price_per_case: cse});
                    }}
                    placeholder={newSku.units_per_case > 0 ? (newSku.price_per_case / newSku.units_per_case).toFixed(2) : ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Cost Pack (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.cogs_per_case}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const piece = newSku.units_per_case > 0 ? parseFloat((val / newSku.units_per_case).toFixed(2)) : 0;
                      setNewSku({...newSku, cogs_per_case: val, cogs_per_unit: piece});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Cost (PKR)</label>
                  <input 
                    type="number" 
                    value={newSku.cogs_per_unit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const cse = parseFloat((val * newSku.units_per_case).toFixed(2));
                      setNewSku({...newSku, cogs_per_unit: val, cogs_per_case: cse});
                    }}
                    placeholder={newSku.units_per_case > 0 ? (newSku.cogs_per_case / newSku.units_per_case).toFixed(2) : ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div className="col-span-2 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Expected Margin</p>
                    <p className="text-xl font-black text-emerald-700">
                      Rs. {(newSku.price_per_case - newSku.cogs_per_case).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Margin %</p>
                    <p className="text-xl font-black text-emerald-700">
                      {newSku.price_per_case > 0 ? ((newSku.price_per_case - newSku.cogs_per_case) / newSku.price_per_case * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>

                <div className="col-span-2 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">Initial Stock Entry</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Batch No.</label>
                      <input 
                        type="text" 
                        placeholder="BN-XXXX"
                        value={newSku.initial_batch}
                        onChange={(e) => setNewSku({...newSku, initial_batch: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Expiry</label>
                      <input 
                        type="date" 
                        value={newSku.initial_expiry}
                        onChange={(e) => setNewSku({...newSku, initial_expiry: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Qty(Units)</label>
                      <input 
                        type="number" 
                        value={newSku.initial_quantity}
                        onChange={(e) => setNewSku({...newSku, initial_quantity: Number(e.target.value)})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsAddSkuModalOpen(false)}
                  className="px-6 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={(e) => handleAddSku(e as any, false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Save & Add Another
                </button>
                <button 
                  type="submit" 
                  className="flex-2 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                >
                  Create & Close
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Expiry Alert Popup */}
      {showExpiryAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-2xl border-4 border-rose-100 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8">
              <button 
                onClick={() => setShowExpiryAlert(false)}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-start gap-8">
              <div className="w-20 h-20 bg-rose-100 rounded-[2rem] flex items-center justify-center shrink-0 animate-pulse">
                <ShieldAlert className="w-10 h-10 text-rose-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-2 italic">Expiry <span className="text-rose-600 underline decoration-4 underline-offset-8">Critical Warning</span></h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8">
                  The following items have less than 4 months remaining in their shelf life. 
                  Automatic intimations will be logged for these suppliers.
                </p>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-4 mb-8 custom-scrollbar">
                  {nearExpiryProducts.map((p, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between group">
                      <div>
                        <p className="font-black text-slate-900 uppercase tracking-tighter">{p.sku_name}</p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Expires: {new Date(p.expiry_date).toLocaleDateString()}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lot: {p.batch_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-slate-900">{p.quantity_cases} Cases</p>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Supplier: {p.supplier_name}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                        // Bulk intimate for all near-expiry products that don't have a claim yet
                        nearExpiryProducts.forEach(p => {
                          const existing = claims.find(c => c.sku_id === p.sku_id && c.batch_number === p.batch_number && c.type === 'Expiry');
                          if (!existing) {
                            fetch('/api/claims', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                supplier_id: p.supplier_id,
                                sku_id: p.sku_id,
                                batch_number: p.batch_number,
                                quantity: p.quantity_cases,
                                type: 'Expiry',
                                description: `AUTO: Product expiring on ${p.expiry_date}. Intimation sent to ${p.supplier_name}.`
                              })
                            }).then(res => res.json()).then(data => {
                                fetch(`/api/claims/${data.id}/status`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'intimated' })
                                });
                            });
                          }
                        });
                        setTimeout(fetchData, 1000);
                        setShowExpiryAlert(false);
                        setViewMode('claims');
                    }}
                    className="flex-1 btn-primary py-4 font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-rose-200"
                  >
                    Auto-Intimate All
                  </button>
                  <button 
                    onClick={() => setShowExpiryAlert(false)}
                    className="flex-1 btn-outline py-4 font-black uppercase text-xs tracking-[0.2em]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Claim Modal */}
      {isAddClaimModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Register New Claim</h3>
            </div>
            <form onSubmit={handleAddClaim} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier</label>
                  <select 
                    required
                    value={newClaim.supplier_id}
                    onChange={(e) => setNewClaim({...newClaim, supplier_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product / SKU</label>
                  <select 
                    required
                    value={newClaim.sku_id}
                    onChange={(e) => {
                      const sku = skus.find(s => s.id.toString() === e.target.value);
                      setNewClaim({...newClaim, sku_id: e.target.value, supplier_id: sku?.supplier_id || newClaim.supplier_id});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="">Select Product</option>
                    {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Batch #</label>
                  <input 
                    type="text"
                    value={newClaim.batch_number}
                    onChange={(e) => setNewClaim({...newClaim, batch_number: e.target.value})}
                    placeholder="Optional"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Quantity</label>
                  <input 
                    required
                    type="number"
                    value={newClaim.quantity || ''}
                    onChange={(e) => setNewClaim({...newClaim, quantity: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Claim Type</label>
                  <select 
                    required
                    value={newClaim.type}
                    onChange={(e) => setNewClaim({...newClaim, type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="Damage">Damage</option>
                    <option value="Leakage">Leakage</option>
                    <option value="Expiry">Expiry</option>
                    <option value="Shortage">Shortage</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Description</label>
                  <textarea 
                    rows={3}
                    value={newClaim.description}
                    onChange={(e) => setNewClaim({...newClaim, description: e.target.value})}
                    placeholder="Add details about the issue..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAddClaimModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-800 transition-all"
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit SKU Modal */}
      {isEditSkuModalOpen && selectedSku && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-accent p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Update SKU: {selectedSku.name}</h3>
            </div>
            
            <form onSubmit={handleUpdateSku} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product Name</label>
                  <input 
                    required
                    type="text" 
                    value={selectedSku.name}
                    onChange={(e) => setSelectedSku({...selectedSku, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-accent outline-none"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                  <select 
                    value={selectedSku.category}
                    onChange={(e) => setSelectedSku({...selectedSku, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="General">General</option>
                    <option value="SATT">SATT</option>
                    <option value="FLOURS">FLOURS</option>
                    <option value="Energy Drinks">Energy Drinks</option>
                    <option value="CSD">CSD</option>
                    <option value="ALKALINE Water">ALKALINE Water</option>
                    <option value="Cosmetic">Cosmetic</option>
                    <option value="Tissues">Tissues</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier</label>
                  <select 
                    value={selectedSku.supplier_id || ''}
                    onChange={(e) => setSelectedSku({...selectedSku, supplier_id: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                  {selectedSku.supplier_id && (
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-[9px] font-black uppercase text-slate-400">Current Payable</span>
                      <span className="text-[10px] font-black text-rose-600">
                        Rs. {suppliers.find(s => s.id.toString() === selectedSku.supplier_id.toString())?.balance?.toLocaleString() || 0}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Units per pack</label>
                  <input 
                    type="number" 
                    value={selectedSku.units_per_case}
                    onChange={(e) => {
                      const units = Number(e.target.value);
                      const piecePrice = units > 0 ? parseFloat((selectedSku.price_per_case / units).toFixed(2)) : 0;
                      const pieceCogs = units > 0 ? parseFloat((selectedSku.cogs_per_case / units).toFixed(2)) : 0;
                      setSelectedSku({...selectedSku, units_per_case: units, price_per_unit: piecePrice, cogs_per_unit: pieceCogs});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Price Pack (PKR)</label>
                  <input 
                    type="number" 
                    value={selectedSku.price_per_case}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const piece = selectedSku.units_per_case > 0 ? parseFloat((val / selectedSku.units_per_case).toFixed(2)) : 0;
                      setSelectedSku({...selectedSku, price_per_case: val, price_per_unit: piece});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Price (PKR)</label>
                  <input 
                    type="number" 
                    value={selectedSku.price_per_unit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const cse = parseFloat((val * selectedSku.units_per_case).toFixed(2));
                      setSelectedSku({...selectedSku, price_per_unit: val, price_per_case: cse});
                    }}
                    placeholder={selectedSku.units_per_case > 0 ? (selectedSku.price_per_case / selectedSku.units_per_case).toFixed(2) : ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Cost Pack (PKR)</label>
                  <input 
                    type="number" 
                    value={selectedSku.cogs_per_case}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const piece = selectedSku.units_per_case > 0 ? parseFloat((val / selectedSku.units_per_case).toFixed(2)) : 0;
                      setSelectedSku({...selectedSku, cogs_per_case: val, cogs_per_unit: piece});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Unit Cost (PKR)</label>
                  <input 
                    type="number" 
                    value={selectedSku.cogs_per_unit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const cse = parseFloat((val * selectedSku.units_per_case).toFixed(2));
                      setSelectedSku({...selectedSku, cogs_per_unit: val, cogs_per_case: cse});
                    }}
                    placeholder={selectedSku.units_per_case > 0 ? (selectedSku.cogs_per_case / selectedSku.units_per_case).toFixed(2) : ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>

                <div className="col-span-2 p-4 bg-accent/5 rounded-2xl border border-accent/10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest">Current Margin</p>
                    <p className="text-xl font-black text-slate-900">
                      Rs. {(selectedSku.price_per_case - selectedSku.cogs_per_case).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-accent uppercase tracking-widest">Margin %</p>
                    <p className="text-xl font-black text-slate-900">
                      {selectedSku.price_per_case > 0 ? ((selectedSku.price_per_case - selectedSku.cogs_per_case) / selectedSku.price_per_case * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsEditSkuModalOpen(false)}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-accent text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleDeleteSku()}
                  className="w-full py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-[10px] tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
                >
                  Delete SKU Permanently
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

      {/* Edit Batch Modal */}
      {isEditBatchModalOpen && selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Update Batch: {selectedBatch.batch_number}</h3>
            </div>
            
            <form onSubmit={handleUpdateBatch} className="p-8 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Product</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-400">
                  {selectedBatch.sku_name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Batch Number</label>
                  <input 
                    type="text" 
                    value={selectedBatch.batch_number}
                    onChange={(e) => setSelectedBatch({...selectedBatch, batch_number: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Expiry Date</label>
                  <input 
                    type="date" 
                    value={selectedBatch.expiry_date}
                    onChange={(e) => setSelectedBatch({...selectedBatch, expiry_date: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Quantity (Cases)</label>
                  <input 
                    type="number" 
                    value={selectedBatch.quantity_cases}
                    onChange={(e) => setSelectedBatch({...selectedBatch, quantity_cases: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Quantity (Units)</label>
                  <input 
                    type="number" 
                    value={selectedBatch.quantity_units}
                    onChange={(e) => setSelectedBatch({...selectedBatch, quantity_units: Number(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsEditBatchModalOpen(false)}
                    className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
                  >
                    Save Batch
                  </button>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleDeleteBatch()}
                  className="w-full py-3 bg-rose-50 text-rose-600 rounded-xl font-black uppercase text-[10px] tracking-widest border border-rose-100 hover:bg-rose-100 transition-all"
                >
                  Delete Batch Entry
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {isEditSupplierModalOpen && selectedSupplierAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-primary p-6 text-white text-center">
              <h3 className="text-xl font-black uppercase tracking-widest">Update Supplier: {selectedSupplierAction.name}</h3>
            </div>
            
            <form onSubmit={handleUpdateSupplier} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Supplier Name</label>
                  <input 
                    required
                    type="text" 
                    value={selectedSupplierAction.name}
                    onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Category</label>
                    <select 
                      value={selectedSupplierAction.category}
                      onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, category: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                    >
                      <option value="General">General</option>
                      <option value="SATT">SATT</option>
                      <option value="FLOURS">FLOURS</option>
                      <option value="Energy Drinks">Energy Drinks</option>
                      <option value="CSD">CSD</option>
                      <option value="ALKALINE Water">ALKALINE Water</option>
                      <option value="Cosmetic">Cosmetic</option>
                      <option value="Tissues">Tissues</option>
                    </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Contact Person</label>
                  <input 
                    type="text" 
                    value={selectedSupplierAction.contact_person}
                    onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, contact_person: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Phone</label>
                  <input 
                    type="text" 
                    value={selectedSupplierAction.phone}
                    onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, phone: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Email</label>
                  <input 
                    type="email" 
                    value={selectedSupplierAction.email}
                    onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, email: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Address</label>
                  <input 
                    type="text" 
                    value={selectedSupplierAction.address}
                    onChange={(e) => setSelectedSupplierAction({...selectedSupplierAction, address: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setIsEditSupplierModalOpen(false)}
                  className="flex-1 py-4 font-black uppercase text-xs tracking-widest text-slate-400"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
