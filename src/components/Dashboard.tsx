import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../lib/WorkspaceContext';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  Briefcase, 
  Fuel, 
  Calculator,
  ArrowRight,
  Info,
  ShoppingCart,
  Printer,
  FileText,
  StickyNote,
  Users,
  Truck,
  RotateCcw,
  BookOpen,
  MessageSquare,
  CheckCircle,
  Calendar,
  MapPin,
  Phone,
  PlusCircle,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate } from '../lib/dateUtils';

interface Stats {
  sales: number;
  tax: number;
  expenses: number;
  fleet: number;
  cogs: number;
  netProfit: number;
  totalOrders: number;
  activeEmployees: number;
  inventoryValue: number;
  outstandingReceivables: number;
  counterCash: number;
}

export default function Dashboard({ isUrdu }: { isUrdu?: boolean }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentUserRole, workspaceUid } = useWorkspace();
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [checkingBackups, setCheckingBackups] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      setStats(data);
      
      // If system looks empty, check for cloud snapshots
      if (data.totalOrders === 0 && data.activeEmployees <= 2 && workspaceUid) {
        setCheckingBackups(true);
        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        const backupsRef = collection(db, 'users', workspaceUid, 'backups');
        const q = query(backupsRef, orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Suggest the latest one that actually has some data if possible
        const bestBackup = docs.find((b: any) => (b.count?.customers || 0) > 2) || docs[0];
        setCloudBackups(bestBackup ? [bestBackup] : []);
        setCheckingBackups(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [workspaceUid]);

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="w-12 h-12 border-4 border-primary border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest italic">Synchronizing Terminal Parameters...</p>
      </div>
    );
  }

  // Dashboard variations based on role
  const role = (previewRole || currentUserRole)?.toLowerCase();
  if (role === 'salesman') {
     return (
       <SalesmanDashboard 
         onBackToAdmin={() => setPreviewRole(null)} 
         isAdminPreview={currentUserRole?.toLowerCase() === 'admin'} 
       />
     );
  }

  if (role === 'driver' || role === 'deliveryman') {
     return <DriverDashboard stats={stats} />;
  }

  if (role === 'office boy' || role === 'staff') {
    return <StaffDashboard stats={stats} />;
  }

    return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            ADMIN <span className="text-primary italic">COMMAND</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Azam/Abbas Station</p>
        </div>
        <div className="flex items-center gap-3">
          {currentUserRole?.toLowerCase() === 'admin' && (
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 mr-2">
              <span className="px-3 py-1.5 text-[9px] font-black uppercase text-[#222063] bg-white rounded-lg shadow-sm">
                Admin view
              </span>
              <button
                type="button"
                onClick={() => setPreviewRole('salesman')}
                className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 hover:text-[#222063] rounded-lg transition-all cursor-pointer"
              >
                Salesman View
              </button>
            </div>
          )}
          <button 
            onClick={() => navigate('/order-pad')}
            className="btn-primary !py-2.5 shadow-xl"
          >
            <ShoppingCart className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Recovery Alert for Admins */}
      <AnimatePresence>
        {currentUserRole === 'admin' && cloudBackups.length > 0 && stats.totalOrders === 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <RotateCcw className="w-32 h-32" />
              </div>
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-2xl transition-transform hover:rotate-180 duration-500">
                  <RotateCcw className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">System Continuity Alert</h3>
                  <p className="text-sm text-slate-600 font-medium">We found a cloud snapshot from your previous session. Would you like to restore your contact lists and data?</p>
                  <p className="text-[10px] text-primary font-bold uppercase mt-2">Latest Snapshot: {formatDate(cloudBackups[0].createdAt?.toDate?.() || cloudBackups[0].createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3 relative z-10 w-full md:w-auto">
                <button 
                  onClick={() => navigate('/settings?tab=sync')}
                  className="flex-1 md:flex-none btn-primary shadow-xl"
                >
                  Go to Vault
                </button>
                <button 
                  onClick={() => setCloudBackups([])}
                  className="flex-1 md:flex-none btn-outline bg-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Direct Revenue" value={stats.sales} icon={TrendingUp} trend="+12.5%" color="bg-primary" highlight />
        <StatCard label="Net Valuation" value={stats.netProfit} icon={DollarSign} trend="+8.2%" color="bg-emerald-600" />
        <StatCard label="Total Burden" value={stats.fleet + stats.expenses} icon={Fuel} trend="-2.4%" color="bg-rose-600" />
        <StatCard label="Pending Assets" value={stats.outstandingReceivables} icon={Calculator} trend="Live" color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="erp-card lg:col-span-3 p-8 border-none shadow-sm bg-white relative overflow-hidden">
           <div className="industrial-grid absolute inset-0 opacity-10 pointer-events-none" />
           <div className="flex flex-col xl:flex-row items-center justify-between gap-12 relative z-10">
             <div className="space-y-6 max-w-xl">
               <div>
                <h3 className="text-2xl font-black italic tracking-tight text-slate-900 uppercase leading-none">Operational <span className="text-primary">Intelligence</span></h3>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-2">Active Terminal Synchronization</p>
               </div>
               
               <p className="text-sm text-slate-500 font-medium leading-relaxed">
                 The Primelink system is monitoring all terminal endpoints. Your real-time profitability and stock velocity are being synchronized with the cloud snapshot vault every 20 minutes.
               </p>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Velocity</p>
                    <p className="text-lg font-black text-slate-900">84.2%</p>
                    <div className="h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-primary w-[84%]" />
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal Health</p>
                    <p className="text-lg font-black text-emerald-600">Stable</p>
                    <div className="flex gap-1 mt-2">
                      {[1,2,3,4,5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />)}
                    </div>
                  </div>
               </div>

               <div className="flex gap-4 pt-2">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Hub Active</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Vault Secure</span>
                 </div>
               </div>
             </div>

             <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="h-48 relative">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 absolute -top-6 left-0">Revenue Breakdown</p>
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'COGS', value: stats.cogs || 100, color: '#64748b' },
                            { name: 'Expenses', value: stats.expenses + stats.fleet || 50, color: '#f43f5e' },
                            { name: 'Profit', value: stats.netProfit || 40, color: '#f2980b' }
                          ]}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {[
                            { name: 'COGS', value: stats.cogs || 100, color: '#64748b' },
                            { name: 'Expenses', value: stats.expenses + stats.fleet || 50, color: '#f43f5e' },
                            { name: 'Profit', value: stats.netProfit || 40, color: '#f2980b' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                   </ResponsiveContainer>
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase">Margin</p>
                      <p className="text-xl font-black text-slate-900">{stats.sales ? Math.round((stats.netProfit / stats.sales) * 100) : 0}%</p>
                   </div>
                </div>

                <div className="h-48 relative">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 absolute -top-6 left-0">Stock Velocity Pulse</p>
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[{n:1,v:10},{n:2,v:45},{n:3,v:25},{n:4,v:70},{n:5,v:30},{n:6,v:85}]}>
                        <defs>
                          <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f2980b" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#f2980b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke="#f2980b" strokeWidth={4} fillOpacity={1} fill="url(#colorPulse)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
           </div>
        </div>

        <div className="erp-card p-8 bg-slate-900 border-none shadow-2xl flex flex-col justify-between overflow-hidden relative">
          <div className="industrial-grid absolute inset-0 opacity-10 pointer-events-none" />
          <div className="relative z-10">
            <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-6">Efficiency Matrix</h4>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Order Conversion</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-black text-white">92.4%</p>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Asset Liquidity</p>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-black text-white">1.4x</p>
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Network Latency</p>
                <p className="text-xs font-bold text-white/50">42ms • Stable Hub</p>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/reports')} className="btn-primary w-full mt-8 bg-white text-slate-900 hover:bg-accent hover:text-white relative z-10">Deep Analytics</button>
        </div>
      </div>

      {/* Personal Assets Summary */}
      <div className="space-y-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Personal Archive Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QuickActionCard 
            label="Warehouse Loading" 
            path="/reports?report=loading-sheet" 
            icon={Truck} 
            color="bg-amber-600" 
            desc="Generate daily dispatch manifest"
          />
          <QuickActionCard 
            label="Roznamcha Daybook" 
            path="/roznamcha" 
            icon={BookOpen} 
            color="bg-emerald-600" 
            desc="Enter or review daybook journal logs"
          />
          <QuickActionCard 
            label="Digital Manifests" 
            path="/files" 
            icon={FileText} 
            color="bg-primary" 
            desc="Manage secure document clusters"
          />
          <QuickActionCard 
            label="Neural Notes" 
            path="/notes" 
            icon={StickyNote} 
            color="bg-amber-500" 
            desc="Capture operational insights"
          />
        </div>
      </div>
    </div>
  );
}

