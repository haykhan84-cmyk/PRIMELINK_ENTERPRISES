import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  MapPin, 
  Users, 
  Package, 
  ShieldCheck, 
  Search, 
  Check, 
  X, 
  Calendar, 
  ChevronDown, 
  User, 
  TrendingUp, 
  Sliders, 
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../lib/WorkspaceContext';
import OmniSearch from './OmniSearch';

interface RouteEntity {
  id: number;
  name: string;
  territory: string;
  assigned_days: string;
  salesman_id: number | null;
  driver_id: number | null;
  salesman_name?: string;
  driver_name?: string;
  isActive: number;
}

interface CustomerEntity {
  id: number;
  name: string;
  shop_name: string;
  route: string;
  contact: string;
  credit_limit: number;
  discount_pc: number;
  balance: number;
  isActive: number;
}

interface SkuEntity {
  id: number;
  name: string;
  category: string;
  price_per_case: number;
  price_per_unit: number;
  units_per_case: number;
  cogs_per_case: number;
  cogs_per_unit: number;
  gst_rate: number;
  isActive: number;
}

interface EmployeeEntity {
  id: number;
  name: string;
  role: string;
  contact: string;
  base_salary: number;
  commission_pc: number;
  food_allowance: number;
  working_days: number;
  status: string;
  isActive: number;
}

