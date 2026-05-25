import { useState, useEffect, FormEvent } from 'react';
import { Truck, Fuel, ShieldCheck, PenTool, AlertTriangle, Gauge, History, Package, MapPin, CheckCircle2, ChevronRight, User, Plus, X, Trash2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace } from '../lib/WorkspaceContext';
import { formatDate } from '../lib/dateUtils';

export default function Fleet() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dispatch' | 'vehicles'>('dispatch');
  const { currentUserRole } = useWorkspace();

  // Modal states
  const [isEnlistModalOpen, setIsEnlistModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [vehicleLogs, setVehicleLogs] = useState<any[]>([]);

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_number: '',
    model: '',
    current_km: 0,
    last_service_km: 0
  });

  const [logForm, setLogForm] = useState({
    type: 'Fuel' as 'Fuel' | 'Oil' | 'Tires' | 'Brakes',
    amount: 0,
    km: 0
  });

  const fetchData = async () => {
    try {
      const [vRes, oRes, eRes] = await Promise.all([
        fetch('/api/fleet'),
        fetch('/api/reports/sales'),
        fetch('/api/employees')
      ]);
      const [vData, oData, eData] = await Promise.all([vRes.json(), oRes.json(), eRes.json()]);
      setVehicles(vData);
      setOrders(oData);
      setEmployees(eData);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const drivers = employees.filter(e => e.role?.toLowerCase() === 'driver');
  
  const handleDispatch = async (orderId: number, driverId: number) => {
    await fetch(`/api/orders/${orderId}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId })
    });
    fetchData();
  };

  const handleDeliver = async (orderId: number) => {
    await fetch(`/api/orders/${orderId}/deliver`, { method: 'POST' });
    fetchData();
  };

  const handleEnlistVehicle = async (e: FormEvent) => {
    e.preventDefault();
    await fetch('/api/fleet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vehicleForm)
    });
    setVehicleForm({ vehicle_number: '', model: '', current_km: 0, last_service_km: 0 });
    setIsEnlistModalOpen(false);
    fetchData();
  };

  const handleLogSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    await fetch('/api/fleet/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...logForm, vehicle_id: selectedVehicle.id })
    });
    setIsLogModalOpen(false);
    fetchData();
  };

  const fetchLogs = async (id: number) => {
    const res = await fetch(`/api/fleet/${id}/logs`);
    const data = await res.json();
    setVehicleLogs(data);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!confirm('Are you sure you want to decommission this vehicle? All history will be lost.')) return;
    await fetch(`/api/fleet/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const myDeliveries = orders.filter(o => o.delivery_status === 'dispatched');

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3">
            LOGISTICS <span className="text-accent">& DISPATCH</span>
            <Truck className="w-8 h-8 text-slate-200" />
          </h1>
          <div className="flex gap-4 mt-6">
            <button 
              onClick={() => setActiveTab('dispatch')}
              className={`text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all ${activeTab === 'dispatch' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Dispatch Center
            </button>
            <button 
              onClick={() => setActiveTab('vehicles')}
              className={`text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all ${activeTab === 'vehicles' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Vehicle Registry
            </button>
          </div>
        </div>
        
        {activeTab === 'vehicles' && currentUserRole === 'admin' && (
          <button 
            onClick={() => setIsEnlistModalOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Enlist Vehicle
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dispatch' ? (
          <motion.div 
            key="dispatch"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* Shipment Queue */}
            {currentUserRole === 'admin' && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-accent" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Shipment Queue (Warehouse Control)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orders.filter(o => o.delivery_status === 'pending').map(order => (
                    <div key={order.id} className="erp-card bg-[#f8fafc]">
                      <div className="card-title">Order ID: #{order.id}</div>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-black text-slate-900 leading-tight truncate w-48">{order.customer_name}</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{formatDate(order.order_date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">Rs. {order.total_amount.toLocaleString()}</p>
                          <span className="text-[8px] bg-amber-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-tighter">Pending Dispatch</span>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Assign Dispatcher</p>
                        <div className="flex flex-wrap gap-2">
                          {drivers.length > 0 ? drivers.map(driver => (
                            <button 
                              key={driver.id}
                              onClick={() => handleDispatch(order.id, driver.id)}
                              className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-[2px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                            >
                              <User className="w-3 h-3" />
                              {driver.name.split(' ')[0]}
                            </button>
                          )) : (
                            <p className="text-[10px] font-bold text-rose-400">No active drivers available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.filter(o => o.delivery_status === 'pending').length === 0 && (
                    <div className="col-span-full py-12 erp-card border-dashed border-2 flex flex-col items-center justify-center text-slate-300">
                      <Package className="w-12 h-12 mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.3em]">No orders awaiting dispatch</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Live Deliveries */}
            {(currentUserRole === 'driver' || currentUserRole === 'admin') && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Live Deliveries (Transit)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myDeliveries.map(order => (
                    <div key={order.id} className="erp-card bg-emerald-50/30 border-emerald-100">
                      <div className="card-title text-emerald-600 border-emerald-500">Transit: #{order.id}</div>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="font-black text-slate-900 leading-tight">{order.customer_name}</h3>
                          <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-2">
                            <MapPin className="w-3 h-3 text-emerald-500" />
                            {order.route}
                          </div>
                        </div>
                        <div className="bg-emerald-500 text-white p-2 rounded shadow-lg animate-pulse">
                          <Truck className="w-4 h-4" />
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleDeliver(order.id)}
                        className="w-full bg-emerald-600 text-white font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-[2px] hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-3"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm Delivery
                      </button>
                    </div>
                  ))}
                  {myDeliveries.length === 0 && (
                    <div className="col-span-full py-12 erp-card border-dashed border-2 flex flex-col items-center justify-center text-slate-300">
                      <Truck className="w-12 h-12 mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.3em]">No shipments in active transit</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="vehicles"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {vehicles.map(vehicle => {
              const kmSinceService = vehicle.current_km - vehicle.last_service_km;
              const serviceDue = kmSinceService > 5000;
              
              return (
                <div key={vehicle.id} className={`erp-card relative group ${serviceDue ? 'ring-2 ring-rose-500/20' : ''}`}>
                  <div className="flex justify-between items-start mb-6">
                    <div className="card-title !m-0">Reg: {vehicle.vehicle_number}</div>
                    {currentUserRole === 'admin' && (
                      <button 
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-start justify-between relative z-10 mb-8">
                    <div className="bg-primary text-white p-3 rounded shadow-lg">
                      <Gauge className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase leading-none">Vehicle Group</p>
                      <p className="text-xl font-black text-slate-900 mt-1 uppercase tracking-tighter italic">{vehicle.model}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                      <span>Current Mileage</span>
                      <span className="font-black text-slate-900">{vehicle.current_km?.toLocaleString()} KM</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <span>Engine Health</span>
                        <span className={`${serviceDue ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {serviceDue ? 'URGENT SERVICE' : 'NOMINAL'}
                        </span>
                      </div>
                      <div className="h-4 bg-slate-100 rounded-[1px] overflow-hidden p-[2px]">
                        <div 
                          className={`h-full transition-all duration-1000 ${serviceDue ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                          style={{ width: `${Math.max(5, Math.min(100, (kmSinceService / 5000) * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <button 
                        onClick={() => { setSelectedVehicle(vehicle); setLogForm({ ...logForm, km: vehicle.current_km }); setIsLogModalOpen(true); }}
                        className="flex-1 btn-outline"
                      >
                        <Fuel className="w-3.5 h-3.5" />
                        New Log
                      </button>
                      <button 
                        onClick={() => fetchLogs(vehicle.id)}
                        className="flex-1 btn-outline"
                      >
                        <History className="w-3.5 h-3.5" />
                        History
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enlist Vehicle Modal */}
      <AnimatePresence>
        {isEnlistModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEnlistModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10"
            >
              <div className="bg-slate-900 p-8 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter italic">Enlist Vehicle</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Registry Authorization Input</p>
                  </div>
                  <button onClick={() => setIsEnlistModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleEnlistVehicle} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Reg Number</label>
                    <input 
                      required
                      type="text" 
                      placeholder="LES-20-4532"
                      value={vehicleForm.vehicle_number}
                      onChange={(e) => setVehicleForm({...vehicleForm, vehicle_number: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black uppercase placeholder:text-slate-300 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Model/Type</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Toyota Hiace 2021"
                      value={vehicleForm.model}
                      onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Current KM</label>
                    <input 
                      type="number" 
                      value={vehicleForm.current_km}
                      onChange={(e) => setVehicleForm({...vehicleForm, current_km: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest">Last Service (KM)</label>
                    <input 
                      type="number" 
                      value={vehicleForm.last_service_km}
                      onChange={(e) => setVehicleForm({...vehicleForm, last_service_km: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white font-black uppercase py-4 rounded-xl shadow-xl active:scale-95 transition-all text-xs tracking-widest">
                  Authorize & Enlist
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log Modal */}
      <AnimatePresence>
        {isLogModalOpen && selectedVehicle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsLogModalOpen(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10" >
              <div className="bg-slate-900 p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase tracking-widest italic">Log Resource Info</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Reg: {selectedVehicle.vehicle_number}</p>
              </div>
              <form onSubmit={handleLogSubmit} className="p-6 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest text-center">Metric Type</label>
                  <div className="flex bg-slate-50 p-1 rounded-xl gap-1">
                    {(['Fuel', 'Oil', 'Tires', 'Brakes'] as const).map(type => (
                      <button 
                        key={type}
                        type="button"
                        onClick={() => setLogForm({...logForm, type})}
                        className={`flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all ${logForm.type === type ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Amount (Rs)</label>
                    <input 
                      required
                      type="number" 
                      value={logForm.amount}
                      onChange={(e) => setLogForm({...logForm, amount: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block">Current KM</label>
                    <input 
                      required
                      type="number" 
                      value={logForm.km}
                      onChange={(e) => setLogForm({...logForm, km: Number(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-black outline-none"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-slate-900 text-white font-black uppercase py-4 rounded-xl shadow-xl active:scale-95 transition-all text-xs tracking-widest">
                  Commit Record
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsHistoryModalOpen(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10 max-h-[80vh] flex flex-col" >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-widest italic">Maintenance Chronicle</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detailed Log History</p>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-3">
                {vehicleLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${log.type === 'Fuel' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {log.type === 'Fuel' ? <Fuel className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase text-slate-900">{log.type} Service</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <Calendar className="w-3 h-3 text-slate-400" />
                           <p className="text-[10px] font-bold text-slate-400 italic">{formatDate(log.date)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-slate-900">Rs. {log.amount.toLocaleString()}</p>
                       <p className="text-[10px] font-bold text-slate-400 italic">{log.km_at_log.toLocaleString()} KM</p>
                    </div>
                  </div>
                ))}
                {vehicleLogs.length === 0 && (
                  <p className="text-center py-10 text-xs font-bold text-slate-400 uppercase tracking-widest">No history recorded yet</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