function SalesmanDashboard({ onBackToAdmin, isAdminPreview }: { onBackToAdmin?: () => void, isAdminPreview?: boolean }) {
  const navigate = useNavigate();
  const [salesmenList, setSalesmenList] = useState<any[]>([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string>('');
  const [salesmanData, setSalesmanData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);

  // Form State for Interaction Logger
  const [targetCustomerId, setTargetCustomerId] = useState<string>('');
  const [interactionType, setInteractionType] = useState<string>('visit');
  const [interactionNotes, setInteractionNotes] = useState<string>('');
  const [submittingInteraction, setSubmittingInteraction] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    // Retrieve registered salesmen
    fetch('/api/salesmen')
      .then(res => res.json())
      .then(data => {
        setSalesmenList(data);
        if (data.length > 0) {
          // Default to first salesman
          setSelectedSalesmanId(data[0].id.toString());
        }
      })
      .catch(err => console.error("Error loading salesmen list", err));

    // Retrieve territory customers for visit logs
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(err => console.error("Error loading customers", err));
  }, []);

  const fetchSalesmanStats = (id: string) => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/dashboard/salesman/${id}`)
      .then(res => res.json())
      .then(data => {
        setSalesmanData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading salesman stats", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSalesmanStats(selectedSalesmanId);
  }, [selectedSalesmanId]);

  const handleLogInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesmanId || !targetCustomerId || !interactionNotes.trim()) return;

    setSubmittingInteraction(true);
    setSuccessMessage('');

    fetch(`/api/dashboard/salesman/${selectedSalesmanId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: parseInt(targetCustomerId),
        type: interactionType,
        notes: interactionNotes,
        status: 'completed'
      })
    })
      .then(res => res.json())
      .then(data => {
        setSubmittingInteraction(false);
        if (data.success) {
          setSuccessMessage('Interaction recorded to system ledger!');
          setInteractionNotes('');
          // Reload latest snapshot
          fetchSalesmanStats(selectedSalesmanId);
          setTimeout(() => setSuccessMessage(''), 4000);
        }
      })
      .catch(err => {
        console.error("Error logging interaction", err);
        setSubmittingInteraction(false);
      });
  };

  if (!selectedSalesmanId || !salesmanData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="w-12 h-12 border-4 border-primary border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest italic font-mono">Extracting Agent Operations...</p>
      </div>
    );
  }

  const { salesman, stats, interactions, recentOrders } = salesmanData;
  const targetCompletedVal = stats.sales;
  const targetRemainingVal = Math.max(0, stats.targetThreshold - stats.sales);

  const targetPieData = [
    { name: 'Achieved', value: targetCompletedVal, color: '#f2980b' },
    { name: 'Remaining', value: targetRemainingVal, color: '#f1f5f9' }
  ];

  const getInteractionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'visit': return <MapPin className="w-4 h-4 text-emerald-500" />;
      case 'call': return <Phone className="w-4 h-4 text-sky-500" />;
      case 'payment': return <DollarSign className="w-4 h-4 text-amber-500" />;
      default: return <Clock className="w-4 h-4 text-[#222063]" />;
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {isAdminPreview && (
        <div className="bg-amber-50 text-[#222063] border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-900">ADMIN MODE PREVIEW: SALESMAN PORTAL</p>
              <p className="text-[10px] text-amber-700 font-bold uppercase mt-0.5">Simulating performance analytics & interactions client-side</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onBackToAdmin}
            className="w-full sm:w-auto px-4 py-2 bg-[#222063] text-white hover:bg-[#14123d] transition-all rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md cursor-pointer"
          >
            ← Return to Admin command
          </button>
        </div>
      )}
      {/* Salesman Directory Selection Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center relative border border-indigo-100 shrink-0">
            <User className="w-6 h-6 text-[#222063]" />
            <div className="w-3 h-3 bg-emerald-500 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase leading-none">
              SALESMAN <span className="text-accent italic">PORTAL</span>
            </h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mt-1.5">Dynamic Workspace Management Terminal</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none pl-2 sm:pl-0 shrink-0">Agent Profile:</span>
            <select 
              value={selectedSalesmanId}
              onChange={(e) => setSelectedSalesmanId(e.target.value)}
              className="bg-white sm:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-lg px-3 py-2 uppercase outline-none focus:ring-2 focus:ring-[#222063] transition-all cursor-pointer"
            >
              {salesmenList.map((sm) => (
                <option key={sm.id} value={sm.id}>{sm.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => navigate('/order-pad')}
            className="btn-primary !py-3 sm:!py-2.5 shadow-xl flex items-center justify-center gap-2 text-center"
          >
            <ShoppingCart className="w-4 h-4" />
            Rapid Order Pad
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
          <div className="w-10 h-10 border-4 border-accent border-t-[#222063] rounded-full animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest italic">Recalculating territory metrics...</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="erp-card p-6 bg-white border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-[#222063] text-white rounded-2xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Month Revenue Booked</p>
                <p className="text-2xl font-black text-slate-900">Rs. {stats.sales.toLocaleString()}</p>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight mt-1 block">Based on {stats.ordersCount} successfully recorded orders</span>
              </div>
            </div>

            <div className="erp-card p-6 bg-white border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-accent text-white rounded-2xl flex items-center justify-center shadow-lg">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dispatch Load (Cases)</p>
                <p className="text-2xl font-black text-slate-900">{stats.totalCases.toLocaleString()} Cases</p>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight mt-1 block">Average: {stats.ordersCount > 0 ? (stats.totalCases / stats.ordersCount).toFixed(1) : 0} cases/order</span>
              </div>
            </div>

            <div className="erp-card p-6 bg-white border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Efficiency</p>
                <p className="text-2xl font-black text-slate-900">{stats.progressPercent}% achieved</p>
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-tight mt-1 block">Of target Rs. {stats.targetThreshold.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Target Progress Circular Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="erp-card p-8 bg-white border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="industrial-grid absolute inset-0 opacity-10 pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" /> Target Allocation Progress
                </h3>

                <div className="h-44 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={targetPieData}
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {targetPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `Rs. ${Number(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center pointer-events-none mt-1">
                    <p className="text-2xl font-black text-slate-900">{stats.progressPercent}%</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-amber-500" /> Booked Amount
                    </span>
                    <span className="font-black text-slate-900">Rs. {stats.sales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-slate-100" /> Remainder Gap
                    </span>
                    <span className="font-black text-slate-500">Rs. {targetRemainingVal.toLocaleString()}</span>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                    <span className="font-black text-slate-900 uppercase tracking-wider">Quota Cap</span>
                    <span className="font-black text-amber-500">Rs. {stats.targetThreshold.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Orders Overview */}
            <div className="lg:col-span-2 erp-card p-6 sm:p-8 bg-white border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#222063]" /> Live Booking Pipeline
                </h3>
                
                {recentOrders.length === 0 ? (
                  <div className="text-center py-10">
                    <ShoppingCart className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-400 uppercase">No booking orders found on current ledger</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider">Client / Shop</th>
                            <th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider">Stamp Date</th>
                            <th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider">Cash Booked</th>
                            <th className="py-3 text-[9px] font-black uppercase text-slate-400 tracking-wider text-right">Dispatch Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentOrders.map((order: any) => (
                            <tr key={order.id} className="text-xs hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 pr-4">
                                <p className="font-black text-slate-900 leading-tight">{order.shop_name || order.customer_name}</p>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{order.customer_name}</p>
                              </td>
                              <td className="py-3.5 text-slate-500 font-bold">{new Date(order.order_date).toLocaleDateString()}</td>
                              <td className="py-3.5 font-black text-slate-900">Rs. {order.total_amount.toLocaleString()}</td>
                              <td className="py-3.5 text-right">
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                                  order.delivery_status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                  order.delivery_status === 'dispatched' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                  'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                  {order.delivery_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards view */}
                    <div className="block sm:hidden space-y-3">
                      {recentOrders.map((order: any) => (
                        <div key={order.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="font-black text-slate-900 text-xs truncate">{order.shop_name || order.customer_name}</p>
                              <p className="text-[9px] text-slate-400 font-bold mt-0.5 truncate">{order.customer_name}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shrink-0 ${
                              order.delivery_status === 'delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                              order.delivery_status === 'dispatched' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                              'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}>
                              {order.delivery_status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 border-t border-slate-100/50 pt-2 mt-1">
                            <span>{new Date(order.order_date).toLocaleDateString()}</span>
                            <span className="font-black text-slate-900">Rs. {order.total_amount.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => navigate('/order-pad')} className="btn-outline w-full mt-6 flex items-center justify-center gap-2">
                Open Sales Order Terminal <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Timeline of interactions & Logger Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Timeline component */}
            <div className="erp-card p-8 bg-white border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" /> Territorial Action log</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-black tracking-normal">{interactions.length} sessions</span>
              </h3>

              {interactions.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-100 rounded-xl">
                  <MapPin className="w-10 h-10 text-slate-100 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No customer visits mapped</p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase">Log a new trip interaction to construct ledger</p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-3 before:w-0.5 before:bg-slate-100 pl-1">
                  {interactions.map((it: any) => (
                    <div key={it.id} className="flex gap-4 relative">
                      <div className="w-6.5 h-6.5 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center relative z-10 shrink-0 shadow-sm mt-0.5">
                        {getInteractionIcon(it.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-black text-slate-900 truncate uppercase mt-0.5 leading-tight">
                            {it.shop_name || it.customer_name}
                          </p>
                          <span className="text-[8px] text-slate-400 font-bold shrink-0">
                            {new Date(it.interaction_date).toLocaleString([], {hour: '2-digit', minute:'2-digit', month: 'short', day: 'numeric'})}
                          </span>
                        </div>
                        <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest leading-none mt-1">
                          {it.type} mapped
                        </p>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl mt-2">
                          <p className="text-xs text-slate-600 font-medium italic">"{it.notes}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic interaction recorder form */}
            <div className="erp-card p-8 bg-slate-950 text-white relative overflow-hidden flex flex-col justify-between">
              <div className="industrial-grid absolute inset-0 opacity-5 pointer-events-none" />
              <div className="relative z-10 space-y-6 animate-fade-in">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-[#f2980b] flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Mapped Agent Touchpoint
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Real-time GPS/Network Activity Synchronization</p>
                </div>

                {successMessage && (
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black uppercase tracking-widest text-center animate-pulse">
                    {successMessage}
                  </div>
                )}

                 <form onSubmit={handleLogInteraction} className="space-y-4 text-slate-900">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Select Client Spot</label>
                    <select
                      required
                      value={targetCustomerId}
                      onChange={(e) => setTargetCustomerId(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 text-white text-base sm:text-xs font-medium rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-accent transition-all uppercase"
                    >
                      <option value="" className="text-slate-900">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900" style={{color: '#0f172a'}}>{c.shop_name || c.name} ({c.name})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Interaction Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'visit', label: '📍 Visit' },
                        { id: 'call', label: '📞 Call' },
                        { id: 'payment', label: '💰 Payment' },
                        { id: 'follow_up', label: '⏰ Follow' }
                      ].map((typeOption) => (
                        <button
                          key={typeOption.id}
                          type="button"
                          onClick={() => setInteractionType(typeOption.id)}
                          className={`py-3 sm:py-2 text-[10px] sm:text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all text-center ${
                            interactionType === typeOption.id 
                              ? 'bg-[#f2980b] border-[#f2980b] text-white font-extrabold shadow-md' 
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {typeOption.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Agent Comments/Notes</label>
                    <textarea
                      required
                      rows={3}
                      value={interactionNotes}
                      onChange={(e) => setInteractionNotes(e.target.value)}
                      placeholder="Comment on stock stockouts, competitor pricing, payment receipts, orders placement, next planned trip date..."
                      className="w-full bg-white/5 border border-white/10 text-white text-base sm:text-xs font-medium rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-slate-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingInteraction || !targetCustomerId}
                    className="w-full btn-primary bg-[#f2980b] text-[#222063] hover:bg-amber-600 font-black uppercase text-[10px] tracking-widest py-3.5 shadow-xl disabled:opacity-40"
                  >
                    {submittingInteraction ? 'Recording GPS Anchor...' : 'Submit Session Note'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StaffDashboard({ stats }: { stats: Stats }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 text-center">
       <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
         <BookOpen className="w-10 h-10 text-slate-400" />
       </div>
       <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Control Hub</h1>
       <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em]">Authorized Daybook & Notes Sector</p>
       <div className="grid grid-cols-1 max-w-md mx-auto gap-4 mt-8">
          <button onClick={() => navigate('/order-pad')} className="btn-primary py-6 uppercase tracking-widest text-xs">Sales (Batch Pad)</button>
          <button onClick={() => navigate('/roznamcha')} className="btn-outline py-6 uppercase tracking-widest text-xs">Roznamcha (Daybook)</button>
          <button onClick={() => navigate('/notes')} className="btn-outline py-6 uppercase tracking-widest text-xs">My Neural Notes</button>
       </div>
    </div>
  );
}

function DriverDashboard({ stats }: { stats: Stats }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 text-center">
       <Truck className="w-20 h-20 text-slate-200 mx-auto" />
       <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Logistics Station</h1>
       <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em]">Zuhaib • Delivery Terminal</p>
       <div className="grid grid-cols-1 max-w-md mx-auto gap-4 mt-8">
          <button onClick={() => navigate('/fleet')} className="btn-primary py-8 text-xl">View Shipments</button>
          <button onClick={() => navigate('/notes')} className="btn-outline py-8 text-xl">Daily Log</button>
       </div>
    </div>
  );
}

function QuickActionCard({ label, path, icon: Icon, color, desc }: any) {
  const navigate = useNavigate();
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate(path)}
      className="erp-card p-6 border-none shadow-sm cursor-pointer hover:shadow-md transition-all flex items-center gap-5"
    >
      <div className={`w-12 h-12 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-xs font-bold text-slate-600 leading-tight">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-200" />
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, trend, color, colorLight, textColor, highlight }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={`erp-card p-6 border-none shadow-sm relative overflow-hidden transition-all ${highlight ? 'ring-2 ring-emerald-500 ring-offset-4' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${color} text-white shadow-lg`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${trend.startsWith('+') ? 'bg-emerald-100 text-emerald-600' : trend.startsWith('-') ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black tracking-tight ${highlight ? textColor : 'text-slate-900'}`}>Rs. {(Math.round(value) || 0).toLocaleString()}</p>
      </div>
    </motion.div>
  );
}