export default function MasterDataManager() {
  const { currentUserRole } = useWorkspace();
  const isAdmin = currentUserRole?.toLowerCase() === 'admin' || currentUserRole?.toLowerCase() === 'it';

  const [activeSubTab, setActiveSubTab] = useState<'routes' | 'customers' | 'products' | 'staff'>('routes');
  
  // Data lists
  const [routes, setRoutes] = useState<RouteEntity[]>([]);
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [skus, setSkus] = useState<SkuEntity[]>([]);
  const [employees, setEmployees] = useState<EmployeeEntity[]>([]);
  
  // Loading and search
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [routeForm, setRouteForm] = useState({
    name: '',
    territory: '',
    assigned_days: [] as string[],
    salesman_id: '',
    driver_id: '',
    isActive: 1
  });

  const [customerForm, setCustomerForm] = useState({
    name: '',
    shop_name: '',
    route: '',
    contact: '',
    credit_limit: 50000,
    discount_pc: 0,
    isActive: 1
  });

  const [skuForm, setSkuForm] = useState({
    name: '',
    category: 'FLOURS',
    units_per_case: 12,
    price_per_unit: 0,
    price_per_case: 0,
    cogs_per_unit: 0,
    cogs_per_case: 0,
    gst_rate: 18,
    isActive: 1
  });

  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: 'Salesman',
    contact: '',
    base_salary: 25000,
    commission_pc: 1.5,
    food_allowance: 1500,
    working_days: 26,
    status: 'active',
    isActive: 1
  });

  // Weekdays for route days
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Load active data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'routes') {
        const res = await fetch('/api/routes');
        const data = await res.json();
        setRoutes(data);
      } else if (activeSubTab === 'customers') {
        const res = await fetch('/api/customers');
        const data = await res.json();
        setCustomers(data);
      } else if (activeSubTab === 'products') {
        const res = await fetch('/api/skus');
        const data = await res.json();
        setSkus(data);
      } else if (activeSubTab === 'staff') {
        const res = await fetch('/api/employees');
        const data = await res.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error("Error fetching admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Pre-fetch related dropdown data on start or tab changes
    if (activeSubTab === 'routes' || activeSubTab === 'customers') {
      fetch('/api/employees').then(r => r.json()).then(setEmployees).catch(() => {});
    }
    if (activeSubTab === 'customers') {
      fetch('/api/routes').then(r => r.json()).then(setRoutes).catch(() => {});
    }
  }, [activeSubTab]);

  if (!isAdmin) {
    return (
      <div className="p-8 bg-red-50 border-2 border-red-200 rounded-2xl flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-red-900 uppercase">ACCESS RESTRICTED</h3>
        <p className="text-red-700 text-xs mt-1 max-w-md font-bold uppercase tracking-wider">
          Only authorized personnel verified as "Admin" or "IT" can modify ERP Master settings. Please elevate your credentials to unlock structural CRUD actions.
        </p>
      </div>
    );
  }

  // Handle Soft Delete
  const handleSoftDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to disable/softdelete this entity across the network? Historical records will remain intact.")) return;
    try {
      let endpoint = '';
      if (activeSubTab === 'routes') endpoint = `/api/routes/${id}`;
      else if (activeSubTab === 'customers') endpoint = `/api/customers/${id}`;
      else if (activeSubTab === 'products') endpoint = `/api/skus/${id}`;
      else if (activeSubTab === 'staff') endpoint = `/api/employees/${id}`;

      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to disable structural record.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    if (activeSubTab === 'routes') {
      setRouteForm({
        name: '',
        territory: '',
        assigned_days: [],
        salesman_id: '',
        driver_id: '',
        isActive: 1
      });
    } else if (activeSubTab === 'customers') {
      setCustomerForm({
        name: '',
        shop_name: '',
        route: routes[0]?.name || '',
        contact: '',
        credit_limit: 50000,
        discount_pc: 0,
        isActive: 1
      });
    } else if (activeSubTab === 'products') {
      setSkuForm({
        name: '',
        category: 'FLOURS',
        units_per_case: 12,
        price_per_unit: 0,
        price_per_case: 0,
        cogs_per_unit: 0,
        cogs_per_case: 0,
        gst_rate: 18,
        isActive: 1
      });
    } else if (activeSubTab === 'staff') {
      setEmployeeForm({
        name: '',
        role: 'Salesman',
        contact: '',
        base_salary: 25000,
        commission_pc: 1.5,
        food_allowance: 1500,
        working_days: 26,
        status: 'active',
        isActive: 1
      });
    }
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: any) => {
    setEditingItem(item);
    if (activeSubTab === 'routes') {
      setRouteForm({
        name: item.name || '',
        territory: item.territory || '',
        assigned_days: item.assigned_days ? item.assigned_days.split(',') : [],
        salesman_id: item.salesman_id ? String(item.salesman_id) : '',
        driver_id: item.driver_id ? String(item.driver_id) : '',
        isActive: item.isActive === undefined ? 1 : item.isActive
      });
    } else if (activeSubTab === 'customers') {
      setCustomerForm({
        name: item.name || '',
        shop_name: item.shop_name || '',
        route: item.route || '',
        contact: item.contact || '',
        credit_limit: item.credit_limit || 50000,
        discount_pc: item.discount_pc || 0,
        isActive: item.isActive === undefined ? 1 : item.isActive
      });
    } else if (activeSubTab === 'products') {
      setSkuForm({
        name: item.name || '',
        category: item.category || 'FLOURS',
        units_per_case: item.units_per_case || 12,
        price_per_unit: item.price_per_unit || 0,
        price_per_case: item.price_per_case || 0,
        cogs_per_unit: item.cogs_per_unit || 0,
        cogs_per_case: item.cogs_per_case || 0,
        gst_rate: item.gst_rate || 18,
        isActive: item.isActive === undefined ? 1 : item.isActive
      });
    } else if (activeSubTab === 'staff') {
      setEmployeeForm({
        name: item.name || '',
        role: item.role || 'Salesman',
        contact: item.contact || '',
        base_salary: item.base_salary || 25000,
        commission_pc: item.commission_pc || 0,
        food_allowance: item.food_allowance || 0,
        working_days: item.working_days || 26,
        status: item.status || 'active',
        isActive: item.isActive === undefined ? 1 : item.isActive
      });
    }
    setIsModalOpen(true);
  };

  // Submit Modal Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let endpoint = '';
      let method = 'POST';
      let body: any = {};

      if (activeSubTab === 'routes') {
        endpoint = editingItem ? `/api/routes/${editingItem.id}` : '/api/routes';
        method = editingItem ? 'PUT' : 'POST';
        body = {
          ...routeForm,
          assigned_days: routeForm.assigned_days.join(',')
        };
      } else if (activeSubTab === 'customers') {
        endpoint = editingItem ? `/api/customers/${editingItem.id}` : '/api/customers';
        method = editingItem ? 'PUT' : 'POST';
        body = customerForm;
      } else if (activeSubTab === 'products') {
        endpoint = editingItem ? `/api/skus/${editingItem.id}` : '/api/skus';
        method = editingItem ? 'PUT' : 'POST';
        body = skuForm;
      } else if (activeSubTab === 'staff') {
        endpoint = '/api/employees'; // Employees POST handles both add & edit when body has id!
        method = 'POST';
        body = {
          ...employeeForm,
          id: editingItem?.id || undefined
        };
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const errorText = await res.text();
        alert("Failed to persist database updates: " + errorText);
      }
    } catch (err) {
      console.error(err);
      alert("Connectivity interruption with regional host.");
    }
  };

  // Filter lists based on search
  const queryLower = searchQuery.toLowerCase();
  
  const filteredRoutes = routes.filter(r => 
    r.name.toLowerCase().includes(queryLower) || 
    r.territory.toLowerCase().includes(queryLower) ||
    (r.salesman_name && r.salesman_name.toLowerCase().includes(queryLower))
  );

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(queryLower) || 
    (c.shop_name && c.shop_name.toLowerCase().includes(queryLower)) || 
    c.route.toLowerCase().includes(queryLower)
  );

  const filteredSkus = skus.filter(s => 
    s.name.toLowerCase().includes(queryLower) || 
    s.category.toLowerCase().includes(queryLower)
  );

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(queryLower) || 
    e.role.toLowerCase().includes(queryLower)
  );

  // Helper calculation for auto case price
  const updatePricePerUnit = (val: number, isSkuForm: boolean) => {
    if (isSkuForm) {
      const units = skuForm.units_per_case || 12;
      setSkuForm(prev => ({
        ...prev,
        price_per_unit: val,
        price_per_case: Math.round(val * units * 100) / 100
      }));
    }
  };

  const updateCogsPerUnit = (val: number, isSkuForm: boolean) => {
    if (isSkuForm) {
      const units = skuForm.units_per_case || 12;
      setSkuForm(prev => ({
        ...prev,
        cogs_per_unit: val,
        cogs_per_case: Math.round(val * units * 100) / 100
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation header */}
      <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap gap-2">
        <button
          onClick={() => { setActiveSubTab('routes'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeSubTab === 'routes' ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Routes & Territories
        </button>
        <button
          onClick={() => { setActiveSubTab('customers'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeSubTab === 'customers' ? 'bg-customers text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <Users className="w-3.5 h-3.5" />
          Customer Shop Directory
        </button>
        <button
          onClick={() => { setActiveSubTab('products'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeSubTab === 'products' ? 'bg-[#5b21b6] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <Package className="w-3.5 h-3.5" />
          Product Catalog
        </button>
        <button
          onClick={() => { setActiveSubTab('staff'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${activeSubTab === 'staff' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
        >
          <User className="w-3.5 h-3.5" />
          Staff & Roles
        </button>
      </div>

      {/* Primary Action Panel & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full md:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={`Search ${activeSubTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-sans text-slate-900 focus:outline-none focus:border-slate-400 transition-all"
          />
        </div>
        <button
          onClick={openAddModal}
          className="w-full md:w-auto px-6 py-2.5 bg-slate-950 text-white hover:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add New Entry
        </button>
      </div>

      {/* Grid structure for current active tab */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-inner font-sans">
        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Executing Dynamic DB Query...
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeSubTab === 'routes' && (
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4">Route Name</th>
                    <th className="p-4">Territory / Area</th>
                    <th className="p-4">Assigned Days</th>
                    <th className="p-4">Link Salesman</th>
                    <th className="p-4">Link Driver</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-bold">
                  {filteredRoutes.map((r) => (
                    <tr key={r.id} className={`hover:bg-slate-50/50 transition-colors ${r.isActive === 0 ? 'opacity-50 bg-slate-50/30' : ''}`}>
                      <td className="p-4 text-slate-900 font-black uppercase">{r.name}</td>
                      <td className="p-4 uppercase">{r.territory}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {r.assigned_days ? r.assigned_days.split(',').map((d, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase">
                              {d.substring(0, 3)}
                            </span>
                          )) : <span className="text-slate-400">-</span>}
                        </div>
                      </td>
                      <td className="p-4 text-primary uppercase">{r.salesman_name || <span className="text-slate-400">Not Assigned</span>}</td>
                      <td className="p-4 text-slate-600 uppercase">{r.driver_name || <span className="text-slate-400">Not Assigned</span>}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${r.isActive === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {r.isActive === 0 ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => openEditModal(r)} className="p-1 px-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded font-bold text-[10px] uppercase text-slate-600">
                          Edit
                        </button>
                        <button onClick={() => handleSoftDelete(r.id)} className="p-1 px-2.5 bg-red-50 border border-red-100 hover:bg-red-100 rounded font-bold text-[10px] uppercase text-red-600" disabled={r.isActive === 0}>
                          Trash
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredRoutes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 uppercase font-bold text-[11px]">No matching routes discovered</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeSubTab === 'customers' && (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4">Shop Name</th>
                    <th className="p-4">Owner / Contact</th>
                    <th className="p-4">Assigned Route</th>
                    <th className="p-4">Credit Limit</th>
                    <th className="p-4">Outstanding Balance</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-bold">
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className={`hover:bg-slate-50/50 transition-colors ${c.isActive === 0 ? 'opacity-50 bg-slate-50/30' : ''}`}>
                      <td className="p-4 font-black text-slate-900 uppercase">
                        <div>{c.shop_name || 'Generic Shop'}</div>
                        <div className="text-[10px] font-bold text-slate-400">{c.name}</div>
                      </td>
                      <td className="p-4 uppercase">
                        <div className="font-mono">{c.contact}</div>
                      </td>
                      <td className="p-4 text-primary uppercase">{c.route}</td>
                      <td className="p-4 font-mono text-slate-900">PKR {Number(c.credit_limit || 0).toLocaleString()}</td>
                      <td className="p-4 font-mono text-red-600">PKR {Number(c.balance || 0).toLocaleString()}</td>
                      <td className="p-4 font-mono text-emerald-600">{c.discount_pc}%</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${c.isActive === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {c.isActive === 0 ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => openEditModal(c)} className="p-1 px-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded font-bold text-[10px] uppercase text-slate-600">
                          Edit
                        </button>
                        <button onClick={() => handleSoftDelete(c.id)} className="p-1 px-2.5 bg-red-50 border border-red-100 hover:bg-red-100 rounded font-bold text-[10px] uppercase text-red-600" disabled={c.isActive === 0}>
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 uppercase font-bold text-[11px]">No customers found in directory</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeSubTab === 'products' && (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4">Item Name (SKU)</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Master Carton Qty</th>
                    <th className="p-4">Trade Price / Unit</th>
                    <th className="p-4">Trade Price / Case</th>
                    <th className="p-4">COGS / Unit</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-bold">
                  {filteredSkus.map((s) => (
                    <tr key={s.id} className={`hover:bg-slate-50/50 transition-colors ${s.isActive === 0 ? 'opacity-50 bg-slate-50/30' : ''}`}>
                      <td className="p-4 font-black text-slate-900 uppercase">{s.name}</td>
                      <td className="p-4 uppercase">{s.category}</td>
                      <td className="p-4 font-mono">{s.units_per_case} Units / Case</td>
                      <td className="p-4 font-mono text-[#5b21b6]">PKR {Number(s.price_per_unit || 0).toLocaleString()}</td>
                      <td className="p-4 font-mono text-[#5b21b6] font-black">PKR {Number(s.price_per_case || 0).toLocaleString()}</td>
                      <td className="p-4 font-mono text-slate-500">PKR {Number(s.cogs_per_unit || 0).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${s.isActive === 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {s.isActive === 0 ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => openEditModal(s)} className="p-1 px-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded font-bold text-[10px] uppercase text-slate-600">
                          Edit
                        </button>
                        <button onClick={() => handleSoftDelete(s.id)} className="p-1 px-2.5 bg-red-50 border border-red-100 hover:bg-red-100 rounded font-bold text-[10px] uppercase text-red-600" disabled={s.isActive === 0}>
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSkus.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 uppercase font-bold text-[11px]">No active SKU specifications found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeSubTab === 'staff' && (
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="p-4">Employee Name</th>
                    <th className="p-4">Assigned Role</th>
                    <th className="p-4">Contact Gateway</th>
                    <th className="p-4">Base Salary</th>
                    <th className="p-4">Commission Rate</th>
                    <th className="p-4">Allowance</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-bold">
                  {filteredEmployees.map((e) => (
                    <tr key={e.id} className={`hover:bg-slate-50/50 transition-colors ${e.isActive === 0 || e.status === 'inactive' ? 'opacity-50 bg-slate-50/30' : ''}`}>
                      <td className="p-4 font-black text-slate-900 uppercase">{e.name}</td>
                      <td className="p-4"><span className="px-2 py-1 bg-slate-100 border rounded text-[9px] font-black uppercase tracking-wider">{e.role}</span></td>
                      <td className="p-4 font-mono">{e.contact}</td>
                      <td className="p-4 font-mono text-slate-900">PKR {Number(e.base_salary || 0).toLocaleString()}</td>
                      <td className="p-4 font-mono text-emerald-600">{e.commission_pc}%</td>
                      <td className="p-4 font-mono">PKR {Number(e.food_allowance || 0).toLocaleString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${e.isActive === 0 || e.status === 'inactive' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {e.isActive === 0 || e.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        <button onClick={() => openEditModal(e)} className="p-1 px-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 rounded font-bold text-[10px] uppercase text-slate-600">
                          Edit
                        </button>
                        <button onClick={() => handleSoftDelete(e.id)} className="p-1 px-2.5 bg-red-50 border border-red-100 hover:bg-red-100 rounded font-bold text-[10px] uppercase text-red-600" disabled={e.isActive === 0 || e.status === 'inactive'}>
                          Disable
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 uppercase font-bold text-[11px]">No active employee directory discovered</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Unified CRUD Management Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-lg overflow-hidden font-sans"
            >
              <div className="bg-slate-950 text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#f2980b]">ERP Master Data Matrix</h3>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                    {editingItem ? 'Edit Structural Entity Instance' : 'Provision New Catalog Entity'}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1 px-2 text-white bg-slate-800 rounded hover:bg-slate-700 font-bold text-[10px]">
                  ESC
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs font-sans text-slate-700">
                {activeSubTab === 'routes' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Route Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Swat Bazaar Road Route"
                        value={routeForm.name}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 uppercase pr-4 focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Territory / General Area</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mingora Valley"
                        value={routeForm.territory}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, territory: e.target.value }))}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 uppercase focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Select Delivery Days</label>
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 border border-slate-200 rounded-lg">
                        {DAYS_OF_WEEK.map((day) => {
                          const isChecked = routeForm.assigned_days.includes(day);
                          return (
                            <label key={day} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-slate-100">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRouteForm(prev => ({ ...prev, assigned_days: [...prev.assigned_days, day] }));
                                  } else {
                                    setRouteForm(prev => ({ ...prev, assigned_days: prev.assigned_days.filter(d => d !== day) }));
                                  }
                                }}
                                className="rounded border-slate-300 text-primary w-4 h-4 cursor-pointer focus:ring-0"
                              />
                              <span className="text-[10px] font-black uppercase text-slate-700">{day}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Salesman in Charge</label>
                        <select
                          value={routeForm.salesman_id}
                          onChange={(e) => setRouteForm(prev => ({ ...prev, salesman_id: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 uppercase focus:border-primary"
                        >
                          <option value="">Unassigned</option>
                          {employees.filter(e => e.role === 'Salesman' && e.status === 'active').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Logistics Driver</label>
                        <select
                          value={routeForm.driver_id}
                          onChange={(e) => setRouteForm(prev => ({ ...prev, driver_id: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 uppercase focus:border-primary"
                        >
                          <option value="">Unassigned</option>
                          {employees.filter(e => (e.role === 'Driver' || e.role === 'Deliveryman') && e.status === 'active').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Route active status</label>
                      <select
                        value={routeForm.isActive}
                        onChange={(e) => setRouteForm(prev => ({ ...prev, isActive: Number(e.target.value) }))}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 uppercase focus:border-primary"
                      >
                        <option value={1}>Active Operations</option>
                        <option value={0}>Disabled / Soft Delete</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeSubTab === 'customers' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Shop Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Swat General Store"
                          value={customerForm.shop_name}
                          onChange={(e) => setCustomerForm(prev => ({ ...prev, shop_name: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Owner Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Zia-ul-Haq"
                          value={customerForm.name}
                          onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 relative z-40">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Route Link</label>
                        <OmniSearch
                          type="routes"
                          value={routes.find(r => r.name === customerForm.route)?.id || ''}
                          onSelect={(selectedRoute) => setCustomerForm(prev => ({ ...prev, route: selectedRoute.name }))}
                          onClear={() => setCustomerForm(prev => ({ ...prev, route: '' }))}
                          placeholder="Search and link route..."
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact Telephone</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 0312-3456789"
                          value={customerForm.contact}
                          onChange={(e) => setCustomerForm(prev => ({ ...prev, contact: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Credit Limit (PKR)</label>
                        <input
                          type="number"
                          required
                          value={customerForm.credit_limit}
                          onChange={(e) => setCustomerForm(prev => ({ ...prev, credit_limit: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Discount Rate (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          required
                          value={customerForm.discount_pc}
                          onChange={(e) => setCustomerForm(prev => ({ ...prev, discount_pc: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status Clearance</label>
                      <select
                        value={customerForm.isActive}
                        onChange={(e) => setCustomerForm(prev => ({ ...prev, isActive: Number(e.target.value) }))}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                      >
                        <option value={1}>Active Status (Show in pad/sales app)</option>
                        <option value={0}>Inactive Status (Hide from operational app)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeSubTab === 'products' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Product Single Item / SKU Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SATT JAR 250GM"
                          value={skuForm.name}
                          onChange={(e) => setSkuForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category Tag</label>
                        <select
                          value={skuForm.category}
                          onChange={(e) => setSkuForm(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        >
                          <option value="FLOURS">Flours (Besan, Corn)</option>
                          <option value="SATT">Satt Healthy Mixes</option>
                          <option value="Energy Drinks">Energy Beverages</option>
                          <option value="CSD">CSD Soft Drinks</option>
                          <option value="ALKALINE Water">Alkaline Spring Water</option>
                          <option value="Cosmetic">Herbion Cosmetic</option>
                          <option value="Tissues">Zams Tissue rolls</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Master Case Pack</label>
                        <input
                          type="number"
                          required
                          value={skuForm.units_per_case}
                          onChange={(e) => {
                            const unitsVal = Number(e.target.value);
                            setSkuForm(prev => ({ 
                              ...prev, 
                              units_per_case: unitsVal,
                              price_per_case: Math.round(prev.price_per_unit * unitsVal * 100) / 100,
                              cogs_per_case: Math.round(prev.cogs_per_unit * unitsVal * 100) / 100
                            }));
                          }}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sales GST Tax Rate (%)</label>
                        <input
                          type="number"
                          required
                          value={skuForm.gst_rate}
                          onChange={(e) => setSkuForm(prev => ({ ...prev, gst_rate: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Trade Price (Per Unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={skuForm.price_per_unit}
                          onChange={(e) => updatePricePerUnit(Number(e.target.value), true)}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-black text-[#5b21b6]">Case Trade Price (Calculated)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={skuForm.price_per_case}
                          onChange={(e) => setSkuForm(prev => ({ ...prev, price_per_case: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-violet-50 outline-none font-black text-violet-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">COGS (Per Unit)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={skuForm.cogs_per_unit}
                          onChange={(e) => updateCogsPerUnit(Number(e.target.value), true)}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Case COGS Cost (Calculated)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={skuForm.cogs_per_case}
                          onChange={(e) => setSkuForm(prev => ({ ...prev, cogs_per_case: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">SKU active state</label>
                      <select
                        value={skuForm.isActive}
                        onChange={(e) => setSkuForm(prev => ({ ...prev, isActive: Number(e.target.value) }))}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                      >
                        <option value={1}>Active SKU (Ready for Sales)</option>
                        <option value={0}>Disabled / Soft Delete</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeSubTab === 'staff' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Swat Driver Ali"
                          value={employeeForm.name}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">ERP Clearance Role</label>
                        <select
                          value={employeeForm.role}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                        >
                          <option value="Salesman">Salesman (Order Booker)</option>
                          <option value="Driver">Logistic Driver</option>
                          <option value="Deliveryman">Deliveryman Staff</option>
                          <option value="Accountant">ERP Accountant</option>
                          <option value="Office Staff">Office Support</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact Gateway Number</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 0333-1234567"
                          value={employeeForm.contact}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, contact: e.target.value }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Base Salary (PKR)</label>
                        <input
                          type="number"
                          required
                          value={employeeForm.base_salary}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, base_salary: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Commission %</label>
                        <input
                          type="number"
                          step="0.05"
                          required
                          value={employeeForm.commission_pc}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, commission_pc: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Daily Allowance</label>
                        <input
                          type="number"
                          required
                          value={employeeForm.food_allowance}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, food_allowance: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Working Days / Mo</label>
                        <input
                          type="number"
                          required
                          value={employeeForm.working_days}
                          onChange={(e) => setEmployeeForm(prev => ({ ...prev, working_days: Number(e.target.value) }))}
                          className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Staff active status</label>
                      <select
                        value={employeeForm.isActive}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEmployeeForm(prev => ({ 
                            ...prev, 
                            isActive: val, 
                            status: val === 1 ? 'active' : 'inactive' 
                          }));
                        }}
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-55 outline-none font-bold text-slate-900 focus:border-primary uppercase"
                      >
                        <option value={1}>Active Status</option>
                        <option value={0}>Inactive Status / Soft Delete</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold uppercase rounded-xl tracking-wider text-[10px]"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="p-2.5 px-6 bg-slate-950 text-white hover:bg-slate-800 font-black uppercase rounded-xl tracking-wider text-[10px] shadow-md"
                  >
                    Save Matrix Changes
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
