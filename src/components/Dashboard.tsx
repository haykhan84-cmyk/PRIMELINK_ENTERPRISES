import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Printer
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
  Area
} from 'recharts';
import { motion } from 'motion/react';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!stats) return <div className="p-8 text-center text-slate-500 font-medium italic">Synchronizing Managerial Parameters...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            MANAGER <span className="text-primary italic">STATION</span>
          </h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] mt-1">Primelink Enterprises • Operational Intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Export Intel
          </button>
          <button 
            onClick={() => navigate('/order-pad')}
            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Gross Revenue" 
          value={stats.sales} 
          icon={TrendingUp} 
          trend="+12.5%" 
          color="bg-primary"
          colorLight="bg-primary/10"
          textColor="text-primary"
        />
        <StatCard 
          label="Net Profit" 
          value={stats.netProfit} 
          icon={DollarSign} 
          trend="+8.2%" 
          color="bg-emerald-600"
          colorLight="bg-emerald-50"
          textColor="text-emerald-600"
          highlight
        />
        <StatCard 
          label="Fleet OpEx" 
          value={stats.fleet + stats.expenses} 
          icon={Fuel} 
          trend="-2.4%" 
          color="bg-rose-600"
          colorLight="bg-rose-50"
          textColor="text-rose-600"
        />
        <StatCard 
          label="Receivables" 
          value={stats.outstandingReceivables} 
          icon={Calculator} 
          trend="Pending" 
          color="bg-amber-500"
          colorLight="bg-amber-50"
          textColor="text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profit Analysis Block */}
        <div className="lg:col-span-2 erp-card p-0 overflow-hidden flex flex-col md:flex-row">
          <div className="p-8 md:w-1/3 bg-slate-900 text-white flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Profitability Index</p>
              <h3 className="text-3xl font-black italic">PKR {stats.netProfit.toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest leading-relaxed">
                Calculated after COGS, OpEx, Fleet and Simulation Taxes.
              </p>
            </div>
            
            <div className="space-y-4 mt-12">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-black text-slate-500 uppercase">Gross Sales</span>
                <span className="font-bold">Rs. {stats.sales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-black text-slate-500 uppercase">Total COGS</span>
                <span className="font-bold">Rs. {stats.cogs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-black text-slate-500 uppercase">OpEx + Fleet</span>
                <span className="font-bold">Rs. {(stats.fleet + stats.expenses).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="p-8 flex-1 bg-white">
            <div className="flex items-center justify-between mb-8">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Revenue Distribution</h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-primary" /> Sales
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> Profit
                </div>
              </div>
            </div>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: 'W1', sales: stats.sales * 0.2, profit: stats.netProfit * 0.18 },
                  { name: 'W2', sales: stats.sales * 0.25, profit: stats.netProfit * 0.22 },
                  { name: 'W3', sales: stats.sales * 0.35, profit: stats.netProfit * 0.38 },
                  { name: 'W4', sales: stats.sales * 0.2, profit: stats.netProfit * 0.22 },
                ]}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#222063" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#222063" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#222063" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Secondary Parameters */}
        <div className="space-y-6">
          <div className="erp-card p-6">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> Operational Vitals
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock on Hand</p>
                <p className="text-xl font-black text-slate-900 leading-none">Rs. {stats.inventoryValue?.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Force</p>
                <p className="text-xl font-black text-slate-900 leading-none">{stats.activeEmployees} Staff</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Daily Bookings</p>
                <p className="text-xl font-black text-slate-900 leading-none">{stats.totalOrders} Units</p>
              </div>
              <div className="p-4 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-100">
                <p className="text-[8px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Counter Cash</p>
                <p className="text-xl font-black leading-none">Rs. {stats.counterCash?.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-primary text-white rounded-2xl shadow-lg border border-primary/20">
                <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-1">Efficiency</p>
                <p className="text-xl font-black leading-none">94.2%</p>
              </div>
            </div>
          </div>

          <div className="erp-card p-6 bg-slate-50 border-none">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Route Saturation</h4>
            <div className="space-y-4">
              {[
                { name: 'Kalam Road', val: 85, color: 'bg-emerald-500' },
                { name: 'Main Bazaar', val: 42, color: 'bg-primary' },
                { name: 'Mingora Bypass', val: 100, color: 'bg-emerald-500' },
              ].map(route => (
                <div key={route.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                    <span className="text-slate-600">{route.name}</span>
                    <span className="text-slate-900">{route.val}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${route.val}%` }}
                      className={`h-full ${route.color}`} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
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
        <p className={`text-2xl font-black tracking-tight ${highlight ? textColor : 'text-slate-900'}`}>Rs. {Math.round(value)?.toLocaleString()}</p>
      </div>
    </motion.div>
  );
}
